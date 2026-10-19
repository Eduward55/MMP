// Grafo seco/molhado do Cantar: mic → gate/EQ/compressor → SÓ o efeito ativo → saída.
// Nós inativos ficam desconectados da saída (BitCrusher+PitchShift em série chiavam).
import { createTalkbox } from './vocoder.js';

export const FX = [
  { id: 'natural', name: 'Natural', hint: 'Voz limpa, sem efeito extra.' },
  { id: 'acapela', name: 'Acapela', hint: 'Vocal seco, presença no médio, base bem baixa.' },
  { id: 'autotune', name: 'Autotune', hint: 'Cola a nota na escala — cor de auto-tune forte.' },
  { id: 'agudo', name: 'Agudo', hint: 'Tom e formante bem mais agudos.' },
  { id: 'grave', name: 'Grave', hint: 'Tom bem mais grave, peito na voz.' },
  { id: 'robo', name: 'Robô', hint: 'Bitcrush e ring mod metálico.' },
  { id: 'eco', name: 'Eco', hint: 'Delay com ecos bem audíveis.' },
  { id: 'talkbox', name: 'Talkbox', hint: 'Vocoder / talkbox (voz no synth).' },
  { id: 'coro', name: 'Coro', hint: 'Várias vozes levemente desafinadas.' },
  { id: 'radio', name: 'Rádio', hint: 'Faixa estreita de rádio AM, com crunch.' },
  { id: 'cristal', name: 'Cristal', hint: 'Oitava acima e harmônicos brilhantes.' },
  { id: 'caverna', name: 'Caverna', hint: 'Reverb enorme e escuro.' },
  { id: 'sussurro', name: 'Sussurro', hint: 'Sopro, agudos e um pouco de ruído.' },
  { id: 'velhinha', name: 'Velhinha', hint: 'Voz fina, um pouco mais aguda, com vibrato.' }
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
    hp: 90,
    lp: 7800,
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
    connected: [],
    ...over
  };
}

const BASE = {
  natural: blank(),
  acapela: blank({ presence: 5.5, hp: 170, shelf: 1.6, backingDuck: 0.1 }),
  autotune: blank({ wet: 0.94, dry: 0.12, snap: 1, color: 0.42, connected: ['pitchShift', 'color'] }),
  agudo: blank({ pitch: 7, wet: 0.92, dry: 0.12, presence: 3.5, hp: 140, connected: ['pitchShift'] }),
  grave: blank({ pitch: -7, wet: 0.92, dry: 0.12, presence: -1.2, hp: 70, lp: 5200, connected: ['pitchShift'] }),
  robo: blank({ wet: 0.9, dry: 0.08, bits: 4, ringHz: 62, bpLow: 400, bpHigh: 3200, connected: ['crush', 'ring'] }),
  eco: blank({ wet: 0.82, dry: 0.7, delayTime: 0.36, delayFeedback: 0.52, connected: ['delay'] }),
  talkbox: blank({ wet: 1, dry: 0.1, talkboxWet: 1.35, backingDuck: 0.55, connected: ['talkbox'] }),
  coro: blank({ wet: 0.78, dry: 0.45, chorusDepth: 0.62, connected: ['chorus'] }),
  radio: blank({ wet: 0.95, dry: 0.06, bpLow: 480, bpHigh: 2300, color: 0.7, connected: ['radio'] }),
  cristal: blank({
    pitch: 12,
    wet: 0.72,
    dry: 0.42,
    shelf: 8.5,
    delayTime: 0.09,
    delayFeedback: 0.12,
    connected: ['pitchShift', 'cristal']
  }),
  caverna: blank({ wet: 0.9, dry: 0.22, reverbWet: 0.9, room: 0.94, lp: 1600, hp: 80, connected: ['convolver'] }),
  sussurro: blank({
    wet: 0.7,
    dry: 0.18,
    hp: 560,
    lp: 6400,
    shelf: 9,
    noiseMix: 0.26,
    backingDuck: 0.75,
    gateFloor: 0.16,
    connected: ['whisper']
  }),
  velhinha: blank({
    pitch: 4,
    wet: 0.88,
    dry: 0.14,
    hp: 380,
    lp: 3900,
    vibratoRate: 5.6,
    vibratoDepth: 0.0042,
    connected: ['pitchShift', 'vibrato']
  })
};

