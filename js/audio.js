import { Storage } from './storage.js';

let ctx = null;
let masterGain = null;
let musicGain = null;
let muted = Storage.get().muted;

function ensure() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.6;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(masterGain);
  } catch { ctx = null; }
}

function envTone({ freq = 440, freq2 = null, dur = 0.2, type = 'sine', vol = 0.3, attack = 0.005, release = 0.1 }) {
  ensure();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (freq2 !== null) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), ctx.currentTime + dur);
  }
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur + release);
  o.connect(g); g.connect(masterGain);
  o.start();
  o.stop(ctx.currentTime + dur + release + 0.05);
}

function noiseBurst({ dur = 0.15, vol = 0.2, lowpass = 1200 }) {
  ensure();
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filt); filt.connect(g); g.connect(masterGain);
  src.start();
}

// Simple procedural music loop using scheduled notes
let musicTimer = null;
const SCALES = {
  major: [0, 2, 4, 7, 9, 12, 14, 16],
  minor: [0, 2, 3, 5, 7, 10, 12, 15],
};
function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function startMusic(theme = 'major', tempo = 110) {
  ensure();
  if (!ctx) return;
  stopMusic();
  const scale = SCALES[theme] || SCALES.major;
  const root = 55; // A1
  const step = 60 / tempo / 2; // 8th notes
  let i = 0;
  const playNote = () => {
    if (!ctx) return;
    const degree = scale[Math.floor(Math.random() * scale.length)];
    const oct = [0, 12, 24][Math.floor(Math.random() * 3)];
    const freq = midiToFreq(root + degree + oct);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + step * 0.9);
    o.connect(g); g.connect(musicGain);
    o.start();
    o.stop(ctx.currentTime + step);
    // Bass on downbeats
    if (i % 4 === 0) {
      const b = ctx.createOscillator();
      const bg = ctx.createGain();
      b.type = 'sawtooth';
      b.frequency.value = midiToFreq(root - 12 + scale[0]);
      bg.gain.setValueAtTime(0, ctx.currentTime);
      bg.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + step * 2);
      b.connect(bg); bg.connect(musicGain);
      b.start();
      b.stop(ctx.currentTime + step * 2);
    }
    i++;
  };
  musicTimer = setInterval(playNote, step * 1000);
}

function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

export const Audio = {
  resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  },

  toggleMute() {
    muted = !muted;
    Storage.setMuted(muted);
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.6;
    return muted;
  },

  isMuted() { return muted; },

  coin() { envTone({ freq: 880, freq2: 1760, dur: 0.1, type: 'square', vol: 0.18 }); },
  powerup() {
    envTone({ freq: 440, freq2: 880, dur: 0.15, type: 'sawtooth', vol: 0.22 });
    setTimeout(() => envTone({ freq: 660, freq2: 1320, dur: 0.15, type: 'sawtooth', vol: 0.2 }), 80);
  },
  jump() { envTone({ freq: 320, freq2: 540, dur: 0.1, type: 'triangle', vol: 0.18 }); },
  dash() { noiseBurst({ dur: 0.15, vol: 0.15, lowpass: 2500 }); },
  hurt() {
    envTone({ freq: 200, freq2: 80, dur: 0.25, type: 'square', vol: 0.25 });
    noiseBurst({ dur: 0.18, vol: 0.12, lowpass: 800 });
  },
  die() {
    envTone({ freq: 440, freq2: 60, dur: 0.6, type: 'sawtooth', vol: 0.28 });
  },
  portal() {
    envTone({ freq: 300, freq2: 800, dur: 0.3, type: 'sine', vol: 0.25 });
    setTimeout(() => envTone({ freq: 600, freq2: 1200, dur: 0.3, type: 'sine', vol: 0.25 }), 100);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => envTone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.22 }), i * 120));
  },
  click() { envTone({ freq: 800, dur: 0.04, type: 'square', vol: 0.12 }); },

  startMusic(mood = 'major', tempo = 110) { startMusic(mood, tempo); },
  stopMusic,
};
