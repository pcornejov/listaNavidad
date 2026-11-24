# 🎄 Lista de Navidad familiar

Sitio para que cada familiar cargue su lista de regalos y los demás elijan qué regalar.

- Se entra **solo con el nombre** (sin claves).
- Cada uno ve su propia lista con un contador ("Te han regalado 3 de 7"), **sin saber cuáles**.
- En la lista de otra persona se ve 🎅 **"Ya fue regalado"**, sin decir quién lo regala.
  Si eliges algo ya regalado, aparece un aviso, pero puedes regalarlo igual.
- En el inicio aparece "Lo que yo voy a regalar" como lista de compras personal.

**Sitio:** https://lista-navidad.pablo-cornejo-v.workers.dev

## Tecnología

React + Vite (interfaz) · Hono en un Cloudflare Worker (API `/api/*`) · Cloudflare D1 (base de datos).

```
src/            interfaz React
worker/         API (index.ts) y entrada de despliegue (embedded.ts)
shared/         tipos compartidos
migrations/     esquema SQL de D1
```

## Desarrollo local

```bash
npm install
npm run db:migrate:local
npm run dev          # http://localhost:5173
```

## Desplegar

```bash
npm run db:migrate:remote   # solo si hay migraciones nuevas
npm run deploy
```

`npm run deploy` compila la interfaz, la mete dentro del Worker (`scripts/embed.mjs`) y
despliega con `wrangler.deploy.jsonc`. Requiere credenciales de Cloudflare
(`wrangler login`, o `CLOUDFLARE_API_TOKEN`).

## Para el próximo año

Para vaciar todo y empezar de nuevo:

```bash
npx wrangler d1 execute lista-navidad --remote -c wrangler.deploy.jsonc \
  --command "DELETE FROM gifts; DELETE FROM items; DELETE FROM people;"
```
