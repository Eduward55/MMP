// Detector de mãos local (MediaPipe Tasks Vision em /vendor, nunca de CDN).

const VENDOR = new URL('../../vendor/mediapipe/', import.meta.url).href;
const FINGERTIPS = [4, 8, 12, 16, 20];
const PALM = [0, 5, 9, 13, 17];
export const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17]
];
let landmarkerPromise = null;
const smooth = new Map();
const HOLD_FRAMES = 10;

export function loadHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import(`${VENDOR}vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${VENDOR}wasm`);
      const opts = (delegate, extra = true) => ({
        baseOptions: { modelAssetPath: `${VENDOR}models/hand_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.18,
        minTrackingConfidence: 0.18,
        ...(extra ? { minHandPresenceConfidence: 0.18 } : {})
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

function videoBox(video, arenaW, arenaH) {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  if (!vw || !vh || !arenaW || !arenaH) {
    return { vw, vh, dw: arenaW, dh: arenaH, ox: 0, oy: 0 };
  }
  const fit = (typeof getComputedStyle === 'function' && video ? getComputedStyle(video).objectFit : '') || 'cover';
  const scale = fit === 'contain' ? Math.min(arenaW / vw, arenaH / vh) : Math.max(arenaW / vw, arenaH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  return { vw, vh, dw, dh, ox: (arenaW - dw) / 2, oy: (arenaH - dh) / 2 };
}

function handednessOf(result, i) {
  const pack = (result.handednesses || result.handedness || [])[i];
  const cat = pack && pack[0];
  return {
    label: cat && cat.categoryName ? cat.categoryName : '',
    score: cat && Number.isFinite(cat.score) ? cat.score : 0
  };
}

/**
 * Converte o resultado do HandLandmarker em pontos na arena (px), já espelhados
 * para coincidir com o vídeo em object-fit + scaleX(-1).
 * Inclui palma, pulso e todas as pontas — qualquer parte da mão toca o pad.
 * Retorna [{ hand: 0 | 1, x, y, tips: [{x,y}], points: [{x, y}] }]
 */
export function mapHands(result, video, arenaW, arenaH) {
  const { dw, dh, ox, oy } = videoBox(video, arenaW, arenaH);
  const toPx = (p) => ({ x: ox + (1 - p.x) * dw, y: oy + p.y * dh });

  const hands = (result.landmarks || []).map((lm, i) => {
    const points = lm.map(toPx);
    const tips = [
      ...FINGERTIPS.map((idx) => points[idx]).filter(Boolean),
      ...PALM.map((idx) => points[idx]).filter(Boolean)
    ];
    if (points.length >= 18) {
      const palm = PALM.map((idx) => points[idx]).filter(Boolean);
      if (palm.length) {
        tips.push({
          x: palm.reduce((s, p) => s + p.x, 0) / palm.length,
          y: palm.reduce((s, p) => s + p.y, 0) / palm.length
        });
      }
    }
    const index = points[8] || tips[0] || points[0];
    const { label, score } = handednessOf(result, i);
    const hand = label === 'Right' ? 1 : label === 'Left' ? 0 : index.x < arenaW / 2 ? 0 : 1;
    return { hand, x: index.x, y: index.y, tips, points, score, miss: 0 };
  });
  if (hands.length === 2 && hands[0].hand === hands[1].hand) {
    const [a, b] = hands[0].x <= hands[1].x ? [hands[0], hands[1]] : [hands[1], hands[0]];
    a.hand = 0;
    b.hand = 1;
  }

  const seen = new Set();
  const out = hands.map((h) => {
    const prev = smooth.get(h.hand);
    const t = prev ? 0.68 : 1;
    const x = prev ? lerp(prev.x, h.x, t) : h.x;
    const y = prev ? lerp(prev.y, h.y, t) : h.y;
    const tips = (h.tips || []).map((p, i) => {
      const q = prev && prev.tips && prev.tips[i];
      return q ? { x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t) } : p;
    });
    const points = (h.points || []).map((p, i) => {
      const q = prev && prev.points && prev.points[i];
      return q ? { x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t) } : p;
    });
    const next = { ...h, x, y, tips, points, miss: 0 };
    smooth.set(h.hand, next);
    seen.add(h.hand);
    return next;
  });
  for (const k of [...smooth.keys()]) {
    if (seen.has(k)) continue;
    const prev = smooth.get(k);
    prev.miss = (prev.miss || 0) + 1;
    if (prev.miss > HOLD_FRAMES) smooth.delete(k);
    else out.push(prev);
  }
  return out;
}

export function resetHandSmooth() {
  smooth.clear();
}
