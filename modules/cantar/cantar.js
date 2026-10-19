// Cantar: voz no microfone, autotune, talkbox e mix com arpejo/beat.
import { createOutputRecorder } from '../shared/audio.js';
import { creatureSVG } from '../shared/creatures.js';
import { beatFromJson } from '../beatcats/beatcats.js';
import { LOOP_STEPS, SOUND_BY_ID, makeCaptured } from '../beatcats/sounds.js';
import { createEventLog } from '../shared/events.js';
import { gallery, getProfile } from '../shared/store.js';
import { el, modal, startAudio, stamp, toast } from '../shared/ui.js';
import { FX, OVERLAY_IDS, createVoiceFx, fingerprint, graphFor, normalizeFxId } from './voice-fx.js';
import {
  OTTER_INTERVAL_MAX,
  OTTER_INTERVAL_MIN,
  OTTER_REC_MAX,
  OTTER_REC_MIN,
  clampOtterSeconds,
  decodePhraseBlob,
  formatOtterSeconds,
  makeBeepBuffer,
  recordPhraseFromStream,
  startOtterLoopPlayer
} from './otter-loops.js';

const SCALE = [0, 2, 3, 5, 7, 8, 10];
const OTTER_SLOTS = 3;

function detectPitchYin(buf, sr) {
  const half = Math.floor(buf.length / 2);
  if (half < 32) return 0;
  const yin = new Float32Array(half);
  for (let tau = 1; tau < half; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const d = buf[i] - buf[i + tau];
      sum += d * d;
    }
    yin[tau] = sum;
  }
  yin[0] = 1;
  let run = 0;
  for (let tau = 1; tau < half; tau++) {
    run += yin[tau];
    yin[tau] *= tau / (run || 1);
  }
  const thresh = 0.12;
  let tau = Math.floor(sr / 900);
  const maxTau = Math.min(half - 2, Math.floor(sr / 70));
  let found = 0;
  for (; tau < maxTau; tau++) {
    if (yin[tau] < thresh) {
      while (tau + 1 < maxTau && yin[tau + 1] < yin[tau]) tau++;
      found = tau;
      break;
    }
  }
  if (!found) return 0;
  const x0 = yin[found - 1];
  const x1 = yin[found];
  const x2 = yin[found + 1];
  const denom = 2 * (2 * x1 - x2 - x0);
  const better = found + (denom ? (x2 - x0) / denom : 0);
  const hz = sr / better;
  if (hz < 70 || hz > 900) return 0;
  return hz;
}

function snapHz(hz) {
  if (!hz) return 0;
  const midi = 69 + 12 * Math.log2(hz / 440);
  const oct = Math.round(midi / 12) * 12;
  let nearest = midi;
  let dist = 99;
  for (let o = -1; o <= 1; o++) {
    SCALE.forEach((s) => {
      const n = oct + o * 12 + s;
      const d = Math.abs(n - midi);
      if (d < dist) {
        dist = d;
        nearest = n;
      }
    });
  }
  return 440 * Math.pow(2, (nearest - 69) / 12);
}

