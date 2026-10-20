// Cat Typing: o gato espacial atira laser nos asteroides cuja palavra você digitou.
import { kv, getProfile, onProfile } from '../shared/store.js';
import { creatureSVG } from '../shared/creatures.js';
import { themeTokens, hexToRgba } from '../shared/theme.js';
import { el, toast, startAudio } from '../shared/ui.js';
import { t } from '../shared/i18n.js';

const LIVES = 3;
const MAX_ROCKS = 6;
const MAX_LASERS = 24;
const MAX_BOOMS = 16;
const MAX_METEORS = 12;
const MAX_KEY_QUEUE = 24;
const STORE_KEY = 'cattyping';
const THEME_LABEL = { psicologia: 'Psicologia', arte: 'Arte', historia: 'História', gerais: 'Gerais' };
const SHIPS = [
  { id: 'classic', name: 'Clássica' },
  { id: 'neon', name: 'Aurora' },
  { id: 'gold', name: 'Bronze' },
  { id: 'mint', name: 'Sálvia' }
];
const BOSSES = [
  { id: 'dragon', name: 'Dragão' },
  { id: 'squid', name: 'Lula' },
  { id: 'saucer', name: 'Disco' },
  { id: 'crystal', name: 'Cristal' },
  { id: 'whale', name: 'Baleia' }
];

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

