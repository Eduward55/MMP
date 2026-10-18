// Grava "áudio + animação": redesenha o palco num canvas a cada quadro e junta com o áudio do Tone.

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
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#24113f');
  bg.addColorStop(1, '#0d0716');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(155, 92, 255, 0.35)';
  ctx.fillRect(0, h - 18, w, 18);

  stage.querySelectorAll('.bc-cat').forEach((cat) => {
    const r = cat.getBoundingClientRect();
    const x = r.left - s.left;
    const y = r.top - s.top;
    if (cat.classList.contains('is-active')) {
      const color = getComputedStyle(cat).getPropertyValue('--c').trim() || '#ff4fd8';
      const g = ctx.createRadialGradient(x + r.width / 2, y, 4, x + r.width / 2, y + r.height * 0.6, r.width * 0.8);
      g.addColorStop(0, `${color}88`);
      g.addColorStop(1, `${color}00`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r.width * 0.3, y - 10, r.width * 1.6, r.height + 10);
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
    ctx.font = '10px "Press Start 2P", monospace';
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
    ctx.fillStyle = 'rgba(95, 243, 255, 0.16)';
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  }
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(246, 236, 255, 0.7)';
  ctx.fillText('My Music Place · Beat Cats', w - 10, h - 5);
}

export function createStageRecorder(Tone, master, stage) {
  const rect = stage.getBoundingClientRect();
  const scale = Math.min(1.5, 1280 / Math.max(1, rect.width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext('2d');
  const dest = Tone.context.createMediaStreamDestination();
  master.connect(dest);
  paint(ctx, stage, scale);
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let raf = 0;
  const loop = () => {
    paint(ctx, stage, scale);
    raf = requestAnimationFrame(loop);
  };
  const started = performance.now();
  return {
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
          resolve({ blob: new Blob(chunks, { type: mr.mimeType || 'video/webm' }), seconds: (performance.now() - started) / 1000 });
        };
        mr.stop();
      });
    }
  };
}
