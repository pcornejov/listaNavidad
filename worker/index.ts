import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { MyGift, OtherItem, OwnItem, Person } from "../shared/types";

type Env = { DB: D1Database };
type Ctx = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>().basePath("/api");

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const COOKIE = "ln_me";

/** Recuerda a la persona en este dispositivo por un año. */
function rememberPerson(c: Ctx, id: number) {
  setCookie(c, COOKIE, String(id), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
  });
}

/** Identifica a quien usa la app: cookie del servidor o, si no, el id guardado en el navegador. */
async function currentPerson(c: Ctx): Promise<number | null> {
  const id = Number(getCookie(c, COOKIE) ?? c.req.header("X-Person-Id"));
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await c.env.DB.prepare("SELECT id FROM people WHERE id = ?").bind(id).first();
  return row ? id : null;
}

// ---------- Personas ----------

app.get("/people", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.name,
            COUNT(i.id) AS total,
            COUNT(CASE WHEN EXISTS (SELECT 1 FROM gifts g WHERE g.item_id = i.id) THEN 1 END) AS gifted
       FROM people p
       LEFT JOIN items i ON i.owner_id = p.id
      GROUP BY p.id
      ORDER BY p.name COLLATE NOCASE`
  ).all<Person>();
  return c.json(results);
});

/** Normaliza un nombre para compararlo: "  JOSÉ  Pérez" -> "jose perez". */
const nameKey = (name: string) =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** "pablo" -> "Pablo" (solo si el nombre viene todo en minúsculas). */
const prettyName = (name: string) =>
  name === name.toLowerCase() ? name.replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase()) : name;

/** Entra con un nombre: si ya existe (sin importar mayúsculas ni tildes) lo reutiliza, si no lo crea. */
app.post("/people", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = clean(body.name, 40).replace(/\s+/g, " ");
  if (!name) return c.json({ error: "Escribe tu nombre" }, 400);
  const key = nameKey(name);
  const find = () =>
    c.env.DB.prepare("SELECT id, name FROM people WHERE name_key = ?")
      .bind(key)
      .first<{ id: number; name: string }>();
  let person = await find();
  if (!person) {
    // Personas antiguas sin name_key: se buscan por nombre normalizado y se reparan.
    const { results } = await c.env.DB.prepare(
      "SELECT id, name FROM people WHERE name_key IS NULL"
    ).all<{ id: number; name: string }>();
    const legacy = results.find((r) => nameKey(r.name) === key);
    if (legacy) {
      await c.env.DB.prepare("UPDATE people SET name_key = ? WHERE id = ?").bind(key, legacy.id).run();
      person = legacy;
    }
  }
  if (!person) {
    await c.env.DB.prepare("INSERT INTO people (name, name_key) VALUES (?, ?) ON CONFLICT DO NOTHING")
      .bind(prettyName(name), key)
      .run();
    person = await find();
  }
  if (!person) return c.json({ error: "No pudimos entrar con ese nombre. Prueba de nuevo." }, 500);
  rememberPerson(c, person.id);
  return c.json(person);
});

/** ¿Quién soy en este dispositivo? */
app.get("/me", async (c) => {
  const id = await currentPerson(c);
  if (!id) return c.json({ error: "Sin sesión" }, 401);
  rememberPerson(c, id); // renueva la cookie (y la crea si solo venía el id del navegador)
  return c.json(
    await c.env.DB.prepare("SELECT id, name FROM people WHERE id = ?").bind(id).first()
  );
});

app.post("/logout", (c) => {
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

/** Lista de una persona. Si la mira el dueño, no se incluye nada sobre regalos. */
app.get("/people/:id/items", async (c) => {
  const ownerId = Number(c.req.param("id"));
  const me = await currentPerson(c);
  if (!me) return c.json({ error: "Primero elige tu nombre" }, 401);

  const owner = await c.env.DB.prepare("SELECT id, name FROM people WHERE id = ?")
    .bind(ownerId)
    .first<{ id: number; name: string }>();
  if (!owner) return c.json({ error: "No existe esa persona" }, 404);

  if (ownerId === me) {
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, description, link FROM items WHERE owner_id = ? ORDER BY id"
    )
      .bind(ownerId)
      .all<OwnItem>();
    return c.json({ owner, items: results });
  }

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.title, i.description, i.link,
            EXISTS (SELECT 1 FROM gifts g WHERE g.item_id = i.id) AS gifted,
            EXISTS (SELECT 1 FROM gifts g WHERE g.item_id = i.id AND g.giver_id = ?) AS byMe
       FROM items i
      WHERE i.owner_id = ?
      ORDER BY i.id`
  )
    .bind(me, ownerId)
    .all<OtherItem>();
  const items = results.map((r) => ({ ...r, gifted: !!r.gifted, byMe: !!r.byMe }));
  return c.json({ owner, items });
});

