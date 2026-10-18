// Studio: edita os eventos (nota, tempo, instrumento) gravados nos módulos — step sequencer e piano roll —,
// muda BPM, escala e instrumentos, exporta WAV (render offline) e WebM (canvas + webcam + áudio) e salva na Galeria.
import { beatFromJson } from '../beatcats/beatcats.js';
import { beatToEvents } from '../beatcats/sounds.js';
import { dockSay } from '../shared/companion.js';
import { creatureSVG } from '../shared/creatures.js';
import { EVENTS_KIND, eventsSummary, handoff, normalizeEvents } from '../shared/events.js';
import { DRUM_KIT, INSTRUMENTS, INSTRUMENT_BY_ID, ROOTS, SCALES, SCALE_BY_ID, createVoice, snapToScale } from '../shared/instruments.js';
import { gallery, getProfile } from '../shared/store.js';
import { el, formatDate, modal, stamp, startAudio, toast } from '../shared/ui.js';
import { createEditor } from './editor.js';
import { createVideoRecorder, projectSeconds, renderWav } from './render.js';

const MAX_BARS = 32;
const STEP = 0.25;
const SOURCE_NAMES = { airpads: 'Air Pads', beatcats: 'Beat Cats', cattyping: 'Cat Typing', studio: 'Studio' };
const KEY_ROW = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p'];
const DRUM_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const snap = (b) => Math.round(b / STEP) * STEP;
const round = (x) => Math.round(x * 1000) / 1000;
const newId = () => `faixa-${Math.random().toString(36).slice(2, 8)}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function blankProject() {
  return {
    name: `Projeto ${stamp()}`,
    source: 'studio',
    bpm: 100,
    scale: 'major',
    root: 0,
    length: 16,
    tracks: [
      { id: 'bateria', name: 'Bateria', inst: 'drums', mute: false },
      { id: 'teclado', name: 'Teclado', inst: 'piano', mute: false }
    ],
    events: []
  };
}

// Exemplo: 4 compassos em Lá menor (Am – F – C – G) com bateria, baixo, acordes e melodia.
function demoProject() {
  const p = { ...blankProject(), name: 'Exemplo · Noite Neon', bpm: 104, scale: 'minor', root: 9, length: 16 };
  p.tracks = [
    { id: 'bateria', name: 'Bateria', inst: 'drums', mute: false },
    { id: 'baixo', name: 'Baixo', inst: 'bass', mute: false },
    { id: 'acordes', name: 'Acordes', inst: 'piano', mute: false },
    { id: 'melodia', name: 'Melodia', inst: 'chip', mute: false }
  ];
  const ev = (track, time, note, dur = 0.25, vel = 0.85) => p.events.push({ track, inst: p.tracks.find((t) => t.id === track).inst, time, note, dur, vel });
  const chords = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]];
  const roots = [45, 41, 48, 43];
  for (let bar = 0; bar < 4; bar++) {
    const b = bar * 4;
    [0, 1.5, 2.5].forEach((t) => ev('bateria', b + t, 36, 0.25, 1));
    [1, 3].forEach((t) => ev('bateria', b + t, 38));
    for (let h = 0; h < 8; h++) ev('bateria', b + h * 0.5, h === 7 ? 46 : 42, 0.25, h % 2 ? 0.6 : 0.8);
    [0, 0.75, 1.5, 2, 3, 3.5].forEach((t, i) => ev('baixo', b + t, roots[bar] + (i === 4 ? 12 : 0), 0.5));
    chords[bar].forEach((n) => ev('acordes', b, n, 3.5, 0.6));
  }
  [[0, 76, 1], [1, 74, 0.5], [1.5, 72, 0.5], [2, 69, 2], [4, 72, 1], [5, 74, 0.5], [5.5, 76, 0.5], [6, 81, 2], [8, 79, 1], [9, 76, 0.5], [9.5, 74, 0.5], [10, 72, 2], [12, 74, 1], [13, 76, 0.5], [13.5, 79, 0.5], [14, 76, 2]].forEach(([t, n, d]) => ev('melodia', t, n, d));
  return p;
}

function fromJson(json, fallbackName) {
  const j = normalizeEvents(json);
  const bars = Math.max(1, Math.min(MAX_BARS, Math.ceil((Number(j.length) || j.events.reduce((m, e) => Math.max(m, e.time + e.dur), 4)) / 4)));
  const tracks = j.tracks.map((t) => ({ id: String(t.id), name: String(t.name || t.id).slice(0, 40), inst: t.inst, mute: Boolean(t.mute) }));
  const instOf = Object.fromEntries(tracks.map((t) => [t.id, t.inst]));
  return {
    name: j.name || fallbackName || `Projeto ${stamp()}`,
    source: j.source || 'studio',
    bpm: j.bpm,
    scale: SCALE_BY_ID[j.scale] ? j.scale : 'major',
    root: j.root,
    length: bars * 4,
    tracks,
    events: j.events.map((e) => ({ ...e, inst: instOf[e.track] || e.inst }))
  };
}

export default {
  id: 'studio',
  title: 'Studio',
  icon: 'studio',
  accent: '#5ff3ff',
  desc: 'Step sequencer e piano roll: edite o que você tocou, exporte WAV e vídeo.',
  async mount(root, { params }) {
    const profile = getProfile();
    let project = blankProject();
    let openedProjectId = null;
    let origin = 'Projeto novo';
    let trackId = project.tracks[1].id;
    let view = 'roll';
    let alive = true;
    let Tone = null;
    let audioPromise = null;
    let master = null;
    let part = null;
    let playing = false;
    let loopOn = true;
    let raf = 0;
    let busy = null;
    let recKeys = false;
    let lastExportUrl = null;
    const voices = new Map();
    const held = new Map();

    const track = () => project.tracks.find((t) => t.id === trackId) || null;

    /* ---------- DOM ---------- */
    const playBtn = el('button', { class: 'btn btn--primary btn--lg' }, 'Tocar');
    const loopBtn = el('button', { class: 'btn btn--ghost btn--sm is-active', 'aria-pressed': 'true' }, 'Loop: Sim');
    const bpmInput = el('input', { class: 'range', type: 'range', min: '40', max: '220', 'aria-label': 'BPM' });
    const bpmLabel = el('span', { class: 'pill' });
    const scaleSel = el('select', { class: 'input input--select', 'aria-label': 'Escala' }, ...SCALES.map((s) => el('option', { value: s.id }, s.name)));
    const rootSel = el('select', { class: 'input input--select', 'aria-label': 'Tônica' }, ...ROOTS.map((r, i) => el('option', { value: String(i) }, r)));
    const barsSel = el('select', { class: 'input input--select', 'aria-label': 'Compassos' }, ...[...Array(MAX_BARS)].map((_, i) => el('option', { value: String(i + 1) }, `${i + 1} comp.`)));
    const snapBtn = el('button', { class: 'btn btn--ghost btn--sm', title: 'Move as notas fora da escala para a nota da escala mais próxima' }, 'Encaixar na escala');
    const quantBtn = el('button', { class: 'btn btn--ghost btn--sm', title: 'Alinha a faixa selecionada na grade de semicolcheias' }, 'Quantizar faixa');
    const nameInput = el('input', { class: 'input', type: 'text', maxlength: '60', 'aria-label': 'Nome do projeto' });
    const originEl = el('span', { class: 'muted st-origin' });
    const tracksEl = el('div', { class: 'st-tracks', role: 'listbox', 'aria-label': 'Faixas' });
    const addInst = el('select', { class: 'input input--select', 'aria-label': 'Instrumento da nova faixa' }, ...INSTRUMENTS.map((i) => el('option', { value: i.id }, i.name)));
    const addBtn = el('button', { class: 'btn btn--ghost btn--sm' }, '+ Faixa');
    const tabs = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Editor' });
    const editHint = el('p', { class: 'hint st-hint' });
    const wavBtn = el('button', { class: 'btn btn--primary' }, 'Exportar WAV');
    const camBox = el('input', { type: 'checkbox', 'aria-label': 'Usar webcam no vídeo' });
    const webmBtn = el('button', { class: 'btn btn--primary' }, 'Exportar vídeo WebM');
    const exportStatus = el('p', { class: 'muted st-export__status', 'aria-live': 'polite' }, 'O WAV é renderizado offline; o vídeo grava o projeto tocando uma vez.');
    const exportPreview = el('div', { class: 'st-export__preview' });
    const recKeysBtn = el('button', { class: 'btn btn--rec btn--sm', 'aria-pressed': 'false' }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar teclado: Não'));

    const editor = createEditor({
      project: () => project,
      track,
      view: () => view,
      onCommit: commit,
      onAudition: audition,
      onSelectNote: () => {}
    });

    /* ---------- Render ---------- */
    function renderTop() {
      bpmInput.value = String(project.bpm);
      bpmLabel.textContent = `${project.bpm} BPM`;
      scaleSel.value = project.scale;
      rootSel.value = String(project.root);
      barsSel.value = String(project.length / 4);
      nameInput.value = project.name;
      const sum = eventsSummary(project);
      originEl.textContent = `${origin} · ${sum.notes} nota${sum.notes === 1 ? '' : 's'} em ${sum.tracks} faixa${sum.tracks === 1 ? '' : 's'}`;
    }

    function renderTracks() {
      tracksEl.innerHTML = '';
      project.tracks.forEach((t) => {
        const inst = INSTRUMENT_BY_ID[t.inst];
        const count = project.events.filter((e) => e.track === t.id).length;
        const sel = el('select', { class: 'input input--select input--sm', 'aria-label': `Instrumento de ${t.name}` }, ...INSTRUMENTS.map((i) => el('option', { value: i.id }, i.name)));
        sel.value = t.inst;
        sel.addEventListener('click', (e) => e.stopPropagation());
        sel.addEventListener('change', () => setInstrument(t.id, sel.value));
        const name = el('input', { class: 'st-track__name', value: t.name, maxlength: '40', 'aria-label': 'Nome da faixa' });
        name.addEventListener('click', (e) => e.stopPropagation());
        name.addEventListener('change', () => {
          t.name = name.value.trim() || t.name;
        });
        const mute = el('button', { class: `btn btn--ghost btn--xs ${t.mute ? 'is-active' : ''}`, title: t.mute ? 'Ligar som' : 'Silenciar', 'aria-pressed': String(t.mute) }, t.mute ? 'Mudo' : 'Som');
        mute.addEventListener('click', (e) => {
          e.stopPropagation();
          t.mute = !t.mute;
          syncVoices();
          renderTracks();
          if (view === 'roll') editor.render();
        });
        const del = el('button', { class: 'btn btn--ghost btn--xs', title: 'Apagar faixa', 'aria-label': `Apagar ${t.name}` }, '✕');
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          removeTrack(t.id);
        });
        const row = el(
          'div',
          { class: `st-track ${t.id === trackId ? 'is-on' : ''} ${t.mute ? 'is-muted' : ''}`, role: 'option', 'aria-selected': String(t.id === trackId), tabindex: '0', style: `--c:${inst.color}`, 'data-track': t.id },
          el('span', { class: 'st-track__dot' }),
          el('div', { class: 'st-track__body' }, name, el('div', { class: 'st-track__row' }, sel, el('span', { class: 'st-track__count' }, `${count} notas`))),
          el('div', { class: 'st-track__tools' }, mute, del)
        );
        row.addEventListener('click', () => selectTrack(t.id));
        row.addEventListener('keydown', (e) => (e.key === 'Enter' ? selectTrack(t.id) : null));
        tracksEl.append(row);
      });
      if (!project.tracks.length) tracksEl.append(el('p', { class: 'muted' }, 'Nenhuma faixa. Escolha um instrumento e clique em + Faixa.'));
    }

    function renderTabs() {
      tabs.innerHTML = '';
      [
        ['roll', 'Piano roll'],
        ['steps', 'Step sequencer']
      ].forEach(([id, label]) =>
        tabs.append(el('button', { class: `segmented__btn ${view === id ? 'is-on' : ''}`, role: 'tab', 'aria-selected': String(view === id), onclick: () => setView(id) }, label))
      );
      editHint.textContent =
        view === 'roll'
          ? 'Clique para criar uma nota (arraste para esticar). Arraste a nota para mover, puxe a ponta direita para mudar a duração; duplo clique ou botão direito apaga. Fileiras escuras ficam fora da escala.'
          : 'Cada quadradinho é uma semicolcheia: clique para ligar/desligar. As fileiras mostram as notas da escala escolhida (na bateria, as peças do kit).';
    }

    function renderAll() {
      renderTop();
      renderTracks();
      renderTabs();
      editor.render();
    }

    /* ---------- Edição ---------- */
    function commit() {
      project.events = project.events.filter((e) => project.tracks.some((t) => t.id === e.track));
      rebuildPart();
      renderTop();
      renderTracks();
      editor.render();
    }

    function selectTrack(id) {
      trackId = id;
      renderTracks();
      editor.render();
    }

    function setView(v) {
      view = v;
      renderTabs();
      editor.render();
    }

    function setInstrument(id, inst) {
      const t = project.tracks.find((x) => x.id === id);
      if (!t || !INSTRUMENT_BY_ID[inst]) return;
      const wasDrums = INSTRUMENT_BY_ID[t.inst].drums;
      if (t.name === INSTRUMENT_BY_ID[t.inst].name) t.name = INSTRUMENT_BY_ID[inst].name;
      t.inst = inst;
      project.events.forEach((e) => {
        if (e.track !== id) return;
        e.inst = inst;
        if (INSTRUMENT_BY_ID[inst].drums && !wasDrums) e.note = DRUM_KIT[DRUM_KIT.length - 1 - (e.note % DRUM_KIT.length)].note;
      });
      syncVoices();
      commit();
    }

    function addTrack(inst = addInst.value) {
      const t = { id: newId(), name: INSTRUMENT_BY_ID[inst].name, inst, mute: false };
      project.tracks.push(t);
      trackId = t.id;
      syncVoices();
      commit();
      return t;
    }

    function removeTrack(id) {
      project.tracks = project.tracks.filter((t) => t.id !== id);
      if (trackId === id) trackId = project.tracks[0] ? project.tracks[0].id : null;
      syncVoices();
      commit();
    }

    function snapScale() {
      let moved = 0;
      project.events.forEach((e) => {
        if (INSTRUMENT_BY_ID[e.inst].drums) return;
        const n = snapToScale(e.note, project.scale, project.root);
        if (n !== e.note) moved++;
        e.note = n;
      });
      commit();
      toast(moved ? `${moved} nota${moved === 1 ? '' : 's'} encaixada${moved === 1 ? '' : 's'} em ${SCALE_BY_ID[project.scale].name} de ${ROOTS[project.root]}.` : 'Todas as notas já estão na escala.', 'ok');
    }

    function quantize() {
      const t = track();
      if (!t) return;
      project.events.forEach((e) => {
        if (e.track !== t.id) return;
        e.time = Math.max(0, snap(e.time));
        e.dur = Math.max(STEP, snap(e.dur));
      });
      const seen = new Set();
      project.events = project.events.filter((e) => {
        if (e.track !== t.id) return true;
        const k = `${e.note}:${e.time}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      commit();
      toast(`Faixa “${t.name}” alinhada na grade.`, 'ok');
    }

    function load(json, { name, originText, projectId = null } = {}) {
      stop();
      project = fromJson(json, name);
      openedProjectId = projectId;
      origin = originText || `Veio de ${SOURCE_NAMES[project.source] || project.source}`;
      trackId = project.tracks[0] ? project.tracks[0].id : null;
      if (Tone) Tone.Transport.bpm.value = project.bpm;
      syncVoices();
      rebuildPart();
      renderAll();
    }

    /* ---------- Áudio ---------- */
    function ensureAudio() {
      if (!audioPromise) {
        audioPromise = (async () => {
          Tone = await startAudio();
          if (!alive) return;
          Tone.Transport.stop();
          Tone.Transport.cancel();
          master = new Tone.Gain(0.9).toDestination();
          Tone.Transport.bpm.value = project.bpm;
          syncVoices();
          rebuildPart();
        })();
        audioPromise.catch((err) => {
          audioPromise = null;
          toast(`Áudio indisponível: ${err.message}`, 'error');
        });
      }
      return audioPromise;
    }

    function syncVoices() {
      if (!Tone || !master) return;
      voices.forEach((v, id) => {
        const t = project.tracks.find((x) => x.id === id);
        if (!t || t.inst !== v.inst) {
          v.voice.dispose();
          v.gain.dispose();
          voices.delete(id);
        }
      });
      project.tracks.forEach((t) => {
        if (!voices.has(t.id)) {
          const gain = new Tone.Gain(1).connect(master);
          voices.set(t.id, { inst: t.inst, gain, voice: createVoice(Tone, t.inst, gain) });
        }
        voices.get(t.id).gain.gain.value = t.mute ? 0 : 1;
      });
    }

    function rebuildPart() {
      if (!Tone) return;
      if (part) part.dispose();
      const ppq = Tone.Transport.PPQ;
      part = new Tone.Part(
        (time, e) => {
          const v = voices.get(e.track);
          if (v) v.voice.play(e.note, (e.dur * 60) / project.bpm, time, e.vel);
        },
        project.events.filter((e) => e.time < project.length).map((e) => [`${Math.round(e.time * ppq)}i`, e])
      ).start(0);
      Tone.Transport.loop = loopOn;
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = `${project.length * ppq}i`;
    }

    const beatNow = () => (Tone ? Tone.Transport.ticks / Tone.Transport.PPQ : 0);

    async function start() {
      await ensureAudio();
      if (playing || !alive) return;
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      Tone.Transport.start('+0.05');
      playing = true;
      playBtn.textContent = 'Parar';
      playBtn.classList.add('is-active');
      const tick = () => {
        if (!playing) return;
        editor.setPlayhead(beatNow() % project.length);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      if (!playing) return;
      playing = false;
      cancelAnimationFrame(raf);
      Tone.Transport.stop();
      voices.forEach((v) => v.voice.stop && v.voice.stop(Tone.now()));
      editor.setPlayhead(null);
      playBtn.textContent = 'Tocar';
      playBtn.classList.remove('is-active');
    }

    function audition(note, inst) {
      ensureAudio()
        .then(() => {
          const t = track();
          const v = t && voices.get(t.id);
          if (v && v.inst === inst) v.voice.play(note, 0.3, undefined, 0.8);
        })
        .catch(() => {});
    }

    /* ---------- Teclado do computador: tocar e gravar na faixa ---------- */
    function keyNote(key) {
      const t = track();
      if (!t) return null;
      const inst = INSTRUMENT_BY_ID[t.inst];
      if (inst.drums) {
        const i = DRUM_KEYS.indexOf(key);
        return i < 0 ? null : DRUM_KIT[DRUM_KIT.length - 1 - i].note;
      }
      const i = KEY_ROW.indexOf(key);
      if (i < 0) return null;
      return Math.ceil((inst.range[0] + 6) / 12) * 12 + i;
    }

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input, select, textarea')) return;
      if (e.key === ' ') {
        e.preventDefault();
        playing ? stop() : start();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        editor.deleteSelected();
        return;
      }
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const note = keyNote(k);
      if (note === null) return;
      const t = track();
      audition(note, t.inst);
      if (recKeys && playing) {
        const ev = { time: Math.min(project.length - STEP, snap(beatNow() % project.length)), dur: STEP, note, vel: 0.85, inst: t.inst, track: t.id };
        project.events.push(ev);
        held.set(k, { ev, at: beatNow() });
      }
    };
    const onKeyUp = (e) => {
      const h = held.get(e.key.toLowerCase());
      if (!h) return;
      held.delete(e.key.toLowerCase());
      h.ev.dur = Math.max(STEP, snap(beatNow() - h.at));
      commit();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    /* ---------- Salvar / abrir ---------- */
    function toJson() {
      const tracks = project.tracks.map(({ id, name, inst, mute }) => ({ id, name, inst, mute }));
      const instOf = Object.fromEntries(tracks.map((t) => [t.id, t.inst]));
      return {
        version: 1,
        kind: EVENTS_KIND,
        source: project.source,
        name: project.name,
        bpm: project.bpm,
        scale: project.scale,
        root: project.root,
        length: project.length,
        tracks,
        events: project.events
          .map((e) => ({ time: round(e.time), dur: round(e.dur), note: e.note, vel: round(e.vel), inst: instOf[e.track], track: e.track }))
          .sort((a, b) => a.time - b.time || a.note - b.note)
      };
    }

    async function loadFromGallery(id) {
      const item = (await gallery.list()).find((i) => i.id === id);
      if (!item) throw new Error('Item não encontrado na Galeria.');
      if (item.type === 'beat') {
        const { json } = await gallery.read(id);
        const T = await startAudio();
        const ev = beatToEvents(T, beatFromJson(json));
        load(ev, { name: item.name, originText: `Beat “${item.name}” do Beat Cats` });
        return item;
      }
      const { json } = await gallery.readEvents(id);
      const isProject = item.type === 'project';
      load(json, {
        name: isProject ? item.name : `${item.name} (edição)`,
        originText: isProject ? `Projeto salvo em ${formatDate(item.updatedAt || item.createdAt)}` : `Gravação “${item.name}” (${SOURCE_NAMES[item.module] || item.module})`,
        projectId: isProject ? item.id : null
      });
      return item;
    }

    async function openPicker() {
      let items = [];
      try {
        items = (await gallery.list()).filter((i) => i.type === 'project' || i.eventsFile || i.type === 'beat');
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
      const list = el('div', { class: 'st-picker' });
      if (!items.length) list.append(el('div', { class: 'state state--empty' }, el('p', {}, 'Nada com notas na Galeria ainda. Grave no Air Pads ou no Beat Cats, ou salve um projeto aqui.')));
      const m = modal({ title: 'Abrir no Studio', body: list, wide: true, actions: [{ label: 'Fechar', value: null }] });
      items.forEach((i) =>
        list.append(
          el(
            'button',
            {
              class: 'st-picker__item',
              onclick: () => {
                m.close(null);
                location.hash = `#/studio?open=${encodeURIComponent(i.id)}`;
              }
            },
            el('strong', {}, i.name),
            el('span', { class: 'muted' }, `${i.type === 'project' ? 'Projeto' : i.type === 'beat' ? 'Beat' : i.type === 'video' ? 'Vídeo' : 'Áudio'} · ${SOURCE_NAMES[i.module] || i.module} · ${formatDate(i.createdAt)}${i.meta && i.meta.notes ? ` · ${i.meta.notes} notas` : ''}`)
          )
        )
      );
    }

    /* ---------- Exportar ---------- */
    function setBusy(text) {
      busy = text;
      [wavBtn, webmBtn].forEach((b) => (b.disabled = Boolean(text)));
      if (text) exportStatus.textContent = text;
    }

    function showExport(blob, kind) {
      if (lastExportUrl) URL.revokeObjectURL(lastExportUrl);
      lastExportUrl = URL.createObjectURL(blob);
      exportPreview.innerHTML = '';
      exportPreview.append(el(kind, { src: lastExportUrl, controls: true, class: 'player' }));
    }

    async function exportWav() {
      if (busy) return null;
      if (!project.events.length) throw new Error('O projeto ainda não tem notas.');
      setBusy('Renderizando WAV offline…');
      try {
        const T = await startAudio();
        const json = toJson();
        const { blob, seconds } = await renderWav(T, json);
        const item = await gallery.addBlob('audio', `${project.name} (WAV)`, 'studio', blob, { seconds, bpm: project.bpm, ...eventsSummary(json) }, json);
        showExport(blob, 'audio');
        exportStatus.textContent = `WAV de ${seconds.toFixed(1)}s salvo na Galeria (use Exportar na Galeria para salvar no computador).`;
        toast(`“${item.name}” foi para a Galeria!`, 'ok', 3600);
        return item;
      } finally {
        setBusy(null);
      }
    }

    async function exportVideo({ webcam = camBox.checked } = {}) {
      if (busy) return null;
      if (!project.events.length) throw new Error('O projeto ainda não tem notas.');
      setBusy('Preparando o vídeo…');
      let cam = null;
      let camNote = '';
      try {
        await ensureAudio();
        stop();
        if (webcam) {
          try {
            cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
          } catch (err) {
            camNote = ` Webcam indisponível (${err.name || err.message}): o vídeo sai só com a animação.`;
          }
        }
        const json = toJson();
        const sprites = [creatureSVG('cat', profile.cat, { size: 180, label: profile.cat.name }), creatureSVG('otter', profile.otter, { size: 140, label: profile.otter.name })];
        const rec = await createVideoRecorder({ Tone, master, project: json, cam, sprites, getBeat: () => (playing ? beatNow() : 0) });
        loopOn = false;
        Tone.Transport.loop = false;
        rec.start();
        await start();
        const total = projectSeconds(json);
        const t0 = performance.now();
        while (alive && playing && beatNow() < project.length) {
          setBusy(`Gravando vídeo${rec.hasCam ? ' com webcam' : ''}… ${Math.min(total, (performance.now() - t0) / 1000).toFixed(1)}s de ${total.toFixed(1)}s.${camNote}`);
          await wait(120);
        }
        await wait(900);
        stop();
        const { blob, seconds } = await rec.stop();
        const item = await gallery.addBlob('video', `${project.name} (vídeo)`, 'studio', blob, { seconds, bpm: project.bpm, webcam: rec.hasCam, ...eventsSummary(json) }, json);
        if (alive) {
          showExport(blob, 'video');
          exportStatus.textContent = `Vídeo WebM de ${seconds.toFixed(1)}s ${rec.hasCam ? 'com webcam ' : ''}salvo na Galeria.${camNote}`;
          toast(`“${item.name}” foi para a Galeria!`, 'ok', 3600);
        }
        return { item, webcam: rec.hasCam, note: camNote };
      } finally {
        if (cam) cam.getTracks().forEach((t) => t.stop());
        loopOn = loopBtn.getAttribute('aria-pressed') === 'true';
        if (Tone) Tone.Transport.loop = loopOn;
        setBusy(null);
      }
    }

    /* ---------- Controles ---------- */
    playBtn.addEventListener('click', () => (playing ? stop() : start().catch((err) => toast(err.message, 'error'))));
    loopBtn.addEventListener('click', () => {
      loopOn = !loopOn;
      loopBtn.textContent = `Loop: ${loopOn ? 'Sim' : 'Não'}`;
      loopBtn.setAttribute('aria-pressed', String(loopOn));
      loopBtn.classList.toggle('is-active', loopOn);
      if (Tone) Tone.Transport.loop = loopOn;
    });
    bpmInput.addEventListener('input', () => {
      project.bpm = Number(bpmInput.value);
      bpmLabel.textContent = `${project.bpm} BPM`;
      if (Tone) Tone.Transport.bpm.value = project.bpm;
    });
    scaleSel.addEventListener('change', () => {
      project.scale = scaleSel.value;
      editor.render();
    });
    rootSel.addEventListener('change', () => {
      project.root = Number(rootSel.value);
      editor.render();
    });
    barsSel.addEventListener('change', () => {
      project.length = Number(barsSel.value) * 4;
      commit();
    });
    nameInput.addEventListener('input', () => (project.name = nameInput.value.trim() || project.name));
    snapBtn.addEventListener('click', snapScale);
    quantBtn.addEventListener('click', quantize);
    addBtn.addEventListener('click', () => addTrack());
    recKeysBtn.addEventListener('click', () => {
      recKeys = !recKeys;
      recKeysBtn.classList.toggle('is-active', recKeys);
      recKeysBtn.setAttribute('aria-pressed', String(recKeys));
      recKeysBtn.querySelector('.btn__text').textContent = `Gravar teclado: ${recKeys ? 'Sim' : 'Não'}`;
      if (recKeys && !playing) start().catch(() => {});
    });
    const run = (fn) => () => fn().catch((err) => toast(err.message, 'error', 4200));
    wavBtn.addEventListener('click', run(() => exportWav()));
    webmBtn.addEventListener('click', run(() => exportVideo()));

    root.append(
      el(
        'div',
        { class: 'st' },
        el(
          'section',
          { class: 'panel st-bar' },
          el(
            'div',
            { class: 'toolbar' },
            playBtn,
            loopBtn,
            el('label', { class: 'toolbar__bpm' }, bpmLabel, bpmInput),
            el('label', { class: 'st-field' }, el('span', { class: 'field__label' }, 'Escala'), scaleSel),
            el('label', { class: 'st-field' }, el('span', { class: 'field__label' }, 'Tônica'), rootSel),
            el('label', { class: 'st-field' }, el('span', { class: 'field__label' }, 'Tamanho'), barsSel),
            snapBtn,
            quantBtn
          ),
          el('div', { class: 'st-namebar' }, el('label', { class: 'field st-name' }, el('span', { class: 'field__label' }, 'Nome do projeto'), nameInput), originEl)
        ),
        el(
          'aside',
          { class: 'panel st-side' },
          el('div', { class: 'panel__head' }, el('h2', {}, 'Faixas'), el('div', { class: 'st-add' }, addInst, addBtn)),
          tracksEl,
          el('div', { class: 'st-keysrec' }, recKeysBtn, el('p', { class: 'hint' }, 'Teclas A W S E D F T G Y H U J K O L P tocam a faixa selecionada (bateria: A a L). Com “Gravar teclado” as notas entram onde a agulha estiver. Espaço toca/para; Delete apaga a nota selecionada.')),
          el(
            'div',
            { class: 'st-open' },
            el('h3', { class: 'subhead' }, 'Abrir'),
            el(
              'div',
              { class: 'row-actions' },
              el('button', { class: 'btn btn--ghost btn--sm', onclick: openPicker }, 'Da Galeria…'),
              el('button', { class: 'btn btn--ghost btn--sm', onclick: () => load(toJsonOf(demoProject()), { originText: 'Projeto de exemplo' }) }, 'Exemplo'),
              el('button', { class: 'btn btn--ghost btn--sm', onclick: () => load(toJsonOf(blankProject()), { originText: 'Projeto novo' }) }, 'Em branco')
            )
          )
        ),
        el('section', { class: 'panel st-edit' }, el('div', { class: 'panel__head' }, tabs, editHint), editor.el),
        el(
          'section',
          { class: 'panel st-export' },
          el('h2', {}, 'Exportar'),
          el('div', { class: 'row-actions' }, wavBtn, el('label', { class: 'st-check' }, camBox, el('span', {}, 'Webcam no vídeo')), webmBtn),
          exportStatus,
          exportPreview
        )
      )
    );

    function toJsonOf(p) {
      return { version: 1, kind: EVENTS_KIND, ...p };
    }

    if (params.open) {
      try {
        await loadFromGallery(params.open);
      } catch (err) {
        toast(`Não abriu: ${err.message}`, 'error', 4200);
        renderAll();
      }
    } else if (params.from === 'live') {
      const json = handoff.take();
      if (json) {
        load(json, { name: json.name || `${SOURCE_NAMES[json.source] || 'Sessão'} ${stamp()}`, originText: `Tocado agora no ${SOURCE_NAMES[json.source] || json.source}` });
        dockSay('Tudo que você tocou virou nota. Bora editar!');
      } else {
        renderAll();
      }
    } else if (params.demo) {
      load(toJsonOf(demoProject()), { originText: 'Projeto de exemplo' });
      if (params.view === 'steps') setView('steps');
    } else {
      renderAll();
    }

    window.__mmpStudio = {
      state: () => ({
        name: project.name,
        bpm: project.bpm,
        scale: project.scale,
        root: project.root,
        length: project.length,
        tracks: project.tracks.map((t) => ({ ...t, notes: project.events.filter((e) => e.track === t.id).length })),
        notes: project.events.length,
        track: trackId,
        view,
        playing,
        opened: openedProjectId,
        origin
      }),
      json: toJson,
      rows: () => editor.rows(),
      selectTrack,
      setView,
      setInstrument,
      addTrack,
      exportWav,
      exportVideo,
      ready: () => ensureAudio(),
      beat: beatNow
    };

    return {
      async save() {
        if (busy) throw new Error('Espere a exportação terminar.');
        project.name = nameInput.value.trim() || project.name;
        const json = toJson();
        const meta = { bpm: project.bpm, ...eventsSummary(json) };
        if (openedProjectId) {
          await gallery.updateJson(openedProjectId, json, project.name);
          return `Projeto “${project.name}” atualizado na Galeria.`;
        }
        const item = await gallery.addJson('project', project.name, 'studio', json, meta);
        openedProjectId = item.id;
        origin = 'Projeto salvo agora';
        renderTop();
        return `Projeto “${project.name}” salvo na Galeria! Abra de lá para continuar editando.`;
      },
      unmount() {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        if (window.__mmpStudio) delete window.__mmpStudio;
        if (Tone) {
          Tone.Transport.stop();
          Tone.Transport.cancel();
          Tone.Transport.loop = false;
        }
        if (part) part.dispose();
        voices.forEach((v) => {
          v.voice.dispose();
          v.gain.dispose();
        });
        if (master) setTimeout(() => master.dispose(), 300);
        if (lastExportUrl) URL.revokeObjectURL(lastExportUrl);
      }
    };
  }
};
