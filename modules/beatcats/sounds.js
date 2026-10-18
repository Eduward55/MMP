// 24 sons sintetizados com Tone.js. Cada som é uma camada em loop de 4 compassos (64 semicolcheias)
// sobre a progressão Lá menor – Fá – Dó – Sol. tick(step, time) devolve true quando o gato "canta".

import { createEventLog, tapTone } from '../shared/events.js';

export const LOOP_STEPS = 64;

export const GROUPS = [
  { id: 'drums', name: 'Bateria', color: '#ff4fd8' },
  { id: 'bass', name: 'Baixo', color: '#ffd23f' },
  { id: 'chords', name: 'Acordes', color: '#5ff3ff' },
  { id: 'melody', name: 'Melodia', color: '#5dff9b' },
  { id: 'fx', name: 'Efeitos', color: '#b07cff' }
];
export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

const CHORDS = [
  ['A3', 'C4', 'E4'],
  ['A3', 'C4', 'F4'],
  ['G3', 'C4', 'E4'],
  ['G3', 'B3', 'D4']
];
const ROOTS = ['A1', 'F1', 'C2', 'G1'];
const bar = (step) => Math.floor(step / 16) % 4;
const at = (step, list) => list.includes(step % 16);

function T(Tone) {
  const s16 = Tone.Time('16n').toSeconds();
  return {
    s16,
    up: (note, semis) => Tone.Frequency(note).transpose(semis).toNote(),
    hz: (note) => Tone.Frequency(note).toFrequency()
  };
}

function phrase(list) {
  const map = new Map();
  list.forEach(([step, note, len = 2]) => map.set(step, { note, len }));
  return map;
}

const disposer = (...nodes) => () => nodes.forEach((n) => n && n.dispose());

