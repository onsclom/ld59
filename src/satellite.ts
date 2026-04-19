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

const TX_HEX_R = 1.05;
const TX_RING_R = 1.7;
const TX_RING_W = 0.14;
const TX_RING_GAP = 0.28;
const TX_RING_SEGMENTS = 3;
const TX_RING_SPEED = 0.45;
const TX_PYLON_LEN = 0.55;
const TX_PYLON_W = 0.16;
const TX_CORE_R = 0.4;
const TX_PULSE_MAX_EXTRA = 1.3;

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
const COLOR_TX_CORE_BG = "#0a2820";
const COLOR_TX_BRIGHT = "#e8fff5";
const COLOR_TX_GLOW = "#9cffcf";
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
  const baseR = 1.5;

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

  const hazardOuter = 1.05;
  const hazardInner = 0.78;
  const segCount = 12;
  for (let i = 0; i < segCount; i++) {
    const a0 = (i / segCount) * Math.PI * 2;
    const a1 = ((i + 1) / segCount) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? COLOR_MISSILE : "#1a1a1a";
    ctx.beginPath();
    ctx.arc(0, 0, hazardOuter, a0, a1);
    ctx.arc(0, 0, hazardInner, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#1f1f1f";
  ctx.beginPath();
  ctx.arc(0, 0, hazardInner, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = baseR * 0.88;
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  const warnAlpha = 0.15 + 0.5 * charge;
  ctx.fillStyle = `rgba(255, ${90 + charge * 80}, ${40 + charge * 30}, ${warnAlpha})`;
  ctx.beginPath();
  ctx.arc(0, 0, 0.55 + 0.1 * charge, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(aim);

  const pivotR = 0.58;
  ctx.fillStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.arc(0, 0, pivotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5a5a5a";
  ctx.lineWidth = 0.06;
  ctx.stroke();

  const lensR = 0.18;
  const lensHot = charge > 0.4;
  ctx.fillStyle = lensHot
    ? `rgba(255, ${160 - charge * 60}, 50, 1)`
    : "rgba(140, 200, 255, 0.95)";
  ctx.beginPath();
  ctx.arc(pivotR * 0.45, 0, lensR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 0.04;
  ctx.stroke();

  const tubeL = 1.85;
  const tubeW = 0.48;
  const tubeStart = 0.18;
  const tubeOffset = 0.48;
  for (const offsetSign of [-1, 1] as const) {
    const offset = offsetSign * tubeOffset;

    ctx.fillStyle = "#323232";
    ctx.fillRect(tubeStart, offset - tubeW / 2, tubeL, tubeW);
    ctx.strokeStyle = "#5a5a5a";
    ctx.lineWidth = 0.05;
    ctx.strokeRect(tubeStart, offset - tubeW / 2, tubeL, tubeW);

    ctx.fillStyle = "#1d1d1d";
    ctx.fillRect(tubeStart, offset - tubeW / 2, tubeL, 0.07);
    ctx.fillRect(tubeStart, offset + tubeW / 2 - 0.07, tubeL, 0.07);

    ctx.fillStyle = "#1a1a1a";
    for (let b = 0; b < 3; b++) {
      const bx = tubeStart + 0.42 + b * 0.42;
      ctx.fillRect(bx, offset - tubeW / 2, 0.05, tubeW);
    }

    ctx.fillStyle = COLOR_MISSILE;
    ctx.fillRect(tubeStart + 0.1, offset - tubeW / 2 + 0.08, 0.1, tubeW - 0.16);

    const tipX = tubeStart + tubeL;
    const tipLen = 0.5;
    const hot = charge > 0.3;
    ctx.fillStyle = hot
      ? `rgba(255, ${140 + charge * 70}, 60, 1)`
      : "#bfbfbf";
    ctx.beginPath();
    ctx.moveTo(tipX, offset - tubeW / 2 + 0.06);
    ctx.lineTo(tipX + tipLen, offset);
    ctx.lineTo(tipX, offset + tubeW / 2 - 0.06);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = hot ? "#ffe8a0" : "#b02020";
    ctx.beginPath();
    ctx.arc(tipX + tipLen * 0.55, offset, 0.09, 0, Math.PI * 2);
    ctx.fill();

    if (charge > 0.5) {
      ctx.fillStyle = `rgba(255, 210, 140, ${(charge - 0.5) * 1.1})`;
      ctx.beginPath();
      ctx.arc(tipX + tipLen * 0.4, offset, 0.2 + 0.1 * charge, 0, Math.PI * 2);
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
  const t = performance.now() / 1000;

  const pulsePhase = (t * 0.65) % 1;
  const pulseR = TX_HEX_R + 0.1 + pulsePhase * TX_PULSE_MAX_EXTRA;
  ctx.strokeStyle = `rgba(156, 255, 207, ${(1 - pulsePhase) * 0.45})`;
  ctx.lineWidth = 0.1;
  ctx.beginPath();
  ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * (Math.PI * 2)) / 3;
    const ix = Math.cos(a) * TX_HEX_R;
    const iy = Math.sin(a) * TX_HEX_R;
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(a);
    ctx.fillStyle = COLOR_ANTENNA;
    ctx.fillRect(0, -TX_PYLON_W / 2, TX_PYLON_LEN, TX_PYLON_W);
    ctx.fillStyle = COLOR_TX_GLOW;
    ctx.beginPath();
    ctx.arc(TX_PYLON_LEN + 0.08, 0, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const ringRot = t * TX_RING_SPEED;
  const segArc = (Math.PI * 2) / TX_RING_SEGMENTS - TX_RING_GAP;
  ctx.strokeStyle = COLOR_TX_BODY;
  ctx.lineWidth = TX_RING_W;
  ctx.lineCap = "round";
  for (let i = 0; i < TX_RING_SEGMENTS; i++) {
    const segStart =
      ringRot + (i * Math.PI * 2) / TX_RING_SEGMENTS + TX_RING_GAP / 2;
    const segEnd = segStart + segArc;
    ctx.beginPath();
    ctx.arc(0, 0, TX_RING_R, segStart, segEnd);
    ctx.stroke();
    ctx.fillStyle = COLOR_TX_GLOW;
    ctx.beginPath();
    ctx.arc(Math.cos(segStart) * TX_RING_R, Math.sin(segStart) * TX_RING_R, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    const x = Math.cos(a) * TX_HEX_R;
    const y = Math.sin(a) * TX_HEX_R;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = COLOR_TX_CORE_BG;
  ctx.fill();
  ctx.strokeStyle = COLOR_TX_BODY;
  ctx.lineWidth = 0.12;
  ctx.stroke();

  ctx.strokeStyle = "rgba(74, 224, 160, 0.6)";
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, TX_CORE_R * 1.5, 0, Math.PI * 2);
  ctx.stroke();

  const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
  const glowR = TX_CORE_R + 0.15 * pulse;
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
  grad.addColorStop(0, "rgba(232, 255, 245, 0.95)");
  grad.addColorStop(0.45, "rgba(156, 255, 207, 0.7)");
  grad.addColorStop(1, "rgba(74, 224, 160, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLOR_TX_BRIGHT;
  ctx.beginPath();
  ctx.arc(0, 0, 0.14 + 0.04 * pulse, 0, Math.PI * 2);
  ctx.fill();
}
