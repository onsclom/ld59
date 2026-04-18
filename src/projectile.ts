export type ProjectileKind = "fireball" | "missile";

export type Projectile = {
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alive: boolean;
  emitAccum: number;
  ownerIdx: number;
};

export const FIREBALL_SPEED = 0.045;
export const MISSILE_SPEED = 0.03;
export const MISSILE_TURN_RATE = 0.002;

const FIREBALL_CORE_R = 0.35;
const FIREBALL_MID_R = 0.6;
const FIREBALL_GLOW_R = 1.0;

const MISSILE_LEN = 2.2;
const MISSILE_W = 0.75;
const MISSILE_GLOW_R = 1.1;

export function draw(ctx: CanvasRenderingContext2D, p: Projectile) {
  if (!p.alive) return;
  if (p.kind === "fireball") drawFireball(ctx, p);
  else drawMissile(ctx, p);
}

function drawFireball(ctx: CanvasRenderingContext2D, p: Projectile) {
  ctx.fillStyle = "rgba(255, 90, 30, 0.30)";
  ctx.beginPath();
  ctx.arc(p.x, p.y, FIREBALL_GLOW_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff5020";
  ctx.beginPath();
  ctx.arc(p.x, p.y, FIREBALL_MID_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe0a0";
  ctx.beginPath();
  ctx.arc(p.x, p.y, FIREBALL_CORE_R, 0, Math.PI * 2);
  ctx.fill();
}

function drawMissile(ctx: CanvasRenderingContext2D, p: Projectile) {
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = "rgba(255, 140, 60, 0.28)";
  ctx.beginPath();
  ctx.arc(0, 0, MISSILE_GLOW_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(p.angle);
  const half = MISSILE_LEN / 2;
  const bodyLen = MISSILE_LEN * 0.78;

  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(-half, -MISSILE_W / 2, bodyLen, MISSILE_W);
  ctx.fillStyle = "#aaa";
  ctx.fillRect(-half, -MISSILE_W / 2, bodyLen, MISSILE_W * 0.18);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-half + bodyLen * 0.25, -MISSILE_W * 0.08, bodyLen * 0.5, MISSILE_W * 0.16);

  ctx.fillStyle = "#e34040";
  ctx.beginPath();
  ctx.moveTo(half - MISSILE_LEN * 0.22, -MISSILE_W / 2);
  ctx.lineTo(half, 0);
  ctx.lineTo(half - MISSILE_LEN * 0.22, MISSILE_W / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffcfcf";
  ctx.beginPath();
  ctx.arc(half - MISSILE_LEN * 0.1, 0, MISSILE_W * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#666";
  ctx.beginPath();
  ctx.moveTo(-half, -MISSILE_W / 2);
  ctx.lineTo(-half - 0.5, -MISSILE_W / 2 - 0.4);
  ctx.lineTo(-half + 0.3, -MISSILE_W / 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-half, MISSILE_W / 2);
  ctx.lineTo(-half - 0.5, MISSILE_W / 2 + 0.4);
  ctx.lineTo(-half + 0.3, MISSILE_W / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffa040";
  ctx.beginPath();
  ctx.ellipse(-half - 0.15, 0, 0.35, MISSILE_W * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe8a0";
  ctx.beginPath();
  ctx.ellipse(-half - 0.05, 0, 0.18, MISSILE_W * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
