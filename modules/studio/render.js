// Exportações do Studio: WAV (render offline, mais rápido que tempo real) e WebM (canvas + webcam opcional + áudio).
import { INSTRUMENT_BY_ID, createVoice, midiName } from '../shared/instruments.js';
import { themeTokens, hexToRgba } from '../shared/theme.js';
import { audioBufferToWav } from '../shared/wav.js';

const TAIL = 1.6;

export function projectSeconds(project) {
  return (project.length * 60) / project.bpm;
}

// Toca todos os eventos num contexto offline e devolve um Blob WAV.
function trackGain(t) {
  if (!t || t.mute) return 0;
  const n = Number(t.vol);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

export async function renderWav(Tone, project) {
  const spb = 60 / project.bpm;
  const seconds = projectSeconds(project) + TAIL;
  const buffer = await Tone.Offline(() => {
    const out = new Tone.Gain(0.9).toDestination();
    const voices = new Map();
    project.tracks.forEach((t) => {
      const vol = trackGain(t);
      if (vol <= 0) return;
      const g = new Tone.Gain(vol).connect(out);
      voices.set(t.id, createVoice(Tone, t.inst, g));
    });
    project.events.forEach((e) => {
      const v = voices.get(e.track);
      if (v && e.time < project.length) v.play(e.note, e.dur * spb, e.time * spb + 0.02, e.vel);
    });
  }, seconds, 2);
  return { blob: audioBufferToWav(buffer.get()), seconds };
}

function loadImage(svg) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img.decode().then(() => img).catch(() => null);
}

// Grava um vídeo 1280×720 do projeto tocando: notas caindo pela linha do tempo, gato e lontra dançando
// e, se houver, a webcam num quadro. O áudio vem direto do master do Studio.
export async function createVideoRecorder({ Tone, master, project, cam, sprites, getBeat }) {
  const W = 1280;
  const H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const [cat, otter] = await Promise.all(sprites.map(loadImage));
  let camVideo = null;
  if (cam) {
    camVideo = document.createElement('video');
    camVideo.muted = true;
    camVideo.playsInline = true;
    camVideo.srcObject = cam;
    await camVideo.play().catch(() => {});
  }
  const notes = project.events.filter((e) => !(project.tracks.find((t) => t.id === e.track) || {}).mute);
  const lo = Math.min(...notes.map((e) => e.note), 48) - 2;
  const hi = Math.max(...notes.map((e) => e.note), 72) + 2;
  const colorOf = Object.fromEntries(project.tracks.map((t) => [t.id, INSTRUMENT_BY_ID[t.inst].color]));
  const roll = { x: 40, y: 110, w: W - 80, h: 380 };

  function paint() {
    const beat = getBeat();
    const theme = themeTokens();
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = theme.accent;
    ctx.font = `28px ${theme.font}`;
    ctx.textAlign = 'left';
    ctx.fillText(project.name || 'Studio', 40, 62);
    ctx.fillStyle = theme.muted;
    ctx.font = `16px ${theme.font}`;
    ctx.fillText(`${project.bpm} BPM · compasso ${Math.floor(beat / 4) + 1}/${Math.ceil(project.length / 4)}`, 40, 92);

    ctx.fillStyle = theme.surface;
    ctx.fillRect(roll.x, roll.y, roll.w, roll.h);
    ctx.strokeStyle = hexToRgba(theme.accent, 0.35);
    ctx.lineWidth = 1;
    for (let b = 0; b <= project.length; b++) {
      const x = roll.x + (b / project.length) * roll.w;
      ctx.globalAlpha = b % 4 === 0 ? 0.9 : 0.35;
      ctx.beginPath();
      ctx.moveTo(x, roll.y);
      ctx.lineTo(x, roll.y + roll.h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const rh = roll.h / (hi - lo + 1);
    const playing = [];
    notes.forEach((e) => {
      const x = roll.x + (e.time / project.length) * roll.w;
      const w = Math.max(3, (e.dur / project.length) * roll.w);
      const y = roll.y + (hi - e.note) * rh;
      const active = beat >= e.time && beat < e.time + Math.max(e.dur, 0.2);
      ctx.fillStyle = colorOf[e.track] || theme.accent;
      ctx.globalAlpha = active ? 1 : 0.55;
      if (active) playing.push(e);
      ctx.fillRect(x, y, w, Math.max(3, rh - 1));
    });
    ctx.globalAlpha = 1;
    const px = roll.x + (Math.min(beat, project.length) / project.length) * roll.w;
    ctx.fillStyle = theme.text;
    ctx.fillRect(px - 1, roll.y - 6, 3, roll.h + 12);

    const bounce = Math.abs(Math.sin(beat * Math.PI)) * 14;
    if (cat) ctx.drawImage(cat, 40, H - 210 - bounce, 180, 180);
    if (otter) ctx.drawImage(otter, 220, H - 170 - Math.abs(Math.sin((beat + 0.5) * Math.PI)) * 10, 140, 140);
    ctx.fillStyle = theme.text;
    ctx.font = `18px ${theme.font}`;
    ctx.fillText(playing.length ? playing.slice(0, 4).map((e) => midiName(e.note)).join(' ') : '♪', 400, H - 90);

    if (camVideo && camVideo.readyState >= 2) {
      const cw = 360;
      const ch = Math.round((cw * (camVideo.videoHeight || 3)) / (camVideo.videoWidth || 4));
      const cx = W - cw - 40;
      const cy = H - ch - 40;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(cx - 6, cy - 6, cw + 12, ch + 12);
      ctx.save();
      ctx.translate(cx + cw, cy);
      ctx.scale(-1, 1);
      ctx.drawImage(camVideo, 0, 0, cw, ch);
      ctx.restore();
    }
    ctx.fillStyle = theme.hairline;
    ctx.fillRect(0, H - 10, W, 10);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, H - 10, (Math.min(beat, project.length) / project.length) * W, 10);
    ctx.textAlign = 'right';
    ctx.font = `13px ${theme.font}`;
    ctx.fillStyle = hexToRgba(theme.text, 0.7);
    ctx.fillText('My Music Place · Studio', W - 40, 40);
  }

  const dest = Tone.context.createMediaStreamDestination();
  master.connect(dest);
  paint();
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let raf = 0;
  const loop = () => {
    paint();
    raf = requestAnimationFrame(loop);
  };
  const started = performance.now();
  return {
    canvas,
    hasCam: Boolean(camVideo),
    start() {
      mr.start(250);
      loop();
    },
    stop() {
      return new Promise((resolve) => {
        mr.onstop = () => {
          cancelAnimationFrame(raf);
          stream.getTracks().forEach((t) => t.stop());
          try {
            master.disconnect(dest);
          } catch {}
          if (camVideo) camVideo.srcObject = null;
          resolve({ blob: new Blob(chunks, { type: mr.mimeType || 'video/webm' }), seconds: (performance.now() - started) / 1000 });
        };
        mr.stop();
      });
    }
  };
}
