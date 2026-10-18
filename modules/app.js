// Roteador por hash (#/modulo?param=valor). Cada módulo exporta { id, title, icon, mount(root, ctx) }.
import { loadProfile } from './shared/store.js';
import { mountDock, setDockVisible } from './shared/companion.js';
import { createTopbar } from './shared/topbar.js';
import { el, toast } from './shared/ui.js';

import hub from './hub/hub.js';
import mycat from './mycat/mycat.js';
import gallery from './gallery/gallery.js';
import airpads from './airpads/airpads.js';
import beatcats from './beatcats/beatcats.js';
import studio from './studio/studio.js';
import termo from './termo/termo.js';
import conexoes from './conexoes/conexoes.js';
import cattyping from './cattyping/cattyping.js';

export const MODULES = [airpads, beatcats, studio, gallery, termo, conexoes, cattyping, mycat];
const ROUTES = Object.fromEntries([hub, ...MODULES].map((m) => [m.id, m]));

const app = document.getElementById('app');
let current = null;
let currentSave = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'hub';
  const [name, query = ''] = raw.split('?');
  return { name: ROUTES[name] ? name : 'hub', params: Object.fromEntries(new URLSearchParams(query)) };
}

let navToken = 0;

async function navigate() {
  const token = ++navToken;
  const { name, params } = parseHash();
  const mod = ROUTES[name];
  const stale = (instance, page) => {
    if (token === navToken) return false;
    if (instance && instance.unmount) instance.unmount();
    page.remove();
    return true;
  };
  if (current && current.unmount) {
    try {
      current.unmount();
    } catch (err) {
      console.error(err);
    }
  }
  current = null;
  currentSave = null;
  app.innerHTML = '';
  app.dataset.route = name;
  delete app.dataset.ready;
  document.title = name === 'hub' ? 'My Music Place' : `${mod.title} · My Music Place`;
  setDockVisible(!mod.hideDock);

  const page = el('div', { class: `page page--${name}` });
  let main = page;
  let topbar = null;
  if (name !== 'hub') {
    let instance = null;
    topbar = createTopbar({ title: mod.title, iconName: mod.icon, onSave: () => (instance && instance.save ? instance.save() : false) });
    main = el('main', { class: 'page__main' });
    page.append(topbar.el, main);
    app.append(page);
    try {
      instance = (await mod.mount(main, { params, topbar })) || {};
    } catch (err) {
      console.error(err);
      main.innerHTML = '';
      main.append(errorState(err));
      instance = {};
    }
    if (stale(instance, page)) return;
    current = instance;
    currentSave = topbar.save;
  } else {
    app.append(page);
    const instance = (await mod.mount(page, { params, modules: MODULES })) || {};
    if (stale(instance, page)) return;
    current = instance;
  }
  app.dataset.ready = name;
  window.scrollTo(0, 0);
}

function errorState(err) {
  return el(
    'div',
    { class: 'state state--error' },
    el('h2', {}, 'Ops! Esse módulo tropeçou no novelo.'),
    el('p', {}, String(err && err.message ? err.message : err)),
    el('a', { class: 'btn btn--primary', href: '#/hub' }, 'Voltar ao Hub')
  );
}

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (currentSave) currentSave();
  }
});

async function boot() {
  await loadProfile();
  mountDock(document.getElementById('dock-root'));
  window.addEventListener('hashchange', navigate);
  if (!location.hash) location.hash = '#/hub';
  await navigate();
}

boot().catch((err) => {
  console.error(err);
  app.innerHTML = '';
  app.append(errorState(err));
  toast('Falha ao iniciar o MMP.', 'error');
});
