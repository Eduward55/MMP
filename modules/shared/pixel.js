// Motor mínimo de pixel art: desenha numa grade e exporta como SVG (um <path> por cor).

export class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (color && this.inside(x, y)) this.px[y * this.w + x] = color;
  }

  get(x, y) {
    return this.inside(x, y) ? this.px[y * this.w + x] : null;
  }

  clear(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.inside(x, y)) this.px[y * this.w + x] = null;
  }

  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, color);
      }
    }
    return this;
  }

  ring(cx, cy, rx, ry, thickness, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const o = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        const i = ((x - cx) / (rx - thickness)) ** 2 + ((y - cy) / (ry - thickness)) ** 2;
        if (o <= 1 && i > 1) this.set(x, y, color);
      }
    }
    return this;
  }

  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
    return this;
  }

  tri(a, b, c, color) {
    const minX = Math.floor(Math.min(a[0], b[0], c[0]));
    const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
    const minY = Math.floor(Math.min(a[1], b[1], c[1]));
    const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
    const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p = [x, y];
        const d1 = sign(p, a, b);
        const d2 = sign(p, b, c);
        const d3 = sign(p, c, a);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) this.set(x, y, color);
      }
    }
    return this;
  }

  points(list, color, size = 1) {
    for (const [x, y] of list) this.rect(x, y, size, size, color);
    return this;
  }

  // rows: array de strings; cada caractere é uma chave da paleta ('.' ou ' ' = vazio)
  map(rows, palette, ox = 0, oy = 0) {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== '.' && ch !== ' ' && palette[ch]) this.set(ox + x, oy + y, palette[ch]);
      });
    });
    return this;
  }

  // Uma grade nova contendo apenas o contorno (vizinhos 4-direções vazios de pixels preenchidos).
  outline(color) {
    const out = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) {
          out.set(x, y, color);
        }
      }
    }
    return out;
  }

  // Junta outra grade por cima desta.
  stamp(other) {
    for (let i = 0; i < other.px.length; i++) if (other.px[i]) this.px[i] = other.px[i];
    return this;
  }
}

export function gridToPaths(grid) {
  const byColor = new Map();
  for (let y = 0; y < grid.h; y++) {
    let x = 0;
    while (x < grid.w) {
      const c = grid.get(x, y);
      if (!c) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < grid.w && grid.get(x + run, y) === c) run++;
      if (!byColor.has(c)) byColor.set(c, []);
      byColor.get(c).push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  }
  let out = '';
  for (const [color, d] of byColor) out += `<path fill="${color}" d="${d.join('')}"/>`;
  return out;
}

// Ícone a partir de um mapa de caracteres (usado nos cards e botões).
export function iconSVG(rows, palette, { size = 48, title = '' } = {}) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const g = new Grid(w, h).map(rows, palette);
  return `<svg class="pixel-icon" viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${title}">${gridToPaths(g)}</svg>`;
}
