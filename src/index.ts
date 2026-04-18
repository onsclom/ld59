import { startLoop } from "./game-loop";
import * as Camera from "./camera";
import * as Edit from "./edit";
import * as Input from "./input";
import * as Level from "./level";
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
    level: Level.create(),
    edit: Edit.create(),
  };
}
type State = ReturnType<typeof createInitState>;
const state = persistent<State>("state", createInitState);

const GAME_SIZE = 100;
const GRID_SPACING = 10;
const GRID_DOT_RADIUS = 0.4;

const stopLoop = startLoop(canvas, (ctx, dt) => {
  const rect = ctx.canvas.getBoundingClientRect();
  state.camera.zoom = Camera.aspectFitZoom(rect, GAME_SIZE, GAME_SIZE);

  if (Input.keysJustPressed.has("e")) {
    state.edit.active = !state.edit.active;
    if (state.edit.active) {
      state.edit.cameraX = state.player.x;
      state.edit.cameraY = state.player.y;
      state.edit.pendingStart = null;
    }
  }

  if (state.edit.active) {
    Edit.update(
      state.edit,
      state.level,
      state.player,
      state.camera,
      rect,
      dt,
    );
  } else {
    if (!state.player.alive && Input.keysJustPressed.has("r")) {
      Player.reset(state.player);
    }
    Player.update(state.player, state.particles, dt);
    if (state.player.alive && Level.hitsPlayer(state.level, state.player)) {
      state.player.alive = false;
    }
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }
  Particles.update(state.particles, dt);

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

    Level.draw(state.level, ctx);
    Particles.draw(state.particles, ctx);
    if (state.edit.active) ctx.globalAlpha = 0.3;
    Player.draw(state.player, ctx);
    ctx.globalAlpha = 1;
    Edit.drawWorld(state.edit, state.level, ctx, rect, state.camera);
  });

  ctx.restore();

  Edit.drawHUD(state.edit, ctx);

  if (!state.player.alive && !state.edit.active) {
    ctx.save();
    ctx.fillStyle = "#f44";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("R TO RESTART", rect.width / 2, rect.height / 2);
    ctx.restore();
  }

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
