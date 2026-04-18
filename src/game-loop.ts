import { assert } from "./assert";

// easy way to test if simulation is framerate indepedent
// 0 uses requestAnimationFrame, otherwise fixed timestep
const FIXED_FPS = 0;

// cap so a backgrounded tab doesn't teleport entities through walls
const MAX_DT = 100;

export function startLoop(
  canvas: HTMLCanvasElement,
  tick: (ctx: CanvasRenderingContext2D, dt: number) => void,
): () => void {
  let lastTime = performance.now();
  let stopped = false;

  const runStep = () => {
    const now = performance.now();
    const dt = Math.min(now - lastTime, MAX_DT);
    lastTime = now;

    const canvasRect = canvas.getBoundingClientRect();
    canvas.width = canvasRect.width * devicePixelRatio;
    canvas.height = canvasRect.height * devicePixelRatio;

    const ctx = canvas.getContext("2d");
    assert(ctx);
    ctx.scale(devicePixelRatio, devicePixelRatio);

    tick(ctx, dt);
  };

  if (FIXED_FPS) {
    const handle = setInterval(() => {
      if (stopped) return;
      runStep();
    }, 1000 / FIXED_FPS);
    return () => {
      stopped = true;
      clearInterval(handle);
    };
  }

  const raf = () => {
    if (stopped) return;
    runStep();
    requestAnimationFrame(raf);
  };
  raf();
  return () => {
    stopped = true;
  };
}