export function graphFor(id, autotuneOn = false) {
  const fx = normalizeFxId(id);
  const g = { id: fx, autotune: false, live: false, ...BASE[fx] };
  g.connected = [...g.connected];
  const overlay = Boolean(autotuneOn) && OVERLAY_IDS.has(fx);
  if (fx === 'autotune' || overlay) {
    g.autotune = true;
    g.snap = fx === 'autotune' ? 1 : 0.88;
    if (!g.connected.includes('pitchShift')) g.connected.push('pitchShift');
    if (fx === 'autotune' && !g.connected.includes('color')) g.connected.push('color');
    if (overlay && g.wet < 0.45) {
      g.wet = 0.7;
      g.dry = Math.min(g.dry, 0.42);
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

function makeCaveIR(ctx, seconds = 2.6) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 1.32) * (1 - i / len);
      const n = Math.random() * 2 - 1;
      lp = lp * 0.97 + n * 0.03;
      d[i] = (n * 0.32 + lp * 0.68) * env * (ch ? 0.96 : 1);
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
  input.gain.value = 1.04;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  hp.Q.value = 0.55;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7800;
  lp.Q.value = 0.5;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2800;
  presence.Q.value = 1.1;
  presence.gain.value = 0;
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = 6200;
  shelf.gain.value = 0;
  const gate = ctx.createGain();
  gate.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 2.6;
  comp.knee.value = 10;
  comp.attack.value = 0.008;
  comp.release.value = 0.16;
  const bus = ctx.createGain();
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0;
  const mix = ctx.createGain();
  const voiceGain = new Tone.Gain(0.86).toDestination();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.42;

  input.connect(hp);
  hp.connect(lp);
  lp.connect(presence);
  presence.connect(shelf);
  shelf.connect(gate);
  gate.connect(comp);
  comp.connect(bus);
  bus.connect(dryGain);
  bus.connect(analyser);
  dryGain.connect(mix);
  wetGain.connect(mix);
  Tone.connect(mix, voiceGain);

  const pitchShift = new Tone.PitchShift({ pitch: 0, windowSize: 0.08, delayTime: 0.025, feedback: 0 });
  if (pitchShift.wet) pitchShift.wet.value = 1;
  const pitchLp = ctx.createBiquadFilter();
  pitchLp.type = 'lowpass';
  pitchLp.frequency.value = 7200;
  pitchLp.Q.value = 0.5;
  const pitchOut = ctx.createGain();
  pitchShift.connect(pitchLp);
  pitchLp.connect(pitchOut);

  const color = ctx.createWaveShaper();
  color.curve = curveTanh(2.4);
  color.oversample = 'none';
  const colorOut = ctx.createGain();
  color.connect(colorOut);

  const crush = ctx.createWaveShaper();
  crush.curve = curveBits(4);
  crush.oversample = 'none';
  const ring = ctx.createGain();
  ring.gain.value = 0;
  const ringOsc = ctx.createOscillator();
  ringOsc.type = 'square';
  ringOsc.frequency.value = 62;
  const ringDepth = ctx.createGain();
  ringDepth.gain.value = 0.82;
  ringOsc.connect(ringDepth);
  ringDepth.connect(ring.gain);
  startOsc(ringOsc);
  started.push(ringOsc);
  const robotHp = ctx.createBiquadFilter();
  robotHp.type = 'highpass';
  robotHp.frequency.value = 400;
  const robotLp = ctx.createBiquadFilter();
  robotLp.type = 'lowpass';
  robotLp.frequency.value = 3200;
  const robotOut = ctx.createGain();
  crush.connect(ring);
  ring.connect(robotHp);
  robotHp.connect(robotLp);
  robotLp.connect(robotOut);

  const delay = ctx.createDelay(1.2);
  delay.delayTime.value = 0.36;
  const delayFilt = ctx.createBiquadFilter();
  delayFilt.type = 'lowpass';
  delayFilt.frequency.value = 3800;
  const delayFb = ctx.createGain();
  delayFb.gain.value = 0;
  const delayOut = ctx.createGain();
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
  chorusLfo.frequency.value = 0.85;
  startOsc(chorusLfo);
  started.push(chorusLfo);
  const chorusTaps = [0.012, 0.019, 0.028].map((time, i) => {
    const d = ctx.createDelay(0.06);
    d.delayTime.value = time;
    const g = ctx.createGain();
    g.gain.value = 0.34;
    const depth = ctx.createGain();
    depth.gain.value = 0.0028 * (i + 1);
    chorusLfo.connect(depth);
    depth.connect(d.delayTime);
    chorusIn.connect(d);
    d.connect(g);
    g.connect(chorusOut);
    return { delay: d, gain: g, depth };
  });

  const radioHp = ctx.createBiquadFilter();
  radioHp.type = 'highpass';
  radioHp.frequency.value = 480;
  radioHp.Q.value = 0.7;
  const radioShaper = ctx.createWaveShaper();
  radioShaper.curve = curveTanh(3.2);
  radioShaper.oversample = 'none';
  const radioLp = ctx.createBiquadFilter();
  radioLp.type = 'lowpass';
  radioLp.frequency.value = 2300;
  radioLp.Q.value = 0.85;
  const radioAm = ctx.createGain();
  radioAm.gain.value = 0.72;
  const radioOsc = ctx.createOscillator();
  radioOsc.type = 'sine';
  radioOsc.frequency.value = 48;
  const radioDepth = ctx.createGain();
  radioDepth.gain.value = 0.28;
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
  cristalHs.frequency.value = 5200;
  cristalHs.gain.value = 8.5;
  const cristalDelay = ctx.createDelay(0.4);
  cristalDelay.delayTime.value = 0.09;
  const cristalFb = ctx.createGain();
  cristalFb.gain.value = 0.12;
  const cristalOut = ctx.createGain();
  cristalShaper.connect(cristalHs);
  cristalHs.connect(cristalDelay);
  cristalDelay.connect(cristalFb);
  cristalFb.connect(cristalDelay);
  cristalDelay.connect(cristalOut);

  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = makeCaveIR(ctx, 2.6);
  const caveLp = ctx.createBiquadFilter();
  caveLp.type = 'lowpass';
  caveLp.frequency.value = 1600;
  caveLp.Q.value = 0.6;
  const caveOut = ctx.createGain();
  conv.connect(caveLp);
  caveLp.connect(caveOut);

  const whisperHp = ctx.createBiquadFilter();
  whisperHp.type = 'highpass';
  whisperHp.frequency.value = 560;
  const whisperHs = ctx.createBiquadFilter();
  whisperHs.type = 'highshelf';
  whisperHs.frequency.value = 6800;
  whisperHs.gain.value = 9;
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
  noiseBp.frequency.value = 4200;
  noiseBp.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noiseSrc.connect(noiseBp);
  noiseBp.connect(noiseGain);
  noiseGain.connect(whisperOut);

  const vibDelay = ctx.createDelay(0.04);
  vibDelay.delayTime.value = 0.0075;
  const vibLfo = ctx.createOscillator();
  vibLfo.type = 'sine';
  vibLfo.frequency.value = 5.6;
  const vibDepth = ctx.createGain();
  vibDepth.gain.value = 0.0042;
  vibLfo.connect(vibDepth);
  vibDepth.connect(vibDelay.delayTime);
  startOsc(vibLfo);
  started.push(vibLfo);
  const trem = ctx.createGain();
  trem.gain.value = 0.86;
  const tremDepth = ctx.createGain();
  tremDepth.gain.value = 0.14;
  vibLfo.connect(tremDepth);
  tremDepth.connect(trem.gain);
  const grandmaLp = ctx.createBiquadFilter();
  grandmaLp.type = 'lowpass';
  grandmaLp.frequency.value = 3900;
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
    bus.connect(analyser);
    wetHeads.forEach((n) => cut(n));
    try {
      pitchShift.disconnect();
    } catch {}
    pitchShift.connect(pitchLp);
    talkbox.setWet(0);
    delayFb.gain.value = 0;
    cristalFb.gain.value = 0;
    noiseGain.gain.value = 0;
    ring.gain.value = 0;
  }

  function tap(from, to) {
    if (from === bus && to === pitchShift) Tone.connect(bus, pitchShift);
    else from.connect(to);
  }

  function apply(id, autotuneOn) {
    const g = graphFor(id, autotuneOn);
    resetTaps();
    hp.frequency.value = g.hp;
    lp.frequency.value = g.lp;
    presence.gain.value = g.presence;
    shelf.gain.value = g.shelf;
    basePitch = g.pitch;
    snapAmount = g.snap;
    pitchShift.pitch = g.pitch;
    delay.delayTime.value = g.delayTime || 0.36;
    delayFb.gain.value = g.connected.includes('delay') ? g.delayFeedback : 0;
    robotHp.frequency.value = g.bpLow || 400;
    robotLp.frequency.value = g.bpHigh || 3200;
    radioHp.frequency.value = g.bpLow || 480;
    radioLp.frequency.value = g.bpHigh || 2300;
    ringOsc.frequency.value = g.ringHz || 62;
    crush.curve = g.bits ? curveBits(g.bits) : crush.curve;
    caveLp.frequency.value = g.lp && g.connected.includes('convolver') ? g.lp : 1600;
    cristalDelay.delayTime.value = g.id === 'cristal' ? 0.09 : cristalDelay.delayTime.value;
    cristalFb.gain.value = g.id === 'cristal' ? g.delayFeedback : 0;
    cristalHs.gain.value = g.shelf || 8.5;
    vibLfo.frequency.value = g.vibratoRate || 5.6;
    vibDepth.gain.value = g.vibratoDepth || 0.0042;
    whisperHp.frequency.value = g.hp || 560;
    chorusTaps.forEach((t, i) => {
      t.gain.gain.value = 0.2 + g.chorusDepth * 0.28;
      t.depth.gain.value = (0.0018 + g.chorusDepth * 0.0022) * (i + 1);
    });
    const now = ctx.currentTime;
    dryGain.gain.setTargetAtTime(g.dry, now, 0.02);
    wetGain.gain.setTargetAtTime(g.wet, now, 0.02);

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
      ring.gain.value = 0;
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
    g.wet = g.wet;
    g.dry = g.dry;
    last = g;
    return snapshot();
  }

  function snapshot() {
    return {
      ...last,
      live: true,
      pitch: pitchShift.pitch,
      hp: hp.frequency.value,
      lp: lp.frequency.value,
      presence: presence.gain.value,
      shelf: shelf.gain.value,
      delayTime: last.connected.includes('delay') ? delay.delayTime.value : last.id === 'cristal' ? cristalDelay.delayTime.value : 0,
      delayFeedback: last.connected.includes('delay') ? delayFb.gain.value : last.id === 'cristal' ? cristalFb.gain.value : 0,
      talkboxWet: last.connected.includes('talkbox') ? last.talkboxWet : 0,
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
      voiceGain.gain.value = v;
    },
    setGate(open, floor = last.gateFloor) {
      gate.gain.setTargetAtTime(open ? 1 : Math.max(0.02, floor), ctx.currentTime, open ? 0.02 : 0.12);
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
      noiseGain.gain.setTargetAtTime(Math.min(0.4, last.noiseMix * 0.55 + rms * 1.8), ctx.currentTime, 0.05);
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
        voiceGain.dispose();
      } catch {}
      [
        input,
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
