import * as Camera from "./camera";
import * as Input from "./input";
import * as Level from "./level";
import * as Player from "./player";
import * as Satellite from "./satellite";

const MOVE_SPEED = 0.05;
const GRID_SIZE = 10;
const DELETE_RADIUS = 2;
const SATELLITE_DELETE_RADIUS = 2.5;
const VERTEX_GRAB_RADIUS = 2;

type Mode = "wall" | Satellite.SatelliteType | "move";

const MODES: readonly Mode[] = ["wall", ...Satellite.TYPES, "move"];
const MODE_LABELS: Record<Mode, string> = {
  wall: "Wall",
  ...Satellite.TYPE_LABELS,
  move: "Move",
};

type DragTarget =
  | { kind: "satellite"; idx: number }
  | { kind: "vertex"; endpoints: { idx: number; which: 1 | 2 }[] };

export function create() {
  return {
    active: false,
    cameraX: 0,
    cameraY: 0,
    pendingStart: null as { x: number; y: number } | null,
    mode: "wall" as Mode,
    drag: null as DragTarget | null,
  };
}

type EditState = ReturnType<typeof create>;
type LevelT = ReturnType<typeof Level.create>;
type CameraT = ReturnType<typeof Camera.create>;
type PlayerT = ReturnType<typeof Player.create>;

function snap(v: number, size: number) {
  return Math.round(v / size) * size;
}

