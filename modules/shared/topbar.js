// Barra superior padrão de todos os módulos: Voltar ao Hub · título · Salvar · Galeria.
import { el, toast } from './ui.js';
import { icon } from './icons.js';

export function createTopbar({ title, iconName, onSave }) {
  const saveBtn = el(
    'button',
    { class: 'btn btn--primary topbar__save', title: 'Salvar (Ctrl+S)' },
    el('span', { class: 'btn__glyph', 'aria-hidden': 'true', html: icon('disk', 16) }),
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
      saveBtn,
      el(
        'a',
        { class: 'btn btn--ghost', href: '#/gallery', title: 'Abrir a Galeria' },
        el('span', { class: 'btn__glyph', 'aria-hidden': 'true', html: icon('gallery', 16) }),
        el('span', { class: 'btn__text' }, 'Galeria')
      )
    )
  );

  return { el: bar, save };
}
