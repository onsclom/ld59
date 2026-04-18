import { randRange } from "./game-math";
import * as Input from "./input";
import * as Particles from "./particles";
import * as Satellite from "./satellite";
import * as Sound from "./sound";

export type StatusEffects = {
  thrustDisabled: boolean;
  turnDisabled: boolean;
  controlsReversed: boolean;
};

export function createEffects(): StatusEffects {
  return {
    thrustDisabled: false,
    turnDisabled: false,
    controlsReversed: false,
  };
}

export function clearEffects(e: StatusEffects) {
  e.thrustDisabled = false;
  e.turnDisabled = false;
  e.controlsReversed = false;
}

export function anyActive(e: StatusEffects) {
  return e.thrustDisabled || e.turnDisabled || e.controlsReversed;
}

const DENY_COOLDOWN_MS = 260;
const DENY_FLASH_MS = 220;

const TURN_RATE = 0.004;
const THRUST = 0.00005;
const GRAVITY = 0.00002;
const DRAG = 0.0003;

const THRUST_EMIT_INTERVAL = 10;
const SMOKE_TAIL_OFFSET = 0.7;
const SMOKE_NOZZLE_JITTER = 0.5;
const SMOKE_SPREAD_ANGLE = Math.PI * 2;
const SMOKE_SPEED_MIN = 0.0;
const SMOKE_SPEED_MAX = 0.003;
const SMOKE_LIFE_MIN = 1000;
const SMOKE_LIFE_MAX = 2000;
const SMOKE_SIZE_MIN = 0.5;
const SMOKE_SIZE_MAX = 1;

const NOZZLE_W_FRAC = 0.9;
const NOZZLE_H_FRAC = 0.18;
const NOZZLE_OVERLAP = 0.05;
const NOZZLE_INNER_W_FRAC = 0.8;
const NOZZLE_INNER_H_FRAC = 0.45;
const WINDOW_INSET_FRAC = 0.18;
const WINDOW_TOP_FRAC = 0.15;
const WINDOW_H_FRAC = 0.28;
const WINDOW_HIGHLIGHT_TOP_FRAC = 0.1;
const WINDOW_HIGHLIGHT_W_FRAC = 0.35;
const WINDOW_HIGHLIGHT_H_FRAC = 0.2;

const COLOR_BODY = "#fff";
const COLOR_WINDOW = "#4aa8ff";
const COLOR_WINDOW_HIGHLIGHT = "#cfe7ff";
const COLOR_NOZZLE_OUTER = "#555";
const COLOR_NOZZLE_INNER = "#222";
const COLOR_FLAME = "rgba(255, 150, 30, 0.95)";
const COLOR_DEAD_OVERLAY = "rgba(255, 40, 40, 0.55)";

const FLAME_BASE_HALF = 0.45;
const FLAME_BASE_FLICKER = 0.08;
const FLAME_LENGTH = 1.3;
const FLAME_LENGTH_FLICKER = 0.2;
const FLAME_FLICKER_PERIOD_MS = 25;

export function create() {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotation: 0,
    width: 1.5,
    height: 5,
    thrustEmitAccum: 0,
    alive: true,
    hasThrusted: false,
    thrusting: false,
    denyCooldown: 0,
    denyFlash: 0,
  };
}

type Player = ReturnType<typeof create>;
type ParticleSystem = ReturnType<typeof Particles.create>;

export function reset(player: Player) {
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.rotation = 0;
  player.thrustEmitAccum = 0;
  player.alive = true;
  player.hasThrusted = false;
  player.thrusting = false;
  player.denyCooldown = 0;
  player.denyFlash = 0;
}

export function corners(player: Player) {
  const sinR = Math.sin(player.rotation);
  const cosR = Math.cos(player.rotation);
  const hw = player.width / 2;
  const hh = player.height / 2;
  const local: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  return local.map(([lx, ly]) => ({
    x: player.x + lx * cosR - ly * sinR,
    y: player.y + lx * sinR + ly * cosR,
  }));
}

