// Trilhas procedurais offline (Web Audio via Tone.js local). Sem CDN.
// Cada bed tem ≥ ~2 min de material antes de repetir; o Hub fica calmo e suave.
import { kv } from './store.js';
import { el, startAudio } from './ui.js';
import { t } from './i18n.js';

const KEY = 'ui-volume';
const BEDS = {
  hub: 'hub',
  termo: 'soft',
  conexoes: 'soft2',
  cattyping: 'space',
  tetris: 'tetris',
  corrida: 'race'
};

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

let master = 62;
let muted = false;
let unlocked = false;
let route = 'hub';
let Tone = null;
let bedGain = null;
let analyser = null;
let rmsBuf = null;
let nodes = [];
let timers = [];
let currentBed = '';
let clock = { bed: '', step: 0, gen: 0 };
const listeners = new Set();

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export function getVolumeState() {
  return { master, muted, unlocked, route, bed: currentBed, step: clock.step };
}

function bedLevel() {
  if (muted || master <= 0) return 0;
  return Math.max(0, Math.min(1, master / 100));
}

function applyGain() {
  if (bedGain) {
    try {
      bedGain.gain.rampTo(bedLevel() * 0.55, 0.08);
    } catch {
      bedGain.gain.value = bedLevel() * 0.55;
    }
  }
  listeners.forEach((fn) => fn(getVolumeState()));
}

function persist() {
  const payload = { master, muted };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
  kv.set(KEY, payload).catch(() => {});
}

export async function loadVolume() {
  let saved = null;
  try {
    saved = await kv.get(KEY);
  } catch {}
  if (!saved) {
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {}
  }
  if (saved && typeof saved === 'object') {
    if (Number.isFinite(Number(saved.master))) master = clamp(saved.master);
    muted = Boolean(saved.muted);
  }
}

export function setMasterVolume(n) {
  master = clamp(n);
  if (master > 0) muted = false;
  persist();
  applyGain();
}

export function nudgeMaster(delta) {
  setMasterVolume(master + delta);
}

export function toggleMute() {
  muted = !muted;
  if (!muted && master <= 0) master = 62;
  persist();
  applyGain();
}

export function onVolume(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function parseNote(tok) {
  if (tok == null || tok === '.' || tok === '_' || tok === '-') return null;
  if (typeof tok === 'number') return tok;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(tok));
  if (!m) return null;
  let pc = PC[m[1]];
  if (m[2] === '#') pc += 1;
  if (m[2] === 'b') pc -= 1;
  return (Number(m[3]) + 1) * 12 + pc;
}

function hz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function notes(str) {
  return str
    .trim()
    .split(/\s+/)
    .map((t) => parseNote(t));
}

function joinPhrases(lines) {
  return lines.flatMap((line) => notes(line));
}

function periodOf(seq) {
  const n = seq.length;
  outer: for (let p = 1; p <= Math.floor(n / 2); p++) {
    if (n % p) continue;
    for (let i = p; i < n; i++) {
      if (seq[i] !== seq[i % p]) continue outer;
    }
    return p;
  }
  return n;
}

function fmt(sec) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function chordMidi(arr) {
  return arr.map((n) => parseNote(n));
}

const HUB_MELODY = joinPhrases([
  'G4 . . B4 . D4 . . G4 . A4 . B4 . . D5 . B4 . A4 G4 . D4 . E4 . G4 . . D4 G4 .',
  'E4 . G4 . B4 . . A4 G4 . E4 . D4 . . . B3 . E4 . G4 . B4 A4 G4 . . D4 E4 . G4 .',
  'C4 . E4 . G4 . . C5 B4 . G4 . E4 . . . D4 . E4 G4 A4 . G4 . E4 . C4 . D4 . E4 .',
  'D4 . A4 . D5 . . A4 G4 . F#4 . E4 . D4 . A4 . . F#4 G4 . A4 . B4 . D5 . A4 . D4 .',
  'B3 . D4 . F#4 . . D4 E4 . F#4 . G4 . F#4 . D4 . B3 . A3 . B3 . D4 . E4 . F#4 . D4 .',
  'A3 . C4 . E4 . . G4 E4 . D4 . C4 . A3 . C4 . E4 . G4 . A4 G4 E4 . C4 . D4 . E4 .',
  'C4 . G4 . D5 . . C5 G4 . E4 . D4 . . . E4 . G4 A4 G4 . E4 . D4 . C4 . G4 . C5 .',
  'D4 . F#4 . A4 . C5 A4 G4 . F#4 . E4 . D4 . G4 . B4 . D5 . B4 A4 G4 . D4 . G4 . . .'
]);

