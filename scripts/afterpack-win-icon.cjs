'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const script = path.join(__dirname, 'win-embed-icon.mjs');
  const r = spawnSync(process.execPath, [script, exe], { stdio: 'inherit' });
  if (r.status) throw new Error(`win-embed-icon falhou (${r.status})`);
};
