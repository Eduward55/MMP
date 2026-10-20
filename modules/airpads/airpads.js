// Air Pads: dois círculos no ar, um por mão. A ponta do indicador (MediaPipe, local) entra no círculo e toca.
// Sem câmera, o mouse, as teclas A/L ou o "Simular dedos" fazem o papel das pontas dos dedos.
import { createOutputRecorder } from '../shared/audio.js';
import { creatureSVG } from '../shared/creatures.js';
import { dockSay, reactCreature, setDockVisible } from '../shared/companion.js';
import { createEventLog, eventsSummary, openInStudio } from '../shared/events.js';
import { gallery, getProfile, kv } from '../shared/store.js';
import { themeTokens } from '../shared/theme.js';
import { el, startAudio, stamp, toast } from '../shared/ui.js';
import { HAND_CONNECTIONS, loadHandLandmarker, mapHands, resetHandSmooth } from './hands.js';
import {
  DEADZONE,
  DRUM_ZONES,
  INSTRUMENTS,
  INSTRUMENT_BY_ID,
  ROOTS,
  SCALES,
  SCALE_BY_ID,
  createClap,
  createInstrument,
  drumZone,
  inDeadzone,
  midiName,
  pickNote,
  scaleNotes,
  sliceIndex
} from './instruments.js';

const HANDS = ['Mão esquerda', 'Mão direita'];
const KEYS = ['a', 'l'];
const DEFAULTS = { version: 1, instruments: ['piano', 'drums'], scale: 'penta', root: 0, bpm: 96, metronome: false };

function normalize(c) {
  const out = { ...DEFAULTS, ...(c || {}) };
  out.instruments = [0, 1].map((i) => (INSTRUMENT_BY_ID[out.instruments && out.instruments[i]] ? out.instruments[i] : DEFAULTS.instruments[i]));
  if (!SCALE_BY_ID[out.scale]) out.scale = DEFAULTS.scale;
  out.root = Math.max(0, Math.min(11, Number(out.root) || 0));
  out.bpm = Math.max(50, Math.min(200, Number(out.bpm) || DEFAULTS.bpm));
  out.metronome = Boolean(out.metronome);
  return out;
}

