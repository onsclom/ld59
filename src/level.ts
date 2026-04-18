import { segmentIntersectT, segmentsIntersect } from "./game-math";
import * as Player from "./player";
import * as Satellite from "./satellite";

export type Wall = { x1: number; y1: number; x2: number; y2: number };
export type Point = { x: number; y: number };
export type LevelData = {
  walls: Wall[];
  satellites: Satellite.Satellite[];
};

export const NODE_RADIUS = 10;
export const NODE_COMPLETE_TIME_MS = 1500;

function createDynamic() {
  return {
    nodeProgress: {} as Record<number, number>,
    completedNodes: new Set<number>(),
    won: false,
    activeInhibitors: new Set<number>(),
    statusEffects: Player.createEffects(),
  };
}

export function create() {
  return {
    walls: [] as Wall[],
    satellites: [] as Satellite.Satellite[],
    perimeter: null as Point[] | null,
    dirty: true,
    dynamic: createDynamic(),
  };
}

type Level = ReturnType<typeof create>;
type PlayerT = ReturnType<typeof Player.create>;

export function resetDynamic(level: Level) {
  level.dynamic = createDynamic();
}

export function toData(level: Level): LevelData {
  return {
    walls: level.walls.map((w) => ({ ...w })),
    satellites: level.satellites.map((s) => ({ ...s })),
  };
}

export function fromData(data: LevelData): Level {
  const level = create();
  level.walls = data.walls.map((w) => ({ ...w }));
  level.satellites = data.satellites.map((s) => ({ ...s }));
  level.dirty = true;
  return level;
}

export function addWall(level: Level, wall: Wall) {
  level.walls.push(wall);
  level.dirty = true;
  resetDynamic(level);
}

export function removeWallAt(level: Level, idx: number) {
  level.walls.splice(idx, 1);
  level.dirty = true;
  resetDynamic(level);
}

export function addSatellite(level: Level, sat: Satellite.Satellite) {
  level.satellites.push(sat);
  resetDynamic(level);
}

export function removeSatelliteAt(level: Level, idx: number) {
  level.satellites.splice(idx, 1);
  resetDynamic(level);
}

function vkey(x: number, y: number) {
  return `${x}|${y}`;
}

type Vertex = { pos: Point; neighbors: Set<string> };

function computePerimeter(walls: Wall[]): Point[] | null {
  if (walls.length < 3) return null;

  const vertices = new Map<string, Vertex>();
  for (const w of walls) {
    if (w.x1 === w.x2 && w.y1 === w.y2) continue;
    const k1 = vkey(w.x1, w.y1);
    const k2 = vkey(w.x2, w.y2);
    let v1 = vertices.get(k1);
    if (!v1) {
      v1 = { pos: { x: w.x1, y: w.y1 }, neighbors: new Set() };
      vertices.set(k1, v1);
    }
    let v2 = vertices.get(k2);
    if (!v2) {
      v2 = { pos: { x: w.x2, y: w.y2 }, neighbors: new Set() };
      vertices.set(k2, v2);
    }
    v1.neighbors.add(k2);
    v2.neighbors.add(k1);
  }

  if (vertices.size < 3) return null;

  let startKey: string | null = null;
  let startPos: Point = { x: 0, y: 0 };
  for (const [k, v] of vertices) {
    if (
      startKey === null ||
      v.pos.y > startPos.y ||
      (v.pos.y === startPos.y && v.pos.x < startPos.x)
    ) {
      startKey = k;
      startPos = v.pos;
    }
  }
  if (startKey === null) return null;

  const polygon: Point[] = [];
  const seen = new Set<string>();
  let currKey: string = startKey;
  let prevKey: string | null = null;
  let backAngle = Math.PI / 2;
  const maxSteps = walls.length * 2 + 8;

  for (let step = 0; step < maxSteps; step++) {
    const curr = vertices.get(currKey)!;
    polygon.push(curr.pos);

    let bestKey: string | null = null;
    let bestDelta = Infinity;
    for (const nk of curr.neighbors) {
      if (nk === prevKey) continue;
      const np = vertices.get(nk)!.pos;
      const angle = Math.atan2(np.y - curr.pos.y, np.x - curr.pos.x);
      let delta = backAngle - angle;
      while (delta <= 0) delta += Math.PI * 2;
      while (delta > Math.PI * 2) delta -= Math.PI * 2;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestKey = nk;
      }
    }
    if (bestKey === null) return null;

    const nextPos = vertices.get(bestKey)!.pos;
    backAngle = Math.atan2(curr.pos.y - nextPos.y, curr.pos.x - nextPos.x);
    prevKey = currKey;
    currKey = bestKey;

    if (currKey === startKey) {
      if (polygon.length < 3) return null;
      let area2 = 0;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i]!;
        const b = polygon[(i + 1) % polygon.length]!;
        area2 += a.x * b.y - b.x * a.y;
      }
      if (area2 === 0) return null;
      return polygon;
    }
    if (seen.has(currKey)) return null;
    seen.add(currKey);
  }

  return null;
}

