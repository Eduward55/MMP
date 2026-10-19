// Gato e lontra: silhueta pixel 48×48 do Stitch; pelagem/olhos via paletas do app.
import { Grid, gridToPaths } from './pixel.js';
import { OUTFIT_BY_ID, SLOTS, OUTLINE } from './outfits.js';
import {
  SIZE,
  CAT_ANCHORS,
  OTTER_ANCHORS,
  catInnerSVG,
  otterInnerSVG,
  isStitchAccessory,
  stitchAccessoryInner
} from './stitch-layers.js';

export { SIZE, CAT_ANCHORS, OTTER_ANCHORS };

const WARM_LINE = '#6b5344';
const WARM_DARK = '#3f2c22';

export const COATS = [
  { id: 'tabby', name: 'Tigresa', fur: '#b48a60', stripe: '#5c3e24', light: '#e6d3b6', paw: '#e6d3b6', ear: '#f472b6', outline: WARM_DARK, stripes: true },
  { id: 'black', name: 'Preto', fur: '#27272a', stripe: '#18181b', light: '#3f3f46', paw: '#3f3f46', ear: '#ff7fc2', outline: '#05020a', stripes: false },
  { id: 'tuxedo', name: 'Frajola', fur: '#18181b', stripe: '#18181b', light: '#ffffff', paw: '#ffffff', ear: '#ff7fc2', outline: '#05020a', stripes: false },
  { id: 'white', name: 'Branco', fur: '#f8fafc', stripe: '#cbd5e1', light: '#ffffff', paw: '#ffffff', ear: '#ffa6d6', outline: WARM_LINE, stripes: false },
  { id: 'orange', name: 'Laranja', fur: '#ea580c', stripe: '#9a3412', light: '#ffd8a8', paw: '#ffd8a8', ear: '#ff9ccf', outline: WARM_DARK, stripes: true },
  { id: 'gray', name: 'Cinza', fur: '#94a3b8', stripe: '#475569', light: '#e2e8f0', paw: '#e2e8f0', ear: '#ff9ccf', outline: WARM_DARK, stripes: true },
  { id: 'cream', name: 'Creme', fur: '#fef3c7', stripe: '#d97706', light: '#fffbeb', paw: '#fff6e4', ear: '#ff9ccf', outline: WARM_LINE, stripes: true },
  { id: 'chocolate', name: 'Chocolate', fur: '#593a2e', stripe: '#2e1b13', light: '#d4a574', paw: '#d4a574', ear: '#ff7fc2', outline: '#1a0c08', stripes: true },
  { id: 'calico', name: 'Calicó', fur: '#fff8ee', stripe: '#c45c28', light: '#ffffff', paw: '#fff8ee', ear: '#ff9ccf', outline: WARM_DARK, stripes: false, patches: true },
  { id: 'siamese', name: 'Siamês', fur: '#f5ebe0', stripe: '#4a2f21', light: '#fff8ee', paw: '#5c3a28', ear: '#ff9ccf', outline: WARM_LINE, stripes: false, points: true },
  { id: 'peach', name: 'Pêssego', fur: '#fed7aa', stripe: '#ea580c', light: '#ffe2c8', paw: '#ffe2c8', ear: '#ff9ccf', outline: '#7a3f28', stripes: true },
  { id: 'ink', name: 'Tinta', fur: '#0f172a', stripe: '#38bdf8', light: '#334155', paw: '#cbd5e1', ear: '#ff7fc2', outline: '#05080c', stripes: false }
];

export const COAT_BY_ID = Object.fromEntries(COATS.map((c) => [c.id, c]));

