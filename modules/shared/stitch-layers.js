// Sprites 48×48 do Stitch (Pirrinha / Manhoso): silhueta fixa, pelagem via fill.
export const SIZE = 48;

export const CAT_ANCHORS = {
  cx: 24,
  headTop: 10,
  earTopY: 7,
  headL: 14,
  headR: 34,
  headCy: 18,
  eyeY: 19,
  eyeLX: 18,
  eyeRX: 27,
  neckY: 24,
  bodyY: 33,
  bodyRx: 9,
  bodyRy: 7,
  earLX: 16,
  earRX: 30,
  handX: 31,
  handY: 32,
  tailPivot: [31, 35]
};

export const OTTER_ANCHORS = {
  cx: 24,
  headTop: 10,
  earTopY: 13,
  headL: 14,
  headR: 34,
  headCy: 17,
  eyeY: 17,
  eyeLX: 18,
  eyeRX: 27,
  neckY: 23,
  bodyY: 32,
  bodyRx: 9,
  bodyRy: 8,
  earLX: 13,
  earRX: 33,
  handX: 28,
  handY: 32,
  tailPivot: [32, 35]
};

const STITCH_IDS = new Set([
  'astronauta',
  'maid',
  'sueter',
  'capa',
  'cachecol',
  'gravata',
  'coleira',
  'oculos',
  'oculos-coracao',
  'estrelinha',
  'lacinho',
  'flor',
  'capacete',
  'chapeu-bruxa',
  'coroa',
  'fone',
  'chapeu-festa',
  'boina',
  'batuta',
  'microfone'
]);

export function isStitchAccessory(id) {
  return STITCH_IDS.has(id);
}

