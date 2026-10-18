#!/usr/bin/env node
// Gera data/termo/answers.json e data/termo/valid.json a partir de fontes reais:
//  - dicionário Hunspell pt-BR do LibreOffice (pacote npm `dictionary-pt`), consultado com `hunspell` (ou `nspell`);
//  - dicionário Hunspell pt-PT da Universidade do Minho (`dictionary-pt-pt`), usado como segunda opinião para as
//    respostas "gerais" (corta nomes próprios e estrangeirismos que o pt-BR aceita em minúsculas);
//  - lista de frequência de palavras em pt-BR (hermitdave/FrequencyWords, legendas OpenSubtitles 2018).
// Nenhuma palavra é inventada: toda palavra precisa passar no corretor Hunspell, e as respostas também precisam
// aparecer na lista de frequência (palavras realmente usadas). Uso: node scripts/build-termo-words.mjs [freq.txt]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import dictionary from 'dictionary-pt';
import dictionaryPt from 'dictionary-pt-pt';
import { BLOCKLIST, NAMES, THEMES } from './termo-themes.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'termo');
const FREQ_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_full.txt';
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'mmp-termo', 'pt_br_full.txt');
const TARGET_ANSWERS = 1700;
const MIN_VALID_COUNT = 2;
const MIN_ANSWER_COUNT = 40;

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const PT_WORD = /^[a-záàâãéêíóôõúüç]+$/;

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

// O binário `hunspell` verifica dezenas de milhares de palavras em segundos; o nspell (JS puro) leva muitos
// minutos para expandir os afixos do dicionário pt-BR, então fica só como alternativa quando o binário não existe.
async function loadSpeller(words, dict = dictionary, name = 'pt_BR') {
  const probe = spawnSync('hunspell', ['-v'], { encoding: 'utf8' });
  if (probe.status === 0) {
    const base = path.join(path.dirname(CACHE), name);
    await fs.mkdir(path.dirname(base), { recursive: true });
    await fs.writeFile(`${base}.aff`, Buffer.from(dict.aff));
    await fs.writeFile(`${base}.dic`, Buffer.from(dict.dic));
    const out = spawnSync('hunspell', ['-d', base, '-i', 'utf-8', '-G'], {
      input: words.join('\n'),
      encoding: 'utf8',
      maxBuffer: 1 << 28
    });
    if (out.status !== 0) throw new Error(`hunspell falhou: ${out.stderr}`);
    const ok = new Set(out.stdout.split('\n').map((s) => s.trim()).filter(Boolean));
    return { engine: 'hunspell', correct: (w) => ok.has(w) };
  }
  const require = createRequire(import.meta.url);
  const sp = require('nspell')(dict);
  return { engine: 'nspell', correct: (w) => sp.correct(w) };
}

const isCandidate = (w) => PT_WORD.test(w) && /^[a-z]{5}$/.test(norm(w));
const dicStems = Buffer.from(dictionary.dic)
  .toString('utf8')
  .split('\n')
  .slice(1)
  .map((line) => line.split('/')[0].trim())
  .filter(isCandidate);
const freqRows = [];
for (const line of (await frequencyList()).split('\n')) {
  const [raw, countStr] = line.trim().split(' ');
  const count = Number(countStr);
  if (!raw || !count || count < MIN_VALID_COUNT) continue;
  const w = raw.toLowerCase();
  if (isCandidate(w)) freqRows.push([w, count]);
}
const themeWords = Object.values(THEMES).flatMap((list) => list.split(/\s+/).filter(Boolean));

