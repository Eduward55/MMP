// Componente compartilhado "gato + lontra": usado no Hub, no Meu Gato e no dock de todos os módulos.
import { creatureSVG } from './creatures.js';
import { getProfile, onProfile, kv } from './store.js';
import { el, esc } from './ui.js';

const CAT_PRIORITY = [
  'astronauta',
  'capacete',
  'chapeu-bruxa',
  'coroa',
  'fone',
  'microfone',
  'capa',
  'batuta',
  'maid',
  'chapeu-festa',
  'oculos-coracao',
  'estrelinha',
  'sueter',
  'boina',
  'cachecol',
  'gravata',
  'coleira',
  'oculos',
  'lacinho',
  'flor'
];
const OTTER_PRIORITY = [
  'astronauta',
  'capacete',
  'maid',
  'capa',
  'chapeu-bruxa',
  'coroa',
  'fone',
  'chapeu-festa',
  'sueter',
  'cachecol',
  'batuta',
  'microfone',
  'oculos-coracao',
  'oculos',
  'estrelinha',
  'lacinho',
  'flor',
  'gravata',
  'coleira'
];
const CAT_REACT = {
  astronauta: 'astronaut',
  capacete: 'astronaut',
  maid: 'maid',
  lacinho: 'maid',
  sueter: 'sweater',
  cachecol: 'sweater',
  capa: 'maestro',
  batuta: 'maestro',
  gravata: 'proud',
  'chapeu-bruxa': 'bruxa',
  coroa: 'coroa',
  fone: 'fone',
  'chapeu-festa': 'festa',
  boina: 'boina',
  oculos: 'boina',
  microfone: 'microfone',
  'oculos-coracao': 'coracao',
  flor: 'coracao',
  estrelinha: 'estrela',
  coleira: 'pounce'
};
const OTTER_REACT = {
  astronauta: 'zero-g',
  capacete: 'zero-g',
  maid: 'curtsy',
  lacinho: 'curtsy',
  gravata: 'curtsy',
  sueter: 'shiver',
  cachecol: 'shiver',
  capa: 'conductor',
  batuta: 'conductor',
  boina: 'conductor',
  oculos: 'conductor',
  'chapeu-bruxa': 'levitate',
  coroa: 'royal',
  fone: 'popstar',
  microfone: 'popstar',
  'chapeu-festa': 'party',
  'oculos-coracao': 'heartbeat',
  estrelinha: 'spin',
  flor: 'splash',
  coleira: 'splash'
};
const REACT_META = {
  astronaut: { glyph: '🚀', speech: 'Gravidade zero!', ms: 1400 },
  maid: { glyph: '🎀', speech: 'Reverência!', ms: 1100 },
  sweater: { glyph: '🧶', speech: 'Quentinho!', ms: 900 },
  maestro: { glyph: '🎼', speech: 'Allegro vivace!', ms: 1300 },
  proud: { glyph: '✨', speech: 'Bem elegante!', ms: 1000 },
  bruxa: { glyph: '🧙', speech: 'Abracadabra!', ms: 1300 },
  coroa: { glyph: '👑', speech: 'Saudação real!', ms: 1100 },
  fone: { glyph: '🎧', speech: 'Solta a batida!', ms: 1100 },
  festa: { glyph: '🎉', speech: 'Uhuuu!', ms: 1100 },
  boina: { glyph: '🎨', speech: 'C’est magnifique!', ms: 1100 },
  microfone: { glyph: '🎙️', speech: 'Show ao vivo!', ms: 1200 },
  coracao: { glyph: '💖', speech: 'Apaixonado!', ms: 1000 },
  estrela: { glyph: '⭐', speech: 'Brilho estelar!', ms: 1000 },
  pounce: { glyph: '🐾', speech: 'Miau!', ms: 900 },
  splash: { glyph: '💧', speech: 'Splash!', ms: 850 },
  'zero-g': { glyph: '🌌', speech: 'Órbita lunar!', ms: 1300 },
  curtsy: { glyph: '✨', speech: 'Lontra elegante!', ms: 900 },
  shiver: { glyph: '☕', speech: 'Brrr, quentinho!', ms: 800 },
  conductor: { glyph: '🎻', speech: 'Allegro!', ms: 1100 },
  levitate: { glyph: '🔮', speech: 'Flutuando!', ms: 1200 },
  royal: { glyph: '👑', speech: 'Rei das lontras!', ms: 1000 },
  popstar: { glyph: '🎤', speech: 'Solo popstar!', ms: 1000 },
  party: { glyph: '🎈', speech: 'Pula pula!', ms: 900 },
  heartbeat: { glyph: '💕', speech: 'Coração disparado!', ms: 900 },
  spin: { glyph: '⭐', speech: 'Giro estelar!', ms: 850 }
};
const ALL_REACTS = [...new Set([...Object.values(CAT_REACT), ...Object.values(OTTER_REACT), 'heart', 'wink', 'bounce', 'meow', 'sparkle', 'bob', 'sway', 'bow', 'conduct', 'sing', 'float', 'bloom', 'jingle', 'zap', 'flutter', 'peek', 'clap', 'wiggle'])];
const REACT_SKIP = '.bc-cat, .bc-token, .outfit, .bc-ghost';
let clicksBound = false;