function cursorWorld(canvasRect: DOMRect, camera: CameraT) {
  const world = Camera.screenToWorld(
    Input.mouse.x,
    Input.mouse.y,
    canvasRect,
    camera,
  );
  return { x: snap(world.x, GRID_SIZE), y: snap(world.y, GRID_SIZE) };
}

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function nearestWallIndex(level: LevelT, x: number, y: number, maxDist: number) {
  let best = -1;
  let bestDist = maxDist;
  for (let i = 0; i < level.walls.length; i++) {
    const w = level.walls[i]!;
    const d = pointToSegmentDist(x, y, w.x1, w.y1, w.x2, w.y2);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function nearestVertex(
  level: LevelT,
  x: number,
  y: number,
  maxDist: number,
): { x: number; y: number } | null {
  let bestDist = maxDist;
  let best: { x: number; y: number } | null = null;
  for (const w of level.walls) {
    const d1 = Math.hypot(x - w.x1, y - w.y1);
    if (d1 < bestDist) {
      bestDist = d1;
      best = { x: w.x1, y: w.y1 };
    }
    const d2 = Math.hypot(x - w.x2, y - w.y2);
    if (d2 < bestDist) {
      bestDist = d2;
      best = { x: w.x2, y: w.y2 };
    }
  }
  return best;
}

function collectEndpointsAt(
  level: LevelT,
  x: number,
  y: number,
): { idx: number; which: 1 | 2 }[] {
  const out: { idx: number; which: 1 | 2 }[] = [];
  for (let i = 0; i < level.walls.length; i++) {
    const w = level.walls[i]!;
    if (w.x1 === x && w.y1 === y) out.push({ idx: i, which: 1 });
    if (w.x2 === x && w.y2 === y) out.push({ idx: i, which: 2 });
  }
  return out;
}

export function update(
  edit: EditState,
  level: LevelT,
  player: PlayerT,
  camera: CameraT,
  canvasRect: DOMRect,
  dt: number,
) {
  if (!edit.active) return;

  for (let i = 0; i < MODES.length; i++) {
    if (Input.keysJustPressed.has(String(i + 1))) {
      edit.mode = MODES[i]!;
      edit.pendingStart = null;
      edit.drag = null;
    }
  }

  let dx = 0;
  let dy = 0;
  if (Input.keysDown.has("a") || Input.keysDown.has("ArrowLeft")) dx -= 1;
  if (Input.keysDown.has("d") || Input.keysDown.has("ArrowRight")) dx += 1;
  if (Input.keysDown.has("w") || Input.keysDown.has("ArrowUp")) dy -= 1;
  if (Input.keysDown.has("s") || Input.keysDown.has("ArrowDown")) dy += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    edit.cameraX += (dx / len) * MOVE_SPEED * dt;
    edit.cameraY += (dy / len) * MOVE_SPEED * dt;
  }
  camera.x = edit.cameraX;
  camera.y = edit.cameraY;
  player.x = edit.cameraX;
  player.y = edit.cameraY;
  player.vx = 0;
  player.vy = 0;
  player.alive = true;

  if (Input.keysJustPressed.has("Escape")) {
    edit.pendingStart = null;
    edit.drag = null;
  }

  if (edit.mode === "wall") {
    if (Input.mouse.justLeftClicked && Input.mouse.onCanvas) {
      edit.pendingStart = cursorWorld(canvasRect, camera);
    }
    if (Input.mouse.justLeftReleased && edit.pendingStart) {
      const c = cursorWorld(canvasRect, camera);
      if (c.x !== edit.pendingStart.x || c.y !== edit.pendingStart.y) {
        Level.addWall(level, {
          x1: edit.pendingStart.x,
          y1: edit.pendingStart.y,
          x2: c.x,
          y2: c.y,
        });
      }
      edit.pendingStart = null;
    }
  } else if (edit.mode === "move") {
    if (Input.mouse.justLeftClicked && Input.mouse.onCanvas) {
      const world = Camera.screenToWorld(
        Input.mouse.x,
        Input.mouse.y,
        canvasRect,
        camera,
      );
      const satIdx = Level.nearestSatelliteIndex(
        level,
        world.x,
        world.y,
        SATELLITE_DELETE_RADIUS,
      );
      if (satIdx >= 0) {
        edit.drag = { kind: "satellite", idx: satIdx };
      } else {
        const v = nearestVertex(level, world.x, world.y, VERTEX_GRAB_RADIUS);
        if (v) {
          edit.drag = {
            kind: "vertex",
            endpoints: collectEndpointsAt(level, v.x, v.y),
          };
        }
      }
    }
    if (edit.drag && Input.mouse.leftClickDown) {
      const c = cursorWorld(canvasRect, camera);
      if (edit.drag.kind === "satellite") {
        const s = level.satellites[edit.drag.idx]!;
        s.x = c.x;
        s.y = c.y;
      } else {
        for (const ep of edit.drag.endpoints) {
          const w = level.walls[ep.idx]!;
          if (ep.which === 1) {
            w.x1 = c.x;
            w.y1 = c.y;
          } else {
            w.x2 = c.x;
            w.y2 = c.y;
          }
        }
        level.dirty = true;
      }
    }
    if (Input.mouse.justLeftReleased && edit.drag) {
      Level.resetDynamic(level);
      edit.drag = null;
    }
  } else {
    if (Input.mouse.justLeftClicked && Input.mouse.onCanvas) {
      const c = cursorWorld(canvasRect, camera);
      Level.addSatellite(level, Satellite.create(c.x, c.y, edit.mode));
    }
  }

  if (Input.mouse.rightClickDown && Input.mouse.onCanvas) {
    const world = Camera.screenToWorld(
      Input.mouse.x,
      Input.mouse.y,
      canvasRect,
      camera,
    );
    const wallIdx = nearestWallIndex(level, world.x, world.y, DELETE_RADIUS);
    const satIdx = Level.nearestSatelliteIndex(
      level,
      world.x,
      world.y,
      SATELLITE_DELETE_RADIUS,
    );
    if (satIdx >= 0) Level.removeSatelliteAt(level, satIdx);
    else if (wallIdx >= 0) Level.removeWallAt(level, wallIdx);
  }
}

export function drawWorld(
  edit: EditState,
  level: LevelT,
  ctx: CanvasRenderingContext2D,
  canvasRect: DOMRect,
  camera: CameraT,
) {
  if (!edit.active) return;
  const c = cursorWorld(canvasRect, camera);
  const world = Camera.screenToWorld(
    Input.mouse.x,
    Input.mouse.y,
    canvasRect,
    camera,
  );

  const hoverWallIdx = nearestWallIndex(level, world.x, world.y, DELETE_RADIUS);
  const hoverSatIdx = Level.nearestSatelliteIndex(
    level,
    world.x,
    world.y,
    SATELLITE_DELETE_RADIUS,
  );

  if (edit.mode === "move") {
    const seen = new Set<string>();
    ctx.fillStyle = "rgba(255, 220, 60, 0.8)";
    for (const w of level.walls) {
      for (const p of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        const k = `${p.x}|${p.y}`;
        if (seen.has(k)) continue;
        seen.add(k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (edit.drag?.kind === "satellite") {
      const s = level.satellites[edit.drag.idx]!;
      ctx.strokeStyle = "#ff0";
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, SATELLITE_DELETE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    } else if (hoverSatIdx >= 0) {
      const s = level.satellites[hoverSatIdx]!;
      ctx.strokeStyle = "#ff0";
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, SATELLITE_DELETE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const hv = nearestVertex(level, world.x, world.y, VERTEX_GRAB_RADIUS);
      if (hv) {
        ctx.strokeStyle = "#ff0";
        ctx.lineWidth = 0.2;
        ctx.beginPath();
        ctx.arc(hv.x, hv.y, 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (hoverSatIdx >= 0) {
    const s = level.satellites[hoverSatIdx]!;
    ctx.strokeStyle = "#f44";
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, SATELLITE_DELETE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  } else if (hoverWallIdx >= 0) {
    const w = level.walls[hoverWallIdx]!;
    ctx.strokeStyle = "#f44";
    ctx.lineWidth = 0.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }

  if (edit.mode === "wall") {
    if (edit.pendingStart) {
      ctx.strokeStyle = "#0f0";
      ctx.lineWidth = 0.3;
      ctx.setLineDash([1, 1]);
      ctx.beginPath();
      ctx.moveTo(edit.pendingStart.x, edit.pendingStart.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#0f0";
      ctx.beginPath();
      ctx.arc(edit.pendingStart.x, edit.pendingStart.y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "#0f0";
    ctx.lineWidth = 0.15;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 0.8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (edit.mode !== "move") {
    ctx.globalAlpha = 0.5;
    Satellite.draw(ctx, { x: c.x, y: c.y, type: edit.mode });
    ctx.globalAlpha = 1;
  }
}

const HOTBAR_X = 10;
const HOTBAR_Y_FROM_BOTTOM = 60;
const HOTBAR_SLOT_W = 150;
const HOTBAR_SLOT_H = 40;
const HOTBAR_GAP = 6;

export function drawHUD(edit: EditState, ctx: CanvasRenderingContext2D) {
  if (!edit.active) return;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(10, 10, 260, 200);
  ctx.fillStyle = "#0f0";
  ctx.font = "14px monospace";
  const lines = [
    "EDIT MODE",
    "Shift     exit",
    "WASD      fly (noclip)",
    "Q / E     prev / next level",
    "Cmd+S     save levels",
    "1-6       select tool",
    "L-Click   place / drag",
    "R-Hold    delete",
    "Esc       cancel pending",
  ];
  let y = 30;
  for (const line of lines) {
    ctx.fillText(line, 20, y);
    y += 20;
  }

  const rect = ctx.canvas.getBoundingClientRect();
  const baseY = rect.height - HOTBAR_Y_FROM_BOTTOM;
  for (let i = 0; i < MODES.length; i++) {
    const m = MODES[i]!;
    const x = HOTBAR_X + i * (HOTBAR_SLOT_W + HOTBAR_GAP);
    const active = m === edit.mode;
    ctx.fillStyle = active ? "rgba(0,255,0,0.18)" : "rgba(0,0,0,0.7)";
    ctx.fillRect(x, baseY, HOTBAR_SLOT_W, HOTBAR_SLOT_H);
    ctx.strokeStyle = active ? "#0f0" : "#444";
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(x, baseY, HOTBAR_SLOT_W, HOTBAR_SLOT_H);

    const swatchColor =
      m === "wall" ? "#fff" : m === "move" ? "#ff0" : Satellite.TYPE_COLORS[m];
    ctx.fillStyle = swatchColor;
    ctx.fillRect(x + 8, baseY + 10, 20, 20);

    ctx.fillStyle = active ? "#0f0" : "#aaa";
    ctx.font = "12px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(`${i + 1}`, x + 34, baseY + 6);
    ctx.fillText(MODE_LABELS[m], x + 34, baseY + 22);
  }
  ctx.restore();
}
