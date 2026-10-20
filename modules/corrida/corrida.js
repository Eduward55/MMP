// Corrida de obstáculos 2D: WASD / setas, o gato de frente no carrinho.
import { kartSVG } from './car.js';
import { creatureSVG } from '../shared/creatures.js';
import { getProfile, kv } from '../shared/store.js';
import { themeTokens, hexToRgba } from '../shared/theme.js';
import { el, startAudio, toast } from '../shared/ui.js';
import { t } from '../shared/i18n.js';

const KEY = 'corrida';
const CARS = [
  { id: 'laranja', nameKey: 'cr.laranja', body: '#e8954a', trim: '#9a3412' },
  { id: 'azul', nameKey: 'cr.azul', body: '#5b7c9a', trim: '#1e3a5f' },
  { id: 'menta', nameKey: 'cr.menta', body: '#4f9d82', trim: '#14532d' },
  { id: 'ouro', nameKey: 'cr.ouro', body: '#d4a017', trim: '#7c4a12' }
];

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
    let carSkin = CARS.some((c) => c.id === saved.car) ? saved.car : saved.car === 'roxo' ? 'azul' : 'laranja';
    let chip = null;
    let musicOn = saved.sound !== false;
    let x = 0.5;
    let y = 0.84;
    let vx = 0;
    let dist = 0;
    let speed = 180;
    let over = false;
    let paused = false;
    let alive = true;
    let raf = 0;
    let last = 0;
    let hitFlash = 0;
    let roadY = 0;
    const keys = new Set();
    let obstacles = [];
    let spark = [];
    let spawnIn = 0.7;
    let idSeq = 1;

    const canvas = el('canvas', { class: 'cr-canvas', 'aria-label': 'Pista' });
    const overlay = el('div', { class: 'cr-overlay', hidden: true });
    const nums = el('div', { class: 'cr-stats' });
    const car = el('div', { class: 'cr-car' });
    const fan = el('div', { class: 'cr-fan' });
    const skinRow = el('div', { class: 'chips cr-skins', role: 'radiogroup', 'aria-label': 'Carrinho' });
    const stage = el('div', { class: 'cr-stage panel' }, canvas, car, overlay);
    const pauseBtn = el('button', { class: 'btn btn--primary', onclick: () => togglePause() }, t('cr.pause'));
    const newBtn = el('button', { class: 'btn btn--ghost', onclick: () => newGame() }, t('cr.new'));
    const soundBtn = el('button', { class: 'btn btn--ghost btn--sm', onclick: () => toggleSound() }, '');

    function skin() {
      return CARS.find((c) => c.id === carSkin) || CARS[0];
    }

    function renderSkins() {
      skinRow.innerHTML = '';
      CARS.forEach((c) => {
        skinRow.append(
          el(
            'button',
            {
              class: `chip ${carSkin === c.id ? 'is-on' : ''}`,
              role: 'radio',
              'aria-checked': String(carSkin === c.id),
              onclick: () => {
                carSkin = c.id;
                renderCar();
                renderSkins();
                persist();
              }
            },
            t(c.nameKey)
          )
        );
      });
    }

    function renderCar() {
      const s = skin();
      car.dataset.skin = s.id;
      car.style.setProperty('--car', s.body);
      car.style.setProperty('--trim', s.trim);
      car.innerHTML = `
        <span class="cr-car__shadow"></span>
        <span class="cr-car__beam cr-car__beam--l"></span>
        <span class="cr-car__beam cr-car__beam--r"></span>
        <span class="cr-car__art">${kartSVG(s)}</span>
        <figure class="cr-car__pilot">${creatureSVG('cat', profile.cat, { size: 40, label: profile.cat.name, viewBox: '12 6 24 22' })}</figure>
        <span class="cr-car__flame cr-car__flame--l"></span>
        <span class="cr-car__flame cr-car__flame--r"></span>`;
      fan.innerHTML = `
        <span class="cr-fan__art">${creatureSVG('otter', profile.otter, { size: 72, extraClass: 'is-dancing', label: profile.otter.name })}</span>
        <span class="cr-fan__name">${t('cr.cheer', { name: profile.otter.name })}</span>`;
    }

    function persist() {
      return kv.set(KEY, { best: Math.max(best, Math.floor(dist)), car: carSkin, sound: musicOn }).catch(() => {});
    }

    async function ensureSound() {
      if (!musicOn || chip) return chip;
      try {
        const Tone = await startAudio();
        const out = new Tone.Gain(0.55).toDestination();
        const crashSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 }, volume: -14 }).connect(out);
        const noise = new Tone.Noise('brown').start();
        const nf = new Tone.Filter(420, 'lowpass').connect(out);
        const ng = new Tone.Gain(0.02).connect(nf);
        noise.connect(ng);
        chip = {
          crash() {
            try {
              crashSynth.triggerAttackRelease('G2', 0.28);
            } catch {}
          },
          setEngine(v) {
            ng.gain.rampTo(0.015 + v * 0.05, 0.08);
          },
          dispose() {
            try {
              noise.stop();
            } catch {}
            [crashSynth, noise, nf, ng, out].forEach((n) => n.dispose && n.dispose());
          }
        };
      } catch {
        chip = { crash() {}, setEngine() {}, dispose() {} };
      }
      return chip;
    }

    function toggleSound() {
      musicOn = !musicOn;
      soundBtn.textContent = musicOn ? t('common.soundOn') : t('common.soundOff');
      if (musicOn) ensureSound().catch(() => {});
      else if (chip) {
        chip.dispose();
        chip = null;
      }
      persist();
    }

    root.append(
      el(
        'section',
        { class: 'cr' },
        el(
          'aside',
          { class: 'panel cr-hud' },
          el('h2', {}, t('cr.title')),
          nums,
          fan,
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('cr.car')), skinRow),
          el('div', { class: 'row-actions' }, pauseBtn, newBtn, soundBtn),
          el('p', { class: 'hint' }, t('cr.hint'))
        ),
        stage
      )
    );
    renderCar();
    renderSkins();
    soundBtn.textContent = musicOn ? t('common.soundOn') : t('common.soundOff');

    const ctx = canvas.getContext('2d');
    let lastHud = '';
    const ROAD_TOP = 0.38;
    const ROAD_BOT = 0.88;
    const LANE_HALF = 0.32;

    function roadHalf(ny) {
      const t = Math.max(0, Math.min(1, ny));
      return (ROAD_TOP + (ROAD_BOT - ROAD_TOP) * t) * 0.5;
    }

    function projectX(nx, ny) {
      return 0.5 + ((nx - 0.5) / LANE_HALF) * roadHalf(ny);
    }

    function depthScale(ny) {
      return 0.42 + Math.max(0, Math.min(1, ny)) * 0.58;
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(360, stage.clientWidth || 720);
      const h = Math.max(560, stage.clientHeight || 680);
      const tw = Math.floor(w * dpr);
      const th = Math.floor(h * dpr);
      if (canvas.width === tw && canvas.height === th) return;
      canvas.width = tw;
      canvas.height = th;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function hud() {
      const key = `${Math.floor(dist)}|${Math.round(speed)}|${over}|${paused}|${carSkin}`;
      if (key !== lastHud) {
        lastHud = key;
        nums.innerHTML = '';
        [
          [t('cr.meters'), Math.floor(dist)],
          [t('cr.speed'), Math.round(speed)],
          [t('cr.best'), Math.max(best, Math.floor(dist))]
        ].forEach(([k, v]) => nums.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k))));
        pauseBtn.textContent = paused ? t('cr.resume') : t('cr.pause');
        pauseBtn.disabled = over;
        soundBtn.textContent = musicOn ? t('common.soundOn') : t('common.soundOff');
      }
      const left = `${(projectX(x, y) * 100).toFixed(2)}%`;
      const top = `${(y * 100).toFixed(2)}%`;
      if (car.style.left !== left) car.style.left = left;
      if (car.style.top !== top) car.style.top = top;
      const steer = over || paused ? '0deg' : `${vx * 8}deg`;
      if (car.style.getPropertyValue('--steer') !== steer) car.style.setProperty('--steer', steer);
      const zoom = String((0.62 + y * 0.4).toFixed(3));
      if (car.style.getPropertyValue('--zoom') !== zoom) car.style.setProperty('--zoom', zoom);
      const rushing = !over && !paused;
      car.classList.toggle('is-hit', hitFlash > 0);
      car.classList.toggle('is-run', rushing);
      car.classList.toggle('is-boost', keys.has(' '));
    }

    function showOverlay() {
      if (over) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(el('h2', {}, t('cr.crash')), el('p', {}, `${Math.floor(dist)} ${t('cr.meters').toLowerCase()}`), el('button', { class: 'btn btn--primary', onclick: () => newGame() }, t('cr.again')));
      } else if (paused) {
        overlay.hidden = false;
        overlay.innerHTML = '';
        overlay.append(el('h2', {}, t('cr.pauseTitle')), el('p', {}, t('cr.pauseHint')));
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
      y = 0.84;
      vx = 0;
      dist = 0;
      speed = 180;
      over = false;
      paused = false;
      obstacles = [];
      spark = [];
      spawnIn = 0.55;
      hitFlash = 0;
      spawn('sack', 0.32);
      spawn('cone', 0.12);
      showOverlay();
      hud();
    }

    function crash() {
      if (over) return;
      over = true;
      paused = false;
      hitFlash = 0.5;
      if (chip) chip.crash();
      if (dist > best) {
        best = Math.floor(dist);
        toast(`Novo recorde: ${best} m!`, 'ok');
      }
      showOverlay();
      hud();
    }

    function spawn(kind, y = -0.1) {
      const pick = kind || (Math.random() < 0.38 ? 'sack' : Math.random() < 0.55 ? 'cone' : 'rock');
      const lane = 0.28 + Math.floor(Math.random() * 3) * 0.22;
      obstacles.push({
        id: idSeq++,
        x: lane + (Math.random() - 0.5) * 0.05,
        y,
        w: pick === 'sack' ? 0.12 : pick === 'rock' ? 0.1 : 0.09,
        kind: pick
      });
    }

    function tick(dt) {
      if (over || paused) return;
      const left = keys.has('a') || keys.has('arrowleft');
      const right = keys.has('d') || keys.has('arrowright');
      const up = keys.has('w') || keys.has('arrowup');
      const down = keys.has('s') || keys.has('arrowdown');
      const boost = keys.has(' ');
      vx = (right ? 1 : 0) - (left ? 1 : 0);
      x = Math.max(0.22, Math.min(0.78, x + vx * dt * 0.85));
      if (boost) speed = Math.min(540, speed + dt * 190);
      else if (up) speed = Math.min(380, speed + dt * 70);
      else if (down) speed = Math.max(150, speed - dt * 26);
      else speed = Math.max(170, speed - dt * 14);
      if (up) y = Math.max(0.18, y - dt * 0.42);
      else if (down) y = Math.min(0.9, y + dt * 0.48);
      if (musicOn && !chip) ensureSound().catch(() => {});
      if (chip) chip.setEngine((speed - 160) / 280);
      dist += (speed * dt) / 40;
      roadY += (speed / 38) * dt;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = Math.max(0.34, 0.9 - dist / 420);
      }
      const vy = (speed / 420) * dt;
      obstacles.forEach((o) => (o.y += vy));
      obstacles = obstacles.filter((o) => o.y < 1.2);
      const px = x;
      const py = y;
      const hitW = 0.026;
      const hitH = 0.022;
      obstacles.forEach((o) => {
        if (Math.abs(o.x - px) < hitW + o.w * 0.42 && Math.abs(o.y - py) < hitH + 0.022) crash();
      });
      if (Math.random() < dt * 14) {
        spark.push({ x: x + (Math.random() - 0.5) * 0.04, y: y + 0.08, vy: 0.2 + Math.random() * 0.15, life: 0.35 });
      }
      spark.forEach((s) => {
        s.y += s.vy * dt;
        s.life -= dt;
      });
      spark = spark.filter((s) => s.life > 0);
      if (hitFlash > 0) hitFlash -= dt;
    }

    function draw() {
      const w = stage.clientWidth || 720;
      const h = stage.clientHeight || 680;
      const theme = themeTokens();
      const cx = w * 0.5;
      const topHalf = w * ROAD_TOP * 0.5;
      const botHalf = w * ROAD_BOT * 0.5;
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, w, h);
      const grass = ctx.createLinearGradient(0, 0, w, 0);
      grass.addColorStop(0, '#14532d');
      grass.addColorStop(0.5, '#166534');
      grass.addColorStop(1, '#14532d');
      ctx.fillStyle = grass;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#2a2a32';
      ctx.beginPath();
      ctx.moveTo(cx - topHalf, 0);
      ctx.lineTo(cx + topHalf, 0);
      ctx.lineTo(cx + botHalf, h);
      ctx.lineTo(cx - botHalf, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx - topHalf, 0);
      ctx.lineTo(cx - botHalf, h);
      ctx.moveTo(cx + topHalf, 0);
      ctx.lineTo(cx + botHalf, h);
      ctx.stroke();

      const period = 0.16;
      const dashLen = 0.07;
      const off = (roadY * 0.045) % period;
      ctx.strokeStyle = '#f4f4f5';
      ctx.lineCap = 'butt';
      for (let i = -2; i < 18; i++) {
        const y0 = i * period - off;
        const y1 = y0 + dashLen;
        if (y1 < 0 || y0 > 1) continue;
        const sc = depthScale((y0 + y1) / 2);
        ctx.lineWidth = 2 + sc * 3;
        ctx.beginPath();
        ctx.moveTo(projectX(0.5, y0) * w, y0 * h);
        ctx.lineTo(projectX(0.5, y1) * w, y1 * h);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(244,244,245,0.28)';
      for (const lane of [0.34, 0.66]) {
        for (let i = -2; i < 18; i++) {
          const y0 = i * period - off * 0.85;
          const y1 = y0 + dashLen * 0.7;
          if (y1 < 0 || y0 > 1) continue;
          const sc = depthScale((y0 + y1) / 2);
          ctx.lineWidth = 1.2 + sc * 1.8;
          ctx.beginPath();
          ctx.moveTo(projectX(lane, y0) * w, y0 * h);
          ctx.lineTo(projectX(lane, y1) * w, y1 * h);
          ctx.stroke();
        }
      }

      ctx.fillStyle = hexToRgba('#fbbf24', 0.4);
      for (let i = 0; i < 10; i++) {
        const ty = ((i / 9 - ((roadY * 0.07) % 0.12) + 1) % 1.12) - 0.06;
        const sc = depthScale(ty);
        const pw = 5 * sc;
        const ph = 10 * sc;
        ctx.fillRect(projectX(0.18, ty) * w - pw, ty * h, pw, ph);
        ctx.fillRect(projectX(0.82, ty) * w, ty * h, pw, ph);
      }

      const carPx = projectX(x, y) * w;
      const carPy = y * h;
      const poolR = 70 * depthScale(y);
      const pool = ctx.createRadialGradient(carPx, carPy - poolR * 0.7, 6, carPx, carPy - 12, poolR);
      pool.addColorStop(0, 'rgba(254, 240, 138, 0.2)');
      pool.addColorStop(0.45, 'rgba(253, 224, 71, 0.08)');
      pool.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = pool;
      ctx.fillRect(carPx - poolR, carPy - poolR * 1.4, poolR * 2, poolR * 1.6);

      spark.forEach((s) => {
        ctx.fillStyle = hexToRgba('#fb923c', Math.max(0, s.life * 2));
        ctx.fillRect(projectX(s.x, s.y) * w - 2, s.y * h, 3, 8 * depthScale(s.y));
      });

      obstacles.forEach((o) => {
        const ox = projectX(o.x, o.y) * w;
        const oy = o.y * h;
        const k = depthScale(o.y);
        if (o.kind === 'cone') {
          ctx.fillStyle = '#ea580c';
          ctx.beginPath();
          ctx.moveTo(ox, oy - 42 * k);
          ctx.lineTo(ox + 26 * k, oy + 22 * k);
          ctx.lineTo(ox - 26 * k, oy + 22 * k);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fafafa';
          ctx.fillRect(ox - 16 * k, oy - 6 * k, 32 * k, 10 * k);
          ctx.fillStyle = '#9a3412';
          ctx.fillRect(ox - 22 * k, oy + 18 * k, 44 * k, 8 * k);
        } else if (o.kind === 'sack') {
          ctx.fillStyle = '#9a6b2f';
          ctx.beginPath();
          ctx.moveTo(ox - 22 * k, oy + 28 * k);
          ctx.quadraticCurveTo(ox - 30 * k, oy + 4 * k, ox - 16 * k, oy - 18 * k);
          ctx.lineTo(ox + 16 * k, oy - 18 * k);
          ctx.quadraticCurveTo(ox + 30 * k, oy + 4 * k, ox + 22 * k, oy + 28 * k);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#c4893a';
          ctx.beginPath();
          ctx.ellipse(ox, oy - 8 * k, 20 * k, 14 * k, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 4 * k;
          ctx.beginPath();
          ctx.moveTo(ox - 10 * k, oy - 22 * k);
          ctx.quadraticCurveTo(ox, oy - 38 * k, ox + 10 * k, oy - 22 * k);
          ctx.stroke();
          ctx.fillStyle = '#7c4a12';
          ctx.fillRect(ox - 14 * k, oy + 6 * k, 28 * k, 8 * k);
        } else {
          ctx.fillStyle = '#57534e';
          ctx.beginPath();
          ctx.ellipse(ox, oy + 8 * k, 28 * k, 20 * k, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#78716c';
          ctx.beginPath();
          ctx.ellipse(ox - 8 * k, oy - 2 * k, 14 * k, 10 * k, -0.4, 0, Math.PI * 2);
          ctx.fill();
        }
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
      const k = e.key === ' ' || e.code === 'Space' ? ' ' : e.key.toLowerCase();
      if (k === 'escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      const drive = k === ' ' || ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(k);
      if (drive) {
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
      state: () => ({ x, y, dist, speed, over, paused, obstacles: obstacles.length, kinds: obstacles.map((o) => o.kind), car: carSkin, boost: keys.has(' ') }),
      input: (k, on = true) => {
        if (on) keys.add(k);
        else keys.delete(k);
      },
      tick: (dt) => tick(dt),
      spawnSack: () => spawn('sack', 0.42),
      crash,
      newGame
    };

    return {
      async save() {
        await persist();
        return `Recorde local: ${Math.max(best, Math.floor(dist))} m.`;
      },
      unmount() {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        ro.disconnect();
        persist();
        if (chip) chip.dispose();
        if (window.__mmpCorrida) delete window.__mmpCorrida;
      }
    };
  }
};
