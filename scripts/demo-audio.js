'use strict';

// Gera um WAV curtinho (melodia em Dó maior) para popular a Galeria no primeiro uso.
function makeDemoWav() {
  const rate = 22050;
  const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 261.63];
  const noteLen = 0.5;
  const total = Math.floor(rate * noteLen * notes.length);
  const pcm = new Int16Array(total);
  for (let n = 0; n < notes.length; n++) {
    const start = Math.floor(n * noteLen * rate);
    const len = Math.floor(noteLen * rate);
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      const env = Math.min(1, t * 40) * Math.exp(-t * 5);
      const wave = Math.sin(2 * Math.PI * notes[n] * t) * 0.6 + Math.sin(4 * Math.PI * notes[n] * t) * 0.15;
      pcm[start + i] = Math.max(-1, Math.min(1, wave * env)) * 0x6fff;
    }
  }
  const dataBytes = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  Buffer.from(pcm.buffer).copy(buf, 44);
  return buf;
}

module.exports = { makeDemoWav };
