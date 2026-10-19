// 20 roupinhas/acessórios originais em pixel art. Cada um desenha numa grade usando
// as "âncoras" da criatura (gato ou lontra), então serve para os dois.

const OUT = '#120a1c';

const P = {
  white: '#f4f1ff',
  cloud: '#d9d4f0',
  shade: '#a49cc9',
  pink: '#ff4fd8',
  pinkDark: '#c4279f',
  rose: '#ff8fd0',
  purple: '#c45c72',
  purpleDark: '#7a3044',
  night: '#1d1233',
  cyan: '#5ff3ff',
  gold: '#ffd23f',
  goldDark: '#c99712',
  red: '#ff3d6e',
  green: '#5dff9b',
  brown: '#7a4a2a',
  glass: 'rgba(150, 225, 255, 0.22)',
  glassEdge: '#bfeeff'
};

const center = (A, w) => Math.round(A.cx - Math.floor(w / 2));

function bodyShape(g, A, color) {
  g.ellipse(A.cx, A.bodyY, A.bodyRx, A.bodyRy, color);
}

export const SLOTS = [
  { id: 'head', label: 'Cabeça' },
  { id: 'ear', label: 'Orelha' },
  { id: 'face', label: 'Rosto' },
  { id: 'neck', label: 'Pescoço' },
  { id: 'body', label: 'Corpo' },
  { id: 'back', label: 'Costas' },
  { id: 'hand', label: 'Patinha' }
];

