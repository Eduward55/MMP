// Componente compartilhado "gato + lontra": usado no Hub, no Meu Gato e no dock de todos os módulos.
import { creatureSVG } from './creatures.js';
import { getProfile, onProfile } from './store.js';
import { el, esc } from './ui.js';

const REACTS = ['heart', 'wink', 'bounce', 'spin'];
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
  boina: 'wiggle'
};

function outfitKinds(svg) {
  return [...svg.querySelectorAll('[class*="acc--"]')]
    .map((node) => [...node.classList].find((c) => c.startsWith('acc--')))
    .filter(Boolean)
    .map((c) => c.slice(5));
}

/** Clique no bichinho: carinha fofa + animação da roupinha. */
export function reactCreature(fig, svg) {
  if (!svg) return;
  const kinds = outfitKinds(svg);
  const fromOutfit = kinds.map((id) => OUTFIT_REACT[id]).find(Boolean);
  const kind = fromOutfit || REACTS[Math.floor(Math.random() * REACTS.length)];
  const host = fig || svg.parentElement;
  svg.classList.remove('is-react-heart', 'is-react-wink', 'is-react-bounce', 'is-react-spin', 'is-react-sparkle', 'is-react-bob', 'is-react-sway', 'is-react-bow', 'is-react-conduct', 'is-react-sing', 'is-react-float', 'is-react-party', 'is-react-wiggle', 'is-react-bloom', 'is-react-jingle');
  void svg.offsetWidth;
  svg.classList.add(`is-react-${kind}`);
  if (host) {
    host.classList.add('is-reacting');
    const heart = el('span', { class: 'react-heart', 'aria-hidden': 'true' }, kind === 'sing' ? '♪' : '♥');
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
  () => 'Funciona 100% offline, sem internet.'
];

let dock = null;

export function mountDock(root) {
  const duo = createDuo({ size: 84, names: false });
  const bubble = el('div', { class: 'dock__bubble' });
  const toggle = el('button', { class: 'dock__toggle', 'aria-label': 'Esconder companheiros', title: 'Esconder/mostrar' }, '–');
  const edit = el('a', { class: 'dock__edit', href: '#/mycat', title: 'Editar no Meu Gato' }, 'Editar');
  const wrap = el('div', { class: 'dock__duo' }, duo.el, edit);
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
    toggle.textContent = node.classList.contains('is-collapsed') ? '+' : '–';
  });
  root.append(node);
  return node;
}

export function setDockVisible(visible) {
  if (dock) dock.hidden = !visible;
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
