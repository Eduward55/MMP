// Barra superior padrão: Hub · título · Dicas · Salvar · Galeria · Tema.
import { el, toast } from './ui.js';
import { icon } from './icons.js';
import { createThemePicker } from './theme.js';

function closePops() {
  document.querySelectorAll('.topbar-pop').forEach((n) => n.remove());
}

function attachPop(btn, title, bodyNode) {
  const open = () => {
    const existing = btn.parentElement.querySelector('.topbar-pop');
    if (existing) {
      existing.remove();
      return;
    }
    closePops();
    const pop = el(
      'div',
      { class: 'topbar-pop', role: 'dialog', 'aria-label': title },
      el('strong', { class: 'topbar-pop__title' }, title),
      bodyNode
    );
    btn.parentElement.style.position = 'relative';
    btn.parentElement.append(pop);
    const onDoc = (e) => {
      if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        pop.remove();
        document.removeEventListener('pointerdown', onDoc);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', onDoc), 0);
  };
  btn.addEventListener('click', open);
  return btn;
}

export function createTopbar({ title, iconName, onSave, hint }) {
  const saveBtn = el(
    'button',
    { class: 'btn btn--primary topbar__save', title: 'Salvar (Ctrl+S)' },
    el('span', { class: 'btn__glyph', 'aria-hidden': 'true', html: icon('disk', 18) }),
    el('span', { class: 'btn__text' }, 'Salvar')
  );
  let busy = false;

  async function save() {
    if (busy) return;
    if (!onSave) {
      toast('Nada para salvar aqui ainda.', 'info');
      return;
    }
    busy = true;
    saveBtn.classList.add('is-busy');
    saveBtn.disabled = true;
    try {
      const msg = await onSave();
      if (msg !== false) toast(typeof msg === 'string' ? msg : 'Salvo com sucesso!', 'ok');
    } catch (err) {
      console.error(err);
      toast(`Não deu para salvar: ${err.message || err}`, 'error', 4200);
    } finally {
      busy = false;
      saveBtn.classList.remove('is-busy');
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener('click', save);

  const hintBtn = el(
    'button',
    { class: 'btn btn--ghost topbar__hint', type: 'button', title: 'Como mexer neste módulo' },
    el('span', { class: 'btn__glyph', 'aria-hidden': 'true', html: icon('tips', 18) }),
    el('span', { class: 'btn__text' }, 'Dicas')
  );
  attachPop(hintBtn, 'Como mexer', el('p', { class: 'topbar-pop__hint' }, hint || 'Explore os botões. Ctrl+S salva, Galeria guarda o que você criou.'));

  const themePick = createThemePicker();
  themePick.classList.add('topbar__theme');

  const bar = el(
    'header',
    { class: 'topbar' },
    el(
      'a',
      { class: 'btn btn--ghost topbar__back', href: '#/hub', title: 'Voltar ao Hub' },
      el('span', { class: 'btn__glyph', 'aria-hidden': 'true' }, '◀'),
      el('span', { class: 'btn__text' }, 'Hub')
    ),
    el('div', { class: 'topbar__title' }, el('span', { class: 'topbar__icon', html: icon(iconName, 28) }), el('h1', {}, title)),
    el(
      'div',
      { class: 'topbar__actions' },
      hintBtn,
      saveBtn,
      el(
        'a',
        { class: 'btn btn--ghost topbar__gallery', href: '#/gallery', title: 'Abrir a Galeria' },
        el('span', { class: 'btn__glyph', 'aria-hidden': 'true', html: icon('gallery', 18) }),
        el('span', { class: 'btn__text' }, 'Galeria')
      ),
      themePick
    )
  );

  return { el: bar, save };
}
