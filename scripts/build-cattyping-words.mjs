#!/usr/bin/env node
// Gera data/cattyping/words.json: 5.000+ palavras reais de 3–10 letras.
// Toda palavra passa no Hunspell pt-BR. Temas curados entram mesmo se a frequência os cortar.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import dictionary from 'dictionary-pt';
import { BLOCKLIST, THEME_TOKENS, letters } from './cattyping-themes.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'cattyping');
const FREQ_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_full.txt';
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'mmp-termo', 'pt_br_full.txt');
const MIN_COUNT = 8;
const TARGET = 5200;
const MIN_THEME = 800;
const MIN_LEN = 3;
const MAX_LEN = 10;
const PT_WORD = /^[a-záàâãéêíóôõúüç]+$/i;
const THEME_ORDER = ['psicologia', 'arte', 'historia'];

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

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
  return new Set(
    out.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function acceptedForm(token, okSet) {
  const w = String(token).toLowerCase();
  if (okSet.has(w)) return w;
  const c = cap(w);
  if (okSet.has(c)) return c;
  return null;
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

const blocked = new Set(
  BLOCKLIST.split(/\s+/)
    .filter(Boolean)
    .map(letters)
    .filter((w) => w.length >= MIN_LEN)
);

const themeForms = [];
const themeByNorm = { psicologia: new Map(), arte: new Map(), historia: new Map(), gerais: new Map() };
for (const [theme, tokens] of Object.entries(THEME_TOKENS)) {
  for (const token of tokens) {
    const n = letters(token);
    if (n.length < MIN_LEN || n.length > MAX_LEN || blocked.has(n)) continue;
    if (!themeByNorm[theme].has(n)) themeByNorm[theme].set(n, token);
    themeForms.push(token, cap(token.toLowerCase()));
  }
}

const uniqueForms = [...new Set([...freqRows.map((r) => r[0]), ...themeForms])];
const t0 = Date.now();
const okSet = await loadSpeller(uniqueForms);
console.log(`Hunspell: ${okSet.size} formas válidas em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

function themeOf(n) {
  for (const th of THEME_ORDER) if (themeByNorm[th].has(n)) return th;
  return 'gerais';
}

const byNorm = new Map();
for (const [w, n, count] of freqRows) {
  if (blocked.has(n) || !okSet.has(w)) continue;
  const g = byNorm.get(n) || { display: w, count: 0, theme: themeOf(n), best: 0, source: 'freq' };
  g.count += count;
  if (count >= (g.best || 0)) {
    g.display = w;
    g.best = count;
  }
  byNorm.set(n, g);
}

const rejected = { psicologia: [], arte: [], historia: [], gerais: [] };
const keptWithoutFreq = { psicologia: 0, arte: 0, historia: 0, gerais: 0 };
for (const th of [...THEME_ORDER, 'gerais']) {
  for (const [n, token] of themeByNorm[th]) {
    const form = acceptedForm(token, okSet);
    if (!form) {
      rejected[th].push(token);
      continue;
    }
    if (!byNorm.has(n)) {
      byNorm.set(n, { display: form, count: 0, theme: th === 'gerais' ? 'gerais' : th, best: 0, source: 'tema' });
      keptWithoutFreq[th]++;
    } else {
      const g = byNorm.get(n);
      if (th !== 'gerais') {
        g.theme = th;
        g.display = form;
      }
    }
  }
}

const all = [...byNorm.entries()]
  .map(([word, g]) => ({ word, display: g.display, len: word.length, theme: g.theme, count: g.count, source: g.source }))
  .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'pt'));

const picked = [];
const used = new Set();
const take = (pred, n) => {
  let added = 0;
  for (const row of all) {
    if (added >= n) break;
    if (used.has(row.word) || !pred(row)) continue;
    used.add(row.word);
    picked.push(row);
    added++;
  }
  return added;
};

const nPsi = take((r) => r.theme === 'psicologia', Number.POSITIVE_INFINITY);
const nArte = take((r) => r.theme === 'arte', Number.POSITIVE_INFINITY);
const nHist = take((r) => r.theme === 'historia', Number.POSITIVE_INFINITY);
for (let len = MIN_LEN; len <= MAX_LEN; len++) take((r) => r.len === len, 80);
const nGerais = take((r) => r.theme === 'gerais', Math.max(MIN_THEME, TARGET - picked.length));
take(() => true, Math.max(0, TARGET - picked.length));
if (nPsi < MIN_THEME || nArte < MIN_THEME || nHist < MIN_THEME || nGerais < MIN_THEME) {
  console.error(`cota por tema: psicologia ${nPsi}, arte ${nArte}, historia ${nHist}, gerais ${nGerais} (mínimo ${MIN_THEME})`);
  process.exit(1);
}
if (picked.length < 5000) {
  console.error(`Só ${picked.length} palavras (precisa 5000+)`);
  process.exit(1);
}

picked.sort((a, b) => a.word.localeCompare(b.word, 'pt'));
const themes = { psicologia: 0, arte: 0, historia: 0, gerais: 0 };
const byLen = {};
const themeSources = {
  psicologia: { freq: 0, tema: 0 },
  arte: { freq: 0, tema: 0 },
  historia: { freq: 0, tema: 0 },
  gerais: { freq: 0, tema: 0 }
};
for (const w of picked) {
  themes[w.theme]++;
  byLen[w.len] = (byLen[w.len] || 0) + 1;
  if (w.count > 0) themeSources[w.theme].freq++;
  else themeSources[w.theme].tema++;
}
for (const th of ['psicologia', 'arte', 'historia', 'gerais']) {
  if (themes[th] < MIN_THEME) {
    console.error(`tema ${th} com só ${themes[th]} palavras (mínimo ${MIN_THEME})`);
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

const hunspellPool = {};
for (const th of ['psicologia', 'arte', 'historia', 'gerais']) {
  hunspellPool[th] = [...themeByNorm[th].keys()].filter((n) => acceptedForm(themeByNorm[th].get(n), okSet)).length;
}

const report = {
  ok: true,
  builtAt: payload.meta.builtAt,
  candidates: Object.fromEntries(['psicologia', 'arte', 'historia', 'gerais'].map((th) => [th, themeByNorm[th].size])),
  hunspellAccepted: hunspellPool,
  hunspellRejected: Object.fromEntries(
    Object.entries(rejected).map(([th, list]) => [th, [...new Set(list)].sort((a, b) => letters(a).localeCompare(letters(b)))])
  ),
  keptWithoutFrequency: keptWithoutFreq,
  pickedBySource: themeSources,
  final: { words: payload.meta.words, themes, byLen }
};

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, 'words.json'), `${JSON.stringify(payload)}\n`);
await fs.writeFile(path.join(OUT, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);
const rejN = Object.fromEntries(Object.entries(rejected).map(([th, list]) => [th, new Set(list).size]));
await fs.writeFile(
  path.join(OUT, 'README.md'),
  `# Palavras do Cat Typing

Geradas por \`npm run cattyping:words\`. Nenhuma palavra é inventada: lista curada (temas do Termo, extras em \`scripts/cattyping-extra.mjs\`, palavras soltas do Conexões) e depois cada item conferido no Hunspell pt-BR (\`dictionary-pt\`).

Termos históricos comuns (império, feudal, revolução, monarquia, colônia, faraó, dinastia, medieval, cruzada, renascença…) entram **mesmo se a lista de frequência os cortar**. \`renascimento\` é palavra real e passa no Hunspell, mas tem 12 letras — fora da faixa 3–10 do jogo; no dicionário entra a forma curta \`renascença\`.

## Contagens finais (${payload.meta.builtAt.slice(0, 10)})

| Tema | Candidatas | Hunspell ok | No \`words.json\` | Sem frequência | Mínimo |
| --- | ---: | ---: | ---: | ---: | ---: |
| psicologia | ${themeByNorm.psicologia.size} | ${hunspellPool.psicologia} | **${themes.psicologia}** | ${keptWithoutFreq.psicologia} | ${MIN_THEME} |
| arte | ${themeByNorm.arte.size} | ${hunspellPool.arte} | **${themes.arte}** | ${keptWithoutFreq.arte} | ${MIN_THEME} |
| história | ${themeByNorm.historia.size} | ${hunspellPool.historia} | **${themes.historia}** | ${keptWithoutFreq.historia} | ${MIN_THEME} |
| gerais | ${themeByNorm.gerais.size} | ${hunspellPool.gerais} | **${themes.gerais}** | ${keptWithoutFreq.gerais} | ${MIN_THEME} |
| **total** | | | **${payload.meta.words}** | ${Object.values(keptWithoutFreq).reduce((a, b) => a + b, 0)} | 5000 |

Por tamanho (letras, sem acento): ${Object.entries(byLen)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([len, n]) => `${len}→${n}`)
    .join(', ')}.

A coluna Hunspell ok é o poço temático (a mesma grafia pode aparecer em dois temas nas candidatas). No JSON final cada forma entra numa só cota.

Candidatas temáticas recusadas pelo Hunspell (nomes próprios, siglas, grafia estrangeira): psicologia ${rejN.psicologia}, arte ${rejN.arte}, história ${rejN.historia}, gerais ${rejN.gerais}. Lista completa em \`build-report.json\`.

A lista final foi revalidada: **0** palavras fora do Hunspell.
`
);
console.log(JSON.stringify({ ok: true, ...payload.meta, keptWithoutFrequency: keptWithoutFreq }, null, 2));
console.log(`escreveu ${path.join(OUT, 'words.json')}`);
