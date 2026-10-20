// Conexões: 16 palavras, 4 grupos. O gerador combina categorias de data/conexoes/categories.json.
import { kv, getProfile, onProfile } from '../shared/store.js';
import { creatureSVG } from '../shared/creatures.js';
import { el, toast, confirmDialog } from '../shared/ui.js';
import { formatDay, t } from '../shared/i18n.js';
import {
  LEVELS,
  THEME_LABEL,
  MAX_MISTAKES,
  GROUP_SIZE,
  generatePuzzle,
  submitGuess,
  hintWords,
  shuffle as shuffleList,
  mulberry32,
  disjointGroups,
  groupOf,
  STORE_VERSION,
  migrateSaved
} from './engine.js';

const STORE_KEY = 'conexoes';
const HISTORY_MAX = 16;
const USED_MAX = 240;
const MISS_SHAKE_MS = 420;
const randInt = (n) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
};

let dataPromise = null;
function loadData() {
  if (!dataPromise) {
    dataPromise = fetch(new URL('../../data/conexoes/categories.json', import.meta.url)).then(async (r) => {
      if (!r.ok) throw new Error(`categories.json: HTTP ${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json.categories) || json.categories.length < 400) {
        throw new Error('A base de categorias está incompleta.');
      }
      return json;
    });
    dataPromise.catch(() => (dataPromise = null));
  }
  return dataPromise;
}

function freshGame(categories, used, rng) {
  const puzzle = generatePuzzle(categories, rng, { avoidIds: used });
  if (!puzzle) return null;
  return {
    id: puzzle.id,
    startedAt: puzzle.createdAt,
    groups: puzzle.groups,
    board: puzzle.board,
    solved: [],
    mistakes: 0,
    hintUsed: false,
    hinted: [],
    done: false,
    won: false,
    guesses: []
  };
}

function gameOk(g, categories) {
  if (!g || !Array.isArray(g.groups) || g.groups.length !== 4 || !Array.isArray(g.board)) return false;
  const byId = new Map(categories.map((c) => [c.id, c]));
  if (g.groups.some((gr) => !byId.has(gr.id) || (gr.words || []).length !== GROUP_SIZE)) return false;
  return disjointGroups(g.groups);
}

export default {
  id: 'conexoes',
  title: 'Conexões',
  icon: 'conexoes',
  accent: '#ff8fd0',
  desc: 'Agrupe 16 palavras em 4 categorias secretas. O jogo inventa o puzzle na hora.',
  hideDock: true,
  async mount(root, { params } = {}) {
    const saved = (await kv.get(STORE_KEY).catch(() => null)) || {};
    const migrated = migrateSaved(saved, HISTORY_MAX);
    const stats = migrated.stats;
    const history = migrated.history;
    const used = new Set(migrated.used);
    let game = migrated.game;
    let selected = new Set();
    let catMood = 'idle';
    let alive = true;
    let busy = false;
    let data = null;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };

    const persist = () =>
      kv
        .set(STORE_KEY, { version: STORE_VERSION, game, stats, history, used: [...used] })
        .catch(() => {});
    if (migrated.stale) persist();

    const stage = el('div', { class: 'cn-stage' });
    const bubble = el('p', { class: 'cn-bubble', role: 'status', 'aria-live': 'polite' });
    const statsEl = el('div', { class: 'cn-stats', 'aria-label': 'Recorde local' });
    const histEl = el('div', { class: 'cn-hist', 'aria-label': 'Histórico de partidas' });
    const toolbar = el('div', { class: 'cn-toolbar' });
    const result = el('div', { class: 'cn-result', hidden: true });
    const solvedEl = el('div', { class: 'cn-solved' });
    const grid = el('div', { class: 'cn-grid', role: 'group', 'aria-label': 'Palavras' });
    const actions = el('div', { class: 'cn-actions' });
    const shuffleBtn = el('button', { class: 'btn btn--ghost', onclick: () => onShuffle() }, t('cn.shuffle'));
    const hintBtn = el('button', { class: 'btn btn--ghost', onclick: () => onHint() }, t('cn.hint'));
    const clearBtn = el('button', { class: 'btn btn--ghost', onclick: () => onClear() }, t('cn.clear'));
    const newBtn = el('button', { class: 'btn btn--ghost', onclick: () => askNewGame() }, t('cn.new'));
    actions.append(shuffleBtn, hintBtn, clearBtn, newBtn);

    const section = el(
      'section',
      { class: 'cn' },
      el('div', { class: 'cn-side cn-side--stage' }, stage, bubble),
      el('div', { class: 'cn-side cn-side--stats panel' }, statsEl, histEl),
      el('div', { class: 'cn-main' }, toolbar, result, solvedEl, grid, actions)
    );
    root.append(section);

    function renderStage(p = getProfile()) {
      stage.innerHTML = `
        <div class="cn-stage__fx" aria-hidden="true"></div>
        <figure class="cn-stage__cat">${creatureSVG('cat', p.cat, { size: 132, label: `Gato ${p.cat.name}` })}
          <span class="cn-tear cn-tear--l" aria-hidden="true"></span><span class="cn-tear cn-tear--r" aria-hidden="true"></span>
        </figure>
        <figure class="cn-stage__otter">${creatureSVG('otter', p.otter, { size: 92, label: `Lontra ${p.otter.name}` })}</figure>`;
      setMood(catMood, true);
    }
    const offProfile = onProfile((p) => renderStage(p));

    function setMood(mood, quiet = false) {
      catMood = mood;
      stage.dataset.mood = mood;
      const fx = stage.querySelector('.cn-stage__fx');
      if (!fx) return;
      fx.innerHTML = '';
      if (mood === 'win' && !quiet) {
        const colors = ['#8b5cf6', '#a78bfa', '#4ade80', '#eab308', '#a1a1aa'];
        for (let i = 0; i < 28; i++) {
          fx.append(
            el('i', {
              class: 'cn-confetti',
              style: `--x:${randInt(100)}%;--d:${(randInt(60) / 100 + 0.9).toFixed(2)}s;--delay:${(randInt(50) / 100).toFixed(2)}s;--r:${randInt(360)}deg;background:${colors[i % colors.length]}`
            })
          );
        }
      }
      if (mood === 'win') for (let i = 0; i < 4; i++) fx.append(el('b', { class: 'cn-heart', style: `--i:${i}` }, '♥'));
    }

    function say(text) {
      bubble.textContent = text;
      bubble.classList.remove('is-pop');
      void bubble.offsetWidth;
      bubble.classList.add('is-pop');
    }

    function names() {
      const p = getProfile();
      return { cat: p.cat.name, otter: p.otter.name };
    }

    function remainingLives() {
      return Math.max(0, MAX_MISTAKES - (game ? game.mistakes : 0));
    }

    function unsolvedGroups() {
      return game.groups.filter((g) => !game.solved.includes(g.id));
    }

    function startGame(seed) {
      if (used.size > USED_MAX) {
        const keep = [...used].slice(-80);
        used.clear();
        keep.forEach((id) => used.add(id));
      }
      const rng = typeof seed === 'number' ? mulberry32(seed) : () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
      let next = freshGame(data.categories, used, rng);
      if (!next) {
        used.clear();
        next = freshGame(data.categories, used, rng);
      }
      if (!next) {
        toast('Não consegui montar um puzzle agora.', 'error');
        return;
      }
      used.add(next.id);
      game = next;
      selected = new Set();
      setMood('idle');
      const { cat } = names();
      say(`${cat}: 16 palavras, 4 grupos. Você tem vidas — fica tranquila e escolha 4 que têm algo em comum!`);
      persist();
    }

    function applyShotDemo() {
      startGame(42);
      if (!game) return;
      const yellow = game.groups[0];
      game.solved = [yellow.id];
      game.guesses = [{ words: [...yellow.words], ok: true, at: game.startedAt }];
      selected = new Set(game.groups[1].words.slice(0, 2));
      game.hinted = [...selected];
      setMood('yay', true);
      const { otter } = names();
      say(`${otter}: esse grupo amarelo caiu! Faltam três.`);
    }

    function recordHistory(won) {
      history.unshift({
        at: new Date().toISOString(),
        won,
        mistakes: game.mistakes,
        solved: game.solved.length,
        titles: game.groups.map((g) => g.title)
      });
      if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
    }

    function finish(won) {
      game.done = true;
      game.won = won;
      game.finishedAt = new Date().toISOString();
      stats.played++;
      if (won) {
        stats.wins++;
        stats.streak++;
        stats.best = Math.max(stats.best, stats.streak);
        stats.fewestMistakes = stats.fewestMistakes == null ? game.mistakes : Math.min(stats.fewestMistakes, game.mistakes);
      } else {
        stats.losses++;
        stats.streak = 0;
      }
      recordHistory(won);
      persist();
      const { cat, otter } = names();
      later(() => {
        setMood(won ? 'win' : 'lose');
        say(
          won
            ? `${cat}: miau! Quatro grupos, recorde de sequência ${stats.best}.`
            : `${otter}: buáá… as categorias estavam aí em cima. Bora outra?`
        );
        render();
      }, 280);
    }

    function toggle(word) {
      if (!game || game.done || busy) return;
      if (selected.has(word)) selected.delete(word);
      else if (selected.size < GROUP_SIZE) {
        selected.add(word);
        if (selected.size === GROUP_SIZE) {
          renderGrid();
          renderToolbar();
          submit();
          return;
        }
      }
      renderGrid();
      renderToolbar();
    }

    function flashMissThenClear() {
      busy = true;
      renderGrid();
      renderToolbar();
      const shake = () => {
        grid.querySelectorAll('.cn-tile.is-on').forEach((tile) => {
          tile.classList.remove('is-shake', 'is-miss');
          void tile.offsetWidth;
          tile.classList.add('is-shake', 'is-miss');
        });
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(shake);
      else shake();
      later(() => {
        selected = new Set();
        busy = false;
        if (!alive || !game) return;
        if (game.mistakes >= MAX_MISTAKES && !game.done) finish(false);
        else {
          renderGrid();
          renderToolbar();
        }
      }, MISS_SHAKE_MS);
    }

    function submit() {
      if (!game || game.done || busy) return;
      if (selected.size !== GROUP_SIZE) {
        toast(t('cn.needFour'), 'info');
        return;
      }
      const words = [...selected];
      const res = submitGuess({ groups: game.groups }, words);
      game.guesses.push({ words, ok: Boolean(res.ok), oneAway: Boolean(res.oneAway), at: new Date().toISOString() });
      if (res.ok) {
        const group = game.groups[res.group];
        game.solved.push(group.id);
        selected = new Set();
        game.hinted = game.hinted.filter((w) => group.words.indexOf(w) === -1);
        const { cat, otter } = names();
        if (game.solved.length === 4) {
          finish(true);
        } else {
          persist();
          setMood('yay');
          say(`${otter}: ${group.title}! Faltam ${4 - game.solved.length}. ${cat} está pulando.`);
          later(() => catMood === 'yay' && setMood('idle'), 1400);
        }
        render();
      } else {
        game.mistakes++;
        if (res.oneAway) toast(t('cn.oneAway'), 'warn');
        else toast(t('cn.noGroup'), 'info');
        const left = remainingLives();
        const { cat } = names();
        if (left > 0) {
          persist();
          setMood(left <= 1 ? 'worried' : 'oops');
          say(
            left === 1
              ? `${cat}: última vida! Fica tranquila, pensa com o bigode.`
              : `${cat}: você tem vidas. Fica tranquila — ainda restam ${left}.`
          );
          later(() => (catMood === 'oops' || catMood === 'worried') && !game.done && setMood(left <= 1 ? 'worried' : 'idle'), 1200);
        } else {
          persist();
          setMood('oops');
          say(`${cat}: acabaram as vidas… fica tranquila, a gente tenta de novo.`);
        }
        flashMissThenClear();
      }
    }

    function onShuffle() {
      if (!game || game.done || busy) return;
      const rest = game.board.filter((w) => {
        const gi = groupOf(game, w);
        return gi >= 0 && !game.solved.includes(game.groups[gi].id);
      });
      const shuffled = shuffleList(rest, () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
      const next = [];
      let i = 0;
      game.board.forEach((w) => {
        const gi = groupOf(game, w);
        if (gi >= 0 && game.solved.includes(game.groups[gi].id)) next.push(w);
        else next.push(shuffled[i++]);
      });
      game.board = next;
      persist();
      renderGrid();
    }

    function onHint() {
      if (!game || game.done || busy) return;
      if (game.hintUsed) {
        toast('A dica desta partida já foi usada.', 'info');
        return;
      }
      const pair = hintWords(game, game.solved, () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
      if (pair.length < 2) return;
      game.hintUsed = true;
      game.hinted = pair;
      persist();
      const { otter } = names();
      say(`${otter}: duas destas vão juntas. Olha o brilho dourado.`);
      toast('Dica: duas palavras do mesmo grupo estão iluminadas.', 'ok');
      renderGrid();
      renderToolbar();
    }

    function onClear() {
      if (busy) return;
      selected = new Set();
      renderGrid();
      renderToolbar();
    }

    async function askNewGame() {
      if (game && !game.done && (game.solved.length || game.mistakes || game.guesses.length)) {
        const okNew = await confirmDialog({
          title: t('cn.askTitle'),
          message: t('cn.askMsg'),
          confirm: t('cn.new'),
          danger: true
        });
        if (!okNew) return;
        game.done = true;
        game.won = false;
        stats.played++;
        stats.losses++;
        stats.streak = 0;
        recordHistory(false);
      }
      startGame();
      render();
    }

    function renderToolbar() {
      toolbar.innerHTML = '';
      const lives = el('div', { class: 'cn-lives', 'aria-label': t('cn.livesLeft', { n: remainingLives() }) }, el('span', {}, t('cn.lives')));
      for (let i = 0; i < MAX_MISTAKES; i++) {
        lives.append(el('i', { class: `cn-pip ${i >= remainingLives() ? 'is-lost' : ''}`, 'aria-hidden': 'true' }, '♥'));
      }
      lives.append(el('span', { class: 'cn-lives__calm' }, t('cn.calm')));
      toolbar.append(
        lives,
        el('span', { class: 'muted' }, game && game.done ? '' : `${t('cn.picked', { n: selected.size })} · ${t('cn.autoShort')}`)
      );
      shuffleBtn.disabled = !game || game.done || busy;
      hintBtn.disabled = !game || game.done || busy || game.hintUsed || unsolvedGroups().length === 0;
      clearBtn.disabled = !game || game.done || busy || selected.size === 0;
    }

    function renderResult() {
      result.hidden = !game || !game.done;
      if (!game || !game.done) return;
      result.className = `cn-result ${game.won ? 'is-win' : 'is-lose'}`;
      result.innerHTML = '';
      result.append(
        el(
          'strong',
          {},
          game.won
            ? t('cn.winLives', {
                n: game.mistakes,
                life: game.mistakes === 1 ? t('cn.life1') : t('cn.lifeN'),
                s: game.mistakes === 1 ? '' : 's'
              })
            : t('cn.loseGroups', { n: game.solved.length })
        ),
        el('button', { class: 'btn btn--primary btn--sm', onclick: () => askNewGame() }, t('cn.again'))
      );
    }

    function renderSolved() {
      solvedEl.innerHTML = '';
      if (!game) return;
      const show = game.done ? game.groups : game.groups.filter((g) => game.solved.includes(g.id));
      const order = game.done
        ? [...game.groups.filter((g) => game.solved.includes(g.id)), ...game.groups.filter((g) => !game.solved.includes(g.id))]
        : show.sort((a, b) => game.solved.indexOf(a.id) - game.solved.indexOf(b.id));
      order.forEach((g) => {
        const found = game.solved.includes(g.id);
        solvedEl.append(
          el(
            'div',
            {
              class: `cn-group ${found ? '' : 'is-reveal'}`,
              style: `--c:${g.hex};--ink:${g.ink}`,
              'data-color': g.color
            },
            el('b', {}, g.title),
            el('span', {}, g.words.join(' · ')),
            el('small', {}, `${THEME_LABEL[g.theme] || g.theme} · ${LEVELS[g.difficulty].label}`)
          )
        );
      });
    }

    function renderGrid() {
      grid.innerHTML = '';
      if (!game) return;
      game.board.forEach((w) => {
        const gi = groupOf(game, w);
        if (gi >= 0 && game.solved.includes(game.groups[gi].id)) return;
        grid.append(
          el(
            'button',
            {
              class: `cn-tile ${selected.has(w) ? 'is-on' : ''} ${game.hinted.includes(w) ? 'is-hint' : ''}`,
              disabled: game.done ? true : null,
              'aria-pressed': String(selected.has(w)),
              onclick: () => toggle(w)
            },
            w
          )
        );
      });
    }

    function renderStats() {
      const pct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
      statsEl.innerHTML = '';
      statsEl.append(
        el('h3', { class: 'cn-stats__title' }, t('cn.record')),
        el(
          'div',
          { class: 'cn-stats__nums' },
          ...[
            [t('cn.played'), stats.played],
            [t('cn.wins'), `${pct}%`],
            [t('cn.streak'), stats.streak],
            [t('cn.best'), stats.best],
            [t('cn.losses'), stats.losses],
            [t('cn.fewest'), stats.fewestMistakes == null ? '—' : stats.fewestMistakes]
          ].map(([k, v]) => el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k)))
        ),
        el(
          'div',
          { class: 'cn-legend', 'aria-label': 'Cores de dificuldade' },
          ...LEVELS.map((lv) => el('span', {}, el('i', { style: `--c:${lv.hex}` }), lv.label))
        )
      );
      histEl.innerHTML = '';
      histEl.append(el('h3', { class: 'cn-hist__title' }, t('cn.history')));
      if (!history.length) {
        histEl.append(el('p', { class: 'cn-hist__empty' }, t('cn.empty')));
        return;
      }
      const list = el('div', { class: 'cn-hist__list' });
      history.forEach((h) => {
        list.append(
          el(
            'div',
            { class: `cn-hist__item ${h.won ? 'is-win' : 'is-lose'}` },
            el('b', {}, h.won ? t('common.win') : t('common.lose')),
            el('span', { class: 'cn-hist__cats' }, (h.titles || []).join(' · ')),
            el('span', {}, `${formatDay(h.at)} · ${h.mistakes} ${h.mistakes === 1 ? t('cn.err1') : t('cn.errN')}`)
          )
        );
      });
      histEl.append(list);
    }

    function render() {
      renderToolbar();
      renderResult();
      renderSolved();
      renderGrid();
      renderStats();
    }

    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal-backdrop')) return;
      if (e.target instanceof HTMLElement && e.target.matches('input, select, textarea, button')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKey);

    grid.append(el('div', { class: 'state' }, el('div', { class: 'boot__spinner' }), el('p', {}, 'Embaralhando categorias…')));
    say('Carregando as categorias…');
    renderStage();
    try {
      data = await loadData();
    } catch (err) {
      console.error(err);
      grid.innerHTML = '';
      grid.append(
        el(
          'div',
          { class: 'state state--error' },
          el('h2', {}, 'Não abri a base de categorias'),
          el('p', {}, `Confira data/conexoes/categories.json (npm run conexoes:check). ${err.message || err}`)
        )
      );
      say('Sem categorias, sem jogo. Miau triste.');
      setMood('lose', true);
      return { save: async () => false, unmount: () => cleanup() };
    }
    if (!alive) return { save: async () => false, unmount() {} };

    if (params && params.shot) applyShotDemo();
    else if (!gameOk(game, data.categories)) startGame();
    else {
      setMood(game.done ? (game.won ? 'win' : 'lose') : 'idle', true);
      const { cat } = names();
      say(
        game.done
          ? game.won
            ? `${cat}: ainda tô comemorando!`
            : `${cat}: essa doeu. Nova partida? Fica tranquila.`
          : game.solved.length || game.mistakes
            ? `${cat}: continuando a sua partida! Você tem vidas — fica tranquila.`
            : `${cat}: 16 palavras, 4 grupos. Você tem vidas. Manda ver.`
      );
    }
    render();

    window.__mmpConexoes = {
      data: () => ({
        categories: data.categories.length,
        themes: data.meta.themes,
        combos: data.meta.validFourTuples,
        wordsMin: Math.min(...data.categories.map((c) => c.words.length)),
        wordsMax: Math.max(...data.categories.map((c) => c.words.length))
      }),
      state: () =>
        JSON.parse(JSON.stringify({ game, stats, history, selected: [...selected], mood: catMood, busy, storeVersion: STORE_VERSION })),
      select: (word) => toggle(word),
      submit,
      shuffle: onShuffle,
      hint: onHint,
      clear: onClear,
      newGame: () => {
        startGame();
        render();
      },
      generate: (seed = 1) => generatePuzzle(data.categories, mulberry32(seed))
    };

    function cleanup() {
      alive = false;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
      offProfile && offProfile();
      if (window.__mmpConexoes) delete window.__mmpConexoes;
    }

    return {
      async save() {
        await kv.set(STORE_KEY, { version: STORE_VERSION, game, stats, history, used: [...used] });
        if (game && !game.done) return `Partida salva: ${game.solved.length}/4 grupos, ${remainingLives()} vida${remainingLives() === 1 ? '' : 's'}.`;
        return 'Recorde e histórico do Conexões salvos.';
      },
      unmount() {
        persist();
        cleanup();
      }
    };
  }
};
