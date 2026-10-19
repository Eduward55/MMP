#!/usr/bin/env node
// Gera data/cattyping/words.json: 5.000+ palavras reais de 3–10 letras, validadas no Hunspell e na frequência.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import dictionary from 'dictionary-pt';
import { BLOCKLIST, THEMES } from './cattyping-themes.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'cattyping');
const FREQ_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_full.txt';
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'mmp-termo', 'pt_br_full.txt');
const MIN_COUNT = 8;
const TARGET = 5200;
const MIN_LEN = 3;
const MAX_LEN = 10;
const PT_WORD = /^[a-záàâãéêíóôõúüç]+$/i;

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const letters = (s) => norm(s).replace(/[^a-z]/g, '');

async function frequencyList() {
  const local = process.argv[2];
  if (local) return fs.readFile(local, 'utf8');
  try {
    return await fs.readFile(CACHE, 'utf8');
  } catch {}
  console.log(`Baixando lista de frequência: ${FREQ_URL}`);
  const res = await fetch(FREQ_URL);
  if (!res.ok) throw new Error(`Falha ao baixar a lista (${res.status})`);
  const text = await res.text();
  await fs.mkdir(path.dirname(CACHE), { recursive: true });
  await fs.writeFile(CACHE, text);
  return text;
}

async function loadSpeller(words) {
  const probe = spawnSync('hunspell', ['-v'], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error('hunspell é necessário para gerar as palavras do Cat Typing.');
  const base = path.join(path.dirname(CACHE), 'pt_BR_cat');
  await fs.mkdir(path.dirname(base), { recursive: true });
  await fs.writeFile(`${base}.aff`, Buffer.from(dictionary.aff));
  await fs.writeFile(`${base}.dic`, Buffer.from(dictionary.dic));
  const out = spawnSync('hunspell', ['-d', base, '-i', 'utf-8', '-G'], {
    input: words.join('\n'),
    encoding: 'utf8',
    maxBuffer: 1 << 28
  });
  if (out.status !== 0 && !out.stdout) throw new Error(`hunspell falhou: ${out.stderr}`);
  return new Set(out.stdout.split('\n').map((s) => s.trim()).filter(Boolean));
}

const freqRows = [];
for (const line of (await frequencyList()).split('\n')) {
  const [raw, countStr] = line.trim().split(' ');
  const count = Number(countStr);
  if (!raw || !count || count < MIN_COUNT) continue;
  const w = raw.toLowerCase();
  if (!PT_WORD.test(w)) continue;
  const n = letters(w);
  if (n.length < MIN_LEN || n.length > MAX_LEN) continue;
  freqRows.push([w, n, count]);
}

const themeSets = {};
const themePriority = ['psicologia', 'arte', 'historia', 'gerais'];
for (const [theme, list] of Object.entries(THEMES)) {
  themeSets[theme] = new Set(list.split(/\s+/).filter(Boolean).map(norm).map(letters).filter((w) => w.length >= MIN_LEN && w.length <= MAX_LEN));
}
const blocked = new Set(BLOCKLIST.split(/\s+/).filter(Boolean).map(norm).map(letters));
const themeWords = [...new Set(Object.values(themeSets).flatMap((s) => [...s]))];

const uniqueForms = [...new Set([...freqRows.map((r) => r[0]), ...themeWords])];
const t0 = Date.now();
const okSet = await loadSpeller(uniqueForms);
console.log(`Hunspell: ${okSet.size} formas válidas em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

function themeOf(n) {
  for (const th of ['psicologia', 'arte', 'historia']) if (themeSets[th].has(n)) return th;
  return 'gerais';
}

const byNorm = new Map();
for (const [w, n, count] of freqRows) {
  if (blocked.has(n) || !okSet.has(w)) continue;
  const g = byNorm.get(n) || { display: w, count: 0, theme: themeOf(n) };
  g.count += count;
  if (count >= (g.best || 0)) {
    g.display = w;
    g.best = count;
  }
  byNorm.set(n, g);
}

const all = [...byNorm.entries()]
  .map(([word, g]) => ({ word, display: g.display, len: word.length, theme: g.theme, count: g.count }))
  .sort((a, b) => b.count - a.count);

const picked = [];
const used = new Set();
const take = (pred, n) => {
  for (const row of all) {
    if (picked.length >= n) break;
    if (used.has(row.word) || !pred(row)) continue;
    used.add(row.word);
    picked.push(row);
  }
};

take((r) => r.theme === 'psicologia', 500);
take((r) => r.theme === 'arte', 500);
take((r) => r.theme === 'historia', 500);
for (let len = MIN_LEN; len <= MAX_LEN; len++) take((r) => r.len === len, picked.length + 80);
take(() => true, TARGET);
if (picked.length < 5000) {
  console.error(`Só ${picked.length} palavras (precisa 5000+)`);
  process.exit(1);
}

picked.sort((a, b) => a.word.localeCompare(b.word, 'pt'));
const themes = { psicologia: 0, arte: 0, historia: 0, gerais: 0 };
const byLen = {};
for (const w of picked) {
  themes[w.theme]++;
  byLen[w.len] = (byLen[w.len] || 0) + 1;
}
for (const th of ['psicologia', 'arte', 'historia', 'gerais']) {
  if (themes[th] < 50) {
    console.error(`tema ${th} com só ${themes[th]} palavras`);
    process.exit(1);
  }
}
for (let len = MIN_LEN; len <= MAX_LEN; len++) {
  if (!byLen[len]) {
    console.error(`faltam palavras de ${len} letras`);
    process.exit(1);
  }
}

const payload = {
  version: 1,
  meta: { words: picked.length, minLen: MIN_LEN, maxLen: MAX_LEN, themes, byLen, builtAt: new Date().toISOString() },
  words: picked.map(({ word, display, len, theme }) => ({ word, display, len, theme }))
};
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, 'words.json'), `${JSON.stringify(payload)}\n`);
await fs.writeFile(
  path.join(OUT, 'README.md'),
  `# Palavras do Cat Typing

Geradas por \`npm run cattyping:words\` a partir do dicionário Hunspell pt-BR e da lista de frequência do português (OpenSubtitles). Nenhuma palavra é inventada.

- ${payload.meta.words} palavras de ${MIN_LEN} a ${MAX_LEN} letras
- temas: psicologia ${themes.psicologia}, arte ${themes.arte}, história ${themes.historia}, gerais ${themes.gerais}
`
);
console.log(JSON.stringify({ ok: true, ...payload.meta }, null, 2));
console.log(`escreveu ${path.join(OUT, 'words.json')}`);