export default {
  id: 'airpads',
  title: 'Air Pads',
  icon: 'airpads',
  accent: '#9b5cff',
  desc: 'Dois círculos no ar, um por mão. O miolo preto é silêncio; junte as mãos no meio para palmas.',
  async mount(root, { params }) {
    const config = normalize(await kv.get('airpads').catch(() => null));
    const profile = getProfile();

    let alive = true;
    let raf = 0;
    let Tone = null;
    let audioPromise = null;
    let out = null;
    let engines = null;
    let repeatLoop = null;
    let metroLoop = null;
    let metroSynth = null;
    let beat = 0;
    let stream = null;
    let landmarker = null;
    let lastVideoTime = -1;
    let lastDetectTs = 0;
    let rvfc = 0;
    let camHands = [];
    let mouseTip = null;
    let simTips = [];
    let demo = false;
    let rec = null;
    let recTimer = 0;
    let pointTimer = 0;
    let clapEng = null;
    let clapArmed = true;
    const lastNeutral = [false, false];
    const keyHeld = new Set();
    const inside = [false, false];
    const pos = [null, null];
    const hits = [0, 0];
    const lastTrig = [0, 0];
    const lastLabel = ['', ''];
    const lastSlice = [-1, -1];
    const theremin = [null, null];
    const effects = [];
    const log = createEventLog({ source: 'airpads', bpm: config.bpm, scale: config.scale, root: config.root });
    const DRUM_NOTES = [42, 38, 36];
    const trackOf = (i) => ({ track: `circulo-${i + 1}-${config.instruments[i]}`, trackName: `${HANDS[i]} · ${INSTRUMENT_BY_ID[config.instruments[i]].name}` });

    /* ---------- DOM ---------- */
    const video = el('video', { class: 'airx__video', autoplay: true, muted: true, playsinline: true });
    const canvas = el('canvas', { class: 'airx__canvas' });
    const ctx = canvas.getContext('2d');
    const circles = [0, 1].map((i) => el('div', { class: `air-circle air-circle--${i}`, 'data-circle': String(i) }));
    const huds = [0, 1].map((i) => el('div', { class: `air-hud air-hud--${i}` }));
    const bubble = el('div', { class: 'air-maestro__bubble' }, 'Prontos?');
    const maestroArt = el('div', {
      class: 'air-maestro__art',
      html: creatureSVG('cat', profile.cat, { size: 112, label: profile.cat.name })
    });
    const maestroCat = el(
      'div',
      { class: 'air-maestro__cat', title: `Clique em ${profile.cat.name}` },
      maestroArt
    );
    maestroCat.addEventListener('click', (e) => {
      e.stopPropagation();
      reactCreature(maestroCat, maestroCat.querySelector('svg.creature'));
    });
    const maestro = el(
      'div',
      { class: 'air-maestro', title: profile.cat.name },
      bubble,
      maestroCat,
      el('span', { class: 'air-maestro__name' }, profile.cat.name)
    );
    const fsBack = el('a', { class: 'btn btn--ghost airx__fs-back', href: '#/hub', title: 'Voltar ao Hub' }, '◀ Voltar');
    const fsExit = el('button', { class: 'btn btn--primary airx__fs-exit', type: 'button' }, 'Sair da tela cheia');
    const fsCam = el('button', { class: 'btn btn--ghost airx__fs-cam', type: 'button', hidden: true }, 'Desligar câmera');
    const fsHint = el('span', { class: 'airx__fs-hint' }, 'Esc também sai.');
    const fsBar = el('div', { class: 'airx__fsbar', hidden: true, 'aria-label': 'Controles da tela cheia' }, fsBack, fsExit, fsCam, fsHint);
    const rest = el(
      'div',
      { class: 'air-rest', title: 'Neutro — sem som. Junte as mãos aqui para palmas.' },
      el('span', { class: 'air-rest__hole' }),
      el('span', { class: 'air-rest__label' }, 'neutro')
    );
    const arena = el('div', { class: 'airx__arena' }, video, ...circles, rest, canvas, ...huds, maestro, fsBar);

    const camBtn = el('button', { class: 'btn btn--primary', type: 'button', 'aria-pressed': 'false' }, 'Ativar câmera');
    const demoBtn = el('button', { class: 'btn btn--ghost', 'aria-pressed': 'false' }, 'Simular dedos: Não');
    const recBtn = el('button', { class: 'btn btn--rec', 'aria-pressed': 'false' }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar: Não'));
    const timer = el('span', { class: 'pill' }, '00:00');
    const status = el('p', { class: 'muted airx__status' }, 'O miolo preto é silêncio. Junte as mãos no meio para palmas. Mouse ou A / L sem câmera.');
    const distHint = el('p', { class: 'airx__dist hint', hidden: true }, '');
    const fsBtn = el('button', { class: 'btn btn--ghost', 'aria-pressed': 'false' }, 'Tela cheia');

    const chipRows = [0, 1].map(() => el('div', { class: 'chips', role: 'radiogroup' }));
    const scaleSel = el('select', { class: 'input input--select', 'aria-label': 'Escala' }, ...SCALES.map((s) => el('option', { value: s.id }, s.name)));
    const rootSel = el('select', { class: 'input input--select', 'aria-label': 'Tônica' }, ...ROOTS.map((r, i) => el('option', { value: String(i) }, r)));
    const bpmInput = el('input', { class: 'range', type: 'range', min: '50', max: '200', value: String(config.bpm), 'aria-label': 'BPM' });
    const bpmLabel = el('span', { class: 'pill' }, `${config.bpm} BPM`);
    const metroBtn = el('button', { class: 'btn btn--ghost btn--sm', 'aria-pressed': 'false' });
    scaleSel.value = config.scale;
    rootSel.value = String(config.root);

    /* ---------- Renderização dos controles ---------- */
    const notesFor = (i) => scaleNotes(config.instruments[i], config.scale, config.root);

    function sliceLabels(i) {
      const inst = INSTRUMENT_BY_ID[config.instruments[i]];
      if (inst.id === 'drums') return DRUM_ZONES;
      const notes = notesFor(i);
      const max = inst.continuous ? 6 : 8;
      const pick = notes.length <= max ? notes : Array.from({ length: max }, (_, k) => notes[Math.round((k * (notes.length - 1)) / (max - 1))]);
      return pick.map(midiName);
    }

    function renderCircle(i) {
      const inst = INSTRUMENT_BY_ID[config.instruments[i]];
      const c = circles[i];
      c.style.setProperty('--c', inst.color);
      c.dataset.instrument = inst.id;
      const labels = sliceLabels(i);
      const n = Math.max(1, labels.length);
      const pie = labels
        .map((_, k) => {
          const a = (k / n) * 360;
          const b = ((k + 1) / n) * 360;
          const fill = k % 2 ? `color-mix(in srgb, ${inst.color} 22%, transparent)` : `color-mix(in srgb, ${inst.color} 10%, transparent)`;
          return `${fill} ${a}deg ${b}deg`;
        })
        .join(',');
      c.style.setProperty('--pie', `conic-gradient(from -90deg, ${pie})`);
      const slices = labels.map((_, k) => `<span class="air-slice" style="--i:${k};--n:${n}"></span>`).join('');
      c.innerHTML = `<span class="air-circle__slices" aria-hidden="true">${slices}</span><span class="air-circle__hole" title="Neutro"></span><span class="air-circle__note">${lastLabel[i] || ''}</span><span class="air-bead" aria-hidden="true"></span><span class="air-circle__name">${inst.name}</span>`;
    }

    function renderHud(i) {
      const inst = INSTRUMENT_BY_ID[config.instruments[i]];
      huds[i].style.setProperty('--c', inst.color);
      huds[i].innerHTML = `<span class="air-hud__hand">${HANDS[i]} · ${KEYS[i].toUpperCase()}</span><strong class="air-hud__inst">${inst.name}</strong><span class="air-hud__note">${lastLabel[i] || 'esperando…'}</span>`;
    }

    function renderChips(i) {
      chipRows[i].innerHTML = '';
      INSTRUMENTS.forEach((inst) => {
        const on = config.instruments[i] === inst.id;
        chipRows[i].append(
          el(
            'button',
            { class: `chip ${on ? 'is-on' : ''}`, role: 'radio', 'aria-checked': String(on), style: `--c:${inst.color}`, onclick: () => setInstrument(i, inst.id) },
            el('span', { class: 'swatch', style: `--a:${inst.color};--b:${inst.color}` }),
            inst.name
          )
        );
      });
    }

    function renderMetro() {
      metroBtn.textContent = `Metrônomo: ${config.metronome ? 'Sim' : 'Não'}`;
      metroBtn.setAttribute('aria-pressed', String(config.metronome));
      metroBtn.classList.toggle('is-active', config.metronome);
    }

    function renderAll() {
      [0, 1].forEach((i) => {
        renderCircle(i);
        renderHud(i);
        renderChips(i);
      });
      renderMetro();
    }

    /* ---------- Áudio ---------- */
    function ensureAudio() {
      if (!audioPromise) {
        audioPromise = (async () => {
          Tone = await startAudio();
          if (!alive) return;
          out = new Tone.Gain(0.82).toDestination();
          engines = config.instruments.map((id) => createInstrument(Tone, id, out));
          clapEng = createClap(Tone, out);
          metroSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }, volume: -22 }).connect(out);
          Tone.Transport.bpm.value = config.bpm;
          repeatLoop = new Tone.Loop((time) => {
            [0, 1].forEach((i) => {
              if (inside[i] && pos[i] && !engines[i].continuous && performance.now() - lastTrig[i] > 140) play(i, pos[i], time);
            });
          }, '8n').start(0);
          metroLoop = new Tone.Loop((time) => {
            if (config.metronome) metroSynth.triggerAttackRelease(beat % 4 === 0 ? 'C6' : 'G5', '32n', time);
            beat++;
          }, '4n').start(0);
          Tone.Transport.start('+0.05');
        })();
        audioPromise.catch((err) => {
          audioPromise = null;
          toast(`Áudio indisponível: ${err.message}`, 'error');
        });
      }
      return audioPromise;
    }

    function setInstrument(i, id) {
      if (config.instruments[i] === id) return;
      log.noteOff(`theremin-${i}`);
      config.instruments[i] = id;
      inside[i] = false;
      theremin[i] = null;
      lastLabel[i] = '';
      if (engines && Tone) {
        engines[i].dispose();
        engines[i] = createInstrument(Tone, id, out);
      }
      renderCircle(i);
      renderHud(i);
      renderChips(i);
      pointAt(i, `${INSTRUMENT_BY_ID[id].name}!`);
    }

    // Toca o instrumento do círculo i na posição relativa rel (rx, ry ∈ [-1, 1]).
    function play(i, rel, time) {
      const id = config.instruments[i];
      if (id === 'theremin') return;
      let label;
      let value;
      if (id === 'drums') {
        value = drumZone(rel.ry, rel.rx);
        label = DRUM_ZONES[value];
      } else {
        const notes = notesFor(i);
        value = pickNote(notes, rel.ry, rel.rx);
        label = midiName(value);
      }
      lastTrig[i] = performance.now();
      log.note({ note: id === 'drums' ? DRUM_NOTES[value] : value, inst: id, ...trackOf(i), time, dur: (id === 'piano' ? 60 : 30) / config.bpm, vel: 0.85 });
      const fire = () => engines && engines[i] && engines[i].play(value, time);
      if (engines) fire();
      else ensureAudio().then(fire).catch(() => {});
      const show = () => {
        lastLabel[i] = label;
        const noteEl = circles[i].querySelector('.air-circle__note');
        const hudEl = huds[i].querySelector('.air-hud__note');
        if (noteEl) noteEl.textContent = label;
        if (hudEl) hudEl.textContent = label;
        pulse(i);
      };
      if (time !== undefined && Tone) Tone.Draw.schedule(show, time);
      else show();
      return label;
    }

    function holdTheremin(i, rel) {
      const notes = notesFor(i);
      const t = (Math.max(-1, Math.min(1, rel.rx)) + 1) / 2;
      const m = notes[Math.round(t * (notes.length - 1))];
      const vol = 1 - (Math.max(-1, Math.min(1, rel.ry)) + 1) / 2;
      const changed = !theremin[i] || theremin[i].midi !== m;
      theremin[i] = { midi: m, vol };
      if (changed) log.noteOn(`theremin-${i}`, { note: m, inst: 'theremin', ...trackOf(i), vel: 0.2 + vol * 0.8 });
      if (engines && engines[i] && engines[i].continuous) engines[i].hold(m, vol);
      else ensureAudio().catch(() => {});
      const label = `${midiName(m)} · ${Math.round(vol * 100)}%`;
      lastLabel[i] = label;
      const noteEl = circles[i].querySelector('.air-circle__note');
      const hudEl = huds[i].querySelector('.air-hud__note');
      if (noteEl) noteEl.textContent = label;
      if (hudEl) hudEl.textContent = label;
      if (changed) pulse(i);
    }

    /* ---------- Efeitos visuais ---------- */
    function pulse(i) {
      const c = circles[i];
      c.classList.remove('is-hit');
      void c.offsetWidth;
      c.classList.add('is-hit');
    }

    function burst(x, y, color, label) {
      const t0 = performance.now();
      effects.push({ kind: 'ring', x, y, color, t0 });
      for (let k = 0; k < 10; k++) {
        const a = (Math.PI * 2 * k) / 10 + Math.random() * 0.4;
        const v = 1.5 + Math.random() * 2.5;
        effects.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, t0, size: 4 + Math.round(Math.random() * 4) });
      }
      if (label) effects.push({ kind: 'text', x, y: y - 18, color, t0, text: label });
    }

    function pointAt(i, text) {
      maestro.classList.toggle('is-left', i === 0);
      maestro.classList.toggle('is-right', i === 1);
      maestro.classList.add('is-playing');
      bubble.textContent = text;
      clearTimeout(pointTimer);
      pointTimer = setTimeout(() => maestro.classList.remove('is-playing'), 500);
    }

    /* ---------- Pontas dos dedos ---------- */
    const HIT_R = 1.08;
    const SRC_RANK = { mouse: 0, key: 1, sim: 2, cam: 3, demo: 4, 'cam-tip': 5 };

    function clientToArena(clientX, clientY) {
      const a = arena.getBoundingClientRect();
      return { x: clientX - a.left - arena.clientLeft, y: clientY - a.top - arena.clientTop };
    }

    function pointerInArena(clientX, clientY) {
      const a = arena.getBoundingClientRect();
      return clientX >= a.left && clientX <= a.right && clientY >= a.top && clientY <= a.bottom;
    }

    function geom(i) {
      const a = arena.getBoundingClientRect();
      const b = circles[i].getBoundingClientRect();
      return {
        cx: b.left + b.width / 2 - a.left - arena.clientLeft,
        cy: b.top + b.height / 2 - a.top - arena.clientTop,
        r: Math.min(b.width, b.height) / 2
      };
    }

    function restGeom() {
      const a = arena.getBoundingClientRect();
      const b = rest.getBoundingClientRect();
      return {
        cx: b.left + b.width / 2 - a.left - arena.clientLeft,
        cy: b.top + b.height / 2 - a.top - arena.clientTop,
        r: Math.min(b.width, b.height) / 2
      };
    }

    function silenceHand(i) {
      const wasInside = inside[i];
      inside[i] = false;
      lastSlice[i] = -1;
      pos[i] = null;
      lastNeutral[i] = true;
      circles[i].classList.remove('is-inside');
      const continuous = INSTRUMENT_BY_ID[config.instruments[i]].continuous;
      if (wasInside && continuous && engines && engines[i] && engines[i].release) engines[i].release();
      if (wasInside && continuous) theremin[i] = null;
      if (wasInside && continuous) log.noteOff(`theremin-${i}`);
      lastLabel[i] = 'neutro';
      const noteEl = circles[i].querySelector('.air-circle__note');
      const hudEl = huds[i].querySelector('.air-hud__note');
      if (noteEl) noteEl.textContent = 'neutro';
      if (hudEl) hudEl.textContent = 'neutro';
    }

    function playClap(x, y) {
      const fire = () => clapEng && clapEng.play();
      if (clapEng) fire();
      else ensureAudio().then(fire).catch(() => {});
      log.note({ note: 39, inst: 'clap', track: 'palmas', trackName: 'Palmas', dur: 0.12, vel: 0.7 });
      burst(x, y, '#e8e8ea', 'Palmas!');
      rest.classList.add('is-clap');
      setTimeout(() => rest.classList.remove('is-clap'), 280);
      pointAt(0, 'Palmas!');
    }

    function maybeClap(tips, rg) {
      const left = tips.filter((t) => t.hand === 0 && t.src !== 'cam-tip');
      const right = tips.filter((t) => t.hand === 1 && t.src !== 'cam-tip');
      const inRest = (t) => Math.hypot(t.x - rg.cx, t.y - rg.cy) <= rg.r * 1.35;
      const restTips = tips.filter((t) => t.src !== 'cam-tip' && inRest(t));
      let minD = Infinity;
      left.forEach((a) => right.forEach((b) => {
        minD = Math.min(minD, Math.hypot(a.x - b.x, a.y - b.y));
      }));
      const joined = minD < Math.max(28, rg.r * 1.6) || restTips.length >= 2;
      if (joined) {
        if (clapArmed) {
          clapArmed = false;
          const ax = restTips[0] ? restTips[0].x : (left[0] && right[0] ? (left[0].x + right[0].x) / 2 : rg.cx);
          const ay = restTips[0] ? restTips[0].y : (left[0] && right[0] ? (left[0].y + right[0].y) / 2 : rg.cy);
          playClap(ax, ay);
        }
      } else if (minD > rg.r * 2.4 || (!left.length || !right.length)) {
        clapArmed = true;
      }
    }

    function collectTips(now, geoms) {
      const tips = [];
      const mouseOn = mouseTip
        ? geoms.map((g) => Math.hypot(mouseTip.x - g.cx, mouseTip.y - g.cy) <= g.r * HIT_R)
        : [false, false];
      camHands.forEach((h) => {
        if (mouseOn[h.hand]) return;
        tips.push({ hand: h.hand, x: h.x, y: h.y, src: 'cam' });
        (h.tips || []).forEach((p) => tips.push({ hand: h.hand, x: p.x, y: p.y, src: 'cam-tip' }));
      });
      if (mouseTip) tips.push({ ...mouseTip, hand: null, src: 'mouse' });
      keyHeld.forEach((i) => tips.push({ hand: i, x: geoms[i].cx, y: geoms[i].cy - geoms[i].r * 0.2, src: 'key' }));
      if (demo) {
        const t = now / 1000;
        [0, 1].forEach((i) => {
          const g = geoms[i];
          tips.push({ hand: i, x: g.cx + Math.sin(t * 1.15 + i * 1.9) * g.r * 1.45, y: g.cy + Math.sin(t * 2.1 + i) * g.r * 0.75, src: 'demo' });
        });
      }
      simTips.forEach((s) => {
        const g = geoms[s.hand];
        tips.push({ hand: s.hand, x: g.cx + s.rx * g.r * 0.9, y: g.cy + s.ry * g.r * 0.9, src: 'sim' });
      });
      return tips;
    }

    function pickTip(i, g, tips) {
      const list = tips.filter((t) => (t.hand === i || t.hand === null) && Math.hypot(t.x - g.cx, t.y - g.cy) <= g.r * HIT_R);
      if (!list.length) return null;
      list.sort((a, b) => {
        const ra = SRC_RANK[a.src] == null ? 9 : SRC_RANK[a.src];
        const rb = SRC_RANK[b.src] == null ? 9 : SRC_RANK[b.src];
        if (ra !== rb) return ra - rb;
        return Math.hypot(a.x - g.cx, a.y - g.cy) - Math.hypot(b.x - g.cx, b.y - g.cy);
      });
      return list[0];
    }

    function runDetect(now) {
      if (!landmarker || !stream || !alive || video.readyState < 2) return;
      const ts = Math.round(now);
      if (ts <= lastDetectTs) return;
      const frame = video.currentTime;
      if (frame !== 0 && frame === lastVideoTime && ts - lastDetectTs < 16) return;
      lastVideoTime = frame;
      lastDetectTs = ts;
      try {
        camHands = mapHands(landmarker.detectForVideo(video, ts), video, arena);
      } catch (err) {
        if (!/timestamp/i.test(String(err && err.message))) console.error(err);
      }
    }

    function startHandLoop() {
      stopHandLoop();
      if (typeof video.requestVideoFrameCallback !== 'function') return;
      const tick = (now) => {
        if (!alive || !stream) return;
        rvfc = video.requestVideoFrameCallback(tick);
        runDetect(now);
      };
      rvfc = video.requestVideoFrameCallback(tick);
    }

    function stopHandLoop() {
      if (rvfc && video.cancelVideoFrameCallback) {
        try {
          video.cancelVideoFrameCallback(rvfc);
        } catch {}
      }
      rvfc = 0;
    }

    function step(now) {
      const geoms = [geom(0), geom(1)];
      const rg = restGeom();
      if (!rvfc) runDetect(now);
      const tips = collectTips(now, geoms);
      maybeClap(tips, rg);
      if (stream && camHands.length) {
        const pts = camHands.flatMap((h) => h.points || [{ x: h.x, y: h.y }]);
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
        const rel = span / Math.min(arena.clientWidth || 1, arena.clientHeight || 1);
        const msg =
          rel > 0.72
            ? 'Afaste-se um pouco da câmera. Não encoste na lente.'
            : rel < 0.12
              ? 'Chegue um pouco mais perto para a câmera pegar as mãos.'
              : 'Boa distância. Não encoste na câmera.';
        distHint.textContent = msg;
        distHint.classList.toggle('is-warn', rel > 0.72 || rel < 0.12);
        if (!fsBar.hidden) fsHint.textContent = msg;
      }
      [0, 1].forEach((i) => {
        const g = geoms[i];
        const tip = pickTip(i, g, tips);
        const continuous = INSTRUMENT_BY_ID[config.instruments[i]].continuous;
        const bead = circles[i].querySelector('.air-bead');
        if (tip) {
          const rel = { rx: (tip.x - g.cx) / g.r, ry: (tip.y - g.cy) / g.r };
          const inRest = Math.hypot(tip.x - rg.cx, tip.y - rg.cy) <= rg.r;
          const inHole = inDeadzone(rel.rx, rel.ry) || inRest;
          pos[i] = rel;
          circles[i].style.setProperty('--bx', `${tip.x - g.cx}px`);
          circles[i].style.setProperty('--by', `${tip.y - g.cy}px`);
          if (bead) bead.classList.toggle('is-on', !inHole);
          if (inHole) {
            silenceHand(i);
            return;
          }
          lastNeutral[i] = false;
          const n = Math.max(1, sliceLabels(i).length);
          const slice = sliceIndex(rel.rx, rel.ry, n);
          if (!inside[i]) {
            inside[i] = true;
            hits[i]++;
            lastSlice[i] = slice;
            circles[i].classList.add('is-inside');
            let label;
            if (continuous) {
              holdTheremin(i, rel);
              label = lastLabel[i];
            } else {
              label = play(i, rel);
            }
            burst(tip.x, tip.y, INSTRUMENT_BY_ID[config.instruments[i]].color, label);
            pointAt(i, `${INSTRUMENT_BY_ID[config.instruments[i]].name}!`);
          } else if (continuous) {
            holdTheremin(i, rel);
            if (Math.random() < 0.25) effects.push({ kind: 'spark', x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, color: INSTRUMENT_BY_ID.theremin.color, t0: now, size: 4 });
          } else if (slice !== lastSlice[i]) {
            lastSlice[i] = slice;
            const label = play(i, rel);
            burst(tip.x, tip.y, INSTRUMENT_BY_ID[config.instruments[i]].color, label);
          }
        } else if (bead) {
          bead.classList.remove('is-on');
        }
        if (!tip && inside[i]) {
          inside[i] = false;
          lastSlice[i] = -1;
          pos[i] = null;
          lastNeutral[i] = false;
          circles[i].classList.remove('is-inside');
          if (continuous && engines && engines[i].release) engines[i].release();
          if (continuous) theremin[i] = null;
          if (continuous) log.noteOff(`theremin-${i}`);
        }
      });
      const restHot = tips.some((t) => t.src !== 'cam-tip' && Math.hypot(t.x - rg.cx, t.y - rg.cy) <= rg.r);
      rest.classList.toggle('is-inside', restHot);
      draw(now, tips);
    }

    function draw(now, tips) {
      const w = arena.clientWidth;
      const h = arena.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      const theme = themeTokens();

      camHands.forEach((hand) => {
        const color = hand.hand === 0 ? theme.accentHover : theme.accent;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        HAND_CONNECTIONS.forEach(([a, b]) => {
          const p = hand.points[a];
          const q = hand.points[b];
          if (!p || !q) return;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();
        (hand.points || []).forEach((p) => ctx.fillRect(Math.round(p.x - 3.5), Math.round(p.y - 3.5), 7, 7));
        ctx.globalAlpha = 1;
      });

      for (let k = effects.length - 1; k >= 0; k--) {
        const e = effects[k];
        const age = (now - e.t0) / 1000;
        const life = e.kind === 'text' ? 0.9 : e.kind === 'ring' ? 0.6 : 0.7;
        if (age > life) {
          effects.splice(k, 1);
          continue;
        }
        const a = 1 - age / life;
        ctx.globalAlpha = a;
        ctx.fillStyle = e.color;
        ctx.strokeStyle = e.color;
        if (e.kind === 'ring') {
          ctx.lineWidth = 4;
          const r = 12 + age * 220;
          ctx.strokeRect(Math.round(e.x - r), Math.round(e.y - r), Math.round(r * 2), Math.round(r * 2));
          ctx.beginPath();
          ctx.arc(e.x, e.y, Math.max(0, r * 0.75), 0, Math.PI * 2);
          ctx.stroke();
        } else if (e.kind === 'spark') {
          const f = age * 60;
          ctx.fillRect(Math.round(e.x + e.vx * f), Math.round(e.y + e.vy * f + age * age * 120), e.size, e.size);
        } else {
          ctx.font = `13px ${theme.font}`;
          ctx.textAlign = 'center';
          ctx.fillText(e.text, e.x, e.y - age * 50);
        }
      }
      ctx.globalAlpha = 1;

      tips.forEach((t) => {
        if (t.src === 'cam-tip') return;
        const color = t.hand === null ? theme.text : INSTRUMENT_BY_ID[config.instruments[t.hand]].color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.bg;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      step(now);
    }

    /* ---------- Câmera, mouse, teclado, demo ---------- */
    function cameraUiOn() {
      return Boolean(stream) || arena.classList.contains('has-camera');
    }

    function syncFsChrome() {
      const on = arena.classList.contains('is-fs') || document.fullscreenElement === arena;
      fsBar.hidden = !on;
      fsCam.hidden = !cameraUiOn();
      fsHint.textContent = cameraUiOn() ? 'Mostre as palmas. Esc também sai.' : 'Esc também sai.';
    }

    function setCameraUi(on) {
      arena.classList.toggle('has-camera', on);
      root.querySelector('.airx')?.classList.toggle('is-cam', on);
      distHint.hidden = !on;
      camBtn.disabled = false;
      camBtn.textContent = on ? 'Desligar câmera' : 'Ativar câmera';
      camBtn.setAttribute('aria-pressed', String(on));
      if (!on) {
        distHint.textContent = '';
        distHint.classList.remove('is-warn');
        status.textContent = 'O miolo preto é silêncio. Junte as mãos no meio para palmas. Mouse ou A / L.';
      }
      syncFsChrome();
    }

    function exitArena() {
      setArenaSize(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }

    function disableCamera({ exitFs = true } = {}) {
      stopHandLoop();
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      camHands = [];
      video.srcObject = null;
      resetHandSmooth();
      lastVideoTime = -1;
      lastDetectTs = 0;
      setCameraUi(false);
      if (exitFs) exitArena();
    }

    async function enableCamera() {
      if (cameraUiOn()) {
        disableCamera({ exitFs: true });
        return;
      }
      camBtn.disabled = true;
      status.textContent = 'Carregando o detector de mãos local (MediaPipe)…';
      try {
        const [lm, s] = await Promise.all([
          loadHandLandmarker(),
          navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
            audio: false
          })
        ]);
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        landmarker = lm;
        stream = s;
        resetHandSmooth();
        lastVideoTime = -1;
        lastDetectTs = 0;
        video.srcObject = s;
        await video.play();
        if (!(video.readyState >= 2 && video.videoWidth)) {
          await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
        }
        setCameraUi(true);
        status.textContent = 'Mostre as palmas. Hub continua no topo; Tela cheia amplia o palco. Esc sai da tela cheia.';
        ensureAudio().catch(() => {});
        startHandLoop();
      } catch (err) {
        console.error(err);
        disableCamera({ exitFs: false });
        status.textContent = `Câmera indisponível (${err.name || err.message}). Use o mouse, as teclas A/L ou “Simular dedos”.`;
      }
    }

    function setDemo(on) {
      demo = on;
      demoBtn.textContent = `Simular dedos: ${on ? 'Sim' : 'Não'}`;
      demoBtn.setAttribute('aria-pressed', String(on));
      demoBtn.classList.toggle('is-active', on);
      if (on) ensureAudio().catch(() => {});
    }

    function onPointerMove(e) {
      if (!alive) return;
      if (e.type === 'pointerup' && e.pointerType !== 'mouse') {
        mouseTip = null;
        return;
      }
      if (!pointerInArena(e.clientX, e.clientY)) {
        mouseTip = null;
        return;
      }
      mouseTip = clientToArena(e.clientX, e.clientY);
    }
    const onBlur = () => {
      mouseTip = null;
    };
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerdown', onPointerMove, { capture: true });
    window.addEventListener('pointerup', onPointerMove, { capture: true });
    window.addEventListener('blur', onBlur);
    arena.addEventListener('pointerdown', (e) => {
      ensureAudio().catch(() => {});
      onPointerMove(e);
      const c = e.target.closest('[data-circle]');
      if (!c) return;
      const i = Number(c.dataset.circle);
      if (inside[i] && pos[i] && !inDeadzone(pos[i].rx, pos[i].ry)) {
        const label = play(i, pos[i]);
        const p = clientToArena(e.clientX, e.clientY);
        if (label) burst(p.x, p.y, INSTRUMENT_BY_ID[config.instruments[i]].color, label);
      }
    });

    const isEsc = (e) => e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape';
    const arenaTrapped = () =>
      arena.classList.contains('is-fs') ||
      document.documentElement.classList.contains('is-airpads-fs') ||
      document.fullscreenElement === arena ||
      Boolean(document.fullscreenElement);
    const onKeyDown = (e) => {
      if (isEsc(e) && arenaTrapped()) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        exitArena();
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      if (e.target && typeof e.target.matches === 'function' && e.target.matches('input, select, textarea')) return;
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) {
        keyHeld.add(i);
        ensureAudio().catch(() => {});
      }
    };
    const onKeyUp = (e) => {
      if (isEsc(e) && arenaTrapped()) {
        e.preventDefault();
        exitArena();
        return;
      }
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) keyHeld.delete(i);
    };
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);

    /* ---------- Gravação (vai para a Galeria como áudio) ---------- */
    function syncAirpadsDock() {
      const hide = arena.classList.contains('is-fs') || Boolean(rec);
      document.documentElement.classList.toggle('is-recording', Boolean(rec));
      setDockVisible(!hide);
    }

    async function stopRecording() {
      const r = rec;
      rec = null;
      clearInterval(recTimer);
      recBtn.classList.remove('is-active');
      recBtn.setAttribute('aria-pressed', 'false');
      recBtn.querySelector('.btn__text').textContent = 'Gravar: Não';
      syncAirpadsDock();
      const events = log.stopTake();
      const { blob, seconds } = await r.stop();
      r.dispose();
      const names = config.instruments.map((id) => INSTRUMENT_BY_ID[id].name).join(' + ');
      const title = `Air Pads · ${names} · ${stamp()}`;
      const item = await gallery.addBlob('audio', title, 'airpads', blob, { seconds, bpm: config.bpm, instruments: [...config.instruments], scale: config.scale, root: config.root, ...eventsSummary(events) }, events);
      return item;
    }

    recBtn.addEventListener('click', async () => {
      try {
        if (rec) {
          recBtn.disabled = true;
          const item = await stopRecording();
          toast(`Gravação “${item.name}” foi para a Galeria!`, 'ok', 3600);
          dockSay('Que performance! Está na Galeria.');
        } else {
          await ensureAudio();
          rec = await createOutputRecorder();
          rec.start();
          log.startTake();
          const t0 = Date.now();
          timer.textContent = '00:00';
          recTimer = setInterval(() => {
            const s = Math.floor((Date.now() - t0) / 1000);
            timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
          }, 250);
          recBtn.classList.add('is-active');
          recBtn.setAttribute('aria-pressed', 'true');
          recBtn.querySelector('.btn__text').textContent = 'Gravar: Sim';
          syncAirpadsDock();
        }
      } catch (err) {
        toast(`Falhou a gravação: ${err.message}`, 'error');
      } finally {
        recBtn.disabled = false;
      }
    });

    function sendToStudio() {
      const json = log.recent();
      if (!json) return toast('Toque alguma coisa primeiro: tudo que você tocar vira notas no Studio.', 'info');
      openInStudio(json);
    }
    const studioBtn = el('button', { class: 'btn btn--ghost', title: 'Leva tudo que você tocou (notas, tempo, instrumento) para editar no Studio', onclick: sendToStudio }, 'Editar no Studio');

    camBtn.addEventListener('click', enableCamera);
    demoBtn.addEventListener('click', () => setDemo(!demo));
    function setArenaSize(on) {
      arena.classList.toggle('is-fs', on);
      root.querySelector('.airx')?.classList.toggle('is-arena-fs', on);
      document.documentElement.classList.toggle('is-airpads-fs', on);
      fsBtn.textContent = on ? 'Encolher palco' : 'Tela cheia';
      fsBtn.setAttribute('aria-pressed', String(on));
      syncAirpadsDock();
      resetHandSmooth();
      lastVideoTime = -1;
      syncFsChrome();
      if (on) video.play().catch(() => {});
    }
    let fsOp = Promise.resolve();
    async function toggleArenaSize(on) {
      const next = typeof on === 'boolean' ? on : !arena.classList.contains('is-fs');
      setArenaSize(next);
      const op = fsOp.then(async () => {
        try {
          if (!alive) return;
          if (!next && document.fullscreenElement) await document.exitFullscreen();
        } catch {}
      });
      fsOp = op.catch(() => {});
      return op;
    }
    fsBtn.addEventListener('click', () => toggleArenaSize());
    fsExit.addEventListener('click', () => exitArena());
    fsCam.addEventListener('click', () => disableCamera({ exitFs: true }));
    fsBack.addEventListener('click', () => exitArena());
    const onFsChange = () => {
      if (document.fullscreenElement === arena) {
        if (!arena.classList.contains('is-fs')) setArenaSize(true);
        return;
      }
      if (arena.classList.contains('is-fs')) setArenaSize(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    scaleSel.addEventListener('change', () => {
      config.scale = scaleSel.value;
      log.set({ scale: config.scale });
      bubble.textContent = `Escala ${SCALE_BY_ID[config.scale].name}!`;
      renderAll();
    });
    rootSel.addEventListener('change', () => {
      config.root = Number(rootSel.value);
      log.set({ root: config.root });
      bubble.textContent = `Tom de ${ROOTS[config.root]}!`;
      renderAll();
    });
    bpmInput.addEventListener('input', () => {
      config.bpm = Number(bpmInput.value);
      log.set({ bpm: config.bpm });
      bpmLabel.textContent = `${config.bpm} BPM`;
      if (Tone) Tone.Transport.bpm.value = config.bpm;
    });
    metroBtn.addEventListener('click', () => {
      config.metronome = !config.metronome;
      renderMetro();
      if (config.metronome) ensureAudio().catch(() => {});
    });

    root.append(
      el(
        'div',
        { class: 'airx' },
        el(
          'section',
          { class: 'panel airx__controls' },
          el(
            'div',
            { class: 'airx__pick' },
            el('div', { class: 'field' }, el('span', { class: 'field__label' }, `Círculo da ${HANDS[0].toLowerCase()}`), chipRows[0]),
            el('div', { class: 'field' }, el('span', { class: 'field__label' }, `Círculo da ${HANDS[1].toLowerCase()}`), chipRows[1])
          ),
          el(
            'div',
            { class: 'toolbar airx__settings' },
            el('label', { class: 'airx__setting' }, el('span', { class: 'field__label' }, 'Escala'), scaleSel),
            el('label', { class: 'airx__setting' }, el('span', { class: 'field__label' }, 'Tônica'), rootSel),
            el('label', { class: 'airx__setting' }, el('span', { class: 'field__label' }, 'BPM'), bpmLabel, bpmInput),
            metroBtn
          ),
          distHint
        ),
        el('section', { class: 'panel airx__stage' }, el('div', { class: 'toolbar' }, camBtn, fsBtn, demoBtn, recBtn, timer, studioBtn, status), arena)
      )
    );
    renderAll();
    raf = requestAnimationFrame(frame);
    if (params.demo) setDemo(true);
    if (params.fs) setArenaSize(true);
    if (params.cam) setCameraUi(true);

    window.__mmpAirPads = {
      state: () => ({
        hits: [...hits],
        inside: [...inside],
        labels: [...lastLabel],
        instruments: [...config.instruments],
        theremin: theremin.map((t) => (t ? { ...t } : null)),
        recording: Boolean(rec),
        audio: Boolean(engines),
        fullscreen: arena.classList.contains('is-fs'),
        camera: cameraUiOn(),
        hands: camHands.length,
        deadzone: DEADZONE,
        neutral: [...lastNeutral]
      }),
      setArenaSize,
      exitArena,
      disableCamera,
      simulateCamera: (on) => {
        if (on) setCameraUi(true);
        else disableCamera({ exitFs: false });
      },
      tap(i, rx = 0, ry = 0) {
        simTips = simTips.filter((t) => t.hand !== i).concat({ hand: i, rx, ry });
      },
      release(i) {
        simTips = i === undefined ? [] : simTips.filter((t) => t.hand !== i);
      },
      setInstrument,
      events: () => log.recent(),
      sendToStudio,
      ready: () => ensureAudio()
    };

    return {
      async save() {
        await kv.set('airpads', normalize(config));
        const names = config.instruments.map((id) => INSTRUMENT_BY_ID[id].name).join(' + ');
        return `Configuração salva: ${names}, ${SCALE_BY_ID[config.scale].name} em ${ROOTS[config.root]}, ${config.bpm} BPM.`;
      },
      unmount() {
        alive = false;
        stopHandLoop();
        document.documentElement.classList.remove('is-airpads-fs', 'is-recording');
        document.removeEventListener('fullscreenchange', onFsChange);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        setDockVisible(true);
        cancelAnimationFrame(raf);
        clearTimeout(pointTimer);
        window.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('pointermove', onPointerMove, { capture: true });
        window.removeEventListener('pointerdown', onPointerMove, { capture: true });
        window.removeEventListener('pointerup', onPointerMove, { capture: true });
        window.removeEventListener('blur', onBlur);
        if (window.__mmpAirPads) delete window.__mmpAirPads;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (rec) stopRecording().then((item) => toast(`Gravação “${item.name}” salva na Galeria.`, 'ok')).catch(() => {});
        if (Tone) {
          Tone.Transport.stop();
          Tone.Transport.cancel();
        }
        [repeatLoop, metroLoop, metroSynth, clapEng].forEach((n) => n && n.dispose());
        if (engines) engines.forEach((e) => e.dispose());
        if (out) setTimeout(() => out.dispose(), 500);
      }
    };
  }
};
