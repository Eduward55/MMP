// Corrida de obstáculos 2D: WASD / setas, o gato no carrinho desvia.
import { creatureSVG } from '../shared/creatures.js';
import { getProfile, kv } from '../shared/store.js';
import { themeTokens, hexToRgba } from '../shared/theme.js';
import { el, toast } from '../shared/ui.js';

const KEY = 'corrida';

export default {
  id: 'corrida',
  title: 'Corrida',
  icon: 'corrida',
  accent: '#fb923c',
  desc: 'Desvie dos obstáculos com WASD ou as setas. Corre, gatinho!',
  hideDock: true,
  async mount(root) {
    const profile = getProfile();
    const saved = (await kv.get(KEY).catch(() => null)) || {};
    let best = Number(saved.best) || 0;
    let x = 0.5;
    let vx = 0;
    let dist = 0;
    let speed = 180;
    let over = false;
    let paused = false;
    let alive = true;
    let raf = 0;
    let last = 0;
    let hitFlash = 0;
    const keys = new Set();
    let obstacles = [];
    let spawnIn = 0.7;
    let idSeq = 1;

    const canvas = el('canvas', { class: 'cr-canvas', 'aria-label': 'Pista' });
    const overlay = el('div', { class: 'cr-overlay', hidden: true });
    const nums = el('div', { class: 'cr-stats' });
    const car = el('div', { class: 'cr-car' });
    const stage = el('div', { class: 'cr-stage panel' }, canvas, car, overlay);
    const pauseBtn = el('button', { class: 'btn btn--primary', onclick: () => togglePause() }, 'Pausar');
    const newBtn = el('button', { class: 'btn btn--ghost', onclick: () => newGame() }, 'Nova corrida');

    function renderCar() {
      car.innerHTML = `
        <span class="cr-car__body"></span>
        <span class="cr-car__wheel cr-car__wheel--l"></span>
        <span class="cr-car__wheel cr-car__wheel--r"></span>
        <figure class="cr-car__pilot">${creatureSVG('cat', profile.cat, { size: 54, label: profile.cat.name })}</figure>
        <figure class="cr-car__co">${creatureSVG('otter', profile.otter, { size: 40, label: profile.otter.name })}</figure>`;
    }

    root.append(
      el(
        'section',
        { class: 'cr' },
        el(
          'aside',
          { class: 'panel cr-hud' },
          el('h2', {}, 'Corridinha'),
          nums,
          el('div', { class: 'row-actions' }, pauseBtn, newBtn),
          el('p', { class: 'hint' }, 'W/↑ acelera o clima (a pista corre). A/D ou ← → desviam. Esc pausa. Não bata nos cones e pedras.')
        ),
        stage
      )
    );
    renderCar();

    const ctx = canvas.getContext('2d');
    let lastHud = '';
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = stage.clientWidth || 640;
      const h = stage.clientHeight || 520;
      const tw = Math.floor(w * dpr);
      const th = Math.floor(h * dpr);
      if (canvas.width === tw && canvas.height === th) return;
      canvas.width = tw;
      canvas.height = th;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function hud() {
      const key = `${Math.floor(dist)}|${Math.round(speed)}|${over}|${paused}`;
      if (key !== lastHud) {
        lastHud = key;
        nums.innerHTML = '';
        [
          ['Metros', Math.floor(dist)],
          ['Velocidade', Math.round(speed)],
          ['Recorde', Math.max(best, Math.floor(dist))]
        ].forEach(([k, v]) => nums.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k))));
        pauseBtn.textContent = paused ? 'Continuar' : 'Pausar';
        pauseBtn.disabled = over;
      }
      const left = `${(x * 100).toFixed(2)}%`;
      if (car.style.left !== left) car.style.left = left;
      car.classList.toggle('is-hit', hitFlash > 0);
    }

    function showOverlay() {
      if (over) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(el('h2', {}, 'Batida!'), el('p', {}, `${Math.floor(dist)} metros`), el('button', { class: 'btn btn--primary', onclick: () => newGame() }, 'De novo'));
      } else if (paused) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(el('h2', {}, 'Pausa'), el('p', {}, 'Esc continua.'));
      } else overlay.hidden = true;
    }

    function togglePause() {
      if (over) return;
      paused = !paused;
      showOverlay();
      hud();
    }

    function newGame() {
      x = 0.5;
      vx = 0;
      dist = 0;
      speed = 180;
      over = false;
      paused = false;
      obstacles = [];
      spawnIn = 0.6;
      hitFlash = 0;
      showOverlay();
      hud();
    }

    function crash() {
      if (over) return;
      over = true;
      paused = false;
      hitFlash = 0.5;
      if (dist > best) {
        best = Math.floor(dist);
        toast(`Novo recorde: ${best} m!`, 'ok');
      }
      showOverlay();
      hud();
    }

    function spawn() {
      obstacles.push({
        id: idSeq++,
        x: 0.18 + Math.random() * 0.64,
        y: -0.08,
        w: 0.08 + Math.random() * 0.04,
        kind: Math.random() < 0.5 ? 'cone' : 'rock'
      });
    }

    function tick(dt) {
      if (over || paused) return;
      const left = keys.has('a') || keys.has('arrowleft');
      const right = keys.has('d') || keys.has('arrowright');
      const up = keys.has('w') || keys.has('arrowup');
      vx = (right ? 1 : 0) - (left ? 1 : 0);
      x = Math.max(0.12, Math.min(0.88, x + vx * dt * 0.85));
      if (up) speed = Math.min(340, speed + dt * 40);
      else speed = Math.max(160, speed - dt * 18);
      dist += (speed * dt) / 40;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = Math.max(0.28, 0.85 - dist / 400);
      }
      const vy = (speed / 420) * dt;
      obstacles.forEach((o) => (o.y += vy));
      obstacles = obstacles.filter((o) => o.y < 1.2);
      const px = x;
      const py = 0.82;
      obstacles.forEach((o) => {
        if (Math.abs(o.x - px) < o.w * 0.7 && Math.abs(o.y - py) < 0.08) crash();
      });
      if (hitFlash > 0) hitFlash -= dt;
    }

    function draw() {
      const w = stage.clientWidth || 640;
      const h = stage.clientHeight || 520;
      const theme = themeTokens();
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = theme.surface;
      ctx.fillRect(w * 0.12, 0, w * 0.76, h);
      ctx.strokeStyle = theme.accent;
      ctx.setLineDash([18, 16]);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w * 0.5, h);
      ctx.stroke();
      ctx.setLineDash([]);
      obstacles.forEach((o) => {
        const ox = o.x * w;
        const oy = o.y * h;
        ctx.fillStyle = o.kind === 'cone' ? theme.warn : theme.muted;
        ctx.beginPath();
        if (o.kind === 'cone') {
          ctx.moveTo(ox, oy - 18);
          ctx.lineTo(ox + 14, oy + 16);
          ctx.lineTo(ox - 14, oy + 16);
          ctx.closePath();
        } else {
          ctx.arc(ox, oy, 14, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.strokeStyle = theme.hairline;
        ctx.stroke();
      });
      if (hitFlash > 0) {
        ctx.fillStyle = hexToRgba(theme.danger, 0.18);
        ctx.fillRect(0, 0, w, h);
      }
    }

    function loop(ts) {
      if (!alive) return;
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      tick(dt);
      draw();
      hud();
      raf = requestAnimationFrame(loop);
    }

    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.matches('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(k)) {
        e.preventDefault();
        if (e.type === 'keydown') keys.add(k);
        else keys.delete(k);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    const ro = new ResizeObserver(() => resize());
    ro.observe(stage);
    resize();
    newGame();
    raf = requestAnimationFrame(loop);

    window.__mmpCorrida = {
      state: () => ({ x, dist, speed, over, paused, obstacles: obstacles.length }),
      input: (k, on = true) => {
        if (on) keys.add(k);
        else keys.delete(k);
      },
      tick: (dt) => tick(dt),
      crash,
      newGame
    };

    return {
      async save() {
        await kv.set(KEY, { best: Math.max(best, Math.floor(dist)) });
        return `Recorde local: ${Math.max(best, Math.floor(dist))} m.`;
      },
      unmount() {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        ro.disconnect();
        kv.set(KEY, { best: Math.max(best, Math.floor(dist)) }).catch(() => {});
        if (window.__mmpCorrida) delete window.__mmpCorrida;
      }
    };
  }
};
