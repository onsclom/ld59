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

const THRUST_EMIT_INTERVAL = 8;
const SMOKE_TAIL_OFFSET = 0.7;
const SMOKE_NOZZLE_JITTER = 0.55;
const SMOKE_SPREAD_ANGLE = Math.PI * 2;
const SMOKE_SPEED_MIN = 0.0;
const SMOKE_SPEED_MAX = 0.003;
const SMOKE_LIFE_MIN = 900;
const SMOKE_LIFE_MAX = 1700;
const SMOKE_SIZE_MIN = 0.7;
const SMOKE_SIZE_MAX = 1.0;
const EMBER_SPREAD_ANGLE = 0.35;
const EMBER_SPEED_MIN = 0.012;
const EMBER_SPEED_MAX = 0.022;
const EMBER_LIFE_MIN = 320;
const EMBER_LIFE_MAX = 320;
const EMBER_SIZE_MIN = 0.25;
const EMBER_SIZE_MAX = 0.5;

const NOSE_LEN = 1.1;
const COLLAR_H = 0.14;

const WINDOW_CY = -0.75;
const WINDOW_R = 0.38;
const WINDOW_RIVET_COUNT = 6;
const WINDOW_RIVET_R = 0.04;

const HAZARD_CY = 0.55;
const HAZARD_H = 0.36;
const HAZARD_STRIPE_COUNT = 5;

const SKIRT_H = 0.28;

const FIN_INNER_TOP = 1.2;
const FIN_INNER_BOTTOM = 2.42;
const FIN_OUTER_Y = 2.5;
const FIN_OUTER_DX = 0.32;

const NOZZLE_FLANGE_Y = 2.5;
const NOZZLE_FLANGE_H = 0.18;
const NOZZLE_FLANGE_W = 1.5;
const NOZZLE_FLANGE_BOLTS = 4;
const NOZZLE_BELL_H = 0.48;
const NOZZLE_BELL_TOP_W = 1.3;
const NOZZLE_BELL_BOT_W = 1.65;
const NOZZLE_INNER_TOP_W = 0.68;
const NOZZLE_INNER_BOT_W = 1.08;

const RIVET_R = 0.06;
const RIVET_ROWS = [-0.2, 1.35, 2.12];

const COLOR_BODY = "#e8ecf0";
const COLOR_BODY_SHADOW = "#a6afbc";
const COLOR_BODY_HIGHLIGHT = "#ffffff";
const COLOR_BODY_EDGE = "#484d58";
const COLOR_NOSE = "#c43a30";
const COLOR_NOSE_SHADOW = "#7a1c1a";
const COLOR_NOSE_CAP = "#ffd060";
const COLOR_NOSE_CAP_GLOW = "rgba(255, 220, 120, 0.7)";
const COLOR_WINDOW = "#5ab8ff";
const COLOR_WINDOW_BACK = "#0c2850";
const COLOR_WINDOW_FRAME = "#3a414c";
const COLOR_WINDOW_HIGHLIGHT = "#e0f0ff";
const COLOR_HAZARD_A = "#e0a820";
const COLOR_HAZARD_B = "#1a1a1a";
const COLOR_SKIRT = "#4a4f58";
const COLOR_SKIRT_DARK = "#252830";
const COLOR_SKIRT_RIVET = "#8a8e96";
const COLOR_FIN = "#c43a30";
const COLOR_FIN_SHADOW = "#7a1c1a";
const COLOR_FIN_EDGE = "#3a0f0d";
const COLOR_RIVET = "#2a2f36";
const COLOR_NOZZLE_FLANGE = "#5a5a5a";
const COLOR_NOZZLE_FLANGE_EDGE = "#2a2a2a";
const COLOR_NOZZLE_BOLT = "#8a8e96";
const COLOR_NOZZLE_BELL = "#2a2a2a";
const COLOR_NOZZLE_BELL_HIGHLIGHT = "#6a6a6a";
const COLOR_NOZZLE_THROAT = "#050505";
const COLOR_NOZZLE_HEAT = "rgba(255, 120, 40, 0.65)";
const COLOR_DEAD_OVERLAY = "rgba(255, 40, 40, 0.55)";

