export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function expDecay(a: number, b: number, t: number): number {
  return a * Math.exp(-t) + b * (1 - Math.exp(-t));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

export function pingPong(value: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;
  const wrapped = mod(value - min, range * 2);
  return min + (wrapped < range ? wrapped : range * 2 - wrapped);
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function segmentsIntersect(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
): boolean {
  const dx1 = ax2 - ax1;
  const dy1 = ay2 - ay1;
  const dx2 = bx2 - bx1;
  const dy2 = by2 - by1;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (denom === 0) return false;
  const t = ((bx1 - ax1) * dy2 - (by1 - ay1) * dx2) / denom;
  const u = ((bx1 - ax1) * dy1 - (by1 - ay1) * dx1) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function distPointSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

export function circleIntersectsSegment(
  cx: number,
  cy: number,
  r: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  return distPointSegmentSq(cx, cy, x1, y1, x2, y2) <= r * r;
}

function segmentIntersectsAabb(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true;
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;
  if (segmentsIntersect(x1, y1, x2, y2, minX, minY, maxX, minY)) return true;
  if (segmentsIntersect(x1, y1, x2, y2, maxX, minY, maxX, maxY)) return true;
  if (segmentsIntersect(x1, y1, x2, y2, maxX, maxY, minX, maxY)) return true;
  if (segmentsIntersect(x1, y1, x2, y2, minX, maxY, minX, minY)) return true;
  return false;
}

export function segmentIntersectsObb(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  angle: number,
  hw: number,
  hh: number,
): boolean {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx1 = x1 - cx;
  const dy1 = y1 - cy;
  const dx2 = x2 - cx;
  const dy2 = y2 - cy;
  const lx1 = dx1 * cos - dy1 * sin;
  const ly1 = dx1 * sin + dy1 * cos;
  const lx2 = dx2 * cos - dy2 * sin;
  const ly2 = dx2 * sin + dy2 * cos;
  return segmentIntersectsAabb(lx1, ly1, lx2, ly2, -hw, -hh, hw, hh);
}

export function circleOverlapsObb(
  cx: number,
  cy: number,
  r: number,
  ox: number,
  oy: number,
  angle: number,
  hw: number,
  hh: number,
): boolean {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx = cx - ox;
  const dy = cy - oy;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const clx = lx < -hw ? -hw : lx > hw ? hw : lx;
  const cly = ly < -hh ? -hh : ly > hh ? hh : ly;
  const ddx = lx - clx;
  const ddy = ly - cly;
  return ddx * ddx + ddy * ddy <= r * r;
}

export function obbOverlapsObb(
  c1x: number,
  c1y: number,
  a1: number,
  hw1: number,
  hh1: number,
  c2x: number,
  c2y: number,
  a2: number,
  hw2: number,
  hh2: number,
): boolean {
  const cos1 = Math.cos(a1);
  const sin1 = Math.sin(a1);
  const cos2 = Math.cos(a2);
  const sin2 = Math.sin(a2);
  const tx = c2x - c1x;
  const ty = c2y - c1y;
  const axes: [number, number][] = [
    [cos1, sin1],
    [-sin1, cos1],
    [cos2, sin2],
    [-sin2, cos2],
  ];
  for (const [nx, ny] of axes) {
    const projT = Math.abs(tx * nx + ty * ny);
    const r1 =
      Math.abs(cos1 * hw1 * nx + sin1 * hw1 * ny) +
      Math.abs(-sin1 * hh1 * nx + cos1 * hh1 * ny);
    const r2 =
      Math.abs(cos2 * hw2 * nx + sin2 * hw2 * ny) +
      Math.abs(-sin2 * hh2 * nx + cos2 * hh2 * ny);
    if (projT > r1 + r2) return false;
  }
  return true;
}

// Returns t in [0,1] along segment A where it first hits segment B, or Infinity.
export function segmentIntersectT(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
): number {
  const dx1 = ax2 - ax1;
  const dy1 = ay2 - ay1;
  const dx2 = bx2 - bx1;
  const dy2 = by2 - by1;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (denom === 0) return Infinity;
  const t = ((bx1 - ax1) * dy2 - (by1 - ay1) * dx2) / denom;
  const u = ((bx1 - ax1) * dy1 - (by1 - ay1) * dx1) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return Infinity;
  return t;
}
