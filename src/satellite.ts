export type SatelliteType =
  | "turn-inhibitor"
  | "thrust-inhibitor"
  | "control-reverser"
  | "transmission-node"
  | "cannon"
  | "missile-launcher";

export type Satellite = { x: number; y: number; type: SatelliteType };

const BODY_W = 1.4;
const BODY_H = 2;
const ARM_LEN = 1.4;
const ARM_THICKNESS = 0.16;
const PANEL_W = 2.2;
const PANEL_H = 1;
const PANEL_CELLS = 4;
const ANTENNA_H = 0.5;
const ANTENNA_DISH_R = 0.18;
const SOLAR_STRIP_H = 0.5;
const SOLAR_STRIP_INSET = 0.15;
const PANEL_LINE_W = 0.05;

const TX_BODY_W = 2.2;
const TX_BODY_H = 2.2;
const TX_DISH_R = 1.6;
const TX_DISH_RIM_W = 0.12;
const TX_DISH_OFFSET = TX_BODY_H / 2 + 0.2;
const TX_PULSE_R = 0.28;

const COLOR_ARM = "#888";
const COLOR_BODY_DEFAULT = "#bbb";
const COLOR_SOLAR_STRIP = "#444";
const COLOR_PANEL = "#1a3a6e";
const COLOR_PANEL_GRID = "#4a7fc8";
const COLOR_ANTENNA = "#888";

const COLOR_TURN = "#e07a2a";
const COLOR_THRUST = "#3aa0d0";
const COLOR_REVERSE = "#a34ac8";
const COLOR_TX_BODY = "#4ae0a0";
const COLOR_TX_DISH = "#e8fff5";
const COLOR_TX_DISH_RIM = "#4ae0a0";
const COLOR_TX_PULSE = "#9cffcf";
const COLOR_CANNON = "#d0342a";
const COLOR_MISSILE = "#e0a820";

export const TYPES: readonly SatelliteType[] = [
  "turn-inhibitor",
  "thrust-inhibitor",
  "control-reverser",
  "transmission-node",
  "cannon",
  "missile-launcher",
];

export const TYPE_LABELS: Record<SatelliteType, string> = {
  "turn-inhibitor": "Turn Inhibitor",
  "thrust-inhibitor": "Thrust Inhibitor",
  "control-reverser": "Control Reverser",
  "transmission-node": "Transmission Node",
  cannon: "Cannon",
  "missile-launcher": "Missile Launcher",
};

export const TYPE_COLORS: Record<SatelliteType, string> = {
  "turn-inhibitor": COLOR_TURN,
  "thrust-inhibitor": COLOR_THRUST,
  "control-reverser": COLOR_REVERSE,
  "transmission-node": COLOR_TX_BODY,
  cannon: COLOR_CANNON,
  "missile-launcher": COLOR_MISSILE,
};

export function create(x: number, y: number, type: SatelliteType): Satellite {
  return { x, y, type };
}

const SWAY_AMPLITUDE = 0.14;
const SWAY_SPEED = 2.3;

const DEFAULT_AIM = -Math.PI / 2;

export function draw(
  ctx: CanvasRenderingContext2D,
  sat: Satellite,
  sway = true,
  aim = DEFAULT_AIM,
  charge = 0,
) {
  ctx.save();
  ctx.translate(sat.x, sat.y);
  if (sway) {
    const t = performance.now() / 1000;
    const phase = sat.x * 0.37 + sat.y * 0.21;
    const rot =
      Math.sin(t * SWAY_SPEED + phase) * SWAY_AMPLITUDE +
      Math.sin(t * SWAY_SPEED * 2.3 + phase * 1.7) * SWAY_AMPLITUDE * 0.3;
    ctx.rotate(rot);
  }
  if (sat.type === "transmission-node") drawTransmissionNode(ctx);
  else if (sat.type === "cannon") drawCannon(ctx, aim, charge);
  else if (sat.type === "missile-launcher") drawMissileLauncher(ctx, aim, charge);
  else drawStandard(ctx, TYPE_COLORS[sat.type]);
  ctx.restore();
}

