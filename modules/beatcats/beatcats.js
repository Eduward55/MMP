// Beat Cats: beatbox em grupo. Arraste um acessório para um gato e ele entra no loop cantando e dançando.
import { createOutputRecorder } from '../shared/audio.js';
import { COATS, EYE_COLORS, accessorySVG, creatureSVG } from '../shared/creatures.js';
import { dockSay } from '../shared/companion.js';
import { createEventLog, eventsSummary, openInStudio } from '../shared/events.js';
import { OUTFIT_BY_ID } from '../shared/outfits.js';
import { gallery, getProfile } from '../shared/store.js';
import { el, esc, startAudio, stamp, toast } from '../shared/ui.js';
import { GROUPS, GROUP_BY_ID, LOOP_STEPS, SOUNDS, SOUND_BY_ID, makeCaptured, otterSplash } from './sounds.js';
import { createStageRecorder } from './stage-recorder.js';

const CAT_COUNT = 8;
const ROUND_STEPS = 32;
const COAT_NAMES = { tabby: 'Listrado', black: 'Breu', tuxedo: 'Frajola', white: 'Neve', orange: 'Laranjinha', gray: 'Fumaça', cream: 'Creme', chocolate: 'Chocolate' };
const V1_MAP = { kick: 'bumbo', snare: 'caixa', hat: 'chimbal', meow: 'melodia-miau' };
const MOUTH = '<g class="bc-mouth" opacity="0"><rect x="19" y="22" width="3" height="2" fill="#3a1d2e"/><rect x="20" y="23" width="1" height="1" fill="#ff7fb0"/></g>';

function band(profile) {
  const others = COATS.filter((c) => c.id !== profile.cat.coat);
  return [
    { name: profile.cat.name, coat: profile.cat.coat, eyes: profile.cat.eyes },
    ...others.map((c, i) => ({ name: COAT_NAMES[c.id], coat: c.id, eyes: EYE_COLORS[(i + 1) % EYE_COLORS.length].id }))
  ].slice(0, CAT_COUNT);
}

// Converte um beat salvo (v2 ou o formato antigo de sequenciador) para a lista de sons dos 8 gatos.
export function beatFromJson(json) {
  const cats = new Array(CAT_COUNT).fill(null);
  if (json && Array.isArray(json.cats)) {
    json.cats.slice(0, CAT_COUNT).forEach((id, i) => (cats[i] = SOUND_BY_ID[id] ? id : null));
  } else if (json && json.tracks) {
    Object.entries(V1_MAP)
      .filter(([k]) => (json.tracks[k] || []).some(Boolean))
      .forEach(([, id], i) => (cats[i] = id));
  }
  const seen = new Set();
  return {
    cats: cats.map((id) => (id && !seen.has(id) ? (seen.add(id), id) : null)),
    bpm: Math.max(60, Math.min(160, Number(json && json.bpm) || 100)),
    mode: json && json.mode === 'round' ? 'round' : 'continuous',
    recordMode: json && json.recordMode === 'video' ? 'video' : 'audio'
  };
}

