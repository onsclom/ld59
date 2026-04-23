let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

if (import.meta.hot && import.meta.hot.data.audio) {
  ctx = import.meta.hot.data.audio.ctx;
  masterGain = import.meta.hot.data.audio.masterGain;
}

// Browsers require a user gesture before audio can play. Call `unlock()` from
// any pointerdown/keydown handler once on startup.
// Unlock audio on first user gesture.
const unlockController = new AbortController();
const unlockHandler = () => {
  const c = getCtx();
  if (c.state === "suspended") void c.resume();
  unlockController.abort();
};
window.addEventListener("pointerdown", unlockHandler, {
  signal: unlockController.signal,
});
window.addEventListener("keydown", unlockHandler, {
  signal: unlockController.signal,
});

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    unlockController.abort();
    data.audio = { ctx, masterGain };
  });
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

export type Thruster = { start: () => void; stop: () => void };

export function createThruster(opts?: {
  volume?: number;
  attack?: number;
  release?: number;
  cutoff?: number;
}): Thruster {
  const volume = opts?.volume ?? 0.35;
  const attack = opts?.attack ?? 0.08;
  const release = opts?.release ?? 0.2;
  const cutoff = opts?.cutoff ?? 900;

  const c = getCtx();

  const frames = Math.floor(c.sampleRate * 2);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const lowpass = c.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = cutoff;
  lowpass.Q.value = 0.7;

  const bandpass = c.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1600;
  bandpass.Q.value = 1.2;
  const air = c.createGain();
  air.gain.value = 0.2;

  const lfo = c.createOscillator();
  lfo.frequency.value = 6.5;
  const lfoGain = c.createGain();
  lfoGain.gain.value = cutoff * 0.1;
  lfo.connect(lfoGain).connect(lowpass.frequency);

  const env = c.createGain();
  env.gain.value = 0;

  src.connect(lowpass).connect(env);
  src.connect(bandpass).connect(air).connect(env);
  env.connect(getMaster());

  src.start();
  lfo.start();

  return {
    start() {
      const t = c.currentTime;
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(env.gain.value, t);
      env.gain.linearRampToValueAtTime(volume, t + attack);
    },
    stop() {
      const t = c.currentTime;
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(env.gain.value, t);
      env.gain.linearRampToValueAtTime(0, t + release);
    },
  };
}

let _thruster: Thruster | null = null;
function getThruster(): Thruster {
  if (!_thruster) _thruster = createThruster();
  return _thruster;
}
export const thruster = {
  start: () => getThruster().start(),
  stop: () => getThruster().stop(),
};

export function createTone(opts: {
  freq: number;
  wave?: Wave;
  volume?: number;
  attack?: number;
  release?: number;
  vibratoHz?: number;
  vibratoDepth?: number;
}): Thruster {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = opts.wave ?? "sine";
  osc.frequency.value = opts.freq;

  const env = c.createGain();
  env.gain.value = 0;
  osc.connect(env).connect(getMaster());
  osc.start();

  let lfo: OscillatorNode | null = null;
  if (opts.vibratoHz && opts.vibratoDepth) {
    lfo = c.createOscillator();
    lfo.frequency.value = opts.vibratoHz;
    const lfoGain = c.createGain();
    lfoGain.gain.value = opts.vibratoDepth;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start();
  }

  const attack = opts.attack ?? 0.05;
  const release = opts.release ?? 0.1;
  const volume = opts.volume ?? 0.1;

  return {
    start() {
      const t = c.currentTime;
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(env.gain.value, t);
      env.gain.linearRampToValueAtTime(volume, t + attack);
    },
    stop() {
      const t = c.currentTime;
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(env.gain.value, t);
      env.gain.linearRampToValueAtTime(0, t + release);
    },
  };
}

