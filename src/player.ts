import { randRange } from "./game-math";
import * as Input from "./input";
import * as Particles from "./particles";
import * as Sound from "./sound";

const TURN_RATE = 0.004;
const THRUST = 0.00005;
const GRAVITY = 0.00002;
const DRAG = 0.0003;

const THRUST_EMIT_INTERVAL = 5;
const SMOKE_TAIL_OFFSET = 0.7;
const SMOKE_NOZZLE_JITTER = 0.5;
const SMOKE_SPREAD_ANGLE = Math.PI * 2;
const SMOKE_SPEED_MIN = 0.0;
const SMOKE_SPEED_MAX = 0.006;
const SMOKE_LIFE_MIN = 1000;
const SMOKE_LIFE_MAX = 2000;
const SMOKE_SIZE_MIN = 0.5;
const SMOKE_SIZE_MAX = 1;

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
  };
}

type Player = ReturnType<typeof create>;
type ParticleSystem = ReturnType<typeof Particles.create>;

export function update(player: Player, particles: ParticleSystem, dt: number) {
  let turn = 0;
  if (Input.keysDown.has("a") || Input.keysDown.has("ArrowLeft")) turn -= 1;
  if (Input.keysDown.has("d") || Input.keysDown.has("ArrowRight")) turn += 1;
  player.rotation += turn * TURN_RATE * dt;

  const thrusting =
    Input.keysDown.has("w") ||
    Input.keysDown.has("ArrowUp") ||
    Input.keysDown.has(" ");
  if (thrusting) {
    const fx = Math.sin(player.rotation);
    const fy = -Math.cos(player.rotation);
    player.vx += fx * THRUST * dt;
    player.vy += fy * THRUST * dt;
  }

  player.vy += GRAVITY * dt;

  const dragFactor = Math.exp(-DRAG * dt);
  player.vx *= dragFactor;
  player.vy *= dragFactor;

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (thrusting) {
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

  ctx.fillStyle = "#555";
  const nozW = w * 0.9;
  const nozH = h * 0.18;
  ctx.fillRect(-nozW / 2, h / 2 - 0.05, nozW, nozH);
  ctx.fillStyle = "#222";
  ctx.fillRect(-nozW * 0.4, h / 2 + nozH * 0.5, nozW * 0.8, nozH * 0.45);

  ctx.fillStyle = "#fff";
  ctx.fillRect(-w / 2, -h / 2, w, h);

  ctx.fillStyle = "#4aa8ff";
  const winInset = w * 0.18;
  const winTop = -h / 2 + h * 0.15;
  const winH = h * 0.28;
  ctx.fillRect(-w / 2 + winInset, winTop, w - winInset * 2, winH);
  ctx.fillStyle = "#cfe7ff";
  ctx.fillRect(
    -w / 2 + winInset,
    winTop + winH * 0.1,
    (w - winInset * 2) * 0.35,
    winH * 0.2,
  );

  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = 0.15;
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  ctx.restore();
}