export default {
  id: 'beatcats',
  title: 'Beat Cats',
  icon: 'beatcats',
  accent: '#ff4fd8',
  desc: 'Beatbox em grupo: vista os gatos com acessórios e cada um entra cantando no loop.',
  hideDock: true,
  async mount(root, { params }) {
    const profile = getProfile();
    const members = band(profile);
    let state = beatFromJson(null);
    let openedId = null;
    let name = `Beat ${stamp()}`;

    let alive = true;
    let Tone = null;
    let audioPromise = null;
    let master = null;
    let masterFilter = null;
    let loop = null;
    let step = 0;
    let playing = false;
    let rec = null;
    let recTimer = 0;
    let selected = null;
    let otterPending = false;
    const voices = new Array(CAT_COUNT).fill(null);
    const pending = new Map();
    const singTimers = [];
    const log = createEventLog({ source: 'beatcats', bpm: state.bpm, scale: 'minor', root: 9 });

    /* ---------- DOM ---------- */
    const nameInput = el('input', { class: 'input', type: 'text', maxlength: '60', value: name, 'aria-label': 'Nome do beat' });
    const playBtn = el('button', { class: 'btn btn--primary btn--lg' }, 'Tocar');
    const bpmInput = el('input', { class: 'range', type: 'range', min: '60', max: '160', value: String(state.bpm), 'aria-label': 'BPM' });
    const bpmLabel = el('span', { class: 'pill' }, `${state.bpm} BPM`);
    const modeTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Modo' });
    const recModeTabs = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'O que gravar' });
    const recBtn = el('button', { class: 'btn btn--rec' }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar'));
    const timer = el('span', { class: 'pill' }, '00:00');
    const status = el('span', { class: 'muted bc-status' }, 'Novo beat');
    const roundFill = el('div', { class: 'bc-round__fill' });
    const roundLabel = el('span', { class: 'bc-round__label' }, '');
    const roundBar = el('div', { class: 'bc-round', hidden: true }, roundFill, roundLabel);

    const catEls = members.map((m, i) => el('div', { class: 'bc-cat is-empty', 'data-cat': String(i), role: 'button', tabindex: '0', 'aria-label': `Gato ${m.name}` }));
    const otter = el(
      'button',
      { class: 'bc-otter', title: 'Efeito especial da lontra' },
      el('span', { class: 'bc-otter__art', html: creatureSVG('otter', profile.otter, { size: 96, label: profile.otter.name }) }),
      el('span', { class: 'bc-otter__name' }, profile.otter.name),
      el('span', { class: 'bc-otter__hint' }, 'Splash!')
    );
    const stage = el('div', { class: 'bc-stage' }, el('div', { class: 'bc-line' }, el('div', { class: 'bc-cats' }, ...catEls), otter));

    const palette = el('div', { class: 'bc-palette' });
    const tokens = new Map();
    GROUPS.forEach((g) => {
      const row = el('div', { class: 'bc-group__tokens' });
      SOUNDS.filter((s) => s.group === g.id).forEach((s) => {
        const t = el(
          'button',
          { class: 'bc-token', 'data-sound': s.id, style: `--c:${g.color}`, title: `${s.name} (${g.name})` },
          el('span', { class: 'bc-token__art', html: accessorySVG(s.outfit, { size: 44, label: s.name }) }),
          el('span', { class: 'bc-token__name' }, s.name),
          el('span', { class: 'bc-token__who' })
        );
        t.addEventListener('pointerdown', (e) => startDrag(e, s.id, null));
        t.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select(selected === s.id ? null : s.id);
          }
        });
        tokens.set(s.id, t);
        row.append(t);
      });
      palette.append(el('section', { class: 'bc-group', style: `--c:${g.color}` }, el('h3', { class: 'bc-group__title' }, `${g.name} · ${SOUNDS.filter((s) => s.group === g.id).length}`), row));
    });

    /* ---------- Render ---------- */
    function catLook(i, soundId) {
      const m = members[i];
      const s = soundId && SOUND_BY_ID[soundId];
      return { coat: m.coat, eyes: m.eyes, outfit: s ? { [OUTFIT_BY_ID[s.outfit].slot]: s.outfit } : {} };
    }

    function renderCat(i) {
      const c = catEls[i];
      const current = state.cats[i];
      const target = pending.has(i) ? pending.get(i) : current;
      const shown = target || current;
      const s = shown && SOUND_BY_ID[shown];
      const g = s && GROUP_BY_ID[s.group];
      c.className = `bc-cat ${current ? 'is-active' : 'is-empty'} ${s ? `bc-cat--${s.group}` : ''} ${pending.has(i) ? (target ? 'is-pending' : 'is-leaving') : ''}`;
      c.style.setProperty('--c', g ? g.color : '#2a2a32');
      const svg = creatureSVG('cat', catLook(i, shown), { size: 118, label: members[i].name }).replace('</svg>', `${MOUTH}</svg>`);
      c.innerHTML = `
        <div class="bc-cat__spot" aria-hidden="true"></div>
        <div class="bc-cat__art">${svg}</div>
        <span class="bc-cat__name">${esc(members[i].name)}</span>
        <span class="bc-cat__tag">${s ? esc(s.name) : 'vazio'}</span>
        ${s ? '<span class="bc-cat__remove" aria-hidden="true">×</span>' : '<span class="bc-cat__drop">solte aqui</span>'}`;
      c.setAttribute('aria-label', `Gato ${members[i].name}: ${s ? s.name : 'vazio'}`);
    }

    function renderTokens() {
      tokens.forEach((t, id) => {
        const owner = state.cats.indexOf(id);
        const pendingOwner = [...pending.entries()].find(([, v]) => v === id);
        const i = pendingOwner ? pendingOwner[0] : owner;
        t.classList.toggle('is-used', i >= 0);
        t.classList.toggle('is-selected', selected === id);
        t.querySelector('.bc-token__who').textContent = i >= 0 ? members[i].name : '';
      });
    }

    function renderModes() {
      modeTabs.innerHTML = '';
      [
        ['continuous', 'Contínuo'],
        ['round', 'Por rodada']
      ].forEach(([id, label]) =>
        modeTabs.append(
          el('button', {
            class: `segmented__btn ${state.mode === id ? 'is-on' : ''}`,
            role: 'radio',
            'aria-checked': String(state.mode === id),
            onclick: () => setMode(id)
          }, label)
        )
      );
      recModeTabs.innerHTML = '';
      [
        ['audio', 'Só áudio'],
        ['video', 'Áudio + animação']
      ].forEach(([id, label]) =>
        recModeTabs.append(
          el('button', {
            class: `segmented__btn ${state.recordMode === id ? 'is-on' : ''}`,
            role: 'radio',
            'aria-checked': String(state.recordMode === id),
            disabled: rec ? true : null,
            onclick: () => {
              state.recordMode = id;
              renderModes();
            }
          }, label)
        )
      );
      roundBar.hidden = state.mode !== 'round';
    }

    function renderAll() {
      catEls.forEach((_, i) => renderCat(i));
      renderTokens();
      renderModes();
      bpmInput.value = String(state.bpm);
      bpmLabel.textContent = `${state.bpm} BPM`;
    }

    /* ---------- Áudio ---------- */
    function ensureAudio() {
      if (!audioPromise) {
        audioPromise = (async () => {
          Tone = await startAudio();
          if (!alive) return;
          masterFilter = new Tone.Filter(18000, 'lowpass').toDestination();
          master = new Tone.Gain(0.85).connect(masterFilter);
          Tone.Transport.bpm.value = state.bpm;
          state.cats.forEach((id, i) => id && (voices[i] = makeCaptured(Tone, id, master, log)));
          loop = new Tone.Loop(onStep, '16n').start(0);
        })();
        audioPromise.catch((err) => {
          audioPromise = null;
          toast(`Áudio indisponível: ${err.message}`, 'error');
        });
      }
      return audioPromise;
    }

    function onStep(time) {
      log.align(time);
      const s = step % LOOP_STEPS;
      if (state.mode === 'round' && s % ROUND_STEPS === 0) {
        pending.forEach((id, i) => applyLayer(i, id, time));
        const changed = pending.size > 0;
        pending.clear();
        if (changed) Tone.Draw.schedule(() => { renderAll(); }, time);
      }
      if (otterPending && (state.mode === 'continuous' || s % 16 === 0)) {
        otterPending = false;
        otterSplash(Tone, master, masterFilter, time);
        log.note({ note: 84, inst: 'fx', track: 'lontra', trackName: `${profile.otter.name} · splash`, time, dur: 60 / state.bpm, vel: 0.9 });
        Tone.Draw.schedule(splashVisual, time);
      }
      const sang = [];
      voices.forEach((v, i) => {
        if (v && state.cats[i] && v.tick(s, time)) sang.push(i);
      });
      const quarter = s % 4 === 0;
      const roundStep = step % ROUND_STEPS;
      const roundNo = Math.floor(step / ROUND_STEPS) + 1;
      Tone.Draw.schedule(() => visualStep(sang, quarter, roundStep, roundNo), time);
      step++;
    }

    function applyLayer(i, id, time) {
      if (voices[i]) {
        const old = voices[i];
        if (old.stop) old.stop(time ?? Tone.now());
        setTimeout(() => old.dispose(), 2500);
        voices[i] = null;
      }
      state.cats[i] = id || null;
      if (id && Tone && master) voices[i] = makeCaptured(Tone, id, master, log);
    }

    /* ---------- Visual sincronizado ---------- */
    function visualStep(sang, quarter, roundStep, roundNo) {
      if (!alive) return;
      sang.forEach((i) => {
        const c = catEls[i];
        c.classList.add('is-sing');
        clearTimeout(singTimers[i]);
        singTimers[i] = setTimeout(() => c.classList.remove('is-sing'), 110);
        if (Math.random() < 0.3) spawnNote(c);
      });
      if (quarter) {
        catEls.forEach((c, i) => state.cats[i] && c.classList.add('is-beat'));
        setTimeout(() => catEls.forEach((c) => c.classList.remove('is-beat')), 120);
      }
      if (state.mode === 'round') {
        roundFill.style.width = `${((roundStep + 1) / ROUND_STEPS) * 100}%`;
        const beatsLeft = Math.ceil((ROUND_STEPS - roundStep - 1) / 4);
        roundLabel.textContent = `Rodada ${roundNo} · ${pending.size || otterPending ? `mudanças em ${beatsLeft} tempo${beatsLeft === 1 ? '' : 's'}` : 'tudo no lugar'}`;
      }
    }

    const NOTE_GLYPHS = ['♪', '♫', '♩', '♬'];
    function spawnNote(cat) {
      const n = el('span', { class: 'bc-note', style: `--dx:${Math.round(Math.random() * 40 - 20)}px` }, NOTE_GLYPHS[Math.floor(Math.random() * 4)]);
      cat.append(n);
      setTimeout(() => n.remove(), 900);
    }

    function splashVisual() {
      stage.classList.add('is-splash');
      otter.classList.add('is-diving');
      for (let k = 0; k < 14; k++) {
        const b = el('span', { class: 'bc-bubble', style: `left:${Math.round(Math.random() * 96)}%;--d:${(0.9 + Math.random() * 0.9).toFixed(2)}s;--s:${8 + Math.round(Math.random() * 14)}px` }, 'o');
        stage.append(b);
        setTimeout(() => b.remove(), 2000);
      }
      catEls.forEach((c) => c.classList.add('is-splashed'));
      setTimeout(() => {
        stage.classList.remove('is-splash');
        otter.classList.remove('is-diving');
        catEls.forEach((c) => c.classList.remove('is-splashed'));
      }, 1600);
    }

    /* ---------- Ações ---------- */
    async function start() {
      await ensureAudio();
      if (playing || !alive) return;
      step = 0;
      Tone.Transport.start('+0.05');
      playing = true;
      playBtn.textContent = 'Pausar';
      playBtn.classList.add('is-active');
    }

    function stop() {
      if (!playing) return;
      Tone.Transport.stop();
      voices.forEach((v) => v && v.stop && v.stop(Tone.now()));
      if (state.mode === 'round') {
        pending.forEach((id, i) => applyLayer(i, id));
        pending.clear();
        renderAll();
      }
      playing = false;
      playBtn.textContent = 'Tocar';
      playBtn.classList.remove('is-active');
    }

    function assign(i, id) {
      const from = state.cats.indexOf(id);
      const pendingFrom = [...pending.entries()].find(([k, v]) => v === id && k !== i);
      if (pendingFrom) pending.delete(pendingFrom[0]);
      if (from >= 0 && from !== i) setLayer(from, null);
      setLayer(i, id);
      select(null);
      ensureAudio()
        .then(() => {
          if (id && !playing) start();
        })
        .catch(() => {});
      const s = SOUND_BY_ID[id];
      dockSay(`${members[i].name} entrou com ${s.name}!`);
    }

    function setLayer(i, id) {
      if (state.mode === 'round' && playing) {
        if ((state.cats[i] || null) === (id || null)) pending.delete(i);
        else pending.set(i, id || null);
      } else {
        applyLayer(i, id);
      }
      renderCat(i);
      renderTokens();
    }

    function remove(i) {
      if (!state.cats[i] && !pending.get(i)) return;
      setLayer(i, null);
    }

    function setMode(mode) {
      if (state.mode === mode) return;
      if (mode === 'continuous') {
        pending.forEach((id, i) => applyLayer(i, id));
        pending.clear();
      }
      state.mode = mode;
      renderAll();
    }

    function select(id) {
      selected = id;
      stage.classList.toggle('is-placing', Boolean(id));
      renderTokens();
    }

    function otterFx() {
      ensureAudio()
        .then(() => {
          otterPending = true;
          if (!playing) start();
        })
        .catch(() => {});
      otter.classList.add('is-armed');
      setTimeout(() => otter.classList.remove('is-armed'), 400);
    }

    /* ---------- Arrastar (mouse e toque, via Pointer Events) ---------- */
    function startDrag(e, soundId, fromCat) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      ensureAudio().catch(() => {});
      const ghost = el('div', { class: 'bc-ghost', html: accessorySVG(SOUND_BY_ID[soundId].outfit, { size: 64 }) });
      const sx = e.clientX;
      const sy = e.clientY;
      let moved = false;
      let hover = null;
      const place = (x, y) => (ghost.style.transform = `translate(${x - 32}px, ${y - 32}px)`);
      const targetAt = (x, y) => {
        const hit = document.elementFromPoint(x, y);
        return hit ? hit.closest('[data-cat]') : null;
      };
      const onMove = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
          moved = true;
          document.body.append(ghost);
          document.body.classList.add('is-dragging');
        }
        if (!moved) return;
        place(ev.clientX, ev.clientY);
        const t = targetAt(ev.clientX, ev.clientY);
        if (t !== hover) {
          if (hover) hover.classList.remove('is-hover');
          hover = t;
          if (hover) hover.classList.add('is-hover');
        }
      };
      const onUp = (ev) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        ghost.remove();
        document.body.classList.remove('is-dragging');
        if (hover) hover.classList.remove('is-hover');
        if (ev.type === 'pointercancel') return;
        if (!moved) {
          if (fromCat === null) select(selected === soundId ? null : soundId);
          else if (selected) assign(fromCat, selected);
          else remove(fromCat);
          return;
        }
        const t = targetAt(ev.clientX, ev.clientY);
        if (t) assign(Number(t.dataset.cat), soundId);
        else if (fromCat !== null) remove(fromCat);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }

    catEls.forEach((c, i) => {
      c.addEventListener('pointerdown', (e) => {
        const id = pending.has(i) ? pending.get(i) : state.cats[i];
        if (id) startDrag(e, id, i);
      });
      c.addEventListener('click', () => {
        const id = pending.has(i) ? pending.get(i) : state.cats[i];
        if (!id && selected) assign(i, selected);
      });
      c.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const id = pending.has(i) ? pending.get(i) : state.cats[i];
        if (selected) assign(i, selected);
        else if (id) remove(i);
      });
    });
    otter.addEventListener('click', otterFx);
    const onKey = (e) => {
      if (e.key === 'Escape') select(null);
      if (e.key.toLowerCase() === 'o' && !e.target.matches('input, select, textarea') && !e.ctrlKey && !e.metaKey) otterFx();
    };
    window.addEventListener('keydown', onKey);

    /* ---------- Gravação ---------- */
    async function stopRecording() {
      const r = rec;
      rec = null;
      clearInterval(recTimer);
      recBtn.classList.remove('is-active');
      recBtn.querySelector('.btn__text').textContent = 'Gravar';
      renderModes();
      const events = log.stopTake();
      const { blob, seconds } = await r.handle.stop();
      if (r.handle.dispose) r.handle.dispose();
      const title = `${nameInput.value.trim() || name} (${r.type === 'video' ? 'vídeo' : 'áudio'})`;
      return gallery.addBlob(r.type, title, 'beatcats', blob, { seconds, bpm: state.bpm, layers: state.cats.filter(Boolean).length, ...eventsSummary(events) }, events);
    }

    recBtn.addEventListener('click', async () => {
      recBtn.disabled = true;
      try {
        if (rec) {
          const item = await stopRecording();
          toast(`“${item.name}” foi para a Galeria!`, 'ok', 3600);
          dockSay('Que show! A gravação está na Galeria.');
        } else {
          await ensureAudio();
          const type = state.recordMode === 'video' ? 'video' : 'audio';
          const handle = type === 'video' ? createStageRecorder(Tone, masterFilter, stage) : await createOutputRecorder();
          handle.start();
          log.startTake();
          rec = { type, handle };
          const t0 = Date.now();
          timer.textContent = '00:00';
          recTimer = setInterval(() => {
            const s = Math.floor((Date.now() - t0) / 1000);
            timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
          }, 250);
          recBtn.classList.add('is-active');
          recBtn.querySelector('.btn__text').textContent = type === 'video' ? 'Parar (vídeo)' : 'Parar (áudio)';
          renderModes();
          if (!playing && state.cats.some(Boolean)) start();
        }
      } catch (err) {
        toast(`Falhou a gravação: ${err.message}`, 'error');
      } finally {
        recBtn.disabled = false;
      }
    });

    playBtn.addEventListener('click', async () => {
      try {
        if (playing) stop();
        else await start();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    bpmInput.addEventListener('input', () => {
      state.bpm = Number(bpmInput.value);
      log.set({ bpm: state.bpm });
      bpmLabel.textContent = `${state.bpm} BPM`;
      if (Tone) Tone.Transport.bpm.value = state.bpm;
    });

    const clearBtn = el('button', {
      class: 'btn btn--ghost',
      onclick: () => {
        catEls.forEach((_, i) => remove(i));
        select(null);
      }
    }, 'Limpar todos os beats');
    const studioBtn = el('button', {
      class: 'btn btn--ghost',
      title: 'Leva as notas que os gatos tocaram para editar no Studio',
      onclick: () => {
        const json = log.recent();
        if (!json) return toast('Vista um gato e deixe o loop tocar: as notas vão para o Studio.', 'info');
        openInStudio({ ...json, name: nameInput.value.trim() || name });
      }
    }, 'Editar no Studio');

    root.append(
      el(
        'div',
        { class: 'beatcats' },
        el('section', { class: 'panel bc-stage-wrap' }, stage, roundBar),
        el(
          'section',
          { class: 'panel bc-main' },
          el(
            'div',
            { class: 'toolbar' },
            playBtn,
            el('label', { class: 'toolbar__bpm' }, bpmLabel, bpmInput),
            el('div', { class: 'bc-opt' }, el('span', { class: 'field__label' }, 'Modo'), modeTabs),
            el('div', { class: 'bc-opt' }, el('span', { class: 'field__label' }, 'Gravar'), recModeTabs),
            recBtn,
            timer,
            clearBtn,
            studioBtn
          ),
          el('div', { class: 'form-grid form-grid--tight' }, el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Nome do beat'), nameInput), el('div', { class: 'field field--end' }, status))
        ),
        el(
          'section',
          { class: 'panel bc-side' },
          el('div', { class: 'panel__head' }, el('h2', {}, 'Acessórios sonoros'), el('span', { class: 'pill' }, `${SOUNDS.length} sons`)),
          el('p', { class: 'hint' }, 'Arraste um acessório para um gato. Toque na lontra (ou O) para o splash.'),
          palette
        )
      )
    );

    if (params.open) {
      try {
        const { item, json } = await gallery.read(params.open);
        state = beatFromJson(json);
        openedId = item.id;
        name = item.name;
        nameInput.value = name;
        status.textContent = 'Aberto da Galeria — Salvar atualiza este beat';
      } catch (err) {
        toast(`Não abriu o beat: ${err.message}`, 'error');
      }
    } else if (params.demo) {
      try {
        const res = await fetch(new URL('../../data/demo/miau-groove.json', import.meta.url));
        state = beatFromJson(await res.json());
        status.textContent = 'Beat de exemplo';
      } catch (err) {
        toast(`Não abriu o exemplo: ${err.message}`, 'error');
      }
    }
    log.set({ bpm: state.bpm });
    renderAll();
    if (params.play && state.cats.some(Boolean)) start().catch(() => {});

    window.__mmpBeatCats = {
      state: () => ({ cats: [...state.cats], pending: Object.fromEntries(pending), playing, step, mode: state.mode, bpm: state.bpm, voices: voices.map(Boolean), recording: rec ? rec.type : null }),
      sounds: () => SOUNDS.map((s) => ({ id: s.id, group: s.group, outfit: s.outfit })),
      assign,
      remove,
      setMode,
      otter: otterFx,
      events: () => log.recent(),
      ready: () => ensureAudio()
    };

    return {
      async save() {
        const data = { version: 2, kind: 'beatcats', bpm: state.bpm, mode: state.mode, recordMode: state.recordMode, cats: state.cats.map((id, i) => (pending.has(i) ? pending.get(i) : id) || null) };
        const title = nameInput.value.trim() || name;
        const meta = { bpm: state.bpm, layers: data.cats.filter(Boolean).length, mode: state.mode };
        if (openedId) {
          await gallery.updateJson(openedId, data, title);
          return `Beat “${title}” atualizado na Galeria.`;
        }
        const item = await gallery.addJson('beat', title, 'beatcats', data, meta);
        openedId = item.id;
        status.textContent = 'Salvo na Galeria — Salvar de novo atualiza';
        return `Beat “${title}” salvo na Galeria!`;
      },
      unmount() {
        alive = false;
        window.removeEventListener('keydown', onKey);
        if (window.__mmpBeatCats) delete window.__mmpBeatCats;
        singTimers.forEach(clearTimeout);
        if (rec) stopRecording().then((item) => toast(`“${item.name}” salvo na Galeria.`, 'ok')).catch(() => {});
        if (Tone) {
          Tone.Transport.stop();
          Tone.Transport.cancel();
        }
        if (loop) loop.dispose();
        voices.forEach((v) => v && v.dispose());
        setTimeout(() => [master, masterFilter].forEach((n) => n && n.dispose()), 600);
      }
    };
  }
};