export function update(
  player: Player,
  particles: ParticleSystem,
  dt: number,
  effects: StatusEffects,
) {
  player.denyCooldown = Math.max(0, player.denyCooldown - dt);
  player.denyFlash = Math.max(0, player.denyFlash - dt);

  const wantThrust =
    player.alive &&
    (Input.keysDown.has("w") ||
      Input.keysDown.has("ArrowUp") ||
      Input.keysDown.has(" "));
  player.thrusting = wantThrust && !effects.thrustDisabled;
  const deniedThrust = wantThrust && effects.thrustDisabled;

  if (!player.alive) return;

  let turnInput = 0;
  if (Input.keysDown.has("a") || Input.keysDown.has("ArrowLeft")) turnInput -= 1;
  if (Input.keysDown.has("d") || Input.keysDown.has("ArrowRight")) turnInput += 1;
  const wantTurn = turnInput !== 0;
  const deniedTurn = wantTurn && effects.turnDisabled;
  let turn = turnInput;
  if (effects.turnDisabled) turn = 0;
  else if (effects.controlsReversed) turn = -turn;
  player.rotation += turn * TURN_RATE * dt;

  if (deniedThrust || deniedTurn) {
    if (player.denyCooldown <= 0) {
      Sound.sfx.deny();
      player.denyCooldown = DENY_COOLDOWN_MS;
      player.denyFlash = DENY_FLASH_MS;
      emitDenyParticles(particles, player, deniedThrust, deniedTurn);
    }
  }

  if (player.thrusting) {
    const fx = Math.sin(player.rotation);
    const fy = -Math.cos(player.rotation);
    player.vx += fx * THRUST * dt;
    player.vy += fy * THRUST * dt;
    player.hasThrusted = true;
  }

  if (player.hasThrusted) player.vy += GRAVITY * dt;

  const dragFactor = Math.exp(-DRAG * dt);
  player.vx *= dragFactor;
  player.vy *= dragFactor;

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.thrusting) {
    player.thrustEmitAccum += dt;
    const sinR = Math.sin(player.rotation);
    const cosR = Math.cos(player.rotation);
    const tailDist = player.height / 2 + SMOKE_TAIL_OFFSET;
    const tailX = player.x - sinR * tailDist;
    const tailY = player.y + cosR * tailDist;
    while (player.thrustEmitAccum >= THRUST_EMIT_INTERVAL) {
      player.thrustEmitAccum -= THRUST_EMIT_INTERVAL;
      const nozzleOffset = (Math.random() - 0.5) * SMOKE_NOZZLE_JITTER;
      const spreadAngle = (Math.random() - 0.5) * SMOKE_SPREAD_ANGLE;
      const speed = randRange(SMOKE_SPEED_MIN, SMOKE_SPEED_MAX);
      const dirX = -Math.sin(player.rotation + spreadAngle);
      const dirY = Math.cos(player.rotation + spreadAngle);
      const shade = 200;
      Particles.emit(particles, {
        x: tailX + cosR * nozzleOffset,
        y: tailY + sinR * nozzleOffset,
        vx: dirX * speed,
        vy: dirY * speed,
        life: randRange(SMOKE_LIFE_MIN, SMOKE_LIFE_MAX),
        size: randRange(SMOKE_SIZE_MIN, SMOKE_SIZE_MAX),
        r: shade,
        g: shade,
        b: shade,
      });
    }
  } else {
    player.thrustEmitAccum = 0;
  }
}

function emitDenyParticles(
  particles: ParticleSystem,
  player: Player,
  deniedThrust: boolean,
  deniedTurn: boolean,
) {
  const sinR = Math.sin(player.rotation);
  const cosR = Math.cos(player.rotation);
  const emitAt = (lx: number, ly: number, count: number) => {
    const wx = player.x + lx * cosR - ly * sinR;
    const wy = player.y + lx * sinR + ly * cosR;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = randRange(0.001, 0.004);
      Particles.emit(particles, {
        x: wx,
        y: wy,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: randRange(250, 500),
        size: randRange(0.3, 0.7),
        r: 255,
        g: 90,
        b: 60,
      });
    }
  };
  if (deniedThrust) emitAt(0, player.height / 2 + 0.7, 8);
  if (deniedTurn) {
    emitAt(-player.width / 2 - 0.3, 0, 4);
    emitAt(player.width / 2 + 0.3, 0, 4);
  }
}

