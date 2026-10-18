import { createKit, createOutputRecorder } from '../shared/audio.js';
import { creatureSVG } from '../shared/creatures.js';
import { gallery } from '../shared/store.js';
import { el, startAudio, toast, stamp } from '../shared/ui.js';
import { dockSay } from '../shared/companion.js';

const STEPS = 16;
const TRACKS = [
  { id: 'kick', name: 'Bumbo', coat: 'orange', eyes: '#ffc23f' },
  { id: 'snare', name: 'Caixa', coat: 'black', eyes: '#5dff9b' },
  { id: 'hat', name: 'Chimbal', coat: 'white', eyes: '#5ff3ff' },
  { id: 'meow', name: 'Miau', coat: 'tuxedo', eyes: '#ff4fd8' }
];

function emptyPattern() {
  return Object.fromEntries(TRACKS.map((t) => [t.id, new Array(STEPS).fill(0)]));
}

export default {
  id: 'beatcats',
  title: 'Beat Cats',
  icon: 'beatcats',
  accent: '#ff4fd8',
  desc: 'Sequenciador de 16 passos com uma banda de gatos.',
  async mount(root, { params }) {
    let pattern = emptyPattern();
    let bpm = 100;
    let openedId = null;
    let name = `Beat ${stamp()}`;
    let playing = false;
    let kit = null;
    let seq = null;
    let Tone = null;

    const nameInput = el('input', { class: 'input', type: 'text', maxlength: '60', value: name, 'aria-label': 'Nome do beat' });
    const bpmInput = el('input', { type: 'range', min: '60', max: '180', value: String(bpm), class: 'range', 'aria-label': 'BPM' });
    const bpmLabel = el('span', { class: 'pill' }, `${bpm} BPM`);
    const playBtn = el('button', { class: 'btn btn--primary btn--lg' }, 'Tocar');
    const recBtn = el('button', { class: 'btn btn--ghost' }, 'Gravar 2 compassos em áudio');
    const grid = el('div', { class: 'seq', role: 'grid', 'aria-label': 'Sequenciador' });
    const cells = {};
    const cats = {};

    TRACKS.forEach((t) => {
      const cat = el('div', { class: 'seq__cat', html: creatureSVG('cat', { coat: t.coat, eyes: t.eyes, outfit: t.id === 'meow' ? { neck: 'gravata' } : t.id === 'hat' ? { head: 'fone' } : {} }, { size: 54, label: t.name }) });
      cats[t.id] = cat;
      const row = el('div', { class: 'seq__row', role: 'row' }, el('button', { class: 'seq__label', title: `Ouvir ${t.name}`, onclick: () => preview(t.id) }, cat, el('span', {}, t.name)));
      cells[t.id] = [];
      for (let s = 0; s < STEPS; s++) {
        const c = el('button', {
          class: `seq__cell ${s % 4 === 0 ? 'is-beat' : ''} ${Math.floor(s / 4) % 2 ? 'is-alt' : ''}`,
          role: 'gridcell',
          'aria-label': `${t.name} passo ${s + 1}`,
          onclick: () => {
            pattern[t.id][s] = pattern[t.id][s] ? 0 : 1;
            paint();
            if (pattern[t.id][s] && !playing) preview(t.id);
          }
        });
        cells[t.id].push(c);
        row.append(c);
      }
      grid.append(row);
    });

    function paint() {
      TRACKS.forEach((t) => cells[t.id].forEach((c, s) => c.classList.toggle('is-on', Boolean(pattern[t.id][s]))));
    }

    function bounce(id) {
      const c = cats[id];
      c.classList.remove('is-hit');
      void c.offsetWidth;
      c.classList.add('is-hit');
    }

    async function ensureAudio() {
      if (kit) return;
      Tone = await startAudio();
      kit = createKit(Tone);
      Tone.Transport.bpm.value = bpm;
      seq = new Tone.Sequence(
        (time, step) => {
          TRACKS.forEach((t) => {
            if (pattern[t.id][step]) kit.play[t.id](time);
          });
          Tone.Draw.schedule(() => {
            grid.querySelectorAll('.is-playhead').forEach((n) => n.classList.remove('is-playhead'));
            TRACKS.forEach((t) => {
              cells[t.id][step].classList.add('is-playhead');
              if (pattern[t.id][step]) bounce(t.id);
            });
          }, time);
        },
        [...Array(STEPS).keys()],
        '16n'
      ).start(0);
    }

    async function preview(id) {
      try {
        await ensureAudio();
        kit.play[id](Tone.now());
        bounce(id);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function togglePlay() {
      try {
        await ensureAudio();
        if (playing) {
          Tone.Transport.stop();
          grid.querySelectorAll('.is-playhead').forEach((n) => n.classList.remove('is-playhead'));
        } else {
          Tone.Transport.start('+0.05');
        }
        playing = !playing;
        playBtn.textContent = playing ? 'Parar' : 'Tocar';
        playBtn.classList.toggle('is-active', playing);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function recordLoop() {
      try {
        await ensureAudio();
        if (playing) await togglePlay();
        recBtn.disabled = true;
        recBtn.textContent = 'Gravando…';
        const rec = await createOutputRecorder();
        rec.start();
        Tone.Transport.position = 0;
        await togglePlay();
        const ms = ((60 / bpm) * 4 * 2 + 0.4) * 1000;
        await new Promise((r) => setTimeout(r, ms));
        await togglePlay();
        const { blob, seconds } = await rec.stop();
        rec.dispose();
        await gallery.addBlob('audio', `${nameInput.value || name} (áudio)`, 'beatcats', blob, { seconds, bpm });
        toast('Loop gravado na Galeria como áudio!', 'ok');
        dockSay('Que groove! Seu loop foi pra Galeria.');
      } catch (err) {
        toast(`Falhou a gravação: ${err.message}`, 'error');
      } finally {
        recBtn.disabled = false;
        recBtn.textContent = 'Gravar 2 compassos em áudio';
      }
    }

    function randomize() {
      pattern = emptyPattern();
      for (let s = 0; s < STEPS; s++) {
        if (s % 4 === 0 || Math.random() < 0.12) pattern.kick[s] = 1;
        if (s % 8 === 4 || Math.random() < 0.06) pattern.snare[s] = 1;
        if (s % 2 === 0 || Math.random() < 0.2) pattern.hat[s] = 1;
        if (Math.random() < 0.08) pattern.meow[s] = 1;
      }
      paint();
    }

    bpmInput.addEventListener('input', () => {
      bpm = Number(bpmInput.value);
      bpmLabel.textContent = `${bpm} BPM`;
      if (Tone) Tone.Transport.bpm.value = bpm;
    });
    playBtn.addEventListener('click', togglePlay);
    recBtn.addEventListener('click', recordLoop);

    const status = el('span', { class: 'muted' }, 'Novo beat');

    root.append(
      el(
        'section',
        { class: 'panel beatcats' },
        el(
          'div',
          { class: 'toolbar' },
          playBtn,
          el('label', { class: 'toolbar__bpm' }, bpmLabel, bpmInput),
          el('button', { class: 'btn btn--ghost', onclick: randomize }, 'Aleatório'),
          el('button', {
            class: 'btn btn--ghost',
            onclick: () => {
              pattern = emptyPattern();
              paint();
            }
          }, 'Limpar'),
          recBtn
        ),
        el('div', { class: 'form-grid form-grid--tight' }, el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Nome do beat'), nameInput), el('div', { class: 'field field--end' }, status)),
        el('div', { class: 'seq-wrap' }, grid),
        el('p', { class: 'hint' }, 'Clique nos quadradinhos para ligar os passos. Clique num gato para ouvir o som dele. Salvar guarda o beat na Galeria.')
      )
    );

    if (params.open) {
      try {
        const { item, json } = await gallery.read(params.open);
        pattern = { ...emptyPattern(), ...(json.tracks || {}) };
        bpm = json.bpm || 100;
        bpmInput.value = String(bpm);
        bpmLabel.textContent = `${bpm} BPM`;
        openedId = item.id;
        name = item.name;
        nameInput.value = name;
        status.textContent = 'Aberto da Galeria — Salvar atualiza este beat';
      } catch (err) {
        toast(`Não abriu o beat: ${err.message}`, 'error');
      }
    } else {
      pattern.kick = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
      pattern.hat = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    }
    paint();

    return {
      async save() {
        const data = { version: 1, bpm, steps: STEPS, tracks: pattern };
        const title = nameInput.value.trim() || name;
        const meta = { bpm, steps: STEPS };
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
        if (Tone) {
          Tone.Transport.stop();
          Tone.Transport.cancel();
        }
        if (seq) seq.dispose();
        if (kit) kit.dispose();
      }
    };
  }
};