export const SOUNDS = [
  /* ---------- Bateria (6) ---------- */
  {
    id: 'bumbo', name: 'Bumbo Fofo', group: 'drums', outfit: 'capacete',
    make(Tone, out) {
      const k = new Tone.MembraneSynth({ pitchDecay: 0.035, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 } }).connect(out);
      return { tick: (s, t) => (at(s, [0, 8, 10]) ? (k.triggerAttackRelease('C1', '8n', t, s % 16 === 10 ? 0.6 : 1), true) : false), dispose: disposer(k) };
    }
  },
  {
    id: 'caixa', name: 'Caixa Estalo', group: 'drums', outfit: 'boina',
    make(Tone, out) {
      const hp = new Tone.Filter(1500, 'highpass').connect(out);
      const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.17, sustain: 0 }, volume: -5 }).connect(hp);
      const body = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 }, volume: -12 }).connect(out);
      return {
        tick: (s, t) => {
          if (!at(s, [4, 12]) && !(s % 64 === 63)) return false;
          n.triggerAttackRelease('16n', t, s % 64 === 63 ? 0.5 : 1);
          body.triggerAttackRelease('G3', '32n', t);
          return true;
        },
        dispose: disposer(hp, n, body)
      };
    }
  },
  {
    id: 'chimbal', name: 'Chimbal Tsss', group: 'drums', outfit: 'fone',
    make(Tone, out) {
      const h = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, release: 0.02 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4200, octaves: 1.5, volume: -20 }).connect(out);
      return {
        tick: (s, t) => {
          if (s % 2) return false;
          const open = s % 16 === 14;
          h.envelope.decay = open ? 0.22 : 0.05;
          h.triggerAttackRelease(230, open ? '8n' : '32n', t, s % 4 === 0 ? 0.6 : 1);
          return true;
        },
        dispose: disposer(h)
      };
    }
  },
  {
    id: 'palmas', name: 'Palminhas', group: 'drums', outfit: 'chapeu-festa',
    make(Tone, out) {
      const bp = new Tone.Filter(1200, 'bandpass').connect(out);
      const n = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: 2 }).connect(bp);
      return {
        tick: (s, t) => {
          if (!at(s, [4, 12])) return false;
          [0, 0.012, 0.024].forEach((d) => n.triggerAttackRelease(0.03, t + d));
          return true;
        },
        dispose: disposer(bp, n)
      };
    }
  },
  {
    id: 'tamborim', name: 'Tamborim', group: 'drums', outfit: 'coroa',
    make(Tone, out) {
      const m = new Tone.MembraneSynth({ pitchDecay: 0.005, octaves: 1.5, envelope: { attack: 0.001, decay: 0.06, sustain: 0 }, volume: -12 }).connect(out);
      return { tick: (s, t) => (at(s, [0, 3, 6, 8, 10, 13, 14]) ? (m.triggerAttackRelease(s % 16 === 0 ? 'A5' : 'E5', '32n', t), true) : false), dispose: disposer(m) };
    }
  },
  {
    id: 'beatbox', name: 'Boca Beatbox', group: 'drums', outfit: 'chapeu-bruxa',
    make(Tone, out) {
      const boots = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 4, envelope: { attack: 0.002, decay: 0.25, sustain: 0 }, volume: -2 }).connect(out);
      const bp = new Tone.Filter(3200, 'bandpass', -12).connect(out);
      const cats = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.003, decay: 0.09, sustain: 0 }, volume: -2 }).connect(bp);
      return {
        tick: (s, t) => {
          if (at(s, [0, 7, 10])) boots.triggerAttackRelease('E1', '8n', t);
          else if (at(s, [4, 12])) cats.triggerAttackRelease('16n', t);
          else return false;
          return true;
        },
        dispose: disposer(boots, bp, cats)
      };
    }
  },

  /* ---------- Baixo (5) ---------- */
  {
    id: 'baixo-pulso', name: 'Baixo Pulso', group: 'bass', outfit: 'sueter',
    make(Tone, out) {
      const b = new Tone.MonoSynth({ oscillator: { type: 'square' }, filter: { Q: 2 }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.1 }, filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.2, baseFrequency: 140, octaves: 2.5 }, volume: -10 }).connect(out);
      const u = T(Tone);
      return { tick: (s, t) => (s % 2 === 0 ? (b.triggerAttackRelease(u.up(ROOTS[bar(s)], s % 8 === 6 ? 24 : 12), '16n', t), true) : false), dispose: disposer(b) };
    }
  },
  {
    id: 'baixo-sub', name: 'Sub Grave', group: 'bass', outfit: 'astronauta',
    make(Tone, out) {
      const b = new Tone.MonoSynth({ oscillator: { type: 'sine' }, filter: { type: 'lowpass', frequency: 400 }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.3 }, volume: -2 }).connect(out);
      const u = T(Tone);
      return { tick: (s, t) => (at(s, [0, 8]) ? (b.triggerAttackRelease(ROOTS[bar(s)], u.s16 * 7, t), true) : false), dispose: disposer(b) };
    }
  },
  {
    id: 'baixo-funk', name: 'Baixo Funk', group: 'bass', outfit: 'gravata',
    make(Tone, out) {
      const b = new Tone.FMSynth({ harmonicity: 1, modulationIndex: 8, envelope: { attack: 0.002, decay: 0.18, sustain: 0.1, release: 0.1 }, modulationEnvelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.1 }, volume: -8 }).connect(out);
      const u = T(Tone);
      const pattern = { 0: 12, 3: 24, 6: 12, 8: 12, 10: 19, 13: 24 };
      return {
        tick: (s, t) => {
          const semis = pattern[s % 16];
          if (semis === undefined) return false;
          b.triggerAttackRelease(u.up(ROOTS[bar(s)], semis), '16n', t);
          return true;
        },
        dispose: disposer(b)
      };
    }
  },
  {
    id: 'baixo-wobble', name: 'Wobble Neon', group: 'bass', outfit: 'maid',
    make(Tone, out) {
      const f = new Tone.Filter(600, 'lowpass', -24).connect(out);
      f.Q.value = 6;
      const lfo = new Tone.LFO('8n', 180, 1800).connect(f.frequency).start();
      const b = new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.2 }, filterEnvelope: { baseFrequency: 2000, octaves: 0 }, volume: -10 }).connect(f);
      const u = T(Tone);
      return { tick: (s, t) => (at(s, [0, 6, 12]) ? (b.triggerAttackRelease(u.up(ROOTS[bar(s)], 12), u.s16 * (s % 16 === 12 ? 4 : 6), t), true) : false), dispose: disposer(f, lfo, b) };
    }
  },
  {
    id: 'baixo-walk', name: 'Baixo Passeio', group: 'bass', outfit: 'cachecol',
    make(Tone, out) {
      const b = new Tone.MonoSynth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.5, release: 0.2 }, filterEnvelope: { baseFrequency: 300, octaves: 2 }, volume: -4 }).connect(out);
      const u = T(Tone);
      const steps = [0, 4, 7, 9];
      return { tick: (s, t) => (s % 4 === 0 ? (b.triggerAttackRelease(u.up(ROOTS[bar(s)], 12 + steps[(s % 16) / 4]), '8n', t), true) : false), dispose: disposer(b) };
    }
  },

  /* ---------- Acordes (5) ---------- */
  {
    id: 'pad-neon', name: 'Pad Neon', group: 'chords', outfit: 'oculos',
    make(Tone, out) {
      const rev = new Tone.Freeverb(0.8, 2500).connect(out);
      rev.wet.value = 0.35;
      const p = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', spread: 20, count: 3 }, envelope: { attack: 0.4, decay: 0.3, sustain: 0.7, release: 1.2 }, volume: -22 }).connect(rev);
      const u = T(Tone);
      return { tick: (s, t) => (s % 16 === 0 ? (p.triggerAttackRelease(CHORDS[bar(s)], u.s16 * 15, t), true) : false), stop: (t) => p.releaseAll(t), dispose: disposer(p, rev) };
    }
  },
  {
    id: 'stab', name: 'Stab Contratempo', group: 'chords', outfit: 'oculos-coracao',
    make(Tone, out) {
      const p = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.08 }, volume: -20 }).connect(out);
      const u = T(Tone);
      return { tick: (s, t) => (at(s, [2, 6, 10, 14]) ? (p.triggerAttackRelease(CHORDS[bar(s)].map((n) => u.up(n, 12)), '16n', t), true) : false), dispose: disposer(p) };
    }
  },
  {
    id: 'arpejo', name: 'Arpejo Estrela', group: 'chords', outfit: 'estrelinha',
    make(Tone, out) {
      const d = new Tone.FeedbackDelay('8n.', 0.25).connect(out);
      const p = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.1 }, volume: -12 }).connect(d);
      const u = T(Tone);
      const order = [0, 1, 2, 1];
      return {
        tick: (s, t) => {
          if (s % 2) return false;
          const c = CHORDS[bar(s)];
          p.triggerAttackRelease(u.up(c[order[(s / 2) % 4]], s % 8 >= 4 ? 24 : 12), '16n', t);
          return true;
        },
        dispose: disposer(d, p)
      };
    }
  },
  {
    id: 'orgao', name: 'Órgão Groove', group: 'chords', outfit: 'coleira',
    make(Tone, out) {
      const p = new Tone.PolySynth(Tone.AMSynth, { harmonicity: 2, envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 }, volume: -20 }).connect(out);
      const u = T(Tone);
      return { tick: (s, t) => (at(s, [0, 3, 6, 10, 12]) ? (p.triggerAttackRelease(CHORDS[bar(s)], u.s16 * (s % 16 === 12 ? 3 : 2), t), true) : false), dispose: disposer(p) };
    }
  },
  {
    id: 'coral-miau', name: 'Coral Miau', group: 'chords', outfit: 'lacinho',
    make(Tone, out) {
      const formant = new Tone.Filter(900, 'bandpass', -12).connect(out);
      formant.Q.value = 2;
      const vib = new Tone.Vibrato(5, 0.2).connect(formant);
      const p = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.08, decay: 0.2, sustain: 0.6, release: 0.4 }, volume: -10 }).connect(vib);
      const u = T(Tone);
      return {
        tick: (s, t) => {
          if (!at(s, [0, 8])) return false;
          p.triggerAttackRelease(CHORDS[bar(s)].map((n) => u.up(n, 12)), u.s16 * 6, t);
          formant.frequency.setValueAtTime(700, t);
          formant.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
          formant.frequency.exponentialRampToValueAtTime(800, t + u.s16 * 6);
          return true;
        },
        stop: (t) => p.releaseAll(t),
        dispose: disposer(formant, vib, p)
      };
    }
  },

  /* ---------- Melodia (4) ---------- */
  {
    id: 'melodia-flauta', name: 'Flauta Lunar', group: 'melody', outfit: 'flor',
    make(Tone, out) {
      const vib = new Tone.Vibrato(5, 0.1).connect(out);
      const s1 = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.3 }, volume: -10 }).connect(vib);
      const u = T(Tone);
      const ph = phrase([[0, 'E5', 4], [4, 'D5', 2], [6, 'C5', 2], [8, 'A4', 6], [16, 'C5', 4], [20, 'D5', 2], [22, 'E5', 2], [24, 'A5', 6], [32, 'G5', 4], [36, 'E5', 2], [38, 'D5', 2], [40, 'C5', 6], [48, 'D5', 4], [52, 'E5', 2], [54, 'G5', 2], [56, 'E5', 7]]);
      return { tick: (s, t) => { const n = ph.get(s); if (!n) return false; s1.triggerAttackRelease(n.note, u.s16 * n.len, t); return true; }, stop: (t) => s1.triggerRelease(t), dispose: disposer(vib, s1) };
    }
  },
  {
    id: 'melodia-8bit', name: 'Chip 8-bit', group: 'melody', outfit: 'microfone',
    make(Tone, out) {
      const s1 = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.08, sustain: 0.2, release: 0.05 }, volume: -18 }).connect(out);
      const u = T(Tone);
      const rhythm = [0, 2, 3, 6, 8, 11, 12, 14];
      const climb = [0, 1, 2, 1, 2, 0, 1, 2];
      return {
        tick: (s, t) => {
          const k = rhythm.indexOf(s % 16);
          if (k < 0) return false;
          const c = CHORDS[bar(s)];
          s1.triggerAttackRelease(u.up(c[climb[k]], 24), '16n', t);
          return true;
        },
        dispose: disposer(s1)
      };
    }
  },
  {
    id: 'melodia-miau', name: 'Solo Miau', group: 'melody', outfit: 'batuta',
    make(Tone, out) {
      const m = new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, filter: { Q: 4, type: 'lowpass' }, envelope: { attack: 0.03, decay: 0.15, sustain: 0.5, release: 0.15 }, filterEnvelope: { attack: 0.04, decay: 0.2, sustain: 0.4, baseFrequency: 700, octaves: 2.5 }, volume: -16 }).connect(out);
      const u = T(Tone);
      const ph = phrase([[0, 'A5', 3], [4, 'C6', 3], [8, 'E5', 5], [20, 'F5', 3], [24, 'A5', 5], [32, 'G5', 3], [36, 'E5', 3], [40, 'C6', 5], [52, 'D6', 3], [56, 'B5', 6]]);
      return {
        tick: (s, t) => {
          const n = ph.get(s);
          if (!n) return false;
          const f = u.hz(n.note);
          m.triggerAttackRelease(f, u.s16 * n.len, t);
          m.frequency.setValueAtTime(f * 0.82, t);
          m.frequency.exponentialRampToValueAtTime(f * 1.06, t + 0.07);
          m.frequency.exponentialRampToValueAtTime(f * 0.94, t + u.s16 * n.len);
          return true;
        },
        dispose: disposer(m)
      };
    }
  },
  {
    id: 'melodia-sinos', name: 'Sininhos', group: 'melody', outfit: 'capa',
    make(Tone, out) {
      const rev = new Tone.Freeverb(0.75, 3000).connect(out);
      rev.wet.value = 0.3;
      const b = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.001, decay: 1, sustain: 0, release: 1 }, modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 }, volume: -16 }).connect(rev);
      const ph = phrase([[0, 'A5'], [6, 'E6'], [10, 'C6'], [16, 'F5'], [22, 'C6'], [32, 'C6'], [38, 'G6'], [42, 'E6'], [48, 'G5'], [54, 'D6'], [58, 'B5']]);
      return { tick: (s, t) => { const n = ph.get(s); if (!n) return false; b.triggerAttackRelease(n.note, '8n', t); return true; }, dispose: disposer(rev, b) };
    }
  },

  /* ---------- Efeitos (4) ---------- */
  {
    id: 'fx-laser', name: 'Laser Pew', group: 'fx', outfit: 'antena',
    make(Tone, out) {
      const s1 = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 }, volume: -18 }).connect(out);
      return {
        tick: (s, t) => {
          if (![14, 30, 46, 54, 62].includes(s)) return false;
          s1.triggerAttackRelease(1800, 0.15, t);
          s1.frequency.setValueAtTime(1800, t);
          s1.frequency.exponentialRampToValueAtTime(120, t + 0.15);
          return true;
        },
        dispose: disposer(s1)
      };
    }
  },
  {
    id: 'fx-subida', name: 'Subida Mágica', group: 'fx', outfit: 'asas',
    make(Tone, out) {
      const g = new Tone.Gain(0).connect(out);
      const f = new Tone.Filter(300, 'bandpass').connect(g);
      f.Q.value = 3;
      const n = new Tone.Noise('pink').connect(f).start();
      const u = T(Tone);
      return {
        tick: (s, t) => {
          if (s === 48) {
            const dur = u.s16 * 15;
            g.gain.cancelScheduledValues(t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.35, t + dur);
            g.gain.setValueAtTime(0, t + dur + u.s16 * 0.9);
            f.frequency.cancelScheduledValues(t);
            f.frequency.setValueAtTime(300, t);
            f.frequency.exponentialRampToValueAtTime(9000, t + dur);
            return true;
          }
          return s > 48 && s % 4 === 0;
        },
        stop: (t) => {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(0, t);
        },
        dispose: disposer(n, f, g)
      };
    }
  },
  {
    id: 'fx-vinil', name: 'Arranhão de Vinil', group: 'fx', outfit: 'visor',
    make(Tone, out) {
      const bp = new Tone.Filter(1200, 'bandpass', -12).connect(out);
      bp.Q.value = 4;
      const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.12, sustain: 0 }, volume: 4 }).connect(bp);
      return {
        tick: (s, t) => {
          if (![28, 30, 60, 61, 62].includes(s)) return false;
          bp.frequency.setValueAtTime(700, t);
          bp.frequency.exponentialRampToValueAtTime(3800, t + 0.05);
          bp.frequency.exponentialRampToValueAtTime(600, t + 0.11);
          n.triggerAttackRelease(0.11, t);
          return true;
        },
        dispose: disposer(bp, n)
      };
    }
  },
  {
    id: 'fx-brilho', name: 'Brilho Mágico', group: 'fx', outfit: 'aureola',
    make(Tone, out) {
      const d = new Tone.FeedbackDelay('16n', 0.4).connect(out);
      const b = new Tone.FMSynth({ harmonicity: 5, modulationIndex: 4, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 }, volume: -16 }).connect(d);
      const notes = ['E6', 'A6', 'C7', 'E7'];
      const u = T(Tone);
      return {
        tick: (s, t) => {
          if (![3, 35].includes(s)) return false;
          notes.forEach((n, i) => b.triggerAttackRelease(n, '32n', t + i * u.s16 * 0.5));
          return true;
        },
        dispose: disposer(d, b)
      };
    }
  }
];

