#!/usr/bin/env node
// Gera build/icon.png (1024), build/icon-48.png e build/icon.ico (16/32/48/256)
// a partir do sprite Stitch 48×48 da Pirrinha (creature cat SVG).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { creatureSVG } from '../modules/shared/creatures.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build');
const SRC = 48;

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const head = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcSrc = Buffer.concat([head, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSrc));
  return Buffer.concat([len, crcSrc, crc]);
}

function pngFromRgba(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function writePng(file, width, height, rgba) {
  const png = pngFromRgba(width, height, rgba);
  fs.writeFileSync(file, png);
  return png;
}

function parseHex(fill) {
  const m = String(fill || '').trim();
  if (m === 'none' || m === 'transparent') return null;
  const hex = m.startsWith('#') ? m.slice(1) : '';
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return [r, g, b, 255];
  }
  if (hex.length === 6) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
  }
  return null;
}

function rasterCat48() {
  const svg = creatureSVG(
    'cat',
    { coat: 'tabby', eyes: '#4ade80', outfit: { ear: 'lacinho' } },
    { size: SRC, label: 'Pirrinha' }
  );
  const rgba = Buffer.alloc(SRC * SRC * 4);
  const skip = new Set(['layer-heart-eyes', 'creature-sparkle']);
  let skipDepth = 0;
  const tokens = svg.split(/(<[^>]+>)/g);
  for (const tok of tokens) {
    if (!tok.startsWith('<')) continue;
    const gOpen = tok.match(/^<g\b([^>]*)>/i);
    if (gOpen) {
      const cls = /class="([^"]*)"/.exec(gOpen[1] || '');
      const names = cls ? cls[1].split(/\s+/) : [];
      if (skipDepth > 0 || names.some((n) => skip.has(n))) skipDepth += 1;
      continue;
    }
    if (/^<\/g>/i.test(tok)) {
      if (skipDepth > 0) skipDepth -= 1;
      continue;
    }
    if (skipDepth > 0) continue;
    const rect = tok.match(/^<rect\b([^>]*)\/?>/i);
    if (!rect) continue;
    const attr = (name) => {
      const m = new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(rect[1]);
      return m ? m[1] : '';
    };
    const col = parseHex(attr('fill'));
    if (!col) continue;
    const op = Number(attr('opacity') || '1');
    const a = Math.round(col[3] * (Number.isFinite(op) ? op : 1));
    const x0 = Math.max(0, Math.floor(Number(attr('x') || 0)));
    const y0 = Math.max(0, Math.floor(Number(attr('y') || 0)));
    const w = Math.max(1, Math.round(Number(attr('width') || 0)));
    const h = Math.max(1, Math.round(Number(attr('height') || 0)));
    for (let y = y0; y < y0 + h && y < SRC; y++) {
      for (let x = x0; x < x0 + w && x < SRC; x++) {
        const o = (y * SRC + x) * 4;
        rgba[o] = col[0];
        rgba[o + 1] = col[1];
        rgba[o + 2] = col[2];
        rgba[o + 3] = a;
      }
    }
  }
  return rgba;
}

function scaleNearest(src, srcSize, dstSize) {
  const out = Buffer.alloc(dstSize * dstSize * 4);
  for (let y = 0; y < dstSize; y++) {
    const sy = Math.min(srcSize - 1, Math.floor((y * srcSize) / dstSize));
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.min(srcSize - 1, Math.floor((x * srcSize) / dstSize));
      const si = (sy * srcSize + sx) * 4;
      const di = (y * dstSize + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

function writeIco(file, pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = [];
  let offset = 6 + 16 * count;
  for (const { size, png } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  fs.writeFileSync(file, Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]));
}

fs.mkdirSync(OUT, { recursive: true });
const cat48 = rasterCat48();
const painted = cat48.reduce((n, v, i) => (i % 4 === 3 && v > 0 ? n + 1 : n), 0);
if (painted < 80) {
  console.error(`ícone da Pirrinha saiu vazio (${painted} px)`);
  process.exit(1);
}

const png48 = writePng(path.join(OUT, 'icon-48.png'), 48, 48, cat48);
const png1024 = writePng(path.join(OUT, 'icon.png'), 1024, 1024, scaleNearest(cat48, SRC, 1024));
const icoSizes = [16, 32, 48, 256];
const icoPngs = icoSizes.map((size) => {
  const rgba = size === 48 ? cat48 : scaleNearest(cat48, SRC, size);
  return { size, png: pngFromRgba(size, size, rgba) };
});
writeIco(path.join(OUT, 'icon.ico'), icoPngs);
console.log(
  `ícone Stitch 48×48 da Pirrinha em ${OUT} (${png1024.length} bytes png, ${png48.length} bytes 48px, ico 16/32/48/256, ${painted} px)`
);
