// Script clássico (não-módulo) carregado antes de tudo: guarda erros para diagnóstico.
window.__mmpErrors = [];
window.addEventListener('error', (e) => {
  const msg = String(e.message || '');
  if (msg.includes('ResizeObserver loop')) return;
  window.__mmpErrors.push(msg);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  window.__mmpErrors.push(String((r && r.message) || r));
});

const HUB_CARDS = [
  ['airpads', 'Air Pads', 'Dois círculos no ar, um por mão.'],
  ['beatcats', 'Beat Cats', 'Beatbox em grupo com os gatos no loop.'],
  ['studio', 'Studio', 'Piano roll e step sequencer.'],
  ['cantar', 'Cantar', 'Microfone, autotune e lontrinhas.'],
  ['gallery', 'Galeria', 'Áudios, vídeos e beats salvos.'],
  ['termo', 'Termo', 'Palavras de 5 letras.'],
  ['conexoes', 'Conexões', '4 grupos de 4 palavras.'],
  ['cattyping', 'Cat Typing', 'Digite e atire o laser.'],
  ['tetris', 'Tetris', 'Peças caindo no estilo gato.'],
  ['corrida', 'Corrida', 'Desvie dos obstáculos.'],
  ['mycat', 'Meu Gato', 'Pelagem, olhos e roupinhas.']
];

function emergencyHub(app) {
  if (!app || app.dataset.ready) return;
  const cards = HUB_CARDS.map(
    ([id, title, desc]) =>
      `<a class="card" href="#/${id}"><span class="card__body"><span class="card__title">${title}</span><span class="card__desc">${desc}</span></span></a>`
  ).join('');
  app.innerHTML = `<div class="page page--hub" data-emergency="1"><section class="hub"><header class="hub__hero"><div class="hub__brand"><h1 class="logo"><span class="logo__my">My Music</span> <span class="logo__place">Place</span></h1><p class="hub__greeting">O palco abriu mesmo assim. Escolha um módulo!</p></div></header><nav class="cards" aria-label="Módulos">${cards}</nav></section></div>`;
  app.dataset.ready = 'hub';
  app.dataset.route = 'hub';
}

setTimeout(() => {
  const app = document.getElementById('app');
  if (!app || app.dataset.ready) return;
  window.dispatchEvent(new Event('mmp-boot-timeout'));
  setTimeout(() => emergencyHub(app), 1500);
}, 4000);