export function getPerimeter(level: Level): Point[] | null {
  if (level.dirty) {
    level.perimeter = computePerimeter(level.walls);
    level.dirty = false;
  }
  return level.perimeter;
}

export function hitsPlayer(level: Level, player: PlayerT) {
  const c = Player.corners(player);
  for (const w of level.walls) {
    for (let i = 0; i < 4; i++) {
      const a = c[i]!;
      const b = c[(i + 1) % 4]!;
      if (segmentsIntersect(a.x, a.y, b.x, b.y, w.x1, w.y1, w.x2, w.y2)) {
        return true;
      }
    }
  }
  return false;
}

function losClear(
  level: Level,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  for (const w of level.walls) {
    if (segmentsIntersect(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2)) return false;
  }
  return true;
}

function nodeIndices(level: Level): number[] {
  const out: number[] = [];
  for (let i = 0; i < level.satellites.length; i++) {
    if (level.satellites[i]!.type === "transmission-node") out.push(i);
  }
  return out;
}

export function totalNodes(level: Level) {
  return nodeIndices(level).length;
}

export function remainingNodes(level: Level) {
  return totalNodes(level) - level.dynamic.completedNodes.size;
}

export function anyTransmitting(level: Level) {
  for (const i of nodeIndices(level)) {
    if (level.dynamic.completedNodes.has(i)) continue;
    if ((level.dynamic.nodeProgress[i] ?? 0) > 0) return true;
  }
  return false;
}

export function computeStatus(level: Level, player: PlayerT, enabled: boolean) {
  level.dynamic.activeInhibitors.clear();
  const e = level.dynamic.statusEffects;
  Player.clearEffects(e);
  if (!enabled || !player.alive || level.dynamic.won) return;
  for (let i = 0; i < level.satellites.length; i++) {
    const sat = level.satellites[i]!;
    if (sat.type === "transmission-node") continue;
    if (!losClear(level, player.x, player.y, sat.x, sat.y)) continue;
    level.dynamic.activeInhibitors.add(i);
    if (sat.type === "thrust-inhibitor") e.thrustDisabled = true;
    else if (sat.type === "turn-inhibitor") e.turnDisabled = true;
    else if (sat.type === "control-reverser") e.controlsReversed = true;
  }
}

export function update(level: Level, player: PlayerT, dt: number) {
  if (!player.alive || level.dynamic.won) return;
  const indices = nodeIndices(level);
  for (const i of indices) {
    if (level.dynamic.completedNodes.has(i)) continue;
    const sat = level.satellites[i]!;
    const d = Math.hypot(player.x - sat.x, player.y - sat.y);
    const transmitting =
      d <= NODE_RADIUS && losClear(level, player.x, player.y, sat.x, sat.y);
    if (transmitting) {
      const next = (level.dynamic.nodeProgress[i] ?? 0) + dt;
      level.dynamic.nodeProgress[i] = next;
      if (next >= NODE_COMPLETE_TIME_MS) level.dynamic.completedNodes.add(i);
    } else {
      level.dynamic.nodeProgress[i] = 0;
    }
  }
  if (
    indices.length > 0 &&
    level.dynamic.completedNodes.size === indices.length
  ) {
    level.dynamic.won = true;
  }
}

const CHECKER_CELL = 5;
let checkerPattern: CanvasPattern | null = null;
function getCheckerPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (checkerPattern) return checkerPattern;
  const PX_PER_UNIT = 16;
  const tile = document.createElement("canvas");
  const cellPx = CHECKER_CELL * PX_PER_UNIT;
  tile.width = cellPx * 2;
  tile.height = cellPx * 2;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  tctx.fillStyle = "#bdbdbd";
  tctx.fillRect(0, 0, cellPx * 2, cellPx * 2);
  tctx.fillStyle = "#9e9e9e";
  tctx.fillRect(0, 0, cellPx, cellPx);
  tctx.fillRect(cellPx, cellPx, cellPx, cellPx);
  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return null;
  // Pattern source is 2*cellPx pixels wide but represents 2*CHECKER_CELL world
  // units. Scale the pattern so 1 source pixel = 1 / PX_PER_UNIT world units,
  // making the pattern tile in world coordinates (so it translates/scales with
  // the camera).
  pat.setTransform(new DOMMatrix().scale(1 / PX_PER_UNIT, 1 / PX_PER_UNIT));
  checkerPattern = pat;
  return pat;
}

