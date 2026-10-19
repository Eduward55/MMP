// Corrida de obstáculos 2D: WASD / setas, o gato de frente no carrinho.
import { creatureSVG } from '../shared/creatures.js';
import { getProfile, kv } from '../shared/store.js';
import { themeTokens, hexToRgba } from '../shared/theme.js';
import { el, startAudio, toast } from '../shared/ui.js';

const KEY = 'corrida';
const CARS = [
  { id: 'laranja', name: 'Laranja', body: '#e8954a', trim: '#9a3412' },
  { id: 'azul', name: 'Azul', body: '#5b7c9a', trim: '#1e3a5f' },
  { id: 'menta', name: 'Menta', body: '#4f9d82', trim: '#14532d' },
  { id: 'ouro', name: 'Ouro', body: '#d4a017', trim: '#7c4a12' }
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
    const pauseBtn = el('button', { class: 'btn btn--primary', onclick: () => togglePause() }, 'Pausar');
    const newBtn = el('button', { class: 'btn btn--ghost', onclick: () => newGame() }, 'Nova corrida');
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
            c.name
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
        <span class="cr-car__spoiler"></span>
        <span class="cr-car__body"></span>
        <span class="cr-car__hood"></span>
        <span class="cr-car__glass"></span>
        <span class="cr-car__light cr-car__light--l"></span>
        <span class="cr-car__light cr-car__light--r"></span>
        <span class="cr-car__wheel cr-car__wheel--fl"></span>
        <span class="cr-car__wheel cr-car__wheel--fr"></span>
        <span class="cr-car__wheel cr-car__wheel--bl"></span>
        <span class="cr-car__wheel cr-car__wheel--br"></span>
        <figure class="cr-car__pilot">${creatureSVG('cat', profile.cat, { size: 58, label: profile.cat.name })}</figure>`;
      fan.innerHTML = `
        <span class="cr-fan__art">${creatureSVG('otter', profile.otter, { size: 72, extraClass: 'is-dancing', label: profile.otter.name })}</span>
        <span class="cr-fan__name">${profile.otter.name} torce!</span>`;
    }

    function persist() {
      return kv.set(KEY, { best: Math.max(best, Math.floor(dist)), car: carSkin, sound: musicOn }).catch(() => {});
    }

    async function ensureSound() {
      if (!musicOn || chip) return chip;
      try {
        const Tone = await startAudio();
        const out = new Tone.Gain(0.55).toDestination();
        const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 4, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -16 }).connect(out);
        const bass = new Tone.MonoSynth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.1 }, volume: -18 }).connect(out);
        const lead = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 }, volume: -22 }).connect(out);
        const noise = new Tone.Noise('brown').start();
        const nf = new Tone.Filter(420, 'lowpass').connect(out);
        const ng = new Tone.Gain(0.02).connect(nf);
        noise.connect(ng);
        const notes = ['G3', 'Bb3', 'C4', 'D4', 'F4', 'D4', 'C4', 'Bb3'];
        let i = 0;
        const loop = new Tone.Loop((time) => {
          if (over || paused) return;
          kick.triggerAttackRelease('C1', '8n', time);
          bass.triggerAttackRelease(notes[i % notes.length], '8n', time);
          if (i % 2 === 0) lead.triggerAttackRelease(notes[(i + 2) % notes.length], '16n', time);
          i++;
        }, '8n');
        Tone.Transport.bpm.value = 118;
        loop.start(0);
        if (Tone.Transport.state !== 'started') Tone.Transport.start();
        chip = {
          crash() {
            try {
              lead.triggerAttackRelease('G2', 0.28);
            } catch {}
          },
          setEngine(v) {
            ng.gain.rampTo(0.015 + v * 0.05, 0.08);
          },
          dispose() {
            try {
              loop.dispose();
              noise.stop();
            } catch {}
            [kick, bass, lead, noise, nf, ng, out].forEach((n) => n.dispose && n.dispose());
          }
        };
      } catch {
        chip = { crash() {}, setEngine() {}, dispose() {} };
      }
      return chip;
    }

    function toggleSound() {
      musicOn = !musicOn;
      soundBtn.textContent = `Som: ${musicOn ? 'ligado' : 'desligado'}`;
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
          el('h2', {}, 'Corridinha'),
          nums,
          fan,
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Carrinho'), skinRow),
          el('div', { class: 'row-actions' }, pauseBtn, newBtn, soundBtn),
          el('p', { class: 'hint' }, 'W/↑ acelera. A/D ou ← → desviam. Esc pausa. O bico do carro aponta para cima da pista.')
        ),
        stage
      )
    );
    renderCar();
    renderSkins();
    soundBtn.textContent = `Som: ${musicOn ? 'ligado' : 'desligado'}`;

    const ctx = canvas.getContext('2d');
    let lastHud = '';
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(320, stage.clientWidth || 640);
      const h = Math.max(420, stage.clientHeight || 520);
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
          ['Metros', Math.floor(dist)],
          ['Velocidade', Math.round(speed)],
          ['Recorde', Math.max(best, Math.floor(dist))]
        ].forEach(([k, v]) => nums.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('span', {}, k))));
        pauseBtn.textContent = paused ? 'Continuar' : 'Pausar';
        pauseBtn.disabled = over;
        soundBtn.textContent = `Som: ${musicOn ? 'ligado' : 'desligado'}`;
      }
      const left = `${(x * 100).toFixed(2)}%`;
      if (car.style.left !== left) car.style.left = left;
      car.classList.toggle('is-hit', hitFlash > 0);
      car.classList.toggle('is-boost', keys.has('w') || keys.has('arrowup'));
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
      spark = [];
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
      if (chip) chip.crash();
      if (dist > best) {
        best = Math.floor(dist);
        toast(`Novo recorde: ${best} m!`, 'ok');
      }
      showOverlay();
      hud();
    }

    function spawn() {
      const lane = 0.28 + Math.floor(Math.random() * 3) * 0.22;
      obstacles.push({
        id: idSeq++,
        x: lane + (Math.random() - 0.5) * 0.06,
        y: -0.08,
        w: 0.045,
        kind: Math.random() < 0.55 ? 'cone' : 'rock'
      });
    }

    function tick(dt) {
      if (over || paused) return;
      const left = keys.has('a') || keys.has('arrowleft');
      const right = keys.has('d') || keys.has('arrowright');
      const up = keys.has('w') || keys.has('arrowup');
      vx = (right ? 1 : 0) - (left ? 1 : 0);
      x = Math.max(0.22, Math.min(0.78, x + vx * dt * 0.85));
      if (up) speed = Math.min(360, speed + dt * 48);
      else speed = Math.max(160, speed - dt * 18);
      if (musicOn && !chip) ensureSound().catch(() => {});
      if (chip) chip.setEngine((speed - 160) / 200);
      dist += (speed * dt) / 40;
      roadY += (speed / 90) * dt;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = Math.max(0.34, 0.9 - dist / 420);
      }
      const vy = (speed / 420) * dt;
      obstacles.forEach((o) => (o.y += vy));
      obstacles = obstacles.filter((o) => o.y < 1.2);
      const px = x;
      const py = 0.9;
      const hitW = 0.038;
      const hitH = 0.028;
      obstacles.forEach((o) => {
        if (Math.abs(o.x - px) < hitW + o.w * 0.35 && Math.abs(o.y - py) < hitH + 0.018) crash();
      });
      if (Math.random() < dt * 14) {
        spark.push({ x: x + (Math.random() - 0.5) * 0.04, y: 0.93, vy: 0.2 + Math.random() * 0.15, life: 0.35 });
      }
      spark.forEach((s) => {
        s.y += s.vy * dt;
        s.life -= dt;
      });
      spark = spark.filter((s) => s.life > 0);
      if (hitFlash > 0) hitFlash -= dt;
    }

    function draw() {
      const w = stage.clientWidth || 640;
      const h = stage.clientHeight || 520;
      const theme = themeTokens();
      ctx.fillStyle = '#1a1520';
      ctx.fillRect(0, 0, w, h);
      const grass = ctx.createLinearGradient(0, 0, w, 0);
      grass.addColorStop(0, '#14532d');
      grass.addColorStop(0.18, '#166534');
      grass.addColorStop(0.82, '#166534');
      grass.addColorStop(1, '#14532d');
      ctx.fillStyle = grass;
      ctx.fillRect(0, 0, w, h);

      const left = w * 0.18;
      const rw = w * 0.64;
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(left, 0, rw, h);
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(left, 0, 8, h);
      ctx.fillRect(left + rw - 8, 0, 8, h);

      const dash = 28;
      const gap = 22;
      const off = (roadY * 80) % (dash + gap);
      ctx.strokeStyle = '#f4f4f5';
      ctx.lineWidth = 5;
      ctx.setLineDash([dash, gap]);
      ctx.lineDashOffset = -off;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w * 0.5, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = hexToRgba('#fbbf24', 0.35);
      for (let i = 0; i < 8; i++) {
        const ty = ((roadY * 90 + i * 70) % (h + 40)) - 20;
        ctx.fillRect(left - 14, ty, 10, 18);
        ctx.fillRect(left + rw + 4, ty + 10, 10, 18);
      }

      spark.forEach((s) => {
        ctx.fillStyle = hexToRgba('#fb923c', Math.max(0, s.life * 2));
        ctx.fillRect(s.x * w - 2, s.y * h, 3, 8);
      });

      obstacles.forEach((o) => {
        const ox = o.x * w;
        const oy = o.y * h;
        if (o.kind === 'cone') {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(ox, oy - 16);
          ctx.lineTo(ox + 11, oy + 12);
          ctx.lineTo(ox - 11, oy + 12);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fafafa';
          ctx.fillRect(ox - 7, oy - 2, 14, 5);
        } else {
          ctx.fillStyle = '#57534e';
          ctx.beginPath();
          ctx.ellipse(ox, oy + 4, 12, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#78716c';
          ctx.beginPath();
          ctx.ellipse(ox - 3, oy - 1, 6, 4, -0.4, 0, Math.PI * 2);
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
      state: () => ({ x, dist, speed, over, paused, obstacles: obstacles.length, car: carSkin }),
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
