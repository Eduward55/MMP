// Detector de mãos local (MediaPipe Tasks Vision em /vendor, nunca de CDN).

const VENDOR = new URL('../../vendor/mediapipe/', import.meta.url).href;
const FINGERTIPS = [4, 8, 12, 16, 20];
let landmarkerPromise = null;
const smooth = new Map();

export function loadHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import(`${VENDOR}vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${VENDOR}wasm`);
      const opts = (delegate, extra = true) => ({
        baseOptions: { modelAssetPath: `${VENDOR}models/hand_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.32,
        minTrackingConfidence: 0.32,
        ...(extra ? { minHandPresenceConfidence: 0.35 } : {})
      });
      const make = async (delegate) => {
        try {
          return await vision.HandLandmarker.createFromOptions(fileset, opts(delegate, true));
        } catch {
          return vision.HandLandmarker.createFromOptions(fileset, opts(delegate, false));
        }
      };
      try {
        return await make('GPU');
      } catch {
        return make('CPU');
      }
    })();
    landmarkerPromise.catch(() => (landmarkerPromise = null));
  }
  return landmarkerPromise;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Converte o resultado do HandLandmarker em pontos na arena (px), já espelhados.
 * Inclui a ponta do indicador e as outras pontas dos dedos (para tocar o pad com qualquer dedo).
 * Retorna [{ hand: 0 | 1, x, y, tips: [{x,y}], points: [{x, y}] }]
 */
export function mapHands(result, video, arenaW, arenaH) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const scale = Math.max(arenaW / vw, arenaH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const ox = (arenaW - dw) / 2;
  const oy = (arenaH - dh) / 2;
  const toPx = (p) => ({ x: ox + (1 - p.x) * dw, y: oy + p.y * dh });

  const hands = (result.landmarks || []).map((lm, i) => {
    const points = lm.map(toPx);
    const tips = FINGERTIPS.map((idx) => points[idx]).filter(Boolean);
    const index = points[8] || tips[0] || points[0];
    const label = result.handedness && result.handedness[i] && result.handedness[i][0] ? result.handedness[i][0].categoryName : '';
    const score = result.handedness && result.handedness[i] && result.handedness[i][0] ? result.handedness[i][0].score : 0;
    const hand = label === 'Right' ? 1 : label === 'Left' ? 0 : index.x < arenaW / 2 ? 0 : 1;
    return { hand, x: index.x, y: index.y, tips, points, score };
  });
  if (hands.length === 2 && hands[0].hand === hands[1].hand) {
    const [a, b] = hands[0].x <= hands[1].x ? [hands[0], hands[1]] : [hands[1], hands[0]];
    a.hand = 0;
    b.hand = 1;
  }

  const seen = new Set();
  const out = hands.map((h) => {
    const prev = smooth.get(h.hand);
    const t = prev ? 0.42 : 1;
    const x = prev ? lerp(prev.x, h.x, t) : h.x;
    const y = prev ? lerp(prev.y, h.y, t) : h.y;
    const tips = (h.tips || []).map((p, i) => {
      const q = prev && prev.tips && prev.tips[i];
      return q ? { x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t) } : p;
    });
    const next = { ...h, x, y, tips };
    smooth.set(h.hand, next);
    seen.add(h.hand);
    return next;
  });
  for (const k of [...smooth.keys()]) if (!seen.has(k)) smooth.delete(k);
  return out;
}

export function resetHandSmooth() {
  smooth.clear();
}
