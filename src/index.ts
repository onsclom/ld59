import { startLoop } from "./game-loop";
import * as Camera from "./camera";
import * as Input from "./input";
import * as Sound from "./sound";
import { persistent } from "./hmr";

let canvas = document.querySelector<HTMLCanvasElement>("canvas");
if (!canvas) {
  canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
}

function createInitState() {
  return {
    player: { x: 0, y: 0 },
    camera: Camera.create(),
  };
}
type State = ReturnType<typeof createInitState>;
const state = persistent<State>("state", createInitState);

const PLAYER_SIZE = 5;
const PLAYER_SPEED = 0.1; // world-units per ms

const stopLoop = startLoop(canvas, (ctx, dt) => {
  let dx = 0;
  let dy = 0;
  if (Input.keysDown.has("w") || Input.keysDown.has("ArrowUp")) dy -= 1;
  if (Input.keysDown.has("s") || Input.keysDown.has("ArrowDown")) dy += 1;
  if (Input.keysDown.has("a") || Input.keysDown.has("ArrowLeft")) dx -= 1;
  if (Input.keysDown.has("d") || Input.keysDown.has("ArrowRight")) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    state.player.x += (dx / len) * PLAYER_SPEED * dt;
    state.player.y += (dy / len) * PLAYER_SPEED * dt;
  }

  if (Input.keysJustPressed.has(" ")) Sound.sfx.jump();

  const rect = ctx.canvas.getBoundingClientRect();
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const GAME_SIZE = 100;
  state.camera.zoom = Camera.aspectFitZoom(rect, GAME_SIZE, GAME_SIZE);

  Camera.drawWithCamera(ctx, state.camera, (ctx) => {
    ctx.fillStyle = "#444";
    ctx.fillRect(-GAME_SIZE / 2, -GAME_SIZE / 2, GAME_SIZE, GAME_SIZE);

    ctx.fillStyle = "#f0f";
    ctx.fillRect(
      state.player.x - PLAYER_SIZE / 2,
      state.player.y - PLAYER_SIZE / 2,
      PLAYER_SIZE,
      PLAYER_SIZE,
    );
  });

  Input.resetInput();
});

const unregisterInput = Input.registerInputListeners(canvas);
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    stopLoop();
    unregisterInput();
  });
}
