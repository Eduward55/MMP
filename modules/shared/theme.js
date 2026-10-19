// Lê as variáveis de assets/css/theme.css para canvas e JS (um único lugar para trocar o tema).

export function cssVar(name, fallback = '') {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(139, 92, 246, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function themeTokens() {
  return {
    bg: cssVar('--bg', '#0f0f12'),
    surface: cssVar('--surface', '#18181c'),
    border: cssVar('--border', '#8b5cf6'),
    accent: cssVar('--accent', '#8b5cf6'),
    text: cssVar('--text', '#e4e4e7'),
    muted: cssVar('--text-muted', '#a1a1aa'),
    hairline: cssVar('--hairline', '#2a2a32'),
    accentHover: cssVar('--accent-hover', '#a78bfa'),
    font: cssVar('--font', 'system-ui, sans-serif'),
    ok: cssVar('--ok', '#4ade80'),
    warn: cssVar('--warn', '#eab308'),
    danger: cssVar('--danger', '#f87171')
  };
}
