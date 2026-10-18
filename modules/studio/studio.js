import { createKit, createOutputRecorder } from '../shared/audio.js';
import { gallery } from '../shared/store.js';
import { el, startAudio, toast, stamp } from '../shared/ui.js';
import { dockSay } from '../shared/companion.js';

const KEYS = [
  ['C4', 'a', false], ['C#4', 'w', true], ['D4', 's', false], ['D#4', 'e', true], ['E4', 'd', false],
  ['F4', 'f', false], ['F#4', 't', true], ['G4', 'g', false], ['G#4', 'y', true], ['A4', 'h', false],
  ['A#4', 'u', true], ['B4', 'j', false], ['C5', 'k', false], ['C#5', 'o', true], ['D5', 'l', false],
  ['D#5', 'p', true], ['E5', 'ç', false]
];

const VOICES = [
  { id: 'triangle', name: 'Fofinho' },
  { id: 'square', name: '8-bit' },
  { id: 'sawtooth', name: 'Neon' },
  { id: 'sine', name: 'Ronron' }
];

function pickMime(kind) {
  const list = kind === 'video' ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['audio/webm;codecs=opus', 'audio/webm'];
  return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

export default {
  id: 'studio',
  title: 'Studio',
  icon: 'studio',
  accent: '#5ff3ff',
  desc: 'Grave teclado, microfone ou câmera e mande para a Galeria.',
  async mount(root) {
    let source = 'keys';
    let kit = null;
    let take = null;
    let recording = null;
    let stream = null;
    const takeUrl = { current: null };

    const tabs = el('div', { class: 'segmented', role: 'tablist' });
    const stage = el('div', { class: 'studio__stage' });
    const recBtn = el('button', { class: 'btn btn--rec btn--lg' }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar'));
    const timer = el('span', { class: 'pill' }, '00:00');
    const takeBox = el('div', { class: 'take' }, el('p', { class: 'muted' }, 'Nenhuma gravação ainda. Aperte Gravar, toque algo e depois Salvar.'));
    const nameInput = el('input', { class: 'input', type: 'text', maxlength: '60', value: `Gravação ${stamp()}`, 'aria-label': 'Nome da gravação' });
    let tickHandle = null;

    function renderTabs() {
      tabs.innerHTML = '';
      [
        ['keys', 'Teclado'],
        ['mic', 'Microfone'],
        ['cam', 'Câmera (vídeo)']
      ].forEach(([id, label]) =>
        tabs.append(
          el('button', {
            class: `segmented__btn ${source === id ? 'is-on' : ''}`,
            disabled: recording ? true : null,
            onclick: () => {
              source = id;
              renderTabs();
              renderStage();
            }
          }, label)
        )
      );
    }

    function stopStream() {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    async function ensureKit() {
      if (!kit) kit = createKit(await startAudio());
      return kit;
    }

    function renderStage() {
      stopStream();
      stage.innerHTML = '';
      if (source === 'keys') {
        const voiceSel = el('select', { class: 'input input--select', 'aria-label': 'Timbre' }, ...VOICES.map((v) => el('option', { value: v.id }, v.name)));
        voiceSel.addEventListener('change', async () => (await ensureKit()).keys.set({ oscillator: { type: voiceSel.value } }));
        const piano = el('div', { class: 'piano', role: 'group', 'aria-label': 'Teclado' });
        KEYS.forEach(([note, key, black]) => {
          const k = el('button', { class: `piano__key ${black ? 'is-black' : ''}`, 'data-note': note, title: `${note} (${key.toUpperCase()})` }, el('span', {}, key.toUpperCase()));
          k.addEventListener('pointerdown', () => playNote(note, k));
          piano.append(k);
        });
        stage.append(el('div', { class: 'toolbar' }, el('span', { class: 'field__label' }, 'Timbre'), voiceSel), piano, el('p', { class: 'hint' }, 'Use o mouse ou as teclas A W S E D F T G Y H U J K.'));
      } else {
        const isCam = source === 'cam';
        const video = el('video', { class: 'studio__video', autoplay: true, muted: true, playsinline: true });
        const msg = el('p', { class: 'muted' }, isCam ? 'Ligando a câmera…' : 'Pedindo acesso ao microfone…');
        stage.append(isCam ? video : el('div', { class: 'mic-meter' }, el('div', { class: 'mic-meter__bar' })), msg);
        navigator.mediaDevices
          .getUserMedia(isCam ? { video: { width: 640, height: 480 }, audio: true } : { audio: true })
          .then((s) => {
            if (source !== (isCam ? 'cam' : 'mic')) return s.getTracks().forEach((t) => t.stop());
            stream = s;
            if (isCam) video.srcObject = s;
            msg.textContent = isCam ? 'Câmera pronta. Aperte Gravar!' : 'Microfone pronto. Aperte Gravar!';
          })
          .catch((err) => {
            msg.className = 'state state--error';
            msg.textContent = `${isCam ? 'Câmera' : 'Microfone'} indisponível (${err.name || err.message}). Você ainda pode gravar pelo Teclado.`;
          });
      }
    }

    async function playNote(note, keyEl) {
      try {
        (await ensureKit()).play.note(note);
        if (keyEl) {
          keyEl.classList.add('is-down');
          setTimeout(() => keyEl.classList.remove('is-down'), 160);
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    const onKey = (e) => {
      if (source !== 'keys' || e.repeat || e.ctrlKey || e.metaKey || e.target.matches('input, select, textarea')) return;
      const hit = KEYS.find(([, key]) => key === e.key.toLowerCase());
      if (hit) playNote(hit[0], stage.querySelector(`[data-note="${hit[0]}"]`));
    };
    window.addEventListener('keydown', onKey);

    async function startRec() {
      if (source === 'keys') {
        await ensureKit();
        const rec = await createOutputRecorder();
        rec.start();
        recording = { kind: 'audio', stop: async () => { const r = await rec.stop(); rec.dispose(); return r; } };
      } else {
        if (!stream) throw new Error('Libere a câmera/microfone primeiro.');
        const kind = source === 'cam' ? 'video' : 'audio';
        const mr = new MediaRecorder(stream, { mimeType: pickMime(kind) || undefined });
        const chunks = [];
        mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        const started = performance.now();
        mr.start(250);
        recording = {
          kind,
          stop: () =>
            new Promise((resolve) => {
              mr.onstop = () => resolve({ blob: new Blob(chunks, { type: mr.mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm') }), seconds: (performance.now() - started) / 1000 });
              mr.stop();
            })
        };
      }
      const t0 = Date.now();
      tickHandle = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }, 250);
      recBtn.classList.add('is-active');
      recBtn.querySelector('.btn__text').textContent = 'Parar';
      renderTabs();
    }

    async function stopRec() {
      clearInterval(tickHandle);
      const kind = recording.kind;
      const result = await recording.stop();
      recording = null;
      take = { ...result, kind };
      recBtn.classList.remove('is-active');
      recBtn.querySelector('.btn__text').textContent = 'Gravar';
      renderTabs();
      if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
      takeUrl.current = URL.createObjectURL(result.blob);
      takeBox.innerHTML = '';
      takeBox.append(
        el(kind === 'video' ? 'video' : 'audio', { src: takeUrl.current, controls: true, class: 'player' }),
        el('p', { class: 'muted' }, `Take de ${result.seconds.toFixed(1)}s pronto. Dê um nome e aperte Salvar.`)
      );
      dockSay('Gravou! Agora é só Salvar.');
    }

    recBtn.addEventListener('click', async () => {
      try {
        if (recording) await stopRec();
        else await startRec();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    root.append(
      el(
        'div',
        { class: 'studio' },
        el('section', { class: 'panel' }, el('div', { class: 'panel__head' }, el('h2', {}, 'Fonte'), tabs), stage),
        el(
          'section',
          { class: 'panel studio__side' },
          el('div', { class: 'toolbar' }, recBtn, timer),
          el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Nome'), nameInput),
          el('h3', { class: 'subhead' }, 'Último take'),
          takeBox
        )
      )
    );
    renderTabs();
    renderStage();

    return {
      async save() {
        if (recording) await stopRec();
        if (!take) throw new Error('Grave algo antes de salvar.');
        const type = take.kind === 'video' ? 'video' : 'audio';
        const title = nameInput.value.trim() || `Gravação ${stamp()}`;
        await gallery.addBlob(type, title, 'studio', take.blob, { seconds: take.seconds });
        take = null;
        nameInput.value = `Gravação ${stamp()}`;
        return `“${title}” foi para a Galeria!`;
      },
      unmount() {
        window.removeEventListener('keydown', onKey);
        clearInterval(tickHandle);
        if (recording) recording.stop().catch(() => {});
        stopStream();
        if (kit) kit.dispose();
        if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
      }
    };
  }
};
