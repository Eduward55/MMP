import { createDuo } from '../shared/companion.js';
import { getProfile, onProfile, appInfo, gallery } from '../shared/store.js';
import { icon } from '../shared/icons.js';
import { createThemePicker } from '../shared/theme.js';
import { el, esc } from '../shared/ui.js';
import { createLangToggle, t } from '../shared/i18n.js';
import { createVolumeControl } from '../shared/bgm.js';

const NOTES = ['♪', '♫', '♩', '♬'];

export default {
  id: 'hub',
  title: 'Hub',
  icon: 'mycat',
  hideDock: true,
  async mount(root, { modules }) {
    const greeting = el('p', { class: 'hub__greeting' });
    const renderGreeting = (p) => {
      greeting.innerHTML = t('hub.greeting', { cat: esc(p.cat.name), otter: esc(p.otter.name) });
    };
    renderGreeting(getProfile());
    const off = onProfile(renderGreeting);

    const notes = el('div', { class: 'stage__notes', 'aria-hidden': 'true' });
    for (let i = 0; i < 10; i++) {
      notes.append(el('span', { class: 'float-note', style: `--i:${i};--x:${8 + ((i * 37) % 84)}%;--d:${5 + (i % 4)}s` }, NOTES[i % NOTES.length]));
    }

    const cards = el('nav', { class: 'cards', 'aria-label': t('hub.modules') });
    modules.forEach((m, idx) => {
      let iconHtml = '';
      try {
        iconHtml = icon(m.icon, 56);
      } catch (err) {
        console.error(err);
      }
      cards.append(
        el(
          'a',
          { class: 'card', href: `#/${m.id}`, style: `--delay:${idx * 60}ms` },
          el('span', { class: 'card__icon', html: iconHtml }),
          el(
            'span',
            { class: 'card__body' },
            el('span', { class: 'card__title' }, t(`mod.${m.id}.title`, m.title)),
            el('span', { class: 'card__desc' }, t(`mod.${m.id}.desc`, m.desc))
          ),
          m.id === 'gallery' ? el('span', { class: 'card__badge', 'data-gallery-count': '' }) : null
        )
      );
    });

    const footer = el('footer', { class: 'hub__footer' }, el('span', {}, t('hub.footer')));
    const podium = el('div', { class: 'stage__podium', 'aria-hidden': 'true' });
    const stage = el(
      'div',
      { class: 'stage' },
      notes,
      el('div', { class: 'stage__spot', 'aria-hidden': 'true' }),
      el('p', { class: 'stage__hint font-pixel' }, t('hub.hint')),
      podium
    );
    let themePicker;
    try {
      themePicker = createThemePicker();
    } catch (err) {
      console.error(err);
      themePicker = el('div');
    }

    root.append(
      el(
        'section',
        { class: 'hub' },
        el(
          'header',
          { class: 'hub__hero' },
          el(
            'div',
            { class: 'hub__brand' },
            el('h1', { class: 'logo' }, el('span', { class: 'logo__my' }, 'My Music'), el('span', { class: 'logo__place' }, 'Place')),
            el('span', { class: 'logo__tag' }, 'MMP'),
            greeting,
            el('p', { class: 'hub__how' }, t('hub.how')),
            el('div', { class: 'hub__theme-wrap' }, themePicker, createLangToggle(), createVolumeControl())
          ),
          stage
        ),
        cards,
        footer
      )
    );

    await new Promise((resolve) => {
      const t = setTimeout(resolve, 32);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          clearTimeout(t);
          resolve();
        });
      }
    });

    let duo = { el: el('div', { class: 'duo' }), destroy() {} };
    try {
      duo = createDuo({ size: 210, catClass: 'is-idle', otterClass: 'is-dancing' });
    } catch (err) {
      console.error(err);
    }
    stage.insertBefore(duo.el, podium);

    gallery
      .list()
      .then((items) => {
        const badge = root.querySelector('[data-gallery-count]');
        if (badge && items.length) badge.textContent = String(items.length);
      })
      .catch(() => {});
    appInfo()
      .then((info) => {
        footer.append(el('span', { class: 'hub__data', title: info.dataDir }, `v${info.version} · dados em ${info.dataDir}`));
        if (info.preview) {
          footer.append(
            el(
              'a',
              {
                class: 'hub__download',
                href: '/dist/MyMusicPlace-0.1.0-win-x64.zip',
                download: 'MyMusicPlace-0.1.0-win-x64-portable.zip'
              },
              t('hub.download')
            )
          );
        }
      })
      .catch(() => {});

    return {
      unmount() {
        off();
        duo.destroy();
      }
    };
  }
};
