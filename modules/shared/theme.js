// Variáveis de assets/css/theme.css + escolha de paleta compacta no ícone da barra.
import { kv } from './store.js';
import { el } from './ui.js';
import { icon } from './icons.js';
import { t } from './i18n.js';

export const COLOR_THEMES = [
  { id: 'night', name: 'Noite', swatch: '#0f0f12', accent: '#7c9cff' },
  { id: 'ocean', name: 'Oceano', swatch: '#0b1220', accent: '#38bdf8' },
  { id: 'day', name: 'Dia', swatch: '#f4f7fb', accent: '#2563eb' },
  { id: 'forest', name: 'Floresta', swatch: '#0f1712', accent: '#34d399' },
  { id: 'cream', name: 'Creme', swatch: '#f7f1e4', accent: '#b45309' },
  { id: 'rose', name: 'Rosa', swatch: '#fdf2f8', accent: '#db2777' },
  { id: 'mint', name: 'Menta', swatch: '#eef7f3', accent: '#0f766e' },
  { id: 'grape', name: 'Uva', swatch: '#1a1424', accent: '#a78bfa' },
  { id: 'gold', name: 'Dourado', swatch: '#1c1610', accent: '#eab308' },
  { id: 'dusk', name: 'Pôr do sol', swatch: '#1a1418', accent: '#f59e6c' },
  { id: 'beach', name: 'Praia', swatch: '#0f1c22', accent: '#2dd4bf' }
];

const THEME_ALIAS = { candy: 'rose', sunset: 'dusk' };

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
  const wanted = THEME_ALIAS[id] || id;
  const t = COLOR_THEMES.find((x) => x.id === wanted) || COLOR_THEMES[0];
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
  const wrap = el('div', { class: 'theme-picker' });
  const btn = el('button', { class: 'theme-fab', type: 'button', 'aria-expanded': 'false', 'aria-haspopup': 'true' });
  const menu = el('div', { class: 'theme-picker__menu', role: 'radiogroup', 'aria-label': t('theme.menu') });
  wrap.append(btn, menu);

  const paint = () => {
    const cur = COLOR_THEMES.find((x) => x.id === current) || COLOR_THEMES[0];
    const label = t(`theme.${cur.id}`, cur.name);
    btn.title = t('theme.open', { name: label });
    btn.setAttribute('aria-label', t('theme.open', { name: label }));
    btn.innerHTML = '';
    btn.append(el('span', { class: 'theme-fab__glyph', 'aria-hidden': 'true', html: icon('palette', 16) }), el('span', { class: 'theme-fab__dot', style: `--sw:${cur.swatch};--ac:${cur.accent}` }));
    menu.innerHTML = '';
    COLOR_THEMES.forEach((opt) => {
      const name = t(`theme.${opt.id}`, opt.name);
      menu.append(
        el(
          'button',
          {
            class: `theme-swatch ${current === opt.id ? 'is-on' : ''}`,
            type: 'button',
            role: 'radio',
            'aria-checked': String(current === opt.id),
            title: name,
            'aria-label': name,
            style: `--sw:${opt.swatch};--ac:${opt.accent}`,
            onclick: () => {
              applyTheme(opt.id);
              wrap.classList.remove('is-open');
              btn.setAttribute('aria-expanded', 'false');
            }
          },
          el('span', { class: 'theme-swatch__dot' }),
          el('span', { class: 'theme-swatch__name' }, name)
        )
      );
    });
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = wrap.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  paint();
  onTheme(() => {
    if (wrap.isConnected) paint();
  });
  return wrap;
}
