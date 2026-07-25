/* serve.js — serve web/ for local inspection of the ABRA interfaces.
 *
 * The site is static HTML by design (S12: the pages read the same generated JSON the engines emit,
 * so there is nothing to build). This exists only because opening index.html over file:// blocks the
 * fetch() calls the pages use to load data/, so the interfaces look empty and broken.
 *
 * Serves the repo ROOT, not web/, so that pages can reach ../data/*.json exactly as they do when
 * published. Directory listing is disabled; only files under the repo are reachable.
 *
 *   node build/serve.js [port]        default 8099 -> http://localhost:8099/web/index.html
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2] || '8099', 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.jsonl': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.pdf': 'application/pdf',
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/web/index.html';
  /* Contain the server to the repo. Without this, ../ walks out to the whole filesystem. */
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end('not found: ' + rel); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => {
  console.error(`ABRA site -> http://localhost:${PORT}/web/index.html`);
  console.error(`             http://localhost:${PORT}/web/mew.html`);
  console.error(`             http://localhost:${PORT}/web/orb.html`);
});
