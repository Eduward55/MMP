// Cat Typing: digite frases fofas; cada tecla certa toca uma nota da escala pentatônica.
import { kv, getProfile } from '../shared/store.js';
import { creatureSVG } from '../shared/creatures.js';
import { el, esc, startAudio } from '../shared/ui.js';
import { dockSay } from '../shared/companion.js';
import { createEventLog, openInStudio } from '../shared/events.js';

const PHRASES = [
  'o gato maestro rege a orquestra com sua batuta',
  'a lontra toca pandeiro boiando no rio',
  'miau miau faz o coral dos bigodes',
  'um beat bem fofo para dançar no sofá',
  'notas de neon brilham no céu roxo',
  'o piano ronrona quando a pata encosta',
  'cada tecla é uma nota e cada nota é um carinho'
];
const SCALE = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
const SCALE_MIDI = [72, 74, 76, 79, 81, 84];

export default {
  id: 'cattyping',
  title: 'Cat Typing',
  icon: 'cattyping',
  accent: '#ff7a3d',
  desc: 'Digite frases fofas; cada acerto vira uma nota.',
  async mount(root) {
    const data = (await kv.get('cattyping').catch(() => null)) || { best: [] };
    let phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    let pos = 0;
    let errors = 0;
    let startedAt = 0;
    let finished = null;
    let synth = null;
    let sound = true;
    const log = createEventLog({ source: 'cattyping', bpm: 100, scale: 'penta', root: 0 });

    const textEl = el('p', { class: 'typing__text', 'aria-live': 'polite' });
    const statsEl = el('div', { class: 'termo__stats' });
    const bestEl = el('ol', { class: 'typing__best' });
    const p = getProfile();
    const cat = el('div', { class: 'typing__cat', html: creatureSVG('cat', p.cat, { size: 120, label: p.cat.name }) });
    const soundBtn = el('button', { class: 'btn btn--ghost btn--sm' }, 'Som: ligado');

    function render() {
      textEl.innerHTML = [...phrase]
        .map((ch, i) => `<span class="${i < pos ? 'ok' : i === pos ? 'cur' : ''}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`)
        .join('');
      const secs = startedAt ? ((finished || performance.now()) - startedAt) / 1000 : 0;
      const wpm = secs > 0 ? Math.round((pos / 5) / (secs / 60)) : 0;
      const acc = pos + errors ? Math.round((pos / (pos + errors)) * 100) : 100;
      statsEl.innerHTML = '';
      [
        ['PPM', wpm],
        ['Precisão', `${acc}%`],
        ['Erros', errors],
        ['Tempo', `${secs.toFixed(1)}s`]
      ].forEach(([k, v]) => statsEl.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k))));
      bestEl.innerHTML = data.best.length
        ? data.best.map((b) => `<li><b>${b.wpm} PPM</b> · ${b.acc}% · ${esc(new Date(b.at).toLocaleDateString('pt-BR'))}</li>`).join('')
        : '<li class="muted">Nenhum recorde salvo ainda.</li>';
      return { wpm, acc };
    }

    function reset() {
      phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
      pos = 0;
      errors = 0;
      startedAt = 0;
      finished = null;
      render();
    }

    async function blip(i) {
      log.note({ note: SCALE_MIDI[i % SCALE.length], inst: 'chip', track: 'digitacao', trackName: 'Teclas certas', dur: 0.12, vel: 0.7 });
      if (!sound) return;
      try {
        const Tone = await startAudio();
        if (!synth) synth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 }, volume: -18 }).toDestination();
        synth.triggerAttackRelease(SCALE[i % SCALE.length], '32n');
      } catch {}
    }

    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || finished) return;
      e.preventDefault();
      if (!startedAt) startedAt = performance.now();
      cat.classList.remove('is-tap');
      void cat.offsetWidth;
      cat.classList.add('is-tap');
      if (e.key.toLowerCase() === phrase[pos]) {
        blip(pos);
        pos++;
        if (pos >= phrase.length) {
          finished = performance.now();
          const r = render();
          dockSay(`${r.wpm} palavras por minuto! Salve seu recorde.`);
          return;
        }
      } else {
        errors++;
        textEl.classList.remove('is-shake');
        void textEl.offsetWidth;
        textEl.classList.add('is-shake');
      }
      render();
    };
    window.addEventListener('keydown', onKey);
    soundBtn.addEventListener('click', () => {
      sound = !sound;
      soundBtn.textContent = `Som: ${sound ? 'ligado' : 'desligado'}`;
    });

    root.append(
      el(
        'div',
        { class: 'typing' },
        el(
          'section',
          { class: 'panel typing__main' },
          el('div', { class: 'typing__top' }, cat, statsEl),
          textEl,
          el(
            'div',
            { class: 'row-actions' },
            el('button', { class: 'btn btn--ghost', onclick: reset }, 'Nova frase'),
            soundBtn,
            el('button', {
              class: 'btn btn--ghost',
              title: 'Cada tecla certa virou uma nota: leve a melodia para o Studio',
              onclick: () => {
                const json = log.recent();
                if (!json) return dockSay('Digite um pouco primeiro: cada acerto vira uma nota!');
                openInStudio({ ...json, name: 'Melodia digitada' });
              }
            }, 'Melodia no Studio')
          ),
          el('p', { class: 'hint' }, 'Comece a digitar — o cronômetro começa na primeira tecla. Salvar guarda seu resultado nos recordes.')
        ),
        el('section', { class: 'panel typing__side' }, el('h2', {}, 'Recordes'), bestEl)
      )
    );
    render();

    return {
      async save() {
        if (!finished) throw new Error('Termine a frase para salvar o resultado.');
        const { wpm, acc } = render();
        data.best = [...data.best, { wpm, acc, at: new Date().toISOString() }].sort((a, b) => b.wpm - a.wpm).slice(0, 5);
        await kv.set('cattyping', data);
        render();
        return `Recorde de ${wpm} PPM salvo!`;
      },
      unmount() {
        window.removeEventListener('keydown', onKey);
        if (synth) synth.dispose();
      }
    };
  }
};
