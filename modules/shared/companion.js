// Componente compartilhado "gato + lontra": usado no Hub, no Meu Gato e no dock de todos os módulos.
import { creatureSVG } from './creatures.js';
import { getProfile, onProfile, kv } from './store.js';
import { el, esc } from './ui.js';

const CAT_MOODS = ['heart', 'wink', 'bounce', 'meow'];
const OTTER_MOODS = ['splash', 'wiggle', 'bounce', 'peek', 'clap'];
const ALL_REACTS = [...new Set([...CAT_MOODS, ...OTTER_MOODS, 'sparkle', 'bob', 'sway', 'bow', 'conduct', 'sing', 'float', 'party', 'bloom', 'jingle', 'zap', 'flutter'])];
const OUTFIT_REACT = {
  coroa: 'sparkle',
  fone: 'bob',
  cachecol: 'sway',
  lacinho: 'bow',
  batuta: 'conduct',
  microfone: 'sing',
  astronauta: 'float',
  capacete: 'float',
  'chapeu-festa': 'party',
  'chapeu-bruxa': 'wiggle',
  flor: 'bloom',
  estrelinha: 'sparkle',
  'oculos-coracao': 'heart',
  oculos: 'wink',
  coleira: 'jingle',
  gravata: 'bob',
  maid: 'bow',
  sueter: 'bounce',
  capa: 'sway',
  boina: 'wiggle',
  harpa: 'jingle',
  raio: 'zap',
  bolha: 'float',
  cristal: 'sparkle',
  antena: 'wiggle',
  asas: 'flutter',
  visor: 'wink',
  aureola: 'sparkle'
};
let lastReact = '';

function outfitKinds(svg) {
  return [...svg.querySelectorAll('[class*="acc--"]')]
    .map((node) => [...node.classList].find((c) => c.startsWith('acc--')))
    .filter(Boolean)
    .map((c) => c.slice(5));
}

function clearReact(svg) {
  ALL_REACTS.forEach((k) => svg.classList.remove(`is-react-${k}`));
}

/** Clique no bichinho: carinha fofa + animação da roupinha, diferente para gato e lontra. */
export function reactCreature(fig, svg) {
  if (!svg) return;
  const otter = svg.classList.contains('creature--otter');
  const moods = otter ? OTTER_MOODS : CAT_MOODS;
  const kinds = outfitKinds(svg);
  const fromOutfit = kinds.map((id) => OUTFIT_REACT[id]).filter(Boolean);
  const face = moods.filter((k) => k !== 'spin' && k !== 'stretch');
  const pool = [...new Set(fromOutfit.length ? fromOutfit : face)].filter((k) => k !== lastReact);
  const pick = pool.length ? pool : face;
  const kind = pick[Math.floor(Math.random() * pick.length)];
  lastReact = kind;
  const host = fig || svg.parentElement;
  clearReact(svg);
  void svg.offsetWidth;
  svg.classList.add(`is-react-${kind}`);
  if (host) {
    host.classList.add('is-reacting');
    const glyph = kind === 'sing' || kind === 'meow' ? '♪' : kind === 'splash' ? '💧' : kind === 'clap' ? '✧' : '♥';
    const heart = el('span', { class: 'react-heart', 'aria-hidden': 'true' }, glyph);
    host.append(heart);
    setTimeout(() => heart.remove(), 900);
    setTimeout(() => host.classList.remove('is-reacting'), 900);
  }
  setTimeout(() => svg.classList.remove(`is-react-${kind}`), 900);
}

function bindReact(root) {
  root.querySelectorAll('.duo__member').forEach((fig) => {
    const svg = fig.querySelector('.creature');
    if (!svg || svg.dataset.reactBound) return;
    svg.dataset.reactBound = '1';
    svg.setAttribute('tabindex', '0');
    svg.style.cursor = 'pointer';
    const go = (e) => {
      e.preventDefault();
      e.stopPropagation();
      reactCreature(fig, svg);
    };
    svg.addEventListener('click', go);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') go(e);
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
    root.innerHTML = `
      <figure class="duo__member duo__member--cat">
        ${creatureSVG('cat', catLook, { size, label: `Gato ${p.cat.name}`, extraClass: catClass })}
        ${names ? `<figcaption class="nameplate">${esc(p.cat.name)}</figcaption>` : ''}
      </figure>
      <figure class="duo__member duo__member--otter">
        ${creatureSVG('otter', otterLook, { size: Math.round(size * 0.8), label: `Lontra ${p.otter.name}`, extraClass: otterClass })}
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

function syncDockVisibility() {
  const hide = !moduleVisible || liveOverlayShouldHide();
  const root = dockRootEl();
  htmlToggle(document.documentElement, 'is-dock-hidden', hide);
  if (root) {
    root.hidden = hide;
    if (hide) {
      root.style.setProperty('display', 'none', 'important');
      root.setAttribute('aria-hidden', 'true');
    } else {
      root.style.removeProperty('display');
      root.removeAttribute('aria-hidden');
    }
  }
  if (dock) dock.hidden = hide;
}

function htmlToggle(node, cls, on) {
  if (!node) return;
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
  const duo = createDuo({ size: 84, names: false });
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
  root.append(node);
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
    for (const m of mutations) {
      const el = m.target;
      if (!(el instanceof Element)) continue;
      if (
        el === document.documentElement ||
        el === document.body ||
        el.id === 'dock-root' ||
        el.classList.contains('btn--rec') ||
        el.classList.contains('airx') ||
        el.classList.contains('airx__arena') ||
        el.classList.contains('dock')
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
