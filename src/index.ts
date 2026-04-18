import { startLoop } from "./game-loop";
import * as Camera from "./camera";
import * as Input from "./input";
import * as Particles from "./particles";
import * as Player from "./player";
import { persistent } from "./hmr";

let canvas = document.querySelector<HTMLCanvasElement>("canvas");
if (!canvas) {
  canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
}

function createInitState() {
  return {
    player: Player.create(),
    camera: Camera.create(),
    particles: Particles.create(1024),
  };
}
type State = ReturnType<typeof createInitState>;
const state = persistent<State>("state", createInitState);

const GAME_SIZE = 100;
const GRID_SPACING = 10;
const GRID_DOT_RADIUS = 0.4;

const stopLoop = startLoop(canvas, (ctx, dt) => {
  Player.update(state.player, state.particles, dt);
  Particles.update(state.particles, dt);

  state.camera.x = state.player.x;
  state.camera.y = state.player.y;

  const rect = ctx.canvas.getBoundingClientRect();
  state.camera.zoom = Camera.aspectFitZoom(rect, GAME_SIZE, GAME_SIZE);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const gameScreen = GAME_SIZE * state.camera.zoom;
  const gameLeft = (rect.width - gameScreen) / 2;
  const gameTop = (rect.height - gameScreen) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(gameLeft, gameTop, gameScreen, gameScreen);
  ctx.clip();

  ctx.fillStyle = "#111";
  ctx.fillRect(gameLeft, gameTop, gameScreen, gameScreen);

  Camera.drawWithCamera(ctx, state.camera, (ctx) => {
    const halfView = GAME_SIZE / 2 + GRID_SPACING;
    const minGX = Math.floor((state.camera.x - halfView) / GRID_SPACING);
    const maxGX = Math.ceil((state.camera.x + halfView) / GRID_SPACING);
    const minGY = Math.floor((state.camera.y - halfView) / GRID_SPACING);
    const maxGY = Math.ceil((state.camera.y + halfView) / GRID_SPACING);
    ctx.fillStyle = "#555";
    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gy = minGY; gy <= maxGY; gy++) {
        ctx.beginPath();
        ctx.arc(
          gx * GRID_SPACING,
          gy * GRID_SPACING,
          GRID_DOT_RADIUS,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    Particles.draw(state.particles, ctx);
    Player.draw(state.player, ctx);
  });

  ctx.restore();

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
