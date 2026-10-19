// Termo: adivinhe palavras de 5 letras em português (acentos não importam). Modos Simples, Dueto e Quarteto.
// As listas vêm de data/termo (geradas por scripts/build-termo-words.mjs a partir de dicionários reais).
import { kv, getProfile, onProfile } from '../shared/store.js';
import { creatureSVG } from '../shared/creatures.js';
import { el, esc, toast, confirmDialog } from '../shared/ui.js';

const LEN = 5;
const KB = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const MODES = [
  { id: 'simples', label: 'Simples', boards: 1 },
  { id: 'dueto', label: 'Dueto', boards: 2 },
  { id: 'quarteto', label: 'Quarteto', boards: 4 }
];
const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m]));
const THEMES = [
  { id: 'todos', label: 'Todos os temas' },
  { id: 'psicologia', label: 'Psicologia' },
  { id: 'arte', label: 'Arte' },
  { id: 'historia', label: 'História' },
  { id: 'gerais', label: 'Gerais' }
];
const THEME_LABEL = Object.fromEntries(THEMES.map((t) => [t.id, t.label]));
const MIN_ATTEMPTS = 4;
const MAX_ATTEMPTS = 15;
const DEFAULT_SETTINGS = { mode: 'simples', attempts: 10, theme: 'todos' };
const RANK = { absent: 0, present: 1, correct: 2 };
const REVEAL_MS = 5 * 110 + 320;

export const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function score(guess, answer) {
  const res = new Array(LEN).fill('absent');
  const pool = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === answer[i]) res[i] = 'correct';
    else pool[answer[i]] = (pool[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (res[i] !== 'correct' && pool[guess[i]]) {
      res[i] = 'present';
      pool[guess[i]]--;
    }
  }
  return res;
}

let wordsPromise = null;
function loadWords() {
  if (!wordsPromise) {
    const get = (f) =>
      fetch(new URL(`../../data/termo/${f}`, import.meta.url)).then((r) => {
        if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
        return r.json();
      });
    wordsPromise = Promise.all([get('answers.json'), get('valid.json')]).then(([a, v]) => {
      const answers = a.answers.filter((x) => x.word.length === LEN);
      const valid = new Set(v.words);
      answers.forEach((x) => valid.add(x.word));
      return { answers, valid, themes: a.themes };
    });
    wordsPromise.catch(() => (wordsPromise = null));
  }
  return wordsPromise;
}

const emptyStats = () => ({ played: 0, wins: 0, streak: 0, best: 0, dist: {}, losses: 0 });
const randInt = (n) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
};
const clampAttempts = (n) => (Number.isFinite(Number(n)) ? Math.max(MIN_ATTEMPTS, Math.min(MAX_ATTEMPTS, Math.round(Number(n)))) : DEFAULT_SETTINGS.attempts);

