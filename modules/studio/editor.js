// Editores do Studio: piano roll (tempo livre, arrastar/esticar notas) e step sequencer (grade de semicolcheias).
// Os dois editam a mesma lista de eventos { time, dur, note, vel, inst, track } (tempo e duração em batidas).
import { DRUM_BY_NOTE, DRUM_KIT, INSTRUMENT_BY_ID, inScale, midiName, nearestDrum, scaleRange } from '../shared/instruments.js';
import { el } from '../shared/ui.js';

export const CELL = 22;
export const ROW = 16;
const STEP = 0.25;
const snap = (beats) => Math.round(beats / STEP) * STEP;

function rowsFor(project, track) {
  const inst = INSTRUMENT_BY_ID[track.inst];
  const mine = project.events.filter((e) => e.track === track.id);
  if (inst.drums) {
    const extra = [...new Set(mine.map((e) => e.note).filter((n) => !DRUM_BY_NOTE[n]))];
    return [...DRUM_KIT.map((d) => ({ note: d.note, label: d.name, inScale: true })), ...extra.map((n) => ({ note: n, label: `${midiName(n)} → ${DRUM_BY_NOTE[nearestDrum(n)].name}`, inScale: true }))];
  }
  let [lo, hi] = inst.range;
  mine.forEach((e) => {
    lo = Math.min(lo, e.note - 1);
    hi = Math.max(hi, e.note + 1);
  });
  return { lo, hi, inst };
}

