// Ponte única com o processo principal (IPC). Todos os módulos usam isto para salvar/ler.
import { ensureMmp } from './browser-shim.js';

const api = ensureMmp();

const DEFAULT_PROFILE = {
  version: 1,
  cat: { name: 'Miau', coat: 'tabby', eyes: '#4ade80', outfit: {} },
  otter: { name: 'Lulu', outfit: {} }
};

let profile = null;
const listeners = new Set();
const galleryListeners = new Set();

function normalizeProfile(p) {
  const base = structuredClone(DEFAULT_PROFILE);
  if (!p || typeof p !== 'object') return base;
  return {
    version: 1,
    cat: { ...base.cat, ...(p.cat || {}), outfit: { ...((p.cat && p.cat.outfit) || {}) } },
    otter: { ...base.otter, ...(p.otter || {}), outfit: { ...((p.otter && p.otter.outfit) || {}) } }
  };
}

export async function loadProfile() {
  try {
    profile = normalizeProfile(await api.store.read('profile'));
  } catch (err) {
    console.error(err);
    profile = normalizeProfile(null);
  }
  return profile;
}

export function getProfile() {
  return profile || normalizeProfile(null);
}

export async function saveProfile(next) {
  profile = normalizeProfile(next);
  await api.store.write('profile', profile);
  listeners.forEach((fn) => fn(profile));
  return profile;
}

export function onProfile(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const kv = {
  get: (key) => api.store.read(key),
  set: (key, value) => api.store.write(key, value)
};

function emitGallery() {
  galleryListeners.forEach((fn) => fn());
}

export const gallery = {
  list: () => api.gallery.list(),
  read: (id) => api.gallery.read(id),
  readEvents: (id) => api.gallery.readEvents(id),
  async addJson(type, name, module, json, meta) {
    const item = await api.gallery.add({ type, name, module, json, meta });
    emitGallery();
    return item;
  },
  // events: JSON "mmp-events" opcional, salvo ao lado do arquivo para reabrir no Studio.
  async addBlob(type, name, module, blob, meta, events) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const mime = blob.type || 'application/octet-stream';
    const ext = mimeToExt(mime);
    const item = await api.gallery.add({ type, name, module, data, mime, ext, meta, events: events || undefined });
    emitGallery();
    return item;
  },
  async updateJson(id, json, name) {
    const item = await api.gallery.updateJson(id, json, name);
    emitGallery();
    return item;
  },
  async rename(id, name) {
    const item = await api.gallery.rename(id, name);
    emitGallery();
    return item;
  },
  async remove(id) {
    await api.gallery.remove(id);
    emitGallery();
  },
  export: (id) => api.gallery.export(id),
  onChange(fn) {
    galleryListeners.add(fn);
    return () => galleryListeners.delete(fn);
  }
};

export function mimeToExt(mime) {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg')) return 'mp3';
  return 'bin';
}

export const appInfo = () => api.info();