export const SOUND_BY_ID = Object.fromEntries(SOUNDS.map((s) => [s.id, s]));

// Efeito especial da lontra: varredura de filtro no master + splash + bolhas subindo.
export function otterSplash(Tone, master, filter, time) {
  const beat = Tone.Time('4n').toSeconds();
  filter.frequency.cancelScheduledValues(time);
  filter.frequency.setValueAtTime(18000, time);
  filter.frequency.exponentialRampToValueAtTime(320, time + beat * 2);
  filter.frequency.exponentialRampToValueAtTime(18000, time + beat * 4);
  const hp = new Tone.Filter(900, 'highpass').connect(master);
  const splash = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.002, decay: 0.45, sustain: 0 }, volume: -4 }).connect(hp);
  splash.triggerAttackRelease(0.45, time);
  const bubbles = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 }, volume: -10 }).connect(master);
  ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7', 'E7'].forEach((n, i) => {
    const t = time + beat * 0.5 + i * beat * 0.25;
    bubbles.triggerAttackRelease(n, '32n', t);
    bubbles.frequency.setValueAtTime(Tone.Frequency(n).toFrequency() * 0.6, t);
    bubbles.frequency.exponentialRampToValueAtTime(Tone.Frequency(n).toFrequency(), t + 0.04);
  });
  setTimeout(() => [hp, splash, bubbles].forEach((n) => n.dispose()), (beat * 5 + 1) * 1000);
}

