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

export const AUDIO_RECORDER_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
export const VIDEO_RECORDER_MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function pickRecorderMime(list) {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// Só áudio: MediaRecorder em trilha de áudio (opus). Tone.Recorder não define mimeType e o Chromium
// acaba gravando video/webm — o mesmo container do modo "áudio + animação".
export async function createOutputRecorder(tapNode) {
  const Tone = await startAudio();
  const src = tapNode || Tone.getDestination();
  const dest = Tone.context.createMediaStreamDestination();
  src.connect(dest);
  const stream = new MediaStream(dest.stream.getAudioTracks());
  const mime = pickRecorderMime(AUDIO_RECORDER_MIMES);
  if (!mime) {
    cleanup();
    throw new Error('Este aparelho não grava áudio webm/opus.');
  }
  const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });
  const chunks = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let startedAt = 0;

  function cleanup() {
    try {
      src.disconnect(dest);
    } catch {}
    stream.getTracks().forEach((t) => t.stop());
    dest.stream.getTracks().forEach((t) => t.stop());
  }

  function audioBlob() {
    const reported = mr.mimeType || mime;
    const type = reported.startsWith('audio/') ? reported : mime;
    return new Blob(chunks, { type });
  }

  return {
    get recording() {
      return mr.state === 'recording';
    },
    start() {
      startedAt = performance.now();
      if (mr.state === 'inactive') mr.start(250);
    },
    stop() {
      return new Promise((resolve, reject) => {
        const finish = () => {
          cleanup();
          resolve({ blob: audioBlob(), seconds: (performance.now() - startedAt) / 1000 });
        };
        mr.onerror = () => {
          cleanup();
          reject(mr.error || new Error('Falhou a gravação de áudio.'));
        };
        if (mr.state === 'recording') {
          mr.onstop = finish;
          mr.stop();
        } else finish();
      });
    },
    dispose() {
      try {
        if (mr.state === 'recording') mr.stop();
      } catch {}
      cleanup();
    }
  };
}