// ---------- Mis artículos ----------

app.post("/items", async (c) => {
  const me = await currentPerson(c);
  if (!me) return c.json({ error: "Primero elige tu nombre" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const title = clean(body.title, 120);
  if (!title) return c.json({ error: "El regalo necesita un nombre" }, 400);
  const item = await c.env.DB.prepare(
    "INSERT INTO items (owner_id, title, description, link) VALUES (?, ?, ?, ?) RETURNING id, title, description, link"
  )
    .bind(me, title, clean(body.description, 500), clean(body.link, 500))
    .first<OwnItem>();
  return c.json(item, 201);
});

/** Agrega varios regalos de una vez (p. ej. una lista pegada desde las notas del teléfono). */
app.post("/items/bulk", async (c) => {
  const me = await currentPerson(c);
  if (!me) return c.json({ error: "Primero elige tu nombre" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const titles: string[] = (Array.isArray(body.titles) ? body.titles : [])
    .map((t: unknown) => clean(t, 120))
    .filter(Boolean)
    .slice(0, 100);
  if (titles.length === 0) return c.json({ error: "No hay regalos para agregar" }, 400);
  const stmt = c.env.DB.prepare("INSERT INTO items (owner_id, title) VALUES (?, ?)");
  await c.env.DB.batch(titles.map((t) => stmt.bind(me, t)));
  return c.json({ added: titles.length }, 201);
});

app.put("/items/:id", async (c) => {
  const me = await currentPerson(c);
  if (!me) return c.json({ error: "Primero elige tu nombre" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const title = clean(body.title, 120);
  if (!title) return c.json({ error: "El regalo necesita un nombre" }, 400);
  const item = await c.env.DB.prepare(
    `UPDATE items SET title = ?, description = ?, link = ?
      WHERE id = ? AND owner_id = ?
      RETURNING id, title, description, link`
  )
    .bind(title, clean(body.description, 500), clean(body.link, 500), Number(c.req.param("id")), me)
    .first<OwnItem>();
  if (!item) return c.json({ error: "No puedes editar ese regalo" }, 404);
  return c.json(item);
});

app.delete("/items/:id", async (c) => {
  const me = await currentPerson(c);
  if (!me) return c.json({ error: "Primero elige tu nombre" }, 401);
  const id = Number(c.req.param("id"));
  const owned = await c.env.DB.prepare("SELECT 1 FROM items WHERE id = ? AND owner_id = ?")
    .bind(id, me)
    .first();
  if (!owned) return c.json({ error: "No puedes borrar ese regalo" }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM gifts WHERE item_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id),
  ]);
  return c.json({ ok: true });
});

// ---------- Regalar ----------

/** Marca que yo regalo este artículo. Otros también pueden regalarlo. */
app.post("/items/:id/gift", async (c) => {
  const me = await currentPerson(c);
  if (!me) return c.json({ error: "Primero elige tu nombre" }, 401);
  const id = Number(c.req.param("id"));
  const item = await c.env.DB.prepare("SELECT owner_id FROM items WHERE id = ?")
    .bind(id)
    .first<{ owner_id: number }>();
  if (!item) return c.json({ error: "Ese regalo ya no existe" }, 404);
  if (item.owner_id === me) return c.json({ error: "No puedes regalarte a ti mismo 😉" }, 400);
  await c.env.DB.prepare("INSERT INTO gifts (item_id, giver_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .bind(id, me)
    .run();
  return c.json({ ok: true });
});

app.delete("/items/:id/gift", async (c) => {
  const me = await currentPerson(c);
  if (!me) return c.json({ error: "Primero elige tu nombre" }, 401);
  await c.env.DB.prepare("DELETE FROM gifts WHERE item_id = ? AND giver_id = ?")
    .bind(Number(c.req.param("id")), me)
    .run();
  return c.json({ ok: true });
});

/** Lo que yo voy a regalar (para tener mi propia lista de compras). */
app.get("/my-gifts", async (c) => {
  const me = await currentPerson(c);
  if (!me) return c.json({ error: "Primero elige tu nombre" }, 401);
  const { results } = await c.env.DB.prepare(
    `SELECT i.id AS itemId, i.title, p.id AS ownerId, p.name AS ownerName
       FROM gifts g
       JOIN items i ON i.id = g.item_id
       JOIN people p ON p.id = i.owner_id
      WHERE g.giver_id = ?
      ORDER BY p.name COLLATE NOCASE, i.id`
  )
    .bind(me)
    .all<MyGift>();
  return c.json(results);
});

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

export default app;
