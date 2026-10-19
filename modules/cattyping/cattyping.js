// Cat Typing: o gato espacial atira laser nos asteroides cuja palavra você digitou.
import { kv, getProfile, onProfile } from '../shared/store.js';
import { creatureSVG } from '../shared/creatures.js';
import { themeTokens, hexToRgba } from '../shared/theme.js';
import { el, toast, startAudio } from '../shared/ui.js';

const LIVES = 3;
const MAX_ROCKS = 6;
const STORE_KEY = 'cattyping';
const THEME_LABEL = { psicologia: 'Psicologia', arte: 'Arte', historia: 'História', gerais: 'Gerais' };

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let wordsPromise = null;
function loadWords() {
  if (!wordsPromise) {
    wordsPromise = fetch(new URL('../../data/cattyping/words.json', import.meta.url)).then(async (r) => {
      if (!r.ok) throw new Error(`words.json: HTTP ${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json.words) || json.words.length < 5000) throw new Error('A lista de palavras está incompleta.');
      return json;
    });
    wordsPromise.catch(() => (wordsPromise = null));
  }
  return wordsPromise;
}

const SPAWN_LENS = [3, 4, 5, 6, 7];

function pickSpawnLen(rocks) {
  const used = new Set(rocks.map((r) => r.word.length));
  const fresh = SPAWN_LENS.filter((n) => !used.has(n));
  const bag = fresh.length ? fresh : SPAWN_LENS;
  return bag[Math.floor(Math.random() * bag.length)];
}

function emptyRun() {
  return {
    score: 0,
    lives: LIVES,
    level: 1,
    destroyed: 0,
    typing: '',
    targetId: null,
    over: false,
    paused: false,
    deckI: 0,
    spawnIn: 0.45,
    startedAt: new Date().toISOString()
  };
}

export default {
  id: 'cattyping',
  title: 'Cat Typing',
  icon: 'cattyping',
  accent: '#ff7a3d',
  desc: 'Gato espacial: digite a palavra do asteroide e atire o laser.',
  hideDock: true,
  async mount(root, { params } = {}) {
    const saved = (await kv.get(STORE_KEY).catch(() => null)) || {};
    let best = saved.version === 2 ? Number(saved.best) || 0 : 0;
    let run =
      saved.version === 2 && saved.game && !saved.game.over && saved.game.lives > 0
        ? { ...emptyRun(), ...saved.game }
        : emptyRun();
    run.spawnIn = Math.min(3, Math.max(0.15, Number(run.spawnIn) || 0.45));
    let data = null;
    let deck = saved.version === 2 && Array.isArray(saved.deck) ? saved.deck : [];
    let rocks = [];
    let lasers = [];
    let booms = [];
    let stars = [];
    let alive = true;
    let raf = 0;
    let lastT = 0;
    let sound = saved.sound !== false;
    let chip = null;
    let idSeq = 1;
    let lastShotAt = 0;
    let locked = false;
    const shotMode = Boolean(params && params.shot);

    const canvas = el('canvas', { class: 'ct-canvas', 'aria-label': 'Campo de asteroides' });
    const ship = el('div', { class: 'ct-ship' });
    const typeHud = el('div', { class: 'ct-type', 'aria-live': 'polite' });
    const overlay = el('div', { class: 'ct-overlay', hidden: true });
    const stage = el('div', { class: 'ct-stage' }, canvas, ship, typeHud, overlay);
    const nums = el('div', { class: 'ct-hud__nums' });
    const livesEl = el('div', { class: 'ct-lives', 'aria-label': 'Vidas' });
    const bestEl = el('p', { class: 'ct-best' });
    const pauseBtn = el('button', { class: 'btn btn--primary', onclick: () => togglePause() }, 'Pausar');
    const newBtn = el('button', { class: 'btn btn--ghost', onclick: () => newGame() }, 'Nova partida');
    const soundBtn = el('button', { class: 'btn btn--ghost btn--sm', onclick: () => toggleSound() }, '');
    const hud = el(
      'aside',
      { class: 'ct-hud panel' },
      el('h2', {}, 'Missão'),
      nums,
      el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Vidas'), livesEl),
      bestEl,
      el('div', { class: 'row-actions' }, pauseBtn, newBtn, soundBtn),
      el(
        'p',
        { class: 'ct-hint' },
        `Temas: ${Object.values(THEME_LABEL).join(', ')}. Digite a palavra do asteroide (acentos não importam). Cada letra atira um laser. Tab ou Esc pausa — P escreve P.`
      )
    );
    root.append(el('section', { class: 'ct' }, hud, stage));

    function persist() {
      if (run.score > best) best = run.score;
      const game = {
        score: run.score,
        lives: run.lives,
        level: run.level,
        destroyed: run.destroyed,
        typing: run.typing,
        targetId: run.targetId,
        over: run.over,
        paused: run.paused,
        deckI: run.deckI,
        spawnIn: run.spawnIn,
        startedAt: run.startedAt,
        rocks: rocks.map((r) => ({ id: r.id, word: r.word, display: r.display, theme: r.theme, x: r.x, y: r.y, vy: r.vy, rad: r.rad }))
      };
      return kv.set(STORE_KEY, { version: 2, best, game: run.over ? null : game, deck, sound }).catch(() => {});
    }

    function renderShip(p = getProfile()) {
      ship.innerHTML = `
        <div class="ct-ship__hull" aria-hidden="true">
          <span class="ct-ship__wing ct-ship__wing--l"></span>
          <span class="ct-ship__wing ct-ship__wing--r"></span>
          <span class="ct-ship__body"></span>
          <span class="ct-ship__gun ct-ship__gun--l"></span>
          <span class="ct-ship__gun ct-ship__gun--r"></span>
          <span class="ct-ship__glow"></span>
        </div>
        <div class="ct-ship__crew">
          <figure class="ct-ship__cat">${creatureSVG('cat', p.cat, { size: 72, pose: 'rear', label: `Gato espacial ${p.cat.name}` })}</figure>
          <figure class="ct-ship__otter">${creatureSVG('otter', p.otter, { size: 58, pose: 'rear', label: `Copiloto ${p.otter.name}` })}</figure>
        </div>`;
    }
    const offProfile = onProfile((p) => renderShip(p));

    async function ensureSound() {
      if (!sound || chip) return chip;
      try {
        const Tone = await startAudio();
        const out = new Tone.Gain(0.7).toDestination();
        const square = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.04 }, volume: -12 }).connect(out);
        const noise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -18 }).connect(out);
        let nextT = 0;
        const at = (gap = 0.05) => {
          const n = Tone.now() + 0.02;
          nextT = Math.max(nextT + gap, n);
          return nextT;
        };
        const safe = (fn) => {
          try {
            const ret = fn();
            if (ret && typeof ret.catch === 'function') ret.catch(() => {});
          } catch {}
        };
        chip = {
          blip(n = 'C5') {
            safe(() => square.triggerAttackRelease(n, '32n', at(0.04)));
          },
          laser() {
            safe(() => {
              const t = at(0.08);
              square.frequency.cancelScheduledValues(t);
              square.triggerAttackRelease('C6', 0.12, t);
              square.frequency.setValueAtTime(1400, t);
              square.frequency.exponentialRampToValueAtTime(280, t + 0.12);
            });
          },
          boom() {
            safe(() => noise.triggerAttackRelease(0.14, at(0.06)));
          },
          miss() {
            safe(() => square.triggerAttackRelease('E3', 0.18, at(0.08)));
          },
          level() {
            safe(() => {
              const t = at(0.08);
              square.triggerAttackRelease('C5', '16n', t);
              square.triggerAttackRelease('E5', '16n', t + 0.08);
              square.triggerAttackRelease('G5', '16n', t + 0.16);
            });
          },
          over() {
            safe(() => {
              const t = at(0.1);
              square.triggerAttackRelease('G3', 0.2, t);
              square.triggerAttackRelease('E3', 0.25, t + 0.18);
              square.triggerAttackRelease('C3', 0.4, t + 0.38);
            });
          },
          dispose() {
            [square, noise, out].forEach((n) => n.dispose());
          }
        };
      } catch {
        chip = { blip() {}, laser() {}, boom() {}, miss() {}, level() {}, over() {}, dispose() {} };
      }
      return chip;
    }

    function toggleSound() {
      sound = !sound;
      soundBtn.textContent = `Som: ${sound ? 'ligado' : 'desligado'}`;
      persist();
    }

    function hudRefresh() {
      nums.innerHTML = '';
      [
        ['Pontos', run.score],
        ['Nível', run.level],
        ['Abates', run.destroyed],
        ['Recorde', Math.max(best, run.score)]
      ].forEach(([k, v]) => nums.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k))));
      livesEl.innerHTML = '';
      for (let i = 0; i < LIVES; i++) livesEl.append(el('i', { class: i >= run.lives ? 'is-lost' : '', 'aria-hidden': 'true' }));
      bestEl.textContent = best ? `Melhor: ${best}` : 'Ainda sem recorde local.';
      pauseBtn.textContent = run.paused ? 'Continuar' : 'Pausar';
      pauseBtn.disabled = run.over;
      soundBtn.textContent = `Som: ${sound ? 'ligado' : 'desligado'}`;
      typeHud.textContent = run.typing ? run.typing.toUpperCase() : '';
    }

    function showOverlay() {
      if (shotMode) {
        overlay.hidden = true;
        return;
      }
      if (run.over) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(
          el('h2', {}, 'Fim de jogo'),
          el('p', {}, `${run.score} pontos · nível ${run.level} · ${run.destroyed} asteroides`),
          el('button', { class: 'btn btn--primary', onclick: () => newGame() }, 'Jogar de novo')
        );
      } else if (run.paused) {
        overlay.hidden = false;
        overlay.innerHTML = '';
          overlay.append(el('h2', {}, 'Pausa'), el('p', {}, 'Tab ou Esc continua. A letra P atira, não pausa.'), el('button', { class: 'btn btn--primary', onclick: () => togglePause() }, 'Continuar'));
      } else overlay.hidden = true;
    }

    function nextWord() {
      if (!data) return null;
      const want = pickSpawnLen(rocks);
      const tryLen = (lo, hi) => {
        for (let n = 0; n < deck.length; n++) {
          const i = (run.deckI + n) % deck.length;
          const w = data.words[deck[i]];
          if (w && w.len >= lo && w.len <= hi && !rocks.some((r) => r.word === w.word)) {
            run.deckI = (i + 1) % deck.length;
            return w;
          }
        }
        return null;
      };
      return tryLen(want, want) || tryLen(3, 7) || data.words[deck[run.deckI++ % deck.length]];
    }

    function spawn(opts = {}) {
      if (!opts.word && rocks.length >= MAX_ROCKS) return null;
      const w = opts.word
        ? { word: norm(opts.word), display: opts.display || opts.word, theme: opts.theme || 'gerais', len: norm(opts.word).length }
        : nextWord();
      if (!w) return null;
      const rock = {
        id: opts.id || idSeq++,
        word: w.word,
        display: (w.display || w.word).toUpperCase(),
        theme: w.theme || 'gerais',
        x: opts.x ?? 0.12 + Math.random() * 0.76,
        y: opts.y ?? -0.08,
        vy: opts.vy ?? 0.035 + run.level * 0.008 + Math.random() * 0.01,
        rad: 0.05 + Math.min(0.04, w.word.length * 0.004),
        rot: Math.random() * Math.PI
      };
      rocks.push(rock);
      return rock;
    }

    function fireAt(rock, { finisher = false } = {}) {
      const rect = canvas.getBoundingClientRect();
      const guns = [...ship.querySelectorAll('.ct-ship__gun')];
      const origin = guns[lasers.length % Math.max(1, guns.length)] || ship;
      const cr = origin.getBoundingClientRect();
      const x0 = (cr.left + cr.width / 2 - rect.left) / rect.width;
      const y0 = (cr.top - rect.top) / rect.height;
      lasers.push({
        x0,
        y0,
        x1: rock.x,
        y1: rock.y,
        t: 0,
        life: finisher ? 0.22 : 0.14,
        fat: finisher
      });
      lastShotAt = performance.now();
      ship.classList.remove('is-shot');
      void ship.offsetWidth;
      ship.classList.add('is-shot');
      ensureSound().then((s) => s && s.laser()).catch(() => {});
    }

    function explode(rock, pts) {
      booms.push({ x: rock.x, y: rock.y, t: 0, life: 0.45, pts });
      rocks = rocks.filter((r) => r.id !== rock.id);
      if (run.targetId === rock.id) {
        run.targetId = null;
        run.typing = '';
      }
      ensureSound().then((s) => s && s.boom()).catch(() => {});
    }

    function destroy(rock) {
      const pts = rock.word.length * 10 * run.level;
      run.score += pts;
      run.destroyed++;
      if (run.score > best) best = run.score;
      fireAt(rock, { finisher: true });
      explode(rock, pts);
      if (run.destroyed > 0 && run.destroyed % 10 === 0) {
        run.level++;
        ensureSound().then((s) => s && s.level()).catch(() => {});
        toast(`Nível ${run.level}! Os asteroides aceleram.`, 'ok');
      }
      persist();
    }

    function miss(rock) {
      explode(rock, 0);
      run.lives--;
      run.typing = '';
      run.targetId = null;
      ensureSound().then((s) => s && s.miss()).catch(() => {});
      if (run.lives <= 0) gameOver();
      persist();
    }

    function gameOver() {
      run.over = true;
      run.paused = false;
      if (run.score > best) {
        best = run.score;
        toast(`Novo recorde: ${run.score}!`, 'ok');
      }
      ensureSound().then((s) => s && s.over()).catch(() => {});
      persist();
      showOverlay();
      hudRefresh();
    }

    function togglePause() {
      if (run.over) return;
      run.paused = !run.paused;
      persist();
      showOverlay();
      hudRefresh();
    }

    function newGame(seed) {
      if (!data) return;
      run = emptyRun();
      rocks = [];
      lasers = [];
      booms = [];
      locked = false;
      const rng = typeof seed === 'number' ? mulberry32(seed) : () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
      deck = shuffle(
        data.words.map((_, i) => i),
        rng
      );
      persist();
      showOverlay();
      hudRefresh();
    }

    function typeChar(ch) {
      if (run.over || run.paused) return false;
      const letter = norm(ch);
      if (!letter) return false;
      const next = run.typing + letter;
      const pool = rocks.filter((r) => r.word.startsWith(next));
      const locked = run.targetId != null ? pool.find((r) => r.id === run.targetId) : null;
      const target = locked || pool.sort((a, b) => b.y - a.y)[0];
      if (!target) {
        ensureSound().then((s) => s && s.miss()).catch(() => {});
        return false;
      }
      run.targetId = target.id;
      run.typing = next;
      fireAt(target);
      ensureSound().then((s) => s && s.blip(['C5', 'E5', 'G5', 'C6'][next.length % 4])).catch(() => {});
      if (next === target.word) destroy(target);
      hudRefresh();
      return true;
    }

    function tick(dt, force = false) {
      if (run.over) return;
      if (!force && (run.paused || locked || shotMode)) return;
      run.spawnIn -= dt;
      if (run.spawnIn <= 0) {
        spawn();
        run.spawnIn = Math.max(0.55, 2.1 * Math.pow(0.9, run.level - 1));
      }
      const limit = 0.82;
      rocks.forEach((r) => {
        r.y += r.vy * dt;
        r.rot += dt * 0.6;
      });
      rocks.filter((r) => r.y > limit).forEach(miss);
      lasers.forEach((l) => (l.t += dt));
      lasers = lasers.filter((l) => l.t < l.life);
      booms.forEach((b) => (b.t += dt));
      booms = booms.filter((b) => b.t < b.life);
    }

    const ctx = canvas.getContext('2d');
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = stage.clientWidth || 640;
      const h = stage.clientHeight || 520;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!stars.length) {
        stars = Array.from({ length: 48 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2, a: 0.3 + Math.random() * 0.7 }));
      }
    }

    function draw() {
      const w = stage.clientWidth || 640;
      const h = stage.clientHeight || 520;
      ctx.clearRect(0, 0, w, h);
      const theme = themeTokens();
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);
      stars.forEach((st) => {
        ctx.fillStyle = hexToRgba(theme.text, st.a * 0.45);
        ctx.fillRect(Math.floor(st.x * w), Math.floor(st.y * h), st.s, st.s);
      });
      lasers.forEach((l) => {
        const k = Math.min(1, l.t / l.life);
        const x0 = l.x0 * w;
        const y0 = l.y0 * h;
        const x1 = l.x1 * w;
        const y1 = l.y1 * h;
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.35;
        ctx.strokeStyle = hexToRgba(theme.accentHover, 0.35);
        ctx.lineWidth = l.fat ? 8 : 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = k < 0.45 ? '#fff7d6' : theme.accent;
        ctx.lineWidth = l.fat ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.fillStyle = '#fff7d6';
        ctx.beginPath();
        ctx.arc(x1, y1, l.fat ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      rocks.forEach((r) => {
        const cx = r.x * w;
        const cy = r.y * h;
        const rad = r.rad * Math.min(w, h);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(r.rot);
        const fill = { psicologia: '#2a2a32', arte: '#32323a', historia: '#26262c', gerais: '#1c1c22' };
        ctx.fillStyle = r.id === run.targetId ? theme.accent : fill[r.theme] || fill.gerais;
        ctx.strokeStyle = theme.hairline;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const rr = rad * (0.72 + ((i * 37) % 5) * 0.06);
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = theme.bg;
        ctx.fillRect(-rad * 0.2, -rad * 0.15, rad * 0.25, rad * 0.2);
        ctx.restore();
        ctx.font = `13px ${theme.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const typed = r.id === run.targetId ? run.typing.length : 0;
        const label = r.display;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = theme.surface;
        ctx.fillRect(cx - tw / 2 - 6, cy - 28, tw + 12, 18);
        ctx.strokeStyle = r.id === run.targetId ? theme.accent : theme.hairline;
        ctx.strokeRect(cx - tw / 2 - 6, cy - 28, tw + 12, 18);
        let acc = 0;
        for (let i = 0; i < label.length; i++) {
          const ch = label[i];
          const cw = ctx.measureText(ch).width;
          ctx.fillStyle = i < typed ? theme.accentHover : theme.text;
          ctx.fillText(ch, cx - tw / 2 + acc + cw / 2, cy - 19);
          acc += cw;
        }
      });
      booms.forEach((b) => {
        const k = b.t / b.life;
        ctx.strokeStyle = hexToRgba(theme.accent, 1 - k);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x * w, b.y * h, 8 + k * 28, 0, Math.PI * 2);
        ctx.stroke();
        if (b.pts) {
          ctx.fillStyle = hexToRgba(theme.text, 1 - k);
          ctx.font = `12px ${theme.font}`;
          ctx.fillText(`+${b.pts}`, b.x * w, b.y * h - 20 - k * 20);
        }
      });
    }

    function loop(ts) {
      if (!alive) return;
      if (!lastT) lastT = ts;
      const dt = Math.min(0.05, (ts - lastT) / 1000);
      lastT = ts;
      tick(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.matches('input, select, textarea')) return;
      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        run.typing = run.typing.slice(0, -1);
        if (!run.typing) run.targetId = null;
        hudRefresh();
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        typeChar(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(() => resize());
    ro.observe(stage);

    overlay.hidden = false;
    overlay.innerHTML = '';
    overlay.append(el('div', { class: 'boot__spinner' }), el('p', {}, 'Carregando o dicionário espacial…'));
    renderShip();
    hudRefresh();
    try {
      data = await loadWords();
    } catch (err) {
      overlay.innerHTML = '';
      overlay.append(el('h2', {}, 'Sem palavras'), el('p', {}, `${err.message || err} Rode npm run cattyping:words.`));
      return { save: async () => false, unmount: () => cleanup() };
    }
    if (!alive) return { save: async () => false, unmount() {} };
    if (!deck.length) deck = shuffle(data.words.map((_, i) => i), () => Math.random());
    if (Array.isArray(saved.game && saved.game.rocks) && saved.game.rocks.length && !shotMode) {
      rocks = saved.game.rocks.map((r) => ({ ...r, rot: Math.random() }));
      idSeq = rocks.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
    }
    if (shotMode) {
      run.paused = true;
      run.score = 420;
      best = Math.max(best, 420);
      run.level = 3;
      run.destroyed = 12;
      run.typing = 'sol';
      rocks = [];
      spawn({ word: 'sol', display: 'SOL', theme: 'gerais', x: 0.28, y: 0.38, vy: 0 });
      spawn({ word: 'piano', display: 'PIANO', theme: 'arte', x: 0.55, y: 0.22, vy: 0 });
      spawn({ word: 'roma', display: 'ROMA', theme: 'historia', x: 0.78, y: 0.45, vy: 0 });
      spawn({ word: 'afeto', display: 'AFETO', theme: 'psicologia', x: 0.42, y: 0.18, vy: 0 });
      run.targetId = rocks[0].id;
      lasers = [{ x0: 0.42, y0: 0.82, x1: 0.28, y1: 0.38, t: 0.04, life: 0.9 }];
    }
    overlay.hidden = true;
    showOverlay();
    hudRefresh();
    resize();
    raf = requestAnimationFrame(loop);

    window.__mmpCatTyping = {
      data: () => ({
        words: data.words.length,
        minLen: data.meta.minLen,
        maxLen: data.meta.maxLen,
        themes: data.meta.themes,
        byLen: data.meta.byLen
      }),
      state: () =>
        JSON.parse(
          JSON.stringify({
            score: run.score,
            lives: run.lives,
            level: run.level,
            paused: run.paused,
            over: run.over,
            typing: run.typing,
            rocks: rocks.map((r) => ({ id: r.id, word: r.word, y: r.y, vy: r.vy, theme: r.theme })),
            lasers: lasers.length,
            destroyed: run.destroyed,
            best: Math.max(best, run.score),
            lastShotAt,
            spawnIn: run.spawnIn
          })
        ),
      type: typeChar,
      pause: () => {
        if (!run.paused) togglePause();
      },
      resume: () => {
        if (run.paused) togglePause();
      },
      lock: (on) => {
        locked = !!on;
      },
      setLevel: (n) => {
        run.level = Math.max(1, Number(n) || 1);
        hudRefresh();
      },
      deckPreview: () => deck.slice(0, 12).map((i) => data.words[i] && data.words[i].word),
      newGame,
      spawn,
      tick: (dt) => tick(dt, true),
      clear() {
        rocks = [];
        lasers = [];
        booms = [];
        run.typing = '';
        run.targetId = null;
      }
    };

    function cleanup() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      offProfile && offProfile();
      if (chip && chip.dispose) chip.dispose();
      if (window.__mmpCatTyping) delete window.__mmpCatTyping;
    }

    return {
      async save() {
        await persist();
        return run.over
          ? `Recorde local: ${best} pontos.`
          : `Missão salva: ${run.score} pontos, nível ${run.level}, ${run.lives} vida${run.lives === 1 ? '' : 's'}.`;
      },
      unmount() {
        persist();
        cleanup();
      }
    };
  }
};
