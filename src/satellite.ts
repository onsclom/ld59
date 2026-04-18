export type SatelliteType =
  | "turn-inhibitor"
  | "thrust-inhibitor"
  | "control-reverser"
  | "transmission-node";

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

export const TYPES: readonly SatelliteType[] = [
  "turn-inhibitor",
  "thrust-inhibitor",
  "control-reverser",
  "transmission-node",
];

export const TYPE_LABELS: Record<SatelliteType, string> = {
  "turn-inhibitor": "Turn Inhibitor",
  "thrust-inhibitor": "Thrust Inhibitor",
  "control-reverser": "Control Reverser",
  "transmission-node": "Transmission Node",
};

export const TYPE_COLORS: Record<SatelliteType, string> = {
  "turn-inhibitor": COLOR_TURN,
  "thrust-inhibitor": COLOR_THRUST,
  "control-reverser": COLOR_REVERSE,
  "transmission-node": COLOR_TX_BODY,
};

export function create(x: number, y: number, type: SatelliteType): Satellite {
  return { x, y, type };
}

export function draw(ctx: CanvasRenderingContext2D, sat: Satellite) {
  ctx.save();
  ctx.translate(sat.x, sat.y);
  if (sat.type === "transmission-node") drawTransmissionNode(ctx);
  else drawStandard(ctx, TYPE_COLORS[sat.type]);
  ctx.restore();
}

function drawStandard(ctx: CanvasRenderingContext2D, bodyColor: string) {
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
  ctx.fillStyle = COLOR_ANTENNA;
  ctx.fillRect(-ARM_THICKNESS / 2, -BODY_H / 2 - ANTENNA_H, ARM_THICKNESS, ANTENNA_H);
  ctx.beginPath();
  ctx.arc(0, -BODY_H / 2 - ANTENNA_H - ANTENNA_DISH_R * 0.6, ANTENNA_DISH_R, 0, Math.PI * 2);
  ctx.fill();
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
