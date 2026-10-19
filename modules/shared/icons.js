// Ícones em pixel art para os cards do Hub e botões. Desenhados à mão como mapas de caracteres.
import { iconSVG } from './pixel.js';

const C = {
  p: '#7c9cff',
  v: '#38bdf8',
  c: '#d4d4d8',
  y: '#fbbf24',
  w: '#f8fafc',
  d: '#27272a',
  g: '#4ade80',
  o: '#fb923c',
  k: '#0f0f12',
  r: '#f87171',
  n: '#94a3b8',
  b: '#2563eb',
  s: '#64748b',
  m: '#f472b6'
};

const MAPS = {
  airpads: [
    '............',
    '..vvvv..oooo',
    '.vwwvv.owwoo',
    '.vwwv..owwo.',
    '..vv....oo..',
    '............',
    '..pppp..yyyy',
    '.pwwpp.pyyww',
    '.pwwp..pyyw.',
    '..pp....yy..',
    '............',
    '............'
  ],
  beatcats: [
    '.o........o.',
    '.oo......oo.',
    '.ooo....ooo.',
    '.oooooooooo.',
    'oowooooooowo',
    'ookooooookoo',
    'ooooommooooo',
    '.oooooooooo.',
    '..yyyyyyyy..',
    '..ywwywwyy..',
    '..yyyyyyyy..',
    '............'
  ],
  studio: [
    'kkkkkkkkkkkk',
    'kwkwkwkwkwkk',
    'kwkwkwkwkwkk',
    'kwwwwwwwwwwk',
    'kwwwwwwwwwwk',
    'kwwwwwwwwwwk',
    'kkkkkkkkkkkk',
    '....nnnn....',
    '...nnnnnn...',
    '..nnoooonn..',
    '...nnnnnn...',
    '............'
  ],
  gallery: [
    'nnnnnnnnnnnn',
    'nkkkkkkkkkkn',
    'nkwwwwwwwwkn',
    'nkwwvwvwwwkn',
    'nkwvvvvwwwkn',
    'nkggvvvvgwkn',
    'nkgggggggokn',
    'nkgggggoookn',
    'nkoooyyyookn',
    'nkkkkkkkkkkn',
    'nnnnnnnnnnnn',
    '............'
  ],
  termo: [
    'ggggg.yyyyy.',
    'gwwwg.ykkky.',
    'gwgwg.ykwky.',
    'gwwwg.ykkky.',
    'ggggg.yyyyy.',
    '............',
    'nnnnn.ppppp.',
    'nwwwk.pwwwp.',
    'nwwnn.pwpwp.',
    'nwwwk.pwwwp.',
    'nnnnn.ppppp.',
    '............'
  ],
  conexoes: [
    '............',
    '.yyy....ggg.',
    '.ywy....gwg.',
    '.yyy....ggg.',
    '..n......n..',
    '..nnnnnnnn..',
    '..n......n..',
    '.vvv....ooo.',
    '.vwv....owo.',
    '.vvv....ooo.',
    '............',
    '............'
  ],
  cattyping: [
    '...nnnnnn...',
    '..nnwwwwwnn.',
    '.nnwwkkwwwn.',
    '.nwwkkkkwwk.',
    '..nwwwwwwk..',
    '...nnoonn...',
    '....noo.....',
    '...yyyyyy...',
    '..ywwywwyy..',
    '...yyyyyy...',
    '.r.....v...r',
    '............'
  ],
  cantar: [
    '............',
    '....nnnn....',
    '...nwwwwwn..',
    '..nwkkkkwn..',
    '..nwwwwkwn..',
    '...nnnnnn...',
    '.....nn.....',
    '....oooo....',
    '...oowwoo...',
    '...oooooo...',
    '..mm....mm..',
    '............'
  ],
  tetris: [
    '..pppppp....',
    '..pppppp....',
    '....pp......',
    'oooo..yyyy..',
    'oooo..yyyy..',
    'gggggg..vv..',
    'gggggg..vv..',
    '....rrrrrr..',
    '....rrrrrr..',
    '..oooooooo..',
    '..oowwoo....',
    '............'
  ],
  corrida: [
    '............',
    '....oooo....',
    '...oooooo...',
    '..oowwwoo...',
    '..oooooooo..',
    '..nnoooonn..',
    'nn......nn..',
    '..yyyyyyyy..',
    '.ywwywwyy...',
    '..yyyyyy....',
    '.r......v...',
    '............'
  ],
  mycat: [
    '.o........o.',
    '.oo......oo.',
    '.omo....omo.',
    '.oooooooooo.',
    'oooooooooooo',
    'oogkooookgoo',
    'oogkooookgoo',
    'ooooommooooo',
    'oooowkkwoooo',
    '.oooooooooo.',
    '..oooooooo..',
    '............'
  ],
  note: [
    '....vvvv',
    '....vvvv',
    '....v..v',
    '....v..v',
    '....v..v',
    '.yyy.yyy',
    'yyyyyyyy',
    '.yyy.yyy'
  ],
  disk: [
    '.nnnnnnnn',
    'nkkkkkknn',
    'nkwkwkwkn',
    'nwwwwwwwn',
    'nwwwwwkwn',
    'nwwwwwkwn',
    'nkkkkkknn',
    'nkwwwwkkn',
    '.nnnnnnnn'
  ],
  tips: [
    '...yyyy...',
    '..ywwwwy..',
    '.ywwkkwwy.',
    '.ywkkkkwy.',
    '..ywwwwy..',
    '...yyyy...',
    '....nn....',
    '....nn....',
    '...nnnn...',
    '....nn....'
  ],
  palette: [
    '..rrr.ggg..',
    '.rrrrrgggg.',
    '.rrryygggv.',
    '..ryyyyvvv.',
    '...yyyyvv..',
    '..ooooovv..',
    '.oooo..pp.',
    '.ooo....p.',
    '..nnnnnn..',
    '...nnnn...'
  ],
  heart: ['.mm.mm.', 'mmmmmmm', 'mmmmmmm', '.mmmmm.', '..mmm..', '...m...']
};

export function icon(name, size = 48, color) {
  const pal = color ? { ...C, p: color } : C;
  return iconSVG(MAPS[name] || MAPS.note, pal, { size, title: name });
}