export const OTTER_COATS = [
  { id: 'chocolate', name: 'Chocolate', fur: '#a06047', light: '#fef3c7', dark: '#8d533e', outline: WARM_DARK },
  { id: 'honey', name: 'Mel', fur: '#c9893a', light: '#ffe4b0', dark: '#8a5520', outline: WARM_DARK },
  { id: 'cinnamon', name: 'Canela', fur: '#8c4a2f', light: '#e8c4a0', dark: '#6e351f', outline: WARM_DARK },
  { id: 'charcoal', name: 'Carvão', fur: '#3d3430', light: '#cfc4b8', dark: '#1f1a18', outline: '#05020a' },
  { id: 'cream', name: 'Creme', fur: '#d49b6a', light: '#fff8ea', dark: '#ba8050', outline: WARM_LINE },
  { id: 'silver', name: 'Prata', fur: '#9aa3ad', light: '#e8eef4', dark: '#5c6670', outline: WARM_DARK },
  { id: 'sand', name: 'Areia', fur: '#d2b48a', light: '#fff1d4', dark: '#8b6948', outline: WARM_LINE },
  { id: 'mocha', name: 'Moca', fur: '#5c3d2e', light: '#e6c8a8', dark: '#2f1c14', outline: '#140a08' }
];
export const OTTER_COAT_BY_ID = Object.fromEntries(OTTER_COATS.map((c) => [c.id, c]));

export const EYE_COLORS = [
  { id: '#4ade80', name: 'Verde menta' },
  { id: '#38bdf8', name: 'Céu' },
  { id: '#eab308', name: 'Âmbar' },
  { id: '#d97706', name: 'Mel' },
  { id: '#d4a574', name: 'Cobre' },
  { id: '#0f766e', name: 'Petróleo' }
];

function shadeHex(hex, amt) {
  const raw = String(hex || '#0284c7').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '#0369a1';
  const ch = (shift) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amt));
  return `#${[ch(16), ch(8), ch(0)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(a, b, t = 0.35) {
  const parse = (hex) => {
    const raw = String(hex || '#888888').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    const n = parseInt(full, 16);
    return [((n >> 16) & 255) || 0, ((n >> 8) & 255) || 0, (n & 255) || 0];
  };
  const A = parse(a);
  const B = parse(b);
  const ch = (i) => Math.round(A[i] * (1 - t) + B[i] * t);
  return `#${[ch(0), ch(1), ch(2)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function catPalette(look = {}) {
  const coat = COAT_BY_ID[look.coat] || COATS[0];
  const eye = look.eyes || '#4ade80';
  const tuxedo = coat.id === 'tuxedo';
  const primary = tuxedo ? coat.light : coat.fur;
  const accent = tuxedo ? coat.fur : coat.stripe !== coat.fur ? coat.stripe : shadeHex(coat.fur, -24);
  const stripe = coat.stripes || tuxedo || coat.id === 'ink' ? coat.stripe : mixHex(primary, accent, 0.35);
  return {
    coat,
    primary,
    accent,
    stripe,
    shadow: tuxedo ? '#e2e8f0' : mixHex(primary, '#090d16', 0.35),
    belly: coat.light,
    pad: '#fda4af',
    earInner: coat.ear,
    blush: '#fda4af',
    nose: '#f43f5e',
    sparkle: '#475569',
    eye,
    eyeDark: shadeHex(eye, -40),
    patches: Boolean(coat.patches),
    points: Boolean(coat.points)
  };
}

function otterPalette(look = {}) {
  const coat = OTTER_COAT_BY_ID[look.coat] || OTTER_COATS[0];
  const eye = look.eyes || '#38bdf8';
  return {
    coat,
    body: coat.fur,
    shade: coat.dark,
    belly: coat.light,
    bellyShade: mixHex(coat.light, coat.dark, 0.25),
    paws: '#fbcfe8',
    blush: '#fda4af',
    nose: '#382017',
    sparkle: '#475569',
    eye,
    eyeDark: shadeHex(eye, -36)
  };
}

function bonusLayers(kind, outfit, rear) {
  const A = kind === 'otter' ? OTTER_ANCHORS : CAT_ANCHORS;
  const bySlot = { back: '', body: '', neck: '', face: '', ear: '', head: '', hand: '' };
  for (const slot of SLOTS) {
    const id = outfit && outfit[slot.id];
    const def = OUTFIT_BY_ID[id];
    if (!def || isStitchAccessory(id)) continue;
    if (rear && slot.id === 'face') continue;
    const back = new Grid(SIZE, SIZE);
    const front = new Grid(SIZE, SIZE);
    if (def.back) def.back(back, A);
    if (def.front) def.front(front, A);
    const origin = slot.id === 'hand' ? ` style="transform-origin:${A.handX}px ${A.handY}px"` : '';
    const outline = def.outline !== false;
    const stroke = outline ? gridToPaths(back.outline(OUTLINE)) + gridToPaths(front.outline(OUTLINE)) : '';
    bySlot[slot.id] += `<g class="acc acc-${slot.id} acc--${id}"${origin}>${stroke}${gridToPaths(back)}${gridToPaths(front)}</g>`;
  }
  return bySlot;
}

