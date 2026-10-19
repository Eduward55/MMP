// Tetris fofo: peças nas cores do gato, WASD / setas.
import { creatureSVG } from '../shared/creatures.js';
import { getProfile, kv } from '../shared/store.js';
import { el, toast } from '../shared/ui.js';

const COLS = 10;
const ROWS = 20;
const KEY = 'tetris';
const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ]
};
const COLORS = {
  I: '#38bdf8',
  O: '#fbbf24',
  T: '#c4b5fd',
  S: '#4ade80',
  Z: '#fb7185',
  J: '#60a5fa',
  L: '#fb923c'
};
const NAMES = Object.keys(SHAPES);

function rotate(m) {
  const h = m.length;
  const w = m[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x][h - 1 - y] = m[y][x];
  return out;
}

function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

export default {
  id: 'tetris',
  title: 'Tetris',
  icon: 'tetris',
  accent: '#38bdf8',
  desc: 'Peças caindo no estilo gato. Setas ou WASD para jogar.',
  hideDock: true,
  async mount(root) {
    const profile = getProfile();
    const saved = (await kv.get(KEY).catch(() => null)) || {};
    let best = Number(saved.best) || 0;
    let grid = emptyGrid();
    let piece = null;
    let nextId = NAMES[Math.floor(Math.random() * NAMES.length)];
    let score = 0;
    let lines = 0;
    let level = 1;
    let over = false;
    let paused = false;
    let dropMs = 700;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let alive = true;
    let particles = [];
    let flashRows = [];
    let combo = 0;
    let comboText = '';
    let comboT = 0;
    let shake = 0;

    const canvas = el('canvas', { class: 'tz-canvas', width: '300', height: '600' });
    const ctx = canvas.getContext('2d');
    const nextBox = el('div', { class: 'tz-next' });
    const nums = el('div', { class: 'tz-stats' });
    const overlay = el('div', { class: 'tz-overlay', hidden: true });
    const mascot = el(
      'div',
      { class: 'tz-mascot' },
      el('span', { html: creatureSVG('cat', profile.cat, { size: 88, extraClass: 'is-idle', label: profile.cat.name }) }),
      el('span', { html: creatureSVG('otter', profile.otter, { size: 70, extraClass: 'is-dancing', label: profile.otter.name }) })
    );
    const pauseBtn = el('button', { class: 'btn btn--primary', onclick: () => togglePause() }, 'Pausar');
    const newBtn = el('button', { class: 'btn btn--ghost', onclick: () => newGame() }, 'Nova partida');

    root.append(
      el(
        'section',
        { class: 'tz' },
        el(
          'aside',
          { class: 'panel tz-hud' },
          el('h2', {}, 'Tetris do gato'),
          mascot,
          nums,
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Próxima'), nextBox),
          el('div', { class: 'row-actions' }, pauseBtn, newBtn),
          el('p', { class: 'hint' }, '← → ou A D andam. ↑ / W gira. ↓ / S acelera. Espaço cai de uma vez. Esc pausa.')
        ),
        el('div', { class: 'tz-stage panel' }, canvas, overlay)
      )
    );

    function spawn() {
      const id = nextId;
      nextId = NAMES[Math.floor(Math.random() * NAMES.length)];
      piece = { id, m: SHAPES[id].map((r) => [...r]), x: 3, y: 0 };
      if (collides(piece.m, piece.x, piece.y)) {
        over = true;
        paused = false;
        toast(`Fim de jogo · ${score} pontos`, 'info');
        showOverlay();
      }
      paintNext();
    }

    function collides(m, x, y) {
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          const gx = x + c;
          const gy = y + r;
          if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
          if (gy >= 0 && grid[gy][gx]) return true;
        }
      }
      return false;
    }

    function merge() {
      piece.m.forEach((row, r) =>
        row.forEach((v, c) => {
          if (!v) return;
          const gy = piece.y + r;
          const gx = piece.x + c;
          if (gy >= 0) grid[gy][gx] = piece.id;
        })
      );
    }

    function burst(row, color) {
      for (let i = 0; i < 18; i++) {
        particles.push({
          x: Math.random() * COLS,
          y: row + Math.random(),
          vx: (Math.random() - 0.5) * 8,
          vy: -2 - Math.random() * 4,
          life: 0.45 + Math.random() * 0.25,
          color
        });
      }
    }

    function ghostY() {
      if (!piece) return 0;
      let y = piece.y;
      while (!collides(piece.m, piece.x, y + 1)) y++;
      return y;
    }

    function clearLines() {
      let n = 0;
      const gone = [];
      grid = grid.filter((row, y) => {
        if (row.every(Boolean)) {
          n++;
          gone.push(y);
          burst(y, COLORS[row.find(Boolean)]);
          return false;
        }
        return true;
      });
      while (grid.length < ROWS) grid.unshift(Array(COLS).fill(0));
      if (n) {
        combo += 1;
        flashRows = gone;
        shake = 0.18;
        const names = ['', 'Linha!', 'Dupla!', 'Tripla!', 'TETRIS!'];
        comboText = combo > 1 ? `Combo x${combo} · ${names[n]}` : names[n];
        comboT = 0.9;
        lines += n;
        score += [0, 100, 300, 500, 800][n] * level * (combo > 1 ? combo : 1);
        level = 1 + Math.floor(lines / 10);
        dropMs = Math.max(120, 700 - (level - 1) * 50);
        if (score > best) best = score;
      } else combo = 0;
    }

    function move(dx, dy) {
      if (!piece || over || paused) return false;
      if (!collides(piece.m, piece.x + dx, piece.y + dy)) {
        piece.x += dx;
        piece.y += dy;
        return true;
      }
      if (dy > 0) {
        merge();
        clearLines();
        spawn();
        hud();
      }
      return false;
    }

    function spin() {
      if (!piece || over || paused) return;
      const m = rotate(piece.m);
      if (!collides(m, piece.x, piece.y)) piece.m = m;
      else if (!collides(m, piece.x - 1, piece.y)) {
        piece.x -= 1;
        piece.m = m;
      } else if (!collides(m, piece.x + 1, piece.y)) {
        piece.x += 1;
        piece.m = m;
      }
    }

    function hardDrop() {
      if (!piece || over || paused) return;
      while (move(0, 1)) {}
    }

    function cell(x, y, color, alpha = 1) {
      const w = canvas.width / COLS;
      const h = canvas.height / ROWS;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x * w + 1, y * h + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x * w + 3, y * h + 3, 6, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x * w + 1, y * h + h - 6, w - 2, 4);
      ctx.globalAlpha = 1;
    }

    function draw() {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0f0f12';
      const line = getComputedStyle(document.documentElement).getPropertyValue('--hairline').trim() || '#2a2a32';
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cw = canvas.width / COLS;
      const ch = canvas.height / ROWS;
      ctx.strokeStyle = line;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cw, 0);
        ctx.lineTo(x * cw, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * ch);
        ctx.lineTo(canvas.width, y * ch);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (grid[y][x]) cell(x, y, COLORS[grid[y][x]]);
        }
      }
      flashRows.forEach((y) => {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(0, y * ch, canvas.width, ch);
      });
      if (piece) {
        const gy = ghostY();
        piece.m.forEach((row, r) =>
          row.forEach((v, c) => {
            if (v) cell(piece.x + c, gy + r, COLORS[piece.id], 0.22);
          })
        );
        piece.m.forEach((row, r) =>
          row.forEach((v, c) => {
            if (v) cell(piece.x + c, piece.y + r, COLORS[piece.id]);
          })
        );
      }
      particles.forEach((p) => {
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x * cw, p.y * ch, 4, 4);
      });
      ctx.globalAlpha = 1;
      if (comboT > 0 && comboText) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, comboT * 2)})`;
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comboText, canvas.width / 2, 48);
      }
      ctx.restore();
    }

    function paintNext() {
      nextBox.innerHTML = '';
      const m = SHAPES[nextId];
      const g = el('div', { class: 'tz-mini', style: `--w:${m[0].length};--h:${m.length}` });
      m.forEach((row) =>
        row.forEach((v) => g.append(el('i', { style: v ? `background:${COLORS[nextId]}` : 'background:transparent' })))
      );
      nextBox.append(g);
    }

    function hud() {
      nums.innerHTML = '';
      [
        ['Pontos', score],
        ['Linhas', lines],
        ['Nível', level],
        ['Recorde', Math.max(best, score)]
      ].forEach(([k, v]) => nums.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k))));
      pauseBtn.textContent = paused ? 'Continuar' : 'Pausar';
      pauseBtn.disabled = over;
    }

    function showOverlay() {
      if (over) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(el('h2', {}, 'Fim de jogo'), el('p', {}, `${score} pontos · ${lines} linhas`), el('button', { class: 'btn btn--primary', onclick: () => newGame() }, 'De novo'));
      } else if (paused) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(el('h2', {}, 'Pausa'), el('p', {}, 'Esc continua.'));
      } else overlay.hidden = true;
    }

    function togglePause() {
      if (over) return;
      paused = !paused;
      showOverlay();
      hud();
    }

    function newGame() {
      grid = emptyGrid();
      score = 0;
      lines = 0;
      level = 1;
      dropMs = 700;
      over = false;
      paused = false;
      spawn();
      hud();
      showOverlay();
    }

    function persist() {
      return kv.set(KEY, { best: Math.max(best, score) }).catch(() => {});
    }

    function loop(ts) {
      if (!alive) return;
      if (!last) last = ts;
      const dt = ts - last;
      last = ts;
      const sec = dt / 1000;
      if (!paused && !over) {
        acc += dt;
        if (acc >= dropMs) {
          acc = 0;
          move(0, 1);
        }
      }
      particles.forEach((p) => {
        p.x += p.vx * sec;
        p.y += p.vy * sec;
        p.vy += 12 * sec;
        p.life -= sec;
      });
      particles = particles.filter((p) => p.life > 0);
      if (comboT > 0) comboT -= sec;
      if (shake > 0) shake -= sec;
      if (flashRows.length && comboT < 0.7) flashRows = [];
      draw();
      raf = requestAnimationFrame(loop);
    }

    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.matches('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (over || paused) return;
      if (k === 'arrowleft' || k === 'a') {
        e.preventDefault();
        move(-1, 0);
      } else if (k === 'arrowright' || k === 'd') {
        e.preventDefault();
        move(1, 0);
      } else if (k === 'arrowdown' || k === 's') {
        e.preventDefault();
        move(0, 1);
      } else if (k === 'arrowup' || k === 'w') {
        e.preventDefault();
        spin();
      } else if (k === ' ') {
        e.preventDefault();
        hardDrop();
      }
    };
    window.addEventListener('keydown', onKey);
    newGame();
    raf = requestAnimationFrame(loop);

    window.__mmpTetris = {
      state: () => ({ score, lines, level, over, paused, piece: piece && { id: piece.id, x: piece.x, y: piece.y }, filled: grid.flat().filter(Boolean).length }),
      move,
      rotate: spin,
      drop: hardDrop,
      tick: () => move(0, 1),
      newGame
    };

    return {
      async save() {
        await persist();
        return `Recorde local: ${Math.max(best, score)} pontos.`;
      },
      unmount() {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        persist();
        if (window.__mmpTetris) delete window.__mmpTetris;
      }
    };
  }
};
