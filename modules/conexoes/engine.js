// Gerador de puzzles do Conexões: 4 categorias sem palavras em comum, 4 palavras cada.
export const MAX_MISTAKES = 4;
export const BOARD_SIZE = 16;
export const GROUP_SIZE = 4;
export const THEMES = [
  { id: 'psicologia', label: 'Psicologia' },
  { id: 'arte', label: 'Arte' },
  { id: 'historia', label: 'História' },
  { id: 'musica', label: 'Música' },
  { id: 'gerais', label: 'Gerais' }
];
export const THEME_LABEL = Object.fromEntries(THEMES.map((t) => [t.id, t.label]));
export const LEVELS = [
  { id: 'yellow', hex: '#ffd23f', ink: '#10051d', label: 'Direto' },
  { id: 'green', hex: '#7dce6a', ink: '#10051d', label: 'Claro' },
  { id: 'blue', hex: '#7eb6ff', ink: '#10051d', label: 'Ardil' },
  { id: 'purple', hex: '#c89bff', ink: '#10051d', label: 'Obscuro' }
];

export function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng = Math.random) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function wordKeySet(words) {
  return new Set((words || []).map(norm).filter(Boolean));
}

export function sharesWord(a, b) {
  const other = wordKeySet(b.words);
  for (const w of wordKeySet(a.words)) if (other.has(w)) return true;
  return false;
}

export function disjointGroups(groups) {
  const seen = new Set();
  for (const g of groups) {
    for (const w of g.words || []) {
      const k = norm(w);
      if (!k || seen.has(k)) return false;
      seen.add(k);
    }
  }
  return true;
}

function pickWords(cat, rng, n = GROUP_SIZE) {
  const unique = [];
  const seen = new Set();
  for (const w of cat.words || []) {
    const k = norm(w);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(w);
  }
  if (unique.length < n) return null;
  return shuffle(unique, rng).slice(0, n);
}

function compatibleWith(cat, picked) {
  return picked.every((p) => !sharesWord(p, cat));
}

function puzzleId(groups) {
  return groups
    .map((g) => g.id)
    .slice()
    .sort()
    .join('|');
}

function makePuzzle(cats, rng) {
  const ordered = [...cats].sort((a, b) => (a.difficulty ?? 0) - (b.difficulty ?? 0));
  const groups = ordered.map((c, i) => {
    const words = pickWords(c, rng);
    if (!words) return null;
    const level = LEVELS[Math.min(LEVELS.length - 1, i)];
    return {
      id: c.id,
      title: c.title,
      theme: c.theme,
      difficulty: i,
      color: level.id,
      hex: level.hex,
      ink: level.ink,
      words
    };
  });
  if (groups.some((g) => !g) || !disjointGroups(groups)) return null;
  return {
    id: puzzleId(groups),
    groups,
    board: shuffle(
      groups.flatMap((g) => g.words),
      rng
    ),
    createdAt: new Date().toISOString()
  };
}

function byDifficulty(categories) {
  const buckets = [[], [], [], []];
  for (const c of categories) {
    const d = Math.max(0, Math.min(3, Number(c.difficulty) || 0));
    buckets[d].push(c);
  }
  return buckets;
}

function greedyPick(pool, rng, avoidIds = new Set()) {
  const picked = [];
  for (const cat of shuffle(pool, rng)) {
    if (avoidIds.has(cat.id)) continue;
    if (!compatibleWith(cat, picked) || !pickWords(cat, rng)) continue;
    picked.push(cat);
    if (picked.length === 4) return picked;
  }
  return null;
}

export function generatePuzzle(categories, rng = Math.random, { avoidIds = new Set(), attempts = 120 } = {}) {
  const pool = (categories || []).filter((c) => c && c.id && (c.words || []).length >= GROUP_SIZE);
  if (pool.length < 4) return null;
  const buckets = byDifficulty(pool);

  for (let n = 0; n < attempts; n++) {
    const picked = [];
    let ok = true;
    for (let d = 0; d < 4; d++) {
      const cand = shuffle(
        buckets[d].filter((c) => !avoidIds.has(c.id) && compatibleWith(c, picked) && pickWords(c, rng)),
        rng
      );
      if (!cand.length) {
        ok = false;
        break;
      }
      picked.push(cand[0]);
    }
    if (!ok) continue;
    const puzzle = makePuzzle(picked, rng);
    if (puzzle && !avoidIds.has(puzzle.id)) return puzzle;
  }

  for (let n = 0; n < attempts; n++) {
    const picked = greedyPick(
      pool.filter((c) => !avoidIds.has(c.id)),
      rng,
      avoidIds
    );
    if (!picked) break;
    const puzzle = makePuzzle(picked, rng);
    if (puzzle && !avoidIds.has(puzzle.id)) return puzzle;
  }
  const last = greedyPick(pool, rng);
  return last ? makePuzzle(last, rng) : null;
}

