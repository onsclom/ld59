import { clamp, expDecay } from "./game-math";

export type LevelIntro = {
  active: boolean;
  t: number;
  duration: number;
  perElementDuration: number;
  maxDelay: number;
  wallDelays: number[];
  satDelays: number[];
};

const PER_ELEMENT_MS = 360;
const RADIAL_DELAY_PER_UNIT = 8;
const MAX_RADIAL_MS = 280;
const JITTER_MS = 90;
const SAT_OFFSET_MS = 60;
const TAIL_MS = 160;
const DECAY_K = 3.5;

type LevelLike = {
  walls: { x1: number; y1: number; x2: number; y2: number }[];
  satellites: { x: number; y: number }[];
};

export function create(): LevelIntro {
  return {
    active: false,
    t: 0,
    duration: 0,
    perElementDuration: PER_ELEMENT_MS,
    maxDelay: 0,
    wallDelays: [],
    satDelays: [],
  };
}

export function start(
  intro: LevelIntro,
  level: LevelLike,
  anchorX: number,
  anchorY: number,
): void {
  intro.active = true;
  intro.t = 0;
  intro.perElementDuration = PER_ELEMENT_MS;

  let maxDelay = 0;

  intro.wallDelays = level.walls.map((w) => {
    const mx = (w.x1 + w.x2) / 2;
    const my = (w.y1 + w.y2) / 2;
    const d = Math.hypot(mx - anchorX, my - anchorY);
    const delay =
      Math.min(MAX_RADIAL_MS, d * RADIAL_DELAY_PER_UNIT) +
      Math.random() * JITTER_MS;
    if (delay > maxDelay) maxDelay = delay;
    return delay;
  });

  intro.satDelays = level.satellites.map((s) => {
    const d = Math.hypot(s.x - anchorX, s.y - anchorY);
    const delay =
      Math.min(MAX_RADIAL_MS, d * RADIAL_DELAY_PER_UNIT) +
      Math.random() * JITTER_MS +
      SAT_OFFSET_MS;
    if (delay > maxDelay) maxDelay = delay;
    return delay;
  });

  intro.maxDelay = maxDelay;
  intro.duration = maxDelay + PER_ELEMENT_MS + TAIL_MS;
}

export function update(intro: LevelIntro, dt: number): void {
  if (!intro.active) return;
  intro.t += dt;
  if (intro.t >= intro.duration) {
    intro.active = false;
    intro.t = 0;
  }
}

export function isActive(intro: LevelIntro): boolean {
  return intro.active;
}

function elementProgress(delay: number, t: number, dur: number): number {
  const local = t - delay;
  if (local <= 0) return 0;
  return clamp(expDecay(0, 1, (local / dur) * DECAY_K), 0, 1);
}

export function wallProgress(intro: LevelIntro, idx: number): number {
  if (!intro.active) return 1;
  const d = intro.wallDelays[idx] ?? 0;
  return elementProgress(d, intro.t, intro.perElementDuration);
}

export function satelliteProgress(intro: LevelIntro, idx: number): number {
  if (!intro.active) return 1;
  const d = intro.satDelays[idx] ?? 0;
  return elementProgress(d, intro.t, intro.perElementDuration);
}

export function playerProgress(intro: LevelIntro): number {
  if (!intro.active) return 1;
  return elementProgress(
    intro.maxDelay * 0.9,
    intro.t,
    intro.perElementDuration,
  );
}
