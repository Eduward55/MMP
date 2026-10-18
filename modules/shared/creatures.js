// Gato e lontra desenhados proceduralmente em pixel art (originais, sem imagens externas).
import { Grid, gridToPaths } from './pixel.js';
import { OUTFIT_BY_ID, SLOTS, OUTLINE } from './outfits.js';

export const SIZE = 40;

export const COATS = [
  { id: 'tabby', name: 'Tigresa', fur: '#a88a6a', stripe: '#5e4634', light: '#e6d3b6', paw: '#e6d3b6', ear: '#ff9ccf', outline: OUTLINE, stripes: true },
  { id: 'black', name: 'Preto', fur: '#2c2438', stripe: '#2c2438', light: '#3b3149', paw: '#3b3149', ear: '#ff7fc2', outline: '#05020a', stripes: false, glow: true },
  { id: 'tuxedo', name: 'Frajola', fur: '#231d2e', stripe: '#231d2e', light: '#f6f2ff', paw: '#f6f2ff', ear: '#ff7fc2', outline: '#05020a', stripes: false, glow: true },
  { id: 'white', name: 'Branco', fur: '#f5f0ff', stripe: '#e3dcf3', light: '#ffffff', paw: '#ffffff', ear: '#ffa6d6', outline: '#5e4a8a', stripes: false },
  { id: 'orange', name: 'Laranja', fur: '#f28a3b', stripe: '#c25c1c', light: '#ffd8a8', paw: '#ffd8a8', ear: '#ff9ccf', outline: OUTLINE, stripes: true },
  { id: 'gray', name: 'Cinza', fur: '#8f8ba3', stripe: '#6b667f', light: '#c9c5da', paw: '#c9c5da', ear: '#ff9ccf', outline: OUTLINE, stripes: true }
];

export const COAT_BY_ID = Object.fromEntries(COATS.map((c) => [c.id, c]));

export const EYE_COLORS = [
  { id: '#5dff9b', name: 'Verde menta' },
  { id: '#5ff3ff', name: 'Azul neon' },
  { id: '#ffc23f', name: 'Âmbar' },
  { id: '#ff4fd8', name: 'Rosa neon' },
  { id: '#b07cff', name: 'Violeta' },
  { id: '#ff7a3d', name: 'Cobre' }
];

const OTTER = { fur: '#9a6a45', light: '#f1dcb8', dark: '#6e4529', outline: OUTLINE };
const BLUSH = 'rgba(255, 110, 190, 0.55)';
const MOUTH = '#3a1d2e';

const CAT_ANCHORS = {
  cx: 20, headTop: 10, earTopY: 7, headL: 10, headR: 30, headCy: 18,
  eyeY: 17.5, eyeLX: 15, eyeRX: 25, neckY: 24, bodyY: 30, bodyRx: 9, bodyRy: 7,
  earLX: 13, earRX: 27, handX: 28, handY: 31, tailPivot: [29, 36]
};

const OTTER_ANCHORS = {
  cx: 20, headTop: 10, earTopY: 9, headL: 12, headR: 28, headCy: 17,
  eyeY: 16.5, eyeLX: 15.5, eyeRX: 24.5, neckY: 23, bodyY: 29, bodyRx: 7, bodyRy: 9,
  earLX: 13, earRX: 27, handX: 23, handY: 25, tailPivot: [14, 37]
};

function drawCat(look) {
  const coat = COAT_BY_ID[look.coat] || COATS[0];
  const eye = look.eyes || '#5dff9b';
  const body = new Grid(SIZE, SIZE);
  const tail = new Grid(SIZE, SIZE);
  const eyes = new Grid(SIZE, SIZE);

  const tailPts = [[27, 36], [29, 35], [30, 34], [31, 33], [32, 31], [32, 29], [32, 27], [31, 25], [30, 24]];
  tail.points(tailPts, coat.fur, 2);
  if (coat.stripes) tail.points([[31, 33], [32, 29], [31, 25]], coat.stripe, 2);
  if (coat.id === 'tuxedo') tail.points([[30, 24]], coat.light, 2);

  body.ellipse(20, 30, 9, 7, coat.fur);
  body.ellipse(20, 18, 10, 8, coat.fur);
  body.tri([11, 15], [13, 7], [18, 11], coat.fur);
  body.tri([29, 15], [27, 7], [22, 11], coat.fur);
  body.tri([13, 13], [14, 9], [16, 12], coat.ear);
  body.tri([27, 13], [26, 9], [24, 12], coat.ear);
  body.ellipse(20, 31, 5, 5, coat.light);
  body.ellipse(20, 21, 4, 2.5, coat.light);
  body.ellipse(16, 36, 2.5, 1.5, coat.paw);
  body.ellipse(24, 36, 2.5, 1.5, coat.paw);
  body.set(16, 36, coat.outline);
  body.set(24, 36, coat.outline);
  if (coat.stripes) {
    body.points([[17, 12], [17, 13], [20, 11], [20, 12], [20, 13], [23, 12], [23, 13]], coat.stripe);
    body.points([[11, 18], [12, 18], [11, 20], [12, 20], [28, 18], [29, 18], [28, 20], [29, 20]], coat.stripe);
    body.points([[12, 28], [13, 28], [27, 28], [28, 28], [12, 31], [13, 31], [27, 31], [28, 31]], coat.stripe);
  }
  if (coat.id === 'tuxedo') body.tri([18, 15], [20, 12], [22, 15], coat.light);
  body.set(20, 21, coat.ear);
  body.set(19, 21, coat.ear);
  body.set(21, 21, coat.ear);
  body.set(20, 22, MOUTH);
  body.points([[19, 23], [21, 23]], MOUTH);
  body.points([[13, 21], [14, 21], [26, 21], [27, 21]], BLUSH);

  for (const ex of [14, 24]) {
    eyes.rect(ex, 16, 3, 4, eye);
    eyes.rect(ex + 1, 17, 1, 3, '#140a1e');
    eyes.set(ex, 16, '#ffffff');
    eyes.set(ex + 2, 19, 'rgba(255,255,255,0.55)');
  }

  return { coat, body, tail, eyes, anchors: CAT_ANCHORS, outline: coat.outline, glow: coat.glow };
}

