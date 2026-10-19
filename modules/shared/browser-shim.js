// Prévia no navegador (sem Electron): o mesmo UI, dados no localStorage.
// No app empacotado o preload já expõe window.mmp e isto não faz nada.

const STORE_PREFIX = 'mmp-preview-store:';
const GALLERY_KEY = 'mmp-preview-gallery';
const FILES = new Map();

function loadGallery() {
  try {
    const raw = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveGallery(items) {
  localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
}

function toBuffer(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return Uint8Array.from(data);
  return new TextEncoder().encode(String(data || ''));
}

function installPreviewMmp() {
  window.mmp = {
    info: async () => ({
      version: '0.1.0-preview',
      dataDir: 'navegador (prévia local)',
      preview: true
    }),
    store: {
      read: async (key) => {
        const raw = localStorage.getItem(STORE_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
      },
      write: async (key, value) => {
        localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
        return true;
      }
    },
    gallery: {
      list: async () => loadGallery(),
      add: async (payload) => {
        const id = crypto.randomUUID();
        const isJson = payload.json !== undefined;
        const ext = isJson ? 'json' : String(payload.ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
        const now = new Date().toISOString();
        const body = isJson ? JSON.stringify(payload.json) : toBuffer(payload.data);
        FILES.set(id, { json: isJson ? payload.json : undefined, data: isJson ? undefined : body, events: payload.events });
        const item = {
          id,
          type: payload.type,
          name: String(payload.name || 'Sem título').slice(0, 80),
          module: String(payload.module || 'mmp').slice(0, 80),
          mime: isJson ? 'application/json' : String(payload.mime || 'application/octet-stream'),
          ext,
          file: `${id}.${ext}`,
          size: isJson ? body.length : body.byteLength,
          meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
          createdAt: now,
          updatedAt: now
        };
        const items = loadGallery();
        items.unshift(item);
        saveGallery(items);
        return item;
      },
      updateJson: async (id, json, name) => {
        const items = loadGallery();
        const item = items.find((i) => i.id === id);
        if (!item) throw new Error('Item não encontrado na Galeria.');
        const prev = FILES.get(id) || {};
        FILES.set(id, { ...prev, json });
        item.size = JSON.stringify(json).length;
        if (name) item.name = String(name).slice(0, 80);
        item.updatedAt = new Date().toISOString();
        saveGallery(items);
        return item;
      },
      read: async (id) => {
        const item = loadGallery().find((i) => i.id === id);
        if (!item) throw new Error('Item não encontrado na Galeria.');
        const file = FILES.get(id) || {};
        if (item.ext === 'json') return { item, json: file.json };
        return { item, data: file.data };
      },
      readEvents: async (id) => {
        const item = loadGallery().find((i) => i.id === id);
        if (!item) throw new Error('Item não encontrado na Galeria.');
        const file = FILES.get(id) || {};
        if (file.events) return { item, json: file.events };
        if (item.type === 'project' && file.json) return { item, json: file.json };
        throw new Error('Este item não tem eventos gravados.');
      },
      rename: async (id, name) => {
        const items = loadGallery();
        const item = items.find((i) => i.id === id);
        if (!item) throw new Error('Item não encontrado na Galeria.');
        item.name = String(name || item.name).slice(0, 80);
        item.updatedAt = new Date().toISOString();
        saveGallery(items);
        return item;
      },
      remove: async (id) => {
        saveGallery(loadGallery().filter((i) => i.id !== id));
        FILES.delete(id);
        return true;
      },
      export: async () => ({ canceled: true })
    }
  };
  return window.mmp;
}

export function ensureMmp() {
  if (window.mmp) return window.mmp;
  return installPreviewMmp();
}
