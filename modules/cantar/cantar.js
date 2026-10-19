// Cantar: voz no microfone, autotune, mix com arpejo/beat e lontrinhas em loop.
import { createOutputRecorder } from '../shared/audio.js';
import { creatureSVG } from '../shared/creatures.js';
import { beatFromJson } from '../beatcats/beatcats.js';
import { LOOP_STEPS, SOUND_BY_ID, makeCaptured } from '../beatcats/sounds.js';
import { createEventLog } from '../shared/events.js';
import { gallery, getProfile } from '../shared/store.js';
import { el, startAudio, stamp, toast } from '../shared/ui.js';

const FX = [
  { id: 'natural', name: 'Natural' },
  { id: 'autotune', name: 'Autotune' },
  { id: 'agudo', name: 'Agudo' },
  { id: 'grave', name: 'Grave' },
  { id: 'robo', name: 'Robô' },
  { id: 'eco', name: 'Eco' }
];
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const OTTER_SLOTS = 3;

function detectPitch(buf, sr) {
  let best = -1;
  let bestCorr = 0;
  const minL = Math.floor(sr / 900);
  const maxL = Math.floor(sr / 80);
  for (let lag = minL; lag <= maxL; lag++) {
    let corr = 0;
    for (let i = 0; i < buf.length - lag; i++) corr += buf[i] * buf[i + lag];
    if (corr > bestCorr) {
      bestCorr = corr;
      best = lag;
    }
  }
  if (best < 0 || bestCorr < 0.01) return 0;
  return sr / best;
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
  desc: 'Cante no microfone, coloque autotune e misture com arpejo ou um beat da Galeria.',
  async mount(root) {
    const profile = getProfile();
    let alive = true;
    let Tone = null;
    let audioPromise = null;
    let stream = null;
    let micNode = null;
    let analyser = null;
    let pitchShift = null;
    let chorus = null;
    let delay = null;
    let crusher = null;
    let voiceGain = null;
    let backingGain = null;
    let rec = null;
    let recTimer = 0;
    let raf = 0;
    let rms = 0;
    let fx = 'natural';
    let autotune = true;
    let backing = 'arpeggio';
    let bpm = 100;
    let sync = true;
    let backingLoop = null;
    let backingVoices = [];
    let otterPlayers = [];
    const otterClips = new Array(OTTER_SLOTS).fill(null);
    const log = createEventLog({ source: 'cantar', bpm, scale: 'minor', root: 9 });

    const nameInput = el('input', { class: 'input', type: 'text', maxlength: '60', value: `Canto ${stamp()}`, 'aria-label': 'Nome da gravação' });
    const micBtn = el('button', { class: 'btn btn--primary' }, 'Ligar microfone');
    const recBtn = el('button', { class: 'btn btn--rec', disabled: true }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar'));
    const timer = el('span', { class: 'pill' }, '00:00');
    const status = el('p', { class: 'muted' }, 'Ligue o microfone e cante. O gatinho abre a boca no volume da sua voz.');
    const fxRow = el('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Modificador de voz' });
    const autoBtn = el('button', { class: 'btn btn--ghost btn--sm', 'aria-pressed': 'true' }, 'Autotune: Sim');
    const syncBtn = el('button', { class: 'btn btn--ghost btn--sm', 'aria-pressed': 'true' }, 'Sync: Sim');
    const bpmInput = el('input', { class: 'range', type: 'range', min: '70', max: '140', value: String(bpm), 'aria-label': 'BPM' });
    const bpmLabel = el('span', { class: 'pill' }, `${bpm} BPM`);
    const mixInput = el('input', { class: 'range', type: 'range', min: '0', max: '100', value: '70', 'aria-label': 'Mix da voz' });
    const backingSel = el('select', { class: 'input input--select', 'aria-label': 'Base' });
    const catStage = el('div', { class: 'cantar__cat' });
    const ottersRow = el('div', { class: 'cantar__otters' });

    function renderCat() {
      const open = rms > 0.06;
      catStage.innerHTML = creatureSVG('cat', { ...profile.cat, outfit: { ...profile.cat.outfit, hand: 'microfone' } }, { size: 220, label: `${profile.cat.name} cantando`, extraClass: open ? 'is-sing-open' : 'is-idle' });
    }

    function renderOtters() {
      ottersRow.innerHTML = '';
      for (let i = 0; i < OTTER_SLOTS; i++) {
        const clip = otterClips[i];
        const card = el(
          'div',
          { class: `cantar__otter ${clip ? 'is-on' : ''}` },
          el('div', { class: 'cantar__otter-art', html: creatureSVG('otter', profile.otter, { size: 86, extraClass: clip ? 'is-dancing' : 'is-idle', label: `${profile.otter.name} ${i + 1}` }) }),
          el('span', { class: 'cantar__otter-name' }, clip ? clip.name : `Lontrinha ${i + 1}`),
          el('button', { class: 'btn btn--sm btn--primary', onclick: () => recordOtter(i) }, clip ? 'Regravar' : 'Gravar frase'),
          clip
            ? el('button', {
                class: 'btn btn--sm btn--ghost',
                onclick: () => {
                  otterClips[i] = null;
                  restartOtters().catch(() => {});
                  renderOtters();
                }
              }, 'Tirar')
            : null
        );
        ottersRow.append(card);
      }
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
                renderFx();
              }
            },
            f.name
          )
        );
      });
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

    function setWet(node, v) {
      if (node && node.wet && typeof node.wet.value === 'number') node.wet.value = v;
    }

    function applyFx() {
      if (!pitchShift) return;
      setWet(chorus, fx === 'eco' ? 0.2 : 0.05);
      setWet(delay, fx === 'eco' ? 0.35 : 0.02);
      setWet(crusher, fx === 'robo' ? 0.7 : 0);
      if (fx === 'agudo') pitchShift.pitch = 7;
      else if (fx === 'grave') pitchShift.pitch = -5;
      else if (!autotune) pitchShift.pitch = 0;
    }

    async function ensureAudio() {
      if (!audioPromise) {
        audioPromise = (async () => {
          Tone = await startAudio();
          if (!alive) return;
          voiceGain = new Tone.Gain(0.7).toDestination();
          backingGain = new Tone.Gain(0.45).toDestination();
          pitchShift = new Tone.PitchShift({ pitch: 0, windowSize: 0.1 }).connect(voiceGain);
          chorus = new Tone.Chorus(4, 2.5, 0.4).start().connect(pitchShift);
          delay = new Tone.FeedbackDelay('8n', 0.25).connect(chorus);
          crusher = new Tone.BitCrusher(4).connect(delay);
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
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      const src = Tone.context.createMediaStreamSource(stream);
      micNode = new Tone.Gain(1);
      Tone.connect(src, micNode);
      analyser = Tone.context.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      micNode.connect(crusher);
      recBtn.disabled = false;
      micBtn.textContent = 'Microfone ligado';
      micBtn.disabled = true;
      status.textContent = 'Pode cantar. Autotune cola a nota na escala; Sync prende no BPM da base.';
      if (sync) Tone.Transport.start('+0.05');
      tickMouth();
      await startBacking();
    }

    function tickMouth() {
      if (!alive || !analyser) return;
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      rms = Math.sqrt(sum / buf.length);
      if (autotune && (fx === 'autotune' || fx === 'natural') && pitchShift) {
        const hz = detectPitch(buf, Tone.context.sampleRate);
        const snapped = snapHz(hz);
        if (snapped && hz) {
          const semis = 12 * Math.log2(snapped / hz);
          pitchShift.pitch = Math.max(-12, Math.min(12, semis));
        }
      }
      renderCat();
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

    async function restartOtters() {
      otterPlayers.forEach((p) => {
        try {
          p.stop();
          p.dispose();
        } catch {}
      });
      otterPlayers = [];
      if (!Tone) return;
      const bar = Tone.Time('1m').toSeconds();
      otterClips.forEach((clip) => {
        if (!clip) return;
        const player = new Tone.Player(clip.buffer).connect(backingGain);
        player.loop = true;
        player.loopEnd = Math.max(bar, clip.buffer.duration);
        player.sync().start(0);
        otterPlayers.push(player);
      });
    }

    async function recordOtter(i) {
      if (!stream) return toast('Ligue o microfone primeiro.', 'info');
      toast(`Grave a frase da lontrinha ${i + 1} (2 segundos)…`, 'info');
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const blobP = new Promise((resolve) => {
        mr.onstop = () => resolve(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
      });
      mr.start();
      await new Promise((r) => setTimeout(r, 2000));
      mr.stop();
      const blob = await blobP;
      await ensureAudio();
      const buf = await Tone.context.decodeAudioData(await blob.arrayBuffer());
      otterClips[i] = { name: `Frase ${i + 1}`, buffer: buf };
      await restartOtters();
      renderOtters();
      toast(`${profile.otter.name} ${i + 1} vai repetir no beat.`, 'ok');
    }

    function renderMix() {
      if (voiceGain) voiceGain.gain.value = Number(mixInput.value) / 100;
      if (backingGain) backingGain.gain.value = 1 - Number(mixInput.value) / 200;
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
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Modificador de voz'), fxRow, autoBtn),
          el(
            'div',
            { class: 'field' },
            el('span', { class: 'field__label' }, 'Base (puxa da Galeria ou arpejo)'),
            backingSel,
            el('div', { class: 'row-actions' }, syncBtn, bpmLabel, bpmInput)
          ),
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Mix da voz'), mixInput),
          el('p', { class: 'hint' }, 'Grave uma frase curta em cada lontrinha: ela repete no tempo do BPM, como um coro. Salvar / Gravar manda o mix para a Galeria.')
        )
      )
    );

    renderCat();
    renderOtters();
    renderFx();
    fillBacking();

    window.__mmpCantar = {
      state: () => ({ fx, autotune, backing, bpm, sync, rms, otters: otterClips.filter(Boolean).length, mic: Boolean(stream) }),
      setFx: (id) => {
        if (FX.some((f) => f.id === id)) {
          fx = id;
          applyFx();
          renderFx();
        }
      },
      setAutotune: (on) => {
        autotune = Boolean(on);
        autoBtn.textContent = `Autotune: ${autotune ? 'Sim' : 'Não'}`;
      },
      setBacking: (id) => {
        backing = id;
        backingSel.value = id;
      },
      setRms: (v) => {
        rms = v;
        renderCat();
      }
    };

    return {
      async save() {
        if (!rec) return 'Nada gravado ainda — aperte Gravar enquanto canta.';
        return false;
      },
      unmount() {
        alive = false;
        cancelAnimationFrame(raf);
        clearInterval(recTimer);
        stopBacking();
        otterPlayers.forEach((p) => p.dispose && p.dispose());
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (rec) rec.dispose();
        [pitchShift, chorus, delay, crusher, voiceGain, backingGain, micNode].forEach((n) => n && n.dispose && n.dispose());
        if (window.__mmpCantar) delete window.__mmpCantar;
      }
    };
  }
};