function drawOtter() {
  const c = OTTER;
  const body = new Grid(SIZE, SIZE);
  const tail = new Grid(SIZE, SIZE);
  const eyes = new Grid(SIZE, SIZE);

  tail.points([[15, 36], [13, 36], [11, 36], [9, 35], [7, 34]], c.fur, 2);
  tail.points([[5, 33]], c.dark, 2);

  body.ellipse(20, 29, 7, 9, c.fur);
  body.ellipse(20, 17, 8.5, 7, c.fur);
  body.ellipse(12.5, 11.5, 1.8, 1.8, c.dark);
  body.ellipse(27.5, 11.5, 1.8, 1.8, c.dark);
  body.ellipse(20, 20, 5, 3, c.light);
  body.ellipse(20, 30, 4.5, 6.5, c.light);
  body.ellipse(17, 25, 1.6, 1.3, c.dark);
  body.ellipse(23, 25, 1.6, 1.3, c.dark);
  body.ellipse(16, 37, 2, 1, c.dark);
  body.ellipse(24, 37, 2, 1, c.dark);
  body.points([[19, 18], [20, 18], [21, 18], [20, 19]], MOUTH);
  body.points([[19, 21], [21, 21]], MOUTH);
  body.points([[16, 20], [17, 21], [24, 20], [23, 21]], c.dark);
  body.points([[13, 19], [14, 19], [26, 19], [27, 19]], BLUSH);

  for (const ex of [15, 24]) {
    eyes.rect(ex, 15, 2, 3, '#140a1e');
    eyes.set(ex, 15, '#ffffff');
  }

  return { body, tail, eyes, anchors: OTTER_ANCHORS, outline: c.outline };
}

function accessoryLayers(outfit, anchors) {
  const layers = { back: new Grid(SIZE, SIZE), front: [] };
  for (const slot of SLOTS) {
    const def = OUTFIT_BY_ID[outfit && outfit[slot.id]];
    if (!def) continue;
    if (def.back) def.back(layers.back, anchors);
    if (def.front) {
      const g = new Grid(SIZE, SIZE);
      def.front(g, anchors);
      layers.front.push({ slot: slot.id, id: def.id, grid: g, outline: def.outline !== false });
    }
  }
  return layers;
}

function layerSVG(grid, outlineColor, cls, style = '') {
  const outline = outlineColor ? gridToPaths(grid.outline(outlineColor)) : '';
  return `<g class="${cls}"${style ? ` style="${style}"` : ''}>${outline}${gridToPaths(grid)}</g>`;
}

/**
 * Renderiza uma criatura como string SVG.
 * kind: 'cat' | 'otter'; look: { coat, eyes, outfit }
 */
export function creatureSVG(kind, look = {}, { size = 160, label = '', extraClass = '', viewBox = `0 0 ${SIZE} ${SIZE}` } = {}) {
  const d = kind === 'otter' ? drawOtter(look) : drawCat(look);
  const A = d.anchors;
  const acc = accessoryLayers(look.outfit || {}, A);
  const [px, py] = A.tailPivot;
  const parts = [
    layerSVG(acc.back, OUTLINE, 'acc acc-back'),
    layerSVG(d.tail, d.outline, 'layer-tail', `transform-origin:${px}px ${py}px`),
    layerSVG(d.body, d.outline, 'layer-body'),
    `<g class="layer-eyes" style="transform-origin:20px ${A.eyeY}px">${gridToPaths(d.eyes)}</g>`
  ];
  for (const layer of acc.front) {
    const style = layer.slot === 'hand' ? `transform-origin:${A.handX}px ${A.handY}px` : '';
    parts.push(layerSVG(layer.grid, layer.outline ? OUTLINE : null, `acc acc-${layer.slot} acc--${layer.id}`, style));
  }
  const classes = ['creature', `creature--${kind}`, d.glow ? 'creature--glow' : '', extraClass].filter(Boolean).join(' ');
  return `<svg class="${classes}" viewBox="${viewBox}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeAttr(label)}">${parts.join('')}</svg>`;
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}
