let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

// Browsers require a user gesture before audio can play. Call `unlock()` from
// any pointerdown/keydown handler once on startup.
// Unlock audio on first user gesture.
const unlockHandler = () => {
  const c = getCtx();
  if (c.state === "suspended") void c.resume();
  window.removeEventListener("pointerdown", unlockHandler);
  window.removeEventListener("keydown", unlockHandler);
};
window.addEventListener("pointerdown", unlockHandler);
window.addEventListener("keydown", unlockHandler);

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

export function setMasterVolume(v: number) {
  getMaster().gain.value = v;
}

type Wave = OscillatorType;

// Simple tone with attack/decay envelope. Good for UI blips.
export function playTone(
  freq: number,
  duration: number,
  wave: Wave = "sine",
  volume: number = 0.2,
) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = wave;
  osc.frequency.value = freq;

  const t0 = c.currentTime;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain).connect(getMaster());
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Pitch sweep — great for jumps, pickups, power-ups.
// Sweep up (e.g. 220 -> 880) for pickup; sweep down for "denied".
export function playBlip(
  startFreq: number,
  endFreq: number,
  duration: number,
  wave: Wave = "square",
  volume: number = 0.15,
) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = wave;

  const t0 = c.currentTime;
  osc.frequency.setValueAtTime(startFreq, t0);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(endFreq, 1),
    t0 + duration,
  );

  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain).connect(getMaster());
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// White-noise burst through a lowpass — thuds, hits, explosions.
// Higher cutoff = brighter (crack); lower = duller (thud).
export function playNoise(
  duration: number,
  cutoff: number = 2000,
  volume: number = 0.3,
) {
  const c = getCtx();
  const frames = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;

  const gain = c.createGain();
  const t0 = c.currentTime;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(filter).connect(gain).connect(getMaster());
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// Convenience presets you'll actually reach for during a jam.
export const sfx = {
  jump: () => playBlip(300, 900, 0.12, "square", 0.15),
  pickup: () => playBlip(600, 1200, 0.08, "triangle", 0.2),
  hit: () => playNoise(0.15, 1200, 0.35),
  explode: () => playNoise(0.5, 600, 0.4),
  select: () => playTone(660, 0.06, "sine", 0.18),
  deny: () => playBlip(400, 120, 0.2, "sawtooth", 0.15),
};
