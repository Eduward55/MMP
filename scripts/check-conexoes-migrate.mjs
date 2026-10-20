#!/usr/bin/env node
// Wipe of old Conexões defeats (kv/localStorage key `conexoes`) — no categories.json write.
import { migrateSaved, STORE_VERSION, emptyStats } from '../modules/conexoes/engine.js';

function assert(name, cond, detail) {
  if (!cond) {
    console.error(JSON.stringify({ ok: false, name, detail }));
    process.exit(1);
  }
}

const oldLoss = {
  version: 1,
  history: [{ at: '2026-10-18T12:00:00.000Z', won: false, mistakes: 4, solved: 1, titles: ['Velha derrota'] }],
  stats: { played: 1, wins: 0, losses: 1, streak: 0, best: 0, fewestMistakes: null },
  game: { done: true, won: false, mistakes: 4, solved: [], groups: [], board: [] },
  used: ['old-id']
};

const wiped = migrateSaved(oldLoss);
assert('version bump', wiped.version === STORE_VERSION && wiped.stale && wiped.from === 1, wiped);
assert('histórico de derrota some', Array.isArray(wiped.history) && wiped.history.length === 0, wiped.history);
assert('contador de derrotas zera', wiped.stats.losses === 0 && wiped.stats.played === 0, wiped.stats);
assert('tela de derrota antiga some', wiped.game == null, wiped.game);

const v2Loss = migrateSaved({
  ...oldLoss,
  version: 2,
  stats: { ...emptyStats(), played: 4, wins: 3, losses: 1, streak: 0, best: 3 }
});
assert('v2 também limpa derrota', v2Loss.stale && v2Loss.history.length === 0 && v2Loss.stats.losses === 0 && v2Loss.stats.played === 3, v2Loss.stats);

const current = migrateSaved({
  version: STORE_VERSION,
  history: [{ at: '2026-10-20T15:00:00.000Z', won: true, mistakes: 1, solved: 4, titles: ['Nova'] }],
  stats: { played: 1, wins: 1, losses: 0, streak: 1, best: 1, fewestMistakes: 1 },
  game: { done: false, won: false, mistakes: 0, solved: ['a'], groups: [1, 2, 3, 4], board: [] },
  used: ['keep']
});
assert('save atual não apaga', !current.stale && current.history.length === 1 && current.history[0].won && current.used[0] === 'keep', current);

const inPlay = migrateSaved({
  version: 1,
  history: [{ won: false, mistakes: 4, solved: 0, titles: ['x'], at: '2026-10-01T00:00:00.000Z' }],
  stats: { played: 2, wins: 1, losses: 1, streak: 0, best: 1, fewestMistakes: 0 },
  game: { done: false, won: false, mistakes: 3, solved: ['g'], groups: [1, 2, 3, 4], board: ['a'] },
  used: []
});
assert('partida em andamento zera vidas gastas da era antiga', inPlay.game && inPlay.game.mistakes === 0 && inPlay.history.length === 0, inPlay.game);

console.log(JSON.stringify({ ok: true, storeVersion: STORE_VERSION, tests: 5 }));
