#!/usr/bin/env node
// Grava build/icon.ico (gato Stitch) no .exe Windows sem wine/rcedit.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { NtExecutable, NtExecutableResource, Resource, Data } = require('resedit');

const exePath = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'win-unpacked', 'My Music Place.exe'));
const icoPath = path.resolve(process.argv[3] || path.join(ROOT, 'build', 'icon.ico'));

if (!fs.existsSync(exePath)) {
  console.error(`exe não encontrado: ${exePath}`);
  process.exit(1);
}
if (!fs.existsSync(icoPath)) {
  console.error(`ico não encontrado: ${icoPath}`);
  process.exit(1);
}

const exeBuf = fs.readFileSync(exePath);
const icoBuf = fs.readFileSync(icoPath);
const exe = NtExecutable.from(exeBuf, { ignoreCert: true });
const res = NtExecutableResource.from(exe);
const iconFile = Data.IconFile.from(Uint8Array.from(icoBuf));
const existing = Resource.IconGroupEntry.fromEntries(res.entries);
const groupId = existing[0] ? existing[0].id : 1;
const lang = existing[0] ? existing[0].lang : 1033;
Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  groupId,
  lang,
  iconFile.icons.map((item) => item.data)
);
res.outputResource(exe, true);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log(`ícone do gato gravado em ${exePath} (grupo ${groupId}, ${iconFile.icons.length} tamanhos)`);
