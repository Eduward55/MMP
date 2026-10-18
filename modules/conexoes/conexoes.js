// Conexões: encontre os 4 grupos de 4 palavras que têm algo em comum.
import { kv } from '../shared/store.js';
import { el, toast } from '../shared/ui.js';
import { dockSay } from '../shared/companion.js';

const PUZZLES = [
  [
    { title: 'Instrumentos de corda', words: ['VIOLÃO', 'HARPA', 'BANDOLIM', 'CAVAQUINHO'] },
    { title: 'Coisas que gato ama', words: ['CAIXA', 'NOVELO', 'SACHÊ', 'SOL'] },
    { title: 'Gêneros brasileiros', words: ['SAMBA', 'FORRÓ', 'FREVO', 'BAIÃO'] },
    { title: 'Notas musicais', words: ['DÓ', 'RÉ', 'MI', 'FÁ'] }
  ],
  [
    { title: 'Partes do gato', words: ['BIGODE', 'PATA', 'RABO', 'ORELHA'] },
    { title: 'Percussão', words: ['SURDO', 'PANDEIRO', 'TAMBORIM', 'CUÍCA'] },
    { title: 'Andamentos', words: ['ALLEGRO', 'ADAGIO', 'PRESTO', 'LARGO'] },
    { title: 'Coisas de lontra', words: ['RIO', 'PEDRINHA', 'PEIXE', 'BOIAR'] }
  ],
  [
    { title: 'Sopros', words: ['FLAUTA', 'TROMPETE', 'SAX', 'CLARINETE'] },
    { title: 'Sons de gato', words: ['MIAU', 'RONRON', 'CHIADO', 'TRILO'] },
    { title: 'Dinâmicas', words: ['PIANO', 'FORTE', 'CRESCENDO', 'PIANISSIMO'] },
    { title: 'Coisas de estúdio', words: ['MICROFONE', 'MESA', 'FONE', 'CABO'] }
  ]
];

const COLORS = ['#ffd23f', '#5dff9b', '#5ff3ff', '#ff4fd8'];
const MAX_MISTAKES = 4;

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fresh(index) {
  return { index, order: shuffle(PUZZLES[index].flatMap((g) => g.words)), solved: [], mistakes: 0, done: false };
}

export default {
  id: 'conexoes',
  title: 'Conexões',
  icon: 'conexoes',
  accent: '#ff8fd0',
  desc: 'Agrupe 16 palavras em 4 grupos secretos.',
  async mount(root) {
    const saved = await kv.get('conexoes').catch(() => null);
    let st = saved && saved.order && PUZZLES[saved.index] ? saved : fresh(0);
    let selected = new Set();

    const solvedEl = el('div', { class: 'conn__solved' });
    const grid = el('div', { class: 'conn__grid' });
    const info = el('p', { class: 'conn__info' });
    const submit = el('button', { class: 'btn btn--primary' }, 'Enviar');

    const groupOf = (w) => PUZZLES[st.index].findIndex((g) => g.words.includes(w));

    function render() {
      const puzzle = PUZZLES[st.index];
      solvedEl.innerHTML = '';
      st.solved.forEach((gi) => {
        solvedEl.append(el('div', { class: 'conn__group', style: `--c:${COLORS[gi]}` }, el('b', {}, puzzle[gi].title), el('span', {}, puzzle[gi].words.join(' · '))));
      });
      grid.innerHTML = '';
      st.order
        .filter((w) => !st.solved.includes(groupOf(w)))
        .forEach((w) => {
          grid.append(
            el('button', {
              class: `conn__tile ${selected.has(w) ? 'is-on' : ''}`,
              disabled: st.done ? true : null,
              onclick: () => {
                if (selected.has(w)) selected.delete(w);
                else if (selected.size < 4) selected.add(w);
                render();
              }
            }, w)
          );
        });
      const hearts = '♥'.repeat(MAX_MISTAKES - st.mistakes) + '♡'.repeat(st.mistakes);
      info.textContent = st.done
        ? st.solved.length === 4
          ? 'Todos os grupos encontrados! Bravo!'
          : 'Acabaram as vidas. Os grupos estão revelados acima.'
        : `Puzzle ${st.index + 1}/${PUZZLES.length} · Vidas: ${hearts}`;
      submit.disabled = selected.size !== 4 || st.done;
    }

    function check() {
      const words = [...selected];
      const groups = words.map(groupOf);
      if (groups.every((g) => g === groups[0])) {
        st.solved.push(groups[0]);
        selected = new Set();
        if (st.solved.length === 4) {
          st.done = true;
          dockSay('Uau! Conexões completas!');
        }
      } else {
        st.mistakes++;
        const counts = {};
        groups.forEach((g) => (counts[g] = (counts[g] || 0) + 1));
        if (Math.max(...Object.values(counts)) === 3) toast('Quase! Falta uma.', 'warn');
        else toast('Não é um grupo.', 'info');
        if (st.mistakes >= MAX_MISTAKES) {
          st.done = true;
          st.solved = [...st.solved, ...[0, 1, 2, 3].filter((g) => !st.solved.includes(g))];
        }
      }
      render();
    }

    submit.addEventListener('click', check);

    root.append(
      el(
        'section',
        { class: 'panel conn' },
        info,
        solvedEl,
        grid,
        el(
          'div',
          { class: 'row-actions' },
          submit,
          el('button', {
            class: 'btn btn--ghost',
            onclick: () => {
              st.order = shuffle(st.order);
              render();
            }
          }, 'Embaralhar'),
          el('button', {
            class: 'btn btn--ghost',
            onclick: () => {
              selected = new Set();
              render();
            }
          }, 'Limpar seleção'),
          el('button', {
            class: 'btn btn--ghost',
            onclick: () => {
              st = fresh((st.index + 1) % PUZZLES.length);
              selected = new Set();
              render();
            }
          }, 'Próximo puzzle')
        )
      )
    );
    render();

    return {
      async save() {
        await kv.set('conexoes', st);
        return 'Progresso do Conexões salvo.';
      }
    };
  }
};