const t0 = Date.now();
const spell = await loadSpeller([...new Set([...dicStems, ...freqRows.map((r) => r[0]), ...themeWords])]);
const second = await loadSpeller(dicStems, dictionaryPt, 'pt_PT');
const pluralSpell = await loadSpeller(freqRows.map((r) => r[0]).filter((w) => w.endsWith('s')), dictionaryPt, 'pt_PT');
const pluralCheck = { has: (w) => pluralSpell.correct(w) };
console.log(`Verificação Hunspell (${spell.engine}) em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// Lemas (entradas do .dic): formas de dicionário, sem conjugações nem plurais gerados por afixo.
const lemmas = new Set(dicStems.filter((w) => spell.correct(w)));

// Formas reais observadas no uso, agrupadas pela versão sem acento.
const byNorm = new Map();
for (const [w, count] of freqRows) {
  const n = norm(w);
  if (!spell.correct(w)) continue;
  const g = byNorm.get(n) || { forms: new Map(), count: 0 };
  g.forms.set(w, (g.forms.get(w) || 0) + count);
  g.count += count;
  byNorm.set(n, g);
}
const formCount = (w) => (byNorm.get(norm(w)) ? byNorm.get(norm(w)).forms.get(w) || 0 : 0);
const displayOfGroup = (g) => [...g.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
const displayOf = (n) => {
  const g = byNorm.get(n);
  return g ? [...g.forms.entries()].sort((a, b) => b[1] - a[1])[0][0] : n;
};

// Palpites aceitos: tudo que foi visto no uso e passou no Hunspell + todos os lemas de 5 letras do dicionário.
const valid = new Set([...byNorm.keys(), ...[...lemmas].map(norm)]);

const blocked = new Set(`${BLOCKLIST} ${NAMES}`.split(/\s+/).filter(Boolean).map(norm));
const answers = [];
const used = new Set();
const report = { rejeitadas: {} };

for (const [theme, list] of Object.entries(THEMES)) {
  const words = [...new Set(list.split(/\s+/).filter(Boolean))];
  report.rejeitadas[theme] = [];
  for (const w of words) {
    const n = norm(w);
    const why =
      n.length !== 5 ? 'não tem 5 letras' : !spell.correct(w) ? 'Hunspell não reconhece' : formCount(w) < MIN_ANSWER_COUNT ? 'rara no uso real' : blocked.has(n) ? 'bloqueada' : used.has(n) ? null : '';
    if (why === null) continue;
    if (why) {
      report.rejeitadas[theme].push(`${w} (${why})`);
      continue;
    }
    used.add(n);
    answers.push({ word: n, display: w, theme });
  }
}

const themed = answers.length;
const general = [...lemmas]
  .map((w) => ({ w, n: norm(w), c: formCount(w) }))
  .filter((x) => x.c >= MIN_ANSWER_COUNT && second.correct(x.w) && !blocked.has(x.n) && !used.has(x.n))
  .sort((a, b) => b.c - a.c);
for (const x of general) {
  if (answers.length >= TARGET_ANSWERS) break;
  if (used.has(x.n)) continue;
  used.add(x.n);
  answers.push({ word: x.n, display: x.w, theme: 'gerais' });
}
// Se ainda faltar, plurais de substantivos de 4 letras do dicionário (casa → casas), também conferidos nos dois.
const stems4 = new Set(
  Buffer.from(dictionary.dic)
    .toString('utf8')
    .split('\n')
    .map((line) => line.split('/')[0].trim())
    .filter((w) => PT_WORD.test(w) && norm(w).length === 4)
);
const plurals = [...byNorm.values()]
  .map((g) => displayOfGroup(g))
  .filter((w) => w.endsWith('s') && stems4.has(w.slice(0, -1)))
  .map((w) => ({ w, n: norm(w), c: formCount(w) }))
  .filter((x) => x.c >= MIN_ANSWER_COUNT && pluralCheck.has(x.w) && !blocked.has(x.n) && !used.has(x.n))
  .sort((x, y) => y.c - x.c);
for (const x of plurals) {
  if (answers.length >= TARGET_ANSWERS) break;
  used.add(x.n);
  answers.push({ word: x.n, display: x.w, theme: 'gerais' });
}
answers.forEach((a) => valid.add(a.word));

const source = {
  dictionary: 'Hunspell pt-BR (LibreOffice/VERO) via npm dictionary-pt, LGPL-3.0/MPL-2.0',
  secondDictionary: 'Hunspell pt-PT (Universidade do Minho) via npm dictionary-pt-pt, GPL-2.0/LGPL-2.1/MPL-1.1',
  frequency: 'hermitdave/FrequencyWords pt_br 2018 (OpenSubtitles), CC-BY-SA-4.0',
  generatedBy: 'scripts/build-termo-words.mjs'
};
await fs.mkdir(OUT, { recursive: true });
const counts = answers.reduce((m, a) => ((m[a.theme] = (m[a.theme] || 0) + 1), m), {});
await fs.writeFile(path.join(OUT, 'answers.json'), `${JSON.stringify({ version: 1, source, count: answers.length, themes: counts, answers })}\n`);
const validList = [...valid].sort();
await fs.writeFile(path.join(OUT, 'valid.json'), `${JSON.stringify({ version: 1, source, count: validList.length, words: validList })}\n`);
await fs.writeFile(path.join(OUT, 'build-report.json'), `${JSON.stringify({ ...report, temas: counts, aceitas: validList.length, lemas: lemmas.size, geraisDisponiveis: general.length + themed }, null, 2)}\n`);
console.log(`answers.json: ${answers.length} respostas`, counts);
console.log(`valid.json: ${validList.length} palavras aceitas`);
console.log(`Rejeitadas nos temas:`, Object.fromEntries(Object.entries(report.rejeitadas).map(([k, v]) => [k, v.length])));
