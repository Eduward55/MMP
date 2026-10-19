// Variáveis de assets/css/theme.css + escolha de paleta (noite, oceano, dia, uva, creme).
import { kv } from './store.js';
import { el } from './ui.js';

export const COLOR_THEMES = [
  { id: 'night', name: 'Noite', swatch: '#0f0f12', accent: '#7c9cff' },
  { id: 'ocean', name: 'Oceano', swatch: '#0b1220', accent: '#38bdf8' },
  { id: 'day', name: 'Dia', swatch: '#f4f7fb', accent: '#2563eb' },
  { id: 'grape', name: 'Uva', swatch: '#16111f', accent: '#8b5cf6' },
  { id: 'cream', name: 'Creme', swatch: '#faf6ef', accent: '#c2410c' }
];

const KEY = 'ui-theme';
let current = 'night';
const listeners = new Set();

export function cssVar(name, fallback = '') {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(124, 156, 255, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function themeTokens() {
  return {
    bg: cssVar('--bg', '#0f0f12'),
    surface: cssVar('--surface', '#18181c'),
    border: cssVar('--border', '#2a2a32'),
    accent: cssVar('--accent', '#7c9cff'),
    text: cssVar('--text', '#e4e4e7'),
    muted: cssVar('--text-muted', '#a1a1aa'),
    hairline: cssVar('--hairline', '#2a2a32'),
    accentHover: cssVar('--accent-hover', '#93c5fd'),
    font: cssVar('--font', 'system-ui, sans-serif'),
    ok: cssVar('--ok', '#4ade80'),
    warn: cssVar('--warn', '#eab308'),
    danger: cssVar('--danger', '#f87171')
  };
}

export function currentTheme() {
  return current;
}

export function applyTheme(id) {
  const t = COLOR_THEMES.find((x) => x.id === id) || COLOR_THEMES[0];
  current = t.id;
  document.documentElement.dataset.theme = t.id;
  try {
    localStorage.setItem(KEY, t.id);
  } catch {}
  kv.set(KEY, t.id).catch(() => {});
  listeners.forEach((fn) => fn(t.id));
  return t.id;
}

export function onTheme(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadTheme() {
  let id = null;
  try {
    id = await kv.get(KEY);
  } catch {}
  if (!id) {
    try {
      id = localStorage.getItem(KEY);
    } catch {}
  }
  applyTheme(typeof id === 'string' ? id : 'night');
}

export function createThemePicker() {
  const row = el('div', { class: 'theme-picker', role: 'radiogroup', 'aria-label': 'Tema de cores' });
  const paint = () => {
    row.innerHTML = '';
    COLOR_THEMES.forEach((t) => {
      row.append(
        el(
          'button',
          {
            class: `theme-swatch ${current === t.id ? 'is-on' : ''}`,
            type: 'button',
            role: 'radio',
            'aria-checked': String(current === t.id),
            title: t.name,
            'aria-label': t.name,
            style: `--sw:${t.swatch};--ac:${t.accent}`,
            onclick: () => {
              applyTheme(t.id);
              paint();
            }
          },
          el('span', { class: 'theme-swatch__dot' }),
          el('span', { class: 'theme-swatch__name' }, t.name)
        )
      );
    });
  };
  paint();
  onTheme(() => {
    if (row.isConnected) paint();
  });
  return row;
}