function outfitKinds(svg) {
  return [...svg.querySelectorAll('[class*="acc--"]')]
    .map((node) => [...node.classList].find((c) => c.startsWith('acc--')))
    .filter(Boolean)
    .map((c) => c.slice(5));
}

function pickReaction(svg) {
  const otter = svg.classList.contains('creature--otter');
  const kinds = outfitKinds(svg);
  const order = otter ? OTTER_PRIORITY : CAT_PRIORITY;
  const map = otter ? OTTER_REACT : CAT_REACT;
  const id = order.find((k) => kinds.includes(k));
  return (id && map[id]) || (otter ? 'splash' : 'pounce');
}

function clearReact(svg) {
  ALL_REACTS.forEach((k) => {
    svg.classList.remove(`is-react-${k}`);
    svg.classList.remove(`animate-react-${k}`);
  });
  const root = svg.querySelector('.creature-root');
  if (root) {
    [...root.classList].filter((c) => c.startsWith('animate-react-')).forEach((c) => root.classList.remove(c));
  }
  svg.classList.remove('is-reacting');
}

/** Clique no bichinho: reação da roupa equipada. Não desequipa. */
export function reactCreature(fig, svg) {
  if (!svg || svg.classList.contains('is-reacting')) return;
  const kind = pickReaction(svg);
  const meta = REACT_META[kind] || REACT_META.pounce;
  const host = fig || svg.parentElement;
  const root = svg.querySelector('.creature-root') || svg;
  clearReact(svg);
  void svg.offsetWidth;
  svg.classList.add('is-reacting');
  if (kind === 'coracao' || kind === 'heartbeat') svg.classList.add('is-react-heart');
  root.classList.add(`animate-react-${kind}`);
  if (host) {
    host.classList.add('is-reacting');
    host.querySelectorAll('.react-heart, .react-speech').forEach((n) => n.remove());
    const heart = el('span', { class: 'react-heart', 'aria-hidden': 'true' }, meta.glyph);
    const speech = el('span', { class: 'react-speech', 'aria-hidden': 'true' }, meta.speech);
    host.append(heart, speech);
    setTimeout(() => {
      heart.remove();
      speech.remove();
      host.classList.remove('is-reacting');
    }, meta.ms);
  }
  const done = (e) => {
    if (e && e.target !== root && e.target !== svg) return;
    root.classList.remove(`animate-react-${kind}`);
    svg.classList.remove('is-reacting', 'is-react-heart');
    root.removeEventListener('animationend', done);
  };
  root.addEventListener('animationend', done);
  setTimeout(() => done(), meta.ms + 80);
}