function r(x, y, w, h, fill, cls = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${cls ? ` class="${cls}"` : ''}/>`;
}

function g(cls, inner, extra = '') {
  return `<g class="${cls}"${extra}>${inner}</g>`;
}

function acc(id, slot, inner) {
  return `<g class="acc acc-${slot} acc--${id}">${inner}</g>`;
}

function equippedSet(outfit = {}) {
  return new Set(Object.values(outfit).filter(Boolean));
}

export const CAT_ACC_MARKUP = {
  capa: acc(
    'capa',
    'back',
    `${r(13, 27, 22, 14, '#1e1b4b')}${r(12, 30, 24, 10, '#312e81')}${r(11, 34, 26, 6, '#eab308')}${r(15, 26, 18, 2, '#dc2626')}`
  ),
  astronauta: acc(
    'astronauta',
    'body',
    `${r(15, 27, 18, 14, '#0284c7')}${r(16, 28, 16, 12, '#f8fafc')}${r(20, 32, 8, 5, '#38bdf8')}${r(22, 33, 2, 3, '#ec4899')}${r(25, 33, 2, 3, '#10b981')}${r(18, 39, 12, 2, '#0284c7')}`
  ),
  maid: acc(
    'maid',
    'body',
    `${r(15, 28, 18, 13, '#18181b')}${r(18, 29, 12, 10, '#ffffff')}${r(20, 31, 8, 2, '#18181b')}${r(19, 35, 10, 1, '#ec4899')}${r(16, 39, 16, 2, '#ffffff')}`
  ),
  sueter: acc(
    'sueter',
    'body',
    `${r(15, 27, 18, 14, '#0d9488')}${r(15, 29, 18, 2, '#ffffff')}${r(15, 33, 18, 2, '#ffffff')}${r(15, 37, 18, 2, '#ffffff')}${r(17, 26, 14, 2, '#042f2e')}`
  ),
  cachecol: acc(
    'cachecol',
    'neck',
    `${r(14, 24, 20, 4, '#be185d')}${r(16, 25, 16, 2, '#fbcfe8')}${r(27, 27, 4, 9, '#be185d')}${r(27, 29, 4, 2, '#fbcfe8')}${r(27, 33, 4, 2, '#fbcfe8')}`
  ),
  gravata: acc('gravata', 'neck', `${r(20, 25, 3, 3, '#e11d48')}${r(25, 25, 3, 3, '#e11d48')}${r(23, 26, 2, 2, '#ffe4e6')}`),
  coleira: acc('coleira', 'neck', `${r(16, 25, 16, 2, '#e11d48')}${r(23, 26, 2, 2, '#eab308')}${r(23, 28, 2, 1, '#ca8a04')}`),
  oculos: acc(
    'oculos',
    'face',
    `<rect x="17" y="16" width="5" height="5" fill="none" stroke="#e11d48" stroke-width="1"/>` +
      `<rect x="26" y="16" width="5" height="5" fill="none" stroke="#e11d48" stroke-width="1"/>${r(22, 18, 4, 1, '#e11d48')}`
  ),
  'oculos-coracao': acc(
    'oculos-coracao',
    'face',
    `<path d="M17 16 h2 v1 h1 v1 h-1 v2 h-1 v-1 h-2 v-1 h1 v-2 z" fill="#f43f5e"/>` +
      `<path d="M26 16 h2 v1 h1 v1 h-1 v2 h-1 v-1 h-2 v-1 h1 v-2 z" fill="#f43f5e"/>${r(22, 17, 4, 1, '#f43f5e')}`
  ),
  estrelinha: acc('estrelinha', 'ear', `${r(31, 6, 3, 3, '#facc15')}${r(32, 5, 1, 5, '#fef08a')}${r(30, 7, 5, 1, '#fef08a')}`),
  lacinho: acc('lacinho', 'ear', `${r(13, 6, 2, 3, '#f43f5e')}${r(17, 6, 2, 3, '#f43f5e')}${r(15, 7, 2, 2, '#ffe4e6')}`),
  flor: acc('flor', 'ear', `${r(14, 6, 4, 4, '#f472b6')}${r(15, 7, 2, 2, '#facc15')}`),
  capacete: acc(
    'capacete',
    'head',
    `<rect x="12" y="8" width="24" height="18" fill="none" stroke="#38bdf8" stroke-width="1.5"/>` +
      `<rect x="13" y="9" width="22" height="16" fill="#38bdf8" opacity="0.2"/>` +
      `${r(15, 10, 4, 2, '#ffffff')}${r(13, 25, 22, 2, '#0284c7')}`
  ),
  'chapeu-bruxa': acc(
    'chapeu-bruxa',
    'head',
    `${r(11, 9, 26, 2, '#581c87')}${r(16, 5, 16, 4, '#6b21a8')}${r(19, 2, 10, 3, '#7e22ce')}${r(22, 0, 4, 2, '#9333ea')}${r(16, 8, 16, 1, '#eab308')}`
  ),
  coroa: acc(
    'coroa',
    'head',
    `${r(18, 5, 12, 4, '#eab308')}${r(18, 3, 2, 2, '#fde047')}${r(23, 2, 2, 3, '#fde047')}${r(28, 3, 2, 2, '#fde047')}${r(23, 6, 2, 2, '#dc2626')}`
  ),
  fone: acc(
    'fone',
    'head',
    `${r(13, 9, 22, 2, '#ec4899')}${r(11, 11, 3, 8, '#db2777')}${r(34, 11, 3, 8, '#db2777')}${r(12, 13, 1, 4, '#fbcfe8')}${r(35, 13, 1, 4, '#fbcfe8')}`
  ),
  'chapeu-festa': acc(
    'chapeu-festa',
    'head',
    `${r(21, 8, 6, 2, '#06b6d4')}${r(22, 5, 4, 3, '#ec4899')}${r(23, 3, 2, 2, '#eab308')}${r(23, 1, 2, 2, '#f43f5e')}`
  ),
  boina: acc('boina', 'head', `${r(14, 6, 20, 4, '#991b1b')}${r(16, 4, 16, 2, '#dc2626')}${r(23, 2, 2, 2, '#b91c1c')}`),
  batuta: acc('batuta', 'hand', `${r(31, 30, 8, 1, '#f8fafc')}${r(38, 29, 2, 3, '#eab308')}`),
  microfone: acc(
    'microfone',
    'hand',
    `${r(30, 31, 4, 2, '#475569')}${r(33, 29, 4, 4, '#a855f7')}${r(34, 30, 2, 2, '#f3e8ff')}`
  )
};

export const OTTER_ACC_MARKUP = {
  astronauta: acc(
    'astronauta',
    'body',
    `${r(16, 27, 16, 13, '#f1f5f9')}${r(15, 29, 18, 9, '#f1f5f9')}${r(17, 26, 14, 2, '#38bdf8')}${r(20, 29, 8, 7, '#0284c7')}${r(21, 31, 3, 3, '#ec4899')}${r(25, 31, 2, 3, '#38bdf8')}${r(18, 38, 12, 2, '#0284c7')}`
  ),
  maid: acc(
    'maid',
    'body',
    `${r(16, 27, 16, 13, '#18181b')}${r(18, 26, 12, 13, '#ffffff')}${r(20, 28, 8, 9, '#fbcfe8')}${r(15, 38, 18, 2, '#ffffff')}${r(22, 30, 4, 2, '#f43f5e')}`
  ),
  sueter: acc(
    'sueter',
    'body',
    `${r(15, 27, 18, 13, '#059669')}${r(15, 29, 18, 2, '#ffffff')}${r(15, 33, 18, 2, '#ffffff')}${r(15, 37, 18, 2, '#ffffff')}${r(18, 25, 12, 2, '#047857')}`
  ),
  capa: acc(
    'capa',
    'back',
    `${r(13, 26, 3, 14, '#991b1b')}${r(32, 26, 3, 14, '#991b1b')}${r(16, 27, 16, 13, '#09090b')}${r(20, 27, 8, 11, '#ffffff')}${r(22, 29, 4, 2, '#b91c1c')}${r(23, 33, 2, 2, '#fbbf24')}`
  ),
  cachecol: acc(
    'cachecol',
    'neck',
    `${r(16, 23, 16, 4, '#a855f7')}${r(18, 24, 12, 2, '#f472b6')}${r(26, 25, 4, 8, '#a855f7')}${r(27, 27, 2, 6, '#f472b6')}`
  ),
  gravata: acc('gravata', 'neck', `${r(21, 23, 6, 3, '#ef4444')}${r(23, 24, 2, 2, '#fee2e2')}`),
  coleira: acc('coleira', 'neck', `${r(17, 23, 14, 2, '#dc2626')}${r(23, 24, 3, 3, '#fbbf24')}${r(24, 25, 1, 1, '#78350f')}`),
  oculos: acc(
    'oculos',
    'face',
    `<rect x="17" y="15" width="5" height="5" fill="none" stroke="#f43f5e" stroke-width="1"/>` +
      `<rect x="26" y="15" width="5" height="5" fill="none" stroke="#f43f5e" stroke-width="1"/>` +
      `${r(22, 17, 4, 1, '#f43f5e')}${r(18, 16, 1, 1, '#ffffff')}${r(27, 16, 1, 1, '#ffffff')}`
  ),
  'oculos-coracao': acc(
    'oculos-coracao',
    'face',
    `<path d="M17 15 h4 v2 h-1 v2 h-2 v-2 h-1 z" fill="#ec4899"/>` +
      `<path d="M27 15 h4 v2 h-1 v2 h-2 v-2 h-1 z" fill="#ec4899"/>` +
      `${r(21, 16, 6, 1, '#db2777')}${r(18, 16, 1, 1, '#ffffff')}${r(28, 16, 1, 1, '#ffffff')}`
  ),
  estrelinha: acc('estrelinha', 'ear', `${r(33, 10, 3, 3, '#facc15')}${r(32, 11, 5, 1, '#fef08a')}${r(34, 9, 1, 5, '#fef08a')}`),
  lacinho: acc('lacinho', 'ear', `${r(13, 11, 4, 3, '#f472b6')}${r(14, 12, 2, 1, '#ffffff')}`),
  flor: acc('flor', 'ear', `${r(13, 11, 3, 3, '#fb7185')}${r(14, 12, 1, 1, '#fef08a')}`),
  capacete: acc(
    'capacete',
    'head',
    `<rect x="13" y="8" width="22" height="18" fill="#38bdf8" opacity="0.25"/>` +
      `<rect x="12" y="10" width="24" height="14" fill="#38bdf8" opacity="0.2"/>` +
      `<path d="M16 7 h16 v2 h-16 z M12 11 h3 v2 h-3 z M33 11 h3 v2 h-3 z M11 13 h2 v9 h-2 z M35 13 h2 v9 h-2 z M16 26 h16 v2 h-16 z" fill="#38bdf8"/>` +
      `${r(14, 9, 4, 1, '#ffffff')}${r(13, 10, 2, 3, '#ffffff')}`
  ),
  'chapeu-bruxa': acc(
    'chapeu-bruxa',
    'head',
    `${r(11, 10, 26, 3, '#6b21a8')}${r(16, 6, 16, 4, '#7e22ce')}${r(18, 2, 12, 4, '#7e22ce')}${r(21, 0, 6, 2, '#9333ea')}${r(16, 8, 16, 2, '#f59e0b')}`
  ),
  coroa: acc(
    'coroa',
    'head',
    `${r(17, 6, 14, 5, '#eab308')}${r(16, 9, 16, 2, '#ca8a04')}${r(17, 3, 2, 3, '#facc15')}${r(23, 2, 2, 4, '#facc15')}${r(29, 3, 2, 3, '#facc15')}${r(17, 7, 2, 2, '#ef4444')}${r(23, 6, 2, 2, '#3b82f6')}${r(29, 7, 2, 2, '#10b981')}`
  ),
  fone: acc(
    'fone',
    'head',
    `${r(14, 8, 20, 2, '#ec4899')}${r(12, 12, 3, 6, '#be185d')}${r(13, 13, 1, 4, '#f472b6')}${r(33, 12, 3, 6, '#be185d')}${r(34, 13, 1, 4, '#f472b6')}`
  ),
  'chapeu-festa': acc(
    'chapeu-festa',
    'head',
    `${r(21, 2, 6, 9, '#06b6d4')}${r(22, 4, 4, 2, '#f43f5e')}${r(21, 7, 6, 2, '#facc15')}${r(23, 0, 2, 2, '#ec4899')}`
  ),
  boina: acc('boina', 'head', `${r(15, 7, 18, 4, '#dc2626')}${r(14, 8, 20, 2, '#b91c1c')}${r(23, 5, 2, 2, '#991b1b')}`),
  batuta: acc('batuta', 'hand', `${r(28, 31, 10, 1, '#f8fafc')}${r(27, 31, 2, 2, '#fbbf24')}${r(37, 22, 2, 2, '#fbbf24')}${r(36, 23, 2, 1, '#f8fafc')}${r(34, 25, 2, 1, '#f8fafc')}${r(32, 27, 2, 1, '#f8fafc')}${r(30, 29, 2, 1, '#f8fafc')}`),
  microfone: acc(
    'microfone',
    'hand',
    `${r(28, 28, 2, 6, '#475569')}${r(27, 25, 4, 4, '#94a3b8')}${r(28, 26, 2, 2, '#f43f5e')}`
  )
};

function pickAcc(map, equipped, ids, skipFace) {
  let out = '';
  for (const id of ids) {
    if (!equipped.has(id)) continue;
    if (skipFace && (id === 'oculos' || id === 'oculos-coracao')) continue;
    if (map[id]) out += map[id];
  }
  return out;
}

function catPatches(pal) {
  if (pal.patches) {
    return (
      r(15, 16, 3, 3, '#c45c28', 'fur-stripe') +
      r(28, 15, 3, 3, '#2a2428') +
      r(16, 32, 3, 2, '#c45c28', 'fur-stripe') +
      r(29, 33, 2, 2, '#2a2428')
    );
  }
  if (pal.points) {
    return r(16, 7, 4, 4, pal.accent, 'fur-accent') + r(28, 7, 4, 4, pal.accent, 'fur-accent') + r(15, 40, 5, 3, pal.accent, 'fur-accent') + r(28, 40, 5, 3, pal.accent, 'fur-accent');
  }
  return '';
}

export function catInnerSVG(pal, { rear = false, outfit = {}, bonus = {} } = {}) {
  const eq = equippedSet(outfit);
  const has = (id) => eq.has(id);
  const P = pal.primary;
  const A = pal.accent;
  const S = pal.stripe;
  const Sh = pal.shadow;
  const B = pal.belly;
  const sparkle = g('creature-sparkle', `${r(7, 14, 1, 3, pal.sparkle)}${r(6, 15, 3, 1, pal.sparkle)}${r(40, 16, 1, 3, pal.sparkle)}${r(39, 17, 3, 1, pal.sparkle)}`);
  const shadow = `${r(17, 44, 14, 2, '#090d16')}${r(19, 43, 10, 1, '#090d16')}`;
  const tail = rear
    ? g(
        'layer-tail cat-tail-anim',
        `${r(16, 34, 2, 2, A, 'fur-accent')}${r(14, 32, 2, 2, A, 'fur-accent')}${r(13, 29, 2, 3, P, 'fur-primary')}${r(12, 26, 2, 3, P, 'fur-primary')}${r(11, 23, 2, 3, P, 'fur-primary')}${r(12, 22, 2, 1, P, 'fur-primary')}`,
        ' style="transform-origin:16px 35px"'
      )
    : g(
        'layer-tail cat-tail-anim',
        `${r(30, 34, 2, 2, A, 'fur-accent')}${r(32, 32, 2, 2, A, 'fur-accent')}${r(33, 29, 2, 3, P, 'fur-primary')}${r(34, 26, 2, 3, P, 'fur-primary')}${r(35, 23, 2, 3, P, 'fur-primary')}${r(34, 22, 2, 1, P, 'fur-primary')}`,
        ' style="transform-origin:31px 35px"'
      );
  const cape = pickAcc(CAT_ACC_MARKUP, eq, ['capa']) + (bonus.back || '');
  const feet =
    r(15, 40, 5, 3, P, 'fur-primary') +
    r(14, 41, 1, 2, Sh, 'fur-shadow') +
    r(15, 42, 1, 1, pal.pad) +
    r(17, 42, 1, 1, pal.pad) +
    r(19, 42, 1, 1, pal.pad) +
    r(28, 40, 5, 3, P, 'fur-primary') +
    r(33, 41, 1, 2, Sh, 'fur-shadow') +
    r(28, 42, 1, 1, pal.pad) +
    r(30, 42, 1, 1, pal.pad) +
    r(32, 42, 1, 1, pal.pad);
  const torso =
    r(16, 26, 16, 15, P, 'fur-primary') +
    r(15, 28, 18, 11, P, 'fur-primary') +
    r(17, 25, 14, 1, P, 'fur-primary') +
    r(19, 26, 10, 14, B, 'fur-belly');
  const stripes = g(
    'fur-stripes-body',
    `${r(15, 30, 2, 1, S, 'fur-stripe')}${r(15, 34, 3, 1, S, 'fur-stripe')}${r(30, 30, 3, 1, S, 'fur-stripe')}${r(31, 34, 2, 1, S, 'fur-stripe')}`
  );
  const bodyAcc = pickAcc(CAT_ACC_MARKUP, eq, ['astronauta', 'maid', 'sueter']) + (bonus.body || '');
  const paws = has('astronauta')
    ? g('front-paws', `${r(19, 31, 3, 4, '#f8fafc')}${r(19, 34, 3, 1, pal.pad)}${r(26, 31, 3, 4, '#f8fafc')}${r(26, 34, 3, 1, pal.pad)}`)
    : g('front-paws', `${r(19, 31, 3, 4, P, 'fur-primary')}${r(19, 34, 3, 1, pal.pad)}${r(26, 31, 3, 4, P, 'fur-primary')}${r(26, 34, 3, 1, pal.pad)}`);
  const neck = pickAcc(CAT_ACC_MARKUP, eq, ['cachecol', 'gravata', 'coleira']) + (bonus.neck || '');
  const head =
    r(15, 11, 18, 14, P, 'fur-primary') +
    r(14, 13, 20, 10, P, 'fur-primary') +
    r(16, 10, 16, 1, P, 'fur-primary');
  const ears =
    r(16, 7, 3, 3, A, 'fur-accent') +
    r(15, 8, 1, 3, A, 'fur-accent') +
    r(17, 8, 2, 2, pal.earInner) +
    r(29, 7, 3, 3, A, 'fur-accent') +
    r(32, 8, 1, 3, A, 'fur-accent') +
    r(29, 8, 2, 2, pal.earInner);
  const brow = g('fur-stripes-head', `${r(23, 11, 2, 3, A, 'fur-stripe')}${r(20, 12, 1, 2, S, 'fur-stripe')}${r(27, 12, 1, 2, S, 'fur-stripe')}`);
  const face = rear
    ? r(16, 14, 16, 8, pal.shadow, 'fur-shadow')
    : r(15, 20, 3, 1, pal.blush) +
      r(30, 20, 3, 1, pal.blush) +
      g(
        'layer-eyes cat-eyes',
        r(18, 17, 3, 4, pal.eye, 'eye-iris') +
          r(18, 17, 1, 2, '#ffffff') +
          r(20, 19, 1, 2, pal.eyeDark, 'eye-pupil') +
          r(27, 17, 3, 4, pal.eye, 'eye-iris') +
          r(27, 17, 1, 2, '#ffffff') +
          r(29, 19, 1, 2, pal.eyeDark, 'eye-pupil'),
        ' style="transform-origin:24px 19px"'
      ) +
      r(23, 20, 2, 1, pal.nose) +
      r(22, 22, 1, 1, A, 'fur-accent') +
      r(25, 22, 1, 1, A, 'fur-accent') +
      r(23, 21, 2, 1, A, 'fur-accent') +
      r(14, 20, 2, 1, S, 'fur-accent') +
      r(13, 22, 2, 1, S, 'fur-accent') +
      r(32, 20, 2, 1, S, 'fur-accent') +
      r(33, 22, 2, 1, S, 'fur-accent');
  const hearts = rear
    ? ''
    : g(
        'layer-heart-eyes',
        `${r(17, 16, 1, 1, '#ff4fd8')}${r(19, 16, 1, 1, '#ff4fd8')}${r(16, 17, 5, 2, '#ff4fd8')}${r(17, 19, 3, 1, '#ff8fd0')}${r(18, 20, 1, 1, '#ff4fd8')}` +
          `${r(26, 16, 1, 1, '#ff4fd8')}${r(28, 16, 1, 1, '#ff4fd8')}${r(25, 17, 5, 2, '#ff4fd8')}${r(26, 19, 3, 1, '#ff8fd0')}${r(27, 20, 1, 1, '#ff4fd8')}`
      );
  const faceAcc = pickAcc(CAT_ACC_MARKUP, eq, ['oculos', 'oculos-coracao'], rear) + (rear ? '' : bonus.face || '');
  const earAcc = pickAcc(CAT_ACC_MARKUP, eq, ['estrelinha', 'lacinho', 'flor']) + (bonus.ear || '');
  const headAcc = pickAcc(CAT_ACC_MARKUP, eq, ['capacete', 'chapeu-bruxa', 'coroa', 'fone', 'chapeu-festa', 'boina']) + (bonus.head || '');
  const handAcc = pickAcc(CAT_ACC_MARKUP, eq, ['batuta', 'microfone']) + (bonus.hand || '');
  const root = g(
    'creature-root cat-root',
    shadow +
      tail +
      cape +
      feet +
      torso +
      stripes +
      catPatches(pal) +
      bodyAcc +
      (rear ? '' : paws) +
      neck +
      head +
      ears +
      brow +
      face +
      hearts +
      faceAcc +
      earAcc +
      headAcc +
      handAcc
  );
  return sparkle + root;
}

export function otterInnerSVG(pal, { rear = false, outfit = {}, bonus = {} } = {}) {
  const eq = equippedSet(outfit);
  const has = (id) => eq.has(id);
  const F = pal.body;
  const D = pal.shade;
  const B = pal.belly;
  const sparkle = g(
    'creature-sparkle',
    `${r(8, 16, 1, 3, pal.sparkle)}${r(7, 17, 3, 1, pal.sparkle)}${r(39, 13, 1, 3, pal.sparkle)}${r(38, 14, 3, 1, pal.sparkle)}`
  );
  const shadow = `${r(17, 44, 14, 2, '#090d16')}${r(19, 43, 10, 1, '#090d16')}`;
  const tail = rear
    ? g(
        'layer-tail otter-tail-anim',
        `${r(15, 34, 3, 3, D)}${r(12, 31, 3, 3, D)}${r(10, 28, 3, 3, D)}${r(8, 25, 2, 3, D)}${r(7, 22, 2, 3, F)}`,
        ' style="transform-origin:16px 35px"'
      )
    : g(
        'layer-tail otter-tail-anim',
        `${r(30, 34, 3, 3, D)}${r(32, 31, 3, 3, D)}${r(34, 28, 3, 3, D)}${r(36, 25, 2, 3, D)}${r(37, 22, 2, 3, F)}`,
        ' style="transform-origin:32px 35px"'
      );
  const feet =
    r(15, 40, 5, 3, D) +
    r(14, 41, 1, 2, F) +
    r(15, 42, 1, 1, pal.paws) +
    r(17, 42, 1, 1, pal.paws) +
    r(19, 42, 1, 1, pal.paws) +
    r(28, 40, 5, 3, D) +
    r(33, 41, 1, 2, F) +
    r(28, 42, 1, 1, pal.paws) +
    r(30, 42, 1, 1, pal.paws) +
    r(32, 42, 1, 1, pal.paws);
  const torso =
    r(16, 25, 16, 16, F, 'fur-primary') +
    r(15, 27, 18, 12, F, 'fur-primary') +
    r(17, 24, 14, 1, F, 'fur-primary') +
    r(19, 25, 10, 14, B, 'fur-belly') +
    r(20, 24, 8, 1, B, 'fur-belly') +
    r(20, 37, 8, 1, pal.bellyShade);
  const cape = pickAcc(OTTER_ACC_MARKUP, eq, ['capa']) + (bonus.back || '');
  const bodyAcc = pickAcc(OTTER_ACC_MARKUP, eq, ['astronauta', 'maid', 'sueter']) + (bonus.body || '');
  const pawFill = has('astronauta') ? '#f1f5f9' : D;
  const paws = g('front-paws', `${r(18, 30, 3, 4, pawFill)}${r(18, 33, 3, 1, pal.paws)}${r(27, 30, 3, 4, pawFill)}${r(27, 33, 3, 1, pal.paws)}`);
  const neck = pickAcc(OTTER_ACC_MARKUP, eq, ['cachecol', 'gravata', 'coleira']) + (bonus.neck || '');
  const head =
    r(15, 11, 18, 13, F, 'fur-primary') +
    r(14, 13, 20, 9, F, 'fur-primary') +
    r(16, 10, 16, 1, F, 'fur-primary');
  const ears = r(13, 13, 2, 3, D, 'fur-accent') + r(14, 14, 1, 1, pal.paws) + r(33, 13, 2, 3, D, 'fur-accent') + r(33, 14, 1, 1, pal.paws);
  const muzzle = rear ? r(16, 14, 16, 7, pal.shade, 'fur-shadow') : r(19, 18, 10, 5, B, 'fur-belly') + r(20, 17, 8, 1, B, 'fur-belly');
  const face = rear
    ? ''
    : r(15, 20, 3, 1, pal.blush) +
      r(30, 20, 3, 1, pal.blush) +
      g(
        'layer-eyes otter-eyes',
        r(18, 16, 3, 3, pal.eye, 'eye-iris') +
          r(18, 16, 1, 1, '#ffffff') +
          r(20, 18, 1, 1, pal.eyeDark, 'eye-pupil') +
          r(27, 16, 3, 3, pal.eye, 'eye-iris') +
          r(27, 16, 1, 1, '#ffffff') +
          r(29, 18, 1, 1, pal.eyeDark, 'eye-pupil'),
        ' style="transform-origin:24px 19px"'
      ) +
      r(23, 18, 2, 2, pal.nose) +
      r(22, 21, 1, 1, pal.nose) +
      r(25, 21, 1, 1, pal.nose) +
      r(23, 20, 2, 1, pal.nose) +
      r(15, 21, 2, 1, D) +
      r(31, 21, 2, 1, D);
  const hearts = rear
    ? ''
    : g(
        'layer-heart-eyes',
        `${r(17, 15, 1, 1, '#ff4fd8')}${r(19, 15, 1, 1, '#ff4fd8')}${r(16, 16, 5, 2, '#ff4fd8')}${r(17, 18, 3, 1, '#ff8fd0')}${r(18, 19, 1, 1, '#ff4fd8')}` +
          `${r(26, 15, 1, 1, '#ff4fd8')}${r(28, 15, 1, 1, '#ff4fd8')}${r(25, 16, 5, 2, '#ff4fd8')}${r(26, 18, 3, 1, '#ff8fd0')}${r(27, 19, 1, 1, '#ff4fd8')}`
      );
  const faceAcc = pickAcc(OTTER_ACC_MARKUP, eq, ['oculos', 'oculos-coracao'], rear) + (rear ? '' : bonus.face || '');
  const earAcc = pickAcc(OTTER_ACC_MARKUP, eq, ['estrelinha', 'lacinho', 'flor']) + (bonus.ear || '');
  const headAcc = pickAcc(OTTER_ACC_MARKUP, eq, ['capacete', 'chapeu-bruxa', 'coroa', 'fone', 'chapeu-festa', 'boina']) + (bonus.head || '');
  const handAcc = pickAcc(OTTER_ACC_MARKUP, eq, ['batuta', 'microfone']) + (bonus.hand || '');
  const root = g(
    'creature-root otter-root',
    shadow +
      tail +
      cape +
      feet +
      torso +
      bodyAcc +
      (rear ? '' : paws) +
      neck +
      head +
      ears +
      muzzle +
      face +
      hearts +
      faceAcc +
      earAcc +
      headAcc +
      handAcc
  );
  return sparkle + root;
}

export function stitchAccessoryInner(kind, id) {
  const map = kind === 'otter' ? OTTER_ACC_MARKUP : CAT_ACC_MARKUP;
  return map[id] || '';
}