export const OUTFITS = [
  {
    id: 'astronauta',
    name: 'Astronauta',
    slot: 'body',
    front(g, A) {
      bodyShape(g, A, P.white);
      g.ellipse(A.cx, A.bodyY + A.bodyRy - 1, A.bodyRx - 1, 1.2, P.cloud);
      g.rect(A.cx - 2, A.bodyY - 2, 5, 3, P.shade);
      g.set(A.cx - 1, A.bodyY - 1, P.red);
      g.set(A.cx + 1, A.bodyY - 1, P.cyan);
      g.rect(A.cx - A.bodyRx + 2, A.neckY, (A.bodyRx - 2) * 2 + 1, 1, P.cyan);
      g.set(A.cx + A.bodyRx - 3, A.bodyY + 2, P.pink);
    }
  },
  {
    id: 'maid',
    name: 'Maid',
    slot: 'body',
    front(g, A) {
      bodyShape(g, A, P.night);
      g.ellipse(A.cx, A.bodyY + 1, Math.max(3, A.bodyRx - 4), A.bodyRy - 2, P.white);
      for (let x = A.cx - A.bodyRx + 1; x <= A.cx + A.bodyRx - 1; x += 2) g.set(x, A.neckY, P.white);
      g.rect(A.cx - 1, A.neckY + 1, 3, 1, P.pink);
      g.set(A.cx, A.neckY + 2, P.pinkDark);
      for (let x = A.cx - A.bodyRx + 2; x <= A.cx + A.bodyRx - 2; x += 2) g.set(x, A.bodyY + A.bodyRy - 1, P.cloud);
    }
  },
  {
    id: 'sueter',
    name: 'Suéter listrado',
    slot: 'body',
    front(g, A) {
      const tmp = [];
      for (let y = Math.floor(A.bodyY - A.bodyRy); y <= A.bodyY + A.bodyRy - 2; y++) tmp.push(y);
      tmp.forEach((y) => {
        const dy = (y - A.bodyY) / A.bodyRy;
        const half = Math.floor(A.bodyRx * Math.sqrt(Math.max(0, 1 - dy * dy)));
        const color = Math.floor((y - A.bodyY) / 2) % 2 === 0 ? '#3f8f7a' : '#f3e2c4';
        g.rect(A.cx - half, y, half * 2 + 1, 1, color);
      });
      g.rect(A.cx - 3, A.neckY, 7, 1, '#2f6f62');
    }
  },
  {
    id: 'capa',
    name: 'Capa de maestro',
    slot: 'back',
    back(g, A) {
      const top = A.neckY - 1;
      const bottom = A.bodyY + A.bodyRy + 1;
      for (let y = top; y <= bottom; y++) {
        const t = (y - top) / (bottom - top);
        const half = Math.round(A.bodyRx - 1 + t * 4);
        g.rect(A.cx - half, y, half * 2 + 1, 1, P.night);
        g.set(A.cx - half, y, P.red);
        g.set(A.cx + half, y, P.red);
      }
    },
    front(g, A) {
      g.rect(A.cx - 4, A.neckY, 9, 1, P.night);
      g.rect(A.cx - 1, A.neckY, 3, 1, P.gold);
      g.set(A.cx, A.neckY + 1, P.goldDark);
    }
  },
  {
    id: 'cachecol',
    name: 'Cachecol',
    slot: 'neck',
    front(g, A) {
      const half = A.bodyRx - 2;
      for (let x = A.cx - half; x <= A.cx + half; x++) {
        const c = Math.floor((x - A.cx + half) / 2) % 2 === 0 ? P.pink : P.white;
        g.set(x, A.neckY, c);
        g.set(x, A.neckY + 1, c);
      }
      for (let y = 1; y <= 5; y++) {
        const c = y % 2 === 0 ? P.white : P.pink;
        g.rect(A.cx + 2, A.neckY + 1 + y, 2, 1, c);
      }
      g.set(A.cx + 2, A.neckY + 7, P.pinkDark);
      g.set(A.cx + 3, A.neckY + 7, P.pinkDark);
    }
  },
  {
    id: 'gravata',
    name: 'Gravata borboleta',
    slot: 'neck',
    front(g, A) {
      g.map(
        ['rr...kk...rr', 'rrr..kk..rrr', 'rrrr.kk.rrrr', '.rrr.kk.rrr.', '..rr.kk.rr..'],
        { r: P.red, k: P.gold },
        center(A, 12),
        A.neckY - 1
      );
      g.set(A.cx, A.neckY + 1, P.goldDark);
    }
  },
  {
    id: 'coleira',
    name: 'Coleira com sininho',
    slot: 'neck',
    front(g, A) {
      const half = A.bodyRx - 3;
      g.rect(A.cx - half, A.neckY, half * 2 + 1, 1, P.red);
      g.map(['.g.', 'ggg', 'gdg', '.d.'], { g: P.gold, d: P.goldDark }, center(A, 3), A.neckY + 1);
    }
  },
  {
    id: 'oculos',
    name: 'Óculos redondos',
    slot: 'face',
    outline: false,
    front(g, A) {
      const lens = ['.ooo.', 'o...o', 'o...o', 'o...o', '.ooo.'];
      const pal = { o: P.pink };
      g.map(lens, pal, Math.round(A.eyeLX) - 2, Math.round(A.eyeY) - 2);
      g.map(lens, pal, Math.round(A.eyeRX) - 2, Math.round(A.eyeY) - 2);
      for (let x = Math.round(A.eyeLX) + 3; x <= Math.round(A.eyeRX) - 3; x++) g.set(x, Math.round(A.eyeY) - 1, P.pink);
    }
  },
  {
    id: 'oculos-coracao',
    name: 'Óculos de coração',
    slot: 'face',
    outline: false,
    front(g, A) {
      const heart = ['hh.hh', 'hhhhh', 'hhhhh', '.hhh.', '..h..'];
      const pal = { h: P.red };
      g.map(heart, pal, Math.round(A.eyeLX) - 2, Math.round(A.eyeY) - 2);
      g.map(heart, pal, Math.round(A.eyeRX) - 2, Math.round(A.eyeY) - 2);
      g.set(Math.round(A.eyeLX) - 1, Math.round(A.eyeY) - 1, P.white);
      g.set(Math.round(A.eyeRX) - 1, Math.round(A.eyeY) - 1, P.white);
      for (let x = Math.round(A.eyeLX) + 3; x <= Math.round(A.eyeRX) - 3; x++) g.set(x, Math.round(A.eyeY) - 1, P.pinkDark);
    }
  },
  {
    id: 'estrelinha',
    name: 'Estrelinha',
    slot: 'ear',
    front(g, A) {
      g.map(['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.'], { y: P.gold }, A.earRX - 2, A.headTop - 2);
      g.set(A.earRX - 1, A.headTop, P.white);
    }
  },
  {
    id: 'lacinho',
    name: 'Lacinho',
    slot: 'ear',
    front(g, A) {
      g.map(['pp...pp', 'pppkppp', 'pppkppp', 'pp...pp'], { p: P.pink, k: P.pinkDark }, A.earLX - 3, A.headTop - 1);
      g.set(A.earLX - 2, A.headTop, P.rose);
    }
  },
  {
    id: 'flor',
    name: 'Florzinha',
    slot: 'ear',
    front(g, A) {
      g.map(['.pp.', 'pyyp', 'pyyp', '.pp.', '..ll', '...l'], { p: P.rose, y: P.gold, l: P.green }, A.earLX - 2, A.headTop - 2);
    }
  },
  {
    id: 'capacete',
    name: 'Capacete espacial',
    slot: 'head',
    front(g, A) {
      const top = A.earTopY - 1;
      const bottom = A.neckY + 1;
      const cy = (top + bottom) / 2;
      const ry = (bottom - top) / 2;
      const rx = (A.headR - A.headL) / 2 + 1.5;
      g.ellipse(A.cx, cy, rx - 1, ry - 1, P.glass);
      g.ring(A.cx, cy, rx, ry, 1.2, P.glassEdge);
      g.points([[A.cx - rx + 3, cy - 3], [A.cx - rx + 3, cy - 4], [A.cx - rx + 4, cy - 5]], P.white);
      g.rect(A.cx - Math.round(rx) + 2, bottom, Math.round(rx) * 2 - 3, 1, P.shade);
    }
  },
  {
    id: 'chapeu-bruxa',
    name: 'Chapéu de bruxa',
    slot: 'head',
    front(g, A) {
      g.map(
        [
          '..........pp...',
          '.........ppp...',
          '........pppp...',
          '.......ppppp...',
          '......pppppp...',
          '.....ppppppp...',
          '....pppppppp...',
          '....kkkkkkkkk..',
          'ppppppppppppppp',
          '.ppppppppppppp.'
        ],
        { p: P.purpleDark, k: P.pink },
        center(A, 15),
        A.headTop - 9
      );
      g.set(A.cx + 1, A.headTop - 2, P.gold);
    }
  },
  {
    id: 'coroa',
    name: 'Coroa',
    slot: 'head',
    front(g, A) {
      g.map(['g...g...g', 'gg.ggg.gg', 'ggggggggg', 'grgcgrgcg', 'ddddddddd'], { g: P.gold, r: P.red, c: P.cyan, d: P.goldDark }, center(A, 9), A.headTop - 4);
    }
  },
  {
    id: 'fone',
    name: 'Fone de ouvido',
    slot: 'head',
    front(g, A) {
      const top = A.headTop - 1;
      for (let x = A.headL + 2; x <= A.headR - 2; x++) g.set(x, top, P.purple);
      g.set(A.headL + 1, top + 1, P.purple);
      g.set(A.headR - 1, top + 1, P.purple);
      for (let y = top + 2; y < A.eyeY - 1; y++) {
        g.set(A.headL, y, P.purple);
        g.set(A.headR, y, P.purple);
      }
      g.rect(A.headL - 2, A.eyeY - 1, 3, 4, P.pink);
      g.rect(A.headR, A.eyeY - 1, 3, 4, P.pink);
      g.set(A.headL - 1, A.eyeY, P.rose);
      g.set(A.headR + 1, A.eyeY, P.rose);
    }
  },
  {
    id: 'chapeu-festa',
    name: 'Chapéu de festa',
    slot: 'head',
    front(g, A) {
      g.map(['...y...', '..yyy..', '...c...', '..ccp..', '..cpp..', '.ccppc.', '.cppcc.', 'ppccppc'], { y: P.gold, c: P.cyan, p: P.pink }, center(A, 7), A.headTop - 7);
    }
  },
  {
    id: 'boina',
    name: 'Boina de artista',
    slot: 'head',
    front(g, A) {
      g.map(['.......s...', '..bbbbbbb..', '.bbbbbbbbbb', 'bbbbbbbbbbb', '.ddddddddd.'], { s: P.purpleDark, b: P.red, d: '#b31f4a' }, center(A, 11) + 1, A.headTop - 4);
    }
  },
  {
    id: 'batuta',
    name: 'Batuta',
    slot: 'hand',
    front(g, A) {
      const x = A.handX;
      const y = A.handY;
      for (let i = 2; i <= 9; i++) g.set(x + Math.round(i * 0.6), y - i, P.white);
      g.rect(x, y - 1, 2, 2, P.brown);
      g.set(x + 6, y - 10, P.gold);
    }
  },
  {
    id: 'microfone',
    name: 'Microfone',
    slot: 'hand',
    front(g, A) {
      g.map(['.sss.', 'sgsgs', 'sssss', '.sss.', '..d..', '..d..', '..d..', '..d..'], { s: P.cloud, g: P.shade, d: P.night }, A.handX - 1, A.handY - 7);
      g.set(A.handX + 1, A.handY - 4, P.pink);
    }
  }
];