function bindCreatureClicks() {
  if (clicksBound) return;
  clicksBound = true;
  document.addEventListener('click', (e) => {
    const svg = e.target.closest && e.target.closest('svg.creature');
    if (!svg || svg.closest(REACT_SKIP)) return;
    const fig =
      svg.closest(
        'figure, .duo__member, .cantar__cat, .cantar__otter-art, .cantar__otter, .air-maestro, .tz-mascot, .cr-fan, .cr-car__pilot, .cn-stage__cat, .cn-stage__otter, .tm-stage__cat, .tm-stage__otter, .ct-ship__cat, .ct-ship__otter, .mycat__preview'
      ) || svg.parentElement;
    reactCreature(fig, svg);
  });
}

function bindReact(root) {
  bindCreatureClicks();
  root.querySelectorAll('.duo__member').forEach((fig) => {
    const svg = fig.querySelector('.creature');
    if (!svg || svg.dataset.reactBound) return;
    svg.dataset.reactBound = '1';
    svg.setAttribute('tabindex', '0');
    svg.style.cursor = 'pointer';
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        reactCreature(fig, svg);
      }
    });
  });
}

/**
 * Cria a dupla. Opções:
 *  - size: tamanho do gato em px (a lontra é ~80%)
 *  - names: mostra as plaquinhas com os nomes
 *  - catOverride/otterOverride: acessórios forçados
 *  - profile: usa um perfil específico (pré-visualização) em vez do salvo
 *  - live: acompanha mudanças do perfil salvo (padrão true)
 */
export function createDuo({ size = 120, names = true, catOverride, otterOverride, catClass = '', otterClass = '', profile, live = true } = {}) {
  const root = el('div', { class: 'duo' });
  let current = profile || getProfile();

  function render(p = current) {
    current = p;
    const catLook = { ...p.cat, outfit: { ...p.cat.outfit, ...(catOverride || {}) } };
    const otterLook = { ...p.otter, outfit: { ...p.otter.outfit, ...(otterOverride || {}) } };
    let catMarkup = '';
    let otterMarkup = '';
    try {
      catMarkup = creatureSVG('cat', catLook, { size, label: `Gato ${p.cat.name}`, extraClass: catClass });
    } catch (err) {
      console.error(err);
    }
    try {
      otterMarkup = creatureSVG('otter', otterLook, { size: Math.round(size * 0.8), label: `Lontra ${p.otter.name}`, extraClass: otterClass });
    } catch (err) {
      console.error(err);
    }
    root.innerHTML = `
      <figure class="duo__member duo__member--cat">
        <div class="creature-clip">${catMarkup}</div>
        ${names ? `<figcaption class="nameplate">${esc(p.cat.name)}</figcaption>` : ''}
      </figure>
      <figure class="duo__member duo__member--otter">
        <div class="creature-clip">${otterMarkup}</div>
        ${names ? `<figcaption class="nameplate nameplate--otter">${esc(p.otter.name)}</figcaption>` : ''}
      </figure>`;
    bindReact(root);
  }

  render();
  const off = live && !profile ? onProfile((p) => render(p)) : () => {};
  return { el: root, render, destroy: off };
}

const TIPS = [
  (p) => `${p.cat.name}: Ctrl+S salva o que você criou!`,
  (p) => `${p.otter.name}: tudo fica guardadinho na Galeria.`,
  (p) => `${p.cat.name}: miau! Clica na gente pra ver a careta.`,
  (p) => `${p.otter.name}: dá pra trocar minhas roupinhas no Meu Gato.`,
  (p) => `${p.cat.name}: arrasta a gente pelo canto da tela.`
];

let dock = null;
const DOCK_POS_KEY = 'dock-pos';
const INSET_PROPS = ['left', 'top', 'right', 'bottom', 'inset', 'transform', 'margin'];
let moduleVisible = true;
let overlayHidden = false;
let chromeBound = false;