const INVULN_PULSE_PERIOD_MS = 900;
const INVULN_ALPHA_MIN = 0.18;
const INVULN_ALPHA_MAX = 0.5;

const HITBOX_SCALE = 0.8;

const FLAME_FLICKER_PERIOD_MS = 28;
const FLAME_LEN_OUTER = 1.8;
const FLAME_LEN_MIDDLE = 1.2;
const FLAME_LEN_CORE = 0.55;
const FLAME_W_OUTER = 0.6;
const FLAME_W_MIDDLE = 0.36;
const FLAME_W_CORE = 0.18;
const COLOR_FLAME_OUTER = "rgba(255, 110, 30, 0.9)";
const COLOR_FLAME_MIDDLE = "rgba(255, 210, 90, 0.95)";
const COLOR_FLAME_CORE = "rgba(255, 255, 235, 0.95)";

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

export function hitboxHalfW(player: Player) {
  return (player.width / 2) * HITBOX_SCALE;
}

export function hitboxHalfH(player: Player) {
  return (player.height / 2) * HITBOX_SCALE;
}

export function corners(player: Player) {
  const sinR = Math.sin(player.rotation);
  const cosR = Math.cos(player.rotation);
  const hw = hitboxHalfW(player);
  const hh = hitboxHalfH(player);
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
  if (Input.keysDown.has("a") || Input.keysDown.has("ArrowLeft"))
    turnInput -= 1;
  if (Input.keysDown.has("d") || Input.keysDown.has("ArrowRight"))
    turnInput += 1;
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
    const inheritVx = player.vx * 0.5;
    const inheritVy = player.vy * 0.5;
    while (player.thrustEmitAccum >= THRUST_EMIT_INTERVAL) {
      player.thrustEmitAccum -= THRUST_EMIT_INTERVAL;

      const nozzleOffset = (Math.random() - 0.5) * SMOKE_NOZZLE_JITTER;
      const spreadAngle = (Math.random() - 0.5) * SMOKE_SPREAD_ANGLE;
      const speed = randRange(SMOKE_SPEED_MIN, SMOKE_SPEED_MAX);
      const dirX = -Math.sin(player.rotation + spreadAngle);
      const dirY = Math.cos(player.rotation + spreadAngle);
      const shade = 180 + Math.floor(Math.random() * 60);
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

      if (Math.random() < 0.5) {
        const emberSpread = (Math.random() - 0.5) * EMBER_SPREAD_ANGLE;
        const emberOffset = (Math.random() - 0.5) * SMOKE_NOZZLE_JITTER * 0.6;
        const emberSpeed = randRange(EMBER_SPEED_MIN, EMBER_SPEED_MAX);
        const eDirX = -Math.sin(player.rotation + emberSpread);
        const eDirY = Math.cos(player.rotation + emberSpread);
        const heat = Math.random();
        Particles.emit(particles, {
          x: tailX + cosR * emberOffset,
          y: tailY + sinR * emberOffset,
          vx: eDirX * emberSpeed + inheritVx,
          vy: eDirY * emberSpeed + inheritVy,
          life: randRange(EMBER_LIFE_MIN, EMBER_LIFE_MAX),
          size: randRange(EMBER_SIZE_MIN, EMBER_SIZE_MAX),
          r: 255,
          g: 160 + Math.floor(heat * 80),
          b: 40 + Math.floor(heat * 60),
        });
      }
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
  const hw = w / 2;
  const hh = h / 2;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.rotation);

  if (player.thrusting) drawFlame(ctx);
  drawNozzle(ctx, player.thrusting);
  drawFins(ctx, hw);
  drawHull(ctx, w, h, hw, hh);
  drawCollar(ctx, hw, hh);
  drawWindow(ctx);
  drawHazardBand(ctx, w, hw);
  drawRivets(ctx, hw);
  drawSkirt(ctx, hw, hh);

  if (!player.alive) {
    ctx.fillStyle = COLOR_DEAD_OVERLAY;
    ctx.fillRect(-hw, -hh, w, h);
  }

  if (player.alive && !player.hasThrusted) drawInvulnerableSheen(ctx, w, h, hw, hh);

  drawStatusRings(ctx, w, h, effects);
  drawDenyFlash(ctx, w, h, player.denyFlash);

  ctx.restore();
}