// Acessórios extras usados só pelos efeitos do Beat Cats (não entram nas 20 roupinhas do Meu Gato).
export const BONUS_OUTFITS = [
  {
    id: 'harpa',
    name: 'Harpa',
    slot: 'hand',
    front(g, A) {
      g.rect(A.handX - 1, A.handY - 8, 4, 9, P.gold);
      g.set(A.handX, A.handY - 9, P.goldDark);
      g.set(A.handX + 2, A.handY - 4, P.white);
      g.set(A.handX + 1, A.handY - 6, P.cyan);
    }
  },
  {
    id: 'raio',
    name: 'Raio',
    slot: 'head',
    front(g, A) {
      g.map(['..y', '.yy', 'yyy', 'yy.', '.y.'], { y: P.gold }, A.cx + 4, A.headTop - 6);
    }
  },
  {
    id: 'bolha',
    name: 'Bolha',
    slot: 'hand',
    outline: false,
    front(g, A) {
      g.ring(A.handX + 1, A.handY - 4, 3.2, 3.2, 1.1, P.cyan);
      g.set(A.handX, A.handY - 5, P.white);
    }
  },
  {
    id: 'cristal',
    name: 'Cristal',
    slot: 'head',
    front(g, A) {
      g.tri([A.cx - 3, A.headTop], [A.cx, A.headTop - 6], [A.cx + 3, A.headTop], P.cyan);
      g.set(A.cx, A.headTop - 3, P.white);
    }
  },
  {
    id: 'antena',
    name: 'Antena alien',
    slot: 'head',
    front(g, A) {
      for (let i = 1; i <= 5; i++) {
        g.set(A.cx - 3 - Math.floor(i / 2), A.headTop - i, P.shade);
        g.set(A.cx + 3 + Math.floor(i / 2), A.headTop - i, P.shade);
      }
      g.rect(A.cx - 6, A.headTop - 7, 2, 2, P.green);
      g.rect(A.cx + 5, A.headTop - 7, 2, 2, P.green);
    }
  },
  {
    id: 'asas',
    name: 'Asinhas',
    slot: 'back',
    back(g, A) {
      const wing = ['....www', '..wwwcw', '.wwwcww', 'wwwcww.', 'wwcww..', '.www...', '..w....'];
      const pal = { w: P.white, c: P.cyan };
      g.map(wing, pal, A.cx - A.bodyRx - 5, A.neckY - 3);
      g.map(wing.map((r) => [...r].reverse().join('')), pal, A.cx + A.bodyRx - 1, A.neckY - 3);
    }
  },
  {
    id: 'visor',
    name: 'Visor neon',
    slot: 'face',
    outline: false,
    front(g, A) {
      const x = Math.round(A.eyeLX) - 3;
      const w = Math.round(A.eyeRX) - Math.round(A.eyeLX) + 7;
      const y = Math.round(A.eyeY) - 1;
      g.rect(x, y, w, 3, 'rgba(95, 243, 255, 0.78)');
      g.rect(x, y - 1, w, 1, P.pink);
      g.rect(x, y + 3, w, 1, P.pinkDark);
      g.set(x + 2, y, P.white);
    }
  },
  {
    id: 'aureola',
    name: 'Auréola',
    slot: 'head',
    outline: false,
    front(g, A) {
      g.ring(A.cx, A.headTop - 4, 5.5, 1.8, 1, P.gold);
      g.points([[A.cx - 7, A.headTop - 6], [A.cx + 7, A.headTop - 7], [A.cx + 1, A.headTop - 8]], P.white);
    }
  }
];

export const OUTFIT_BY_ID = Object.fromEntries([...OUTFITS, ...BONUS_OUTFITS].map((o) => [o.id, o]));
export const OUTLINE = OUT;
