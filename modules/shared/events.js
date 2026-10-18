// Camada compartilhada de eventos: tudo que é tocado nos módulos vira JSON (nota, tempo, instrumento).
//
// Formato (kind "mmp-events", version 1). Tempos e durações em batidas (semínimas) no BPM do arquivo:
// { version, kind, source, bpm, scale, root, length, tracks: [{ id, name, inst }],
//   events: [{ time, dur, note, vel, inst, track }] }
// note é MIDI (0–127); na bateria segue o mapa General MIDI (36 bumbo, 38 caixa, 42 chimbal…).
import { INSTRUMENT_BY_ID } from './instruments.js';

export const EVENTS_KIND = 'mmp-events';
const MAX_EVENTS = 6000;
const round = (x) => Math.round(x * 1000) / 1000;
const perfNow = () => performance.now() / 1000;

// Relógio único do log: performance.now() em segundos. Tempos agendados no AudioContext (Tone) são convertidos;
// notas sem tempo soam em Tone.now() (agora + lookAhead), então ganham o mesmo atraso.
function clockFor(time) {
  const T = window.Tone;
  const ctx = T && T.context;
  const look = ctx ? ctx.lookAhead || 0 : 0;
  if (time === undefined || time === null) return perfNow() + look;
  if (ctx && ctx.state === 'running') return perfNow() + (time - ctx.currentTime);
  return perfNow() + look;
}