export function groupOf(puzzle, word) {
  const k = norm(word);
  return puzzle.groups.findIndex((g) => g.words.some((w) => norm(w) === k));
}

export function submitGuess(puzzle, words) {
  if (!puzzle || !Array.isArray(words) || words.length !== GROUP_SIZE) {
    return { ok: false, reason: 'need-four' };
  }
  const keys = words.map(norm);
  if (new Set(keys).size !== GROUP_SIZE) return { ok: false, reason: 'duplicate' };
  const idxs = words.map((w) => groupOf(puzzle, w));
  if (idxs.some((i) => i < 0)) return { ok: false, reason: 'unknown' };
  if (idxs.every((i) => i === idxs[0])) return { ok: true, group: idxs[0], oneAway: false };
  const counts = [0, 0, 0, 0];
  idxs.forEach((i) => counts[i]++);
  return { ok: false, group: -1, oneAway: Math.max(...counts) === 3, counts };
}

export function hintWords(puzzle, solvedIds, rng = Math.random) {
  const remaining = puzzle.groups
    .filter((g) => !solvedIds.includes(g.id))
    .sort((a, b) => a.difficulty - b.difficulty);
  if (!remaining.length) return [];
  return shuffle(remaining[0].words, rng).slice(0, 2);
}

function pop32(x) {
  x >>>= 0;
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function popcountAfter(arr, k) {
  const start = k + 1;
  const w0 = start >> 5;
  if (w0 >= arr.length) return 0;
  const bit = start & 31;
  const mask = bit === 0 ? 0xffffffff : (0xffffffff << bit) >>> 0;
  let n = pop32(arr[w0] & mask);
  for (let w = w0 + 1; w < arr.length; w++) n += pop32(arr[w]);
  return n;
}

export function conflictBits(categories) {
  const n = categories.length;
  const W = Math.max(1, Math.ceil(n / 32));
  const bad = Array.from({ length: n }, () => new Uint32Array(W));
  const sets = categories.map((c) => wordKeySet(c.words));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let clash = false;
      const a = sets[i];
      const b = sets[j];
      const small = a.size <= b.size ? a : b;
      const big = a.size <= b.size ? b : a;
      for (const w of small) {
        if (big.has(w)) {
          clash = true;
          break;
        }
      }
      if (clash) {
        bad[i][j >> 5] |= 1 << (j & 31);
        bad[j][i >> 5] |= 1 << (i & 31);
      }
    }
  }
  return { n, W, bad };
}

export function countValidCategoryCombos(categories) {
  const { n, W, bad } = conflictBits(categories);
  if (n < 4) return 0;
  const ok = Array.from({ length: n }, (_, i) => {
    const row = new Uint32Array(W);
    for (let w = 0; w < W; w++) row[w] = ~bad[i][w];
    row[i >> 5] &= ~(1 << (i & 31));
    const extra = n & 31;
    if (extra) row[W - 1] &= (1 << extra) - 1;
    return row;
  });
  const tmp = new Uint32Array(W);
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (bad[i][j >> 5] & (1 << (j & 31))) continue;
      for (let k = j + 1; k < n; k++) {
        if (bad[i][k >> 5] & (1 << (k & 31)) || bad[j][k >> 5] & (1 << (k & 31))) continue;
        for (let w = 0; w < W; w++) tmp[w] = ok[i][w] & ok[j][w] & ok[k][w];
        total += popcountAfter(tmp, k);
      }
    }
  }
  return total;
}

export function validateCategories(categories) {
  const issues = [];
  const ids = new Set();
  const themeCount = Object.fromEntries(THEMES.map((t) => [t.id, 0]));
  if (!Array.isArray(categories)) return { ok: false, issues: ['lista ausente'], themeCount, count: 0 };
  categories.forEach((c, i) => {
    if (!c || !c.id || !c.title) issues.push(`#${i}: falta id/título`);
    else if (ids.has(c.id)) issues.push(`id repetido: ${c.id}`);
    else ids.add(c.id);
    if (!THEME_LABEL[c.theme]) issues.push(`${c.id || i}: tema inválido ${c.theme}`);
    else themeCount[c.theme]++;
    const words = c.words || [];
    if (words.length < 8 || words.length > 12) issues.push(`${c.id || i}: ${words.length} palavras (precisa 8–12)`);
    const keys = words.map(norm);
    if (keys.some((k) => !k)) issues.push(`${c.id || i}: palavra vazia`);
    if (new Set(keys).size !== keys.length) issues.push(`${c.id || i}: palavra repetida na categoria`);
  });
  return { ok: issues.length === 0, issues, themeCount, count: categories.length };
}

export function emptyStats() {
  return { played: 0, wins: 0, losses: 0, streak: 0, best: 0, fewestMistakes: null };
}
