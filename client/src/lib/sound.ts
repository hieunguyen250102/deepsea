/**
 * Tiny WebAudio blips — no asset downloads, no licences, and they can be
 * muted with one switch. Everything is synthesised on the fly.
 */

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('deepsea.muted') === '1';
} catch {
  /* ignore */
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem('deepsea.muted', value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, gain = 0.14, type: OscillatorType = 'triangle'): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  env.gain.setValueAtTime(0.0001, ac.currentTime + start);
  env.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(env).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.02);
}

/** A quick falling-pitch blip, like an air bubble popping. */
function bubble(start: number, from = 900, to = 1500, gain = 0.08): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  const t = ac.currentTime + start;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + 0.08);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(env).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.14);
}

export const sfx = {
  tap: () => tone(520, 0, 0.07, 0.06, 'square'),
  select: () => tone(760, 0, 0.09, 0.08),
  dice: () => {
    for (let i = 0; i < 5; i++) tone(260 + Math.random() * 180, i * 0.07, 0.05, 0.05, 'square');
  },
  hop: () => bubble(0, 500, 820, 0.06),
  breathe: (n = 1) => {
    for (let i = 0; i < Math.min(n, 5); i++) bubble(i * 0.09, 700 + i * 60, 1300 + i * 80);
  },
  pickup: () => {
    tone(660, 0, 0.1);
    tone(990, 0.07, 0.16);
  },
  drop: () => {
    tone(520, 0, 0.1);
    tone(349, 0.07, 0.16);
  },
  turnBack: () => {
    tone(392, 0, 0.1);
    tone(523, 0.07, 0.12);
  },
  home: () => {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.18, 0.11));
  },
  alarm: () => {
    [0, 0.28, 0.56].forEach((t) => {
      tone(740, t, 0.12, 0.09, 'triangle');
      tone(554, t + 0.13, 0.12, 0.09, 'triangle');
    });
  },
  turn: () => {
    tone(659, 0, 0.1);
    tone(880, 0.08, 0.14);
  },
  diveEnd: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 0.11));
  },
  reveal: () => tone(1175, 0, 0.1, 0.07, 'sine'),
  sink: () => {
    tone(330, 0, 0.18, 0.08);
    tone(247, 0.12, 0.26, 0.08);
  },
  win: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.3, 0.12));
  },
  chat: () => tone(990, 0, 0.07, 0.05, 'sine'),
  error: () => tone(160, 0, 0.16, 0.09, 'sawtooth'),
};