export default {
  id: 'cantar',
  title: 'Cantar',
  icon: 'cantar',
  accent: '#f472b6',
  desc: 'Cante no microfone, coloque autotune ou talkbox e misture com arpejo ou um beat da Galeria.',
  async mount(root) {
    const profile = getProfile();
    let alive = true;
    let Tone = null;
    let audioPromise = null;
    let stream = null;
    let micNode = null;
    let voiceFx = null;
    let backingGain = null;
    let rec = null;
    let recTimer = 0;
    let raf = 0;
    let rms = 0;
    let pitchHz = 0;
    let pitchFrame = 0;
    let mouthOpen = false;
    let fx = 'natural';
    let autotune = false;
    let backing = 'arpeggio';
    let bpm = 100;
    let sync = true;
    let backingLoop = null;
    let backingVoices = [];
    let otterGain = null;
    let otterAnimRaf = 0;
    let otterBusy = false;
    let otterRecSession = null;
    const otterPlayers = new Array(OTTER_SLOTS).fill(null);
    const otterClips = new Array(OTTER_SLOTS).fill(null);
    const otterUi = Array.from({ length: OTTER_SLOTS }, () => ({ recording: false, looping: false, singing: false }));
    const log = createEventLog({ source: 'cantar', bpm, scale: 'minor', root: 9 });

    const nameInput = el('input', { class: 'input', type: 'text', maxlength: '60', value: `Canto ${stamp()}`, 'aria-label': 'Nome da gravação' });
    const micBtn = el('button', { class: 'btn btn--primary' }, 'Ligar microfone');
    const recBtn = el('button', { class: 'btn btn--rec', disabled: true }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar'));
    const timer = el('span', { class: 'pill' }, '00:00');
    const status = el('p', { class: 'muted' }, 'Ligue o microfone e cante. Cada chip muda a voz de um jeito — Natural fica limpo.');
    const fxRow = el('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Modificador de voz' });
    const fxCaption = el('p', { class: 'cantar__fx-now' }, FX[0].hint);
    const autoBtn = el('button', { class: 'btn btn--ghost btn--sm', 'aria-pressed': 'false' }, 'Autotune: Não');
    const syncBtn = el('button', { class: 'btn btn--ghost btn--sm', 'aria-pressed': 'true' }, 'Sync: Sim');
    const bpmInput = el('input', { class: 'range', type: 'range', min: '70', max: '140', value: String(bpm), 'aria-label': 'BPM' });
    const bpmLabel = el('span', { class: 'pill' }, `${bpm} BPM`);
    const mixInput = el('input', { class: 'range', type: 'range', min: '0', max: '100', value: '78', 'aria-label': 'Mix da voz' });
    const backingSel = el('select', { class: 'input input--select', 'aria-label': 'Base' });
    const catStage = el('div', { class: 'cantar__cat' });
    const ottersRow = el('div', { class: 'cantar__otters' });
    const meterFill = el('div', { class: 'cantar__meter-fill' });
    const meter = el('div', { class: 'cantar__meter', title: 'Volume da voz' }, meterFill);

    function currentGraph() {
      return voiceFx ? voiceFx.snapshot() : graphFor(fx, autotune);
    }

    function paintCat() {
      const svg = catStage.querySelector('svg.creature');
      if (!svg) {
        catStage.innerHTML = creatureSVG('cat', { ...profile.cat, outfit: { ...profile.cat.outfit, hand: 'microfone' } }, { size: 220, label: `${profile.cat.name} cantando`, extraClass: mouthOpen ? 'is-sing-open' : 'is-idle' });
        return;
      }
      svg.classList.toggle('is-sing-open', mouthOpen);
      svg.classList.toggle('is-idle', !mouthOpen);
    }

    function otterCard(i) {
      return ottersRow.querySelector(`.cantar__otter[data-slot="${i}"]`);
    }

    function renderOtters() {
      ottersRow.innerHTML = '';
      for (let i = 0; i < OTTER_SLOTS; i++) {
        const clip = otterClips[i];
        const ui = otterUi[i];
        const looping = Boolean(clip && ui.looping);
        const card = el(
          'div',
          {
            class: `cantar__otter${clip ? ' is-on' : ''}${ui.recording ? ' is-recording' : ''}${looping ? ' is-looping' : ''}${ui.singing ? ' is-singing' : ''}`,
            'data-slot': String(i)
          },
          el('div', {
            class: 'cantar__otter-art',
            html: creatureSVG('otter', profile.otter, {
              size: 86,
              extraClass: ui.recording || looping ? 'is-dancing' : 'is-idle',
              label: `${profile.otter.name} ${i + 1}`
            })
          }),
          el('span', { class: 'cantar__otter-name' }, `Lontrinha ${i + 1}`),
          ui.recording ? el('span', { class: 'cantar__otter-countdown' }, 'Gravando…') : null,
          clip
            ? el(
                'label',
                { class: 'cantar__otter-interval' },
                el('span', {}, 'Repete a cada'),
                el('input', {
                  class: 'input cantar__otter-interval-num',
                  type: 'number',
                  min: String(OTTER_INTERVAL_MIN),
                  max: String(OTTER_INTERVAL_MAX),
                  step: '0.5',
                  value: String(clip.interval),
                  'aria-label': `Intervalo da lontrinha ${i + 1} em segundos`,
                  oninput: (e) => {
                    const v = clampOtterSeconds(e.target.value, OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, clip.interval);
                    clip.interval = v;
                  },
                  onchange: (e) => {
                    const v = clampOtterSeconds(e.target.value, OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, clip.interval);
                    clip.interval = v;
                    e.target.value = String(v);
                    if (ui.looping) startOtterLoop(i).catch((err) => toast(err.message, 'error'));
                  }
                }),
                el('span', {}, 's')
              )
            : null,
          el(
            'div',
            { class: 'cantar__otter-actions' },
            el('button', { class: 'btn btn--sm btn--primary', onclick: () => recordOtter(i) }, ui.recording ? 'Gravando…' : clip ? 'Regravar' : 'Gravar frase'),
            clip ? el('button', { class: 'btn btn--sm btn--ghost', onclick: () => clearOtter(i) }, 'Parar') : null
          )
        );
        ottersRow.append(card);
      }
      paintOtterAnims();
      if (otterUi.some((u) => u.looping || u.recording)) startOtterAnim();
    }

    function renderFx() {
      fxRow.innerHTML = '';
      FX.forEach((f) => {
        fxRow.append(
          el(
            'button',
            {
              class: `chip ${fx === f.id ? 'is-on' : ''}`,
              role: 'radio',
              'aria-checked': String(fx === f.id),
              onclick: () => {
                fx = f.id;
                applyFx();
              }
            },
            f.name
          )
        );
      });
      const meta = FX.find((f) => f.id === fx);
      const extra = autotune && OVERLAY_IDS.has(fx) ? ' Autotune por cima.' : fx === 'autotune' ? '' : '';
      fxCaption.textContent = `${meta ? meta.hint : ''}`.trim() + extra;
    }

    async function fillBacking() {
      backingSel.innerHTML = '';
      backingSel.append(el('option', { value: 'none' }, 'Sem base'), el('option', { value: 'arpeggio' }, 'Arpejo menor'));
      try {
        const items = await gallery.list();
        items
          .filter((i) => i.type === 'beat' || i.type === 'audio')
          .forEach((i) => backingSel.append(el('option', { value: `${i.type}:${i.id}` }, `${i.type === 'beat' ? 'Beat' : 'Áudio'} · ${i.name}`)));
      } catch {}
      backingSel.value = backing === 'arpeggio' || backing === 'none' ? backing : backingSel.querySelector(`option[value="${backing}"]`) ? backing : 'arpeggio';
      backing = backingSel.value;
    }

    function applyFx() {
      fx = normalizeFxId(fx);
      if (voiceFx) voiceFx.apply(fx, autotune);
      renderMix();
      renderFx();
    }

    async function ensureAudio() {
      if (!audioPromise) {
        audioPromise = (async () => {
          Tone = await startAudio();
          if (!alive) return;
          voiceFx = createVoiceFx(Tone);
          backingGain = new Tone.Gain(0.36).toDestination();
          Tone.Transport.bpm.value = bpm;
          applyFx();
        })();
        audioPromise.catch((err) => {
          audioPromise = null;
          toast(`Áudio indisponível: ${err.message}`, 'error');
        });
      }
      return audioPromise;
    }

    async function startMic() {
      await ensureAudio();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });
      const src = Tone.context.createMediaStreamSource(stream);
      micNode = new Tone.Gain(1.05);
      Tone.connect(src, micNode);
      Tone.connect(micNode, voiceFx.input);
      recBtn.disabled = false;
      micBtn.textContent = 'Microfone ligado';
      micBtn.disabled = true;
      status.textContent = 'Cante perto do microfone. Natural fica limpo; cada chip liga um efeito diferente.';
      applyFx();
      if (sync) Tone.Transport.start('+0.05');
      tickMouth();
      await startBacking();
    }

    function tickMouth() {
      if (!alive || !voiceFx || !voiceFx.analyser) return;
      const analyser = voiceFx.analyser;
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      const n = Math.min(buf.length, 1024);
      for (let i = 0; i < n; i++) sum += buf[i] * buf[i];
      rms = Math.sqrt(sum / n);
      const g = voiceFx.snapshot();
      voiceFx.setGate(rms > 0.016, g.gateFloor);
      voiceFx.setNoiseEnvelope(rms);
      const open = rms > 0.025;
      if (open !== mouthOpen) {
        mouthOpen = open;
        paintCat();
      }
      meterFill.style.width = `${Math.min(100, rms * 420)}%`;
      pitchFrame++;
      const wantsSnap = fx === 'autotune' || (autotune && OVERLAY_IDS.has(fx));
      if (pitchFrame % 2 === 0) {
        const hz = detectPitchYin(buf, Tone.context.sampleRate);
        if (hz) {
          pitchHz = hz;
          const snapped = snapHz(hz);
          if (wantsSnap && snapped) {
            const semis = 12 * Math.log2(snapped / hz);
            voiceFx.setTune(semis);
          } else {
            voiceFx.setTune(0);
          }
          if (fx === 'talkbox') voiceFx.setCarrierHz((autotune && snapped) || hz);
        }
      }
      raf = requestAnimationFrame(tickMouth);
    }

    async function startBacking() {
      stopBacking();
      if (!Tone || backing === 'none') return;
      if (backing === 'arpeggio') {
        const synth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.12, sustain: 0, release: 0.08 }, volume: -14 }).connect(backingGain);
        const notes = ['A3', 'C4', 'E4', 'A4', 'E4', 'C4'];
        let i = 0;
        backingLoop = new Tone.Loop((time) => {
          const n = notes[i % notes.length];
          synth.triggerAttackRelease(n, '8n', time);
          log.note({ note: Tone.Frequency(n).toMidi(), inst: 'keys', track: 'arpejo', time, dur: 30 / bpm, vel: 0.6 });
          i++;
        }, '8n').start(0);
        backingVoices = [synth];
        if (Tone.Transport.state !== 'started') Tone.Transport.start('+0.05');
        return;
      }
      const [kind, id] = backing.split(':');
      if (kind !== 'beat' || !id) return;
      try {
        const read = await gallery.read(id);
        const beat = beatFromJson(read.json || {});
        beat.cats.filter(Boolean).forEach((sid) => {
          if (!SOUND_BY_ID[sid]) return;
          backingVoices.push(makeCaptured(Tone, sid, backingGain, log));
        });
        let step = 0;
        backingLoop = new Tone.Loop((time) => {
          backingVoices.forEach((v) => v.tick && v.tick(step % LOOP_STEPS, time));
          step++;
        }, '16n').start(0);
        if (Tone.Transport.state !== 'started') Tone.Transport.start('+0.05');
      } catch (err) {
        toast(`Não deu para puxar a base: ${err.message}`, 'error');
      }
    }

    function stopBacking() {
      if (backingLoop) backingLoop.dispose();
      backingLoop = null;
      backingVoices.forEach((v) => v.dispose && v.dispose());
      backingVoices = [];
    }

    async function ensureOtterGain() {
      await ensureAudio();
      if (!otterGain) otterGain = new Tone.Gain(0.55).toDestination();
      return otterGain;
    }

    function stopOtterLoop(i) {
      const p = otterPlayers[i];
      otterPlayers[i] = null;
      if (p && p.dispose) p.dispose();
      otterUi[i].looping = false;
      otterUi[i].singing = false;
    }

    function clearOtter(i) {
      if (otterRecSession && otterRecSession.i === i) otterRecSession.stop();
      stopOtterLoop(i);
      otterClips[i] = null;
      renderOtters();
    }

    async function startOtterLoop(i) {
      const clip = otterClips[i];
      if (!clip || !clip.buffer) return;
      await ensureOtterGain();
      const interval = clampOtterSeconds(clip.interval, OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, Math.max(1, clip.duration || clip.buffer.duration));
      clip.interval = interval;
      const prev = otterPlayers[i];
      const next = await startOtterLoopPlayer(Tone, clip.buffer, otterGain, interval);
      otterPlayers[i] = next;
      if (prev && prev !== next && prev.dispose) prev.dispose();
      otterUi[i].looping = true;
      startOtterAnim();
      paintOtterAnims();
    }

    function paintOtterAnims() {
      for (let i = 0; i < OTTER_SLOTS; i++) {
        const card = otterCard(i);
        const p = otterPlayers[i];
        const looping = Boolean(otterClips[i] && otterUi[i].looping);
        const singing = Boolean(looping && p && p.singingAt && p.singingAt());
        otterUi[i].singing = singing;
        if (!card) continue;
        card.classList.toggle('is-on', Boolean(otterClips[i]));
        card.classList.toggle('is-looping', looping);
        card.classList.toggle('is-singing', singing);
        card.classList.toggle('is-recording', otterUi[i].recording);
        const svg = card.querySelector('svg.creature');
        if (svg) {
          svg.classList.toggle('is-dancing', looping || otterUi[i].recording);
          svg.classList.toggle('is-sing-open', singing || otterUi[i].recording);
          svg.classList.toggle('is-idle', !looping && !otterUi[i].recording);
        }
      }
    }

    function startOtterAnim() {
      if (otterAnimRaf) return;
      const tick = () => {
        if (!alive) return;
        paintOtterAnims();
        if (otterUi.some((u) => u.looping || u.recording)) otterAnimRaf = requestAnimationFrame(tick);
        else otterAnimRaf = 0;
      };
      otterAnimRaf = requestAnimationFrame(tick);
    }

    function askOtterDuration(i) {
      return new Promise((resolve) => {
        let secs = 2;
        const label = el('span', { class: 'pill' }, '2 segundos');
        const range = el('input', {
          class: 'range cantar__dur-range',
          type: 'range',
          min: String(OTTER_REC_MIN),
          max: String(OTTER_REC_MAX),
          step: '0.5',
          value: '2',
          'aria-label': 'Duração da gravação em segundos'
        });
        const num = el('input', {
          class: 'input cantar__dur-num',
          type: 'number',
          min: String(OTTER_REC_MIN),
          max: String(OTTER_REC_MAX),
          step: '0.5',
          value: '2',
          'aria-label': 'Segundos de gravação'
        });
        const syncDur = (v) => {
          secs = clampOtterSeconds(v, OTTER_REC_MIN, OTTER_REC_MAX, 2);
          range.value = String(secs);
          num.value = String(secs);
          label.textContent = secs === 1 ? '1 segundo' : `${secs} segundos`;
        };
        range.addEventListener('input', () => syncDur(range.value));
        num.addEventListener('input', () => syncDur(num.value));
        modal({
          title: `Gravar frase · Lontrinha ${i + 1}`,
          body: el(
            'div',
            { class: 'cantar__otter-ask' },
            el('p', {}, 'Escolha quanto tempo gravar no mesmo microfone do Cantar. Depois a lontrinha fica repetindo.'),
            el('div', { class: 'cantar__otter-ask-row' }, label, num, el('span', { class: 'muted' }, 's')),
            range
          ),
          onClose: resolve,
          actions: [
            { label: 'Cancelar', value: null },
            { label: 'Gravar agora', kind: 'primary', onClick: (close) => close(secs) }
          ]
        });
      });
    }

    async function captureOtterPhrase(i, seconds) {
      const statusP = el('p', { class: 'cantar__otter-countdown' }, `Gravando… ${Number(seconds).toFixed(1)} s`);
      let settled = false;
      let cancelled = false;
      const session = recordPhraseFromStream(stream, seconds, {
        onTick: (left) => {
          statusP.textContent = `Gravando… ${left.toFixed(1)} s`;
          const mark = otterCard(i) && otterCard(i).querySelector('.cantar__otter-countdown');
          if (mark) mark.textContent = `Gravando ${left.toFixed(1)} s`;
        }
      });
      otterRecSession = { i, stop: session.stop };
      otterUi[i].recording = true;
      renderOtters();
      const recModal = modal({
        title: `Lontrinha ${i + 1} gravando`,
        body: el('div', {}, el('p', {}, 'Cante a frase. A voz ao vivo e as outras lontrinhas continuam.'), statusP),
        onClose: (v) => {
          if (v !== 'done') session.stop();
          if (v == null) cancelled = true;
        },
        actions: [{ label: 'Parar agora', kind: 'primary', onClick: (close) => close('stop') }]
      });
      try {
        const result = await session.done;
        settled = true;
        recModal.close('done');
        if (cancelled) return null;
        return result;
      } finally {
        otterRecSession = null;
        otterUi[i].recording = false;
        if (!settled) recModal.close('done');
      }
    }

    async function recordOtter(i) {
      if (otterBusy || otterUi.some((u) => u.recording)) {
        toast('Espere a outra frase terminar.', 'info');
        return;
      }
      otterBusy = true;
      try {
        const seconds = await askOtterDuration(i);
        if (seconds == null) return;
        try {
          await ensureAudio();
          if (!stream) await startMic();
        } catch (err) {
          toast(err.message || 'Sem microfone.', 'error');
          return;
        }
        if (!stream) {
          toast('Não achei o microfone.', 'error');
          return;
        }
        stopOtterLoop(i);
        const result = await captureOtterPhrase(i, seconds);
        if (!result || !result.blob || result.blob.size < 32) {
          renderOtters();
          if (result) toast('Gravação vazia — tente de novo.', 'warn');
          return;
        }
        const buffer = await decodePhraseBlob(Tone, result.blob);
        const duration = buffer.duration;
        const interval = clampOtterSeconds(duration, OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, Math.max(1, Math.round(duration * 2) / 2));
        otterClips[i] = { name: `Lontrinha ${i + 1}`, buffer, duration, interval };
        await startOtterLoop(i);
        renderOtters();
        toast(`${profile.otter.name} ${i + 1} repetindo a cada ${formatOtterSeconds(interval)}.`, 'ok');
      } catch (err) {
        renderOtters();
        toast(err.message || 'Não deu para gravar a frase.', 'error');
      } finally {
        otterBusy = false;
      }
    }

    async function setOtterClip(i, { duration = 0.25, interval, freq } = {}) {
      await ensureOtterGain();
      const ctx = Tone.getContext().rawContext || Tone.context;
      const buffer = makeBeepBuffer(ctx, { seconds: duration, freq: freq || 440 + i * 90 });
      const iv = clampOtterSeconds(interval ?? Math.max(1, duration), OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, 1);
      otterClips[i] = { name: `Lontrinha ${i + 1}`, buffer, duration: buffer.duration, interval: iv };
      await startOtterLoop(i);
      renderOtters();
      return true;
    }

    async function setOtterInterval(i, sec) {
      const clip = otterClips[i];
      if (!clip) return clip;
      clip.interval = clampOtterSeconds(sec, OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, clip.interval);
      const input = otterCard(i) && otterCard(i).querySelector('.cantar__otter-interval-num');
      if (input) input.value = String(clip.interval);
      if (otterUi[i].looping) await startOtterLoop(i);
      return clip;
    }

    function renderMix() {
      const mix = Number(mixInput.value) / 100;
      const duck = currentGraph().backingDuck ?? 1;
      if (voiceFx) voiceFx.setOutGain(mix);
      if (backingGain) backingGain.gain.value = (1 - mix / 2) * duck;
    }

    recBtn.addEventListener('click', async () => {
      try {
        await ensureAudio();
        if (rec) {
          const r = rec;
          rec = null;
          clearInterval(recTimer);
          recBtn.querySelector('.btn__text').textContent = 'Gravar';
          recBtn.classList.remove('is-active');
          const { blob } = await r.stop();
          r.dispose();
          const item = await gallery.addBlob('audio', nameInput.value.trim() || `Canto ${stamp()}`, 'cantar', blob, { fx, backing, bpm });
          toast(`“${item.name}” foi para a Galeria.`, 'ok');
          return;
        }
        rec = await createOutputRecorder();
        rec.start();
        recBtn.querySelector('.btn__text').textContent = 'Parar';
        recBtn.classList.add('is-active');
        const t0 = performance.now();
        recTimer = setInterval(() => {
          const s = Math.floor((performance.now() - t0) / 1000);
          timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        }, 250);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    micBtn.addEventListener('click', () => startMic().catch((err) => toast(err.message || 'Sem microfone.', 'error')));
    autoBtn.addEventListener('click', () => {
      autotune = !autotune;
      autoBtn.textContent = `Autotune: ${autotune ? 'Sim' : 'Não'}`;
      autoBtn.setAttribute('aria-pressed', String(autotune));
      applyFx();
    });
    syncBtn.addEventListener('click', () => {
      sync = !sync;
      syncBtn.textContent = `Sync: ${sync ? 'Sim' : 'Não'}`;
      syncBtn.setAttribute('aria-pressed', String(sync));
      if (Tone) {
        if (sync && Tone.Transport.state !== 'started') Tone.Transport.start();
        if (!sync) Tone.Transport.pause();
      }
    });
    bpmInput.addEventListener('input', () => {
      bpm = Number(bpmInput.value);
      bpmLabel.textContent = `${bpm} BPM`;
      log.set({ bpm });
      if (Tone) Tone.Transport.bpm.value = bpm;
    });
    mixInput.addEventListener('input', renderMix);
    backingSel.addEventListener('change', () => {
      backing = backingSel.value;
      startBacking().catch((err) => toast(err.message, 'error'));
    });

    root.append(
      el(
        'div',
        { class: 'cantar' },
        el(
          'section',
          { class: 'panel cantar__stage' },
          el('div', { class: 'panel__head' }, el('h2', {}, 'Palco'), el('span', { class: 'pill' }, profile.cat.name)),
          meter,
          catStage,
          el('h3', { class: 'subhead' }, `Sobrevoz · ${profile.otter.name}`),
          ottersRow
        ),
        el(
          'section',
          { class: 'panel cantar__desk' },
          el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Nome'), nameInput),
          el('div', { class: 'toolbar' }, micBtn, recBtn, timer),
          status,
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Modificador de voz'), fxRow, fxCaption, autoBtn),
          el(
            'div',
            { class: 'field' },
            el('span', { class: 'field__label' }, 'Base (puxa da Galeria ou arpejo)'),
            backingSel,
            el('div', { class: 'row-actions' }, syncBtn, bpmLabel, bpmInput)
          ),
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Mix da voz'), mixInput),
          el('p', { class: 'hint' }, 'Natural é limpo (gate, filtro e compressão). Os outros chips ligam só o efeito escolhido — Agudo/Grave mudam o tom, Eco atrasos, Robô metal, Caverna reverb, Velhinha vibrato. Cada lontrinha grava uma frase (você escolhe os segundos) e fica repetindo junto da voz.')
        )
      )
    );

    paintCat();
    renderOtters();
    renderFx();
    fillBacking();

    window.__mmpCantar = {
      state: () => ({
        fx,
        autotune,
        backing,
        bpm,
        sync,
        rms,
        pitchHz,
        otters: otterClips.filter(Boolean).length,
        mic: Boolean(stream),
        graph: currentGraph(),
        otterLoops: otterClips.map((c, i) => ({
          hasClip: Boolean(c),
          interval: c ? c.interval : null,
          duration: c ? c.duration : null,
          looping: otterUi[i].looping,
          recording: otterUi[i].recording,
          singing: otterUi[i].singing
        }))
      }),
      graph: () => currentGraph(),
      fingerprint: () => fingerprint(currentGraph()),
      boot: () => ensureAudio(),
      setFx: (id) => {
        fx = normalizeFxId(id);
        applyFx();
      },
      setAutotune: (on) => {
        autotune = Boolean(on);
        autoBtn.textContent = `Autotune: ${autotune ? 'Sim' : 'Não'}`;
        autoBtn.setAttribute('aria-pressed', String(autotune));
        applyFx();
      },
      setBacking: (id) => {
        backing = id;
        backingSel.value = id;
      },
      setRms: (v) => {
        rms = v;
        mouthOpen = rms > 0.06;
        paintCat();
      },
      setOtterClip,
      setOtterInterval,
      clearOtter
    };

    return {
      async save() {
        if (!rec) return 'Nada gravado ainda — aperte Gravar enquanto canta.';
        return false;
      },
      unmount() {
        alive = false;
        cancelAnimationFrame(raf);
        cancelAnimationFrame(otterAnimRaf);
        clearInterval(recTimer);
        stopBacking();
        if (otterRecSession) otterRecSession.stop();
        for (let i = 0; i < OTTER_SLOTS; i++) stopOtterLoop(i);
        if (otterGain) otterGain.dispose();
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (rec) rec.dispose();
        if (voiceFx) voiceFx.dispose();
        if (backingGain) backingGain.dispose();
        if (micNode) micNode.dispose();
        if (window.__mmpCantar) delete window.__mmpCantar;
      }
    };
  }
};