const SOFT_MELODY = joinPhrases([
  'F4 . . A4 . C4 . . F4 . G4 . A4 . . C5 . A4 . G4 F4 . C4 . D4 . F4 . . C4 F4 .',
  'D4 . F4 . A4 . . G4 F4 . D4 . C4 . . . A3 . D4 . F4 . A4 G4 F4 . . C4 D4 . F4 .',
  'Bb3 . D4 . F4 . . Bb4 A4 . F4 . D4 . . . C4 . D4 F4 G4 . F4 . D4 . Bb3 . C4 . D4 .',
  'C4 . G4 . C5 . . G4 F4 . E4 . D4 . C4 . G4 . . E4 F4 . G4 . A4 . C5 . G4 . C4 .',
  'G3 . Bb3 . D4 . . Bb3 C4 . D4 . F4 . D4 . Bb3 . G3 . F3 . G3 . Bb3 . C4 . D4 . Bb3 .',
  'A3 . C4 . E4 . . G4 E4 . D4 . C4 . A3 . C4 . E4 . G4 . A4 G4 E4 . C4 . D4 . E4 .',
  'Bb3 . F4 . C5 . . Bb4 F4 . D4 . C4 . . . D4 . F4 G4 F4 . D4 . C4 . Bb3 . F4 . Bb4 .',
  'C4 . E4 . G4 . Bb4 G4 F4 . E4 . D4 . C4 . F4 . A4 . C5 . A4 G4 F4 . C4 . F4 . . .'
]);

const SOFT2_MELODY = joinPhrases([
  'A3 . . C4 . E3 . . A3 . B3 . C4 . . E4 . C4 . B3 A3 . E3 . F3 . A3 . . E3 A3 .',
  'F3 . A3 . C4 . . B3 A3 . F3 . E3 . . . C3 . F3 . A3 . C4 B3 A3 . . E3 F3 . A3 .',
  'C4 . E4 . G4 . . C5 B4 . G4 . E4 . . . D4 . E4 G4 A4 . G4 . E4 . C4 . D4 . E4 .',
  'G3 . D4 . G4 . . D4 C4 . B3 . A3 . G3 . D4 . . B3 C4 . D4 . E4 . G4 . D4 . G3 .',
  'D3 . F3 . A3 . . F3 G3 . A3 . C4 . A3 . F3 . D3 . C3 . D3 . F3 . G3 . A3 . F3 .',
  'E3 . G3 . B3 . . D4 B3 . A3 . G3 . E3 . G3 . B3 . D4 . E4 D4 B3 . G3 . A3 . B3 .',
  'F3 . C4 . G4 . . F4 C4 . A3 . G3 . . . A3 . C4 D4 C4 . A3 . G3 . F3 . C4 . F4 .',
  'E3 . G#3 . B3 . D4 B3 A3 . G#3 . F3 . E3 . A3 . C4 . E4 . C4 B3 A3 . E3 . A3 . . .'
]);

