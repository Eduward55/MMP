# /vendor

Bibliotecas de terceiros guardadas localmente — o app as carrega daqui e **nunca** de uma CDN.

| Pasta | O quê | Versão | Licença |
|---|---|---|---|
| `tone/Tone.js` | [Tone.js](https://tonejs.github.io/) (build UMD) | 14.8.49 | MIT |
| `mediapipe/vision_bundle.mjs` | [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe) | 0.10.14 | Apache-2.0 |
| `mediapipe/wasm/` | runtime WebAssembly do MediaPipe (SIMD e sem SIMD) | 0.10.14 | Apache-2.0 |
| `mediapipe/models/hand_landmarker.task` | modelo Hand Landmarker (float16) | v1 | Apache-2.0 |

Para recriar a pasta: `npm run vendor` (copia de `node_modules` e baixa o modelo uma única vez).
