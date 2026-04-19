import { clamp, mod } from "./game-math";
import * as Level from "./level";
import * as Particles from "./particles";
import * as Player from "./player";

export type TransitionAction =
  | { kind: "restart" }
  | { kind: "switchLevel"; dir: number }
  | { kind: "startGame" };

export type Transition = {
  phase: "idle" | "out" | "in";
  t: number;
  outDuration: number;
  inDuration: number;
  action: TransitionAction | null;
  color: [number, number, number];
};

type WorldState = {
  player: ReturnType<typeof Player.create>;
  level: ReturnType<typeof Level.create>;
  levels: ReturnType<typeof Level.create>[];
  currentLevelIndex: number;
  particles: ReturnType<typeof Particles.create>;
  phase: "title" | "playing" | "end";
};

const DEFAULT_OUT_MS = 200;
const DEFAULT_IN_MS = 320;

export function create(): Transition {
  return {
    phase: "idle",
    t: 0,
    outDuration: DEFAULT_OUT_MS,
    inDuration: DEFAULT_IN_MS,
    action: null,
    color: [0, 0, 0],
  };
}

export function isLocked(transition: Transition): boolean {
  return transition.phase !== "idle";
}

export type BeginOptions = {
  outDuration?: number;
  inDuration?: number;
  color?: [number, number, number];
};

export function begin(
  transition: Transition,
  action: TransitionAction,
  opts?: BeginOptions,
): void {
  if (transition.phase !== "idle") return;
  transition.phase = "out";
  transition.t = 0;
  transition.action = action;
  transition.outDuration = opts?.outDuration ?? DEFAULT_OUT_MS;
  transition.inDuration = opts?.inDuration ?? DEFAULT_IN_MS;
  transition.color = opts?.color ?? [0, 0, 0];
}

export function update(
  transition: Transition,
  state: WorldState,
  dt: number,
): void {
  if (transition.phase === "idle") return;
  transition.t += dt;
  if (transition.phase === "out" && transition.t >= transition.outDuration) {
    if (transition.action) apply(state, transition.action);
    transition.phase = "in";
    transition.t = 0;
  } else if (
    transition.phase === "in" &&
    transition.t >= transition.inDuration
  ) {
    transition.phase = "idle";
    transition.t = 0;
    transition.action = null;
  }
}

function coverage(transition: Transition): number {
  if (transition.phase === "idle") return 0;
  const dur =
    transition.phase === "out" ? transition.outDuration : transition.inDuration;
  if (dur <= 0) return transition.phase === "out" ? 1 : 0;
  const raw = clamp(transition.t / dur, 0, 1);
  return transition.phase === "out" ? raw : 1 - raw;
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  transition: Transition,
  width: number,
  height: number,
): void {
  const a = coverage(transition);
  if (a <= 0) return;
  const eased = a * a * (3 - 2 * a);
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.hypot(cx, cy) + 2;
  const radius = maxRadius * (1 - eased);
  const [r, g, b] = transition.color;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  if (radius > 0) {
    ctx.moveTo(cx + radius, cy);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fill("evenodd");
  ctx.restore();
}

export function apply(state: WorldState, action: TransitionAction): void {
  switch (action.kind) {
    case "restart": {
      state.level.stats.resets += 1;
      Player.reset(state.player);
      Level.resetDynamic(state.level);
      Particles.clear(state.particles);
      return;
    }
    case "switchLevel": {
      const len = state.levels.length;
      if (len === 0) return;
      const newIdx = mod(state.currentLevelIndex + action.dir, len);
      state.currentLevelIndex = newIdx;
      state.level = state.levels[newIdx]!;
      Player.reset(state.player);
      Level.resetDynamic(state.level);
      Particles.clear(state.particles);
      return;
    }
    case "startGame": {
      state.phase = "playing";
      state.currentLevelIndex = 0;
      state.level = state.levels[0]!;
      Player.reset(state.player);
      for (const l of state.levels) {
        Level.resetDynamic(l);
        l.stats.resets = 0;
        l.stats.timeMs = 0;
      }
      Particles.clear(state.particles);
      return;
    }
  }
}
