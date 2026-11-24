// Junta el build del cliente (dist/client) en un único HTML y lo deja como
// módulo para que el Worker lo sirva directamente (sin subir assets aparte).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dir = "dist/client";
let html = readFileSync(join(dir, "index.html"), "utf8");

html = html.replace(/<link rel="stylesheet"[^>]*href="\/([^"]+)"[^>]*>/g, (_, f) =>
  `<style>${readFileSync(join(dir, f), "utf8")}</style>`
);
html = html.replace(/<script type="module"[^>]*src="\/([^"]+)"[^>]*><\/script>/g, (_, f) =>
  `<script type="module">${readFileSync(join(dir, f), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`
);

mkdirSync("worker/generated", { recursive: true });
writeFileSync("worker/generated/page.ts", `export default ${JSON.stringify(html)};\n`);
console.log(`page.ts: ${(html.length / 1024).toFixed(1)} KB`);
