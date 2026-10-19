// Utilidades de interface compartilhadas: criação de elementos, toasts e modais.

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function html(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '');
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function toast(message, kind = 'info', ms = 2600) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const t = el('div', { class: `toast toast--${kind}` }, message);
  root.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => {
    t.classList.remove('is-in');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

export function modal({ title, body, actions = [], onClose, wide = false }) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const box = el('div', { class: `modal ${wide ? 'modal--wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = (value) => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose && onClose(value);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close(null);
  };
  const header = el('div', { class: 'modal__head' }, el('h2', {}, title), el('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: () => close(null) }, '✕'));
  const content = el('div', { class: 'modal__body' });
  if (typeof body === 'string') content.innerHTML = body;
  else if (body) content.append(body);
  const foot = el('div', { class: 'modal__foot' });
  actions.forEach((a) => foot.append(el('button', { class: `btn ${a.kind ? `btn--${a.kind}` : ''}`, onclick: () => (a.onClick ? a.onClick(close) : close(a.value)) }, a.label)));
  box.append(header, content);
  if (actions.length) box.append(foot);
  backdrop.append(box);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close(null);
  });
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  const focusable = box.querySelector('input, button.btn');
  if (focusable) setTimeout(() => focusable.focus(), 30);
  return { close, box, content };
}

export function prompt({ title, label, value = '', confirm = 'Salvar' }) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'input', type: 'text', value, maxlength: '80', 'aria-label': label });
    const wrap = el('label', { class: 'field' }, el('span', { class: 'field__label' }, label), input);
    const m = modal({
      title,
      body: wrap,
      onClose: resolve,
      actions: [
        { label: 'Cancelar', value: null },
        { label: confirm, kind: 'primary', onClick: (close) => close(input.value.trim() || null) }
      ]
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') m.close(input.value.trim() || null);
    });
    setTimeout(() => input.select(), 40);
  });
}

export function confirmDialog({ title, message, confirm = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    modal({
      title,
      body: el('p', {}, message),
      onClose: (v) => resolve(Boolean(v)),
      actions: [
        { label: 'Cancelar', value: false },
        { label: confirm, kind: danger ? 'danger' : 'primary', value: true }
      ]
    });
  });
}

export function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

let toneLoader = null;

/** Carrega Tone.js depois do Hub. Não bloqueia o splash: o script antigo no <head> criava AudioContext e travava o Chrome. */
export function loadTone() {
  if (window.Tone) return Promise.resolve(window.Tone);
  if (toneLoader) return toneLoader;
  toneLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('../../vendor/tone/Tone.js', import.meta.url).href;
    s.async = true;
    const fail = (msg) => {
      toneLoader = null;
      reject(new Error(msg));
    };
    const timer = setTimeout(() => fail('Tone.js demorou demais (AudioContext?). O Hub segue sem som.'), 8000);
    s.onload = () => {
      clearTimeout(timer);
      if (window.Tone) resolve(window.Tone);
      else fail('Tone.js não carregou (vendor/tone/Tone.js).');
    };
    s.onerror = () => {
      clearTimeout(timer);
      fail('Tone.js não carregou (vendor/tone/Tone.js).');
    };
    document.head.append(s);
  });
  return toneLoader;
}

export async function startAudio() {
  const Tone = await loadTone();
  try {
    if (Tone.context && Tone.context.state !== 'running') {
      await Promise.race([
        Tone.start(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('AudioContext não iniciou.')), 4000))
      ]);
    }
  } catch (err) {
    console.warn(err);
  }
  return Tone;
}

export function stamp() {
  return new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
