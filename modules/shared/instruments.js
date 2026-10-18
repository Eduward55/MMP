// Catálogo de instrumentos compartilhado: o que os módulos gravam como eventos e o que o Studio toca/renderiza.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const ROOTS = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];

export const SCALES = [
  { id: 'major', name: 'Maior', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: 'Menor', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'penta', name: 'Pentatônica', steps: [0, 2, 4, 7, 9] },
  { id: 'blues', name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  { id: 'dorian', name: 'Dórica', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'chromatic', name: 'Cromática', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
];
export const SCALE_BY_ID = Object.fromEntries(SCALES.map((s) => [s.id, s]));

export function midiName(m) {
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function inScale(midi, scaleId, root) {
  const steps = (SCALE_BY_ID[scaleId] || SCALES[0]).steps;
  return steps.includes((((midi - root) % 12) + 12) % 12);
}

// Nota da escala mais próxima (em empate, a de baixo).
export function snapToScale(midi, scaleId, root) {
  for (let d = 0; d < 12; d++) {
    if (inScale(midi - d, scaleId, root)) return midi - d;
    if (inScale(midi + d, scaleId, root)) return midi + d;
  }
  return midi;
}

// Notas MIDI da escala entre lo e hi (inclusive), do agudo para o grave.
export function scaleRange(scaleId, root, lo, hi) {
  const out = [];
  for (let m = hi; m >= lo; m--) if (inScale(m, scaleId, root)) out.push(m);
  return out;
}

export const DRUM_KIT = [
  { note: 49, name: 'Prato' },
  { note: 46, name: 'Chimbal aberto' },
  { note: 42, name: 'Chimbal' },
  { note: 76, name: 'Tamborim' },
  { note: 45, name: 'Tom' },
  { note: 39, name: 'Palmas' },
  { note: 38, name: 'Caixa' },
  { note: 37, name: 'Aro' },
  { note: 36, name: 'Bumbo' }
];
export const DRUM_BY_NOTE = Object.fromEntries(DRUM_KIT.map((d) => [d.note, d]));
export const nearestDrum = (n) => DRUM_KIT.reduce((a, b) => (Math.abs(b.note - n) < Math.abs(a.note - n) ? b : a)).note;

export const INSTRUMENTS = [
  { id: 'piano', name: 'Piano', color: '#5ff3ff', range: [48, 84] },
  { id: 'keys', name: 'Teclado Fofo', color: '#8fd3ff', range: [48, 84] },
  { id: 'synth', name: 'Synth Neon', color: '#9b5cff', range: [48, 84] },
  { id: 'pad', name: 'Pad', color: '#5ff3ff', range: [45, 77] },
  { id: 'chip', name: 'Chip 8-bit', color: '#5dff9b', range: [60, 96] },
  { id: 'bass', name: 'Baixo', color: '#ffd23f', range: [28, 60] },
  { id: 'theremin', name: 'Theremin', color: '#5dff9b', range: [55, 91] },
  { id: 'meow', name: 'Miau', color: '#ff7fb0', range: [60, 96] },
  { id: 'bells', name: 'Sininhos', color: '#ffe08a', range: [72, 103] },
  { id: 'fx', name: 'Efeitos', color: '#b07cff', range: [48, 108] },
  { id: 'drums', name: 'Bateria', color: '#ff4fd8', drums: true, range: [36, 76] }
];
export const INSTRUMENT_BY_ID = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i]));

const dispose = (...nodes) => () => nodes.forEach((n) => n && n.dispose());

