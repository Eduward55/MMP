// Termo: adivinhe a palavra musical/felina de 5 letras em 6 tentativas.
import { kv } from '../shared/store.js';
import { el } from '../shared/ui.js';
import { dockSay } from '../shared/companion.js';

const WORDS = ['PIANO', 'SAMBA', 'BANDA', 'CORDA', 'NOTAS', 'SURDO', 'TECLA', 'RITMO', 'TEMPO', 'TOCAR', 'CANTO', 'VERSO', 'BLUES', 'CORAL', 'VIOLA', 'PAUSA', 'PULSO', 'BAIXO', 'METAL', 'MIADO', 'GATOS', 'PATAS', 'RONCO', 'PEIXE', 'CAIXA', 'SINOS', 'HINOS', 'VOZES', 'ECOAR', 'FORRO', 'SOLAR', 'FUNDO', 'NOVOS', 'ARPAS', 'OBOES', 'DISCO', 'PALCO', 'SHOWS', 'RODAS'];
const ROWS = 6;
const LEN = 5;
const KB = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

function newGame() {
  return { answer: WORDS[Math.floor(Math.random() * WORDS.length)], guesses: [], done: false, won: false };
}

function score(guess, answer) {
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

export default {
  id: 'termo',
  title: 'Termo',
  icon: 'termo',
  accent: '#5dff9b',
  desc: 'Adivinhe a palavra musical de 5 letras em 6 tentativas.',
  async mount(root) {
    const saved = (await kv.get('termo').catch(() => null)) || {};
    let stats = saved.stats || { played: 0, wins: 0, streak: 0, best: 0 };
    let game = saved.game && !saved.game.done ? saved.game : newGame();
    let typing = '';

    const board = el('div', { class: 'termo__board', 'aria-label': 'Tabuleiro' });
    const keyboard = el('div', { class: 'termo__kb' });
    const statsEl = el('div', { class: 'termo__stats' });
    const msg = el('p', { class: 'termo__msg' }, 'Palavras de música e de gato. Acentos não importam.');

    function letterStates() {
      const st = {};
      const rank = { absent: 0, present: 1, correct: 2 };
      game.guesses.forEach((g) => {
        score(g, game.answer).forEach((s, i) => {
          if (st[g[i]] === undefined || rank[s] > rank[st[g[i]]]) st[g[i]] = s;
        });
      });
      return st;
    }

    function render() {
      board.innerHTML = '';
      for (let r = 0; r < ROWS; r++) {
        const row = el('div', { class: 'termo__row' });
        const g = game.guesses[r];
        const res = g ? score(g, game.answer) : null;
        const text = g || (r === game.guesses.length && !game.done ? typing : '');
        for (let i = 0; i < LEN; i++) {
          row.append(el('div', { class: `tile ${res ? `tile--${res[i]}` : text[i] ? 'tile--typed' : ''}`, style: `--i:${i}` }, text[i] || ''));
        }
        board.append(row);
      }
      const st = letterStates();
      keyboard.innerHTML = '';
      KB.forEach((line, li) => {
        const row = el('div', { class: 'termo__kbrow' });
        if (li === 2) row.append(el('button', { class: 'key key--wide', onclick: () => press('Enter') }, 'Enviar'));
        [...line].forEach((ch) => row.append(el('button', { class: `key ${st[ch] ? `key--${st[ch]}` : ''}`, onclick: () => press(ch) }, ch)));
        if (li === 2) row.append(el('button', { class: 'key key--wide', onclick: () => press('Backspace'), 'aria-label': 'Apagar letra' }, 'Apagar'));
        keyboard.append(row);
      });
      statsEl.innerHTML = '';
      [
        ['Jogos', stats.played],
        ['Vitórias', stats.wins],
        ['Sequência', stats.streak],
        ['Recorde', stats.best]
      ].forEach(([k, v]) => statsEl.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k))));
    }

    function finish(won) {
      game.done = true;
      game.won = won;
      stats.played++;
      if (won) {
        stats.wins++;
        stats.streak++;
        stats.best = Math.max(stats.best, stats.streak);
        msg.textContent = `Acertou! Era ${game.answer}. Que ouvido afinado!`;
        dockSay('Miau! Você acertou o Termo!');
      } else {
        stats.streak = 0;
        msg.textContent = `Quase! A palavra era ${game.answer}.`;
      }
      kv.set('termo', { stats, game }).catch(() => {});
    }

    function press(key) {
      if (game.done) return;
      if (key === 'Enter') {
        if (typing.length < LEN) {
          msg.textContent = 'A palavra precisa de 5 letras.';
          board.children[game.guesses.length]?.classList.add('is-shake');
          return;
        }
        game.guesses.push(typing);
        const won = typing === game.answer;
        typing = '';
        if (won || game.guesses.length >= ROWS) finish(won);
        else msg.textContent = `${ROWS - game.guesses.length} tentativas restantes.`;
      } else if (key === 'Backspace') {
        typing = typing.slice(0, -1);
      } else if (/^[A-Z]$/.test(key) && typing.length < LEN) {
        typing += key;
      }
      render();
    }

    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace') press(e.key);
      else if (e.key.length === 1) press(norm(e.key));
    };
    window.addEventListener('keydown', onKey);

    root.append(
      el(
        'section',
        { class: 'panel termo' },
        el(
          'div',
          { class: 'termo__head' },
          statsEl,
          el('button', {
            class: 'btn btn--ghost',
            onclick: () => {
              if (!game.done && game.guesses.length) {
                stats.played++;
                stats.streak = 0;
              }
              game = newGame();
              typing = '';
              msg.textContent = 'Nova palavra! Boa sorte.';
              render();
            }
          }, 'Nova palavra')
        ),
        msg,
        board,
        keyboard
      )
    );
    render();

    return {
      async save() {
        await kv.set('termo', { stats, game });
        return 'Progresso do Termo salvo.';
      },
      unmount() {
        window.removeEventListener('keydown', onKey);
        kv.set('termo', { stats, game }).catch(() => {});
      }
    };
  }
};
