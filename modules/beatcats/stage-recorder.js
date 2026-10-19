// Grava "áudio + animação": canvas.captureStream do palco + áudio do Tone (vp9+opus).
import { pickRecorderMime, VIDEO_RECORDER_MIMES } from '../shared/audio.js';
import { themeTokens, hexToRgba } from '../shared/theme.js';

const imageCache = new Map();

function svgImage(svg) {
  const src = svg.outerHTML;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
    imageCache.set(src, img);
    if (imageCache.size > 300) imageCache.delete(imageCache.keys().next().value);
  }
  return img;
}

function paint(ctx, stage, scale) {
  const s = stage.getBoundingClientRect();
  const w = s.width;
  const h = s.height;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const theme = themeTokens();
  ctx.fillStyle = theme.surface;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = theme.hairline;
  ctx.fillRect(0, h - 2, w, 2);

  stage.querySelectorAll('.bc-cat').forEach((cat) => {
    const r = cat.getBoundingClientRect();
    const x = r.left - s.left;
    const y = r.top - s.top;
    if (cat.classList.contains('is-active')) {
      const color = getComputedStyle(cat).getPropertyValue('--c').trim() || theme.accent;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, r.width - 2, r.height - 2);
    }
  });

  stage.querySelectorAll('svg.creature').forEach((svg) => {
    const r = svg.getBoundingClientRect();
    const img = svgImage(svg);
    if (!img.complete || !img.naturalWidth) return;
    const empty = svg.closest('.bc-cat.is-empty');
    ctx.globalAlpha = empty ? 0.4 : 1;
    const x = r.left - s.left;
    const y = r.top - s.top;
    ctx.drawImage(img, x, y, r.width, r.height);
    if (svg.closest('.is-sing')) {
      const u = r.width / 40;
      ctx.fillStyle = '#3a1d2e';
      ctx.fillRect(x + 19 * u, y + 22 * u, 3 * u, 2 * u);
      ctx.fillStyle = '#ff7fb0';
      ctx.fillRect(x + 20 * u, y + 23 * u, u, u);
    }
    ctx.globalAlpha = 1;
  });

  ctx.textAlign = 'center';
  stage.querySelectorAll('.bc-cat__tag, .bc-otter__name').forEach((tag) => {
    const r = tag.getBoundingClientRect();
    ctx.font = `12px ${theme.font}`;
    ctx.fillStyle = getComputedStyle(tag).color;
    ctx.fillText(tag.textContent, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2 + 4);
  });
  stage.querySelectorAll('.bc-note, .bc-bubble').forEach((n) => {
    const r = n.getBoundingClientRect();
    const cs = getComputedStyle(n);
    ctx.globalAlpha = Number(cs.opacity);
    ctx.fillStyle = cs.color;
    ctx.font = `${parseInt(cs.fontSize, 10) || 24}px monospace`;
    ctx.fillText(n.textContent || 'o', r.left - s.left + r.width / 2, r.top - s.top + r.height * 0.8);
  });
  ctx.globalAlpha = 1;
  if (stage.classList.contains('is-splash')) {
    ctx.fillStyle = hexToRgba(theme.accent, 0.12);
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  }
  ctx.font = `11px ${theme.font}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = hexToRgba(theme.text, 0.7);
  ctx.fillText('My Music Place · Beat Cats', w - 10, h - 5);
}

export function createStageRecorder(Tone, master, stage) {
  const rect = stage.getBoundingClientRect();
  const scale = Math.min(1.5, 1280 / Math.max(1, rect.width || 960));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(((rect.width || 960) * scale) / 2) * 2);
  canvas.height = Math.max(2, Math.round(((rect.height || 360) * scale) / 2) * 2);
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${canvas.width}px`,
    height: `${canvas.height}px`,
    opacity: '0.01',
    pointerEvents: 'none'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  const dest = Tone.context.createMediaStreamDestination();
  master.connect(dest);
  paint(ctx, stage, scale);
  const cap = canvas.captureStream(30);
  const videoTracks = cap.getVideoTracks();
  const audioTracks = dest.stream.getAudioTracks();
  if (!videoTracks.length) {
    canvas.remove();
    try {
      master.disconnect(dest);
    } catch {}
    throw new Error('Não deu para capturar o palco (vídeo).');
  }
  videoTracks.forEach((t) => {
    t.enabled = true;
    if (typeof t.requestFrame === 'function') t.requestFrame();
  });
  const stream = new MediaStream([...videoTracks, ...audioTracks]);
  const mime = pickRecorderMime(VIDEO_RECORDER_MIMES);
  if (!mime) {
    canvas.remove();
    stream.getTracks().forEach((t) => t.stop());
    try {
      master.disconnect(dest);
    } catch {}
    throw new Error('Este aparelho não grava vídeo webm.');
  }
  const mr = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 1200000,
    audioBitsPerSecond: 128000
  });
  const chunks = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let raf = 0;
  let tick = 0;
  const frame = () => {
    paint(ctx, stage, scale);
    videoTracks.forEach((t) => t.requestFrame && t.requestFrame());
  };
  const loop = () => {
    frame();
    raf = requestAnimationFrame(loop);
  };
  const started = performance.now();
  return {
    start() {
      frame();
      mr.start(250);
      loop();
      tick = setInterval(frame, 33);
    },
    stop() {
      return new Promise((resolve) => {
        mr.onstop = () => {
          cancelAnimationFrame(raf);
          clearInterval(tick);
          stream.getTracks().forEach((t) => t.stop());
          cap.getTracks().forEach((t) => t.stop());
          try {
            master.disconnect(dest);
          } catch {}
          canvas.remove();
          resolve({ blob: new Blob(chunks, { type: mime || mr.mimeType || 'video/webm' }), seconds: (performance.now() - started) / 1000 });
        };
        if (mr.state === 'recording') mr.stop();
        else mr.onstop();
      });
    }
  };
}
