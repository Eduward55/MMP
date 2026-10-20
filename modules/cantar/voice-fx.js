// Grafo seco/molhado do Cantar: mic → HPF 90 Hz → Tone.Gate → EQ/comp → SÓ o efeito ativo → limiter → saída.
// Sem RNNoise (não há biblioteca de NS vendorizada). echoCancellation do SO fica desligado no getUserMedia
// para os chips não virarem a mesma voz abafada. Nós inativos saem da cadeia (BitCrusher+PitchShift em série chiavam).
import { createTalkbox } from './vocoder.js';

/** Esta app é offline: não há RNNoise/nsnet2 vendorizado e não vamos puxar CDN. */
export const NS_LIBRARY = false;

export const FX = [
  { id: 'natural', name: 'Natural', hint: 'Voz limpa, sem efeito extra.' },
  { id: 'acapela', name: 'Acapela', hint: 'Vocal seco, presença no médio, acompanhamento bem baixo.' },
  { id: 'autotune', name: 'Autotune', hint: 'Cola a nota na escala — auto-tune bem óbvio, não sutil.' },
  { id: 'agudo', name: 'Agudo', hint: 'Uma oitava acima, voz de desenho.' },
  { id: 'grave', name: 'Grave', hint: 'Uma oitava abaixo, peito bem grosso.' },
  { id: 'robo', name: 'Robô', hint: 'Bitcrush e ring mod metálico, inconfundível.' },
  { id: 'eco', name: 'Eco', hint: 'Delay com ecos bem audíveis, um atrás do outro.' },
  { id: 'talkbox', name: 'Talkbox', hint: 'Vocoder / talkbox (voz no synth).' },
  { id: 'coro', name: 'Coro', hint: 'Várias vozes levemente desafinadas.' },
  { id: 'radio', name: 'Rádio', hint: 'Faixa estreita de rádio AM, com crunch.' },
  { id: 'cristal', name: 'Cristal', hint: 'Oitava acima e harmônicos brilhantes.' },
  { id: 'caverna', name: 'Caverna', hint: 'Reverb enorme, ainda com agudos.' },
  { id: 'sussurro', name: 'Sussurro', hint: 'Sopro, agudos e um pouco de ruído.' },
  { id: 'velhinha', name: 'Velhinha', hint: 'Voz fina, um pouco mais aguda, com vibrato.' },
  { id: 'alvinhos', name: 'Alvinhos', hint: 'Esquilos: voz bem aguda, chipmunk.' },
  { id: 'transformers', name: 'Transformers', hint: 'Vocoder metálico, robô de filme.' }
];

export const OVERLAY_IDS = new Set(['natural', 'acapela', 'coro', 'talkbox', 'eco']);

const FX_IDS = new Set(FX.map((f) => f.id));

export function normalizeFxId(id) {
  if (id === 'mega') return 'velhinha';
  return FX_IDS.has(id) ? id : 'natural';
}

function blank(over = {}) {
  return {
    pitch: 0,
    delayTime: 0,
    delayFeedback: 0,
    wet: 0,
    dry: 1,
    bits: 0,
    ringHz: 0,
    bpLow: 0,
    bpHigh: 0,
    hp: 70,
    lp: 16000,
    presence: 0,
    shelf: 0,
    reverbWet: 0,
    room: 0,
    chorusDepth: 0,
    noiseMix: 0,
    vibratoRate: 0,
    vibratoDepth: 0,
    talkboxWet: 0,
    backingDuck: 1,
    snap: 0,
    color: 0,
    gateFloor: 0.05,
    monitorScale: 1,
    connected: [],
    ...over
  };
}