export function draw(
  player: Player,
  ctx: CanvasRenderingContext2D,
  effects: StatusEffects,
) {
  const w = player.width;
  const h = player.height;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.rotation);

  const nozW = w * NOZZLE_W_FRAC;
  const nozH = h * NOZZLE_H_FRAC;

  ctx.fillStyle = COLOR_NOZZLE_OUTER;
  ctx.fillRect(-nozW / 2, h / 2 - NOZZLE_OVERLAP, nozW, nozH);
  ctx.fillStyle = COLOR_NOZZLE_INNER;
  ctx.fillRect(
    (-nozW * NOZZLE_INNER_W_FRAC) / 2,
    h / 2 + nozH / 2,
    nozW * NOZZLE_INNER_W_FRAC,
    nozH * NOZZLE_INNER_H_FRAC,
  );

  ctx.fillStyle = COLOR_BODY;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  const winInset = w * WINDOW_INSET_FRAC;
  const winTop = -h / 2 + h * WINDOW_TOP_FRAC;
  const winW = w - winInset * 2;
  const winH = h * WINDOW_H_FRAC;
  ctx.fillStyle = COLOR_WINDOW;
  ctx.fillRect(-w / 2 + winInset, winTop, winW, winH);
  ctx.fillStyle = COLOR_WINDOW_HIGHLIGHT;
  ctx.fillRect(
    -w / 2 + winInset,
    winTop + winH * WINDOW_HIGHLIGHT_TOP_FRAC,
    winW * WINDOW_HIGHLIGHT_W_FRAC,
    winH * WINDOW_HIGHLIGHT_H_FRAC,
  );

  if (player.thrusting) {
    const flicker = Math.sin(performance.now() / FLAME_FLICKER_PERIOD_MS);
    const baseY = h / 2 + nozH;
    const halfBase = FLAME_BASE_HALF + FLAME_BASE_FLICKER * flicker;
    const tipY = baseY + FLAME_LENGTH + FLAME_LENGTH_FLICKER * flicker;
    ctx.fillStyle = COLOR_FLAME;
    ctx.beginPath();
    ctx.moveTo(-halfBase, baseY);
    ctx.lineTo(halfBase, baseY);
    ctx.lineTo(0, tipY);
    ctx.closePath();
    ctx.fill();
  }

  if (!player.alive) {
    ctx.fillStyle = COLOR_DEAD_OVERLAY;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }

  drawStatusRings(ctx, w, h, effects);
  drawDenyFlash(ctx, w, h, player.denyFlash);

  ctx.restore();
}

function drawStatusRings(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  effects: StatusEffects,
) {
  if (!anyActive(effects)) return;
  const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 160);
  const rings: string[] = [];
  if (effects.thrustDisabled) rings.push(Satellite.TYPE_COLORS["thrust-inhibitor"]);
  if (effects.turnDisabled) rings.push(Satellite.TYPE_COLORS["turn-inhibitor"]);
  if (effects.controlsReversed) rings.push(Satellite.TYPE_COLORS["control-reverser"]);
  let inset = 0.35;
  ctx.lineWidth = 0.18;
  for (const color of rings) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45 + 0.4 * pulse;
    ctx.strokeRect(-w / 2 - inset, -h / 2 - inset, w + inset * 2, h + inset * 2);
    inset += 0.35;
  }
  ctx.globalAlpha = 1;
}

function drawDenyFlash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  remaining: number,
) {
  if (remaining <= 0) return;
  const t = remaining / DENY_FLASH_MS;
  ctx.globalAlpha = t * 0.8;
  ctx.fillStyle = "rgba(255, 70, 50, 0.5)";
  ctx.fillRect(-w / 2 - 0.3, -h / 2 - 0.3, w + 0.6, h + 0.6);
  ctx.strokeStyle = "#ff6040";
  ctx.lineWidth = 0.2;
  ctx.strokeRect(-w / 2 - 0.3, -h / 2 - 0.3, w + 0.6, h + 0.6);
  ctx.globalAlpha = 1;
}
