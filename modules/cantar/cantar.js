// Cantar: voz no microfone, autotune, talkbox e mix com arpejo/beat.
import { createOutputRecorder } from '../shared/audio.js';
import { creatureSVG } from '../shared/creatures.js';
import { beatFromJson } from '../beatcats/beatcats.js';
import { LOOP_STEPS, SOUND_BY_ID, makeCaptured } from '../beatcats/sounds.js';
import { createEventLog } from '../shared/events.js';
import { gallery, getProfile } from '../shared/store.js';
import { el, startAudio, stamp, toast } from '../shared/ui.js';
import { t } from '../shared/i18n.js';
import { FX, OVERLAY_IDS, NS_LIBRARY, createVoiceFx, fingerprint, graphFor, normalizeFxId } from './voice-fx.js';
import {
  OTTER_INTERVAL_MAX,
  OTTER_INTERVAL_MIN,
  OTTER_REC_MAX,
  clampOtterSeconds,
  decodePhraseBlob,
  formatOtterClock,
  formatOtterSeconds,
  makeBeepBuffer,
  recordPhraseFromStream,
  startOtterLoopPlayer
} from './otter-loops.js';

const SCALE = [0, 2, 3, 5, 7, 8, 10];
const OTTER_SLOTS = 3;
const BEDS = [
  { id: 'none', key: 'cantar.none', label: 'Nenhum' },
  { id: 'arpeggio', key: 'cantar.arp', label: 'Arpejo (notas da escala)' },
  { id: 'pad', key: 'cantar.bed.pad', label: 'Pad suave' },
  { id: 'choir', key: 'cantar.bed.choir', label: 'Coro aahs' },
  { id: 'beat', key: 'cantar.bed.beat', label: 'Beat simples' },
  { id: 'bassclick', key: 'cantar.bed.bassclick', label: 'Baixo + click' }
];
const GENERATED_BEDS = new Set(['arpeggio', 'pad', 'choir', 'beat', 'bassclick']);
const PITCH_NOTES = [
  { id: 'off', name: 'Nenhuma', freq: 0 },
  { id: 'C4', name: 'Dó (C4)', freq: 261.63 },
  { id: 'D4', name: 'Ré (D4)', freq: 293.66 },
  { id: 'E4', name: 'Mi (E4)', freq: 329.63 },
  { id: 'F4', name: 'Fá (F4)', freq: 349.23 },
  { id: 'G4', name: 'Sol (G4)', freq: 392 },
  { id: 'A4', name: 'Lá (A4)', freq: 440 }
];

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
    let camStream = null;
    let micPromise = null;
    let micNode = null;
    let singer = null;
    let singTimer = 0;
    let voiceFx = null;
    let backingGain = null;
    let pitchGain = null;
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
    let pitchNote = 'C4';
    let bpm = 100;
    let sync = true;
    let backingLoop = null;
    let backingVoices = [];
    let pitchVoices = [];
    let otterGain = null;
    let otterAnimRaf = 0;
    let otterBusy = false;
    let otterRecSession = null;
    let otterSolo = null;
    const otterPlayers = new Array(OTTER_SLOTS).fill(null);
    const otterClips = new Array(OTTER_SLOTS).fill(null);
    const otterUi = Array.from({ length: OTTER_SLOTS }, () => ({
      recording: false,
      playing: false,
      singing: false,
      elapsed: 0
    }));
    const log = createEventLog({ source: 'cantar', bpm, scale: 'minor', root: 0 });

    const nameInput = el('input', { class: 'input', type: 'text', maxlength: '60', value: `Canto ${stamp()}`, 'aria-label': 'Nome da gravação' });
    const micBtn = el('button', { class: 'btn btn--primary cantar__mic', type: 'button', 'aria-pressed': 'false' }, t('cantar.micOn'));
    const camBtn = el('button', { class: 'btn btn--ghost cantar__cam-btn', type: 'button', 'aria-pressed': 'false' }, t('cantar.camOn'));
    const lyricInput = el('input', {
      class: 'input cantar__lyrics',
      type: 'text',
      maxlength: '80',
      placeholder: t('cantar.typePh'),
      'aria-label': t('cantar.type')
    });
    const singBtn = el('button', { class: 'btn btn--ghost cantar__sing', type: 'button' }, t('cantar.singText'));
    const recBtn = el('button', { class: 'btn btn--rec', disabled: true }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar'));
    const timer = el('span', { class: 'pill' }, '00:00');
    const status = el('p', { class: 'muted' }, t('cantar.status'));
    const fxRow = el('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Modificador de voz' });
    const fxCaption = el('p', { class: 'cantar__fx-now' }, FX[0].hint);
    const autoBtn = el('button', { class: 'btn btn--ghost btn--sm', 'aria-pressed': 'false' }, t('cantar.auto', { on: t('cantar.no') }));
    const syncBtn = el('button', { class: 'btn btn--ghost btn--sm', 'aria-pressed': 'true' }, 'Sync: Sim');
    const bpmInput = el('input', { class: 'range', type: 'range', min: '70', max: '140', value: String(bpm), 'aria-label': 'BPM' });
    const bpmLabel = el('span', { class: 'pill' }, `${bpm} BPM`);
    const mixInput = el('input', { class: 'range', type: 'range', min: '0', max: '100', value: '70', 'aria-label': 'Mix da voz' });
    const backingSel = el('select', { class: 'input input--select cantar__backing-sel', 'aria-label': 'Acompanhamento' });
    const pitchSel = el('select', { class: 'input input--select cantar__pitch cantar__pitch-sel', 'aria-label': 'Pitch inicial' });
    const camVideo = el('video', { class: 'cantar__cam', autoplay: true, muted: true, playsinline: true, hidden: true });
    const catStage = el('div', { class: 'cantar__cat' });
    const catWrap = el('div', { class: 'cantar__stage-art' }, catStage, camVideo);
    const ottersRow = el('div', { class: 'cantar__otters' });
    const meterFill = el('div', { class: 'cantar__meter-fill' });
    const meter = el('div', { class: 'cantar__meter', title: 'Volume da voz' }, meterFill);

    PITCH_NOTES.forEach((n) => pitchSel.append(el('option', { value: n.id }, t(`cantar.pitch.${n.id}`, n.name))));
    pitchSel.value = pitchNote;

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

    function otterStatusText(i) {
      const ui = otterUi[i];
      const clip = otterClips[i];
      if (ui.recording) return `Gravando ${formatOtterClock(ui.elapsed)}`;
      if (clip && ui.playing && (otterSolo == null || otterSolo === i)) return 'Tocando';
      if (clip && otterSolo != null && otterSolo !== i) return 'No mute (solo em outra)';
      if (clip) return 'Pausada — aperte Play';
      return 'Sem frase ainda';
    }

    function deckHint(i) {
      const ui = otterUi[i];
      if (ui.recording) return 'Fale agora, olhando para o palco. Depois Pausar, aí Play.';
      if (otterClips[i] && ui.playing) return 'Solo deixa só esta lontrinha. Resetar apaga a frase.';
      if (otterClips[i]) return 'Play ouve a frase (repete no intervalo). Solo silencia as outras.';
      return 'Gravar frase abre o gravador aqui embaixo — sem janela por cima.';
    }

    function renderOtters() {
      ottersRow.innerHTML = '';
      for (let i = 0; i < OTTER_SLOTS; i++) {
        const clip = otterClips[i];
        const ui = otterUi[i];
        const audible = Boolean(clip && ui.playing && otterPlayers[i] && (otterSolo == null || otterSolo === i));
        const recOther = otterUi.some((u, j) => u.recording && j !== i);
        const wrap = el('div', {
          class: `cantar__otter-wrap${ui.recording ? ' is-recording' : ''}${audible ? ' is-playing' : ''}${otterSolo === i ? ' is-solo' : ''}`,
          'data-slot': String(i)
        });
        const card = el(
          'div',
          {
            class: `cantar__otter${clip ? ' is-on' : ''}${ui.recording ? ' is-recording' : ''}${audible ? ' is-looping' : ''}${ui.singing ? ' is-singing' : ''}${otterSolo === i ? ' is-solo' : ''}`,
            'data-slot': String(i)
          },
          el('div', {
            class: 'cantar__otter-art',
            html: creatureSVG('otter', profile.otter, {
              size: 104,
              extraClass: ui.recording || audible ? 'is-dancing' : 'is-idle',
              label: `${profile.otter.name} ${i + 1}`
            })
          }),
          el('span', { class: 'cantar__otter-name' }, t('cantar.otterN', { n: i + 1 })),
          el('span', { class: `cantar__otter-countdown${ui.recording ? '' : ' is-idle'}` }, otterStatusText(i))
        );
        const deck = el(
          'div',
          { class: 'cantar__otter-deck', 'data-slot': String(i) },
          el('p', { class: 'cantar__otter-deck-hint' }, deckHint(i)),
          clip
            ? el(
                'label',
                { class: 'cantar__otter-interval' },
                el('span', {}, t('cantar.repeat')),
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
                    if (ui.playing) syncOtterAudio().catch((err) => toast(err.message, 'error'));
                  }
                }),
                el('span', {}, 's')
              )
            : null,
          el(
            'div',
            { class: 'cantar__otter-transport' },
            el(
              'button',
              {
                class: `btn btn--sm btn--primary cantar__otter-rec${ui.recording ? ' is-active' : ''}`,
                'data-act': 'rec',
                disabled: recOther ? true : undefined,
                onclick: () => recordOtter(i)
              },
              ui.recording ? t('cantar.recording') : clip ? t('cantar.rerec') : t('cantar.recPhrase')
            ),
            el(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                'data-act': 'pause',
                disabled: !(ui.recording || ui.playing) ? true : undefined,
                onclick: () => pauseOtter(i)
              },
              t('cantar.pause')
            ),
            el(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                'data-act': 'play',
                disabled: !clip || ui.recording || ui.playing ? true : undefined,
                onclick: () => playOtter(i)
              },
              t('cantar.play')
            ),
            el(
              'button',
              {
                class: `btn btn--sm btn--ghost${otterSolo === i ? ' is-on' : ''}`,
                'data-act': 'solo',
                'aria-pressed': String(otterSolo === i),
                disabled: !clip ? true : undefined,
                onclick: () => soloOtter(i)
              },
              otterSolo === i ? t('cantar.soloOn') : t('cantar.solo')
            ),
            el(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                'data-act': 'reset',
                disabled: !clip && !ui.recording ? true : undefined,
                onclick: () => resetOtter(i)
              },
              t('cantar.reset')
            )
          )
        );
        wrap.append(card, deck);
        ottersRow.append(wrap);
      }
      paintOtterAnims();
      if (otterUi.some((u) => u.playing || u.recording)) startOtterAnim();
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
                ensureMic().catch((err) => toast(err.message || 'Sem microfone.', 'error'));
              }
            },
            t(`cantar.fx.${f.id}`, f.name)
          )
        );
      });
      const meta = FX.find((f) => f.id === fx);
      const extra = autotune && OVERLAY_IDS.has(fx) ? ' Autotune por cima.' : fx === 'autotune' ? '' : '';
      fxCaption.textContent = `${meta ? meta.hint : ''}`.trim() + extra;
    }

    async function fillBacking() {
      backingSel.innerHTML = '';
      BEDS.forEach((b) => backingSel.append(el('option', { value: b.id }, t(b.key, b.label))));
      try {
        const items = await gallery.list();
        items
          .filter((i) => i.type === 'beat' || i.type === 'audio')
          .forEach((i) =>
            backingSel.append(
              el('option', { value: `${i.type}:${i.id}` }, t('cantar.fromGal', { kind: i.type === 'beat' ? t('cantar.beat') : t('cantar.audio'), name: i.name }))
            )
          );
      } catch {}
      const has = [...backingSel.options].some((o) => o.value === backing);
      backingSel.value = has ? backing : 'arpeggio';
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
          backingGain = new Tone.Gain(0.52).toDestination();
          pitchGain = new Tone.Gain(0.28).toDestination();
          Tone.Transport.bpm.value = bpm;
          applyFx();
          startPitchDrone();
          await startBacking();
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
      if (stream) return stream;
      // EC/NS/AGC do SO ficam off de propósito: com eles ligados os chips (Alvinhos, Eco, Caverna…)
      // viram a mesma voz abafada. Ruído de fundo sai no grafo (HPF + Tone.Gate + limiter), não aqui.
      const gum = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        },
        video: false
      });
      gum.catch(() => {});
      let timedOut = false;
      try {
        stream = await Promise.race([
          gum,
          new Promise((_, reject) =>
            setTimeout(() => {
              timedOut = true;
              reject(new Error('Microfone não respondeu. Clique em Ligar microfone.'));
            }, 4500)
          )
        ]);
      } catch (err) {
        if (timedOut) gum.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
        throw err;
      }
      if (!alive) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
        return null;
      }
      const src = Tone.context.createMediaStreamSource(stream);
      micNode = new Tone.Gain(1);
      Tone.connect(src, micNode);
      Tone.connect(micNode, voiceFx.input);
      recBtn.disabled = false;
      micBtn.textContent = t('cantar.micOff');
      micBtn.disabled = false;
      micBtn.setAttribute('aria-pressed', 'true');
      status.textContent = t('cantar.statusLive');
      applyFx();
      if (sync && Tone.Transport.state !== 'started') Tone.Transport.start('+0.05');
      tickMouth();
      startPitchDrone();
      await startBacking();
      return stream;
    }

    async function ensureMic() {
      if (stream) return stream;
      if (!micPromise) {
        micPromise = startMic().catch((err) => {
          micPromise = null;
          throw err;
        });
      }
      return micPromise;
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
      voiceFx.setGate(rms > 0.012, g.gateFloor);
      voiceFx.setNoiseEnvelope(rms);
      const open = rms > 0.02;
      if (open !== mouthOpen) {
        mouthOpen = open;
        paintCat();
      }
      meterFill.style.width = `${Math.min(100, rms * 380)}%`;
      pitchFrame++;
      const wantsSnap = fx === 'autotune' || (autotune && OVERLAY_IDS.has(fx));
      if (pitchFrame % 3 === 0 && (wantsSnap || fx === 'talkbox')) {
        const hz = detectPitchYin(buf.subarray(0, 512), Tone.context.sampleRate);
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

    function stopMic() {
      cancelAnimationFrame(raf);
      raf = 0;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      micPromise = null;
      if (micNode) {
        try {
          micNode.dispose();
        } catch {}
        micNode = null;
      }
      recBtn.disabled = true;
      micBtn.textContent = t('cantar.micOn');
      micBtn.setAttribute('aria-pressed', 'false');
      status.textContent = t('cantar.status');
    }

    async function toggleMic() {
      if (stream) {
        stopMic();
        return;
      }
      await ensureMic();
    }

    function stopCam() {
      if (camStream) {
        camStream.getTracks().forEach((t) => t.stop());
        camStream = null;
      }
      camVideo.srcObject = null;
      camVideo.hidden = true;
      camBtn.textContent = t('cantar.camOn');
      camBtn.setAttribute('aria-pressed', 'false');
    }

    async function toggleCam() {
      if (camStream) {
        stopCam();
        return;
      }
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (!alive) {
          camStream.getTracks().forEach((t) => t.stop());
          camStream = null;
          return;
        }
        camVideo.srcObject = camStream;
        camVideo.hidden = false;
        camBtn.textContent = t('cantar.camOff');
        camBtn.setAttribute('aria-pressed', 'true');
      } catch (err) {
        camStream = null;
        toast(err.message || 'Sem câmera.', 'error');
      }
    }

    async function singTyped(text) {
      const raw = String(text == null ? lyricInput.value : text).trim();
      if (!raw) {
        toast('Escreva uma frase para o gato cantar.', 'info');
        return false;
      }
      await ensureAudio();
      if (!alive || !Tone || !voiceFx) return false;
      if (!singer) {
        singer = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3.05,
          modulationIndex: 8.5,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.03, decay: 0.14, sustain: 0.38, release: 0.2 },
          volume: -12
        });
        singer.connect(voiceFx.input);
      }
      try {
        voiceFx.setGate(true, 1);
      } catch {}
      const letters = [...raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()].filter((c) => /[a-z]/.test(c));
      if (!letters.length) return false;
      const now = Tone.now() + 0.05;
      letters.slice(0, 40).forEach((ch, i) => {
        const deg = SCALE[ch.charCodeAt(0) % SCALE.length];
        const midi = 62 + deg + (i % 3 === 2 ? 12 : 0);
        const hz = 440 * Math.pow(2, (midi - 69) / 12);
        try {
          singer.triggerAttackRelease(hz, 0.2, now + i * 0.15, 0.7);
        } catch {}
      });
      const total = Math.min(40, letters.length) * 150 + 180;
      mouthOpen = true;
      paintCat();
      clearTimeout(singTimer);
      singTimer = setTimeout(() => {
        if (!alive) return;
        mouthOpen = false;
        paintCat();
      }, total);
      return true;
    }

    function stopPitchDrone() {
      pitchVoices.forEach((v) => {
        try {
          v.stop();
        } catch {}
        try {
          v.dispose && v.dispose();
        } catch {}
      });
      pitchVoices = [];
    }

    function startPitchDrone() {
      stopPitchDrone();
      if (!Tone || !pitchGain || pitchNote === 'off') return;
      const meta = PITCH_NOTES.find((n) => n.id === pitchNote);
      if (!meta || !meta.freq) return;
      const sine = new Tone.Oscillator({ type: 'sine', frequency: meta.freq, volume: -14 }).connect(pitchGain);
      const hum = new Tone.Oscillator({ type: 'triangle', frequency: meta.freq / 2, volume: -20 }).connect(pitchGain);
      sine.start();
      hum.start();
      pitchVoices = [sine, hum];
    }

    function backingMidi() {
      const root = pitchNote === 'off' ? 'C4' : pitchNote;
      return Tone.Frequency(root).toMidi();
    }

    function noteAt(midi, st) {
      return Tone.Frequency(midi + st, 'midi').toNote();
    }

    function startGeneratedBed() {
      const midi = backingMidi();
      if (backing === 'arpeggio') {
        const hp = new Tone.Filter(140, 'highpass').connect(backingGain);
        const synth = new Tone.Synth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.006, decay: 0.16, sustain: 0.1, release: 0.12 },
          volume: -9
        }).connect(hp);
        const sparkle = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.08 },
          volume: -12
        }).connect(hp);
        const notes = [noteAt(midi, -12), noteAt(midi, -8), noteAt(midi, -5), noteAt(midi, 0), noteAt(midi, -5), noteAt(midi, -8)];
        const highs = [noteAt(midi, 7), noteAt(midi, 12), noteAt(midi, 15), noteAt(midi, 19), noteAt(midi, 15), noteAt(midi, 12)];
        let i = 0;
        backingLoop = new Tone.Loop((time) => {
          const n = notes[i % notes.length];
          const h = highs[i % highs.length];
          synth.triggerAttackRelease(n, '8n', time);
          sparkle.triggerAttackRelease(h, '16n', time);
          log.note({ note: Tone.Frequency(n).toMidi(), inst: 'keys', track: 'arpejo', time, dur: 30 / bpm, vel: 0.72 });
          i++;
        }, '8n').start(0);
        backingVoices = [synth, sparkle, hp];
        return;
      }
      if (backing === 'pad') {
        const lp = new Tone.Filter(780, 'lowpass').connect(backingGain);
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.55, decay: 0.35, sustain: 0.72, release: 1.6 },
          volume: -16
        }).connect(lp);
        const chord = [0, 3, 7, 10].map((st) => noteAt(midi, st - 12));
        backingLoop = new Tone.Loop((time) => {
          synth.triggerAttackRelease(chord, '1n', time);
        }, '1n').start(0);
        backingVoices = [synth, lp];
        return;
      }
      if (backing === 'choir') {
        const lp = new Tone.Filter(1200, 'lowpass').connect(backingGain);
        const chorus = new Tone.Chorus({ frequency: 0.55, delayTime: 3.2, depth: 0.35, wet: 0.45 }).connect(lp);
        try {
          chorus.start();
        } catch {}
        const voices = [-12, -8, -5, 0].map((st, i) => {
          const osc = new Tone.Oscillator({
            type: i % 2 ? 'triangle' : 'sine',
            frequency: Tone.Frequency(midi + st, 'midi').toFrequency() * (1 + (i - 1.5) * 0.0035),
            volume: -21
          }).connect(chorus);
          osc.start();
          return osc;
        });
        backingVoices = [...voices, chorus, lp];
        return;
      }
      if (backing === 'beat') {
        const kick = new Tone.MembraneSynth({
          pitchDecay: 0.03,
          octaves: 5,
          envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.08 },
          volume: -9
        }).connect(backingGain);
        const snareHp = new Tone.Filter(1400, 'highpass').connect(backingGain);
        const snare = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
          volume: -12
        }).connect(snareHp);
        const hat = new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4200,
          octaves: 1.5,
          volume: -28
        }).connect(backingGain);
        let step = 0;
        backingLoop = new Tone.Loop((time) => {
          const s = step % 16;
          if (s === 0 || s === 8) kick.triggerAttackRelease('C1', '8n', time);
          if (s === 4 || s === 12) snare.triggerAttackRelease('16n', time);
          if (s % 2 === 0) hat.triggerAttackRelease(280, '32n', time);
          step++;
        }, '16n').start(0);
        backingVoices = [kick, snare, snareHp, hat];
        return;
      }
      if (backing === 'bassclick') {
        const bass = new Tone.MonoSynth({
          oscillator: { type: 'square' },
          filter: { Q: 2.2, type: 'lowpass' },
          envelope: { attack: 0.01, decay: 0.16, sustain: 0.32, release: 0.12 },
          filterEnvelope: { attack: 0.02, decay: 0.18, sustain: 0.2, baseFrequency: 80, octaves: 2.1 },
          volume: -11
        }).connect(backingGain);
        const clickHp = new Tone.Filter(2500, 'highpass').connect(backingGain);
        const click = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.028, sustain: 0 },
          volume: -18
        }).connect(clickHp);
        const bassNotes = [0, 0, 7, 0].map((st) => noteAt(midi, st - 24));
        let i = 0;
        backingLoop = new Tone.Loop((time) => {
          click.triggerAttackRelease('32n', time);
          if (i % 2 === 0) bass.triggerAttackRelease(bassNotes[(i / 2) % bassNotes.length], '8n', time);
          i++;
        }, '8n').start(0);
        backingVoices = [bass, click, clickHp];
      }
    }

    async function startBacking() {
      stopBacking();
      if (!Tone || backing === 'none') return;
      if (GENERATED_BEDS.has(backing)) {
        startGeneratedBed();
        if (Tone.Transport.state !== 'started') Tone.Transport.start('+0.05');
        return;
      }
      const [kind, id] = backing.split(':');
      if (kind === 'audio' && id) {
        try {
          const read = await gallery.read(id);
          if (!read || !read.data) throw new Error('Áudio vazio.');
          const bytes = read.data instanceof Uint8Array ? read.data : new Uint8Array(read.data);
          const blob = new Blob([bytes], { type: (read.item && read.item.mime) || 'audio/webm' });
          const buffer = await decodePhraseBlob(Tone, blob);
          const player = new Tone.Player({ url: buffer, loop: true, fadeIn: 0.02, fadeOut: 0.05, volume: -6 }).connect(backingGain);
          try {
            await Promise.race([player.loaded, new Promise((r) => setTimeout(r, 120))]);
          } catch {}
          player.start();
          backingVoices = [player];
        } catch (err) {
          toast(`Não deu para puxar o áudio da Galeria: ${err.message}`, 'error');
        }
        return;
      }
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
        toast(`Não deu para puxar o acompanhamento: ${err.message}`, 'error');
      }
    }

    function stopBacking() {
      if (backingLoop) backingLoop.dispose();
      backingLoop = null;
      backingVoices.forEach((v) => {
        try {
          v.stop && v.stop();
        } catch {}
        try {
          v.dispose && v.dispose();
        } catch {}
      });
      backingVoices = [];
    }

    async function ensureOtterGain() {
      await ensureAudio();
      if (!otterGain) otterGain = new Tone.Gain(0.62).toDestination();
      return otterGain;
    }

    function stopOtterLoop(i) {
      const p = otterPlayers[i];
      otterPlayers[i] = null;
      if (p && p.dispose) p.dispose();
      otterUi[i].singing = false;
    }

    function otterAudible(i) {
      return Boolean(otterClips[i] && otterUi[i].playing && !otterUi[i].recording && (otterSolo == null || otterSolo === i));
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
      otterUi[i].playing = true;
      startOtterAnim();
      paintOtterAnims();
    }

    async function syncOtterAudio() {
      for (let i = 0; i < OTTER_SLOTS; i++) {
        const want = otterAudible(i);
        if (want && !otterPlayers[i]) await startOtterLoop(i);
        else if (!want && otterPlayers[i]) stopOtterLoop(i);
      }
      startOtterAnim();
      paintOtterAnims();
    }

    function paintOtterAnims() {
      for (let i = 0; i < OTTER_SLOTS; i++) {
        const card = otterCard(i);
        const wrap = ottersRow.querySelector(`.cantar__otter-wrap[data-slot="${i}"]`);
        const p = otterPlayers[i];
        const audible = otterAudible(i) && Boolean(p);
        const singing = Boolean(audible && p && p.singingAt && p.singingAt());
        otterUi[i].singing = singing;
        if (wrap) {
          wrap.classList.toggle('is-recording', otterUi[i].recording);
          wrap.classList.toggle('is-playing', audible);
          wrap.classList.toggle('is-solo', otterSolo === i);
        }
        if (!card) continue;
        card.classList.toggle('is-on', Boolean(otterClips[i]));
        card.classList.toggle('is-looping', audible);
        card.classList.toggle('is-singing', singing);
        card.classList.toggle('is-recording', otterUi[i].recording);
        card.classList.toggle('is-solo', otterSolo === i);
        const mark = card.querySelector('.cantar__otter-countdown');
        if (mark && !otterUi[i].recording) mark.textContent = otterStatusText(i);
        const svg = card.querySelector('svg.creature');
        if (svg) {
          svg.classList.toggle('is-dancing', audible || otterUi[i].recording);
          svg.classList.toggle('is-sing-open', singing || otterUi[i].recording);
          svg.classList.toggle('is-idle', !audible && !otterUi[i].recording);
        }
      }
    }

    function startOtterAnim() {
      if (otterAnimRaf) return;
      const tick = () => {
        if (!alive) return;
        paintOtterAnims();
        if (otterUi.some((u) => u.playing || u.recording)) otterAnimRaf = requestAnimationFrame(tick);
        else otterAnimRaf = 0;
      };
      otterAnimRaf = requestAnimationFrame(tick);
    }

    function paintRecTick(i, elapsed) {
      otterUi[i].elapsed = elapsed;
      const mark = otterCard(i) && otterCard(i).querySelector('.cantar__otter-countdown');
      if (mark) mark.textContent = `Gravando ${formatOtterClock(elapsed)}`;
    }

    async function recordOtter(i) {
      if (otterUi[i].recording) return;
      if (otterBusy || otterUi.some((u) => u.recording)) {
        toast('Espere a outra frase — pause ela primeiro.', 'info');
        return;
      }
      otterBusy = true;
      let discard = false;
      try {
        try {
          await ensureMic();
        } catch (err) {
          toast(err.message || 'Sem microfone.', 'error');
          return;
        }
        if (!stream) {
          toast('Não achei o microfone.', 'error');
          return;
        }
        otterUi[i].playing = false;
        stopOtterLoop(i);
        otterUi[i].recording = true;
        otterUi[i].elapsed = 0;
        renderOtters();
        const session = recordPhraseFromStream(stream, {
          maxSeconds: OTTER_REC_MAX,
          autoStop: false,
          onTick: (_left, elapsed) => paintRecTick(i, elapsed)
        });
        otterRecSession = {
          i,
          stop: session.stop,
          discard() {
            discard = true;
            return session.stop();
          }
        };
        const result = await session.done;
        otterRecSession = null;
        otterUi[i].recording = false;
        otterUi[i].elapsed = 0;
        if (discard) {
          renderOtters();
          return;
        }
        if (!result || !result.blob || result.blob.size < 32) {
          renderOtters();
          toast('Gravação vazia — tente de novo.', 'warn');
          return;
        }
        const buffer = await decodePhraseBlob(Tone, result.blob);
        const duration = buffer.duration;
        const interval = clampOtterSeconds(duration, OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, Math.max(1, Math.round(duration * 2) / 2));
        otterClips[i] = { name: `Lontrinha ${i + 1}`, buffer, duration, interval };
        otterUi[i].playing = false;
        await syncOtterAudio();
        renderOtters();
        toast(`${profile.otter.name} ${i + 1} gravada. Pause feito — agora Play.`, 'ok');
      } catch (err) {
        otterRecSession = null;
        otterUi[i].recording = false;
        renderOtters();
        toast(err.message || 'Não deu para gravar a frase.', 'error');
      } finally {
        otterBusy = false;
      }
    }

    async function pauseOtter(i) {
      if (otterUi[i].recording && otterRecSession && otterRecSession.i === i) {
        await otterRecSession.stop();
        return;
      }
      otterUi[i].playing = false;
      stopOtterLoop(i);
      renderOtters();
    }

    async function playOtter(i) {
      if (!otterClips[i] || otterUi[i].recording) return;
      otterUi[i].playing = true;
      await syncOtterAudio();
      renderOtters();
    }

    async function soloOtter(i) {
      if (!otterClips[i] && otterSolo !== i) return;
      if (otterSolo === i) otterSolo = null;
      else {
        otterSolo = i;
        if (otterClips[i] && !otterUi[i].recording) otterUi[i].playing = true;
      }
      await syncOtterAudio();
      renderOtters();
    }

    async function resetOtter(i) {
      const rec = otterRecSession && otterRecSession.i === i ? otterRecSession : null;
      otterClips[i] = null;
      otterUi[i].playing = false;
      otterUi[i].recording = false;
      otterUi[i].elapsed = 0;
      if (otterSolo === i) otterSolo = null;
      stopOtterLoop(i);
      if (rec) {
        try {
          await rec.discard();
        } catch {}
      }
      await syncOtterAudio();
      renderOtters();
    }

    function clearOtter(i) {
      return resetOtter(i);
    }

    async function setOtterClip(i, { duration = 0.25, interval, freq, play = false } = {}) {
      await ensureOtterGain();
      const ctx = Tone.getContext().rawContext || Tone.context;
      const buffer = makeBeepBuffer(ctx, { seconds: duration, freq: freq || 440 + i * 90 });
      const iv = clampOtterSeconds(interval ?? Math.max(1, duration), OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, 1);
      otterClips[i] = { name: `Lontrinha ${i + 1}`, buffer, duration: buffer.duration, interval: iv };
      otterUi[i].playing = Boolean(play);
      await syncOtterAudio();
      renderOtters();
      return true;
    }

    async function setOtterInterval(i, sec) {
      const clip = otterClips[i];
      if (!clip) return clip;
      clip.interval = clampOtterSeconds(sec, OTTER_INTERVAL_MIN, OTTER_INTERVAL_MAX, clip.interval);
      const input = otterCard(i) && ottersRow.querySelector(`.cantar__otter-wrap[data-slot="${i}"] .cantar__otter-interval-num`);
      if (input) input.value = String(clip.interval);
      if (otterUi[i].playing) await syncOtterAudio();
      return clip;
    }

    function renderMix() {
      const mix = Number(mixInput.value) / 100;
      const duck = currentGraph().backingDuck ?? 1;
      if (voiceFx) voiceFx.setOutGain(mix);
      if (backingGain) backingGain.gain.value = (0.42 + (1 - mix) * 0.55) * duck;
      if (pitchGain) pitchGain.gain.value = 0.18 + (1 - mix) * 0.16;
    }

    recBtn.addEventListener('click', async () => {
      try {
        await ensureAudio();
        await ensureMic().catch(() => {});
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

    micBtn.addEventListener('click', () => toggleMic().catch((err) => toast(err.message || 'Sem microfone.', 'error')));
    camBtn.addEventListener('click', () => toggleCam().catch((err) => toast(err.message || 'Sem câmera.', 'error')));
    singBtn.addEventListener('click', () => singTyped().catch((err) => toast(err.message || 'Não deu para cantar.', 'error')));
    lyricInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        singTyped().catch((err) => toast(err.message || 'Não deu para cantar.', 'error'));
      }
    });
    autoBtn.addEventListener('click', () => {
      autotune = !autotune;
      autoBtn.textContent = t('cantar.auto', { on: autotune ? t('cantar.yes') : t('cantar.no') });
      autoBtn.setAttribute('aria-pressed', String(autotune));
      applyFx();
    });
    syncBtn.addEventListener('click', () => {
      sync = !sync;
      syncBtn.textContent = t('cantar.sync', { on: sync ? t('cantar.yes') : t('cantar.no') });
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
    pitchSel.addEventListener('change', () => {
      pitchNote = pitchSel.value;
      ensureAudio()
        .then(() => {
          startPitchDrone();
          if (GENERATED_BEDS.has(backing)) return startBacking();
        })
        .catch((err) => toast(err.message, 'error'));
    });

    root.append(
      el(
        'div',
        { class: 'cantar' },
        el(
          'section',
          { class: 'panel cantar__stage' },
          el('div', { class: 'panel__head' }, el('h2', {}, t('cantar.stage')), el('span', { class: 'pill' }, profile.cat.name)),
          meter,
          catWrap,
          el('h3', { class: 'subhead' }, t('cantar.overvoice', { name: profile.otter.name })),
          ottersRow
        ),
        el(
          'section',
          { class: 'panel cantar__desk' },
          el('label', { class: 'field' }, el('span', { class: 'field__label' }, t('cantar.name')), nameInput),
          el('div', { class: 'toolbar' }, micBtn, camBtn, recBtn, timer),
          el(
            'label',
            { class: 'field' },
            el('span', { class: 'field__label' }, t('cantar.type')),
            el('div', { class: 'cantar__type-row' }, lyricInput, singBtn)
          ),
          status,
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('cantar.fx')), fxRow, fxCaption, autoBtn),
          el(
            'div',
            { class: 'field' },
            el('span', { class: 'field__label cantar__backing-label' }, t('cantar.backing')),
            backingSel,
            el('p', { class: 'cantar__field-hint' }, t('cantar.backingHint')),
            el('div', { class: 'row-actions' }, syncBtn, bpmLabel, bpmInput)
          ),
          el(
            'div',
            { class: 'field cantar__pitch' },
            el('span', { class: 'field__label' }, t('cantar.pitch')),
            pitchSel,
            el('p', { class: 'cantar__field-hint' }, t('cantar.pitchHint'))
          ),
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('cantar.mix')), mixInput),
          el(
            'p',
            { class: 'hint' },
            t('cantar.hint')
          )
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
        beds: BEDS.map((b) => b.id),
        nsLibrary: NS_LIBRARY,
        pitchNote,
        bpm,
        sync,
        rms,
        pitchHz,
        otters: otterClips.filter(Boolean).length,
        otterSolo,
        mic: Boolean(stream),
        cam: Boolean(camStream),
        lyrics: lyricInput.value,
        graph: currentGraph(),
        otterLoops: otterClips.map((c, i) => ({
          hasClip: Boolean(c),
          interval: c ? c.interval : null,
          duration: c ? c.duration : null,
          looping: otterAudible(i),
          playing: otterUi[i].playing,
          paused: Boolean(c) && !otterUi[i].playing && !otterUi[i].recording,
          recording: otterUi[i].recording,
          singing: otterUi[i].singing,
          audible: otterAudible(i) && Boolean(otterPlayers[i]),
          solo: otterSolo === i
        }))
      }),
      graph: () => currentGraph(),
      fingerprint: () => fingerprint(currentGraph()),
      ns: () => ({ library: NS_LIBRARY, gate: true, limiter: true, rumbleHp: 90 }),
      beds: () => BEDS.map((b) => ({ id: b.id, label: t(b.key, b.label) })),
      boot: () => ensureAudio(),
      setFx: (id) => {
        fx = normalizeFxId(id);
        applyFx();
      },
      setAutotune: (on) => {
        autotune = Boolean(on);
        autoBtn.textContent = t('cantar.auto', { on: autotune ? t('cantar.yes') : t('cantar.no') });
        autoBtn.setAttribute('aria-pressed', String(autotune));
        applyFx();
      },
      setBacking: (id) => {
        backing = id;
        if ([...backingSel.options].some((o) => o.value === id)) backingSel.value = id;
        if (Tone) startBacking().catch(() => {});
      },
      setPitchNote: (id) => {
        pitchNote = PITCH_NOTES.some((n) => n.id === id) ? id : 'off';
        pitchSel.value = pitchNote;
        startPitchDrone();
        if (Tone && GENERATED_BEDS.has(backing)) startBacking().catch(() => {});
      },
      setRms: (v) => {
        rms = v;
        mouthOpen = rms > 0.06;
        paintCat();
      },
      setOtterClip,
      setOtterInterval,
      playOtter,
      pauseOtter,
      soloOtter,
      resetOtter,
      openOtterDeck: () => renderOtters(),
      clearOtter,
      singText: (text) => singTyped(text),
      toggleCam,
      toggleMic
    };

    status.textContent = t('cantar.status');

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
        clearTimeout(singTimer);
        stopCam();
        if (singer) {
          try {
            singer.dispose();
          } catch {}
          singer = null;
        }
        stopBacking();
        stopPitchDrone();
        if (otterRecSession) otterRecSession.stop();
        for (let i = 0; i < OTTER_SLOTS; i++) stopOtterLoop(i);
        if (otterGain) otterGain.dispose();
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (rec) rec.dispose();
        if (voiceFx) voiceFx.dispose();
        if (backingGain) backingGain.dispose();
        if (pitchGain) pitchGain.dispose();
        if (micNode) micNode.dispose();
        if (window.__mmpCantar) delete window.__mmpCantar;
      }
    };
  }
};
