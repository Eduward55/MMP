// Gato e lontra desenhados proceduralmente em pixel art (originais, sem imagens externas).
import { Grid, gridToPaths } from './pixel.js';
import { OUTFIT_BY_ID, SLOTS, OUTLINE } from './outfits.js';

export const SIZE = 40;

export const COATS = [
  { id: 'tabby', name: 'Tigresa', fur: '#a88a6a', stripe: '#5e4634', light: '#e6d3b6', paw: '#e6d3b6', ear: '#ff9ccf', outline: OUTLINE, stripes: true },
  { id: 'black', name: 'Preto', fur: '#2c2438', stripe: '#2c2438', light: '#3b3149', paw: '#3b3149', ear: '#ff7fc2', outline: '#05020a', stripes: false },
  { id: 'tuxedo', name: 'Frajola', fur: '#231d2e', stripe: '#231d2e', light: '#f6f2ff', paw: '#f6f2ff', ear: '#ff7fc2', outline: '#05020a', stripes: false },
  { id: 'white', name: 'Branco', fur: '#f5f0ff', stripe: '#e3dcf3', light: '#ffffff', paw: '#ffffff', ear: '#ffa6d6', outline: '#5e4a8a', stripes: false },
  { id: 'orange', name: 'Laranja', fur: '#f28a3b', stripe: '#c25c1c', light: '#ffd8a8', paw: '#ffd8a8', ear: '#ff9ccf', outline: OUTLINE, stripes: true },
  { id: 'gray', name: 'Cinza', fur: '#8f8ba3', stripe: '#6b667f', light: '#c9c5da', paw: '#c9c5da', ear: '#ff9ccf', outline: OUTLINE, stripes: true },
  { id: 'cream', name: 'Creme', fur: '#ead7b4', stripe: '#c4a574', light: '#fff6e4', paw: '#fff6e4', ear: '#ff9ccf', outline: '#5e4a8a', stripes: true },
  { id: 'chocolate', name: 'Chocolate', fur: '#6b3a22', stripe: '#3d1f12', light: '#d4a574', paw: '#d4a574', ear: '#ff7fc2', outline: '#1a0c08', stripes: true }
];

export const COAT_BY_ID = Object.fromEntries(COATS.map((c) => [c.id, c]));

export const OTTER_COATS = [
  { id: 'chocolate', name: 'Chocolate', fur: '#9a6a45', light: '#f1dcb8', dark: '#6e4529', outline: OUTLINE },
  { id: 'honey', name: 'Mel', fur: '#c9893a', light: '#ffe4b0', dark: '#8a5520', outline: OUTLINE },
  { id: 'cinnamon', name: 'Canela', fur: '#7a3f28', light: '#e8c4a0', dark: '#4e2416', outline: OUTLINE },
  { id: 'charcoal', name: 'Carvão', fur: '#3d3430', light: '#cfc4b8', dark: '#1f1a18', outline: '#05020a' },
  { id: 'cream', name: 'Creme', fur: '#e8d5b5', light: '#fff8ea', dark: '#b08968', outline: '#5e4a8a' },
  { id: 'silver', name: 'Prata', fur: '#9aa3ad', light: '#e8eef4', dark: '#5c6670', outline: OUTLINE }
];
export const OTTER_COAT_BY_ID = Object.fromEntries(OTTER_COATS.map((c) => [c.id, c]));

export const EYE_COLORS = [
  { id: '#4ade80', name: 'Verde menta' },
  { id: '#93c5fd', name: 'Azul' },
  { id: '#eab308', name: 'Âmbar' },
  { id: '#c4b5fd', name: 'Lilás' },
  { id: '#8b5cf6', name: 'Violeta' },
  { id: '#d4a574', name: 'Cobre' }
];

const BLUSH = 'rgba(255, 110, 190, 0.55)';
const MOUTH = '#3a1d2e';

function otterLook(look = {}) {
  return OTTER_COAT_BY_ID[look.coat] || OTTER_COATS[0];
}

function drawHindPaws(body, y, paw, pad) {
  body.ellipse(10, y, 3.1, 1.8, paw);
  body.ellipse(30, y, 3.1, 1.8, paw);
  body.points([[9, y - 1], [11, y - 1], [29, y - 1], [31, y - 1]], pad);
}

