#!/usr/bin/env node
// Monta data/conexoes/categories.json a partir das listas por tema e valida o gerador.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  THEMES,
  validateCategories,
  countValidCategoryCombos,
  generatePuzzle,
  mulberry32,
  disjointGroups,
  GROUP_SIZE
} from '../modules/conexoes/engine.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'conexoes', 'categories.json');

function parseRow(theme, row) {
  const [id, difficulty, title, wordsRaw] = row;
  const words = String(wordsRaw)
    .split(',')
    .map((w) => w.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR'))
    .filter(Boolean);
  return { id, theme, difficulty: Number(difficulty), title, words };
}

async function loadTheme(id) {
  const file = path.join(ROOT, 'scripts', 'conexoes-data', `${id}.mjs`);
  const mod = await import(pathToFileURL(file).href);
  return (mod.default || []).map((row) => parseRow(id, row));
}

function mainIssues(categories) {
  const extra = [];
  for (const c of categories) {
    if (/[?]/.test(c.title) || c.words.some((w) => /[?]/.test(w))) extra.push(`${c.id}: contém ?`);
    if (c.words.some((w) => /NÃO$/i.test(w) || w.length < 2)) extra.push(`${c.id}: palavra suspeita (${c.words.filter((w) => w.length < 2 || /NÃO$/i.test(w)).join(', ')})`);
    if (c.words.some((w) => /[a-z]/.test(w) && !/[ÁÉÍÓÚÂÊÔÃÕÇ]/.test(w))) {
      const mixed = c.words.filter((w) => /[a-z]/.test(w));
      extra.push(`${c.id}: minúsculas (${mixed.join(', ')})`);
    }
  }
  return extra;
}

const categories = (await Promise.all(THEMES.map((t) => loadTheme(t.id)))).flat();
const check = validateCategories(categories);
const extra = mainIssues(categories);
const issues = [...check.issues, ...extra];

let combos = 0;
if (!issues.length) {
  combos = countValidCategoryCombos(categories);
  const rng = mulberry32(20261019);
  let failed = 0;
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    const p = generatePuzzle(categories, rng, { avoidIds: seen });
    if (!p || !disjointGroups(p.groups) || p.groups.length !== 4) failed++;
    else seen.add(p.id);
    if (p) p.groups.forEach((g) => (g.words.length !== GROUP_SIZE ? failed++ : 0));
  }
  if (failed) issues.push(`gerador falhou em ${failed} tentativas de 80`);
  if (combos < 1000) issues.push(`só ${combos} combinações de 4 categorias (precisa milhares)`);
}

const payload = {
  version: 1,
  meta: {
    categories: categories.length,
    themes: check.themeCount,
    validFourTuples: combos,
    builtAt: new Date().toISOString()
  },
  categories
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
if (!issues.length) fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);

console.log(JSON.stringify({ ok: issues.length === 0, categories: categories.length, themes: check.themeCount, combos, issues }, null, 2));
if (issues.length) process.exit(1);
console.log(`escreveu ${OUT}`);