export function fillOutside(level: Level, ctx: CanvasRenderingContext2D) {
  const poly = getPerimeter(level);
  if (!poly || poly.length < 3) return;
  const pat = getCheckerPattern(ctx);
  ctx.fillStyle = pat ?? "#bdbdbd";
  ctx.beginPath();
  ctx.rect(-1e6, -1e6, 2e6, 2e6);
  ctx.moveTo(poly[0]!.x, poly[0]!.y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
  ctx.closePath();
  ctx.fill("evenodd");
}

export function draw(level: Level, ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "white";
  ctx.lineWidth = 0.4;
  ctx.lineCap = "round";
  for (const w of level.walls) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }
  for (let i = 0; i < level.satellites.length; i++) {
    const sat = level.satellites[i]!;
    const faded =
      sat.type === "transmission-node" && level.dynamic.completedNodes.has(i);
    if (faded) ctx.globalAlpha = 0.25;
    Satellite.draw(ctx, sat, !faded);
    if (faded) ctx.globalAlpha = 1;
  }
}

const NODE_RING_COLOR = "rgba(74, 224, 160, 0.35)";
const NODE_PROGRESS_COLOR = "#9cffcf";
const NODE_LINK_COLOR = "rgba(156, 255, 207, 0.85)";

export function drawTransmissionFX(
  level: Level,
  player: PlayerT,
  ctx: CanvasRenderingContext2D,
) {
  for (let i = 0; i < level.satellites.length; i++) {
    const sat = level.satellites[i]!;
    if (sat.type !== "transmission-node") continue;
    const completed = level.dynamic.completedNodes.has(i);
    if (completed) continue;

    ctx.strokeStyle = NODE_RING_COLOR;
    ctx.lineWidth = 0.15;
    ctx.setLineDash([0.6, 0.6]);
    ctx.beginPath();
    ctx.arc(sat.x, sat.y, NODE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const progress = level.dynamic.nodeProgress[i] ?? 0;
    if (progress > 0) {
      const frac = Math.min(progress / NODE_COMPLETE_TIME_MS, 1);
      ctx.strokeStyle = NODE_PROGRESS_COLOR;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.arc(
        sat.x,
        sat.y,
        NODE_RADIUS,
        -Math.PI / 2,
        -Math.PI / 2 + frac * Math.PI * 2,
      );
      ctx.stroke();
    }

    if (!player.alive) continue;
    const d = Math.hypot(player.x - sat.x, player.y - sat.y);
    if (d <= NODE_RADIUS && losClear(level, player.x, player.y, sat.x, sat.y)) {
      ctx.strokeStyle = NODE_LINK_COLOR;
      ctx.lineWidth = 0.15;
      ctx.beginPath();
      ctx.moveTo(sat.x, sat.y);
      ctx.lineTo(player.x, player.y);
      ctx.stroke();
    }
  }
}

function firstWallHitT(
  level: Level,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  let best = Infinity;
  for (const w of level.walls) {
    const t = segmentIntersectT(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2);
    if (t < best) best = t;
  }
  return best;
}

const INHIBITOR_DOT_PERIOD = 1.2;
const INHIBITOR_DOT_SPEED = 0.006;

export function drawInhibitorFX(
  level: Level,
  player: PlayerT,
  ctx: CanvasRenderingContext2D,
) {
  if (!player.alive || level.dynamic.won) return;
  const now = performance.now();
  const phase =
    ((now * INHIBITOR_DOT_SPEED) % INHIBITOR_DOT_PERIOD +
      INHIBITOR_DOT_PERIOD) %
    INHIBITOR_DOT_PERIOD;

  for (let i = 0; i < level.satellites.length; i++) {
    const sat = level.satellites[i]!;
    if (sat.type === "transmission-node") continue;
    const color = Satellite.TYPE_COLORS[sat.type];
    const active = level.dynamic.activeInhibitors.has(i);

    const dx = player.x - sat.x;
    const dy = player.y - sat.y;
    const hitT = active
      ? 1
      : Math.min(1, firstWallHitT(level, sat.x, sat.y, player.x, player.y));
    const endX = sat.x + dx * hitT;
    const endY = sat.y + dy * hitT;
    const len = Math.hypot(endX - sat.x, endY - sat.y);
    if (len < 0.001) continue;
    const ux = (endX - sat.x) / len;
    const uy = (endY - sat.y) / len;

    ctx.save();

    if (active) {
      ctx.globalAlpha = 0.22 + 0.22 * Math.sin(now / 180);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sat.x, sat.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 0.08 : 0.05;
    ctx.globalAlpha = active ? 0.4 : 0.2;
    ctx.beginPath();
    ctx.moveTo(sat.x, sat.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const dotR = active ? 0.22 : 0.13;
    ctx.fillStyle = color;
    ctx.globalAlpha = active ? 0.95 : 0.55;
    for (let d = phase; d < len; d += INHIBITOR_DOT_PERIOD) {
      ctx.beginPath();
      ctx.arc(sat.x + ux * d, sat.y + uy * d, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!active && hitT < 1) {
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(endX, endY, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export function nearestSatelliteIndex(
  level: Level,
  x: number,
  y: number,
  maxDist: number,
) {
  let best = -1;
  let bestDist = maxDist;
  for (let i = 0; i < level.satellites.length; i++) {
    const s = level.satellites[i]!;
    const d = Math.hypot(x - s.x, y - s.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