function drawFrontPaws(body, y, fur, paw) {
  body.ellipse(9, y, 2.8, 2.6, fur);
  body.ellipse(31, y, 2.8, 2.6, fur);
  body.ellipse(9, y + 1.4, 2.4, 1.6, paw);
  body.ellipse(31, y + 1.4, 2.4, 1.6, paw);
  body.points([[8, y], [10, y], [30, y], [32, y]], paw);
}

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
  const eye = look.eyes || '#4ade80';
  const body = new Grid(SIZE, SIZE);
  const tail = new Grid(SIZE, SIZE);
  const eyes = new Grid(SIZE, SIZE);

  const tailPts = [[27, 36], [29, 35], [30, 34], [31, 33], [32, 31], [32, 29], [32, 27], [31, 25], [30, 24]];
  tail.points(tailPts, coat.fur, 2);
  if (coat.stripes) tail.points([[31, 33], [32, 29], [31, 25]], coat.stripe, 2);
  if (coat.id === 'tuxedo') tail.points([[30, 24]], coat.light, 2);

  body.ellipse(20, 29.5, 9, 6.6, coat.fur);
  body.ellipse(20, 18, 10, 8, coat.fur);
  body.tri([11, 15], [13, 7], [18, 11], coat.fur);
  body.tri([29, 15], [27, 7], [22, 11], coat.fur);
  body.tri([13, 13], [14, 9], [16, 12], coat.ear);
  body.tri([27, 13], [26, 9], [24, 12], coat.ear);
  body.ellipse(20, 21, 4, 2.5, coat.light);
  drawFrontPaws(body, 32, coat.fur, coat.paw);
  drawHindPaws(body, 37, coat.paw, coat.ear);
  for (let x = 16; x <= 24; x++) {
    for (let y = 33; y <= 36; y++) {
      if (x >= 18 && x <= 22) body.set(x, y, coat.fur);
    }
  }
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

  for (const ex of [15, 24]) {
    eyes.rect(ex, 16, 2, 2, eye);
    eyes.set(ex + 1, 17, '#140a1e');
    eyes.set(ex, 16, '#ffffff');
  }

  return { coat, body, tail, eyes, anchors: CAT_ANCHORS, outline: coat.outline, glow: coat.glow };
}

function heartEyesGrid(kind) {
  const g = new Grid(SIZE, SIZE);
  const pal = { h: '#ff4fd8', l: '#ff8fd0' };
  const heart = ['.h.h.', 'hhhhh', 'hhhhh', '.hhh.', '..h..'];
  if (kind === 'otter') {
    g.map(heart, pal, 13, 13);
    g.map(heart, pal, 22, 13);
  } else {
    g.map(heart, pal, 12, 14);
    g.map(heart, pal, 22, 14);
  }
  return g;
}

function drawCatRear(look) {
  const coat = COAT_BY_ID[look.coat] || COATS[0];
  const body = new Grid(SIZE, SIZE);
  const tail = new Grid(SIZE, SIZE);
  const eyes = new Grid(SIZE, SIZE);

  const tailPts = [[12, 35], [10, 34], [8, 32], [7, 30], [6, 27], [7, 24], [8, 22], [10, 20]];
  tail.points(tailPts, coat.fur, 2);
  if (coat.stripes) tail.points([[8, 32], [7, 27], [8, 22]], coat.stripe, 2);

  body.ellipse(20, 30, 9, 6.6, coat.fur);
  body.ellipse(20, 18, 10, 8, coat.fur);
  body.tri([11, 14], [13, 5], [18, 11], coat.fur);
  body.tri([29, 14], [27, 5], [22, 11], coat.fur);
  body.tri([13, 12], [14, 7], [16, 11], coat.ear);
  body.tri([27, 12], [26, 7], [24, 11], coat.ear);
  drawFrontPaws(body, 32, coat.fur, coat.paw);
  drawHindPaws(body, 37, coat.paw, coat.ear);
  if (coat.stripes) {
    body.points([[17, 11], [17, 12], [20, 10], [20, 11], [23, 11], [23, 12]], coat.stripe);
    body.points([[12, 28], [13, 28], [27, 28], [28, 28]], coat.stripe);
  }

  return { coat, body, tail, eyes, anchors: CAT_ANCHORS, outline: coat.outline };
}

function drawOtterRear(look = {}) {
  const c = otterLook(look);
  const body = new Grid(SIZE, SIZE);
  const tail = new Grid(SIZE, SIZE);
  const eyes = new Grid(SIZE, SIZE);

  tail.points([[14, 36], [11, 36], [8, 35], [5, 33], [3, 31], [2, 28], [3, 25]], c.fur, 2);
  tail.points([[2, 28], [3, 31]], c.dark, 2);

  body.ellipse(20, 30, 7, 9, c.fur);
  body.ellipse(20, 17, 8.5, 7, c.fur);
  body.ellipse(12.5, 11, 1.8, 1.8, c.dark);
  body.ellipse(27.5, 11, 1.8, 1.8, c.dark);
  drawFrontPaws(body, 27, c.fur, c.dark);
  drawHindPaws(body, 37, c.dark, c.light);

  return { body, tail, eyes, anchors: OTTER_ANCHORS, outline: c.outline };
}

