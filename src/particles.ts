type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  r: number;
  g: number;
  b: number;
};

export function create(capacity = 1024) {
  const particles: Particle[] = new Array(capacity);
  for (let i = 0; i < capacity; i++) {
    particles[i] = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 0,
      size: 0,
      r: 0,
      g: 0,
      b: 0,
    };
  }
  return { particles, next: 0 };
}

type ParticleSystem = ReturnType<typeof create>;

export function emit(
  system: ParticleSystem,
  args: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
    r: number;
    g: number;
    b: number;
  },
) {
  const p = system.particles[system.next]!;
  p.x = args.x;
  p.y = args.y;
  p.vx = args.vx;
  p.vy = args.vy;
  p.age = 0;
  p.life = args.life;
  p.size = args.size;
  p.r = args.r;
  p.g = args.g;
  p.b = args.b;
  system.next = (system.next + 1) % system.particles.length;
}

export function update(system: ParticleSystem, dt: number) {
  for (const p of system.particles) {
    if (p.life <= 0) continue;
    p.age += dt;
    if (p.age >= p.life) {
      p.life = 0;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function draw(system: ParticleSystem, ctx: CanvasRenderingContext2D) {
  for (const p of system.particles) {
    if (p.life <= 0) continue;
    const t = p.age / p.life;
    ctx.fillStyle = `rgb(${p.r | 0}, ${p.g | 0}, ${p.b | 0})`;
    const size = p.size * (1 - t);
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}
