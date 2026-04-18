import { expDecay } from "./game-math";

export function create() {
  return {
    // center of camera
    x: 0,
    y: 0,

    rotation: 0,
    zoom: 1,

    shakeFactor: 0,
    shakeTime: 0,
  };
}

type Camera = ReturnType<typeof create>;

const SHAKE_DECAY = 0.004;
const SHAKE_FREQ_X = 0.052;
const SHAKE_FREQ_Y = 0.056;

export function update(camera: Camera, dt: number) {
  camera.shakeTime += dt;
  camera.shakeFactor = expDecay(camera.shakeFactor, 0, dt * SHAKE_DECAY);
}

function getTransformMatrix(
  canvasRect: DOMRect,
  camera: Camera,
  rendering: boolean,
): DOMMatrix {
  const baseScale = rendering ? devicePixelRatio : 1;
  return new DOMMatrix()
    .scale(baseScale, baseScale)
    .translate(canvasRect.width / 2, canvasRect.height / 2)
    .scale(camera.zoom, camera.zoom)
    .rotate((-camera.rotation * 180) / Math.PI)
    .translate(-camera.x, -camera.y);
}

export function drawWithCamera(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  ctx.save();
  const canvasRect = ctx.canvas.getBoundingClientRect();
  const matrix = getTransformMatrix(canvasRect, camera, true);
  const shakeX = Math.sin(camera.shakeTime * SHAKE_FREQ_X) * camera.shakeFactor;
  const shakeY = Math.cos(camera.shakeTime * SHAKE_FREQ_Y) * camera.shakeFactor;
  matrix.translateSelf(-shakeX, -shakeY);
  ctx.setTransform(matrix);
  draw(ctx);
  ctx.restore();
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  camera: Camera,
) {
  const matrix = getTransformMatrix(canvasRect, camera, false);
  const inverseMatrix = matrix.inverse();
  const point = new DOMPoint(screenX, screenY);
  const worldPoint = point.matrixTransform(inverseMatrix);
  return { x: worldPoint.x, y: worldPoint.y };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  ctx: CanvasRenderingContext2D,
  camera: Camera,
) {
  const canvasRect = ctx.canvas.getBoundingClientRect();
  const matrix = getTransformMatrix(canvasRect, camera, false);
  const point = new DOMPoint(worldX, worldY);
  const screenPoint = point.matrixTransform(matrix);
  return { x: screenPoint.x, y: screenPoint.y };
}

export function aspectFitZoom(
  canvasRect: DOMRect,
  minWidth: number,
  minHeight: number,
) {
  const zoomForWidth = canvasRect.width / minWidth;
  const zoomForHeight = canvasRect.height / minHeight;
  return Math.min(zoomForWidth, zoomForHeight);
}
