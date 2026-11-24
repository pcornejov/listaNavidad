// Entrada usada al desplegar: API + página embebida en el mismo Worker.
import app from "./index";
import page from "./generated/page";

export default {
  fetch(req: Request, env: { DB: D1Database }, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(req, env, ctx);
    return new Response(page, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  },
} satisfies ExportedHandler<{ DB: D1Database }>;
