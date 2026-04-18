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
const OUTLINE_W = 0.1;

const COLOR_ARM = "#888";
const COLOR_BODY = "#bbb";
const COLOR_SOLAR_STRIP = "#444";
const COLOR_PANEL = "#1a3a6e";
const COLOR_PANEL_GRID = "#4a7fc8";
const COLOR_OUTLINE = "#0f0";
const COLOR_ANTENNA = "#888";

export function draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = COLOR_ARM;
  ctx.fillRect(-BODY_W / 2 - ARM_LEN, -ARM_THICKNESS / 2, ARM_LEN, ARM_THICKNESS);
  ctx.fillRect(BODY_W / 2, -ARM_THICKNESS / 2, ARM_LEN, ARM_THICKNESS);

  for (const side of [-1, 1] as const) {
    const panelLeft =
      side === 1 ? BODY_W / 2 + ARM_LEN : -BODY_W / 2 - ARM_LEN - PANEL_W;
    drawPanel(ctx, panelLeft);
  }

  ctx.fillStyle = COLOR_BODY;
  ctx.fillRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H);
  ctx.fillStyle = COLOR_SOLAR_STRIP;
  ctx.fillRect(
    -BODY_W / 2 + SOLAR_STRIP_INSET,
    -BODY_H / 2 + SOLAR_STRIP_INSET,
    BODY_W - SOLAR_STRIP_INSET * 2,
    SOLAR_STRIP_H,
  );
  ctx.strokeStyle = COLOR_OUTLINE;
  ctx.lineWidth = OUTLINE_W;
  ctx.strokeRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H);

  ctx.fillStyle = COLOR_ANTENNA;
  ctx.fillRect(-ARM_THICKNESS / 2, -BODY_H / 2 - ANTENNA_H, ARM_THICKNESS, ANTENNA_H);
  ctx.beginPath();
  ctx.arc(0, -BODY_H / 2 - ANTENNA_H - ANTENNA_DISH_R * 0.6, ANTENNA_DISH_R, 0, Math.PI * 2);
  ctx.fill();

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
