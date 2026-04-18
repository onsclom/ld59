import { segmentsIntersect } from "./game-math";
import * as Player from "./player";
import * as Satellite from "./satellite";

export type Wall = { x1: number; y1: number; x2: number; y2: number };
export type Point = { x: number; y: number };

export function create() {
  return {
    walls: [] as Wall[],
    satellites: [] as Satellite.Satellite[],
    perimeter: null as Point[] | null,
    dirty: true,
  };
}

type Level = ReturnType<typeof create>;
type PlayerT = ReturnType<typeof Player.create>;

export function addWall(level: Level, wall: Wall) {
  level.walls.push(wall);
  level.dirty = true;
}

export function removeWallAt(level: Level, idx: number) {
  level.walls.splice(idx, 1);
  level.dirty = true;
}

export function addSatellite(level: Level, sat: Satellite.Satellite) {
  level.satellites.push(sat);
}

export function removeSatelliteAt(level: Level, idx: number) {
  level.satellites.splice(idx, 1);
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

export function fillOutside(level: Level, ctx: CanvasRenderingContext2D) {
  const poly = getPerimeter(level);
  if (!poly || poly.length < 3) return;
  ctx.fillStyle = "blue";
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
  for (const sat of level.satellites) {
    Satellite.draw(ctx, sat);
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