// rawTimes: usa os tempos recebidos sem conversão (renderizações "silenciosas" com tempos já calculados).
export function createEventLog({ source, bpm = 100, scale = 'major', root = 0, rawTimes = false } = {}) {
  const clock = rawTimes ? (t) => t ?? 0 : clockFor;
  const all = [];
  const held = new Map();
  const meta = { bpm, scale, root };
  let take = null;
  const listeners = new Set();

  function push(ev) {
    all.push(ev);
    if (all.length > MAX_EVENTS) all.splice(0, all.length - MAX_EVENTS);
    listeners.forEach((fn) => fn(ev));
    return ev;
  }

  function toJson(list, from, to) {
    const k = meta.bpm / 60;
    const tracks = new Map();
    const events = list
      .filter((e) => e.sec >= from - 0.001 && (to === undefined || e.sec <= to))
      .map((e) => {
        if (!tracks.has(e.track)) tracks.set(e.track, { id: e.track, name: e.trackName || (INSTRUMENT_BY_ID[e.inst] || {}).name || e.inst, inst: e.inst });
        const dur = e.dur ?? (to ?? clock()) - e.sec;
        return { time: round(Math.max(0, (e.sec - from) * k)), dur: round(Math.max(0.05, dur * k)), note: Math.round(e.note), vel: round(e.vel), inst: e.inst, track: e.track };
      })
      .sort((a, b) => a.time - b.time || a.note - b.note);
    const end = events.reduce((m, e) => Math.max(m, e.time + e.dur), 0);
    return {
      version: 1,
      kind: EVENTS_KIND,
      source,
      createdAt: new Date().toISOString(),
      bpm: meta.bpm,
      scale: meta.scale,
      root: meta.root,
      length: Math.max(4, Math.ceil(end / 4) * 4),
      tracks: [...tracks.values()],
      events
    };
  }

  return {
    source,
    set(next) {
      Object.assign(meta, next);
    },
    // Nota curta ou com duração conhecida. time = tempo do AudioContext (Tone.now()).
    note({ note, inst, track = inst, trackName, time, dur = 0.25, vel = 0.8 }) {
      if (!Number.isFinite(note) || !inst) return null;
      return push({ sec: clock(time), dur, note, vel, inst, track, trackName });
    },
    // Nota sustentada (theremin): noteOn abre, noteOff fecha.
    noteOn(key, { note, inst, track = inst, trackName, time, vel = 0.8 }) {
      this.noteOff(key, time);
      held.set(key, push({ sec: clock(time), dur: null, note, vel, inst, track, trackName }));
    },
    noteOff(key, time) {
      const ev = held.get(key);
      if (!ev) return;
      ev.dur = Math.max(0.03, clock(time) - ev.sec);
      held.delete(key);
    },
    startTake(time) {
      take = { from: clock(time), aligned: false };
    },
    // Encaixa o início da gravação na grade do módulo (ex.: primeira semicolcheia depois de Gravar).
    align(time) {
      if (take && !take.aligned) {
        take.aligned = true;
        const t = clock(time);
        if (!all.some((e) => e.sec >= take.from && e.sec < t)) take.from = t;
      }
    },
    get recording() {
      return Boolean(take);
    },
    stopTake(time) {
      if (!take) return null;
      const to = clock(time);
      held.forEach((_, key) => this.noteOff(key, to));
      const json = toJson(all, take.from, to);
      take = null;
      return json;
    },
    // Tudo o que foi tocado desde que o módulo abriu (começando no primeiro evento).
    recent() {
      if (!all.length) return null;
      return toJson(all, all[0].sec);
    },
    get count() {
      return all.length;
    },
    onEvent(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    clear() {
      all.length = 0;
      held.clear();
      take = null;
    }
  };
}

export function eventsSummary(json) {
  return { notes: json ? json.events.length : 0, tracks: json ? json.tracks.length : 0 };
}

// Valida/normaliza um JSON de eventos vindo da Galeria ou de outro módulo.
export function normalizeEvents(json) {
  if (!json || json.kind !== EVENTS_KIND || !Array.isArray(json.events)) throw new Error('Arquivo sem eventos do MMP.');
  const tracks = Array.isArray(json.tracks) ? json.tracks.filter((t) => t && t.id) : [];
  const events = json.events
    .filter((e) => e && Number.isFinite(e.time) && Number.isFinite(e.note))
    .map((e) => ({ time: Math.max(0, e.time), dur: Math.max(0.05, Number(e.dur) || 0.25), note: Math.max(0, Math.min(127, Math.round(e.note))), vel: Math.max(0.05, Math.min(1, Number(e.vel) || 0.8)), inst: INSTRUMENT_BY_ID[e.inst] ? e.inst : 'keys', track: String(e.track || e.inst || 'faixa') }));
  events.forEach((e) => {
    if (!tracks.some((t) => t.id === e.track)) tracks.push({ id: e.track, name: (INSTRUMENT_BY_ID[e.inst] || {}).name || e.track, inst: e.inst });
  });
  tracks.forEach((t) => {
    if (!INSTRUMENT_BY_ID[t.inst]) t.inst = 'keys';
  });
  return {
    ...json,
    bpm: Math.max(40, Math.min(220, Number(json.bpm) || 100)),
    root: Math.max(0, Math.min(11, Number(json.root) || 0)),
    scale: json.scale || 'major',
    tracks,
    events
  };
}

/* ---------- Passagem direta para o Studio (sem salvar na Galeria) ---------- */
let pending = null;
export const handoff = {
  put(json) {
    pending = json;
  },
  take() {
    const j = pending;
    pending = null;
    return j;
  }
};
export function openInStudio(json) {
  handoff.put(json);
  location.hash = '#/studio?from=live';
}

/* ---------- Grampo no Tone: captura as notas disparadas por sintetizadores ---------- */
const TAPPED = ['Synth', 'MonoSynth', 'FMSynth', 'AMSynth', 'MembraneSynth', 'MetalSynth', 'NoiseSynth', 'PolySynth', 'PluckSynth', 'DuoSynth'];
const tapCache = new WeakMap();

// Devolve um "Tone" cujos sintetizadores avisam emit(tipo, args) a cada triggerAttackRelease.
export function tapTone(Tone, emit) {
  const classes = {};
  return new Proxy(Tone, {
    get(target, key) {
      if (!TAPPED.includes(key)) return target[key];
      if (!classes[key]) {
        const Base = target[key];
        let byEmit = tapCache.get(Base);
        if (!byEmit) tapCache.set(Base, (byEmit = new Map()));
        if (!byEmit.has(emit)) {
          byEmit.set(
            emit,
            class extends Base {
              constructor(...args) {
                super(...args);
                const orig = this.triggerAttackRelease.bind(this);
                this.triggerAttackRelease = (...a) => {
                  try {
                    emit(key, a);
                  } catch {}
                  return orig(...a);
                };
              }
            }
          );
        }
        classes[key] = byEmit.get(emit);
      }
      return classes[key];
    }
  });
}
