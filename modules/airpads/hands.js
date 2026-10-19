// Detector de mãos local (MediaPipe Tasks Vision em /vendor, nunca de CDN).

const VENDOR = new URL('../../vendor/mediapipe/', import.meta.url).href;
const FINGERTIPS = [4, 8, 12, 16, 20];
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
const HOLD_FRAMES = 3;
const SMOOTH = 0.88;

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

function arenaBox(arenaW, arenaH) {
  if (arenaW && typeof arenaW === 'object') {
    return { w: arenaW.clientWidth || 0, h: arenaW.clientHeight || 0, el: arenaW };
  }
  return { w: arenaW || 0, h: arenaH || 0, el: null };
}

function videoBox(video, arenaW, arenaH) {
  const { w: boxW, h: boxH } = arenaBox(arenaW, arenaH);
  const vw = (video && video.videoWidth) || 640;
  const vh = (video && video.videoHeight) || 480;
  const elW = (video && video.clientWidth) || boxW;
  const elH = (video && video.clientHeight) || boxH;
  if (!vw || !vh || !elW || !elH) {
    return { vw, vh, dw: elW || boxW, dh: elH || boxH, ox: 0, oy: 0 };
  }
  let fit = 'contain';
  if (typeof getComputedStyle === 'function' && video) {
    const cs = getComputedStyle(video).objectFit;
    if (cs) fit = cs;
  }
  const scale = fit === 'contain' || fit === 'scale-down' ? Math.min(elW / vw, elH / vh) : Math.max(elW / vw, elH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const baseX = video && Number.isFinite(video.offsetLeft) ? video.offsetLeft : 0;
  const baseY = video && Number.isFinite(video.offsetTop) ? video.offsetTop : 0;
  return { vw, vh, dw, dh, ox: baseX + (elW - dw) / 2, oy: baseY + (elH - dh) / 2 };
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
 * para coincidir com o vídeo em object-fit:contain + scaleX(-1).
 * Pontas dos dedos tocam o pad; a palma só entra no esqueleto desenhado.
 * Retorna [{ hand: 0 | 1, x, y, tips: [{x,y}], points: [{x, y}] }]
 */
export function mapHands(result, video, arenaW, arenaH) {
  const { w: width } = arenaBox(arenaW, arenaH);
  const { dw, dh, ox, oy } = videoBox(video, arenaW, arenaH);
  // CSS scaleX(-1) on the video: mirror x so the skeleton sits on the selfie image.
  const toPx = (p) => ({ x: ox + (1 - p.x) * dw, y: oy + p.y * dh });

  const hands = (result.landmarks || []).map((lm, i) => {
    const points = lm.map(toPx);
    // Only fingertips hit the pad. Palm points sit closer to the center and stole
    // the "nearest to center" race, so the bead lagged behind the actual finger.
    const tips = FINGERTIPS.map((idx) => points[idx]).filter(Boolean);
    const index = points[8] || tips[0] || points[0];
    const { label, score } = handednessOf(result, i);
    const hand = label === 'Right' ? 1 : label === 'Left' ? 0 : index.x < width / 2 ? 0 : 1;
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
    const t = prev ? SMOOTH : 1;
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
