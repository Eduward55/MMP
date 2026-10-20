// Tetris fofo: peças nas cores do gato, WASD / setas, chiptune baixinho.
import { createTetrisKit } from '../shared/audio.js';
import { creatureSVG } from '../shared/creatures.js';
import { getProfile, kv } from '../shared/store.js';
import { el, startAudio, toast } from '../shared/ui.js';
import { t } from '../shared/i18n.js';

const COLS = 10;
const ROWS = 20;
const KEY = 'tetris';
const VOL_DEFAULT = 70;
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

function clampVolume(n, fallback = VOL_DEFAULT) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
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
    let volume = clampVolume(saved.volume, VOL_DEFAULT);
    let sound = saved.sound !== false;
    if (volume <= 0) sound = false;
    let chip = null;
    let boot = null;
    let grid = emptyGrid();
    let piece = null;
    let nextId = NAMES[Math.floor(Math.random() * NAMES.length)];
    let holdId = null;
    let canHold = true;
    let stars = [];
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
    const holdBox = el('div', { class: 'tz-next tz-hold' });
    const nums = el('div', { class: 'tz-stats' });
    const overlay = el('div', { class: 'tz-overlay', hidden: true });
    const mascot = el(
      'div',
      { class: 'tz-mascot' },
      el('span', { html: creatureSVG('cat', profile.cat, { size: 88, extraClass: 'is-idle', label: profile.cat.name }) }),
      el('span', { html: creatureSVG('otter', profile.otter, { size: 70, extraClass: 'is-dancing', label: profile.otter.name }) })
    );
    const pauseBtn = el('button', { class: 'btn btn--primary', onclick: () => { armAudio(); togglePause(); } }, t('common.pause'));
    const newBtn = el('button', { class: 'btn btn--ghost', onclick: () => { armAudio(); newGame(); } }, 'Nova partida');
    const soundBtn = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => toggleSound() }, '');
    const volInput = el('input', {
      class: 'range tz-vol',
      type: 'range',
      min: '0',
      max: '100',
      step: '1',
      value: String(volume),
      'aria-label': 'Volume',
      oninput: (e) => setVolume(e.target.value)
    });
    const soundRow = el('div', { class: 'tz-sound' }, soundBtn, volInput);

    root.append(
      el(
        'section',
        { class: 'tz' },
        el(
          'aside',
          { class: 'panel tz-hud' },
          el('h2', {}, t('tz.title')),
          mascot,
          nums,
          el(
            'div',
            { class: 'tz-previews' },
            el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('tz.hold')), holdBox),
            el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('tz.next')), nextBox)
          ),
          el('div', { class: 'row-actions' }, pauseBtn, newBtn, soundRow),
          el('p', { class: 'hint' }, t('tz.hint'))
        ),
        el('div', { class: 'tz-stage panel' }, canvas, overlay)
      )
    );

    function liveGain() {
      return sound ? volume / 100 : 0;
    }

    function applyGain() {
      if (chip && typeof chip.setGain === 'function') chip.setGain(liveGain());
    }

    function syncMusic() {
      if (chip && typeof chip.setMusic === 'function') chip.setMusic(Boolean(sound && volume > 0 && !paused && !over));
    }

    function refreshSoundUi() {
      const on = sound && volume > 0;
      soundBtn.textContent = `Som: ${on ? 'ligado' : 'desligado'}`;
      soundBtn.setAttribute('aria-pressed', String(on));
      volInput.value = String(volume);
      volInput.setAttribute('aria-valuenow', String(volume));
      volInput.title = `Volume ${volume}%`;
    }

    async function ensureAudio() {
      if (chip) {
        applyGain();
        syncMusic();
        return chip;
      }
      if (!sound || volume <= 0) return null;
      if (!boot) {
        boot = (async () => {
          try {
            const Tone = await startAudio();
            if (!alive) return null;
            if (chip) {
              applyGain();
              syncMusic();
              return chip;
            }
            const kit = createTetrisKit(Tone, { gain: liveGain(), music: false });
            if (!alive) {
              try {
                kit.dispose();
              } catch {}
              return null;
            }
            chip = kit;
            applyGain();
            syncMusic();
            return chip;
          } catch {
            chip = {
              setGain() {},
              setMusic() {},
              move() {},
              rotate() {},
              soft() {},
              hard() {},
              clear() {},
              level() {},
              over() {},
              dispose() {}
            };
            return chip;
          }
        })();
      }
      return boot;
    }

    function armAudio() {
      ensureAudio().catch(() => {});
    }

    function cue(name, arg) {
      ensureAudio()
        .then((s) => {
          if (s && typeof s[name] === 'function') s[name](arg);
        })
        .catch(() => {});
    }

    function toggleSound() {
      if (sound && volume > 0) sound = false;
      else {
        sound = true;
        if (volume <= 0) volume = VOL_DEFAULT;
        armAudio();
      }
      applyGain();
      syncMusic();
      refreshSoundUi();
      persist();
    }

    function setVolume(n) {
      volume = clampVolume(n, volume);
      sound = volume > 0;
      applyGain();
      syncMusic();
      refreshSoundUi();
      persist();
    }

    function spawn(opts = {}) {
      const id = opts.id || nextId;
      if (!opts.id) nextId = NAMES[Math.floor(Math.random() * NAMES.length)];
      if (!opts.keepHoldLock) canHold = true;
      piece = { id, m: SHAPES[id].map((r) => [...r]), x: 3, y: 0 };
      if (collides(piece.m, piece.x, piece.y)) {
        over = true;
        paused = false;
        cue('over');
        syncMusic();
        toast(`Fim de jogo · ${score} pontos`, 'info');
        showOverlay();
      }
      paintNext();
      paintHold();
    }

    function holdSwap() {
      if (!piece || over || paused || !canHold) return false;
      canHold = false;
      const current = piece.id;
      if (holdId) {
        const swapped = holdId;
        holdId = current;
        spawn({ id: swapped, keepHoldLock: true });
      } else {
        holdId = current;
        spawn({ keepHoldLock: true });
      }
      paintHold();
      hud();
      cue('move');
      return true;
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
        const nextLevel = 1 + Math.floor(lines / 10);
        const leveled = nextLevel > level;
        level = nextLevel;
        dropMs = Math.max(120, 700 - (level - 1) * 50);
        if (score > best) best = score;
        cue('clear', n);
        if (leveled) cue('level');
      } else combo = 0;
    }

    function move(dx, dy, kind) {
      if (!piece || over || paused) return false;
      const mode = kind || (dx !== 0 ? 'shift' : dy > 0 ? 'gravity' : 'shift');
      if (!collides(piece.m, piece.x + dx, piece.y + dy)) {
        piece.x += dx;
        piece.y += dy;
        if (mode === 'shift') cue('move');
        else if (mode === 'soft') cue('soft');
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
      let turned = false;
      if (!collides(m, piece.x, piece.y)) {
        piece.m = m;
        turned = true;
      } else if (!collides(m, piece.x - 1, piece.y)) {
        piece.x -= 1;
        piece.m = m;
        turned = true;
      } else if (!collides(m, piece.x + 1, piece.y)) {
        piece.x += 1;
        piece.m = m;
        turned = true;
      }
      if (turned) cue('rotate');
    }

    function hardDrop() {
      if (!piece || over || paused) return;
      while (move(0, 1, 'hard')) {}
      if (!over) cue('hard');
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

    function ensureStars() {
      if (stars.length) return;
      stars = Array.from({ length: 56 }, () => ({
        x: Math.random(),
        y: Math.random(),
        s: 0.6 + Math.random() * 1.8,
        a: 0.35 + Math.random() * 0.65,
        tw: Math.random() * Math.PI * 2
      }));
    }

    function drawSpace() {
      ensureStars();
      const w = canvas.width;
      const h = canvas.height;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#14081f');
      sky.addColorStop(0.45, '#0c1028');
      sky.addColorStop(1, '#1a1020');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const nebula = ctx.createRadialGradient(w * 0.2, h * 0.18, 8, w * 0.28, h * 0.22, w * 0.7);
      nebula.addColorStop(0, 'rgba(155, 92, 255, 0.22)');
      nebula.addColorStop(0.45, 'rgba(251, 146, 60, 0.08)');
      nebula.addColorStop(1, 'rgba(20, 8, 31, 0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);
      stars.forEach((st) => {
        st.tw += 0.03;
        ctx.fillStyle = `rgba(255,244,214,${st.a * (0.45 + Math.sin(st.tw) * 0.25)})`;
        ctx.fillRect(st.x * w, st.y * h, st.s, st.s);
      });
      ctx.fillStyle = 'rgba(254, 240, 138, 0.9)';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.12, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14081f';
      ctx.beginPath();
      ctx.arc(w * 0.845, h * 0.1, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(251, 146, 60, 0.85)';
      ctx.beginPath();
      ctx.moveTo(w * 0.82, h * 0.12 - 20);
      ctx.lineTo(w * 0.82 - 5, h * 0.12 - 12);
      ctx.lineTo(w * 0.82 + 5, h * 0.12 - 12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.82, h * 0.12 - 20);
      ctx.lineTo(w * 0.82 + 6, h * 0.12 - 12);
      ctx.lineTo(w * 0.82 + 12, h * 0.12 - 14);
      ctx.closePath();
      ctx.fill();
    }

    function draw() {
      const line = getComputedStyle(document.documentElement).getPropertyValue('--hairline').trim() || '#2a2a32';
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4);
      drawSpace();
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

    function paintMini(box, id) {
      box.innerHTML = '';
      if (!id || !SHAPES[id]) {
        box.append(el('span', { class: 'muted tz-hold__empty' }, t('tz.holdEmpty')));
        return;
      }
      const m = SHAPES[id];
      const g = el('div', { class: 'tz-mini', style: `--w:${m[0].length};--h:${m.length}` });
      m.forEach((row) =>
        row.forEach((v) => g.append(el('i', { style: v ? `background:${COLORS[id]}` : 'background:transparent' })))
      );
      box.append(g);
    }

    function paintNext() {
      paintMini(nextBox, nextId);
    }

    function paintHold() {
      paintMini(holdBox, holdId);
    }

    function hud() {
      nums.innerHTML = '';
      [
        ['Pontos', score],
        ['Linhas', lines],
        ['Nível', level],
        ['Recorde', Math.max(best, score)]
      ].forEach(([k, v]) => nums.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k))));
      pauseBtn.textContent = paused ? t('common.continue') : t('common.pause');
      pauseBtn.disabled = over;
      refreshSoundUi();
    }

    function showOverlay() {
      if (over) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(
          el('h2', {}, t('tz.over')),
          el('p', {}, `${score} pontos · ${lines} linhas`),
          el('button', { class: 'btn btn--primary', onclick: () => { armAudio(); newGame(); } }, t('tz.again'))
        );
      } else if (paused) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(el('h2', {}, t('tz.pause')), el('p', {}, t('tz.pauseHint')));
      } else overlay.hidden = true;
    }

    function togglePause() {
      if (over) return;
      paused = !paused;
      syncMusic();
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
      holdId = null;
      canHold = true;
      syncMusic();
      spawn();
      hud();
      showOverlay();
    }

    function persist() {
      return kv.set(KEY, { best: Math.max(best, score), sound, volume }).catch(() => {});
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
          move(0, 1, 'gravity');
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
        armAudio();
        togglePause();
        return;
      }
      if (over || paused) return;
      if (k === 'arrowleft' || k === 'a') {
        e.preventDefault();
        armAudio();
        move(-1, 0, 'shift');
      } else if (k === 'arrowright' || k === 'd') {
        e.preventDefault();
        armAudio();
        move(1, 0, 'shift');
      } else if (k === 'arrowdown' || k === 's') {
        e.preventDefault();
        armAudio();
        move(0, 1, 'soft');
      } else if (k === 'arrowup' || k === 'w') {
        e.preventDefault();
        armAudio();
        spin();
      } else if (k === ' ') {
        e.preventDefault();
        armAudio();
        hardDrop();
      } else if (k === 'c' || k === 'h' || k === 'shift') {
        e.preventDefault();
        armAudio();
        holdSwap();
      }
    };
    window.addEventListener('keydown', onKey);
    refreshSoundUi();
    newGame();
    raf = requestAnimationFrame(loop);

    window.__mmpTetris = {
      state: () => ({
        score,
        lines,
        level,
        over,
        paused,
        sound,
        volume,
        piece: piece && { id: piece.id, x: piece.x, y: piece.y },
        next: nextId,
        hold: holdId,
        canHold,
        filled: grid.flat().filter(Boolean).length
      }),
      move,
      rotate: spin,
      drop: hardDrop,
      hold: holdSwap,
      tick: () => move(0, 1, 'gravity'),
      newGame,
      setVolume,
      toggleSound
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
        if (chip && chip.dispose) {
          try {
            chip.dispose();
          } catch {}
        }
        chip = null;
        boot = null;
        if (window.__mmpTetris) delete window.__mmpTetris;
      }
    };
  }
};
