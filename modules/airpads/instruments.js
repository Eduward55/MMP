// Instrumentos e escalas do Air Pads (Tone.js de /vendor).
import { SCALES, SCALE_BY_ID, midiHz } from '../shared/instruments.js';

export const INSTRUMENTS = [
  { id: 'piano', name: 'Piano', color: '#7a93b8', octave: 4, octaves: 2 },
  { id: 'drums', name: 'Bateria', color: '#9a7ab0' },
  { id: 'synth', name: 'Synth', color: '#8b5cf6', octave: 4, octaves: 2 },
  { id: 'bass', name: 'Baixo', color: '#b8a46a', octave: 2, octaves: 1 },
  { id: 'theremin', name: 'Theremin', color: '#6f9a7e', octave: 4, octaves: 2, continuous: true },
  { id: 'bloco', name: 'Bloco', color: '#86b36b', octave: 4, octaves: 2 },
  { id: 'sinos', name: 'Sinos', color: '#d4b36a', octave: 5, octaves: 2 },
  { id: 'harpa', name: 'Harpa', color: '#c48bb0', octave: 4, octaves: 2 },
  { id: 'flauta', name: 'Flauta', color: '#6aa8c4', octave: 5, octaves: 1 }
];
export const INSTRUMENT_BY_ID = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i]));

export { SCALES, SCALE_BY_ID, ROOTS, midiName } from '../shared/instruments.js';

export const DRUM_ZONES = ['Chimbal', 'Caixa', 'Bumbo'];

/** Furo central do pad (anel = círculo menos este raio). rx/ry ∈ [-1, 1]; 0.3 = 30% do raio. */
export const DEADZONE = 0.3;
export function inDeadzone(rx, ry, r = DEADZONE) {
  return Math.hypot(Number(rx) || 0, Number(ry) || 0) < r;
}

// Notas MIDI da escala para um instrumento, do grave ao agudo (inclui a oitava final).
export function scaleNotes(instrumentId, scaleId, root) {
  const inst = INSTRUMENT_BY_ID[instrumentId];
  const steps = (SCALE_BY_ID[scaleId] || SCALES[0]).steps;
  const base = 12 * ((inst.octave || 4) + 1) + root;
  const out = [];
  for (let o = 0; o < (inst.octaves || 1); o++) steps.forEach((s) => out.push(base + 12 * o + s));
  out.push(base + 12 * (inst.octaves || 1));
  return out;
}

// rx, ry ∈ [-1, 1] relativos ao centro do círculo. Fatias em pizza a partir do topo, sentido horário.
export function sliceIndex(rx, ry, n) {
  const count = Math.max(1, n);
  let ang = Math.atan2(rx, -ry);
  if (ang < 0) ang += Math.PI * 2;
  return Math.min(count - 1, Math.floor((ang / (Math.PI * 2)) * count));
}

export function pickNote(notes, ry, rx = 0) {
  if (!notes.length) return 60;
  return notes[sliceIndex(rx, ry, notes.length)];
}

export function drumZone(ry, rx = 0) {
  return sliceIndex(rx, ry, 3);
}

export function createInstrument(Tone, id, out) {
  if (id === 'piano') {
    const s = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.4,
      modulationIndex: 2.4,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.012, decay: 1.15, sustain: 0.08, release: 1.35 },
      modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.5 },
      volume: -14
    }).connect(out);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '4n', t), dispose: () => s.dispose() };
  }
  if (id === 'synth') {
    const delay = new Tone.FeedbackDelay('8n.', 0.18).connect(out);
    delay.wet.value = 0.22;
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.22, release: 0.55 },
      volume: -18
    }).connect(delay);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '8n', t), dispose: () => [s, delay].forEach((n) => n.dispose()) };
  }
  if (id === 'bass') {
    const s = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      filter: { Q: 1.2, type: 'lowpass' },
      envelope: { attack: 0.01, decay: 0.28, sustain: 0.35, release: 0.35 },
      filterEnvelope: { attack: 0.01, decay: 0.18, sustain: 0.2, baseFrequency: 90, octaves: 2.2 },
      volume: -10
    }).connect(out);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '8n', t), dispose: () => s.dispose() };
  }
  if (id === 'drums') {
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.28, sustain: 0 },
      volume: -8
    }).connect(out);
    const hp = new Tone.Filter(1400, 'highpass').connect(out);
    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      volume: -12
    }).connect(hp);
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 24,
      resonance: 3800,
      octaves: 1.2,
      volume: -24
    }).connect(out);
    return {
      play: (zone, t) => {
        if (zone === 0) hat.triggerAttackRelease(220, '32n', t);
        else if (zone === 1) snare.triggerAttackRelease('16n', t);
        else kick.triggerAttackRelease('C1', '8n', t);
      },
      dispose: () => [kick, hp, snare, hat].forEach((n) => n.dispose())
    };
  }
  if (id === 'bloco') {
    const s = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.06 },
      volume: -16
    }).connect(out);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '16n', t), dispose: () => s.dispose() };
  }
  if (id === 'sinos') {
    const s = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 7.2,
      modulationIndex: 3.4,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 0.7 },
      modulationEnvelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.2 },
      volume: -16
    }).connect(out);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '4n', t), dispose: () => s.dispose() };
  }
  if (id === 'harpa') {
    const s = new Tone.PluckSynth({
      attackNoise: 0.6,
      dampening: 3200,
      resonance: 0.85
    }).connect(out);
    s.volume.value = -8;
    return { play: (m, t) => s.triggerAttack(midiHz(m), t), dispose: () => s.dispose() };
  }
  if (id === 'flauta') {
    const s = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.06, decay: 0.12, sustain: 0.35, release: 0.28 },
      volume: -14
    }).connect(out);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '8n', t), dispose: () => s.dispose() };
  }
  // Theremin: oscilador contínuo; X escolhe a nota (quantizada na escala, com glissando) e Y o volume.
  const osc = new Tone.Oscillator(440, 'sine');
  const vib = new Tone.Vibrato(4.2, 0.08);
  const gain = new Tone.Gain(0);
  osc.chain(vib, gain, out);
  osc.start();
  return {
    continuous: true,
    hold(m, vol) {
      osc.frequency.rampTo(midiHz(m), 0.08);
      gain.gain.rampTo(0.03 + vol * 0.32, 0.07);
    },
    release() {
      gain.gain.rampTo(0, 0.2);
    },
    dispose: () => [osc, vib, gain].forEach((n) => n.dispose())
  };
}

/** Palmas ao juntar as mãos (gesto, não é chip de círculo). */
export function createClap(Tone, out) {
  const bp = new Tone.Filter(1800, 'bandpass');
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
    volume: -10
  });
  noise.chain(bp, out);
  return {
    play: (t) => noise.triggerAttackRelease('16n', t),
    dispose: () => [noise, bp].forEach((n) => n.dispose())
  };
}