function dockRootEl() {
  return document.getElementById('dock-root');
}

function clearInset(node) {
  if (!node) return;
  INSET_PROPS.forEach((p) => node.style.removeProperty(p));
}

function recBtnIsOn(btn) {
  if (!btn) return false;
  return (
    btn.classList.contains('is-active') ||
    btn.getAttribute('aria-pressed') === 'true' ||
    /Gravar:\s*Sim/i.test(btn.textContent || '')
  );
}

function liveOverlayShouldHide() {
  const html = document.documentElement;
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  return Boolean(
    overlayHidden ||
      html.classList.contains('is-airpads-fs') ||
      html.classList.contains('is-recording') ||
      fsEl ||
      document.querySelector('.airx.is-arena-fs, .airx__arena.is-fs') ||
      recBtnIsOn(document.querySelector('.airx .btn--rec'))
  );
}

let dockSyncing = false;

function syncDockVisibility() {
  if (dockSyncing) return;
  dockSyncing = true;
  try {
    const hide = !moduleVisible || liveOverlayShouldHide();
    const root = dockRootEl();
    htmlToggle(document.documentElement, 'is-dock-hidden', hide);
    if (root) {
      if (root.hidden !== hide) root.hidden = hide;
      if (hide) {
        root.style.setProperty('display', 'none', 'important');
        if (root.getAttribute('aria-hidden') !== 'true') root.setAttribute('aria-hidden', 'true');
      } else {
        root.style.removeProperty('display');
        if (root.hasAttribute('aria-hidden')) root.removeAttribute('aria-hidden');
      }
    }
    if (dock && dock.hidden !== hide) dock.hidden = hide;
  } finally {
    dockSyncing = false;
  }
}

function htmlToggle(node, cls, on) {
  if (!node) return;
  if (node.classList.contains(cls) === Boolean(on)) return;
  node.classList.toggle(cls, on);
}

function pinCollapsedDock(node) {
  if (!node) return;
  clearInset(node);
  clearInset(dockRootEl());
  const size = 48;
  const x = Math.max(8, Math.round(window.innerWidth - size - 14));
  const y = Math.max(8, Math.round(window.innerHeight - size - 12));
  node.style.setProperty('position', 'fixed', 'important');
  node.style.setProperty('left', `${x}px`, 'important');
  node.style.setProperty('top', `${y}px`, 'important');
  node.style.setProperty('right', 'auto', 'important');
  node.style.setProperty('bottom', 'auto', 'important');
  requestAnimationFrame(() => {
    if (!node.classList.contains('is-collapsed')) return;
    const r = node.getBoundingClientRect();
    const w = r.width || 48;
    const h = r.height || 48;
    const nx = Math.max(8, Math.round(window.innerWidth - w - 14));
    const ny = Math.max(8, Math.round(window.innerHeight - h - 12));
    if (Math.abs(r.left - nx) > 1 || Math.abs(r.top - ny) > 1) {
      node.style.setProperty('left', `${nx}px`, 'important');
      node.style.setProperty('top', `${ny}px`, 'important');
    }
  });
}

function applyDockPos(node, pos) {
  if (node.classList.contains('is-collapsed')) {
    pinCollapsedDock(node);
    return;
  }
  node.style.removeProperty('position');
  clearInset(node);
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
  node.style.left = `${pos.x}px`;
  node.style.top = `${pos.y}px`;
  node.style.right = 'auto';
  node.style.bottom = 'auto';
}

function restoreDockPos(node) {
  kv.get(DOCK_POS_KEY)
    .then((pos) => {
      if (node.classList.contains('is-collapsed')) return pinCollapsedDock(node);
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
        node.style.removeProperty('position');
        clearInset(node);
        return;
      }
      applyDockPos(node, pos);
    })
    .catch(() => {});
}