let _transmission: Thruster | null = null;
function getTransmission(): Thruster {
  if (!_transmission)
    _transmission = createTone({
      freq: 520,
      wave: "triangle",
      volume: 0.09,
      attack: 0.03,
      release: 0.08,
      vibratoHz: 7,
      vibratoDepth: 8,
    });
  return _transmission;
}
export const transmission = {
  start: () => getTransmission().start(),
  stop: () => getTransmission().stop(),
};

function makeLoop(
  ref: { t: Thruster | null },
  opts: Parameters<typeof createTone>[0],
): Thruster {
  return {
    start: () => {
      if (!ref.t) ref.t = createTone(opts);
      ref.t.start();
    },
    stop: () => {
      if (ref.t) ref.t.stop();
    },
  };
}

export const thrustInhibit = makeLoop(
  { t: null },
  {
    freq: 180,
    wave: "sawtooth",
    volume: 0.05,
    attack: 0.05,
    release: 0.15,
    vibratoHz: 5,
    vibratoDepth: 18,
  },
);

export const turnInhibit = makeLoop(
  { t: null },
  {
    freq: 260,
    wave: "square",
    volume: 0.04,
    attack: 0.05,
    release: 0.15,
    vibratoHz: 11,
    vibratoDepth: 24,
  },
);

export const controlReverse = makeLoop(
  { t: null },
  {
    freq: 340,
    wave: "triangle",
    volume: 0.05,
    attack: 0.05,
    release: 0.15,
    vibratoHz: 3,
    vibratoDepth: 80,
  },
);

export const sfx = {
  jump: () => playBlip(300, 900, 0.12, "square", 0.15),
  pickup: () => playBlip(600, 1200, 0.08, "triangle", 0.2),
  hit: () => playNoise(0.15, 1200, 0.35),
  explode: () => {
    playNoise(0.7, 500, 0.5);
    playBlip(180, 40, 0.6, "sawtooth", 0.25);
  },
  select: () => playTone(660, 0.06, "sine", 0.18),
  deny: () => playBlip(400, 120, 0.2, "sawtooth", 0.15),
  nodeComplete: () => {
    playBlip(523, 1046, 0.18, "triangle", 0.25);
    setTimeout(() => playTone(1568, 0.15, "sine", 0.2), 90);
  },
  levelWon: () => {
    playTone(523, 0.12, "triangle", 0.25);
    setTimeout(() => playTone(659, 0.12, "triangle", 0.25), 120);
    setTimeout(() => playTone(784, 0.14, "triangle", 0.3), 240);
    setTimeout(() => playTone(1046, 0.45, "triangle", 0.3), 360);
  },
  cannonFire: () => {
    playNoise(0.22, 900, 0.4);
    playBlip(210, 55, 0.32, "sawtooth", 0.28);
  },
  missileFire: () => {
    playNoise(0.55, 3800, 0.22);
    playBlip(380, 120, 0.45, "triangle", 0.18);
  },
  projectileWarn: () => {
    playTone(720, 0.06, "square", 0.07);
  },
  fireballHit: () => {
    playNoise(0.18, 1600, 0.3);
    playBlip(260, 80, 0.2, "sawtooth", 0.15);
  },
  missileHit: () => {
    playNoise(0.35, 900, 0.4);
    playBlip(160, 45, 0.35, "sawtooth", 0.22);
  },
  retry: () => {
    playBlip(520, 220, 0.14, "square", 0.18);
  },
  advance: () => {
    playBlip(520, 1040, 0.12, "triangle", 0.22);
    setTimeout(() => playTone(1320, 0.1, "sine", 0.18), 70);
  },
  typeChar: () => {
    const cutoff = 2400 + Math.random() * 1600;
    const noiseDur = 0.018 + Math.random() * 0.012;
    playNoise(noiseDur, cutoff, 0.07 + Math.random() * 0.04);
    const freq = 720 + Math.random() * 360;
    // playTone(freq, 0.012 + Math.random() * 0.01, "sine", 0.04);
  },
};
