import http from 'node:http';
import fs from 'node:fs';
const root = '/tmp/stax-entity-single-eval-evidence';
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Entity verification</title>'); return; }
  const variant = /^\/build\/(R0|W0|A1|AT1)$/.exec(url.pathname)?.[1];
  const file = variant ? `${root}/builds/${variant}/dist/index.js` : url.pathname === '/client' ? `${root}/browser-smoke.mjs` : url.pathname === '/midsize' ? '/Users/senghyunjo/github/stax-xml/packages/benchmark/assets/midsize.xml' : undefined;
  if (!file) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', variant || url.pathname === '/client' ? 'text/javascript' : 'application/xml');
  fs.createReadStream(file).pipe(res);
}).listen(28478, '127.0.0.1', () => console.log('ready 28478'));