const SPACE_MELODY = joinPhrases([
  'A4 . C5 E5 . G5 E5 . C5 . A4 . C5 E5 G5 A5 G5 E5 C5 A4 E4 . . .',
  'E5 . G5 A5 . C6 A5 . G5 . E5 . A5 G5 E5 C5 D5 E5 G5 E5 C5 . . .',
  'C5 . E5 G5 . A5 G5 . E5 . C5 . G4 A4 C5 E5 D5 C5 A4 G4 E4 . . .',
  'G5 . E5 C5 . A4 C5 . E5 . G5 . A5 G5 E5 C6 A5 G5 E5 C5 A4 . . .',
  'A3 . E4 A4 . C5 A4 . E4 . A3 . C4 E4 G4 A4 G4 E4 C4 A3 E3 . . .',
  'D5 . E5 G5 . A5 E5 . C5 . D5 . E5 G5 A5 C6 A5 G5 E5 D5 C5 . . .',
  'E4 . G4 B4 . E5 B4 . G4 . E4 . G4 B4 E5 G5 E5 B4 G4 E4 B3 . . .',
  'A5 . G5 E5 . C5 E5 . G5 . A4 . C5 E5 G5 E5 C5 A4 E4 C4 A3 . . .',
  'C6 . A5 G5 . E5 G5 . A5 . C5 . E5 G5 A5 G5 E5 C5 A4 G4 E4 . . .',
  'G4 . A4 C5 . E5 C5 . A4 . G4 . A4 C5 D5 E5 D5 C5 A4 G4 E4 . . .',
  'A4 . E5 A5 . C6 A5 . E5 . A4 . E5 G5 A5 G5 E5 C5 A4 E4 A3 . . .'
]);

const TETRIS_LEAD = joinPhrases([
  'E5 G5 A5 G5 E5 D5 C5 E5 G5 A5 C6 A5 G5 E5 D5 . C5 E5 G5 E5 F5 A5 G5 E5 D5 E5 C5 G4 A4 C5 E5 . E5 G5 A5 B5 A5 G5 E5 D5 C5 E5 G5 A5 G5 E5 D5 C5 G5 . E5 . D5 . C5 . A4 C5 E5 G5 E5 D5 C5 .',
  'A5 C6 E6 C6 B5 A5 G5 E5 A5 G5 E5 D5 C5 E5 G5 . F5 A5 C6 A5 G5 F5 E5 D5 E5 G5 A5 G5 E5 D5 C5 . A5 . C6 . E6 D6 C6 A5 G5 A5 C6 A5 E5 G5 A5 . D5 E5 F5 E5 D5 C5 B4 A4 G4 A4 C5 D5 E5 D5 C5 .',
  'G5 B5 D6 B5 A5 G5 F5 D5 G5 A5 B5 D6 B5 A5 G5 . E5 G5 B5 G5 A5 C6 B5 G5 F5 G5 A5 G5 D5 E5 G5 . D6 . B5 . A5 . G5 . E5 G5 A5 B5 A5 G5 E5 D5 C5 D5 E5 G5 E5 D5 C5 A4 G4 C5 E5 G5 C6 G5 E5 C5',
  'C5 . E5 . G5 . E5 . F5 . A5 . G5 . E5 . D5 . F5 . A5 . F5 . E5 . G5 . C6 . G5 . A4 C5 E5 . C5 E5 G5 . D5 F5 A5 . E5 G5 C6 . G5 F5 E5 D5 C5 D5 E5 G5 D5 E5 C5 G4 A4 C5 E5 .',
  'E5 . G5 A5 G5 E5 D5 C5 E5 . G5 A5 C6 A5 G5 E5 D5 C5 E5 G5 F5 A5 G5 E5 D5 . E5 C5 G4 A4 C5 E5 G5 A5 B5 A5 G5 E5 C5 D5 E5 G5 A5 G5 E5 D5 C5 . C6 A5 G5 E5 D5 E5 G5 E5 C5 D5 E5 C5 G4 . C5 .',
  'E5 G5 A5 C6 A5 G5 E5 G5 A5 C6 D6 C6 A5 G5 E5 . G5 A5 C6 E6 D6 C6 A5 G5 A5 C6 D6 E6 D6 C6 A5 G5 F5 A5 C6 D6 C6 A5 F5 G5 E5 G5 B5 D6 B5 G5 E5 D5 C5 E5 G5 C6 G5 E5 C5 D5 E5 G5 A5 G5 D5 C5 . .',
  'C5 E5 G5 E5 A5 G5 E5 D5 C5 E5 G5 A5 G5 E5 D5 C5 F5 A5 C6 A5 G5 F5 E5 D5 E5 G5 C6 G5 E5 D5 C5 . G5 . E5 . D5 E5 C5 . A4 C5 E5 G5 C6 G5 E5 C5 E5 D5 C5 G4 A4 C5 D5 E5 C5 . G4 . C5 . . .'
]);

