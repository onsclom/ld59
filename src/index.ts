import { startLoop } from "./game-loop";
import * as Camera from "./camera";
import * as Edit from "./edit";
import * as Input from "./input";
import * as Level from "./level";
import * as Particles from "./particles";
import * as Player from "./player";
import * as Sound from "./sound";

let canvas = document.querySelector<HTMLCanvasElement>("canvas");
if (!canvas) {
  canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
}

function createInitState() {
  const levels = [Level.create()];
  return {
    player: Player.create(),
    camera: Camera.create(),
    particles: Particles.create(1024),
    levels,
    currentLevelIndex: 0,
    level: levels[0]!,
    edit: Edit.create(),
  };
}
const state = createInitState();

function serializeLevels() {
  return JSON.stringify(state.levels.map(Level.toData));
}
let savedSnapshot = serializeLevels();

function switchLevel(dir: number) {
  const newIdx = state.currentLevelIndex + dir;
  if (newIdx < 0) return;
  if (newIdx >= state.levels.length) state.levels.push(Level.create());
  state.currentLevelIndex = newIdx;
  state.level = state.levels[newIdx]!;
  Player.reset(state.player);
  Level.resetDynamic(state.level);
}

async function saveLevels() {
  const body = serializeLevels();
  try {
    const res = await fetch("/api/levels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    if (!res.ok) {
      console.warn("save failed", res.status);
      return;
    }
    savedSnapshot = body;
  } catch (err) {
    console.warn("save error", err);
  }
}

fetch("/api/levels")
  .then((r) => r.json() as Promise<Level.LevelData[]>)
  .then((data) => {
    if (!Array.isArray(data) || data.length === 0) return;
    state.levels = data.map(Level.fromData);
    state.currentLevelIndex = 0;
    state.level = state.levels[0]!;
    Player.reset(state.player);
    savedSnapshot = serializeLevels();
  })
  .catch((err) => console.warn("load error", err));

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveLevels();
  }
});

let wasThrusting = false;
let wasTransmitting = false;

const GAME_SIZE = 100;
const GRID_SPACING = 10;
const GRID_DOT_RADIUS = 0.4;

startLoop(canvas, (ctx, dt) => {
  const rect = ctx.canvas.getBoundingClientRect();
  state.camera.zoom = Camera.aspectFitZoom(rect, GAME_SIZE, GAME_SIZE);

  if (Input.keysJustPressed.has("Shift")) {
    state.edit.active = !state.edit.active;
    if (state.edit.active) {
      state.edit.cameraX = state.player.x;
      state.edit.cameraY = state.player.y;
      state.edit.pendingStart = null;
    }
  }

  if (Input.keysJustPressed.has("q")) switchLevel(-1);
  if (Input.keysJustPressed.has("e")) switchLevel(1);

  if (Input.keysJustPressed.has("r")) {
    Player.reset(state.player);
    Level.resetDynamic(state.level);
    state.edit.active = false;
    state.edit.pendingStart = null;
  }

  if (state.edit.active) {
    state.player.thrusting = false;
    Edit.update(
      state.edit,
      state.level,
      state.player,
      state.camera,
      rect,
      dt,
    );
  } else {
    const frozen = !state.player.alive || state.level.dynamic.won;
    if (frozen) state.player.thrusting = false;
    else {
      Player.update(state.player, state.particles, dt);
      if (Level.hitsPlayer(state.level, state.player)) {
        state.player.alive = false;
        state.camera.shakeFactor = 3;
        Sound.sfx.explode();
      }
      const prevCompleted = state.level.dynamic.completedNodes.size;
      const prevWon = state.level.dynamic.won;
      Level.update(state.level, state.player, dt);
      const newlyCompleted =
        state.level.dynamic.completedNodes.size - prevCompleted;
      for (let i = 0; i < newlyCompleted; i++) Sound.sfx.nodeComplete();
      if (!prevWon && state.level.dynamic.won) Sound.sfx.levelWon();
    }
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  if (state.player.thrusting && !wasThrusting) Sound.thruster.start();
  else if (!state.player.thrusting && wasThrusting) Sound.thruster.stop();
  wasThrusting = state.player.thrusting;

  const transmitting =
    !state.edit.active &&
    state.player.alive &&
    !state.level.dynamic.won &&
    Level.anyTransmitting(state.level);
  if (transmitting && !wasTransmitting) Sound.transmission.start();
  else if (!transmitting && wasTransmitting) Sound.transmission.stop();
  wasTransmitting = transmitting;

  Particles.update(state.particles, dt);
  Camera.update(state.camera, dt);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.save();

  Camera.drawWithCamera(ctx, state.camera, (ctx) => {
    const halfViewX = rect.width / 2 / state.camera.zoom + GRID_SPACING;
    const halfViewY = rect.height / 2 / state.camera.zoom + GRID_SPACING;
    const minGX = Math.floor((state.camera.x - halfViewX) / GRID_SPACING);
    const maxGX = Math.ceil((state.camera.x + halfViewX) / GRID_SPACING);
    const minGY = Math.floor((state.camera.y - halfViewY) / GRID_SPACING);
    const maxGY = Math.ceil((state.camera.y + halfViewY) / GRID_SPACING);
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

    Level.fillOutside(state.level, ctx);
    Level.draw(state.level, ctx);
    if (!state.edit.active) Level.drawTransmissionFX(state.level, state.player, ctx);
    Particles.draw(state.particles, ctx);
    if (state.edit.active) ctx.globalAlpha = 0.3;
    Player.draw(state.player, ctx);
    ctx.globalAlpha = 1;
    Edit.drawWorld(state.edit, state.level, ctx, rect, state.camera);
  });

  ctx.restore();

  Edit.drawHUD(state.edit, ctx);

  ctx.save();
  ctx.fillStyle = "#888";
  ctx.font = "12px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(
    `LEVEL ${state.currentLevelIndex + 1} / ${state.levels.length}`,
    rect.width - 12,
    12,
  );
  if (serializeLevels() !== savedSnapshot) {
    ctx.fillStyle = "#f44";
    ctx.font = "bold 12px monospace";
    ctx.fillText("UNSAVED", rect.width - 12, 28);
  }
  ctx.restore();

  if (!state.edit.active) {
    const total = Level.totalNodes(state.level);
    if (total > 0) {
      const remaining = Level.remainingNodes(state.level);
      ctx.save();
      ctx.fillStyle = "#9cffcf";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        `TRANSMISSION NODES  ${total - remaining} / ${total}`,
        rect.width / 2,
        16,
      );
      ctx.restore();
    }

    if (state.level.dynamic.won) {
      ctx.save();
      ctx.fillStyle = "#9cffcf";
      ctx.font = "bold 36px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("WIN", rect.width / 2, rect.height / 2 - 20);
      ctx.fillStyle = "#cfe7ff";
      ctx.font = "bold 18px monospace";
      ctx.fillText("R TO RESTART", rect.width / 2, rect.height / 2 + 20);
      ctx.restore();
    } else if (!state.player.alive) {
      ctx.save();
      ctx.fillStyle = "#f44";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("R TO RESTART", rect.width / 2, rect.height / 2);
      ctx.restore();
    }
  }

  Input.resetInput();
});

Input.registerInputListeners(canvas);