function drawHull(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hw: number,
  hh: number,
) {
  const top = -hh;
  const bottom = hh;
  const shoulderY = top + NOSE_LEN;

  ctx.fillStyle = COLOR_BODY;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(hw, shoulderY);
  ctx.lineTo(hw, bottom);
  ctx.lineTo(-hw, bottom);
  ctx.lineTo(-hw, shoulderY);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(hw, shoulderY);
  ctx.lineTo(hw, bottom);
  ctx.lineTo(hw - w * 0.22, bottom);
  ctx.lineTo(hw - w * 0.22, shoulderY);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = COLOR_BODY_SHADOW;
  ctx.fillRect(-hw, top, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = COLOR_BODY_HIGHLIGHT;
  ctx.fillRect(-hw, shoulderY, w * 0.08, h - NOSE_LEN);
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.fillStyle = COLOR_NOSE;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(hw, shoulderY);
  ctx.lineTo(-hw, shoulderY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLOR_NOSE_SHADOW;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(hw, shoulderY);
  ctx.lineTo(0, shoulderY);
  ctx.closePath();
  ctx.fill();

  const capY = top + 0.14;
  ctx.fillStyle = COLOR_NOSE_CAP_GLOW;
  ctx.beginPath();
  ctx.arc(0, capY, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR_NOSE_CAP;
  ctx.beginPath();
  ctx.arc(0, capY, 0.09, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLOR_BODY_EDGE;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(hw, shoulderY);
  ctx.lineTo(hw, bottom);
  ctx.lineTo(-hw, bottom);
  ctx.lineTo(-hw, shoulderY);
  ctx.closePath();
  ctx.stroke();
}

function drawCollar(ctx: CanvasRenderingContext2D, hw: number, hh: number) {
  const y = -hh + NOSE_LEN - COLLAR_H / 2;
  ctx.fillStyle = COLOR_SKIRT;
  ctx.fillRect(-hw, y, hw * 2, COLLAR_H);
  ctx.fillStyle = COLOR_SKIRT_DARK;
  ctx.fillRect(-hw, y, hw * 2, 0.04);
  ctx.fillRect(-hw, y + COLLAR_H - 0.04, hw * 2, 0.04);
  ctx.fillStyle = COLOR_SKIRT_RIVET;
  for (let i = 0; i < 3; i++) {
    const x = -hw * 0.55 + i * hw * 0.55;
    ctx.beginPath();
    ctx.arc(x, y + COLLAR_H / 2, 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWindow(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLOR_WINDOW_BACK;
  ctx.beginPath();
  ctx.arc(0, WINDOW_CY, WINDOW_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLOR_WINDOW;
  ctx.beginPath();
  ctx.arc(0, WINDOW_CY, WINDOW_R - 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLOR_WINDOW_HIGHLIGHT;
  ctx.beginPath();
  ctx.arc(
    -0.08,
    WINDOW_CY - 0.08,
    (WINDOW_R - 0.08) * 0.55,
    Math.PI,
    Math.PI * 1.7,
  );
  ctx.lineTo(-0.08, WINDOW_CY - 0.08);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = COLOR_WINDOW_FRAME;
  ctx.lineWidth = 0.08;
  ctx.beginPath();
  ctx.arc(0, WINDOW_CY, WINDOW_R - 0.04, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = COLOR_RIVET;
  for (let i = 0; i < WINDOW_RIVET_COUNT; i++) {
    const a =
      (i / WINDOW_RIVET_COUNT) * Math.PI * 2 + Math.PI / WINDOW_RIVET_COUNT;
    const x = Math.cos(a) * (WINDOW_R + 0.05);
    const y = WINDOW_CY + Math.sin(a) * (WINDOW_R + 0.05);
    ctx.beginPath();
    ctx.arc(x, y, WINDOW_RIVET_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHazardBand(ctx: CanvasRenderingContext2D, w: number, hw: number) {
  const y = HAZARD_CY - HAZARD_H / 2;
  ctx.fillStyle = COLOR_HAZARD_B;
  ctx.fillRect(-hw, y, w, HAZARD_H);

  ctx.save();
  ctx.beginPath();
  ctx.rect(-hw, y, w, HAZARD_H);
  ctx.clip();
  ctx.fillStyle = COLOR_HAZARD_A;
  const span = w + HAZARD_H * 2;
  const step = span / HAZARD_STRIPE_COUNT;
  const stripeW = step * 0.5;
  for (let i = 0; i < HAZARD_STRIPE_COUNT + 1; i++) {
    const x0 = -hw - HAZARD_H + i * step;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + stripeW, y);
    ctx.lineTo(x0 + stripeW + HAZARD_H, y + HAZARD_H);
    ctx.lineTo(x0 + HAZARD_H, y + HAZARD_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = COLOR_BODY_EDGE;
  ctx.fillRect(-hw, y - 0.02, w, 0.035);
  ctx.fillRect(-hw, y + HAZARD_H - 0.015, w, 0.035);
}

function drawRivets(ctx: CanvasRenderingContext2D, hw: number) {
  ctx.fillStyle = COLOR_RIVET;
  for (const y of RIVET_ROWS) {
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sign * (hw - 0.12), y, RIVET_R, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSkirt(ctx: CanvasRenderingContext2D, hw: number, hh: number) {
  const y = hh - SKIRT_H;
  ctx.fillStyle = COLOR_SKIRT;
  ctx.fillRect(-hw, y, hw * 2, SKIRT_H);
  ctx.fillStyle = COLOR_SKIRT_DARK;
  ctx.fillRect(-hw, y, hw * 2, 0.05);
  ctx.fillRect(-hw, y + SKIRT_H - 0.05, hw * 2, 0.05);
  ctx.fillStyle = COLOR_SKIRT_RIVET;
  for (let i = 0; i < 4; i++) {
    const x = -hw + 0.22 + i * ((hw * 2 - 0.44) / 3);
    ctx.beginPath();
    ctx.arc(x, y + SKIRT_H / 2, 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFins(ctx: CanvasRenderingContext2D, hw: number) {
  for (const sign of [-1, 1] as const) {
    ctx.fillStyle = COLOR_FIN;
    ctx.beginPath();
    ctx.moveTo(sign * hw, FIN_INNER_TOP);
    ctx.lineTo(sign * hw, FIN_INNER_BOTTOM);
    ctx.lineTo(sign * (hw + FIN_OUTER_DX), FIN_OUTER_Y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLOR_FIN_SHADOW;
    ctx.beginPath();
    ctx.moveTo(sign * hw, (FIN_INNER_TOP + FIN_INNER_BOTTOM) / 2);
    ctx.lineTo(sign * hw, FIN_INNER_BOTTOM);
    ctx.lineTo(sign * (hw + FIN_OUTER_DX * 0.6), FIN_OUTER_Y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = COLOR_FIN_EDGE;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(sign * hw, FIN_INNER_TOP);
    ctx.lineTo(sign * (hw + FIN_OUTER_DX), FIN_OUTER_Y);
    ctx.stroke();
  }
}

function drawNozzle(ctx: CanvasRenderingContext2D, thrusting: boolean) {
  ctx.fillStyle = COLOR_NOZZLE_FLANGE;
  ctx.fillRect(
    -NOZZLE_FLANGE_W / 2,
    NOZZLE_FLANGE_Y,
    NOZZLE_FLANGE_W,
    NOZZLE_FLANGE_H,
  );
  ctx.fillStyle = COLOR_NOZZLE_FLANGE_EDGE;
  ctx.fillRect(-NOZZLE_FLANGE_W / 2, NOZZLE_FLANGE_Y, NOZZLE_FLANGE_W, 0.04);
  ctx.fillRect(
    -NOZZLE_FLANGE_W / 2,
    NOZZLE_FLANGE_Y + NOZZLE_FLANGE_H - 0.04,
    NOZZLE_FLANGE_W,
    0.04,
  );

  ctx.fillStyle = COLOR_NOZZLE_BOLT;
  for (let i = 0; i < NOZZLE_FLANGE_BOLTS; i++) {
    const x =
      -NOZZLE_FLANGE_W / 2 +
      0.18 +
      (i * (NOZZLE_FLANGE_W - 0.36)) / (NOZZLE_FLANGE_BOLTS - 1);
    ctx.beginPath();
    ctx.arc(x, NOZZLE_FLANGE_Y + NOZZLE_FLANGE_H / 2, 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  const bellTopY = NOZZLE_FLANGE_Y + NOZZLE_FLANGE_H;
  const bellBotY = bellTopY + NOZZLE_BELL_H;
  ctx.fillStyle = COLOR_NOZZLE_BELL;
  ctx.beginPath();
  ctx.moveTo(-NOZZLE_BELL_TOP_W / 2, bellTopY);
  ctx.lineTo(NOZZLE_BELL_TOP_W / 2, bellTopY);
  ctx.lineTo(NOZZLE_BELL_BOT_W / 2, bellBotY);
  ctx.lineTo(-NOZZLE_BELL_BOT_W / 2, bellBotY);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = COLOR_NOZZLE_BELL_HIGHLIGHT;
  ctx.beginPath();
  ctx.moveTo(-NOZZLE_BELL_TOP_W / 2 + 0.04, bellTopY);
  ctx.lineTo(-NOZZLE_BELL_TOP_W / 2 + 0.14, bellTopY);
  ctx.lineTo(-NOZZLE_BELL_BOT_W / 2 + 0.2, bellBotY);
  ctx.lineTo(-NOZZLE_BELL_BOT_W / 2 + 0.08, bellBotY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = COLOR_NOZZLE_THROAT;
  ctx.beginPath();
  ctx.moveTo(-NOZZLE_INNER_TOP_W / 2, bellTopY + 0.02);
  ctx.lineTo(NOZZLE_INNER_TOP_W / 2, bellTopY + 0.02);
  ctx.lineTo(NOZZLE_INNER_BOT_W / 2, bellBotY - 0.02);
  ctx.lineTo(-NOZZLE_INNER_BOT_W / 2, bellBotY - 0.02);
  ctx.closePath();
  ctx.fill();

  if (thrusting) {
    ctx.fillStyle = COLOR_NOZZLE_HEAT;
    ctx.beginPath();
    ctx.moveTo(-NOZZLE_INNER_TOP_W / 2 + 0.06, bellTopY + 0.05);
    ctx.lineTo(NOZZLE_INNER_TOP_W / 2 - 0.06, bellTopY + 0.05);
    ctx.lineTo(NOZZLE_INNER_BOT_W / 2 - 0.1, bellBotY - 0.05);
    ctx.lineTo(-NOZZLE_INNER_BOT_W / 2 + 0.1, bellBotY - 0.05);
    ctx.closePath();
    ctx.fill();
  }
}

function drawFlame(ctx: CanvasRenderingContext2D) {
  const baseY = NOZZLE_FLANGE_Y + NOZZLE_FLANGE_H + NOZZLE_BELL_H * 0.6;
  const t = performance.now();
  const f1 = Math.sin(t / FLAME_FLICKER_PERIOD_MS);
  const f2 = Math.sin(t / (FLAME_FLICKER_PERIOD_MS * 1.7) + 1.3);
  const f3 = Math.sin(t / (FLAME_FLICKER_PERIOD_MS * 2.3) + 2.1);

  drawFlameShape(
    ctx,
    COLOR_FLAME_OUTER,
    baseY,
    FLAME_W_OUTER + 0.08 * f2,
    FLAME_LEN_OUTER + 0.22 * f1,
  );
  drawFlameShape(
    ctx,
    COLOR_FLAME_MIDDLE,
    baseY,
    FLAME_W_MIDDLE + 0.05 * f3,
    FLAME_LEN_MIDDLE + 0.16 * f2,
  );
  drawFlameShape(
    ctx,
    COLOR_FLAME_CORE,
    baseY,
    FLAME_W_CORE + 0.03 * f1,
    FLAME_LEN_CORE + 0.1 * f3,
  );
}

function drawFlameShape(
  ctx: CanvasRenderingContext2D,
  color: string,
  baseY: number,
  halfW: number,
  len: number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-halfW, baseY);
  ctx.quadraticCurveTo(-halfW * 1.1, baseY + len * 0.5, 0, baseY + len);
  ctx.quadraticCurveTo(halfW * 1.1, baseY + len * 0.5, halfW, baseY);
  ctx.closePath();
  ctx.fill();
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
  if (effects.thrustDisabled)
    rings.push(Satellite.TYPE_COLORS["thrust-inhibitor"]);
  if (effects.turnDisabled) rings.push(Satellite.TYPE_COLORS["turn-inhibitor"]);
  if (effects.controlsReversed)
    rings.push(Satellite.TYPE_COLORS["control-reverser"]);
  let inset = 0.35;
  ctx.lineWidth = 0.18;
  for (const color of rings) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45 + 0.4 * pulse;
    ctx.strokeRect(
      -w / 2 - inset,
      -h / 2 - inset,
      w + inset * 2,
      h + inset * 2,
    );
    inset += 0.35;
  }
  ctx.globalAlpha = 1;
}

function buildShipSilhouette(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
) {
  const top = -hh;
  const bottom = hh;
  const shoulderY = top + NOSE_LEN;

  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(hw, shoulderY);
  ctx.lineTo(hw, bottom);
  ctx.lineTo(-hw, bottom);
  ctx.lineTo(-hw, shoulderY);
  ctx.closePath();

  for (const sign of [-1, 1] as const) {
    ctx.moveTo(sign * hw, FIN_INNER_TOP);
    ctx.lineTo(sign * hw, FIN_INNER_BOTTOM);
    ctx.lineTo(sign * (hw + FIN_OUTER_DX), FIN_OUTER_Y);
    ctx.closePath();
  }

  ctx.rect(
    -NOZZLE_FLANGE_W / 2,
    NOZZLE_FLANGE_Y,
    NOZZLE_FLANGE_W,
    NOZZLE_FLANGE_H,
  );

  const bellTopY = NOZZLE_FLANGE_Y + NOZZLE_FLANGE_H;
  const bellBotY = bellTopY + NOZZLE_BELL_H;
  ctx.moveTo(-NOZZLE_BELL_TOP_W / 2, bellTopY);
  ctx.lineTo(NOZZLE_BELL_TOP_W / 2, bellTopY);
  ctx.lineTo(NOZZLE_BELL_BOT_W / 2, bellBotY);
  ctx.lineTo(-NOZZLE_BELL_BOT_W / 2, bellBotY);
  ctx.closePath();
}

function drawInvulnerableSheen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hw: number,
  hh: number,
) {
  const pulse =
    0.5 + 0.5 * Math.sin((performance.now() / INVULN_PULSE_PERIOD_MS) * Math.PI * 2);
  const alpha = INVULN_ALPHA_MIN + (INVULN_ALPHA_MAX - INVULN_ALPHA_MIN) * pulse;

  ctx.save();
  buildShipSilhouette(ctx, hw, hh);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-hw - 1, -hh - NOSE_LEN - 1, w + 2, h + NOSE_LEN + 2);
  ctx.restore();
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