const TETRIS_BARS = [
  48, 48, 45, 45, 41, 41, 43, 43, 45, 45, 41, 41, 48, 48, 43, 43, 43, 43, 40, 40, 48, 48, 50, 50, 41, 41, 48, 48, 43, 43, 48, 48, 48, 48, 41, 41, 43, 43, 48, 48, 45, 41, 48, 43, 45, 41, 43, 48, 48, 45, 41, 43, 48, 43, 48, 48
];

const RACE_RIFFS = [
  notes('E3 G3 B3 G3 E3 D3 B2 D3'),
  notes('E3 A3 B3 A3 G3 E3 D3 E3'),
  notes('G3 B3 D4 B3 A3 G3 E3 G3'),
  notes('A3 C4 E4 C4 B3 A3 G3 A3'),
  notes('B3 D4 F#4 D4 B3 A3 G3 F#3'),
  notes('E3 G3 A3 B3 A3 G3 E3 D3'),
  notes('D3 F#3 A3 F#3 G3 A3 B3 D4'),
  notes('G3 D4 B3 G3 E3 G3 A3 B3'),
  notes('A3 E4 C4 A3 G3 E3 D3 E3'),
  notes('B3 G3 E3 B3 A3 F#3 D3 E3'),
  notes('E4 B3 G3 E3 D4 A3 F#3 D3'),
  notes('G3 A3 B3 D4 B3 A3 G3 E3'),
  notes('A3 B3 C4 E4 D4 C4 B3 A3'),
  notes('E3 D3 E3 G3 B3 G3 E3 B2'),
  notes('D4 B3 A3 G3 F#3 G3 A3 B3'),
  notes('E3 G3 B3 E4 B3 G3 D3 E3')
];

function developRace(riff, bar) {
  if (bar === 0) return riff;
  if (bar === 1) return riff.map((n, i) => (i === 3 || i === 7 ? null : n));
  if (bar === 2) return riff.map((n, i) => (i % 2 ? null : n == null ? null : n + 12));
  return riff.map((n, i) => (i >= 6 ? (n == null ? null : n + 2) : n));
}

function raceMelody() {
  const out = [];
  RACE_RIFFS.forEach((riff) => {
    for (let bar = 0; bar < 4; bar++) out.push(...developRace(riff, bar));
  });
  return out;
}

