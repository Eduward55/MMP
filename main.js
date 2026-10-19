'use strict';

const { app, BrowserWindow, ipcMain, protocol, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const crypto = require('crypto');
const { makeDemoWav } = require('./scripts/demo-audio');

const ROOT = __dirname;
const SCHEME = 'mmp';
const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const ITEM_TYPES = new Set(['audio', 'video', 'beat', 'project']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
};

// App desktop de música: o áudio pode começar sem precisar de um clique antes.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// No autoteste a webcam é uma câmera falsa do Chromium (padrão de teste), para exercitar o vídeo com webcam na VM.
if (process.env.MMP_SELFTEST) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
]);

function dataDir() {
  if (process.env.MMP_DATA_DIR) return path.resolve(process.env.MMP_DATA_DIR);
  if (process.argv.includes('--local-data')) return path.join(ROOT, 'data', 'user');
  return path.join(app.getPath('userData'), 'mmp-data');
}

const paths = {
  get root() { return dataDir(); },
  get store() { return path.join(dataDir(), 'store'); },
  get gallery() { return path.join(dataDir(), 'gallery'); },
  get galleryIndex() { return path.join(dataDir(), 'gallery.json'); }
};

async function ensureDirs() {
  await fs.mkdir(paths.store, { recursive: true });
  await fs.mkdir(paths.gallery, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

function assertKey(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key)) throw new Error(`Chave inválida: ${key}`);
}

/* ---------------- Store (JSON por chave) ---------------- */

async function storeRead(key) {
  assertKey(key);
  const saved = await readJson(path.join(paths.store, `${key}.json`), undefined);
  if (saved !== undefined) return saved;
  // /data guarda os padrões versionados do app (ex.: data/defaults/profile.json)
  return readJson(path.join(ROOT, 'data', 'defaults', `${key}.json`), null);
}

async function storeWrite(key, value) {
  assertKey(key);
  await writeJsonAtomic(path.join(paths.store, `${key}.json`), value);
  return true;
}

/* ---------------- Galeria ---------------- */

let galleryQueue = Promise.resolve();
function withGallery(fn) {
  const run = galleryQueue.then(async () => {
    const index = await readJson(paths.galleryIndex, { version: 1, items: [] });
    const result = await fn(index);
    if (result && result.dirty) await writeJsonAtomic(paths.galleryIndex, index);
    return result ? result.value : undefined;
  });
  galleryQueue = run.catch(() => {});
  return run;
}

