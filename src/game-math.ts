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