const SPECS = {
  hub: {
    id: 'hub',
    bpm: 56,
    div: 2,
    lp: 900,
    lfoHz: 0.05,
    lfoDepth: 70,
    padGain: [0.04, 0.028, 0.016, 0.01],
    padType: ['sine', 'sine', 'sine', 'triangle'],
    chords: [
      ['G2', 'G3', 'B3', 'D4'],
      ['E2', 'E3', 'G3', 'B3'],
      ['C2', 'C3', 'E3', 'G3'],
      ['D2', 'A3', 'D4', 'E4'],
      ['B1', 'D3', 'F#3', 'A3'],
      ['A1', 'C3', 'E3', 'G3'],
      ['C2', 'E3', 'G3', 'D4'],
      ['D2', 'F#3', 'A3', 'C4']
    ].map(chordMidi),
    stepsPerChord: 32,
    melody: HUB_MELODY,
    melodyType: 'sine',
    melodyGain: 0.032,
    melodyDur: 1.35,
    bassGain: 0.028,
    bassEvery: 8,
    sparkle: true,
    kind: 'pad'
  },
  soft: {
    id: 'soft',
    bpm: 60,
    div: 2,
    lp: 1280,
    lfoHz: 0.04,
    lfoDepth: 90,
    padGain: [0.034, 0.024, 0.014, 0.009],
    padType: ['triangle', 'sine', 'sine', 'sine'],
    chords: [
      ['F2', 'F3', 'A3', 'C4'],
      ['D2', 'D3', 'F3', 'A3'],
      ['Bb1', 'D3', 'F3', 'A3'],
      ['C2', 'G3', 'C4', 'D4'],
      ['G1', 'Bb2', 'D3', 'F3'],
      ['A1', 'C3', 'E3', 'G3'],
      ['Bb1', 'D3', 'F3', 'C4'],
      ['C2', 'E3', 'G3', 'Bb3']
    ].map(chordMidi),
    stepsPerChord: 32,
    melody: SOFT_MELODY,
    melodyType: 'sine',
    melodyGain: 0.03,
    melodyDur: 1.2,
    bassGain: 0.024,
    bassEvery: 8,
    sparkle: true,
    kind: 'pad'
  },
  soft2: {
    id: 'soft2',
    bpm: 58,
    div: 2,
    lp: 1180,
    lfoHz: 0.045,
    lfoDepth: 85,
    padGain: [0.033, 0.022, 0.014, 0.009],
    padType: ['sine', 'triangle', 'sine', 'sine'],
    chords: [
      ['A1', 'A2', 'C3', 'E3'],
      ['F1', 'F2', 'A2', 'C3'],
      ['C2', 'C3', 'E3', 'G3'],
      ['G1', 'G2', 'B2', 'D3'],
      ['D2', 'D3', 'F3', 'A3'],
      ['E2', 'E3', 'G3', 'B3'],
      ['F1', 'A2', 'C3', 'G3'],
      ['E1', 'G#2', 'B2', 'D3']
    ].map(chordMidi),
    stepsPerChord: 32,
    melody: SOFT2_MELODY,
    melodyType: 'sine',
    melodyGain: 0.028,
    melodyDur: 1.25,
    bassGain: 0.022,
    bassEvery: 8,
    sparkle: true,
    kind: 'pad'
  },
  space: {
    id: 'space',
    bpm: 120,
    div: 1,
    melody: SPACE_MELODY,
    melodyType: 'sawtooth',
    melodyGain: 0.042,
    melodyDur: 0.9,
    kind: 'space'
  },
  tetris: {
    id: 'tetris',
    bpm: 104,
    div: 2,
    lp: 2100,
    melody: TETRIS_LEAD,
    melodyType: 'square',
    melodyGain: 0.038,
    melodyDur: 0.22,
    bassGain: 0.044,
    bars: TETRIS_BARS,
    kind: 'chiptune'
  },
  race: {
    id: 'race',
    bpm: 116,
    div: 2,
    lp: 1750,
    melody: raceMelody(),
    melodyType: 'square',
    melodyGain: 0.036,
    melodyDur: 0.18,
    bassGain: 0.03,
    kind: 'race'
  }
};

Object.values(SPECS).forEach((s) => {
  s.steps = s.melody.length;
  s.seconds = (s.steps * 60) / (s.bpm * s.div);
  s.period = periodOf(s.melody);
  s.periodSeconds = (s.period * 60) / (s.bpm * s.div);
});

export function bedSeconds(id) {
  const s = SPECS[id] || SPECS[BEDS[id]];
  return s ? s.seconds : 0;
}

export function listBeds() {
  return Object.values(SPECS).map((s) => ({
    id: s.id,
    routes: Object.entries(BEDS)
      .filter(([, b]) => b === s.id)
      .map(([r]) => r),
    bpm: s.bpm,
    steps: s.steps,
    seconds: Math.round(s.seconds * 10) / 10,
    periodSeconds: Math.round(s.periodSeconds * 10) / 10,
    label: fmt(s.seconds)
  }));
}

function stopBed() {
  clock.gen += 1;
  timers.forEach((id) => clearTimeout(id));
  timers = [];
  nodes.forEach((n) => {
    try {
      if (n.stop) n.stop();
    } catch {}
    try {
      if (n.dispose) n.dispose();
    } catch {}
    try {
      n.disconnect();
    } catch {}
  });
  nodes = [];
  currentBed = '';
  clock.bed = '';
  clock.step = 0;
}

