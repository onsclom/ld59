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
