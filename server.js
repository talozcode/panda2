import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 8080);
const HOST = '0.0.0.0';
const DIST_DIR = resolve('dist');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = createServer((req, res) => {
  const url = req.url || '/';

  if (url === '/health' || url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const safePath = url === '/' ? '/index.html' : url.split('?')[0];
  let filePath = join(DIST_DIR, safePath);

  if (!existsSync(filePath)) {
    filePath = join(DIST_DIR, 'index.html');
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Build output not found. Run `npm run build` first.');
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Panda Flood server listening on http://${HOST}:${PORT}`);
});