function cleanName(name, fallback) {
  const n = String(name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
  return n || fallback;
}

function findItem(index, id) {
  const item = index.items.find((i) => i.id === id);
  if (!item) throw new Error('Item não encontrado na Galeria.');
  return item;
}

function itemFile(item) {
  return path.join(paths.gallery, path.basename(item.file));
}

async function galleryAdd(payload) {
  const type = payload && payload.type;
  if (!ITEM_TYPES.has(type)) throw new Error(`Tipo de item inválido: ${type}`);
  const id = crypto.randomUUID();
  const isJson = payload.json !== undefined;
  const ext = isJson ? 'json' : String(payload.ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const file = `${id}.${ext}`;
  const buffer = isJson
    ? Buffer.from(JSON.stringify(payload.json, null, 2), 'utf8')
    : Buffer.from(payload.data);
  await fs.writeFile(path.join(paths.gallery, file), buffer);
  let eventsFile;
  if (payload.events && typeof payload.events === 'object' && Array.isArray(payload.events.events)) {
    eventsFile = `${id}.events.json`;
    await fs.writeFile(path.join(paths.gallery, eventsFile), JSON.stringify(payload.events));
  }
  const now = new Date().toISOString();
  const item = {
    id,
    type,
    name: cleanName(payload.name, 'Sem título'),
    module: cleanName(payload.module, 'mmp'),
    mime: isJson ? 'application/json' : String(payload.mime || 'application/octet-stream'),
    ext,
    file,
    size: buffer.length,
    meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
    ...(eventsFile ? { eventsFile } : {}),
    createdAt: now,
    updatedAt: now
  };
  return withGallery((index) => {
    index.items.unshift(item);
    return { dirty: true, value: item };
  });
}

async function galleryUpdateJson(id, json, name) {
  return withGallery(async (index) => {
    const item = findItem(index, id);
    if (item.ext !== 'json') throw new Error('Só itens JSON podem ser atualizados.');
    const buffer = Buffer.from(JSON.stringify(json, null, 2), 'utf8');
    await fs.writeFile(itemFile(item), buffer);
    item.size = buffer.length;
    if (name) item.name = cleanName(name, item.name);
    item.updatedAt = new Date().toISOString();
    return { dirty: true, value: item };
  });
}

async function galleryRead(id) {
  const index = await readJson(paths.galleryIndex, { version: 1, items: [] });
  const item = findItem(index, id);
  const buffer = await fs.readFile(itemFile(item));
  if (item.ext === 'json') return { item, json: JSON.parse(buffer.toString('utf8')) };
  return { item, data: buffer };
}

// Eventos (nota, tempo, instrumento) de um item: o próprio JSON de um projeto ou o arquivo lateral de uma gravação.
async function galleryReadEvents(id) {
  const index = await readJson(paths.galleryIndex, { version: 1, items: [] });
  const item = findItem(index, id);
  if (item.eventsFile) return { item, json: JSON.parse(await fs.readFile(path.join(paths.gallery, path.basename(item.eventsFile)), 'utf8')) };
  if (item.type === 'project') return { item, json: JSON.parse(await fs.readFile(itemFile(item), 'utf8')) };
  throw new Error('Este item não tem eventos gravados.');
}

async function galleryExport(win, id) {
  const index = await readJson(paths.galleryIndex, { version: 1, items: [] });
  const item = findItem(index, id);
  const safe = item.name.replace(/[\\/:*?"<>|]/g, '_');
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Exportar da Galeria',
    defaultPath: path.join(app.getPath('downloads'), `${safe}.${item.ext}`),
    filters: [{ name: item.type, extensions: [item.ext] }]
  });
  if (canceled || !filePath) return { canceled: true };
  await fs.copyFile(itemFile(item), filePath);
  return { canceled: false, filePath };
}

async function seedFirstRun() {
  if (fsSync.existsSync(paths.galleryIndex)) return;
  const index = { version: 1, items: [] };
  await writeJsonAtomic(paths.galleryIndex, index);
  const demoBeat = await readJson(path.join(ROOT, 'data', 'demo', 'miau-groove.json'), null);
  if (demoBeat) {
    await galleryAdd({ type: 'beat', name: 'Miau Groove (exemplo)', module: 'beatcats', json: demoBeat, meta: { bpm: demoBeat.bpm, layers: (demoBeat.cats || []).filter(Boolean).length, mode: demoBeat.mode } });
  }
  const wav = makeDemoWav();
  await galleryAdd({ type: 'audio', name: 'Ronronar em Dó (exemplo)', module: 'studio', data: wav, mime: 'audio/wav', ext: 'wav', meta: { seconds: 4 } });
}

/* ---------------- Janela ---------------- */

let mainWindow;

function iconPath() {
  const ico = path.join(ROOT, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  return fsSync.existsSync(ico) ? ico : undefined;
}

function allowCamera(ses) {
  const camera = new Set(['media', 'camera', 'microphone', 'audioCapture', 'videoCapture']);
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(camera.has(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => camera.has(permission));
  if (typeof ses.setDevicePermissionHandler === 'function') {
    ses.setDevicePermissionHandler((details) => details.deviceType === 'video' || details.deviceType === 'audio');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: Number(process.env.MMP_WIDTH) || 1280,
    height: Number(process.env.MMP_HEIGHT) || 820,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#0f0f12',
    title: 'My Music Place',
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !process.env.MMP_SCREENSHOT_DIR && !process.env.MMP_SELFTEST
    }
  });

  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2 || process.env.MMP_SCREENSHOT_DIR) {
      console.log(`[renderer:${level}] ${message} (${source}:${line})`);
    }
  });

  mainWindow.loadURL(`${SCHEME}://app/index.html#/hub`);

  if (process.env.MMP_SCREENSHOT_DIR) runScreenshots(mainWindow).catch((err) => {
    console.error('Falha nas screenshots:', err);
    app.exit(1);
  });
  if (process.env.MMP_SELFTEST) runSelftest(mainWindow);
}

