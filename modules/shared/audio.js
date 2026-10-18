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
