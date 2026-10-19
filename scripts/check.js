#!/usr/bin/env node
// Autoteste ponta a ponta: abre o Electron escondido com dados temporários e roda scripts/selftest-renderer.js.
// Em Linux sem tela: xvfb-run -a npm run check
'use strict';

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const electron = require('electron');

const pre = spawnSync(process.execPath, [path.join(__dirname, 'build-conexoes.mjs')], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit'
});
if (pre.status) process.exit(pre.status || 1);

const wordsFile = path.join(__dirname, '..', 'data', 'cattyping', 'words.json');
let wordsJson;
try {
  wordsJson = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
} catch (err) {
  console.error('Cat Typing: rode npm run cattyping:words para gerar data/cattyping/words.json');
  process.exit(1);
}
if (!Array.isArray(wordsJson.words) || wordsJson.words.length < 5000) {
  console.error(`Cat Typing: words.json tem ${wordsJson.words ? wordsJson.words.length : 0} palavras (precisa 5000+)`);
  process.exit(1);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmp-check-'));
const args = ['.'];
if (process.platform === 'linux') args.push('--no-sandbox', '--disable-gpu');

const child = spawn(electron, args, {
  cwd: path.join(__dirname, '..'),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, MMP_SELFTEST: '1', MMP_DATA_DIR: dataDir }
});
const noise = /bus\.cc|dbus|Fontconfig|viz_main|gpu_init|Security Warning|unsafe-eval|exposes users|security\.|electronjs\.org|consult|will not show|once the app|Policy set|^\s*$/;
const pipe = (stream, out) =>
  stream.on('data', (buf) =>
    String(buf)
      .split('\n')
      .filter((l) => !noise.test(l))
      .forEach((l) => out.write(`${l}\n`))
  );
pipe(child.stdout, process.stdout);
pipe(child.stderr, process.stderr);
child.on('exit', (code) => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(code ?? 1);
});