function pluck(ctx, dest, { type, midi, when, dur, gain }) {
  if (midi == null || !Number.isFinite(midi)) return;
  const o = ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.value = hz(midi);
  const g = ctx.createGain();
  const t0 = Math.max(when, ctx.currentTime + 0.002);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + Math.min(0.04, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function startPad(ctx, dest, spec) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = spec.lp || 1200;
  filter.Q.value = 0.7;
  filter.connect(dest);
  nodes.push(filter);
  if (spec.lfoHz) {
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = spec.lfoHz;
    const ld = ctx.createGain();
    ld.gain.value = spec.lfoDepth || 60;
    lfo.connect(ld);
    ld.connect(filter.frequency);
    lfo.start();
    nodes.push(lfo, ld);
  }
  const voices = (spec.padGain || []).map((gain, i) => {
    const o = ctx.createOscillator();
    o.type = (spec.padType && spec.padType[i]) || 'sine';
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g);
    g.connect(filter);
    o.frequency.value = hz(spec.chords[0][i] || 48);
    o.start();
    nodes.push(o, g);
    return o;
  });
  return {
    filter,
    setChord(chord, when) {
      chord.forEach((midi, i) => {
        if (!voices[i] || midi == null) return;
        try {
          voices[i].frequency.setTargetAtTime(hz(midi), when, 0.18);
        } catch {
          voices[i].frequency.value = hz(midi);
        }
      });
    }
  };
}

function startSpaceFx(ctx, dest) {
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 220;
  const delay = ctx.createDelay(1.2);
  delay.delayTime.value = 0.46;
  const fb = ctx.createGain();
  fb.gain.value = 0.36;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  hp.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(lp);
  lp.connect(dest);
  hp.connect(dest);
  nodes.push(hp, delay, fb, lp);
  return hp;
}

function onStep(spec, i, when, ctx, dest, pad) {
  const melody = spec.melody[i];
  if (spec.kind === 'pad') {
    const chord = spec.chords[Math.floor(i / spec.stepsPerChord) % spec.chords.length];
    pad.setChord(chord, when);
    if (i % spec.bassEvery === 0) {
      pluck(ctx, pad.filter, { type: 'triangle', midi: chord[0], when, dur: 1.6, gain: spec.bassGain });
    }
    if (melody != null) {
      pluck(ctx, pad.filter, {
        type: spec.melodyType,
        midi: melody,
        when,
        dur: spec.melodyDur,
        gain: spec.melodyGain
      });
    }
    if (spec.sparkle && i % 32 === 24) {
      pluck(ctx, pad.filter, { type: 'sine', midi: (chord[2] || 62) + 24, when, dur: 1.8, gain: 0.012 });
    }
    return;
  }
  if (spec.kind === 'space') {
    if (melody != null) {
      pluck(ctx, dest, { type: spec.melodyType, midi: melody, when, dur: spec.melodyDur, gain: spec.melodyGain });
    }
    return;
  }
  if (spec.kind === 'chiptune') {
    const bar = Math.floor(i / 8) % spec.bars.length;
    const beat = i % 8;
    if (beat % 2 === 0) {
      const root = spec.bars[bar];
      const midi = beat === 4 ? root + 7 : root;
      pluck(ctx, dest, { type: 'triangle', midi, when, dur: 0.28, gain: spec.bassGain });
    }
    if (melody != null) {
      pluck(ctx, dest, { type: spec.melodyType, midi: melody, when, dur: spec.melodyDur, gain: spec.melodyGain });
    }
    if (i % 32 === 16) {
      pluck(ctx, dest, { type: 'triangle', midi: 76, when, dur: 0.12, gain: 0.018 });
    }
    return;
  }
  if (spec.kind === 'race') {
    const section = Math.floor(i / 32) % 16;
    if (i % 8 === 0) {
      pluck(ctx, dest, { type: 'triangle', midi: 28 + (section % 4) * 2, when, dur: 0.55, gain: spec.bassGain });
    }
    if (melody != null) {
      pluck(ctx, dest, { type: spec.melodyType, midi: melody, when, dur: spec.melodyDur, gain: spec.melodyGain });
    }
    return;
  }
}

function startSpec(ctx, dest, spec) {
  const gen = clock.gen;
  const stepDur = 60 / spec.bpm / spec.div;
  let step = 0;
  let next = ctx.currentTime + 0.05;
  let pad = null;
  let voiceDest = dest;
  if (spec.kind === 'pad') pad = startPad(ctx, dest, spec);
  else if (spec.kind === 'space') voiceDest = startSpaceFx(ctx, dest);
  else {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = spec.lp || 2000;
    lp.connect(dest);
    nodes.push(lp);
    voiceDest = lp;
  }
  const look = () => {
    if (clock.gen !== gen || currentBed !== spec.id) return;
    const horizon = ctx.currentTime + 0.16;
    while (next < horizon) {
      const i = step % spec.steps;
      onStep(spec, i, next, ctx, voiceDest, pad);
      clock.step = i;
      step += 1;
      next += stepDur;
    }
    timers.push(setTimeout(look, 40));
  };
  look();
}