// Voz tocável: play(midi, durSegundos, tempo, velocidade 0..1). Funciona em contexto normal e no Tone.Offline.
export function createVoice(Tone, id, out) {
  const vel = (v) => Math.max(0.05, Math.min(1, v ?? 0.8));
  if (id === 'drums') {
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.35, sustain: 0 } }).connect(out);
    const tom = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0 }, volume: -6 }).connect(out);
    const perc = new Tone.MembraneSynth({ pitchDecay: 0.005, octaves: 1.5, envelope: { attack: 0.001, decay: 0.06, sustain: 0 }, volume: -12 }).connect(out);
    const hp = new Tone.Filter(1600, 'highpass').connect(out);
    const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -6 }).connect(hp);
    const bp = new Tone.Filter(1200, 'bandpass').connect(out);
    const clap = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: 2 }).connect(bp);
    const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4200, octaves: 1.5, volume: -20 }).connect(out);
    const ohat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.25, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4200, octaves: 1.5, volume: -22 }).connect(out);
    const crash = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 1, release: 0.4 }, harmonicity: 4.1, modulationIndex: 40, resonance: 5000, octaves: 2, volume: -24 }).connect(out);
    return {
      play(n, _d, t, v) {
        const note = nearestDrum(n);
        const g = vel(v);
        if (note === 36) kick.triggerAttackRelease('C1', '8n', t, g);
        else if (note === 37) perc.triggerAttackRelease('D4', '32n', t, g);
        else if (note === 38) snare.triggerAttackRelease('16n', t, g);
        else if (note === 39) [0, 0.012, 0.024].forEach((o) => clap.triggerAttackRelease(0.03, t + o, g));
        else if (note === 42) hat.triggerAttackRelease(230, '32n', t, g);
        else if (note === 45) tom.triggerAttackRelease('G2', '8n', t, g);
        else if (note === 46) ohat.triggerAttackRelease(230, '8n', t, g);
        else if (note === 49) crash.triggerAttackRelease(300, '2n', t, g);
        else perc.triggerAttackRelease('E5', '32n', t, g);
      },
      dispose: dispose(kick, tom, perc, hp, snare, bp, clap, hat, ohat, crash)
    };
  }
  let synth;
  let extra = [];
  if (id === 'piano') {
    synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.003, decay: 0.9, sustain: 0.1, release: 1 },
      modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
      volume: -8
    }).connect(out);
  } else if (id === 'keys') {
    synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6 }, volume: -8 }).connect(out);
  } else if (id === 'synth') {
    const delay = new Tone.FeedbackDelay('8n.', 0.25).connect(out);
    synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.4 }, volume: -16 }).connect(delay);
    extra = [delay];
  } else if (id === 'pad') {
    const rev = new Tone.Freeverb(0.8, 2500).connect(out);
    rev.wet.value = 0.35;
    synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', spread: 20, count: 3 }, envelope: { attack: 0.3, decay: 0.3, sustain: 0.7, release: 1 }, volume: -20 }).connect(rev);
    extra = [rev];
  } else if (id === 'chip') {
    synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.08, sustain: 0.25, release: 0.05 }, volume: -18 }).connect(out);
  } else if (id === 'bass') {
    synth = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'square' },
      filter: { Q: 2, type: 'lowpass' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.2 },
      filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.2, baseFrequency: 120, octaves: 3 },
      volume: -10
    }).connect(out);
  } else if (id === 'theremin') {
    const vib = new Tone.Vibrato(5.5, 0.15).connect(out);
    synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.06, decay: 0.1, sustain: 0.8, release: 0.3 }, volume: -8 }).connect(vib);
    extra = [vib];
  } else if (id === 'meow') {
    const formant = new Tone.Filter(1000, 'bandpass').connect(out);
    formant.Q.value = 1.5;
    synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.03, decay: 0.15, sustain: 0.5, release: 0.15 }, volume: -8 }).connect(formant);
    extra = [formant];
  } else if (id === 'bells') {
    const rev = new Tone.Freeverb(0.7, 3000).connect(out);
    rev.wet.value = 0.3;
    synth = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.001, decay: 1, sustain: 0, release: 1 }, modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 }, volume: -14 }).connect(rev);
    extra = [rev];
  } else {
    synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 }, volume: -18 }).connect(out);
  }
  synth.maxPolyphony = 24;
  return {
    play(n, d, t, v) {
      synth.triggerAttackRelease(midiHz(n), Math.max(0.03, d), t, vel(v));
    },
    stop(t) {
      synth.releaseAll(t);
    },
    dispose: dispose(synth, ...extra)
  };
}
