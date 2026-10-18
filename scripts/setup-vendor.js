#!/usr/bin/env node
// Recria /vendor a partir de node_modules (Tone.js, MediaPipe tasks-vision + wasm) e baixa o
// modelo do hand landmarker UMA vez. O app nunca busca nada da internet em tempo de execução.
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const V = path.join(ROOT, 'vendor');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`copiado ${path.relative(ROOT, to)}`);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(download(res.headers.location, dest));
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} em ${url}`));
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

(async () => {
  const nm = path.join(ROOT, 'node_modules');
  copy(path.join(nm, 'tone', 'build', 'Tone.js'), path.join(V, 'tone', 'Tone.js'));
  const mp = path.join(nm, '@mediapipe', 'tasks-vision');
  copy(path.join(mp, 'vision_bundle.mjs'), path.join(V, 'mediapipe', 'vision_bundle.mjs'));
  for (const f of fs.readdirSync(path.join(mp, 'wasm'))) copy(path.join(mp, 'wasm', f), path.join(V, 'mediapipe', 'wasm', f));

  const model = path.join(V, 'mediapipe', 'models', 'hand_landmarker.task');
  if (fs.existsSync(model) && fs.statSync(model).size > 1e6) {
    console.log('modelo hand_landmarker.task já existe');
  } else {
    fs.mkdirSync(path.dirname(model), { recursive: true });
    console.log('baixando hand_landmarker.task…');
    await download(MODEL_URL, model);
    console.log(`ok (${(fs.statSync(model).size / 1e6).toFixed(1)} MB)`);
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