export function createEditor({ project, track, view, onCommit, onAudition, onSelectNote }) {
  const root = el('div', { class: 'st-editor' });
  let rows = [];
  let lanes = null;
  let playhead = null;
  let selected = null;
  let lastDur = 0.5;

  function laneSize(steps) {
    return { width: steps * CELL, height: rows.length * ROW };
  }

  function buildRows() {
    const p = project();
    const t = track();
    const r = rowsFor(p, t);
    if (Array.isArray(r)) {
      rows = r;
      return;
    }
    if (view() === 'steps') {
      const set = new Set(scaleRange(p.scale, p.root, r.lo, r.hi));
      p.events.filter((e) => e.track === t.id).forEach((e) => set.add(e.note));
      rows = [...set].sort((a, b) => b - a).map((n) => ({ note: n, label: midiName(n), inScale: inScale(n, p.scale, p.root), black: midiName(n).includes('#') }));
    } else {
      rows = [];
      for (let m = r.hi; m >= r.lo; m--) rows.push({ note: m, label: midiName(m), inScale: inScale(m, p.scale, p.root), black: midiName(m).includes('#') });
    }
  }

  const rowIndex = (note) => rows.findIndex((r) => r.note === note);

  function render() {
    const p = project();
    const t = track();
    const prev = root.querySelector('.st-scroll');
    const keep = prev && prev.dataset.key === `${t && t.id}:${view()}` ? { left: prev.scrollLeft, top: prev.scrollTop } : null;
    root.innerHTML = '';
    lanes = null;
    playhead = null;
    if (!t) {
      root.append(el('div', { class: 'state state--empty st-editor__empty' }, el('h2', {}, 'Sem faixas'), el('p', {}, 'Adicione uma faixa para começar a escrever notas.')));
      return;
    }
    buildRows();
    const steps = Math.round(p.length / STEP);
    const color = INSTRUMENT_BY_ID[t.inst].color;
    const { width, height } = laneSize(steps);
    const keys = el('div', { class: 'st-keys', style: `height:${height}px` });
    rows.forEach((r) => keys.append(el('div', { class: `st-key ${r.black ? 'is-black' : ''} ${r.inScale ? 'is-scale' : ''}`, style: `height:${ROW}px` }, r.label)));
    lanes = el('div', { class: `st-lanes st-lanes--${view()}`, style: `width:${width}px;height:${height}px;--cell:${CELL}px;--row:${ROW}px;--c:${color}` });
    rows.forEach((r, i) => !r.inScale || r.black ? lanes.append(el('div', { class: `st-row ${r.inScale ? '' : 'is-out'} ${r.black ? 'is-black' : ''}`, style: `top:${i * ROW}px` })) : null);
    const head = el('div', { class: 'st-ruler', style: `width:${width}px` });
    for (let b = 0; b < p.length; b += 4) head.append(el('span', { class: 'st-ruler__bar', style: `left:${b * 4 * CELL}px` }, String(b / 4 + 1)));

    if (view() === 'steps') renderSteps(p, t, steps);
    else renderRoll(p, t);

    playhead = el('div', { class: 'st-playhead', hidden: true });
    lanes.append(playhead);
    const scroll = el('div', { class: 'st-scroll', 'data-key': `${t.id}:${view()}` }, el('div', { class: 'st-grid' }, el('div', { class: 'st-corner' }), head, keys, lanes));
    root.append(scroll);
    if (keep) {
      scroll.scrollLeft = keep.left;
      scroll.scrollTop = keep.top;
    } else if (view() === 'roll') {
      const mine = p.events.filter((e) => e.track === t.id);
      if (mine.length) {
        const top = Math.min(...mine.map((e) => rowIndex(e.note)).filter((i) => i >= 0));
        requestAnimationFrame(() => (scroll.scrollTop = Math.max(0, (top - 3) * ROW)));
      }
    }
  }

  /* ---------- Piano roll ---------- */
  function renderRoll(p, t) {
    const drums = Boolean(INSTRUMENT_BY_ID[t.inst].drums);
    p.tracks
      .filter((o) => o.id !== t.id && !o.mute && Boolean(INSTRUMENT_BY_ID[o.inst].drums) === drums)
      .forEach((o) => {
        p.events
          .filter((e) => e.track === o.id)
          .forEach((e) => {
            const i = rowIndex(e.note);
            if (i < 0) return;
            lanes.append(el('div', { class: 'st-ghost', style: `left:${e.time * 4 * CELL}px;top:${i * ROW}px;width:${Math.max(4, e.dur * 4 * CELL)}px;--g:${INSTRUMENT_BY_ID[o.inst].color}` }));
          });
      });
    p.events
      .filter((e) => e.track === t.id)
      .forEach((e) => {
        const i = rowIndex(e.note);
        if (i < 0) return;
        const n = el('div', { class: `st-note ${e === selected ? 'is-selected' : ''}`, title: `${rows[i].label} · ${e.time.toFixed(2)} · ${e.dur.toFixed(2)} batidas` });
        n._ev = e;
        place(n, e);
        lanes.append(n);
      });
    lanes.addEventListener('pointerdown', onRollDown);
    lanes.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const n = ev.target.closest('.st-note');
      if (n) removeEvent(n._ev);
    });
    lanes.addEventListener('dblclick', (ev) => {
      const n = ev.target.closest('.st-note');
      if (n) removeEvent(n._ev);
    });
  }

  function place(n, e) {
    const i = rowIndex(e.note);
    n.style.left = `${e.time * 4 * CELL}px`;
    n.style.top = `${i * ROW}px`;
    n.style.width = `${Math.max(6, e.dur * 4 * CELL - 1)}px`;
    n.style.opacity = String(0.55 + e.vel * 0.45);
  }

  function onRollDown(ev) {
    if (ev.button !== 0) return;
    const p = project();
    const t = track();
    const box = lanes.getBoundingClientRect();
    const x0 = ev.clientX - box.left;
    const y0 = ev.clientY - box.top;
    let n = ev.target.closest('.st-note');
    let mode;
    let e;
    let orig;
    if (n) {
      e = n._ev;
      const right = (e.time + e.dur) * 4 * CELL;
      mode = right - x0 < 7 ? 'resize' : 'move';
    } else {
      const ri = Math.max(0, Math.min(rows.length - 1, Math.floor(y0 / ROW)));
      const time = Math.max(0, Math.min(p.length - STEP, Math.floor(x0 / CELL) * STEP));
      e = { time, dur: lastDur, note: rows[ri].note, vel: 0.8, inst: t.inst, track: t.id };
      p.events.push(e);
      n = el('div', { class: 'st-note' });
      n._ev = e;
      place(n, e);
      lanes.append(n);
      mode = 'create';
    }
    orig = { ...e };
    select(e, n);
    onAudition(e.note, t.inst);
    ev.preventDefault();
    try {
      lanes.setPointerCapture(ev.pointerId);
    } catch {}
    let lastNote = e.note;
    const move = (m) => {
      const x = m.clientX - box.left;
      const y = m.clientY - box.top;
      if (mode === 'move') {
        e.time = Math.max(0, Math.min(p.length - STEP, snap(orig.time + (x - x0) / CELL / 4)));
        const ri = Math.max(0, Math.min(rows.length - 1, rowIndex(orig.note) + Math.round((y - y0) / ROW)));
        e.note = rows[ri].note;
      } else {
        e.dur = Math.max(STEP, snap((x - e.time * 4 * CELL) / CELL / 4 + (mode === 'create' ? 0.125 : 0)));
        if (mode === 'create' && x - x0 < CELL / 2) e.dur = orig.dur;
      }
      if (e.note !== lastNote) {
        lastNote = e.note;
        onAudition(e.note, t.inst);
      }
      place(n, e);
    };
    const up = () => {
      lanes.removeEventListener('pointermove', move);
      lanes.removeEventListener('pointerup', up);
      lanes.removeEventListener('pointercancel', up);
      if (mode !== 'move') lastDur = e.dur;
      onCommit();
    };
    lanes.addEventListener('pointermove', move);
    lanes.addEventListener('pointerup', up);
    lanes.addEventListener('pointercancel', up);
  }

  function select(e, n) {
    selected = e;
    if (lanes) lanes.querySelectorAll('.st-note.is-selected').forEach((x) => x.classList.remove('is-selected'));
    if (n) n.classList.add('is-selected');
    onSelectNote && onSelectNote(e);
  }

  function removeEvent(e) {
    const p = project();
    const i = p.events.indexOf(e);
    if (i >= 0) p.events.splice(i, 1);
    if (selected === e) selected = null;
    onCommit();
  }

  /* ---------- Step sequencer ---------- */
  function renderSteps(p, t, steps) {
    const mine = p.events.filter((e) => e.track === t.id);
    const on = new Map();
    mine.forEach((e) => {
      const key = `${e.note}:${Math.round(e.time / STEP)}`;
      if (!on.has(key)) on.set(key, []);
      on.get(key).push(e);
    });
    const frag = document.createDocumentFragment();
    rows.forEach((r, ri) => {
      for (let s = 0; s < steps; s++) {
        const hit = on.get(`${r.note}:${s}`);
        const c = document.createElement('button');
        c.className = `st-cell ${hit ? 'is-on' : ''} ${s % 4 === 0 ? 'is-beat' : ''} ${Math.floor(s / 4) % 2 ? 'is-odd' : ''}`;
        c.style.left = `${s * CELL}px`;
        c.style.top = `${ri * ROW}px`;
        c.dataset.row = String(ri);
        c.dataset.step = String(s);
        c.setAttribute('aria-label', `${r.label}, passo ${s + 1}${hit ? ', ligado' : ''}`);
        frag.append(c);
      }
    });
    lanes.append(frag);
    lanes.addEventListener('click', (ev) => {
      const c = ev.target.closest('.st-cell');
      if (!c) return;
      toggleStep(Number(c.dataset.row), Number(c.dataset.step));
    });
  }

  function toggleStep(ri, s) {
    const p = project();
    const t = track();
    const note = rows[ri].note;
    const hits = p.events.filter((e) => e.track === t.id && e.note === note && Math.round(e.time / STEP) === s);
    if (hits.length) {
      p.events = p.events.filter((e) => !hits.includes(e));
    } else {
      p.events.push({ time: s * STEP, dur: INSTRUMENT_BY_ID[t.inst].drums ? STEP : STEP * 2, note, vel: 0.85, inst: t.inst, track: t.id });
      onAudition(note, t.inst);
    }
    onCommit();
  }

  return {
    el: root,
    render,
    toggleStep,
    rows: () => rows.map((r) => r.note),
    get selected() {
      return selected;
    },
    deleteSelected() {
      if (selected) removeEvent(selected);
    },
    setPlayhead(beats) {
      if (!playhead) return;
      if (beats === null) {
        playhead.hidden = true;
        return;
      }
      playhead.hidden = false;
      playhead.style.transform = `translateX(${beats * 4 * CELL}px)`;
    }
  };
}
