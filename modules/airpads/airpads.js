// Air Pads: toque pads no ar com a ponta do dedo indicador (MediaPipe Hand Landmarker, 100% local).
import { createKit, createOutputRecorder } from '../shared/audio.js';
import { gallery } from '../shared/store.js';
import { el, startAudio, toast, stamp } from '../shared/ui.js';
import { dockSay } from '../shared/companion.js';

const VENDOR = new URL('../../vendor/mediapipe/', import.meta.url).href;

const PADS = [
  { label: 'Bumbo', key: '1', color: '#ff4fd8', play: (k) => k.play.kick() },
  { label: 'Caixa', key: '2', color: '#9b5cff', play: (k) => k.play.snare() },
  { label: 'Chimbal', key: '3', color: '#5ff3ff', play: (k) => k.play.hat() },
  { label: 'Miau', key: '4', color: '#ffd23f', play: (k) => k.play.meow() },
  { label: 'Dó', key: '5', color: '#5dff9b', play: (k) => k.play.note('C4') },
  { label: 'Mi', key: '6', color: '#ff8fd0', play: (k) => k.play.note('E4') },
  { label: 'Sol', key: '7', color: '#b07cff', play: (k) => k.play.note('G4') },
  { label: 'Dó+', key: '8', color: '#ff7a3d', play: (k) => k.play.note('C5') }
];

let landmarkerPromise = null;

async function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import(`${VENDOR}vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${VENDOR}wasm`);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: `${VENDOR}models/hand_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numHands: 2
      });
      try {
        return await vision.HandLandmarker.createFromOptions(fileset, opts('GPU'));
      } catch {
        return vision.HandLandmarker.createFromOptions(fileset, opts('CPU'));
      }
    })();
    landmarkerPromise.catch(() => (landmarkerPromise = null));
  }
  return landmarkerPromise;
}

export default {
  id: 'airpads',
  title: 'Air Pads',
  icon: 'airpads',
  accent: '#9b5cff',
  desc: 'Toque pads no ar com a mão pela câmera — ou com mouse e teclado.',
  async mount(root) {
    let kit = null;
    let stream = null;
    let raf = 0;
    let rec = null;
    let take = null;
    let alive = true;
    const inside = new Set();

    const video = el('video', { class: 'air__video', autoplay: true, muted: true, playsinline: true });
    const canvas = el('canvas', { class: 'air__overlay' });
    const pads = el('div', { class: 'air__pads' });
    const camBtn = el('button', { class: 'btn btn--primary' }, 'Ativar câmera');
    const recBtn = el('button', { class: 'btn btn--rec' }, el('span', { class: 'rec-dot' }), el('span', { class: 'btn__text' }, 'Gravar'));
    const status = el('p', { class: 'muted air__status' }, 'Sem câmera: toque os pads com o mouse ou nas teclas 1 a 8.');

    const padEls = PADS.map((p, i) => {
      const b = el('button', { class: 'pad', style: `--c:${p.color}`, 'aria-label': p.label }, el('span', { class: 'pad__label' }, p.label), el('span', { class: 'pad__key' }, p.key));
      b.addEventListener('pointerdown', () => hit(i));
      pads.append(b);
      return b;
    });

    async function hit(i) {
      try {
        if (!kit) kit = createKit(await startAudio());
        PADS[i].play(kit);
        const b = padEls[i];
        b.classList.remove('is-hit');
        void b.offsetWidth;
        b.classList.add('is-hit');
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    const onKey = (e) => {
      if (e.repeat || e.target.matches('input, textarea')) return;
      const i = PADS.findIndex((p) => p.key === e.key);
      if (i >= 0) hit(i);
    };
    window.addEventListener('keydown', onKey);

    async function enableCamera() {
      camBtn.disabled = true;
      status.textContent = 'Carregando o detector de mãos local (MediaPipe)…';
      try {
        const [landmarker, s] = await Promise.all([loadLandmarker(), navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })]);
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        video.srcObject = s;
        await video.play();
        root.querySelector('.air').classList.add('has-camera');
        status.textContent = 'Mostre a mão! Encoste a ponta do indicador num pad.';
        camBtn.textContent = 'Câmera ligada';
        loop(landmarker);
      } catch (err) {
        console.error(err);
        camBtn.disabled = false;
        status.textContent = `Câmera indisponível (${err.name || err.message}). Use o mouse ou as teclas 1–8.`;
      }
    }

    function loop(landmarker) {
      const ctx = canvas.getContext('2d');
      let last = -1;
      const step = () => {
        if (!alive || !stream) return;
        raf = requestAnimationFrame(step);
        if (video.readyState < 2 || video.currentTime === last) return;
        last = video.currentTime;
        const res = landmarker.detectForVideo(video, performance.now());
        const rect = pads.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const now = new Set();
        (res.landmarks || []).forEach((hand) => {
          hand.forEach((pt, idx) => {
            const x = (1 - pt.x) * canvas.width;
            const y = pt.y * canvas.height;
            ctx.fillStyle = idx === 8 ? '#ffd23f' : 'rgba(255,79,216,0.7)';
            const s = idx === 8 ? 10 : 5;
            ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
          });
          const tip = hand[8];
          const px = (1 - tip.x) * rect.width + rect.left;
          const py = tip.y * rect.height + rect.top;
          padEls.forEach((b, i) => {
            const r = b.getBoundingClientRect();
            if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
              now.add(i);
              if (!inside.has(i)) hit(i);
            }
          });
        });
        inside.clear();
        now.forEach((i) => inside.add(i));
      };
      step();
    }

    camBtn.addEventListener('click', enableCamera);
    recBtn.addEventListener('click', async () => {
      try {
        if (rec) {
          take = await rec.stop();
          rec.dispose();
          rec = null;
          recBtn.classList.remove('is-active');
          recBtn.querySelector('.btn__text').textContent = 'Gravar';
          toast(`Take de ${take.seconds.toFixed(1)}s pronto. Aperte Salvar.`, 'ok');
          dockSay('Que performance! Salve na Galeria.');
        } else {
          if (!kit) kit = createKit(await startAudio());
          rec = await createOutputRecorder();
          rec.start();
          recBtn.classList.add('is-active');
          recBtn.querySelector('.btn__text').textContent = 'Parar';
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    root.append(
      el(
        'section',
        { class: 'panel air' },
        el('div', { class: 'toolbar' }, camBtn, recBtn, status),
        el('div', { class: 'air__arena' }, video, pads, canvas)
      )
    );

    return {
      async save() {
        if (rec) {
          take = await rec.stop();
          rec.dispose();
          rec = null;
        }
        if (!take) throw new Error('Aperte Gravar, toque os pads e depois Salvar.');
        const title = `Air Pads ${stamp()}`;
        await gallery.addBlob('audio', title, 'airpads', take.blob, { seconds: take.seconds });
        take = null;
        recBtn.classList.remove('is-active');
        recBtn.querySelector('.btn__text').textContent = 'Gravar';
        return `“${title}” salvo na Galeria!`;
      },
      unmount() {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (rec) rec.stop().then(() => rec.dispose()).catch(() => {});
        if (kit) kit.dispose();
      }
    };
  }
};