const BASE = {
  natural: blank(),
  acapela: blank({ presence: 6.5, hp: 180, shelf: 3.2, backingDuck: 0.08 }),
  autotune: blank({ wet: 1, dry: 0.04, snap: 1, color: 0.88, presence: 4.5, shelf: 5.5, connected: ['pitchShift', 'color'] }),
  agudo: blank({ pitch: 7, wet: 1, dry: 0.03, presence: 7.5, hp: 150, shelf: 9, connected: ['pitchShift'] }),
  grave: blank({ pitch: -12, wet: 1, dry: 0.03, presence: -2.4, hp: 50, lp: 9800, shelf: -1.5, connected: ['pitchShift'] }),
  robo: blank({ wet: 1, dry: 0.02, bits: 3, ringHz: 88, bpLow: 360, bpHigh: 3400, connected: ['crush', 'ring'] }),
  eco: blank({
    wet: 0.62,
    dry: 0.72,
    delayTime: 0.28,
    delayFeedback: 0.42,
    monitorScale: 0.58,
    connected: ['delay']
  }),
  talkbox: blank({ wet: 1, dry: 0.05, talkboxWet: 1.6, backingDuck: 0.48, connected: ['talkbox'] }),
  coro: blank({ wet: 0.56, dry: 0.52, chorusDepth: 0.55, presence: 2.2, monitorScale: 0.74, connected: ['chorus'] }),
  radio: blank({ wet: 1, dry: 0.03, bpLow: 520, bpHigh: 2350, color: 0.92, connected: ['radio'] }),
  cristal: blank({
    pitch: 12,
    wet: 0.88,
    dry: 0.22,
    shelf: 10.5,
    delayTime: 0.08,
    delayFeedback: 0.14,
    connected: ['pitchShift', 'cristal']
  }),
  caverna: blank({
    wet: 0.7,
    dry: 0.42,
    reverbWet: 0.76,
    room: 0.72,
    lp: 4800,
    hp: 90,
    monitorScale: 0.55,
    connected: ['convolver']
  }),
  sussurro: blank({
    wet: 0.86,
    dry: 0.1,
    hp: 620,
    lp: 15000,
    shelf: 11,
    noiseMix: 0.4,
    backingDuck: 0.68,
    gateFloor: 0.18,
    connected: ['whisper']
  }),
  velhinha: blank({
    pitch: 5,
    wet: 0.96,
    dry: 0.06,
    hp: 400,
    lp: 8200,
    vibratoRate: 6.4,
    vibratoDepth: 0.0075,
    connected: ['pitchShift', 'vibrato']
  }),
  alvinhos: blank({
    pitch: 12,
    wet: 1,
    dry: 0.02,
    presence: 9.5,
    hp: 280,
    shelf: 12,
    connected: ['pitchShift']
  }),
  transformers: blank({
    wet: 1,
    dry: 0.02,
    bits: 5,
    ringHz: 28,
    talkboxWet: 1.85,
    bpLow: 280,
    bpHigh: 2800,
    connected: ['talkbox', 'crush', 'ring']
  })
};

export function graphFor(id, autotuneOn = false) {
  const fx = normalizeFxId(id);
  const g = { id: fx, autotune: false, live: false, ...BASE[fx] };
  g.connected = [...g.connected];
  const overlay = Boolean(autotuneOn) && OVERLAY_IDS.has(fx);
  if (fx === 'autotune' || overlay) {
    g.autotune = true;
    g.snap = fx === 'autotune' ? 1 : 0.92;
    if (!g.connected.includes('pitchShift')) g.connected.push('pitchShift');
    if (fx === 'autotune' && !g.connected.includes('color')) g.connected.push('color');
    if (overlay && g.wet < 0.45) {
      g.wet = 0.78;
      g.dry = Math.min(g.dry, 0.28);
    }
  }
  return g;
}

export function fingerprint(g) {
  const copy = { ...g, connected: [...(g.connected || [])].sort() };
  delete copy.id;
  delete copy.live;
  return JSON.stringify(copy);
}

function cut(node) {
  if (!node) return;
  try {
    node.disconnect();
  } catch {}
}

function curveBits(bits) {
  const steps = Math.max(2, 2 ** bits);
  const n = 2048;
  const c = new Float32Array(n);
  const half = steps / 2;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.round(x * half) / half;
  }
  return c;
}

function curveTanh(amount) {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount);
  }
  return c;
}

function curveCheby() {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.max(-1, Math.min(1, 4 * x * x * x - 3 * x));
  }
  return c;
}

function makeNoiseBuffer(ctx, seconds = 1.4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeCaveIR(ctx, seconds = 1.35) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 2.35) * (1 - i / len);
      const n = Math.random() * 2 - 1;
      lp = lp * 0.9 + n * 0.1;
      d[i] = (n * 0.5 + lp * 0.5) * env * (ch ? 0.94 : 1);
    }
  }
  return buf;
}

function startOsc(osc) {
  try {
    osc.start();
  } catch {}
}

/**
 * @param {typeof import('tone')} Tone
 */
