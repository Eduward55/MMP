#!/usr/bin/env node
// Gera build/icon.png (1024) e build/icon.ico a partir do gato pixel do Hub.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build');

const PAL = {
  '.': null,
  o: [242, 138, 59, 255],
  p: [255, 156, 207, 255],
  g: [93, 255, 155, 255],
  k: [18, 10, 28, 255],
  w: [246, 236, 255, 255],
  v: [155, 92, 255, 255],
  y: [255, 210, 63, 255],
  c: [95, 243, 255, 255],
  n: [13, 7, 22, 255],
  d: [28, 16, 48, 255],
  l: [59, 34, 102, 255]
};

// 16×16: moldura + gato laranja do Hub (12×12) centralizado.
const MAP = [
  'llllllllllllllll',
  'lyyyyyyyyyyyyyyl',
  'lyvovvvvvvvvovyl',
  'lyvoovvvvvvvoovyl',
  'lyvopovvvvopovyl',
  'lyvoooooooooovyl',
  'lyooooooooooovyl',
  'lyoogkooookgovyl',
  'lyoogkooookgovyl',
  'lyooooppooooovyl',
  'lyooowkkwoooovyl',
  'lyvoooooooooovyl',
  'lyvvooooooovvvyl',
  'lyvvvvcwwwcvvvyl',
  'lyyyyyyyyyyyyyyl',
  'llllllllllllllll'
];

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

function writePng(file, width, height, rgba) {
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
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png;
}

function raster(size) {
  const n = MAP.length;
  const cell = Math.floor(size / n);
  const rgba = Buffer.alloc(size * size * 4);
  rgba.fill(0);
  const ox = Math.floor((size - cell * n) / 2);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const col = PAL[MAP[y][x]];
      if (!col) continue;
      for (let j = 0; j < cell; j++) {
        for (let i = 0; i < cell; i++) {
          const px = ox + x * cell + i;
          const py = ox + y * cell + j;
          const o = (py * size + px) * 4;
          rgba[o] = col[0];
          rgba[o + 1] = col[1];
          rgba[o + 2] = col[2];
          rgba[o + 3] = col[3];
        }
      }
    }
  }
  return rgba;
}

function writeIco(file, png256) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 0;
  entry[1] = 0;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png256.length, 8);
  entry.writeUInt32LE(22, 12);
  fs.writeFileSync(file, Buffer.concat([header, entry, png256]));
}

fs.mkdirSync(OUT, { recursive: true });
const png1024 = writePng(path.join(OUT, 'icon.png'), 1024, 1024, raster(1024));
const tmp256 = path.join(OUT, '.icon-256.png');
const png256 = writePng(tmp256, 256, 256, raster(256));
writeIco(path.join(OUT, 'icon.ico'), png256);
fs.unlinkSync(tmp256);
console.log(`ícone do gato em ${OUT} (${png1024.length} bytes png)`);
