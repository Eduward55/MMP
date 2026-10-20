// Sons compartilhados (Tone.js carregado de /vendor) e gravação da saída do app.
import { startAudio } from './ui.js';

export function createKit(Tone) {
  const out = new Tone.Gain(0.9).toDestination();
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 } }).connect(out);
  const snareFilter = new Tone.Filter(1600, 'highpass').connect(out);
  const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -6 }).connect(snareFilter);
  const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4200, octaves: 1.5, volume: -22 }).connect(out);
  const meow = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 5, type: 'lowpass' },
    envelope: { attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.15 },
    filterEnvelope: { attack: 0.04, decay: 0.2, sustain: 0.3, baseFrequency: 600, octaves: 2.5 },
    volume: -14
  }).connect(out);
  const keys = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6 }, volume: -10 }).connect(out);

  const play = {
    kick: (t) => kick.triggerAttackRelease('C1', '8n', t),
    snare: (t) => snare.triggerAttackRelease('16n', t),
    hat: (t) => hat.triggerAttackRelease(220, '32n', t),
    meow: (t) => {
      const time = t ?? Tone.now();
      meow.triggerAttackRelease(620, 0.28, time);
      meow.frequency.setValueAtTime(620, time);
      meow.frequency.exponentialRampToValueAtTime(980, time + 0.08);
      meow.frequency.exponentialRampToValueAtTime(480, time + 0.3);
    },
    note: (n, t, d = '8n') => keys.triggerAttackRelease(n, d, t)
  };

  return {
    play,
    keys,
    dispose() {
      [kick, snare, snareFilter, hat, meow, keys, out].forEach((n) => n.dispose());
    }
  };
}