const VOL_DEFAULT = 70;
function clampVolume(n, fallback = VOL_DEFAULT) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
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
    let meteors = [];
    let flash = 0;
    let pendingBoss = false;
    let shipSkin = SHIPS.some((s) => s.id === saved.ship) ? saved.ship : 'classic';
    let alive = true;
    let raf = 0;
    let lastT = 0;
    let volume = clampVolume(saved.volume, VOL_DEFAULT);
    let sound = saved.sound !== false;
    if (volume <= 0) sound = false;
    let chip = null;
    let idSeq = 1;
    let lastShotAt = 0;
    let locked = false;
    let keyQueue = [];
    let drainingKeys = false;
    const shotMode = Boolean(params && params.shot);

    const canvas = el('canvas', { class: 'ct-canvas', 'aria-label': 'Campo de asteroides' });
    const ship = el('div', { class: 'ct-ship' });
    const typeHud = el('div', { class: 'ct-type', 'aria-live': 'polite' });
    const overlay = el('div', { class: 'ct-overlay', hidden: true });
    const stage = el('div', { class: 'ct-stage' }, canvas, ship, typeHud, overlay);
    const nums = el('div', { class: 'ct-hud__nums' });
    const livesEl = el('div', { class: 'ct-lives', 'aria-label': t('ct.lives') });
    const bestEl = el('p', { class: 'ct-best' });
    const pauseBtn = el('button', { class: 'btn btn--primary', onclick: () => togglePause() }, t('common.pause'));
    const newBtn = el('button', { class: 'btn btn--ghost', onclick: () => newGame() }, t('common.newGame'));
    const soundBtn = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => toggleSound() }, '');
    const volInput = el('input', {
      class: 'range ct-vol',
      type: 'range',
      min: '0',
      max: '100',
      step: '1',
      value: String(volume),
      'aria-label': 'Volume',
      oninput: (e) => setVolume(e.target.value)
    });
    const soundRow = el('div', { class: 'ct-sound' }, soundBtn, volInput);
    const skinRow = el('div', { class: 'chips ct-skins', role: 'radiogroup', 'aria-label': t('ct.ship') });
    const hud = el(
      'aside',
      { class: 'ct-hud panel' },
      el('h2', {}, t('ct.mission')),
      nums,
      el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('ct.lives')), livesEl),
      bestEl,
      el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('ct.ship')), skinRow),
      el('div', { class: 'row-actions' }, pauseBtn, newBtn, soundRow),
      el(
        'p',
        { class: 'ct-hint' },
        `Temas: ${Object.values(THEME_LABEL).join(', ')}. Digite a palavra do asteroide (acentos não importam). Cada letra atira um laser. Tab ou Esc pausa.`
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
      return kv.set(STORE_KEY, { version: 2, best, game: run.over ? null : game, deck, sound, volume, ship: shipSkin }).catch(() => {});
    }

    function renderSkins() {
      skinRow.innerHTML = '';
      SHIPS.forEach((s) => {
        skinRow.append(
          el(
            'button',
            {
              class: `chip ${shipSkin === s.id ? 'is-on' : ''}`,
              role: 'radio',
              'aria-checked': String(shipSkin === s.id),
              onclick: () => {
                shipSkin = s.id;
                ship.dataset.skin = s.id;
                renderSkins();
                persist();
              }
            },
            s.name
          )
        );
      });
    }

    function renderShip(p = getProfile()) {
      ship.dataset.skin = shipSkin;
      ship.innerHTML = `
        <div class="ct-ship__hull" aria-hidden="true">
          <span class="ct-ship__nose"></span>
          <span class="ct-ship__wing ct-ship__wing--l"></span>
          <span class="ct-ship__wing ct-ship__wing--r"></span>
          <span class="ct-ship__fin ct-ship__fin--l"></span>
          <span class="ct-ship__fin ct-ship__fin--r"></span>
          <span class="ct-ship__body"></span>
          <span class="ct-ship__gun ct-ship__gun--l"></span>
          <span class="ct-ship__gun ct-ship__gun--r"></span>
          <span class="ct-ship__engine ct-ship__engine--l"></span>
          <span class="ct-ship__engine ct-ship__engine--r"></span>
          <span class="ct-ship__glow"></span>
          <div class="ct-ship__crew">
            <figure class="ct-ship__cat">${creatureSVG('cat', p.cat, { size: 56, pose: 'rear', label: `Gato espacial ${p.cat.name}` })}</figure>
            <figure class="ct-ship__otter">${creatureSVG('otter', p.otter, { size: 46, pose: 'rear', label: `Copiloto ${p.otter.name}` })}</figure>
          </div>
        </div>`;
    }
    const offProfile = onProfile((p) => renderShip(p));

    function liveGain() {
      return sound ? volume / 100 : 0;
    }

    function applyGain() {
      if (chip && typeof chip.setGain === 'function') chip.setGain(liveGain());
    }

    async function ensureSound() {
      if (chip) {
        applyGain();
        return chip;
      }
      if (!sound) return null;
      try {
        const Tone = await startAudio();
        const out = new Tone.Gain(liveGain()).toDestination();
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
          setGain(v) {
            const g = Math.max(0, Math.min(1, Number(v) || 0));
            try {
              if (out.gain && typeof out.gain.rampTo === 'function') out.gain.rampTo(g, 0.04);
              else out.gain.value = g;
            } catch {}
          },
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
        chip = { setGain() {}, blip() {}, laser() {}, boom() {}, miss() {}, level() {}, over() {}, dispose() {} };
      }
      return chip;
    }

    function refreshSoundUi() {
      const on = sound && volume > 0;
      soundBtn.textContent = `Som: ${on ? 'ligado' : 'desligado'}`;
      soundBtn.setAttribute('aria-pressed', String(on));
      volInput.value = String(volume);
      volInput.setAttribute('aria-valuenow', String(volume));
      volInput.title = `Volume ${volume}%`;
    }

    function toggleSound() {
      if (sound && volume > 0) sound = false;
      else {
        sound = true;
        if (volume <= 0) volume = VOL_DEFAULT;
      }
      applyGain();
      refreshSoundUi();
      persist();
    }

    function setVolume(n) {
      volume = clampVolume(n, volume);
      sound = volume > 0;
      applyGain();
      refreshSoundUi();
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
      pauseBtn.textContent = run.paused ? t('common.continue') : t('common.pause');
      pauseBtn.disabled = run.over;
      refreshSoundUi();
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
          el('h2', {}, t('ct.over')),
          el('p', {}, `${run.score} · ${t('tz.level')} ${run.level} · ${run.destroyed}`),
          el('button', { class: 'btn btn--primary', onclick: () => newGame() }, t('ct.again'))
        );
      } else if (run.paused) {
        overlay.hidden = false;
        overlay.innerHTML = '';
          overlay.append(el('h2', {}, t('ct.pause')), el('p', {}, t('ct.pauseHint')), el('button', { class: 'btn btn--primary', onclick: () => togglePause() }, t('ct.continue')));
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
      try {
        if (!opts.word && rocks.length >= MAX_ROCKS) return null;
        if (rocks.length >= MAX_ROCKS + 4) return null;
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
          rot: Math.random() * Math.PI,
          seed: Math.floor(Math.random() * 99),
          boss: false
        };
        rocks.push(rock);
        return rock;
      } catch (err) {
        console.error(err);
        return null;
      }
    }

    function spawnBoss() {
      const kind = BOSSES[(Math.max(1, run.level) - 1) % BOSSES.length];
      const w = nextWord() || { word: kind.id, display: kind.name.toUpperCase(), theme: 'gerais' };
      const rock = {
        id: idSeq++,
        word: w.word,
        display: (w.display || w.word).toUpperCase(),
        theme: w.theme || 'gerais',
        x: 0.5,
        y: -0.16,
        vy: 0.016 + run.level * 0.002,
        rad: 0.13,
        rot: 0,
        seed: 7 + BOSSES.findIndex((b) => b.id === kind.id),
        boss: true,
        bossKind: kind.id,
        flap: 0,
        pebbleIn: 1.4
      };
      rocks.push(rock);
      toast(`Boss ${kind.name}! Digite a palavra do peito.`, 'ok');
      return rock;
    }

    function fireAt(rock, { finisher = false } = {}) {
      if (!rock || !alive) return;
      try {
        const rect = canvas.getBoundingClientRect();
        const guns = [...ship.querySelectorAll('.ct-ship__gun')];
        const origin = guns[lasers.length % Math.max(1, guns.length)] || ship;
        const cr = origin.getBoundingClientRect();
        const rw = rect.width || 1;
        const rh = rect.height || 1;
        const x0 = Number.isFinite(cr.left) ? (cr.left + cr.width / 2 - rect.left) / rw : 0.5;
        const y0 = Number.isFinite(cr.top) ? (cr.top - rect.top) / rh : 0.86;
        lasers.push({
          x0,
          y0,
          x1: rock.x,
          y1: rock.y,
          t: 0,
          life: finisher ? 0.22 : 0.14,
          fat: finisher
        });
        if (lasers.length > MAX_LASERS) lasers.splice(0, lasers.length - MAX_LASERS);
        lastShotAt = performance.now();
        if (!ship.classList.contains('is-shot')) {
          ship.classList.add('is-shot');
          laterShotClear();
        }
        ensureSound().then((s) => s && s.laser()).catch(() => {});
      } catch (err) {
        console.error(err);
      }
    }

    let shotClearT = 0;
    function laterShotClear() {
      clearTimeout(shotClearT);
      shotClearT = setTimeout(() => {
        if (alive) ship.classList.remove('is-shot');
      }, 120);
    }

    function explode(rock, pts) {
      booms.push({ x: rock.x, y: rock.y, t: 0, life: 0.45, pts });
      if (booms.length > MAX_BOOMS) booms.splice(0, booms.length - MAX_BOOMS);
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
      if (run.destroyed > 0 && run.destroyed % 12 === 0) pendingBoss = true;
      persist();
    }

    function miss(rock) {
      explode(rock, 0);
      const lost = run.lives - 1;
      run.lives--;
      run.typing = '';
      run.targetId = null;
      ship.classList.remove('is-hit');
      void ship.offsetWidth;
      ship.classList.add('is-hit');
      flash = 0.45;
      hudRefresh();
      const hearts = [...livesEl.querySelectorAll('i')];
      const dying = hearts[lost];
      if (dying) {
        dying.classList.add('is-lost', 'is-losing');
      }
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
      pendingBoss = false;
      flash = 0;
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
      if (!alive || run.over || run.paused) return false;
      try {
        const letter = norm(ch);
        if (!letter) return false;
        const next = run.typing + letter;
        const pool = rocks.filter((r) => r.word && r.word.startsWith(next));
        const lockedTarget = run.targetId != null ? pool.find((r) => r.id === run.targetId) : null;
        const target = lockedTarget || pool.sort((a, b) => b.y - a.y)[0];
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
      } catch (err) {
        console.error(err);
        return false;
      }
    }

    function drainKeys() {
      if (drainingKeys || !alive) return;
      drainingKeys = true;
      try {
        let n = 0;
        while (keyQueue.length && n < 12 && alive) {
          typeChar(keyQueue.shift());
          n++;
        }
      } catch (err) {
        console.error(err);
      } finally {
        drainingKeys = false;
      }
      if (keyQueue.length && alive) {
        requestAnimationFrame(() => {
          if (alive) drainKeys();
        });
      }
    }

    function tick(dt, force = false) {
      if (run.over) return;
      if (!force && (run.paused || locked || shotMode)) return;
      run.spawnIn -= dt;
      if (pendingBoss && !rocks.some((r) => r.boss)) {
        pendingBoss = false;
        spawnBoss();
        run.spawnIn = 2.2;
      } else if (run.spawnIn <= 0) {
        spawn();
        run.spawnIn = Math.max(0.55, 2.1 * Math.pow(0.9, run.level - 1));
      }
      const limit = 0.82;
      rocks.forEach((r) => {
        r.y += r.vy * dt;
        r.rot += r.boss ? dt * 0.15 : dt * 0.6;
        if (r.boss) {
          r.flap = (r.flap || 0) + dt;
          r.pebbleIn = (r.pebbleIn || 1.2) - dt;
          if (r.pebbleIn <= 0 && rocks.length < MAX_ROCKS + 2) {
            r.pebbleIn = 1.6;
            const side = Math.random() < 0.5 ? -1 : 1;
            spawn({
              word: side < 0 ? 'asa' : 'lua',
              display: side < 0 ? 'ASA' : 'LUA',
              x: r.x + side * 0.16,
              y: r.y + 0.04,
              vy: r.vy + 0.02,
              theme: 'gerais'
            });
          }
        }
      });
      rocks.filter((r) => r.y > limit).forEach(miss);
      lasers.forEach((l) => (l.t += dt));
      lasers = lasers.filter((l) => l.t < l.life);
      booms.forEach((b) => (b.t += dt));
      booms = booms.filter((b) => b.t < b.life);
      if (flash > 0) flash -= dt;
      meteors.forEach((m) => {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
      });
      meteors = meteors.filter((m) => m.x < 1.2 && m.y < 1.2);
      if (Math.random() < dt * 0.25 && meteors.length < MAX_METEORS) {
        meteors.push({ x: Math.random() * 0.7, y: -0.05, vx: 0.18 + Math.random() * 0.12, vy: 0.35 + Math.random() * 0.2, len: 0.08 + Math.random() * 0.06 });
      }
      if (meteors.length > MAX_METEORS) meteors.length = MAX_METEORS;
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
        stars = Array.from({ length: 64 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2, a: 0.3 + Math.random() * 0.7, tw: Math.random() * 6 }));
      }
    }

    function drawRockShape(ctx, rad, seed, color, stroke) {
      const n = 7 + (seed % 5);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + seed * 0.15;
        const wob = 0.68 + ((i * 17 + seed * 3) % 11) * 0.035;
        const x = Math.cos(a) * rad * wob;
        const y = Math.sin(a) * rad * wob;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(-rad * 0.25, -rad * 0.3, rad * 0.1, 0, 0, rad);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.ellipse(-rad * 0.22, -rad * 0.24, rad * 0.2, rad * 0.12, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      for (let c = 0; c < 3; c++) {
        const a = seed * 0.7 + c * 1.7;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rad * 0.28, Math.sin(a) * rad * 0.22, rad * (0.08 + (c % 2) * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawDragon(ctx, r, rad, theme) {
      const flap = Math.sin((r.flap || 0) * 6) * 0.35;
      const kind = r.bossKind || 'dragon';
      ctx.strokeStyle = theme.hairline;
      ctx.lineWidth = 2;
      if (kind === 'squid') {
        ctx.fillStyle = '#3f5d6a';
        ctx.beginPath();
        ctx.ellipse(0, -rad * 0.1, rad * 0.62, rad * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let t = -2; t <= 2; t++) {
          ctx.beginPath();
          ctx.moveTo(t * rad * 0.16, rad * 0.2);
          ctx.quadraticCurveTo(t * rad * 0.3, rad * 0.55 + flap * rad * 0.2, t * rad * 0.1, rad * 0.85);
          ctx.strokeStyle = '#5b7c8a';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.fillStyle = '#f4d7a8';
        ctx.beginPath();
        ctx.arc(-rad * 0.16, -rad * 0.16, 5, 0, Math.PI * 2);
        ctx.arc(rad * 0.16, -rad * 0.16, 5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (kind === 'saucer') {
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.ellipse(0, 0, rad * 0.95, rad * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(0, -rad * 0.12, rad * 0.42, rad * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#eab308';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(i * rad * 0.28, rad * 0.08, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      if (kind === 'crystal') {
        ctx.fillStyle = '#7dd3c7';
        ctx.beginPath();
        ctx.moveTo(0, -rad);
        ctx.lineTo(rad * 0.7, 0);
        ctx.lineTo(0, rad * 0.85);
        ctx.lineTo(-rad * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(0, -rad * 0.6);
        ctx.lineTo(rad * 0.22, 0);
        ctx.lineTo(0, rad * 0.2);
        ctx.closePath();
        ctx.fill();
        return;
      }
      if (kind === 'whale') {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.ellipse(0, 0, rad * 0.9, rad * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rad * 0.7, 0);
        ctx.quadraticCurveTo(rad * 1.15, -rad * 0.35 + flap * rad * 0.2, rad * 0.85, rad * 0.25);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.ellipse(0, rad * 0.1, rad * 0.4, rad * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-rad * 0.35, -rad * 0.08, 3, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.fillStyle = '#6d3d1f';
      ctx.beginPath();
      ctx.ellipse(0, 0, rad * 0.55, rad * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const wing = (dir) => {
        ctx.save();
        ctx.translate(dir * rad * 0.2, -rad * 0.05);
        ctx.rotate(dir * (0.4 + flap));
        ctx.fillStyle = '#8b4a24';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(dir * rad * 1.15, -rad * 0.55, dir * rad * 1.05, rad * 0.35);
        ctx.quadraticCurveTo(dir * rad * 0.45, rad * 0.12, 0, 0);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
      wing(-1);
      wing(1);
      ctx.fillStyle = '#f4d7a8';
      ctx.beginPath();
      ctx.ellipse(0, rad * 0.18, rad * 0.28, rad * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#be123c';
      ctx.beginPath();
      ctx.arc(-rad * 0.12, -rad * 0.22, 4, 0, Math.PI * 2);
      ctx.arc(rad * 0.12, -rad * 0.22, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0c08';
      ctx.fillRect(-6, rad * 0.28, 12, 4);
    }

    function draw() {
      if (!ctx || !alive) return;
      const w = stage.clientWidth || 640;
      const h = stage.clientHeight || 520;
      ctx.clearRect(0, 0, w, h);
      const theme = themeTokens();
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);
      stars.forEach((st) => {
        st.tw += 0.04;
        ctx.fillStyle = hexToRgba(theme.text, st.a * (0.35 + Math.sin(st.tw) * 0.2));
        ctx.fillRect(Math.floor(st.x * w), Math.floor(st.y * h), st.s, st.s);
      });
      meteors.forEach((m) => {
        ctx.strokeStyle = hexToRgba('#ffe08a', 0.85);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(m.x * w, m.y * h);
        ctx.lineTo((m.x - m.len) * w, (m.y - m.len * 0.6) * h);
        ctx.stroke();
        ctx.fillStyle = '#fff4c8';
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, 2.4, 0, Math.PI * 2);
        ctx.fill();
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
      const pal = { psicologia: '#3a3348', arte: '#3a2a38', historia: '#2c3338', gerais: '#2a2a32' };
      rocks.forEach((r) => {
        const cx = r.x * w;
        const cy = r.y * h;
        const rad = r.rad * Math.min(w, h);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(r.rot);
        if (r.boss) drawDragon(ctx, r, rad, theme);
        else drawRockShape(ctx, rad, r.seed || 1, r.id === run.targetId ? theme.accent : pal[r.theme] || pal.gerais, theme.hairline);
        ctx.restore();
        ctx.font = `13px ${theme.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const typed = r.id === run.targetId ? run.typing.length : 0;
        const label = r.display;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = theme.surface;
        ctx.fillRect(cx - tw / 2 - 6, cy - (r.boss ? rad + 18 : 28), tw + 12, 18);
        ctx.strokeStyle = r.id === run.targetId ? theme.accent : theme.hairline;
        ctx.strokeRect(cx - tw / 2 - 6, cy - (r.boss ? rad + 18 : 28), tw + 12, 18);
        let acc = 0;
        const ly = cy - (r.boss ? rad + 9 : 19);
        for (let i = 0; i < label.length; i++) {
          const ch = label[i];
          const cw = ctx.measureText(ch).width;
          ctx.fillStyle = i < typed ? theme.accentHover : theme.text;
          ctx.fillText(ch, cx - tw / 2 + acc + cw / 2, ly);
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
        ctx.fillStyle = hexToRgba('#ffd27a', 0.45 * (1 - k));
        ctx.beginPath();
        ctx.arc(b.x * w, b.y * h, 4 + k * 16, 0, Math.PI * 2);
        ctx.fill();
        if (b.pts) {
          ctx.fillStyle = hexToRgba(theme.text, 1 - k);
          ctx.font = `12px ${theme.font}`;
          ctx.fillText(`+${b.pts}`, b.x * w, b.y * h - 20 - k * 20);
        }
      });
      if (flash > 0) {
        ctx.fillStyle = hexToRgba('#e11d48', flash * 0.35);
        ctx.fillRect(0, 0, w, h);
      }
    }

    function loop(ts) {
      if (!alive) {
        raf = 0;
        return;
      }
      try {
        if (!lastT) lastT = ts;
        const dt = Math.min(0.05, (ts - lastT) / 1000);
        lastT = ts;
        tick(dt);
        draw();
      } catch (err) {
        console.error(err);
        lasers = lasers.slice(-MAX_LASERS);
        booms = booms.slice(-MAX_BOOMS);
        rocks = rocks.slice(0, MAX_ROCKS + 4);
      }
      if (alive) raf = requestAnimationFrame(loop);
      else raf = 0;
    }

    const onKey = (e) => {
      if (!alive) return;
      if (e.repeat) return;
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
        if (keyQueue.length < MAX_KEY_QUEUE) keyQueue.push(e.key);
        drainKeys();
      }
    };
    window.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(() => resize());
    ro.observe(stage);

    overlay.hidden = false;
    overlay.innerHTML = '';
    overlay.append(el('div', { class: 'boot__spinner' }), el('p', {}, 'Carregando o dicionário espacial…'));
    renderShip();
    renderSkins();
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
            maxLasers: MAX_LASERS,
            destroyed: run.destroyed,
            best: Math.max(best, run.score),
            lastShotAt,
            spawnIn: run.spawnIn,
            sound,
            volume,
            gain: liveGain()
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
      setVolume,
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
      keyQueue = [];
      drainingKeys = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(shotClearT);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      offProfile && offProfile();
      if (chip && chip.dispose) {
        try {
          chip.dispose();
        } catch {}
      }
      chip = null;
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
