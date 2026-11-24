import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { MyGift, OtherItem, OwnItem, Person } from "../shared/types";
import { api, loadMe, saveMe } from "./api";
import type { ItemInput, Me } from "./api";

// ---------- Navegación simple por hash: #/  #/mi-lista  #/persona/3 ----------

type Route = { view: "home" } | { view: "mine" } | { view: "person"; id: number };

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, "");
  if (h === "mi-lista") return { view: "mine" };
  const m = h.match(/^persona\/(\d+)$/);
  if (m) return { view: "person", id: Number(m[1]) };
  return { view: "home" };
}

const go = (path: string) => {
  location.hash = path;
};

function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return route;
}

/** Vuelve a cargar al regresar a la pestaña, para ver lo que marcaron otros. */
function useRefreshOnFocus(fn: () => void) {
  useEffect(() => {
    const on = () => document.visibilityState === "visible" && fn();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [fn]);
}

// ---------- Decoración ----------

const FLAKES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 0.6 + ((i * 7) % 10) / 10,
  duration: 9 + ((i * 13) % 12),
  delay: -((i * 17) % 20),
  drift: ((i % 5) - 2) * 12,
}));

function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          style={{
            left: `${f.left}%`,
            fontSize: `${f.size}rem`,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            ["--drift" as string]: `${f.drift}px`,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}

function Garland() {
  return (
    <div className="garland" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

// ---------- App ----------

export default function App() {
  const [me, setMe] = useState<Me | null>(loadMe);
  const [checking, setChecking] = useState(true);
  const route = useRoute();

  // Recupera la sesión desde la cookie del servidor (por si el navegador borró su memoria)
  // y la renueva.
  useEffect(() => {
    api
      .me()
      .then((p) => {
        saveMe(p);
        setMe(p);
      })
      .catch((e: Error) => {
        // Solo cerramos sesión si el servidor dice que no hay; un fallo de red no.
        if (e.message === "Sin sesión") {
          saveMe(null);
          setMe(null);
        }
      })
      .finally(() => setChecking(false));
  }, []);

  const enter = (p: Me) => {
    saveMe(p);
    setMe(p);
    go("/");
  };
  const leave = () => {
    api.logout().catch(() => {});
    saveMe(null);
    setMe(null);
  };

  if (!me && checking) return <Snow />;
  if (!me)
    return (
      <>
        <Snow />
        <Login onEnter={enter} />
      </>
    );

  return (
    <>
      <Snow />
      <header className="top">
        <div className="top-inner">
        <a href="#/" className="brand">
          🎄 Lista de Navidad
        </a>
        <div className="who">
          <span>
            Hola, <b>{me.name}</b>
          </span>
          <button className="link" onClick={leave}>
            No soy yo
          </button>
        </div>
        </div>
        <Garland />
      </header>
      <main className="page">
        {route.view === "home" && <Home me={me} />}
        {route.view === "mine" && <MyList me={me} />}
        {route.view === "person" &&
          (route.id === me.id ? <MyList me={me} /> : <PersonList id={route.id} />)}
      </main>
      <footer className="foot">🎄 ¡Feliz Navidad! 🎁</footer>
    </>
  );
}

// ---------- Entrar con el nombre ----------

function Login({ onEnter }: { onEnter: (me: Me) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const p = await api.enter(name);
      if (!p?.id) throw new Error("No pudimos entrar. Prueba de nuevo.");
      onEnter(p);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="card login-card">
        <div className="big-emoji">🎅</div>
        <h1 className="title">Lista de Navidad</h1>
        <p className="tagline">Pide, regala y comparte la magia ✨</p>
        <p>Escribe tu nombre para entrar:</p>
        <form onSubmit={submit} className="row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            maxLength={40}
            autoComplete="given-name"
            autoCapitalize="words"
          />
          <button className="primary" disabled={busy || !name.trim()}>
            Entrar
          </button>
        </form>
        <p className="muted small">Usa siempre el mismo nombre. Este teléfono te recordará.</p>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

// ---------- Inicio: todas las listas ----------

function Counter({ gifted, total, own }: { gifted: number; total: number; own?: boolean }) {
  if (total === 0) return <span className="muted">Lista vacía</span>;
  const pct = Math.round((gifted / total) * 100);
  return (
    <div className="counter">
      <span>
        {own ? "Te han regalado" : "Regalados:"} <b>{gifted}</b> de <b>{total}</b>
      </span>
      <div className="bar">
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Home({ me }: { me: Me }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [gifts, setGifts] = useState<MyGift[]>([]);

  const load = useCallback(() => {
    api.people().then(setPeople).catch(() => {});
    api.myGifts().then(setGifts).catch(() => {});
  }, []);
  useEffect(load, [load]);
  useRefreshOnFocus(load);

  if (!people) return <p className="muted">Cargando…</p>;
  const mine = people.find((p) => p.id === me.id);
  const others = people.filter((p) => p.id !== me.id);

  return (
    <>
      <section className="card mine-card" onClick={() => go("/mi-lista")}>
        <div>
          <h2>📝 Mi lista</h2>
          <Counter gifted={mine?.gifted ?? 0} total={mine?.total ?? 0} own />
        </div>
        <span className="arrow">›</span>
      </section>

      <h2 className="section-title">👨‍👩‍👧‍👦 Listas de la familia</h2>
      {others.length === 0 && (
        <p className="muted">Todavía no hay otros familiares. ¡Comparte el link!</p>
      )}
      <div className="grid">
        {others.map((p) => (
          <a key={p.id} href={`#/persona/${p.id}`} className="card person-card">
            <h3>{p.name}</h3>
            <Counter gifted={p.gifted} total={p.total} />
          </a>
        ))}
      </div>

      {gifts.length > 0 && (
        <>
          <h2 className="section-title">🛍️ Lo que yo voy a regalar</h2>
          <ul className="card plain-list">
            {gifts.map((g) => (
              <li key={g.itemId}>
                <a href={`#/persona/${g.ownerId}`}>
                  <b>{g.title}</b> <span className="muted">para {g.ownerName}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ---------- Mi lista (el dueño no ve qué le regalaron) ----------

const emptyItem: ItemInput = { title: "", description: "", link: "" };

function ItemForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ItemInput;
  submitLabel: string;
  onSubmit: (i: ItemInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(v);
      setV(emptyItem);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="item-form">
      <input
        value={v.title}
        onChange={(e) => setV({ ...v, title: e.target.value })}
        placeholder="¿Qué te gustaría? (ej: Polera talla M)"
        maxLength={120}
        autoFocus={!!onCancel}
      />
      <textarea
        value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })}
        placeholder="Detalles: color, talla, marca… (opcional)"
        maxLength={500}
        rows={2}
      />
      <input
        value={v.link}
        onChange={(e) => setV({ ...v, link: e.target.value })}
        placeholder="Link de ejemplo (opcional)"
        maxLength={500}
        inputMode="url"
      />
      <div className="row end">
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="primary" disabled={busy || !v.title.trim()}>
          {submitLabel}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function ItemBody({ item }: { item: OwnItem }) {
  const href = item.link && (/^https?:\/\//i.test(item.link) ? item.link : `https://${item.link}`);
  return (
    <div className="item-body">
      <h3>{item.title}</h3>
      {item.description && <p>{item.description}</p>}
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="ext">
          Ver ejemplo ↗
        </a>
      )}
    </div>
  );
}

function MyList({ me }: { me: Me }) {
  const [items, setItems] = useState<OwnItem[] | null>(null);
  const [count, setCount] = useState<Person | undefined>();
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(() => {
    api.ownList(me.id).then((r) => setItems(r.items)).catch(() => {});
    api.people().then((ps) => setCount(ps.find((p) => p.id === me.id))).catch(() => {});
  }, [me.id]);
  useEffect(load, [load]);
  useRefreshOnFocus(load);

  const add = async (i: ItemInput) => {
    await api.addItem(i);
    load();
  };
  const save = async (id: number, i: ItemInput) => {
    await api.editItem(id, i);
    setEditing(null);
    load();
  };
  const remove = async (item: OwnItem) => {
    if (!confirm(`¿Borrar "${item.title}" de tu lista?`)) return;
    await api.deleteItem(item.id);
    load();
  };

  return (
    <>
      <a href="#/" className="back">
        ‹ Volver
      </a>
      <h1>📝 Mi lista</h1>
      <div className="card">
        <Counter gifted={count?.gifted ?? 0} total={count?.total ?? 0} own />
        <p className="muted small">No te diremos cuáles… ¡es sorpresa! 🤫</p>
      </div>

      <div className="card">
        <h2>Agregar un regalo</h2>
        <ItemForm initial={emptyItem} submitLabel="Agregar" onSubmit={add} />
      </div>

      {items === null && <p className="muted">Cargando…</p>}
      {items?.length === 0 && <p className="muted">Tu lista está vacía. ¡Agrega tu primer deseo!</p>}
      <ul className="items">
        {items?.map((item) => (
          <li key={item.id} className="card item">
            {editing === item.id ? (
              <ItemForm
                initial={item}
                submitLabel="Guardar"
                onSubmit={(i) => save(item.id, i)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <ItemBody item={item} />
                <div className="actions">
                  <button onClick={() => setEditing(item.id)}>Editar</button>
                  <button className="danger" onClick={() => remove(item)}>
                    Borrar
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------- Lista de otro familiar ----------

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function PersonList({ id }: { id: number }) {
  const [data, setData] = useState<{ owner: Me; items: OtherItem[] } | null>(null);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState<OtherItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.otherList(id).then(setData).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);
  useRefreshOnFocus(load);

  const confirmGift = async () => {
    if (!picking) return;
    setBusy(true);
    try {
      await api.gift(picking.id);
      setPicking(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const undo = async (item: OtherItem) => {
    if (!confirm(`¿Ya no vas a regalar "${item.title}"?`)) return;
    await api.ungift(item.id);
    load();
  };

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;
  const gifted = data.items.filter((i) => i.gifted).length;

  return (
    <>
      <a href="#/" className="back">
        ‹ Volver
      </a>
      <h1>🎁 Lista de {data.owner.name}</h1>
      <div className="card">
        <Counter gifted={gifted} total={data.items.length} />
      </div>

      {data.items.length === 0 && (
        <p className="muted">{data.owner.name} todavía no ha agregado regalos.</p>
      )}
      <ul className="items">
        {data.items.map((item) => (
          <li key={item.id} className={`card item ${item.gifted ? "is-gifted" : ""}`}>
            <ItemBody item={item} />
            <div className="actions">
              {item.byMe ? (
                <>
                  <span className="badge mine">🎁 Lo regalas tú</span>
                  <button className="link" onClick={() => undo(item)}>
                    Ya no lo regalaré
                  </button>
                </>
              ) : (
                <>
                  {item.gifted && <span className="badge">🎅 Ya fue regalado</span>}
                  <button className="primary" onClick={() => setPicking(item)}>
                    Lo regalo yo
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {picking && (
        <Modal onClose={() => setPicking(null)}>
          {picking.gifted ? (
            <>
              <div className="big-emoji">🎅</div>
              <h2>Esto ya fue regalado</h2>
              <p>
                Alguien más ya va a regalarle <b>{picking.title}</b> a {data.owner.name}.
              </p>
              <p className="muted">Si quieres, puedes regalarlo igual.</p>
            </>
          ) : (
            <>
              <div className="big-emoji">🎁</div>
              <h2>¿Lo regalas tú?</h2>
              <p>
                Vas a regalarle <b>{picking.title}</b> a {data.owner.name}.
              </p>
            </>
          )}
          <div className="row end">
            <button onClick={() => setPicking(null)}>Cancelar</button>
            <button className="primary" onClick={confirmGift} disabled={busy}>
              {picking.gifted ? "Regalarlo igual" : "Sí, lo regalo yo"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