export function createVoiceFx(Tone) {
  const ctx = Tone.getContext().rawContext;
  const started = [];
  const input = ctx.createGain();
  input.gain.value = 1;
  const rumble = ctx.createBiquadFilter();
  rumble.type = 'highpass';
  rumble.frequency.value = 90;
  rumble.Q.value = 0.7;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  hp.Q.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 16000;
  lp.Q.value = 0.45;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3000;
  presence.Q.value = 1.05;
  presence.gain.value = 0;
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = 6500;
  shelf.gain.value = 0;
  const nsGate = new Tone.Gate({ threshold: -48, smoothing: 0.08 });
  const gate = ctx.createGain();
  gate.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3.8;
  comp.knee.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.1;
  const bus = ctx.createGain();
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0;
  const mix = ctx.createGain();
  const limiter = new Tone.Limiter(-4);
  const voiceGain = new Tone.Gain(0.84);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.38;

  input.connect(rumble);
  rumble.connect(analyser);
  Tone.connect(rumble, nsGate);
  Tone.connect(nsGate, hp);
  hp.connect(lp);
  lp.connect(presence);
  presence.connect(shelf);
  shelf.connect(gate);
  gate.connect(comp);
  comp.connect(bus);
  bus.connect(dryGain);
  dryGain.connect(mix);
  wetGain.connect(mix);
  Tone.connect(mix, limiter);
  limiter.connect(voiceGain);
  voiceGain.toDestination();

  const pitchShift = new Tone.PitchShift({ pitch: 0, windowSize: 0.1, delayTime: 0, feedback: 0 });
  if (pitchShift.wet) pitchShift.wet.value = 1;
  const pitchLp = ctx.createBiquadFilter();
  pitchLp.type = 'lowpass';
  pitchLp.frequency.value = 18000;
  pitchLp.Q.value = 0.4;
  const pitchHs = ctx.createBiquadFilter();
  pitchHs.type = 'highshelf';
  pitchHs.frequency.value = 4200;
  pitchHs.gain.value = 3.5;
  const pitchOut = ctx.createGain();
  pitchShift.connect(pitchLp);
  pitchLp.connect(pitchHs);
  pitchHs.connect(pitchOut);

  const color = ctx.createWaveShaper();
  color.curve = curveTanh(3.6);
  color.oversample = 'none';
  const colorOut = ctx.createGain();
  color.connect(colorOut);

  const crush = ctx.createWaveShaper();
  crush.curve = curveBits(3);
  crush.oversample = 'none';
  const ring = ctx.createGain();
  ring.gain.value = 0.42;
  const ringOsc = ctx.createOscillator();
  ringOsc.type = 'square';
  ringOsc.frequency.value = 88;
  const ringDepth = ctx.createGain();
  ringDepth.gain.value = 0.55;
  ringOsc.connect(ringDepth);
  ringDepth.connect(ring.gain);
  startOsc(ringOsc);
  started.push(ringOsc);
  const robotHp = ctx.createBiquadFilter();
  robotHp.type = 'highpass';
  robotHp.frequency.value = 360;
  const robotLp = ctx.createBiquadFilter();
  robotLp.type = 'lowpass';
  robotLp.frequency.value = 3400;
  const robotOut = ctx.createGain();
  robotOut.gain.value = 0.98;
  crush.connect(ring);
  ring.connect(robotHp);
  robotHp.connect(robotLp);
  robotLp.connect(robotOut);

  const delay = ctx.createDelay(1.4);
  delay.delayTime.value = 0.28;
  const delayFilt = ctx.createBiquadFilter();
  delayFilt.type = 'lowpass';
  delayFilt.frequency.value = 3800;
  const delayFb = ctx.createGain();
  delayFb.gain.value = 0;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.82;
  delay.connect(delayFilt);
  delayFilt.connect(delayFb);
  delayFb.connect(delay);
  delayFilt.connect(delayOut);

  const talkbox = createTalkbox(ctx);

  const chorusIn = ctx.createGain();
  const chorusOut = ctx.createGain();
  chorusIn.connect(chorusOut);
  const chorusLfo = ctx.createOscillator();
  chorusLfo.type = 'sine';
  chorusLfo.frequency.value = 1.15;
  startOsc(chorusLfo);
  started.push(chorusLfo);
  const chorusTaps = [0.01, 0.018, 0.027, 0.038].map((time, i) => {
    const d = ctx.createDelay(0.08);
    d.delayTime.value = time;
    const g = ctx.createGain();
    g.gain.value = 0.38;
    const depth = ctx.createGain();
    depth.gain.value = 0.0034 * (i + 1);
    chorusLfo.connect(depth);
    depth.connect(d.delayTime);
    chorusIn.connect(d);
    d.connect(g);
    g.connect(chorusOut);
    return { delay: d, gain: g, depth };
  });

  const radioHp = ctx.createBiquadFilter();
  radioHp.type = 'highpass';
  radioHp.frequency.value = 520;
  radioHp.Q.value = 0.75;
  const radioShaper = ctx.createWaveShaper();
  radioShaper.curve = curveTanh(4.2);
  radioShaper.oversample = 'none';
  const radioLp = ctx.createBiquadFilter();
  radioLp.type = 'lowpass';
  radioLp.frequency.value = 2350;
  radioLp.Q.value = 0.9;
  const radioAm = ctx.createGain();
  radioAm.gain.value = 0.78;
  const radioOsc = ctx.createOscillator();
  radioOsc.type = 'sine';
  radioOsc.frequency.value = 55;
  const radioDepth = ctx.createGain();
  radioDepth.gain.value = 0.34;
  radioOsc.connect(radioDepth);
  radioDepth.connect(radioAm.gain);
  startOsc(radioOsc);
  started.push(radioOsc);
  const radioOut = ctx.createGain();
  radioHp.connect(radioShaper);
  radioShaper.connect(radioLp);
  radioLp.connect(radioAm);
  radioAm.connect(radioOut);

  const cristalShaper = ctx.createWaveShaper();
  cristalShaper.curve = curveCheby();
  cristalShaper.oversample = 'none';
  const cristalHs = ctx.createBiquadFilter();
  cristalHs.type = 'highshelf';
  cristalHs.frequency.value = 4800;
  cristalHs.gain.value = 10.5;
  const cristalDelay = ctx.createDelay(0.4);
  cristalDelay.delayTime.value = 0.08;
  const cristalFb = ctx.createGain();
  cristalFb.gain.value = 0.14;
  const cristalOut = ctx.createGain();
  cristalShaper.connect(cristalHs);
  cristalHs.connect(cristalDelay);
  cristalDelay.connect(cristalFb);
  cristalFb.connect(cristalDelay);
  cristalDelay.connect(cristalOut);

  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = makeCaveIR(ctx, 1.35);
  const caveLp = ctx.createBiquadFilter();
  caveLp.type = 'lowpass';
  caveLp.frequency.value = 4800;
  caveLp.Q.value = 0.5;
  const caveHs = ctx.createBiquadFilter();
  caveHs.type = 'highshelf';
  caveHs.frequency.value = 3500;
  caveHs.gain.value = 2.5;
  const caveOut = ctx.createGain();
  caveOut.gain.value = 0.78;
  conv.connect(caveLp);
  caveLp.connect(caveHs);
  caveHs.connect(caveOut);

  const whisperHp = ctx.createBiquadFilter();
  whisperHp.type = 'highpass';
  whisperHp.frequency.value = 620;
  const whisperHs = ctx.createBiquadFilter();
  whisperHs.type = 'highshelf';
  whisperHs.frequency.value = 7200;
  whisperHs.gain.value = 11;
  const whisperOut = ctx.createGain();
  whisperHp.connect(whisperHs);
  whisperHs.connect(whisperOut);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = makeNoiseBuffer(ctx);
  noiseSrc.loop = true;
  startOsc(noiseSrc);
  started.push(noiseSrc);
  const noiseBp = ctx.createBiquadFilter();
  noiseBp.type = 'bandpass';
  noiseBp.frequency.value = 4600;
  noiseBp.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noiseSrc.connect(noiseBp);
  noiseBp.connect(noiseGain);
  noiseGain.connect(whisperOut);

  const vibDelay = ctx.createDelay(0.05);
  vibDelay.delayTime.value = 0.0085;
  const vibLfo = ctx.createOscillator();
  vibLfo.type = 'sine';
  vibLfo.frequency.value = 6.4;
  const vibDepth = ctx.createGain();
  vibDepth.gain.value = 0.0075;
  vibLfo.connect(vibDepth);
  vibDepth.connect(vibDelay.delayTime);
  startOsc(vibLfo);
  started.push(vibLfo);
  const trem = ctx.createGain();
  trem.gain.value = 0.88;
  const tremDepth = ctx.createGain();
  tremDepth.gain.value = 0.16;
  vibLfo.connect(tremDepth);
  tremDepth.connect(trem.gain);
  const grandmaLp = ctx.createBiquadFilter();
  grandmaLp.type = 'lowpass';
  grandmaLp.frequency.value = 8200;
  const grandmaOut = ctx.createGain();
  vibDelay.connect(grandmaLp);
  grandmaLp.connect(trem);
  trem.connect(grandmaOut);

  const wetHeads = [pitchOut, colorOut, robotOut, delayOut, chorusOut, radioOut, cristalOut, caveOut, whisperOut, grandmaOut, talkbox.output];

  let last = graphFor('natural', false);
  last.live = true;
  let snapAmount = 0;
  let basePitch = 0;

  function resetTaps() {
    cut(bus);
    bus.connect(dryGain);
    wetHeads.forEach((n) => cut(n));
    try {
      pitchShift.disconnect();
    } catch {}
    pitchShift.connect(pitchLp);
    talkbox.setWet(0);
    delayFb.gain.value = 0;
    cristalFb.gain.value = 0;
    noiseGain.gain.value = 0;
    ring.gain.value = 0.42;
  }

  function tap(from, to) {
    if (from === bus && to === pitchShift) Tone.connect(bus, pitchShift);
    else from.connect(to);
  }

  function apply(id, autotuneOn) {
    const g = graphFor(id, autotuneOn);
    resetTaps();
    hp.frequency.value = Math.max(90, Math.min(180, g.hp > 250 ? 90 : g.hp || 90));
    lp.frequency.value = 16000;
    presence.gain.value = g.presence;
    shelf.gain.value = g.shelf;
    basePitch = g.pitch;
    snapAmount = g.snap;
    pitchShift.pitch = g.pitch;
    pitchHs.gain.value = g.pitch > 4 ? 6 : g.pitch < -4 ? 0.5 : 3.5;
    delay.delayTime.value = g.delayTime || 0.28;
    delayFb.gain.value = g.connected.includes('delay') ? g.delayFeedback : 0;
    delayOut.gain.value = g.connected.includes('delay') ? 0.82 : 0.5;
    caveOut.gain.value = g.connected.includes('convolver') ? 0.78 : 0.5;
    robotHp.frequency.value = g.bpLow || 360;
    robotLp.frequency.value = g.bpHigh || 3400;
    radioHp.frequency.value = g.bpLow || 520;
    radioLp.frequency.value = g.bpHigh || 2350;
    ringOsc.frequency.value = g.ringHz || 88;
    crush.curve = g.bits ? curveBits(g.bits) : crush.curve;
    caveLp.frequency.value = g.lp && g.connected.includes('convolver') ? g.lp : 6200;
    cristalDelay.delayTime.value = g.id === 'cristal' ? 0.08 : cristalDelay.delayTime.value;
    cristalFb.gain.value = g.id === 'cristal' ? g.delayFeedback : 0;
    cristalHs.gain.value = g.shelf || 10.5;
    vibLfo.frequency.value = g.vibratoRate || 6.4;
    vibDepth.gain.value = g.vibratoDepth || 0.0075;
    whisperHp.frequency.value = g.hp || 620;
    chorusTaps.forEach((t, i) => {
      t.gain.gain.value = 0.22 + g.chorusDepth * 0.32;
      t.depth.gain.value = (0.002 + g.chorusDepth * 0.0028) * (i + 1);
    });
    const now = ctx.currentTime;
    dryGain.gain.setTargetAtTime(g.dry, now, 0.018);
    wetGain.gain.setTargetAtTime(g.wet, now, 0.018);

    const names = g.connected;
    if (names.includes('pitchShift')) tap(bus, pitchShift);
    if (names.includes('color') && names.includes('pitchShift')) {
      pitchOut.connect(color);
      colorOut.connect(wetGain);
    } else if (names.includes('pitchShift') && names.includes('cristal')) {
      pitchOut.connect(cristalShaper);
      cristalOut.connect(wetGain);
    } else if (names.includes('pitchShift') && names.includes('vibrato')) {
      pitchOut.connect(vibDelay);
      grandmaOut.connect(wetGain);
    } else if (names.includes('pitchShift')) {
      pitchOut.connect(wetGain);
    }
    if (names.includes('crush') || names.includes('ring')) {
      bus.connect(crush);
      robotOut.connect(wetGain);
      ring.gain.value = 0.42;
    }
    if (names.includes('delay') && g.id === 'eco') {
      bus.connect(delay);
      delayOut.connect(wetGain);
    }
    if (names.includes('talkbox')) {
      bus.connect(talkbox.input);
      talkbox.output.connect(wetGain);
      talkbox.setWet(g.talkboxWet);
    }
    if (names.includes('chorus')) {
      bus.connect(chorusIn);
      chorusOut.connect(wetGain);
    }
    if (names.includes('radio')) {
      bus.connect(radioHp);
      radioOut.connect(wetGain);
    }
    if (names.includes('convolver')) {
      bus.connect(conv);
      caveOut.connect(wetGain);
    }
    if (names.includes('whisper')) {
      bus.connect(whisperHp);
      whisperOut.connect(wetGain);
      noiseGain.gain.value = g.noiseMix;
    }

    g.live = true;
    g.pitch = pitchShift.pitch;
    g.delayTime = names.includes('delay') || g.id === 'cristal' ? (g.id === 'cristal' ? cristalDelay.delayTime.value : delay.delayTime.value) : 0;
    g.delayFeedback = names.includes('delay') ? delayFb.gain.value : g.id === 'cristal' ? cristalFb.gain.value : 0;
    last = g;
    return snapshot();
  }

  function snapshot() {
    return {
      ...last,
      live: true,
      pitch: pitchShift.pitch,
      hp: last.hp,
      lp: last.lp,
      presence: last.presence,
      shelf: last.shelf,
      delayTime: last.connected.includes('delay') ? delay.delayTime.value : last.id === 'cristal' ? cristalDelay.delayTime.value : 0,
      delayFeedback: last.connected.includes('delay') ? delayFb.gain.value : last.id === 'cristal' ? cristalFb.gain.value : 0,
      talkboxWet: last.connected.includes('talkbox') ? last.talkboxWet : 0,
      monitorScale: last.monitorScale ?? 1,
      nsLibrary: NS_LIBRARY,
      hasGate: true,
      hasLimiter: true,
      rumbleHp: rumble.frequency.value,
      connected: [...last.connected]
    };
  }

  return {
    input,
    output: voiceGain,
    analyser,
    apply,
    snapshot,
    graphFor,
    setOutGain(v) {
      const scale = last.monitorScale ?? 1;
      voiceGain.gain.value = Math.max(0, Number(v) || 0) * scale;
    },
    setGate(open, floor = last.gateFloor) {
      const f = Number(floor);
      const closed = Number.isFinite(f) ? Math.max(0.02, Math.min(1, f)) : 0.05;
      gate.gain.setTargetAtTime(open ? 1 : closed, ctx.currentTime, open ? 0.012 : 0.07);
    },
    setTune(semis) {
      if (!snapAmount || !last.connected.includes('pitchShift')) {
        pitchShift.pitch = basePitch;
        return;
      }
      const corr = Math.max(-12, Math.min(12, semis * snapAmount));
      pitchShift.pitch = basePitch + corr;
    },
    setCarrierHz(hz) {
      talkbox.setCarrierHz(hz);
    },
    setNoiseEnvelope(rms) {
      if (!last.connected.includes('whisper')) return;
      noiseGain.gain.setTargetAtTime(Math.min(0.55, last.noiseMix * 0.6 + rms * 1.6), ctx.currentTime, 0.05);
    },
    backingDuck() {
      return last.backingDuck;
    },
    dispose() {
      started.forEach((n) => {
        try {
          n.stop();
        } catch {}
        cut(n);
      });
      talkbox.dispose();
      try {
        pitchShift.dispose();
      } catch {}
      try {
        nsGate.dispose();
      } catch {}
      try {
        limiter.dispose();
      } catch {}
      try {
        voiceGain.dispose();
      } catch {}
      [
        input,
        rumble,
        hp,
        lp,
        presence,
        shelf,
        gate,
        comp,
        bus,
        dryGain,
        wetGain,
        mix,
        analyser,
        pitchLp,
        pitchHs,
        pitchOut,
        color,
        colorOut,
        crush,
        ring,
        ringDepth,
        robotHp,
        robotLp,
        robotOut,
        delay,
        delayFilt,
        delayFb,
        delayOut,
        chorusIn,
        chorusOut,
        radioHp,
        radioShaper,
        radioLp,
        radioAm,
        radioDepth,
        radioOut,
        cristalShaper,
        cristalHs,
        cristalDelay,
        cristalFb,
        cristalOut,
        conv,
        caveLp,
        caveHs,
        caveOut,
        whisperHp,
        whisperHs,
        whisperOut,
        noiseBp,
        noiseGain,
        vibDelay,
        vibDepth,
        trem,
        tremDepth,
        grandmaLp,
        grandmaOut
      ].forEach(cut);
    }
  };
}
