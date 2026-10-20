// Barra superior padrão: Hub · título · Dicas · Salvar · Galeria · Tema.
import { el, toast } from './ui.js';
import { icon } from './icons.js';
import { createThemePicker } from './theme.js';
import { t } from './i18n.js';

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
    { class: 'btn btn--primary topbar__save', title: t('top.saveTitle') },
    el('span', { class: 'btn__glyph', 'aria-hidden': 'true', html: icon('disk', 18) }),
    el('span', { class: 'btn__text' }, t('top.save'))
  );
  let busy = false;

  async function save() {
    if (busy) return;
    if (!onSave) {
      toast(t('top.saveEmpty'), 'info');
      return;
    }
    busy = true;
    saveBtn.classList.add('is-busy');
    saveBtn.disabled = true;
    try {
      const msg = await onSave();
      if (msg !== false) toast(typeof msg === 'string' ? msg : t('top.saveOk'), 'ok');
    } catch (err) {
      console.error(err);
      toast(t('top.saveFail', { err: err.message || err }), 'error', 4200);
    } finally {
      busy = false;
      saveBtn.classList.remove('is-busy');
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener('click', save);

  const hintBtn = el(
    'button',
    { class: 'btn btn--ghost topbar__hint', type: 'button', title: t('top.tipsTitle') },
    el('span', { class: 'btn__glyph', 'aria-hidden': 'true', html: icon('tips', 18) }),
    el('span', { class: 'btn__text' }, t('top.tips'))
  );
  attachPop(hintBtn, t('top.tipsHead'), el('p', { class: 'topbar-pop__hint' }, hint || t('top.tipsFallback')));

  const themePick = createThemePicker();
  themePick.classList.add('topbar__theme');

  const bar = el(
    'header',
    { class: 'topbar' },
    el(
      'a',
      { class: 'btn btn--ghost topbar__back', href: '#/hub', title: t('top.back') },
      el('span', { class: 'btn__glyph', 'aria-hidden': 'true' }, '◀'),
      el('span', { class: 'btn__text' }, t('top.hub'))
    ),
    el('div', { class: 'topbar__title' }, el('span', { class: 'topbar__icon', html: icon(iconName, 28) }), el('h1', {}, title)),
    el(
      'div',
      { class: 'topbar__actions' },
      hintBtn,
      saveBtn,
      el(
        'a',
        { class: 'btn btn--ghost topbar__gallery', href: '#/gallery', title: t('top.galleryTitle') },
        el('span', { class: 'btn__glyph', 'aria-hidden': 'true', html: icon('gallery', 18) }),
        el('span', { class: 'btn__text' }, t('top.gallery'))
      ),
      themePick
    )
  );

  return { el: bar, save };
}
