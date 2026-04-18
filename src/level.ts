import { segmentsIntersect } from "./game-math";
import * as Player from "./player";

export type Wall = { x1: number; y1: number; x2: number; y2: number };

export function create() {
  return {
    walls: [] as Wall[],
  };
}

type Level = ReturnType<typeof create>;
type PlayerT = ReturnType<typeof Player.create>;

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

export function draw(level: Level, ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 0.4;
  ctx.lineCap = "round";
  for (const w of level.walls) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }
}
