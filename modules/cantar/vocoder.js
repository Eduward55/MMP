// Talkbox / vocoder no Web Audio: voz modula um carrier dente-de-serra (estilo FNAF).
const BANDS = 18;
const MIN_HZ = 110;
const MAX_HZ = 4200;

function absCurve() {
  const n = 65536;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1;
    c[i] = Math.abs(x);
  }
  return c;
}

function bandFreq(i, n) {
  return MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, i / (n - 1));
}

/**
 * @param {AudioContext} ctx
 * @returns {{ input: GainNode, output: GainNode, setCarrierHz: (hz: number) => void, setWet: (v: number) => void, dispose: () => void }}
 */
export function createTalkbox(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  output.gain.value = 0;
  const wet = ctx.createGain();
  wet.gain.value = 2.4;
  wet.connect(output);

  const carrier = ctx.createOscillator();
  carrier.type = 'sawtooth';
  carrier.frequency.value = 220;
  const pulse = ctx.createOscillator();
  pulse.type = 'square';
  pulse.frequency.value = 220;
  const carrierMix = ctx.createGain();
  carrierMix.gain.value = 0.45;
  carrier.connect(carrierMix);
  pulse.connect(carrierMix);
  carrier.start();
  pulse.start();

  const abs = absCurve();
  const nodes = [];

  for (let i = 0; i < BANDS; i++) {
    const freq = bandFreq(i, BANDS);
    const q = 5 + (i / BANDS) * 4;

    const modBp = ctx.createBiquadFilter();
    modBp.type = 'bandpass';
    modBp.frequency.value = freq;
    modBp.Q.value = q;
    input.connect(modBp);

    const shaper = ctx.createWaveShaper();
    shaper.curve = abs;
    shaper.oversample = 'none';
    const env = ctx.createBiquadFilter();
    env.type = 'lowpass';
    env.frequency.value = 28;
    env.Q.value = 0.5;
    modBp.connect(shaper);
    shaper.connect(env);

    const carBp = ctx.createBiquadFilter();
    carBp.type = 'bandpass';
    carBp.frequency.value = freq;
    carBp.Q.value = q;
    carrierMix.connect(carBp);

    const vca = ctx.createGain();
    vca.gain.value = 0;
    carBp.connect(vca);
    env.connect(vca.gain);
    vca.connect(wet);
    nodes.push(modBp, shaper, env, carBp, vca);
  }

  return {
    input,
    output,
    setCarrierHz(hz) {
      const f = Math.max(80, Math.min(880, hz || 220));
      carrier.frequency.setTargetAtTime(f, ctx.currentTime, 0.03);
      pulse.frequency.setTargetAtTime(f, ctx.currentTime, 0.03);
    },
    setWet(v) {
      output.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.02);
    },
    dispose() {
      try {
        carrier.stop();
        pulse.stop();
      } catch {}
      [input, output, wet, carrier, pulse, carrierMix, ...nodes].forEach((n) => {
        try {
          n.disconnect();
        } catch {}
      });
    }
  };
}
