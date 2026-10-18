#!/usr/bin/env node
// Abre o app num modo automático, navega pelas rotas e salva PNGs.
// Uso: node scripts/screenshots.js [pasta] [rotas]   ex.: rotas = "hub:hub,mycat:meu-gato,gallery:galeria"
// Em Linux sem tela: xvfb-run -a node scripts/screenshots.js
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const electron = require('electron');

const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out', 'screenshots'));
const pages = process.argv[3] || 'hub:hub,mycat:meu-gato,gallery:galeria';
const dataDir = process.env.MMP_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'mmp-shots-'));

const args = ['.'];
if (process.platform === 'linux') args.push('--no-sandbox', '--disable-gpu');

const child = spawn(electron, args, {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: { ...process.env, MMP_SCREENSHOT_DIR: outDir, MMP_SCREENSHOT_PAGES: pages, MMP_DATA_DIR: dataDir }
});
child.on('exit', (code) => {
  console.log(`Screenshots em ${outDir} (dados temporários: ${dataDir})`);
  process.exit(code || 0);
});
