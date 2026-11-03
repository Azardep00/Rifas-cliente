// Servidor estático para el e2e: sirve dist/frontend/browser con el fallback de SPA y APLICA los headers
// de vercel.json, así el e2e prueba la CSP real contra el build de producción.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../dist/frontend/browser/', import.meta.url));
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries((vercel.headers?.[0]?.headers ?? []).map((h) => [h.key, h.value]));
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let archivo = join(raiz, ruta);
  try { if (!(await stat(archivo)).isFile()) throw new Error(); } catch { archivo = join(raiz, 'index.html'); }
  try {
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { ...headers, 'Content-Type': tipos[extname(archivo)] ?? 'application/octet-stream' });
    res.end(cuerpo);
  } catch { res.writeHead(500); res.end('Falta el build: corre npm run build'); }
}).listen(4300, () => console.log('e2e en http://localhost:4300'));
