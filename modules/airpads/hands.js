// Detector de mãos local (MediaPipe Tasks Vision em /vendor, nunca de CDN).

const VENDOR = new URL('../../vendor/mediapipe/', import.meta.url).href;
let landmarkerPromise = null;

export function loadHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import(`${VENDOR}vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${VENDOR}wasm`);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: `${VENDOR}models/hand_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
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

/**
 * Converte o resultado do HandLandmarker em pontos na arena (px), já espelhados.
 * O vídeo é exibido com object-fit: cover, então compensamos o recorte.
 * Retorna [{ hand: 0 | 1, x, y, points: [{x, y}] }] — hand 0 = mão esquerda do usuário (círculo da esquerda).
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
    // O MediaPipe assume imagem espelhada; como a entrada é o quadro cru da webcam, o rótulo vem invertido.
    const label = result.handedness && result.handedness[i] && result.handedness[i][0] ? result.handedness[i][0].categoryName : '';
    const hand = label === 'Left' ? 1 : label === 'Right' ? 0 : points[8].x < arenaW / 2 ? 0 : 1;
    return { hand, x: points[8].x, y: points[8].y, points };
  });
  if (hands.length === 2 && hands[0].hand === hands[1].hand) {
    const [a, b] = hands[0].x <= hands[1].x ? [hands[0], hands[1]] : [hands[1], hands[0]];
    a.hand = 0;
    b.hand = 1;
  }
  return hands;
}
