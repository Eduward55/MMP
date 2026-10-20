// Kart top-down em pixel art. Bico/faróis em y=0 (cima da pista), aerofólio embaixo.
import { Grid, gridToPaths } from '../shared/pixel.js';

export const KART_W = 36;
export const KART_H = 54;

function hexMix(a, b, t) {
  const parse = (h) => {
    const s = String(h || '#888888').replace('#', '');
    if (s.length === 3) return [...s].map((c) => parseInt(c + c, 16));
    return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0];
  };
  const A = parse(a);
  const B = parse(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function tire(g, x, y) {
  g.rect(x, y, 7, 12, '#07070a');
  g.rect(x, y + 1, 7, 10, '#52525b');
  g.rect(x + 1, y + 2, 5, 8, '#18181b');
  g.rect(x + 1, y + 1, 5, 1, '#a1a1aa');
  g.rect(x + 1, y + 10, 5, 1, '#71717a');
  g.rect(x + 2, y + 4, 3, 5, '#e4e4e7');
  g.rect(x + 3, y + 5, 1, 3, '#facc15');
}

function lamp(g, x, y, hot, glass, shine) {
  g.rect(x, y, 6, 6, hot);
  g.rect(x + 1, y + 1, 4, 4, glass);
  g.rect(x + 1, y + 1, 2, 2, shine);
}

export function kartSVG(skin) {
  const body = skin.body;
  const trim = skin.trim;
  const hi = hexMix(body, '#fff4d6', 0.42);
  const lo = hexMix(body, '#14080c', 0.4);
  const ink = hexMix(trim, '#050208', 0.58);
  const stripe = hexMix('#fff7ed', body, 0.12);
  const chrome = '#94a3b8';
  const glass = '#67e8f9';
  const glassHi = '#ecfeff';
  const glassLo = '#0e7490';
  const lampHot = '#facc15';
  const lampGlass = '#fff7c2';
  const tail = '#e11d48';
  const tailHot = '#fecdd3';
  const trimHi = hexMix(trim, '#ffffff', 0.28);
  const cx = 18;
  const g = new Grid(KART_W, KART_H);

  // Rodas de kart bem visíveis, fora da carroceria.
  tire(g, 0, 10);
  tire(g, 29, 10);
  tire(g, 0, 32);
  tire(g, 29, 32);

  // Capô / bico na cor do carro (não um bloco cromado).
  g.ellipse(cx, 9, 10, 7, body);
  g.rect(cx - 9, 8, 18, 10, body);
  g.ellipse(cx, 8, 8, 5, hi);
  g.rect(cx - 7, 7, 14, 5, hi);
  g.rect(cx - 1, 6, 2, 13, stripe);

  // Para-choque fino.
  g.rect(cx - 6, 3, 12, 2, chrome);
  g.rect(cx - 4, 2, 8, 1, hexMix(chrome, '#ffffff', 0.35));

  // Dois faróis redondos, bem separados no bico.
  lamp(g, cx - 13, 3, lampHot, lampGlass, '#ffffff');
  lamp(g, cx + 7, 3, lampHot, lampGlass, '#ffffff');

  // Entrada de ar.
  g.rect(cx - 3, 11, 6, 3, ink);
  g.rect(cx - 2, 12, 4, 1, lo);

  // Para-lamas da frente.
  g.rect(cx - 12, 12, 4, 6, lo);
  g.rect(cx + 8, 12, 4, 6, lo);
  g.rect(cx - 11, 12, 3, 2, body);
  g.rect(cx + 8, 12, 3, 2, body);

  // Vidrinhos laterais — sem faixa atravessando o carro.
  g.rect(cx - 8, 17, 3, 4, glassLo);
  g.rect(cx + 5, 17, 3, 4, glassLo);
  g.rect(cx - 8, 17, 2, 3, glass);
  g.rect(cx + 6, 17, 2, 3, glass);
  g.set(cx - 8, 17, glassHi);
  g.set(cx + 7, 17, glassHi);

  // Espelhos.
  g.rect(cx - 14, 17, 3, 3, chrome);
  g.rect(cx + 11, 17, 3, 3, chrome);
  g.rect(cx - 14, 17, 2, 2, glass);
  g.rect(cx + 12, 17, 2, 2, glass);

  // Side pods com sombra na vertical, não em faixas.
  g.rect(cx - 11, 18, 6, 15, body);
  g.rect(cx + 5, 18, 6, 15, body);
  g.rect(cx - 11, 18, 2, 15, hi);
  g.rect(cx + 9, 18, 2, 15, hi);
  g.rect(cx - 7, 18, 2, 15, lo);
  g.rect(cx + 5, 18, 2, 15, lo);

  // Cockpit aberto + santo Antônio (postes, sem travessa larga).
  g.rect(cx - 6, 20, 12, 13, '#141218');
  g.rect(cx - 5, 21, 10, 11, '#221c28');
  g.rect(cx - 6, 20, 1, 12, trim);
  g.rect(cx + 5, 20, 1, 12, trim);
  g.rect(cx - 4, 30, 2, 3, trim);
  g.rect(cx + 2, 30, 2, 3, trim);

  // Convés traseiro.
  g.rect(cx - 9, 32, 18, 8, body);
  g.rect(cx - 9, 32, 2, 8, lo);
  g.rect(cx + 7, 32, 2, 8, lo);
  g.rect(cx - 1, 32, 2, 8, stripe);
  g.rect(cx - 12, 34, 4, 6, lo);
  g.rect(cx + 8, 34, 4, 6, lo);

  // Lanternas.
  g.rect(cx - 8, 37, 5, 3, tail);
  g.rect(cx + 3, 37, 5, 3, tail);
  g.rect(cx - 7, 37, 3, 2, tailHot);
  g.rect(cx + 4, 37, 3, 2, tailHot);

  // Escapamento.
  g.rect(cx - 4, 40, 3, 2, '#3f3f46');
  g.rect(cx + 1, 40, 3, 2, '#3f3f46');
  g.set(cx - 3, 41, '#f59e0b');
  g.set(cx + 2, 41, '#f59e0b');

  // Aerofólio separado, com endplates.
  g.rect(cx - 6, 42, 2, 3, trim);
  g.rect(cx + 4, 42, 2, 3, trim);
  g.rect(cx - 13, 44, 2, 6, ink);
  g.rect(cx + 11, 44, 2, 6, ink);
  g.rect(cx - 12, 45, 24, 3, trim);
  g.rect(cx - 12, 45, 24, 1, trimHi);
  g.rect(cx - 11, 48, 22, 1, ink);

  const outline = g.outline(ink);
  return `<svg class="cr-car__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${KART_W} ${KART_H}" width="${KART_W * 3}" height="${KART_H * 3}" shape-rendering="crispEdges" aria-hidden="true">${gridToPaths(outline)}${gridToPaths(g)}</svg>`;
}
