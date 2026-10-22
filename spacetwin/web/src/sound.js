// Small synthesised sound effects (WebAudio, no files to download). Quiet by
// design: they confirm actions, they don't decorate. iOS only starts audio
// from a tap, so call unlock() inside a tap handler before the first sound.

let ctx = null;
let muted = readMuted();
const listeners = new Set();

function readMuted() {
  try {
    return localStorage.getItem('spacetwin-muted') === '1';
  } catch {
    return false;
  }
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlock() {
  const a = audio();
  if (a?.state === 'suspended') a.resume().catch(() => {});
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem('spacetwin-muted', value ? '1' : '0');
  } catch {
    // private mode: keep the setting for this page only
  }
  listeners.forEach((fn) => fn(muted));
}

export function onMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function tone({ freq, to = freq, dur = 0.12, type = 'sine', gain = 0.08, delay = 0 }) {
  const a = audio();
  if (!a || muted) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, from = 800, to = 3000, gain = 0.05, q = 1.2, delay = 0 }) {
  const a = audio();
  if (!a || muted) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  /** UI tap */
  tap: () => tone({ freq: 1400, to: 1100, dur: 0.05, type: 'triangle', gain: 0.04 }),
  /** camera shutter: a short bright click */
  shutter: () => {
    noise({ dur: 0.06, from: 4000, to: 2500, gain: 0.09, q: 0.8 });
    tone({ freq: 2200, to: 1800, dur: 0.04, type: 'square', gain: 0.015, delay: 0.035 });
  },
  /** moving between spots */
  whoosh: () => noise({ dur: 0.55, from: 300, to: 1600, gain: 0.035, q: 0.7 }),
  /** switching view mode */
  swoop: () => noise({ dur: 0.7, from: 1800, to: 400, gain: 0.03, q: 0.6 }),
  /** ring of shots finished, measurement placed */
  ding: () => {
    tone({ freq: 880, dur: 0.18, gain: 0.05 });
    tone({ freq: 1320, dur: 0.25, gain: 0.04, delay: 0.08 });
  },
  /** capture complete, spot saved */
  success: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, dur: 0.3, gain: 0.045, delay: i * 0.09 })),
  /** something needs attention */
  warn: () => tone({ freq: 330, to: 260, dur: 0.18, type: 'triangle', gain: 0.05 }),
};
