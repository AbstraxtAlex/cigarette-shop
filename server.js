// Local server for the shop. No dependencies, needs Node 18+.
//   node server.js            -> http://localhost:8080
// The admin page (/admin) and the write APIs are reachable from any address, so they work in production.
// Optional: set ADMIN_PASSWORD to protect them with a browser login (user name: admin). Unset = open.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
// Production listens on all interfaces; local development stays on loopback. Override with HOST=...
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA = path.join(ROOT, 'data', 'products.json');
const IMAGES = path.join(ROOT, 'images');

const PUBLIC_FILES = new Set(['index.html', 'style.css', 'tokens.css', 'base.css', 'app.js']);
const ADMIN_FILES = new Set(['admin.html', 'admin.css', 'admin.js']);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.txt': 'text/plain; charset=utf-8'
};
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_UPLOAD = 15 * 1024 * 1024;

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
function authorized(req) {
  if (!ADMIN_PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  const user = decoded.slice(0, i), pass = decoded.slice(i + 1);
  // compare both without short-circuiting so timing does not reveal which one was wrong
  const okUser = crypto.timingSafeEqual(digest(user), digest(ADMIN_USER));
  const okPass = crypto.timingSafeEqual(digest(pass), digest(ADMIN_PASSWORD));
  return okUser && okPass;
}
function deny(res) {
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="shop admin", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end('Login required');
}

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), TYPES['.json']);

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, buf, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
}

function validate(data) {
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.cats)) throw new Error('bad shape');
  const ids = new Set();
  const catKeys = new Set(data.cats.map((c) => String(c.key)));
  const products = data.products.map((p) => {
    const id = String(p.id || '').trim();
    const name = String(p.name || '').trim();
    const price = Number(p.price);
    const cat = String(p.cat || 'ot');
    const image = path.basename(String(p.image || ''));
    if (!/^[\w-]{1,40}$/.test(id)) throw new Error('bad id: ' + id);
    if (ids.has(id)) throw new Error('duplicate id: ' + id);
    ids.add(id);
    if (!name || name.length > 80) throw new Error('missing or too long name for ' + id);
    if (!Number.isFinite(price) || price < 0 || price > 1000000) throw new Error('bad price for ' + name);
    if (!catKeys.has(cat)) throw new Error('bad category for ' + name);
    if (image && !IMAGE_EXT.has(path.extname(image).toLowerCase())) throw new Error('bad image for ' + name);
    return { id, name, price, cat, image };
  });
  const cats = data.cats.map((c) => ({ key: String(c.key), label: String(c.label) }));
  return { cats, products };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);

    // ---- API ----
    if (p === '/api/products' && req.method === 'GET') return serveFile(res, DATA);

    if (p === '/api/products' && req.method === 'PUT') {
      if (!authorized(req)) return deny(res);
      const data = validate(JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8')));
      if (fs.existsSync(DATA)) fs.copyFileSync(DATA, DATA.replace(/\.json$/, '.backup.json'));
      const tmp = DATA + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, DATA);
      return json(res, 200, { ok: true, count: data.products.length });
    }

    if (p === '/api/upload' && req.method === 'POST') {
      if (!authorized(req)) return deny(res);
      const ext = path.extname(url.searchParams.get('name') || '').toLowerCase();
      if (!IMAGE_EXT.has(ext)) return json(res, 400, { error: 'only jpg, png or webp images' });
      const buf = await readBody(req, MAX_UPLOAD);
      if (buf.length < 100) return json(res, 400, { error: 'empty file' });
      const file = 'up-' + Date.now() + (ext === '.jpeg' ? '.jpg' : ext);
      fs.writeFileSync(path.join(IMAGES, file), buf);
      return json(res, 200, { file });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    // ---- pages ----
    if (p === '/' || p === '/index.html') return serveFile(res, path.join(ROOT, 'index.html'));
    if (p === '/admin' || p === '/admin/') {
      if (!authorized(req)) return deny(res);
      return serveFile(res, path.join(ROOT, 'admin.html'));
    }
    const name = p.replace(/^\//, '');
    if (PUBLIC_FILES.has(name)) return serveFile(res, path.join(ROOT, name));
    if (ADMIN_FILES.has(name)) {
      if (!authorized(req)) return deny(res);
      return serveFile(res, path.join(ROOT, name));
    }
    if (name.startsWith('images/')) {
      const f = path.join(IMAGES, path.basename(name));
      if (IMAGE_EXT.has(path.extname(f).toLowerCase())) return serveFile(res, f);
    }
    return send(res, 404, 'Not found');
  } catch (e) {
    return json(res, 400, { error: String(e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log('Shop:   http://localhost:' + PORT);
  console.log('Admin:  http://localhost:' + PORT + '/admin');
  if (!ADMIN_PASSWORD) console.log('WARNING: ADMIN_PASSWORD is not set, so anyone who can reach this server can edit products.');
  if (HOST !== '127.0.0.1') console.log('Listening on ' + HOST + ':' + PORT);
  console.log('Press Ctrl+C to stop.');
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? 'Port ' + PORT + ' is already in use. Close the other copy first, or run with PORT=8081.' : e);
  process.exit(1);
});