export default {
  id: 'termo',
  title: 'Termo',
  icon: 'termo',
  accent: '#5dff9b',
  desc: 'Palavras de 5 letras em português: Simples, Dueto ou Quarteto, com estatísticas.',
  hideDock: true,
  async mount(root) {
    const saved = (await kv.get('termo').catch(() => null)) || {};
    const settings = { ...DEFAULT_SETTINGS, ...(saved.settings || {}) };
    settings.attempts = clampAttempts(settings.attempts);
    if (!MODE_BY_ID[settings.mode]) settings.mode = 'simples';
    const stats = Object.fromEntries(MODES.map((m) => [m.id, { ...emptyStats(), ...((saved.stats || {})[m.id] || {}) }]));
    const games = { ...(saved.games || {}) };
    const used = new Set(Array.isArray(saved.used) ? saved.used : []);
    let words = null;
    let slots = Array(LEN).fill('');
    let cursor = 0;
    let revealRow = -1;
    let catMood = 'idle';
    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };

    const game = () => games[settings.mode];
    const persist = () => kv.set('termo', { version: 2, settings, stats, games, used: [...used] }).catch(() => {});
    const typingOf = () => slots.join('');
    const resetInput = () => {
      slots = Array(LEN).fill('');
      cursor = 0;
    };
    const everydayWord = (a, byTheme) => {
      if (a.theme !== 'gerais') return true;
      const list = byTheme.gerais || [];
      return list.indexOf(a.word) < Math.min(400, list.length);
    };

    // ---------- Elementos ----------
    const stage = el('div', { class: 'tm-stage' });
    const bubble = el('p', { class: 'tm-bubble', role: 'status', 'aria-live': 'polite' });
    const modeTabs = el('div', { class: 'segmented tm-modes', role: 'radiogroup', 'aria-label': 'Modo de jogo' });
    const themeSel = el('select', { class: 'input input--select tm-theme', 'aria-label': 'Tema das palavras' });
    THEMES.forEach((t) => themeSel.append(el('option', { value: t.id }, t.label)));
    const attemptsOut = el('output', { class: 'tm-attempts__n', 'aria-live': 'polite' });
    const attemptsDown = el('button', { class: 'btn btn--sm', 'aria-label': 'Menos tentativas', onclick: () => changeAttempts(-1) }, '−');
    const attemptsUp = el('button', { class: 'btn btn--sm', 'aria-label': 'Mais tentativas', onclick: () => changeAttempts(1) }, '+');
    const newBtn = el('button', { class: 'btn btn--primary tm-new', onclick: () => askNewGame() }, 'Nova partida');
    const statsEl = el('div', { class: 'tm-stats', 'aria-label': 'Estatísticas' });
    const result = el('div', { class: 'tm-result', hidden: true });
    const boardsEl = el('div', { class: 'tm-boards' });
    const kbEl = el('div', { class: 'tm-kb', role: 'group', 'aria-label': 'Teclado' });
    const main = el('div', { class: 'tm-main' }, result, boardsEl, kbEl);
    const section = el(
      'section',
      { class: 'tm' },
      el('div', { class: 'tm-side tm-side--stage' }, stage, bubble),
      el(
        'div',
        { class: 'tm-side tm-side--controls panel' },
        el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Modo'), modeTabs),
        el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Tema'), themeSel),
        el(
          'div',
          { class: 'field' },
          el('span', { class: 'field__label' }, 'Tentativas'),
          el('div', { class: 'tm-attempts' }, attemptsDown, attemptsOut, attemptsUp)
        ),
        newBtn
      ),
      el('div', { class: 'tm-side tm-side--stats panel' }, statsEl),
      main
    );
    root.append(section);

    // ---------- Gato e lontra ----------
    let catEl = null;
    function renderStage(p = getProfile()) {
      stage.innerHTML = `
        <div class="tm-stage__fx" aria-hidden="true"></div>
        <figure class="tm-stage__cat">${creatureSVG('cat', p.cat, { size: 132, label: `Gato ${p.cat.name}` })}
          <span class="tm-tear tm-tear--l" aria-hidden="true"></span><span class="tm-tear tm-tear--r" aria-hidden="true"></span>
        </figure>
        <figure class="tm-stage__otter">${creatureSVG('otter', p.otter, { size: 92, label: `Lontra ${p.otter.name}` })}</figure>`;
      catEl = stage.querySelector('.tm-stage__cat');
      setMood(catMood, true);
    }
    const offProfile = onProfile((p) => renderStage(p));

    function setMood(mood, quiet = false) {
      catMood = mood;
      stage.dataset.mood = mood;
      const fx = stage.querySelector('.tm-stage__fx');
      if (!fx) return;
      fx.innerHTML = '';
      if (mood === 'win' && !quiet) {
        const colors = ['#8b5cf6', '#a78bfa', '#4ade80', '#eab308', '#a1a1aa'];
        for (let i = 0; i < 28; i++) {
          fx.append(
            el('i', {
              class: 'tm-confetti',
              style: `--x:${randInt(100)}%;--d:${(randInt(60) / 100 + 0.9).toFixed(2)}s;--delay:${(randInt(50) / 100).toFixed(2)}s;--r:${randInt(360)}deg;background:${colors[i % colors.length]}`
            })
          );
        }
      }
      if (mood === 'win') for (let i = 0; i < 4; i++) fx.append(el('b', { class: 'tm-heart', style: `--i:${i}` }, '♥'));
    }

    function say(text) {
      bubble.textContent = text;
      bubble.classList.remove('is-pop');
      void bubble.offsetWidth;
      bubble.classList.add('is-pop');
    }

    // ---------- Partidas ----------
    function draw(n, theme) {
      const fits = (a) => theme === 'todos' || a.theme === theme;
      const byTheme = {};
      words.answers.forEach((a) => (byTheme[a.theme] = byTheme[a.theme] || []).push(a.word));
      const prefer = (a) => everydayWord(a, byTheme);
      let pool = words.answers.filter((a) => fits(a) && !used.has(a.word) && prefer(a));
      if (pool.length < n) pool = words.answers.filter((a) => fits(a) && !used.has(a.word));
      if (pool.length < n) {
        words.answers.filter(fits).forEach((a) => used.delete(a.word));
        pool = words.answers.filter((a) => fits(a) && prefer(a));
        if (pool.length < n) pool = words.answers.filter(fits);
        toast(`Você já viu todas as palavras de ${THEME_LABEL[theme].toLowerCase()}! Embaralhando de novo.`, 'ok', 3600);
      }
      const picked = [];
      while (picked.length < n && pool.length) picked.push(pool.splice(randInt(pool.length), 1)[0]);
      picked.forEach((a) => used.add(a.word));
      return picked;
    }

    function newGame(modeId = settings.mode) {
      const mode = MODE_BY_ID[modeId];
      games[modeId] = {
        mode: modeId,
        attempts: settings.attempts,
        theme: settings.theme,
        answers: draw(mode.boards, settings.theme),
        guesses: [],
        solvedAt: new Array(mode.boards).fill(null),
        done: false,
        won: false,
        startedAt: new Date().toISOString()
      };
      resetInput();
      revealRow = -1;
      setMood('idle');
      const n = mode.boards;
      say(
        n === 1
          ? `${getProfile().cat.name}: pensei numa palavra de 5 letras. Você tem ${settings.attempts} tentativas!`
          : `${getProfile().cat.name}: ${n} palavras ao mesmo tempo, ${settings.attempts} tentativas. Cada palpite vale para todos os tabuleiros.`
      );
      persist();
    }

    function abandonIfPlaying() {
      const g = game();
      if (g && !g.done && g.guesses.length) {
        const s = stats[g.mode];
        s.played++;
        s.losses++;
        s.streak = 0;
      }
    }

    async function askNewGame() {
      const g = game();
      if (g && !g.done && g.guesses.length) {
        const okNew = await confirmDialog({
          title: 'Começar outra partida?',
          message: 'A partida atual ainda não acabou e vai contar como derrota nas estatísticas.',
          confirm: 'Nova partida',
          danger: true
        });
        if (!okNew) return;
        abandonIfPlaying();
      }
      newGame();
      render();
    }

    function finish(won) {
      const g = game();
      g.done = true;
      g.won = won;
      g.finishedAt = new Date().toISOString();
      const s = stats[g.mode];
      s.played++;
      if (won) {
        s.wins++;
        s.streak++;
        s.best = Math.max(s.best, s.streak);
        const k = String(g.guesses.length);
        s.dist[k] = (s.dist[k] || 0) + 1;
      } else {
        s.losses++;
        s.streak = 0;
      }
      persist();
      later(() => {
        setMood(won ? 'win' : 'lose');
        const name = getProfile().cat.name;
        const list = g.answers.map((a) => a.display.toUpperCase()).join(', ');
        say(
          won
            ? `${name}: MIAU! Você acertou em ${g.guesses.length} tentativa${g.guesses.length > 1 ? 's' : ''}! Sequência: ${s.streak}.`
            : `${name}: buáá… ${g.answers.length > 1 ? 'As palavras eram' : 'A palavra era'} ${list}.`
        );
        render();
      }, REVEAL_MS);
    }

    function submit() {
      const g = game();
      if (!g || g.done) return;
      if (slots.some((s) => !s)) {
        shake('Faltam letras: clique numa casa ou aperte espaço para pular.');
        return;
      }
      const typing = typingOf();
      if (!words.valid.has(typing)) {
        shake(`"${typing.toUpperCase()}" não está na lista de palavras.`);
        return;
      }
      const row = g.guesses.length;
      g.guesses.push(typing);
      let newlySolved = 0;
      g.answers.forEach((a, b) => {
        if (g.solvedAt[b] === null && a.word === typing) {
          g.solvedAt[b] = row;
          newlySolved++;
        }
      });
      resetInput();
      revealRow = row;
      const allSolved = g.solvedAt.every((x) => x !== null);
      if (allSolved) finish(true);
      else if (g.guesses.length >= g.attempts) finish(false);
      else {
        persist();
        const left = g.attempts - g.guesses.length;
        if (newlySolved) {
          later(() => {
            setMood('yay');
            say(`${getProfile().otter.name}: uma já foi! Faltam ${g.solvedAt.filter((x) => x === null).length}. ${left} tentativa${left > 1 ? 's' : ''}.`);
            later(() => catMood === 'yay' && setMood('idle'), 1400);
          }, REVEAL_MS);
        } else if (left <= 2) {
          later(() => {
            setMood('worried');
            say(`${getProfile().cat.name}: ${left === 1 ? 'última tentativa!' : 'só mais 2 tentativas…'}`);
          }, REVEAL_MS);
        }
      }
      render();
      later(() => (revealRow = -1), REVEAL_MS);
    }

    function shake(text) {
      toast(text, 'error', 1800);
      boardsEl.querySelectorAll('.tm-row.is-current').forEach((r) => {
        r.classList.remove('is-shake');
        void r.offsetWidth;
        r.classList.add('is-shake');
      });
    }

    function press(key) {
      const g = game();
      if (!g || g.done || !words) return;
      if (key === 'enter') return submit();
      if (key === 'space') {
        cursor = Math.min(LEN - 1, cursor + 1);
        renderBoards();
        return;
      }
      if (key === 'arrowleft') {
        cursor = Math.max(0, cursor - 1);
        renderBoards();
        return;
      }
      if (key === 'arrowright') {
        cursor = Math.min(LEN - 1, cursor + 1);
        renderBoards();
        return;
      }
      if (key === 'backspace') {
        if (cursor >= LEN) cursor = LEN - 1;
        if (slots[cursor]) slots[cursor] = '';
        else if (cursor > 0) {
          cursor -= 1;
          slots[cursor] = '';
        }
        renderBoards();
        return;
      }
      if (/^[a-z]$/.test(key)) {
        const i = cursor >= LEN ? LEN - 1 : cursor;
        slots[i] = key;
        cursor = Math.min(LEN, i + 1);
        renderBoards(true, i);
        return;
      }
    }

    async function setMode(id) {
      if (id === settings.mode) return;
      settings.mode = id;
      if (!games[id] || (games[id].done && settingsDiffer(games[id]))) newGame(id);
      resetInput();
      revealRow = -1;
      const g = game();
      setMood(g.done ? (g.won ? 'win' : 'lose') : 'idle', true);
      say(g.done ? doneLine(g) : g.guesses.length ? 'Continuando de onde você parou.' : `Modo ${MODE_BY_ID[id].label}: boa sorte!`);
      persist();
      render();
    }

    const doneLine = (g) =>
      g.won
        ? `${getProfile().cat.name}: ainda tô comemorando essa vitória! Bora outra? Clique em Jogar de novo.`
        : `${getProfile().cat.name}: snif… essa foi difícil. Clique em Jogar de novo pra revanche.`;

    const settingsDiffer = (g) => g.attempts !== settings.attempts || g.theme !== settings.theme;

    function applySettings(what) {
      const g = game();
      if (!g || g.done || !g.guesses.length) {
        newGame();
      } else {
        toast(`${what} vale a partir da próxima partida.`, 'info');
        persist();
      }
      render();
    }

    function changeAttempts(delta) {
      const next = clampAttempts(settings.attempts + delta);
      if (next === settings.attempts) return;
      settings.attempts = next;
      applySettings(`${next} tentativas`);
    }

    themeSel.addEventListener('change', () => {
      settings.theme = themeSel.value;
      applySettings(`O tema ${THEME_LABEL[settings.theme]}`);
    });

    // ---------- Desenho ----------
    function columns() {
      const n = MODE_BY_ID[settings.mode].boards;
      if (n === 4) return main.clientWidth >= 720 ? 4 : 2;
      return n;
    }

    function fitTiles() {
      const g = game();
      if (!g) return;
      const cols = columns();
      const n = g.answers.length;
      const rowsOfBoards = Math.ceil(n / cols);
      const width = main.clientWidth || 600;
      const boardGap = cols > 1 ? 18 : 0;
      const byWidth = (width - boardGap * (cols - 1)) / cols / (LEN + (LEN - 1) * 0.12 + 0.3);
      const top = boardsEl.getBoundingClientRect().top;
      const kbH = kbEl.offsetHeight || 170;
      const avail = window.innerHeight - Math.max(top, 0) - kbH - 32;
      const byHeight = avail / rowsOfBoards / (g.attempts * 1.12 + 0.4);
      const tile = Math.max(18, Math.min(58, Math.floor(Math.min(byWidth, rowsOfBoards > 1 ? Math.max(byHeight, 24) : Math.max(byHeight, 26)))));
      section.style.setProperty('--tile', `${tile}px`);
      section.style.setProperty('--cols', cols);
    }

    function boardLetterStates(g, b) {
      const st = {};
      const end = g.solvedAt[b] === null ? g.guesses.length : g.solvedAt[b] + 1;
      for (let r = 0; r < end; r++) {
        const guess = g.guesses[r];
        score(guess, g.answers[b].word).forEach((s, i) => {
          if (st[guess[i]] === undefined || RANK[s] > RANK[st[guess[i]]]) st[guess[i]] = s;
        });
      }
      return st;
    }

    function renderBoards(pop = false, popAt = -1) {
      const g = game();
      boardsEl.innerHTML = '';
      boardsEl.dataset.boards = g.answers.length;
      const cursorAt = cursor >= LEN ? LEN - 1 : cursor;
      g.answers.forEach((a, b) => {
        const solved = g.solvedAt[b];
        const board = el('div', {
          class: `tm-board ${solved !== null ? 'is-solved' : ''} ${g.done && solved === null ? 'is-failed' : ''}`,
          'aria-label': `Tabuleiro ${b + 1}${solved !== null ? ', resolvido' : ''}`
        });
        for (let r = 0; r < g.attempts; r++) {
          const guess = g.guesses[r];
          const isCurrent = !g.done && solved === null && r === g.guesses.length;
          const row = el('div', { class: `tm-row ${isCurrent ? 'is-current' : ''}` });
          const filled = guess && (solved === null || r <= solved);
          const res = filled ? score(guess, a.word) : null;
          const letters = filled ? (r === solved ? [...a.display.normalize('NFC')] : [...guess]) : isCurrent ? slots : [];
          const reveal = filled && r === revealRow;
          const win = r === solved;
          for (let i = 0; i < LEN; i++) {
            const ch = letters[i] || '';
            const cls = ['tm-tile'];
            if (res) cls.push(`tm-tile--${res[i]}`);
            else if (ch) cls.push('tm-tile--typed');
            if (reveal) cls.push('is-reveal');
            if (win) cls.push('is-win');
            if (pop && isCurrent && i === popAt) cls.push('is-pop');
            if (isCurrent && i === cursorAt) cls.push('is-cursor');
            row.append(
              el(
                'div',
                {
                  class: cls.join(' '),
                  style: `--i:${i}`,
                  onclick: isCurrent
                    ? () => {
                        cursor = i;
                        renderBoards();
                      }
                    : undefined
                },
                ch.toUpperCase()
              )
            );
          }
          board.append(row);
        }
        if (g.done) {
          board.append(
            el(
              'div',
              { class: `tm-answer ${solved !== null ? 'is-ok' : ''}` },
              el('b', {}, a.display.toUpperCase()),
              el('span', { class: 'tm-answer__theme' }, THEME_LABEL[a.theme] || a.theme)
            )
          );
        }
        boardsEl.append(board);
      });
      fitTiles();
    }

    function keyBackground(g, ch) {
      const colors = { correct: '#3f8f63', present: '#b08d2e', absent: '#3f3f46' };
      const neutral = '#1c1c22';
      const parts = g.answers.map((_, b) => {
        if (g.solvedAt[b] !== null) return '#0f0f12';
        const s = boardStatesCache[b][ch];
        return s ? colors[s] : neutral;
      });
      if (parts.length === 1) return { state: g.answers.map((_, b) => boardStatesCache[b][ch])[0] || '', style: '' };
      const states = g.answers.map((_, b) => boardStatesCache[b][ch]).filter(Boolean);
      const allAbsent = states.length === g.answers.length && states.every((s) => s === 'absent');
      if (parts.length === 2) return { state: allAbsent ? 'absent' : '', style: `background:linear-gradient(90deg,${parts[0]} 50%,${parts[1]} 50%)` };
      return {
        state: allAbsent ? 'absent' : '',
        style: `background:linear-gradient(90deg,${parts[0]} 50%,${parts[1]} 50%) top/100% 50% no-repeat,linear-gradient(90deg,${parts[2]} 50%,${parts[3]} 50%) bottom/100% 50% no-repeat`
      };
    }

    let boardStatesCache = [];
    function renderKeyboard() {
      const g = game();
      boardStatesCache = g.answers.map((_, b) => boardLetterStates(g, b));
      kbEl.innerHTML = '';
      kbEl.dataset.boards = g.answers.length;
      KB.forEach((line, li) => {
        const row = el('div', { class: 'tm-kbrow' });
        if (li === 2) row.append(el('button', { class: 'tm-key tm-key--wide', 'data-key': 'enter', onclick: () => press('enter') }, 'Enviar'));
        [...line].forEach((ch) => {
          const { state, style } = keyBackground(g, ch);
          row.append(
            el(
              'button',
              { class: `tm-key ${state ? `tm-key--${state}` : ''}`, style: style || undefined, 'data-key': ch, 'aria-label': `Letra ${ch.toUpperCase()}`, onclick: () => press(ch) },
              ch.toUpperCase()
            )
          );
        });
        if (li === 2) row.append(el('button', { class: 'tm-key tm-key--wide', 'data-key': 'backspace', 'aria-label': 'Apagar letra', onclick: () => press('backspace') }, 'Apagar'));
        kbEl.append(row);
      });
    }

    function renderStats() {
      const s = stats[settings.mode];
      const pct = s.played ? Math.round((s.wins / s.played) * 100) : 0;
      statsEl.innerHTML = '';
      statsEl.append(
        el('h3', { class: 'tm-stats__title' }, `Estatísticas · ${MODE_BY_ID[settings.mode].label}`),
        el(
          'div',
          { class: 'tm-stats__nums' },
          ...[
            ['Jogos', s.played],
            ['Vitórias', `${pct}%`],
            ['Sequência', s.streak],
            ['Recorde', s.best]
          ].map(([k, v]) => el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k)))
        )
      );
      const keys = Object.keys(s.dist).map(Number);
      const maxK = Math.max(settings.attempts, ...keys, 1);
      const minK = MODE_BY_ID[settings.mode].boards;
      const rows = [];
      for (let k = minK; k <= maxK; k++) rows.push([String(k), s.dist[k] || 0]);
      rows.push(['✕', s.losses || 0]);
      const top = Math.max(1, ...rows.map((r) => r[1]));
      const g = game();
      const hl = g && g.done ? (g.won ? String(g.guesses.length) : '✕') : null;
      const dist = el('div', { class: 'tm-dist', 'aria-label': 'Distribuição de tentativas' });
      rows.forEach(([k, v]) =>
        dist.append(
          el(
            'div',
            { class: `tm-dist__row ${hl === k ? 'is-last' : ''}` },
            el('span', { class: 'tm-dist__k' }, k),
            el('span', { class: 'tm-dist__bar', style: `--w:${Math.max(6, (v / top) * 100)}%` }, String(v))
          )
        )
      );
      statsEl.append(el('p', { class: 'tm-stats__sub' }, 'Vitórias por número de tentativas'), dist);
      if (!s.played) statsEl.append(el('p', { class: 'tm-stats__empty' }, 'Nenhuma partida neste modo ainda. A primeira é por conta da casa!'));
    }

    function renderResult() {
      const g = game();
      result.hidden = !g.done;
      if (!g.done) return;
      result.className = `tm-result ${g.won ? 'is-win' : 'is-lose'}`;
      result.innerHTML = '';
      result.append(
        el('strong', {}, g.won ? `Vitória em ${g.guesses.length}/${g.attempts}!` : `Não foi dessa vez (${g.solvedAt.filter((x) => x !== null).length}/${g.answers.length} resolvidas)`),
        el(
          'span',
          { class: 'tm-result__words' },
          ...g.answers.map((a) => el('span', { class: 'tm-chip', html: `${esc(a.display.toUpperCase())} <small>${esc(THEME_LABEL[a.theme] || a.theme)}</small>` }))
        ),
        el('button', { class: 'btn btn--primary btn--sm', onclick: () => askNewGame() }, 'Jogar de novo')
      );
    }

    function renderControls() {
      modeTabs.innerHTML = '';
      MODES.forEach((m) =>
        modeTabs.append(
          el(
            'button',
            { class: `segmented__btn ${settings.mode === m.id ? 'is-on' : ''}`, role: 'radio', 'aria-checked': String(settings.mode === m.id), onclick: () => setMode(m.id) },
            m.label,
            ' ',
            el('small', {}, m.boards === 1 ? '1×' : `${m.boards}×`)
          )
        )
      );
      themeSel.value = settings.theme;
      attemptsOut.textContent = String(settings.attempts);
      attemptsDown.disabled = settings.attempts <= MIN_ATTEMPTS;
      attemptsUp.disabled = settings.attempts >= MAX_ATTEMPTS;
      section.dataset.mode = settings.mode;
    }

    function render() {
      renderControls();
      renderResult();
      renderBoards();
      renderKeyboard();
      renderStats();
    }

    // ---------- Teclado físico e redimensionamento ----------
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal-backdrop')) return;
      if (e.target instanceof HTMLElement && e.target.matches('input, select, textarea')) return;
      const k =
        e.key === 'Enter'
          ? 'enter'
          : e.key === 'Backspace'
            ? 'backspace'
            : e.key === ' '
              ? 'space'
              : e.key === 'ArrowLeft'
                ? 'arrowleft'
                : e.key === 'ArrowRight'
                  ? 'arrowright'
                  : e.key.length === 1
                    ? norm(e.key)
                    : '';
      if (!k) return;
      if (k === 'enter' || k === 'backspace' || k === 'space' || k === 'arrowleft' || k === 'arrowright' || /^[a-z]$/.test(k)) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener('keydown', onKey);
    let lastWidth = 0;
    let fitFrame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => alive && game() && fitTiles());
    };
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w !== lastWidth) {
        lastWidth = w;
        scheduleFit();
      }
    });
    ro.observe(main);
    const onResize = scheduleFit;
    window.addEventListener('resize', onResize);

    // ---------- Início ----------
    renderStage();
    renderControls();
    boardsEl.append(el('div', { class: 'state' }, el('div', { class: 'boot__spinner' }), el('p', {}, 'Abrindo o dicionário…')));
    say('Carregando as palavras…');
    try {
      words = await loadWords();
    } catch (err) {
      console.error(err);
      boardsEl.innerHTML = '';
      boardsEl.append(
        el(
          'div',
          { class: 'state state--error' },
          el('h2', {}, 'Não consegui abrir as listas de palavras'),
          el('p', {}, `Confira se data/termo/answers.json e valid.json existem (npm run termo:words). ${err.message || err}`)
        )
      );
      say('Sem palavras, sem jogo. Miau triste.');
      setMood('lose', true);
      return { save: async () => false, unmount: () => cleanup() };
    }
    if (!alive) return { save: async () => false, unmount() {} };
    const g0 = game();
    if (!g0 || !g0.answers || !g0.answers.length) newGame();
    else {
      setMood(g0.done ? (g0.won ? 'win' : 'lose') : 'idle', true);
      say(g0.done ? doneLine(g0) : g0.guesses.length ? `${getProfile().cat.name}: continuando a sua partida!` : 'Pode começar: digite uma palavra de 5 letras.');
    }
    render();

    window.__mmpTermo = {
      words: () => ({ answers: words.answers.length, valid: words.valid.size, themes: words.themes }),
      state: () => JSON.parse(JSON.stringify({ settings, game: game(), stats, used: [...used], typing: typingOf(), slots: [...slots], cursor, mood: catMood })),
      isValid: (w) => words.valid.has(norm(w)),
      score,
      type: (w) => [...norm(w)].forEach((ch) => press(ch)),
      press,
      setMode,
      changeAttempts,
      newGame: () => {
        abandonIfPlaying();
        newGame();
        render();
      },
      answers: () => game().answers.map((a) => a.word)
    };

    function cleanup() {
      alive = false;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(fitFrame);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      offProfile && offProfile();
      if (window.__mmpTermo) delete window.__mmpTermo;
    }

    return {
      async save() {
        await kv.set('termo', { version: 2, settings, stats, games, used: [...used] });
        const g = game();
        return g && !g.done && g.guesses.length ? `Partida salva: ${g.guesses.length}/${g.attempts} tentativas.` : 'Configurações e estatísticas do Termo salvas.';
      },
      unmount() {
        persist();
        cleanup();
      }
    };
  }
};