function makeBed(id) {
  stopBed();
  if (!Tone || !bedGain) return;
  const spec = SPECS[id];
  if (!spec) return;
  const ctx = Tone.getContext().rawContext;
  const dest = bedGain.input || bedGain;
  const gate = ctx.createGain();
  gate.gain.value = 1;
  gate.connect(dest);
  nodes.push(gate);
  currentBed = id;
  clock.bed = id;
  clock.step = 0;
  startSpec(ctx, gate, spec);
}

function tapAnalyser() {
  if (analyser || !bedGain || !Tone) return;
  try {
    const ctx = Tone.getContext().rawContext;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    rmsBuf = new Uint8Array(analyser.fftSize);
    bedGain.connect(analyser);
  } catch {}
}

export function bedRms() {
  if (!analyser || !rmsBuf) return 0;
  analyser.getByteTimeDomainData(rmsBuf);
  let s = 0;
  for (const v of rmsBuf) {
    const x = (v - 128) / 128;
    s += x * x;
  }
  return Math.sqrt(s / rmsBuf.length);
}

async function ensure() {
  Tone = await startAudio();
  if (!bedGain) bedGain = new Tone.Gain(bedLevel() * 0.55).toDestination();
  tapAnalyser();
  unlocked = true;
  applyGain();
}

export async function setBgmRoute(name) {
  route = name || 'hub';
  const bed = BEDS[route];
  if (!unlocked) return;
  try {
    await ensure();
  } catch (err) {
    console.warn(err);
    return;
  }
  if (!bed) {
    stopBed();
    return;
  }
  if (currentBed === bed) return;
  makeBed(bed);
}

export function armBgmOnGesture() {
  const unlock = async () => {
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    try {
      await ensure();
      await setBgmRoute(route);
    } catch (err) {
      console.warn(err);
    }
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
}

export function createVolumeControl() {
  const wrap = el('div', { class: 'hub-vol', role: 'group' });
  const muteBtn = el('button', { class: 'btn btn--ghost btn--sm hub-vol__mute', type: 'button' });
  const down = el('button', { class: 'btn btn--ghost btn--sm hub-vol__nudge', type: 'button' }, '−');
  const up = el('button', { class: 'btn btn--ghost btn--sm hub-vol__nudge', type: 'button' }, '+');
  const slider = el('input', {
    class: 'hub-vol__fader',
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: String(master)
  });
  wrap.append(muteBtn, down, slider, up);
  const paint = () => {
    wrap.setAttribute('aria-label', t('vol.label'));
    muteBtn.textContent = muted ? t('vol.muted') : t('vol.mute');
    muteBtn.setAttribute('aria-pressed', String(muted || master <= 0));
    down.setAttribute('aria-label', t('vol.down'));
    up.setAttribute('aria-label', t('vol.up'));
    slider.value = String(master);
    slider.title = `${master}%`;
    wrap.classList.toggle('is-muted', muted || master <= 0);
  };
  muteBtn.addEventListener('click', () => toggleMute());
  down.addEventListener('click', () => nudgeMaster(-10));
  up.addEventListener('click', () => nudgeMaster(10));
  slider.addEventListener('input', () => setMasterVolume(slider.value));
  paint();
  onVolume(paint);
  return wrap;
}

export function getBgmClock() {
  const spec = SPECS[currentBed];
  return {
    bed: currentBed,
    step: clock.step,
    unlocked,
    route,
    seconds: spec ? spec.seconds : 0,
    periodSeconds: spec ? spec.periodSeconds : 0
  };
}

if (typeof window !== 'undefined') {
  window.__mmpBgm = { getVolumeState, listBeds, bedSeconds, toggleMute, setMasterVolume, getBgmClock, bedRms };
}
