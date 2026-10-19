// Roteador por hash (#/modulo?param=valor). Cada módulo exporta { id, title, icon, mount(root, ctx) }.
// O Hub monta sem esperar Tone/AudioContext/MediaPipe nem o grafo pesado dos módulos.
import { loadProfile } from './shared/store.js';
import { mountDock, setDockVisible } from './shared/companion.js';
import { HINTS } from './shared/hints.js';
import { loadTheme } from './shared/theme.js';
import { createTopbar } from './shared/topbar.js';
import { el, toast } from './shared/ui.js';
import hub from './hub/hub.js';

const LOADERS = {
  mycat: () => import('./mycat/mycat.js'),
  gallery: () => import('./gallery/gallery.js'),
  airpads: () => import('./airpads/airpads.js'),
  beatcats: () => import('./beatcats/beatcats.js'),
  studio: () => import('./studio/studio.js'),
  cantar: () => import('./cantar/cantar.js'),
  termo: () => import('./termo/termo.js'),
  conexoes: () => import('./conexoes/conexoes.js'),
  cattyping: () => import('./cattyping/cattyping.js'),
  tetris: () => import('./tetris/tetris.js'),
  corrida: () => import('./corrida/corrida.js')
};

export const MODULES = [
  { id: 'airpads', title: 'Air Pads', icon: 'airpads', desc: 'Dois círculos no ar, um por mão: piano, bateria, synth, baixo e theremin.' },
  { id: 'beatcats', title: 'Beat Cats', icon: 'beatcats', desc: 'Beatbox em grupo: vista os gatos com acessórios e cada um entra cantando no loop.', hideDock: true },
  { id: 'studio', title: 'Studio', icon: 'studio', desc: 'Step sequencer e piano roll: edite o que você tocou, exporte WAV e vídeo.' },
  { id: 'cantar', title: 'Cantar', icon: 'cantar', desc: 'Cante no microfone, coloque autotune ou talkbox e misture com arpejo ou um beat da Galeria.' },
  { id: 'gallery', title: 'Galeria', icon: 'gallery', desc: 'Seus áudios, vídeos e beats: abrir, renomear, exportar e apagar.' },
  { id: 'termo', title: 'Termo', icon: 'termo', desc: 'Palavras de 5 letras em português: Simples, Dueto ou Quarteto, com estatísticas.', hideDock: true },
  { id: 'conexoes', title: 'Conexões', icon: 'conexoes', desc: 'Agrupe 16 palavras em 4 categorias secretas. O jogo inventa o puzzle na hora.', hideDock: true },
  { id: 'cattyping', title: 'Cat Typing', icon: 'cattyping', desc: 'Gato espacial: digite a palavra do asteroide e atire o laser.', hideDock: true },
  { id: 'tetris', title: 'Tetris', icon: 'tetris', desc: 'Peças caindo no estilo gato. Setas ou WASD para jogar.', hideDock: true },
  { id: 'corrida', title: 'Corrida', icon: 'corrida', desc: 'Desvie dos obstáculos com WASD ou as setas. Corre, gatinho!', hideDock: true },
  { id: 'mycat', title: 'Meu Gato', icon: 'mycat', desc: 'Pelagem, olhos, nomes e 20 roupinhas para o gato e a lontra — cada um com a sua cor e mais variações de pelo.', hideDock: true }
];

const loaded = { hub };
const META = Object.fromEntries([hub, ...MODULES].map((m) => [m.id, m]));

console.log('[mmp] app module');
const app = document.getElementById('app');
let current = null;
let currentSave = null;
let navToken = 0;
let navigating = false;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'hub';
  const [name, query = ''] = raw.split('?');
  return { name: META[name] || LOADERS[name] ? name : 'hub', params: Object.fromEntries(new URLSearchParams(query)) };
}

function afterPaint() {
  return Promise.race([
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    new Promise((resolve) => setTimeout(resolve, 80))
  ]);
}

async function getModule(name) {
  if (loaded[name]) return loaded[name];
  const loader = LOADERS[name];
  if (!loader) return hub;
  const mod = (await loader()).default;
  loaded[name] = mod;
  return mod;
}

async function navigate() {
  const token = ++navToken;
  const { name, params } = parseHash();
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
  const meta = META[name] || hub;
  document.title = name === 'hub' ? 'My Music Place' : `${meta.title} · My Music Place`;
  setDockVisible(!meta.hideDock);

  const page = el('div', { class: `page page--${name}` });
  app.append(page);
  await afterPaint();

  let mod = hub;
  try {
    mod = await getModule(name);
  } catch (err) {
    console.error(err);
    page.append(errorState(err));
    app.dataset.ready = 'error';
    return;
  }
  if (token !== navToken) return;

  let main = page;
  let topbar = null;
  if (name !== 'hub') {
    let instance = null;
    topbar = createTopbar({
      title: mod.title,
      iconName: mod.icon,
      hint: HINTS[name] || mod.desc,
      onSave: () => (instance && instance.save ? instance.save() : false)
    });
    main = el('main', { class: 'page__main' });
    page.append(topbar.el, main);
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
    let instance = {};
    try {
      instance = (await mod.mount(page, { params, modules: MODULES })) || {};
    } catch (err) {
      console.error(err);
      page.innerHTML = '';
      page.append(errorState(err));
    }
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

function revealError(err) {
  console.error(err);
  app.innerHTML = '';
  app.append(errorState(err));
  app.dataset.ready = 'error';
  toast('Falha ao iniciar o MMP.', 'error');
}

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (currentSave) currentSave();
  }
});

window.addEventListener('hashchange', () => {
  if (navigating) return;
  navigate().catch((err) => console.error(err));
});

window.addEventListener('mmp-boot-timeout', () => {
  if (app.dataset.ready || navigating) return;
  console.warn('[mmp] splash ainda visível — forçando o Hub');
  navigating = true;
  navigate()
    .catch(revealError)
    .finally(() => {
      navigating = false;
    });
});

async function boot() {
  navigating = true;
  try {
    try {
      await Promise.race([loadProfile(), new Promise((_, rej) => setTimeout(() => rej(new Error('perfil')), 1500))]);
    } catch (err) {
      console.warn(err);
    }
    try {
      await loadTheme();
    } catch (err) {
      console.warn(err);
    }
    if (!location.hash) location.hash = '#/hub';
    await navigate();
    try {
      const dock = document.getElementById('dock-root');
      if (dock) mountDock(dock);
    } catch (err) {
      console.warn(err);
    }
  } finally {
    navigating = false;
  }
}

boot().catch(revealError);