/* ---------- Eventos (nota, tempo, instrumento) para o Studio ---------- */
const SOUND_INST = { 'pad-neon': 'pad', stab: 'chip', arpejo: 'keys', orgao: 'keys', 'coral-miau': 'meow', 'melodia-flauta': 'theremin', 'melodia-8bit': 'chip', 'melodia-miau': 'meow', 'melodia-sinos': 'bells' };
const DRUM_FOR = {
  bumbo: () => 36,
  caixa: (kind) => (kind === 'NoiseSynth' ? 38 : null),
  chimbal: (_k, d) => (d > 0.1 ? 46 : 42),
  palmas: () => 39,
  tamborim: () => 76,
  beatbox: (kind) => (kind === 'MembraneSynth' ? 36 : 38)
};

export function soundInstrument(id) {
  const s = SOUND_BY_ID[id];
  if (s.group === 'drums' || s.group === 'bass' || s.group === 'fx') return s.group;
  return SOUND_INST[id] || 'keys';
}

// Cria a camada com os sintetizadores "grampeados": cada nota disparada vira um evento no log.
export function makeCaptured(Tone, id, out, log) {
  const s = SOUND_BY_ID[id];
  const inst = soundInstrument(id);
  let lastDrum = -1;
  const emit = (kind, a) => {
    const noise = kind === 'NoiseSynth';
    const [note, dur, time, vel] = noise ? [null, a[0], a[1], a[2]] : a;
    const t = time ?? Tone.now();
    const d = Tone.Time(dur).toSeconds();
    const base = { inst, track: id, trackName: s.name, time: t, dur: d, vel: vel ?? 0.8 };
    if (inst === 'drums') {
      const n = DRUM_FOR[id](kind, d);
      if (n === null || Math.abs(t - lastDrum) < 0.03) return;
      lastDrum = t;
      log.note({ ...base, note: n });
      return;
    }
    (Array.isArray(note) ? note : [note]).forEach((x) => {
      const m = noise ? 72 : Math.round(Tone.Frequency(x).toMidi());
      log.note({ ...base, note: Math.max(24, Math.min(108, m)) });
    });
  };
  return s.make(tapTone(Tone, emit), out);
}

// Converte um beat salvo (gatos + BPM) em eventos tocando os 4 compassos "em silêncio".
export function beatToEvents(Tone, beat) {
  const log = createEventLog({ source: 'beatcats', bpm: beat.bpm, scale: 'minor', root: 9, rawTimes: true });
  const prevBpm = Tone.Transport.bpm.value;
  Tone.Transport.bpm.value = beat.bpm;
  const mute = new Tone.Gain(0);
  const s16 = 60 / beat.bpm / 4;
  const t0 = Tone.now() + 0.2;
  const voices = beat.cats.filter((id) => id && SOUND_BY_ID[id]).map((id) => makeCaptured(Tone, id, mute, log));
  for (let s = 0; s < LOOP_STEPS; s++) voices.forEach((v) => v.tick(s, t0 + s * s16));
  log.startTake(t0);
  const json = log.stopTake(t0 + LOOP_STEPS * s16 - 0.001);
  json.length = LOOP_STEPS / 4;
  json.events.forEach((e) => (e.time = Math.round(e.time * 4) / 4));
  voices.forEach((v) => v.dispose());
  mute.dispose();
  Tone.Transport.bpm.value = prevBpm;
  return json;
}
