// Lontrinhas no Cantar: MediaRecorder no mesmo mic + Tone.Player em loop.
// Independente do grafo de FX e do Tone.Transport (as três tocam em paralelo).

export const OTTER_REC_MIN = 1;
export const OTTER_REC_MAX = 8;
export const OTTER_INTERVAL_MIN = 1;
export const OTTER_INTERVAL_MAX = 16;

export function clampOtterSeconds(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const snapped = Math.round(n * 2) / 2;
  return Math.min(max, Math.max(min, snapped));
}

export function formatOtterSeconds(v) {
  const n = Math.round(Number(v) * 10) / 10;
  if (!Number.isFinite(n)) return '—';
  const s = Number.isInteger(n) ? String(n) : String(n);
  return `${s} s`;
}

export function pickAudioRecorderMime() {
  const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

function nativeCtx(Tone) {
  const c = Tone && Tone.getContext && Tone.getContext();
  return (c && (c.rawContext || c._context)) || (Tone && Tone.context) || null;
}

export function padAudioBuffer(ctx, buffer, intervalSec) {
  if (!ctx || !buffer) return buffer;
  const sr = buffer.sampleRate;
  const want = Math.max(buffer.length, Math.round(Math.max(intervalSec, buffer.duration) * sr));
  if (want <= buffer.length + 16) return buffer;
  const out = ctx.createBuffer(buffer.numberOfChannels, want, sr);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.getChannelData(c).set(buffer.getChannelData(c));
  }
  return out;
}

export function makeBeepBuffer(ctx, { seconds = 0.25, freq = 440, gain = 0.2 } = {}) {
  const sr = ctx.sampleRate;
  const len = Math.max(64, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const fade = Math.min(64, Math.floor(len / 8));
  for (let i = 0; i < len; i++) {
    const env = i < fade ? i / fade : i > len - fade ? (len - i) / fade : 1;
    data[i] = Math.sin((2 * Math.PI * freq * i) / sr) * gain * env;
  }
  return buf;
}

export async function decodePhraseBlob(Tone, blob) {
  const ctx = nativeCtx(Tone);
  if (!ctx || !blob) throw new Error('Áudio ainda não está pronto.');
  const arr = await blob.arrayBuffer();
  try {
    return await ctx.decodeAudioData(arr.slice(0));
  } catch {
    return await ctx.decodeAudioData(arr);
  }
}

/**
 * Grava o MediaStream do Cantar sem parar as tracks originais (voz ao vivo segue).
 * @returns {{ stop: () => Promise<{blob: Blob, seconds: number}>, done: Promise<{blob: Blob, seconds: number}> }}
 */
export function recordPhraseFromStream(stream, seconds, { onTick } = {}) {
  if (!stream) return failRec('Microfone desligado.');
  if (typeof MediaRecorder === 'undefined') return failRec('Este navegador não grava áudio.');

  const recStream = typeof stream.clone === 'function' ? stream.clone() : stream;
  const mime = pickAudioRecorderMime();
  let mr;
  try {
    mr = mime ? new MediaRecorder(recStream, { mimeType: mime }) : new MediaRecorder(recStream);
  } catch (err) {
    stopClone(recStream, stream);
    return failRec(err.message || 'Não deu para abrir o gravador.');
  }

  const chunks = [];
  mr.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  let tickTimer = 0;
  let stopped = false;
  const t0 = performance.now();
  const total = Math.max(0.4, Number(seconds) || 2) * 1000;

  const blobP = new Promise((resolve, reject) => {
    mr.onstop = () => {
      stopClone(recStream, stream);
      resolve({ blob: new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' }), seconds: (performance.now() - t0) / 1000 });
    };
    mr.onerror = () => {
      stopClone(recStream, stream);
      reject(mr.error || new Error('Não deu para gravar a frase.'));
    };
  });

  const stop = () => {
    if (!stopped) {
      stopped = true;
      clearTimeout(tickTimer);
      if (mr.state === 'recording') {
        try {
          mr.requestData();
        } catch {}
        try {
          mr.stop();
        } catch {}
      }
    }
    return blobP;
  };

  try {
    mr.start(50);
  } catch (err) {
    stopClone(recStream, stream);
    return failRec(err.message || 'Não deu para começar a gravação.');
  }

  const tick = () => {
    if (stopped) return;
    const elapsed = performance.now() - t0;
    const left = Math.max(0, total - elapsed);
    if (onTick) onTick(left / 1000, elapsed / 1000);
    if (left <= 0) {
      stop();
      return;
    }
    tickTimer = setTimeout(tick, 70);
  };
  tick();

  return { stop, done: blobP };
}

function failRec(message) {
  const err = new Error(message);
  const done = Promise.reject(err);
  done.catch(() => {});
  return {
    stop: () => done,
    done
  };
}

function stopClone(recStream, original) {
  if (!recStream || recStream === original) return;
  recStream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {}
  });
}

/**
 * Tone.Player em loop de parede, sem .sync() / Transport.
 * Se o intervalo for maior que o clipe, preenche silêncio; se for menor, corta no loopEnd.
 */
export async function startOtterLoopPlayer(Tone, buffer, dest, intervalSec) {
  const ctx = nativeCtx(Tone);
  const clipDuration = buffer.duration;
  const interval = clampOtterSeconds(intervalSec, 0.5, OTTER_INTERVAL_MAX, Math.max(1, clipDuration));
  const url = interval > clipDuration + 0.04 ? padAudioBuffer(ctx, buffer, interval) : buffer;
  const player = new Tone.Player({ url, loop: true, fadeIn: 0.008, fadeOut: 0.02 }).connect(dest);
  if (interval + 0.04 < clipDuration) player.loopEnd = interval;
  try {
    await Promise.race([player.loaded, new Promise((r) => setTimeout(r, 80))]);
  } catch {}
  player.start();
  const startedAt = performance.now();
  return {
    player,
    interval,
    clipDuration,
    startedAt,
    singingAt(now = performance.now()) {
      const cycle = this.interval * 1000;
      if (cycle <= 0) return false;
      const t = (now - this.startedAt) % cycle;
      return t < this.clipDuration * 1000 - 20;
    },
    dispose() {
      try {
        player.stop();
      } catch {}
      try {
        player.dispose();
      } catch {}
    }
  };
}