function drawOtter(look = {}) {
  const c = otterLook(look);
  const eye = look.eyes || '#93c5fd';
  const body = new Grid(SIZE, SIZE);
  const tail = new Grid(SIZE, SIZE);
  const eyes = new Grid(SIZE, SIZE);

  tail.points([[15, 36], [13, 36], [11, 36], [9, 35], [7, 34]], c.fur, 2);
  tail.points([[5, 33]], c.dark, 2);

  body.ellipse(20, 29, 7, 9, c.fur);
  body.ellipse(20, 17, 8.5, 7, c.fur);
  body.ellipse(12.5, 11.5, 1.8, 1.8, c.dark);
  body.ellipse(27.5, 11.5, 1.8, 1.8, c.dark);
  body.ellipse(20, 20, 4.5, 2.6, c.light);
  body.ellipse(20, 26.5, 3, 3.6, c.light);
  body.ellipse(12, 26, 2.6, 2.2, c.fur);
  body.ellipse(28, 26, 2.6, 2.2, c.fur);
  body.ellipse(12, 27.4, 2.4, 1.6, c.dark);
  body.ellipse(28, 27.4, 2.4, 1.6, c.dark);
  body.points([[11, 25], [13, 25], [27, 25], [29, 25]], c.light);
  drawHindPaws(body, 37, c.dark, c.light);
  body.points([[20, 18], [20, 19]], MOUTH);
  body.points([[19, 21], [20, 22], [21, 21]], MOUTH);
  body.points([[15, 20], [25, 20]], c.dark);
  body.points([[13, 19], [14, 19], [26, 19], [27, 19]], BLUSH);

  for (const ex of [15, 24]) {
    eyes.rect(ex, 15, 2, 2, eye);
    eyes.set(ex + 1, 16, '#140a1e');
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
export function creatureSVG(kind, look = {}, { size = 160, label = '', extraClass = '', viewBox = `0 0 ${SIZE} ${SIZE}`, pose = 'front' } = {}) {
  const rear = pose === 'rear';
  const d = kind === 'otter' ? (rear ? drawOtterRear(look) : drawOtter(look)) : rear ? drawCatRear(look) : drawCat(look);
  const A = d.anchors;
  const acc = accessoryLayers(look.outfit || {}, A);
  const [px, py] = A.tailPivot;
  const hearts = heartEyesGrid(kind);
  const parts = [
    layerSVG(acc.back, OUTLINE, 'acc acc-back'),
    layerSVG(d.tail, d.outline, 'layer-tail', `transform-origin:${px}px ${py}px`),
    layerSVG(d.body, d.outline, 'layer-body'),
    `<g class="layer-eyes" style="transform-origin:20px ${A.eyeY}px">${gridToPaths(d.eyes)}</g>`,
    layerSVG(hearts, null, 'layer-heart-eyes')
  ];
  for (const layer of acc.front) {
    if (rear && layer.slot === 'face') continue;
    const style = layer.slot === 'hand' ? `transform-origin:${A.handX}px ${A.handY}px` : '';
    parts.push(layerSVG(layer.grid, layer.outline ? OUTLINE : null, `acc acc-${layer.slot} acc--${layer.id}`, style));
  }
  const classes = ['creature', `creature--${kind}`, rear ? 'creature--rear' : '', d.glow ? 'creature--glow' : '', extraClass].filter(Boolean).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${classes}" viewBox="${viewBox}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeAttr(label)}">${parts.join('')}</svg>`;
}

// Só o acessório (sem criatura), recortado no próprio tamanho — usado como ficha arrastável.
export function accessorySVG(id, { size = 48, kind = 'cat', label = '' } = {}) {
  const def = OUTFIT_BY_ID[id];
  if (!def) return '';
  const A = kind === 'otter' ? OTTER_ANCHORS : CAT_ANCHORS;
  const back = new Grid(SIZE, SIZE);
  const front = new Grid(SIZE, SIZE);
  if (def.back) def.back(back, A);
  if (def.front) def.front(front, A);
  const all = new Grid(SIZE, SIZE).stamp(back).stamp(front);
  let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!all.get(x, y)) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
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