function bindDockDrag(node) {
  restoreDockPos(node);
  let drag = null;
  node.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    if (node.classList.contains('is-collapsed')) return;
    if (e.target.closest('.dock__toggle, .dock__edit, .creature')) return;
    const r = node.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    node.classList.add('is-dragging');
    node.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  node.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const w = node.offsetWidth || 160;
    const h = node.offsetHeight || 120;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX - drag.dx));
    const y = Math.max(8, Math.min(window.innerHeight - h - 8, e.clientY - drag.dy));
    applyDockPos(node, { x, y });
  });
  const end = (e) => {
    if (!drag) return;
    drag = null;
    node.classList.remove('is-dragging');
    if (node.classList.contains('is-collapsed')) return;
    const r = node.getBoundingClientRect();
    kv.set(DOCK_POS_KEY, { x: r.left, y: r.top }).catch(() => {});
    try {
      node.releasePointerCapture(e.pointerId);
    } catch {}
  };
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);
}

export function mountDock(root) {
  bindCreatureClicks();
  let duo;
  try {
    duo = createDuo({ size: 84, names: false });
  } catch (err) {
    console.error(err);
    duo = { el: el('div', { class: 'duo' }), destroy() {} };
  }
  const bubble = el('div', { class: 'dock__bubble' });
  const toggle = el('button', { class: 'dock__toggle', 'aria-label': 'Esconder companheiros', title: 'Esconder/mostrar' }, '–');
  const edit = el('a', { class: 'dock__edit', href: '#/mycat', title: 'Editar no Meu Gato' }, 'Editar');
  const wrap = el('div', { class: 'dock__duo', title: 'Arraste para mover' }, duo.el, edit);
  const node = el('aside', { class: 'dock', 'aria-label': 'Seu gato e sua lontra' }, bubble, wrap, toggle);
  dock = node;
  let i = 0;
  const tick = () => {
    if (i % 2 === 0) say(TIPS[(i / 2) % TIPS.length](getProfile()));
    i++;
  };
  tick();
  setInterval(tick, 8000);
  toggle.addEventListener('click', () => {
    node.classList.toggle('is-collapsed');
    const collapsed = node.classList.contains('is-collapsed');
    toggle.textContent = collapsed ? '+' : '–';
    toggle.setAttribute('aria-label', collapsed ? 'Mostrar companheiros' : 'Esconder companheiros');
    if (collapsed) pinCollapsedDock(node);
    else restoreDockPos(node);
  });
  bindDockDrag(node);
  bindDockChrome();
  if (root) root.append(node);
  syncDockVisibility();
  return node;
}

function bindDockChrome() {
  if (chromeBound) return;
  chromeBound = true;
  const onChrome = () => {
    syncDockVisibility();
    if (dock && dock.classList.contains('is-collapsed')) pinCollapsedDock(dock);
  };
  document.addEventListener('fullscreenchange', onChrome);
  document.addEventListener('webkitfullscreenchange', onChrome);
  window.addEventListener('resize', onChrome);
  new MutationObserver((mutations) => {
    if (dockSyncing) return;
    for (const m of mutations) {
      const el = m.target;
      if (!(el instanceof Element)) continue;
      if (el.id === 'dock-root' || (dock && el === dock)) continue;
      if (
        el === document.documentElement ||
        el === document.body ||
        el.classList.contains('btn--rec') ||
        el.classList.contains('airx') ||
        el.classList.contains('airx__arena')
      ) {
        onChrome();
        return;
      }
    }
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
}

export function setDockVisible(visible) {
  moduleVisible = Boolean(visible);
  syncDockVisibility();
}

export function setDockCaptureHidden(hidden) {
  overlayHidden = Boolean(hidden);
  syncDockVisibility();
}

let hideTimer = 0;

function say(text) {
  if (!dock) return;
  const b = dock.querySelector('.dock__bubble');
  b.textContent = text;
  b.classList.remove('is-pop', 'is-hidden');
  void b.offsetWidth;
  b.classList.add('is-pop');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => b.classList.add('is-hidden'), 6000);
}

export function dockSay(text) {
  say(text);
}
