#!/usr/bin/env node
// Serve o renderer do MMP num http:// para prévia no navegador.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.MMP_PREVIEW_PORT || 47261);
const HOST = process.env.MMP_PREVIEW_HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.exe': 'application/vnd.microsoft.portable-executable'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  if (rel.includes('..')) {
    res.writeHead(400);
    res.end('bad path');
    return;
  }
  const file = path.join(ROOT, rel);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(err && err.code === 'ENOENT' ? 404 : 500);
      res.end(err && err.code === 'ENOENT' ? 'not found' : 'error');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store'
    };
    if (ext === '.zip' || ext === '.exe') {
      headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
    }
    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MMP preview em http://${HOST}:${PORT}`);
});
