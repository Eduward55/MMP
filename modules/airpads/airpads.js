// Air Pads: dois círculos no ar, um por mão. A ponta do indicador (MediaPipe, local) entra no círculo e toca.
// Sem câmera, o mouse, as teclas A/L ou o "Simular dedos" fazem o papel das pontas dos dedos.
import { createOutputRecorder } from '../shared/audio.js';
import { creatureSVG } from '../shared/creatures.js';
import { dockSay } from '../shared/companion.js';
import { createEventLog, eventsSummary, openInStudio } from '../shared/events.js';
import { gallery, getProfile, kv } from '../shared/store.js';
import { el, startAudio, stamp, toast } from '../shared/ui.js';
import { loadHandLandmarker, mapHands } from './hands.js';
import {
  DRUM_ZONES,
  INSTRUMENTS,
  INSTRUMENT_BY_ID,
  ROOTS,
  SCALES,
  SCALE_BY_ID,
  createInstrument,
  drumZone,
  midiName,
  pickNote,
  scaleNotes
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
  desc: 'Dois círculos no ar, um por mão: piano, bateria, synth, baixo e theremin.',
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
    let camHands = [];
    let mouseTip = null;
    let simTips = [];
    let demo = false;
    let rec = null;
    let recTimer = 0;
    let pointTimer = 0;
    const keyHeld = new Set();
    const inside = [false, false];
    const pos = [null, null];
    const hits = [0, 0];
    const lastTrig = [0, 0];
    const lastLabel = ['', ''];
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
    const maestro = el(
      'div',
      { class: 'air-maestro', title: `${profile.cat.name}, o maestro` },
      bubble,
      el('div', { class: 'air-maestro__cat', html: creatureSVG('cat', { ...profile.cat, outfit: { ...profile.cat.outfit, hand: 'batuta' } }, { size: 112, label: `${profile.cat.name}, maestro` }) }),
      el('span', { class: 'air-maestro__name' }, profile.cat.name)
    );
    const arena = el('div', { class: 'airx__arena' }, video, ...circles, canvas, ...huds, maestro);

    const camBtn = el('button', { class: 'btn btn--primary' }, 'Ativar câmera');
    const demoBtn = el('button', { class: 'btn btn--ghost', 'aria-pressed': 'false' }, 'Simular dedos: Não');
    const recBtn = el('button', { class: 'btn btn--rec', 'aria-pressed': 'false' }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar: Não'));
    const timer = el('span', { class: 'pill' }, '00:00');
    const status = el('p', { class: 'muted airx__status' }, 'Sem câmera? Passe o mouse pelos círculos (vale como ponta do dedo) ou segure A e L.');

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

    function renderCircle(i) {
      const inst = INSTRUMENT_BY_ID[config.instruments[i]];
      const c = circles[i];
      c.style.setProperty('--c', inst.color);
      c.dataset.instrument = inst.id;
      let guide = '';
      if (inst.id === 'drums') guide = DRUM_ZONES.map((z) => `<span class="air-zone">${z}</span>`).join('');
      else if (inst.continuous) guide = '<span class="air-axis air-axis--x">grave ◀ X ▶ agudo</span><span class="air-axis air-axis--y">▲ volume</span>';
      else guide = `<span class="air-axis air-axis--top">agudo</span><span class="air-axis air-axis--bottom">grave</span>`;
      c.innerHTML = `<span class="air-circle__guide">${guide}</span><span class="air-circle__name">${inst.name}</span><span class="air-circle__note">${lastLabel[i] || '—'}</span>`;
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
          out = new Tone.Gain(0.9).toDestination();
          engines = config.instruments.map((id) => createInstrument(Tone, id, out));
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
        value = drumZone(rel.ry);
        label = DRUM_ZONES[value];
      } else {
        value = pickNote(notesFor(i), rel.ry);
        label = midiName(value);
      }
      lastTrig[i] = performance.now();
      log.note({ note: id === 'drums' ? DRUM_NOTES[value] : value, inst: id, ...trackOf(i), time, dur: (id === 'piano' ? 60 : 30) / config.bpm, vel: 0.85 });
      const fire = () => engines && engines[i] && engines[i].play(value, time);
      if (engines) fire();
      else ensureAudio().then(fire).catch(() => {});
      const show = () => {
        lastLabel[i] = label;
        circles[i].querySelector('.air-circle__note').textContent = label;
        huds[i].querySelector('.air-hud__note').textContent = label;
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
      circles[i].querySelector('.air-circle__note').textContent = label;
      huds[i].querySelector('.air-hud__note').textContent = label;
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
    function geom(i) {
      const a = arena.getBoundingClientRect();
      const r = circles[i].getBoundingClientRect();
      return { cx: r.left - a.left + r.width / 2, cy: r.top - a.top + r.height / 2, r: r.width / 2 };
    }

    function collectTips(now, geoms) {
      const tips = [];
      camHands.forEach((h) => tips.push({ hand: h.hand, x: h.x, y: h.y, src: 'cam' }));
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

    function step(now) {
      const geoms = [geom(0), geom(1)];
      if (landmarker && stream && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          camHands = mapHands(landmarker.detectForVideo(video, now), video, arena.clientWidth, arena.clientHeight);
        } catch (err) {
          console.error(err);
        }
      }
      const tips = collectTips(now, geoms);
      [0, 1].forEach((i) => {
        const g = geoms[i];
        const tip = tips.find((t) => (t.hand === i || t.hand === null) && Math.hypot(t.x - g.cx, t.y - g.cy) <= g.r);
        const continuous = INSTRUMENT_BY_ID[config.instruments[i]].continuous;
        if (tip) {
          const rel = { rx: (tip.x - g.cx) / g.r, ry: (tip.y - g.cy) / g.r };
          pos[i] = rel;
          if (!inside[i]) {
            inside[i] = true;
            hits[i]++;
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
          }
        } else if (inside[i]) {
          inside[i] = false;
          pos[i] = null;
          circles[i].classList.remove('is-inside');
          if (continuous && engines && engines[i].release) engines[i].release();
          if (continuous) theremin[i] = null;
          if (continuous) log.noteOff(`theremin-${i}`);
        }
      });
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

      camHands.forEach((hand) => {
        ctx.fillStyle = hand.hand === 0 ? 'rgba(95,243,255,0.75)' : 'rgba(255,79,216,0.75)';
        hand.points.forEach((p) => ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 3), 6, 6));
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
          ctx.font = '14px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(e.text, e.x, e.y - age * 50);
        }
      }
      ctx.globalAlpha = 1;

      tips.forEach((t) => {
        const color = t.hand === null ? '#f6ecff' : INSTRUMENT_BY_ID[config.instruments[t.hand]].color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(t.x - 7), Math.round(t.y - 7), 14, 14);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#120a20';
        ctx.fillRect(Math.round(t.x - 3), Math.round(t.y - 3), 6, 6);
      });
    }

    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      step(now);
    }

    /* ---------- Câmera, mouse, teclado, demo ---------- */
    async function enableCamera() {
      camBtn.disabled = true;
      status.textContent = 'Carregando o detector de mãos local (MediaPipe)…';
      try {
        const [lm, s] = await Promise.all([loadHandLandmarker(), navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })]);
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        landmarker = lm;
        stream = s;
        video.srcObject = s;
        await video.play();
        arena.classList.add('has-camera');
        camBtn.textContent = 'Câmera ligada';
        status.textContent = 'Mostre as duas mãos! Encoste a ponta do indicador em cada círculo.';
        ensureAudio().catch(() => {});
      } catch (err) {
        console.error(err);
        camBtn.disabled = false;
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

    arena.addEventListener('pointermove', (e) => {
      const a = arena.getBoundingClientRect();
      mouseTip = { x: e.clientX - a.left, y: e.clientY - a.top };
    });
    arena.addEventListener('pointerleave', () => (mouseTip = null));
    arena.addEventListener('pointerdown', (e) => {
      ensureAudio().catch(() => {});
      const c = e.target.closest('[data-circle]');
      if (!c) return;
      const i = Number(c.dataset.circle);
      if (inside[i] && pos[i]) {
        const label = play(i, pos[i]);
        const a = arena.getBoundingClientRect();
        if (label) burst(e.clientX - a.left, e.clientY - a.top, INSTRUMENT_BY_ID[config.instruments[i]].color, label);
      }
    });

    const onKeyDown = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.target.matches('input, select, textarea')) return;
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) {
        keyHeld.add(i);
        ensureAudio().catch(() => {});
      }
    };
    const onKeyUp = (e) => {
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) keyHeld.delete(i);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    /* ---------- Gravação (vai para a Galeria como áudio) ---------- */
    async function stopRecording() {
      const r = rec;
      rec = null;
      clearInterval(recTimer);
      recBtn.classList.remove('is-active');
      recBtn.setAttribute('aria-pressed', 'false');
      recBtn.querySelector('.btn__text').textContent = 'Gravar: Não';
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
    scaleSel.addEventListener('change', () => {
      config.scale = scaleSel.value;
      log.set({ scale: config.scale });
      bubble.textContent = `Escala ${SCALE_BY_ID[config.scale].name}!`;
    });
    rootSel.addEventListener('change', () => {
      config.root = Number(rootSel.value);
      log.set({ root: config.root });
      bubble.textContent = `Tom de ${ROOTS[config.root]}!`;
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
        el('section', { class: 'panel airx__stage' }, el('div', { class: 'toolbar' }, camBtn, demoBtn, recBtn, timer, studioBtn, status), arena),
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
          el('p', { class: 'hint' }, 'Entrou no círculo, tocou. Segurando dentro, repete no ritmo do BPM. Altura no círculo = nota (bateria: chimbal, caixa, bumbo). Theremin: X = nota, Y = volume. Gravar: Sim manda o áudio (com as notas) para a Galeria; Editar no Studio leva tudo que você tocou; Salvar guarda instrumentos, escala e BPM.')
        )
      )
    );
    renderAll();
    raf = requestAnimationFrame(frame);
    if (params.demo) setDemo(true);

    window.__mmpAirPads = {
      state: () => ({
        hits: [...hits],
        inside: [...inside],
        labels: [...lastLabel],
        instruments: [...config.instruments],
        theremin: theremin.map((t) => (t ? { ...t } : null)),
        recording: Boolean(rec),
        audio: Boolean(engines)
      }),
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
        cancelAnimationFrame(raf);
        clearTimeout(pointTimer);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        if (window.__mmpAirPads) delete window.__mmpAirPads;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (rec) stopRecording().then((item) => toast(`Gravação “${item.name}” salva na Galeria.`, 'ok')).catch(() => {});
        if (Tone) {
          Tone.Transport.stop();
          Tone.Transport.cancel();
        }
        [repeatLoop, metroLoop, metroSynth].forEach((n) => n && n.dispose());
        if (engines) engines.forEach((e) => e.dispose());
        if (out) setTimeout(() => out.dispose(), 500);
      }
    };
  }
};