/**
 * Renderiza uma criatura como string SVG.
 * kind: 'cat' | 'otter'; look: { coat, eyes, outfit }
 */
export function creatureSVG(kind, look = {}, { size = 160, label = '', extraClass = '', viewBox = `0 0 ${SIZE} ${SIZE}`, pose = 'front' } = {}) {
  const rear = pose === 'rear';
  const outfit = look.outfit || {};
  const bonus = bonusLayers(kind, outfit, rear);
  const inner =
    kind === 'otter'
      ? otterInnerSVG(otterPalette(look), { rear, outfit, bonus })
      : catInnerSVG(catPalette(look), { rear, outfit, bonus });
  const classes = ['creature', `creature--${kind}`, rear ? 'creature--rear' : '', extraClass].filter(Boolean).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${classes}" viewBox="${viewBox}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeAttr(label)}">${inner}</svg>`;
}

export function catSVG(coat, eye, equippedAccs, opts = {}) {
  const outfit = Array.isArray(equippedAccs)
    ? Object.fromEntries(equippedAccs.map((id) => [OUTFIT_BY_ID[id]?.slot, id]).filter((x) => x[0]))
    : equippedAccs || {};
  return creatureSVG('cat', { coat, eyes: eye, outfit }, opts);
}

export function otterSVG(coat, eye, equippedAccs, opts = {}) {
  const outfit = Array.isArray(equippedAccs)
    ? Object.fromEntries(equippedAccs.map((id) => [OUTFIT_BY_ID[id]?.slot, id]).filter((x) => x[0]))
    : equippedAccs || {};
  return creatureSVG('otter', { coat, eyes: eye, outfit }, opts);
}

// Só o acessório (sem criatura), recortado no próprio tamanho — usado como ficha arrastável.
export function accessorySVG(id, { size = 48, kind = 'cat', label = '' } = {}) {
  const def = OUTFIT_BY_ID[id];
  if (!def) return '';
  const stitch = stitchAccessoryInner(kind, id);
  if (stitch) {
    const crop = {
      head: '8 0 32 28',
      ear: '8 2 32 24',
      face: '12 10 24 20',
      neck: '12 18 24 20',
      body: '10 22 28 22',
      back: '8 22 32 24',
      hand: '24 20 22 20'
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" class="pixel-icon accessory" viewBox="${crop[def.slot] || '8 8 32 32'}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeAttr(label || def.name)}">${stitch}</svg>`;
  }
  const A = kind === 'otter' ? OTTER_ANCHORS : CAT_ANCHORS;
  const back = new Grid(SIZE, SIZE);
  const front = new Grid(SIZE, SIZE);
  if (def.back) def.back(back, A);
  if (def.front) def.front(front, A);
  const all = new Grid(SIZE, SIZE).stamp(back).stamp(front);
  let x0 = SIZE;
  let y0 = SIZE;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!all.get(x, y)) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < x0) {
    x0 = 0;
    y0 = 0;
    x1 = SIZE - 1;
    y1 = SIZE - 1;
  }
  const side = Math.max(x1 - x0, y1 - y0) + 4;
  const vx = (x0 + x1) / 2 - side / 2 + 0.5;
  const vy = (y0 + y1) / 2 - side / 2 + 0.5;
  const outline = def.outline !== false;
  const layer = (g) => (outline ? gridToPaths(g.outline(OUTLINE)) : '') + gridToPaths(g);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="pixel-icon accessory" viewBox="${vx} ${vy} ${side} ${side}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeAttr(label || def.name)}">${layer(back)}${layer(front)}</svg>`;
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}
