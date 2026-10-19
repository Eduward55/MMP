// Instrumentos e escalas do Air Pads (Tone.js de /vendor).
import { SCALES, SCALE_BY_ID, midiHz } from '../shared/instruments.js';

export const INSTRUMENTS = [
  { id: 'piano', name: 'Piano', color: '#7a93b8', octave: 4, octaves: 2 },
  { id: 'drums', name: 'Bateria', color: '#9a7ab0' },
  { id: 'synth', name: 'Synth', color: '#8b5cf6', octave: 4, octaves: 2 },
  { id: 'bass', name: 'Baixo', color: '#b8a46a', octave: 2, octaves: 1 },
  { id: 'theremin', name: 'Theremin', color: '#6f9a7e', octave: 4, octaves: 2, continuous: true }
];
export const INSTRUMENT_BY_ID = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i]));

export { SCALES, SCALE_BY_ID, ROOTS, midiName } from '../shared/instruments.js';

export const DRUM_ZONES = ['Chimbal', 'Caixa', 'Bumbo'];

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


// rx, ry ∈ [-1, 1] relativos ao centro do círculo. Topo = agudo / forte.
export function pickNote(notes, ry) {
  const t = 1 - (Math.max(-1, Math.min(1, ry)) + 1) / 2;
  return notes[Math.round(t * (notes.length - 1))];
}

export function drumZone(ry) {
  return ry < -0.33 ? 0 : ry < 0.33 ? 1 : 2;
}

export function createInstrument(Tone, id, out) {
  if (id === 'piano') {
    const s = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.003, decay: 0.9, sustain: 0.05, release: 1.1 },
      modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
      volume: -8
    }).connect(out);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '4n', t), dispose: () => s.dispose() };
  }
  if (id === 'synth') {
    const delay = new Tone.FeedbackDelay('8n.', 0.28).connect(out);
    const s = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.25, sustain: 0.25, release: 0.4 }, volume: -16 }).connect(delay);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '8n', t), dispose: () => [s, delay].forEach((n) => n.dispose()) };
  }
  if (id === 'bass') {
    const s = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      filter: { Q: 2, type: 'lowpass' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.3 },
      filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.2, baseFrequency: 120, octaves: 3 },
      volume: -6
    }).connect(out);
    return { play: (m, t) => s.triggerAttackRelease(midiHz(m), '8n', t), dispose: () => s.dispose() };
  }
  if (id === 'drums') {
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.35, sustain: 0 } }).connect(out);
    const hp = new Tone.Filter(1600, 'highpass').connect(out);
    const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -6 }).connect(hp);
    const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4200, octaves: 1.5, volume: -20 }).connect(out);
    return {
      play: (zone, t) => {
        if (zone === 0) hat.triggerAttackRelease(220, '32n', t);
        else if (zone === 1) snare.triggerAttackRelease('16n', t);
        else kick.triggerAttackRelease('C1', '8n', t);
      },
      dispose: () => [kick, hp, snare, hat].forEach((n) => n.dispose())
    };
  }
  // Theremin: oscilador contínuo; X escolhe a nota (quantizada na escala, com glissando) e Y o volume.
  const osc = new Tone.Oscillator(440, 'sine');
  const vib = new Tone.Vibrato(5.5, 0.12);
  const gain = new Tone.Gain(0);
  osc.chain(vib, gain, out);
  osc.start();
  return {
    continuous: true,
    hold(m, vol) {
      osc.frequency.rampTo(midiHz(m), 0.06);
      gain.gain.rampTo(0.05 + vol * 0.45, 0.05);
    },
    release() {
      gain.gain.rampTo(0, 0.15);
    },
    dispose: () => [osc, vib, gain].forEach((n) => n.dispose())
  };
}
