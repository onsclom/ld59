import { randRange } from "./game-math";
import * as Input from "./input";
import * as Particles from "./particles";
import * as Sound from "./sound";

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

export function update(player: Player, particles: ParticleSystem, dt: number) {
  player.thrusting =
    player.alive &&
    (Input.keysDown.has("w") ||
      Input.keysDown.has("ArrowUp") ||
      Input.keysDown.has(" "));

  if (!player.alive) return;
  let turn = 0;
  if (Input.keysDown.has("a") || Input.keysDown.has("ArrowLeft")) turn -= 1;
  if (Input.keysDown.has("d") || Input.keysDown.has("ArrowRight")) turn += 1;
  player.rotation += turn * TURN_RATE * dt;

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

  if (Input.keysJustPressed.has(" ")) Sound.sfx.jump();
}

export function draw(player: Player, ctx: CanvasRenderingContext2D) {
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

  ctx.restore();
}