async function runSelftest(win) {
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  await wait(1200);
  try {
    const code = await fs.readFile(path.join(ROOT, 'scripts', 'selftest-renderer.js'), 'utf8');
    const results = JSON.parse(await win.webContents.executeJavaScript(code));
    let failed = 0;
    for (const r of results) {
      if (!r.pass) failed++;
      console.log(`${r.pass ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    console.log(`requisições de rede bloqueadas: ${blockedRequests.length}${blockedRequests.length ? ` (${blockedRequests.join(', ')})` : ''}`);
    if (blockedRequests.length) failed++;
    console.log(failed ? `\n${failed} falha(s)` : '\nTudo certo!');
    app.exit(failed ? 1 : 0);
  } catch (err) {
    console.error('Selftest quebrou:', err);
    app.exit(1);
  }
}

// O app é 100% offline: qualquer tentativa de acessar http(s) é bloqueada e registrada.
const blockedRequests = [];
function blockNetwork(ses) {
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, cb) => {
    blockedRequests.push(details.url);
    console.warn(`[offline] bloqueado: ${details.url}`);
    cb({ cancel: true });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function runScreenshots(win) {
  const dir = path.resolve(process.env.MMP_SCREENSHOT_DIR);
  await fs.mkdir(dir, { recursive: true });
  const pages = (process.env.MMP_SCREENSHOT_PAGES || 'hub:hub,mycat:meu-gato,gallery:galeria')
    .split(',')
    .map((p) => p.split(':'));
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  await wait(1500);
  for (const [route, name] of pages) {
    await win.webContents.executeJavaScript(`location.hash = '#/${route}'; void 0;`);
    await win.webContents.executeJavaScript(
      `new Promise((resolve) => { const t0 = Date.now(); (function check() {
        if (document.getElementById('app').dataset.ready === '${route.split('?')[0]}' || Date.now() - t0 > 8000) resolve();
        else setTimeout(check, 50); })(); })`
    );
    await wait(Number(process.env.MMP_SCREENSHOT_DELAY) || 1500);
    win.webContents.invalidate();
    await wait(200);
    const errors = await win.webContents.executeJavaScript('JSON.stringify(window.__mmpErrors || [])');
    const image = await win.webContents.capturePage();
    const file = path.join(dir, `${name || route}.png`);
    await fs.writeFile(file, image.toPNG());
    console.log(`screenshot ${file} errors=${errors}`);
  }
  app.quit();
}

/* ---------------- IPC ---------------- */

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, value: await fn(event, ...args) };
    } catch (err) {
      console.error(`[ipc:${channel}]`, err);
      return { ok: false, error: err.message || String(err) };
    }
  });
}

function registerIpc() {
  handle('app:info', () => ({
    version: app.getVersion(),
    dataDir: paths.root,
    platform: process.platform
  }));
  handle('store:read', (_e, key) => storeRead(key));
  handle('store:write', (_e, key, value) => storeWrite(key, value));
  handle('gallery:list', async () => (await readJson(paths.galleryIndex, { version: 1, items: [] })).items);
  handle('gallery:add', (_e, payload) => galleryAdd(payload));
  handle('gallery:updateJson', (_e, id, json, name) => galleryUpdateJson(id, json, name));
  handle('gallery:read', (_e, id) => galleryRead(id));
  handle('gallery:readEvents', (_e, id) => galleryReadEvents(id));
  handle('gallery:rename', (_e, id, name) =>
    withGallery((index) => {
      const item = findItem(index, id);
      item.name = cleanName(name, item.name);
      item.updatedAt = new Date().toISOString();
      return { dirty: true, value: item };
    })
  );
  handle('gallery:delete', (_e, id) =>
    withGallery(async (index) => {
      const item = findItem(index, id);
      await fs.rm(itemFile(item), { force: true });
      if (item.eventsFile) await fs.rm(path.join(paths.gallery, path.basename(item.eventsFile)), { force: true });
      index.items = index.items.filter((i) => i.id !== id);
      return { dirty: true, value: true };
    })
  );
  handle('gallery:export', (event, id) => galleryExport(BrowserWindow.fromWebContents(event.sender), id));
}

function registerProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT + path.sep) || rel.startsWith('node_modules')) {
      return new Response('Proibido', { status: 403 });
    }
    try {
      const body = await fs.readFile(file);
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      return new Response(body, { status: 200, headers: { 'content-type': type } });
    } catch {
      return new Response('Não encontrado', { status: 404 });
    }
  });
}

app.whenReady().then(async () => {
  if (app.setName) app.setName('My Music Place');
  await ensureDirs();
  await seedFirstRun();
  registerProtocol();
  registerIpc();
  allowCamera(session.defaultSession);
  blockNetwork(session.defaultSession);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
