// Ícones em pixel art para os cards do Hub e botões. Desenhados à mão como mapas de caracteres.
import { iconSVG } from './pixel.js';

const C = {
  p: '#ff4fd8',
  v: '#9b5cff',
  c: '#5ff3ff',
  y: '#ffd23f',
  w: '#f4f1ff',
  d: '#2a1846',
  g: '#5dff9b',
  o: '#f28a3b',
  k: '#120a1c',
  r: '#ff3d6e'
};

const MAPS = {
  airpads: [
    '............',
    '.pppp..cccc.',
    '.pwwp..cwwc.',
    '.pwwp..cwwc.',
    '.pppp..cccc.',
    '............',
    '.vvvv..yyyy.',
    '.vwwv..ywwy.',
    '.vwwv..ywwy.',
    '.vvvv..yyyy.',
    '............',
    '............'
  ],
  beatcats: [
    '.v........v.',
    '.vv......vv.',
    '.vvv....vvv.',
    '.vvvvvvvvvv.',
    'vvcvvvvvvcvv',
    'vvkvvvvvvkvv',
    'vvvvvppvvvvv',
    '.vvvvvvvvvv.',
    '..pppppppp..',
    '..pwwpwwpp..',
    '..pppppppp..',
    '............'
  ],
  studio: [
    '....cccc....',
    '...cwcwcc...',
    '...ccwcwc...',
    '...cwcwcc...',
    '...cccccc...',
    '....cccc....',
    '..v..pp..v..',
    '..vv.pp.vv..',
    '...vvppvv...',
    '.....pp.....',
    '...pppppp...',
    '............'
  ],
  gallery: [
    'yyyyyyyyyyyy',
    'ykkkkkkkkkky',
    'ykccccccccky',
    'ykcccccwccky',
    'ykccccccccky',
    'ykcccgcccccy',
    'ykccgggcccky',
    'ykcgggggpcky',
    'ykgggggpppky',
    'ykkkkkkkkkky',
    'yyyyyyyyyyyy',
    '............'
  ],
  termo: [
    'ggggg.yyyyy.',
    'gwwwg.ywwwy.',
    'gwgwg.yywyy.',
    'gwwwg.yywyy.',
    'ggggg.yyyyy.',
    '............',
    'vvvvv.ppppp.',
    'vwwwv.pwwwp.',
    'vwvvv.pwpwp.',
    'vwwwv.pwwwp.',
    'vvvvv.ppppp.',
    '............'
  ],
  conexoes: [
    '............',
    '.ppp....ccc.',
    '.pwp....cwc.',
    '.pppwwwwccc.',
    '..w......w..',
    '..w......w..',
    '..w......w..',
    '.yyywwwwvvv.',
    '.ywy....vwv.',
    '.yyy....vvv.',
    '............',
    '............'
  ],
  cattyping: [
    'c....w.....c',
    '.o........o.',
    '.oo......oo.',
    '.okokwwkoko.',
    '.oooooooooo.',
    '.....cc.....',
    '.....cc.....',
    '...yyyyyy...',
    '..ywwywwyy..',
    '...yyyyyy...',
    'w.....w...w.',
    '............'
  ],
  mycat: [
    '.o........o.',
    '.oo......oo.',
    '.opo....opo.',
    '.oooooooooo.',
    'oooooooooooo',
    'oogkooookgoo',
    'oogkooookgoo',
    'oooooppooooo',
    'oooowkkwoooo',
    '.oooooooooo.',
    '..oooooooo..',
    '............'
  ],
  note: [
    '....pppp',
    '....pppp',
    '....p..p',
    '....p..p',
    '....p..p',
    '.ppp.ppp',
    'pppppppp',
    '.ppp.ppp'
  ],
  disk: [
    'wwwwwwww.',
    'wkkkkkkww',
    'wkkkkkkkw',
    'wwwwwwwww',
    'wwwwwwwww',
    'wwkkkkkww',
    'wwkwwwkww',
    'wwkkkkkww',
    'wwwwwwwww'
  ],
  heart: ['.pp.pp.', 'ppppppp', 'ppppppp', '.ppppp.', '..ppp..', '...p...']
};

export function icon(name, size = 48, color) {
  const pal = color ? { ...C, p: color } : C;
  return iconSVG(MAPS[name] || MAPS.note, pal, { size, title: name });
}