function drawChassis(
  ctx: CanvasRenderingContext2D,
  bodyColor: string,
  withAntenna: boolean,
) {
  ctx.fillStyle = COLOR_ARM;
  ctx.fillRect(-BODY_W / 2 - ARM_LEN, -ARM_THICKNESS / 2, ARM_LEN, ARM_THICKNESS);
  ctx.fillRect(BODY_W / 2, -ARM_THICKNESS / 2, ARM_LEN, ARM_THICKNESS);

  for (const side of [-1, 1] as const) {
    const panelLeft =
      side === 1 ? BODY_W / 2 + ARM_LEN : -BODY_W / 2 - ARM_LEN - PANEL_W;
    drawPanel(ctx, panelLeft);
  }

  ctx.fillStyle = bodyColor;
  ctx.fillRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H);
  ctx.fillStyle = COLOR_SOLAR_STRIP;
  ctx.fillRect(
    -BODY_W / 2 + SOLAR_STRIP_INSET,
    -BODY_H / 2 + SOLAR_STRIP_INSET,
    BODY_W - SOLAR_STRIP_INSET * 2,
    SOLAR_STRIP_H,
  );
  if (withAntenna) {
    ctx.fillStyle = COLOR_ANTENNA;
    ctx.fillRect(-ARM_THICKNESS / 2, -BODY_H / 2 - ANTENNA_H, ARM_THICKNESS, ANTENNA_H);
    ctx.beginPath();
    ctx.arc(0, -BODY_H / 2 - ANTENNA_H - ANTENNA_DISH_R * 0.6, ANTENNA_DISH_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStandard(ctx: CanvasRenderingContext2D, bodyColor: string) {
  drawChassis(ctx, bodyColor, true);
}

function drawCannon(
  ctx: CanvasRenderingContext2D,
  aim: number,
  charge: number,
) {
  const baseR = 1.55;

  ctx.fillStyle = "#272727";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * baseR;
    const y = Math.sin(a) * baseR;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 0.12;
  ctx.stroke();

  ctx.fillStyle = "#3a3a3a";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = baseR * 0.82;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const warnAlpha = 0.35 + 0.5 * charge;
  ctx.fillStyle = `rgba(255, ${60 + charge * 100}, ${40 + charge * 60}, ${warnAlpha})`;
  ctx.beginPath();
  ctx.arc(0, 0, 0.35 + 0.12 * charge, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(aim);

  ctx.fillStyle = COLOR_CANNON;
  ctx.beginPath();
  ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6a1a1a";
  ctx.lineWidth = 0.1;
  ctx.stroke();
  ctx.fillStyle = "#8a2020";
  ctx.fillRect(-0.15, -0.1, 0.9, 0.2);

  const barrelStart = 0.5;
  const barrelL = 2.3;
  const barrelW = 0.55;
  ctx.fillStyle = "#181818";
  ctx.fillRect(barrelStart, -barrelW / 2, barrelL, barrelW);
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(barrelStart, -barrelW / 2, barrelL, 0.08);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(barrelStart + barrelL - 0.25, -barrelW / 2 - 0.1, 0.25, barrelW + 0.2);

  const muzzleX = barrelStart + barrelL;
  const muzzleGlowR = 0.45 + 0.35 * charge;
  ctx.fillStyle = `rgba(255, ${120 + charge * 100}, ${30 + charge * 70}, ${0.2 + 0.7 * charge})`;
  ctx.beginPath();
  ctx.arc(muzzleX, 0, muzzleGlowR, 0, Math.PI * 2);
  ctx.fill();
  if (charge > 0.01) {
    ctx.fillStyle = `rgba(255, 220, 160, ${charge * 0.9})`;
    ctx.beginPath();
    ctx.arc(muzzleX, 0, 0.22 + 0.15 * charge, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#050505";
  ctx.beginPath();
  ctx.arc(muzzleX, 0, 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMissileLauncher(
  ctx: CanvasRenderingContext2D,
  aim: number,
  charge: number,
) {
  const baseW = 2.9;
  const baseH = 2.5;

  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(-baseW / 2, -baseH / 2, baseW, baseH);

  const stripeW = 0.3;
  for (let x = -baseW / 2 + 0.05; x < baseW / 2 - 0.05; x += stripeW * 2) {
    ctx.fillStyle = COLOR_MISSILE;
    ctx.fillRect(x, -baseH / 2 + 0.05, Math.min(stripeW, baseW / 2 - 0.05 - x), 0.2);
    ctx.fillRect(x, baseH / 2 - 0.25, Math.min(stripeW, baseW / 2 - 0.05 - x), 0.2);
  }

  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(-baseW / 2 + 0.3, -baseH / 2 + 0.35, baseW - 0.6, baseH - 0.7);

  const radarR = 0.22;
  const radarHot = charge > 0.4;
  ctx.fillStyle = radarHot
    ? `rgba(255, ${140 - charge * 60}, ${40}, ${0.7 + 0.3 * charge})`
    : "rgba(140, 200, 255, 0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, radarR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 0.06;
  ctx.stroke();

  ctx.save();
  ctx.rotate(aim);

  const pivotR = 0.5;
  ctx.fillStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.arc(0, 0, pivotR, 0, Math.PI * 2);
  ctx.fill();

  const tubeL = 1.4;
  const tubeW = 0.4;
  const offsets = [-0.6, 0, 0.6];
  for (const offset of offsets) {
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(0.25, offset - tubeW / 2, tubeL, tubeW);
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 0.06;
    ctx.strokeRect(0.25, offset - tubeW / 2, tubeL, tubeW);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0.25, offset - 0.04, tubeL, 0.08);

    const tipX = 0.25 + tubeL;
    const tipLen = 0.4;
    const hot = charge > 0.3;
    ctx.fillStyle = hot
      ? `rgba(255, ${140 + charge * 60}, ${50 - charge * 30}, 1)`
      : "#bbb";
    ctx.beginPath();
    ctx.moveTo(tipX, offset - tubeW / 2 + 0.05);
    ctx.lineTo(tipX + tipLen, offset);
    ctx.lineTo(tipX, offset + tubeW / 2 - 0.05);
    ctx.closePath();
    ctx.fill();

    if (charge > 0.5) {
      ctx.fillStyle = `rgba(255, 200, 120, ${(charge - 0.5) * 1.2})`;
      ctx.beginPath();
      ctx.arc(tipX + tipLen * 0.5, offset, 0.18 + 0.1 * charge, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawPanel(ctx: CanvasRenderingContext2D, left: number) {
  ctx.fillStyle = COLOR_PANEL;
  ctx.fillRect(left, -PANEL_H / 2, PANEL_W, PANEL_H);
  ctx.strokeStyle = COLOR_PANEL_GRID;
  ctx.lineWidth = PANEL_LINE_W;
  for (let i = 1; i < PANEL_CELLS; i++) {
    const lx = left + (PANEL_W * i) / PANEL_CELLS;
    ctx.beginPath();
    ctx.moveTo(lx, -PANEL_H / 2);
    ctx.lineTo(lx, PANEL_H / 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(left, 0);
  ctx.lineTo(left + PANEL_W, 0);
  ctx.stroke();
}

function drawTransmissionNode(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLOR_TX_DISH;
  ctx.beginPath();
  ctx.arc(0, -TX_DISH_OFFSET, TX_DISH_R, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLOR_TX_DISH_RIM;
  ctx.lineWidth = TX_DISH_RIM_W;
  ctx.stroke();

  ctx.fillStyle = COLOR_TX_BODY;
  ctx.fillRect(-TX_BODY_W / 2, -TX_BODY_H / 2, TX_BODY_W, TX_BODY_H);

  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 400);
  ctx.fillStyle = COLOR_TX_PULSE;
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(0, 0, TX_PULSE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