// Tetris: musiquinha chiptune fofa (original, bem baixinha) + SFX de peça.
export function createTetrisKit(Tone, { gain = 0.7, music = true } = {}) {
  const master = new Tone.Gain(0).toDestination();
  const musicGain = new Tone.Gain(0.42).connect(master);
  const sfxGain = new Tone.Gain(0.88).connect(master);
  const musicFilter = new Tone.Filter(2100, 'lowpass').connect(musicGain);

  const lead = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.008, decay: 0.12, sustain: 0.12, release: 0.08 },
    volume: -20
  }).connect(musicFilter);
  const bass = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.18, sustain: 0.22, release: 0.1 },
    volume: -16
  }).connect(musicFilter);
  const sparkle = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.08 },
    volume: -26
  }).connect(musicFilter);

  const blip = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.03 },
    volume: -14
  }).connect(sfxGain);
  const chime = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: 0.22, sustain: 0, release: 0.14 },
    volume: -12
  }).connect(sfxGain);
  const thud = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 3.2,
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -12
  }).connect(sfxGain);
  const dust = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0 },
    volume: -24
  }).connect(sfxGain);

  let level = Math.max(0, Math.min(1, Number(gain) || 0));
  let musicOn = Boolean(music);
  let step = 0;

  const applyGain = () => {
    try {
      if (master.gain && typeof master.gain.rampTo === 'function') master.gain.rampTo(level, 0.04);
      else master.gain.value = level;
    } catch {
      try {
        master.gain.value = level;
      } catch {}
    }
  };
  applyGain();

  const LEAD = [
    'E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'C5', 'E5',
    'G5', 'A5', 'C6', 'A5', 'G5', 'E5', 'D5', null,
    'C5', 'E5', 'G5', 'E5', 'F5', 'A5', 'G5', 'E5',
    'D5', 'E5', 'C5', 'G4', 'A4', 'C5', 'E5', null
  ];
  const BASS = [
    'C3', 'C3', 'G2', 'G2', 'A2', 'A2', 'E2', 'E2',
    'F2', 'F2', 'C3', 'C3', 'G2', 'G2', 'G2', 'G2',
    'C3', 'C3', 'E3', 'E3', 'F3', 'F3', 'C3', 'C3',
    'G2', 'G2', 'A2', 'A2', 'G2', 'G2', 'C3', 'C3'
  ];

  const prevBpm = Tone.Transport.bpm.value;
  Tone.Transport.bpm.value = 96;
  const loop = new Tone.Loop((time) => {
    if (!musicOn || level <= 0) return;
    const i = step % LEAD.length;
    if (BASS[i]) bass.triggerAttackRelease(BASS[i], '8n', time);
    if (LEAD[i]) lead.triggerAttackRelease(LEAD[i], '8n', time);
    if (i === 8 || i === 24) sparkle.triggerAttackRelease('E6', '16n', time);
    step += 1;
  }, '8n');
  loop.start(0);
  if (Tone.Transport.state !== 'started') Tone.Transport.start();

  const now = () => Tone.now() + 0.02;
  const safe = (fn) => {
    try {
      fn();
    } catch {}
  };

  return {
    setGain(v) {
      level = Math.max(0, Math.min(1, Number(v) || 0));
      applyGain();
    },
    setMusic(on) {
      musicOn = Boolean(on);
    },
    move() {
      safe(() => blip.triggerAttackRelease('G5', '32n', now()));
    },
    rotate() {
      safe(() => {
        const t = now();
        blip.triggerAttackRelease('C5', '32n', t);
        blip.triggerAttackRelease('E5', '32n', t + 0.045);
      });
    },
    soft() {
      safe(() => blip.triggerAttackRelease('A4', '32n', now()));
    },
    hard() {
      safe(() => {
        const t = now();
        thud.triggerAttackRelease('C2', 0.16, t);
        dust.triggerAttackRelease(0.08, t);
      });
    },
    clear(n = 1) {
      safe(() => {
        const t = now();
        const count = Math.max(1, Math.min(4, n | 0));
        const fanfare = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
        const notes = count >= 4 ? fanfare : fanfare.slice(0, count + 2);
        const gap = count >= 4 ? 0.07 : 0.055;
        notes.forEach((note, i) => chime.triggerAttackRelease(note, count >= 4 ? 0.2 : 0.14, t + i * gap));
      });
    },
    level() {
      safe(() => {
        const t = now();
        chime.triggerAttackRelease('E5', '16n', t);
        chime.triggerAttackRelease('G5', '16n', t + 0.09);
        chime.triggerAttackRelease('C6', '8n', t + 0.18);
      });
    },
    over() {
      safe(() => {
        const t = now();
        chime.triggerAttackRelease('G4', 0.22, t);
        chime.triggerAttackRelease('E4', 0.26, t + 0.18);
        chime.triggerAttackRelease('C4', 0.32, t + 0.38);
        chime.triggerAttackRelease('G3', 0.5, t + 0.62);
      });
    },
    dispose() {
      try {
        loop.stop();
        loop.dispose();
      } catch {}
      try {
        Tone.Transport.bpm.value = prevBpm;
      } catch {}
      [lead, bass, sparkle, blip, chime, thud, dust, musicFilter, musicGain, sfxGain, master].forEach((n) => {
        try {
          n.dispose();
        } catch {}
      });
    }
  };
}

export const AUDIO_RECORDER_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
export const VIDEO_RECORDER_MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function pickRecorderMime(list) {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// Grava tudo que sai pelo Tone.Destination (webm/opus).
export async function createOutputRecorder() {
  const Tone = await startAudio();
  const recorder = new Tone.Recorder();
  Tone.getDestination().connect(recorder);
  let startedAt = 0;
  return {
    get recording() {
      return recorder.state === 'started';
    },
    start() {
      startedAt = performance.now();
      recorder.start();
    },
    async stop() {
      const blob = await recorder.stop();
      return { blob, seconds: (performance.now() - startedAt) / 1000 };
    },
    dispose() {
      try {
        Tone.getDestination().disconnect(recorder);
      } catch {}
      recorder.dispose();
    }
  };
}
