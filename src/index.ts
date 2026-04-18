import { startLoop } from "./game-loop";
import { mod } from "./game-math";
import * as Camera from "./camera";
import * as Edit from "./edit";
import * as Input from "./input";
import * as Level from "./level";
import * as Particles from "./particles";
import * as Player from "./player";
import * as Satellite from "./satellite";
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
  const newIdx = mod(state.currentLevelIndex + dir, state.levels.length);
  state.currentLevelIndex = newIdx;
  state.level = state.levels[newIdx]!;
  Player.reset(state.player);
  Level.resetDynamic(state.level);
}

function insertLevelAfter() {
  const level = Level.create();
  state.levels.splice(state.currentLevelIndex + 1, 0, level);
  state.currentLevelIndex += 1;
  state.level = level;
  Player.reset(state.player);
  Level.resetDynamic(state.level);
  state.edit.cameraX = state.player.x;
  state.edit.cameraY = state.player.y;
  state.edit.pendingStart = null;
}

function deleteCurrentLevel() {
  if (state.levels.length <= 1) return;
  state.levels.splice(state.currentLevelIndex, 1);
  if (state.currentLevelIndex >= state.levels.length) {
    state.currentLevelIndex = state.levels.length - 1;
  }
  state.level = state.levels[state.currentLevelIndex]!;
  Player.reset(state.player);
  Level.resetDynamic(state.level);
  state.edit.cameraX = state.player.x;
  state.edit.cameraY = state.player.y;
  state.edit.pendingStart = null;
}

async function saveLevels() {
  if (process.env.NODE_ENV === "production") return;
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

async function loadLevels(): Promise<Level.LevelData[]> {
  if (process.env.NODE_ENV === "production") {
    const mod = await import("../levels.json");
    return mod.default as Level.LevelData[];
  }
  const res = await fetch("/api/levels");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Level.LevelData[];
}

loadLevels()
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
let wasThrustInhibit = false;
let wasTurnInhibit = false;
let wasControlReverse = false;

const GAME_SIZE = 100;
const GRID_SPACING = 10;
const GRID_DOT_RADIUS = 0.4;

const STATUS_CHIP_LABELS: Record<keyof Player.StatusEffects, string> = {
  thrustDisabled: "THRUSTERS DISABLED",
  turnDisabled: "TURNING DISABLED",
  controlsReversed: "CONTROLS REVERSED",
};

const STATUS_CHIP_COLORS: Record<keyof Player.StatusEffects, string> = {
  thrustDisabled: Satellite.TYPE_COLORS["thrust-inhibitor"],
  turnDisabled: Satellite.TYPE_COLORS["turn-inhibitor"],
  controlsReversed: Satellite.TYPE_COLORS["control-reverser"],
};

const STATUS_CHIP_ORDER: (keyof Player.StatusEffects)[] = [
  "thrustDisabled",
  "turnDisabled",
  "controlsReversed",
];

function drawStatusHUD(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  effects: Player.StatusEffects,
) {
  const active = STATUS_CHIP_ORDER.filter((k) => effects[k]);
  if (active.length === 0) return;

  ctx.save();
  ctx.font = "bold 14px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const padX = 12;
  const chipH = 26;
  const gap = 8;
  const widths = active.map(
    (k) => ctx.measureText(STATUS_CHIP_LABELS[k]).width + padX * 2,
  );
  const total = widths.reduce((a, b) => a + b, 0) + gap * (active.length - 1);
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 200);
  let x = rect.width / 2 - total / 2;
  const y = 46;

  for (let i = 0; i < active.length; i++) {
    const k = active[i]!;
    const w = widths[i]!;
    const color = STATUS_CHIP_COLORS[k];

    ctx.globalAlpha = 0.22 * pulse;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, chipH);

    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, chipH);

    ctx.fillStyle = color;
    ctx.fillText(STATUS_CHIP_LABELS[k], x + w / 2, y + chipH / 2 + 1);

    x += w + gap;
  }
  ctx.restore();
}

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

  if (state.edit.active) {
    if (Input.keysJustPressed.has("n")) insertLevelAfter();
    if (Input.keysJustPressed.has("x")) deleteCurrentLevel();
  }

  if (Input.keysJustPressed.has("r")) {
    Player.reset(state.player);
    Level.resetDynamic(state.level);
    state.edit.active = false;
    state.edit.pendingStart = null;
  }

  if (state.edit.active) {
    state.player.thrusting = false;
    Edit.update(state.edit, state.level, state.player, state.camera, rect, dt);
    Level.computeStatus(state.level, state.player, false);
  } else {
    Level.computeStatus(state.level, state.player, true);
    const frozen = !state.player.alive || state.level.dynamic.won;
    if (frozen) state.player.thrusting = false;
    else {
      const wasAlive = state.player.alive;
      Player.update(
        state.player,
        state.particles,
        dt,
        state.level.dynamic.statusEffects,
      );
      if (Level.hitsPlayer(state.level, state.player)) {
        state.player.alive = false;
      }
      const prevCompleted = state.level.dynamic.completedNodes.size;
      const prevWon = state.level.dynamic.won;
      Level.update(state.level, state.player, state.particles, dt);
      const newlyCompleted =
        state.level.dynamic.completedNodes.size - prevCompleted;
      for (let i = 0; i < newlyCompleted; i++) Sound.sfx.nodeComplete();
      if (!prevWon && state.level.dynamic.won) Sound.sfx.levelWon();
      if (wasAlive && !state.player.alive) {
        state.camera.shakeFactor = 3;
        Sound.sfx.explode();
      }
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

  const effects = state.level.dynamic.statusEffects;
  if (effects.thrustDisabled && !wasThrustInhibit) Sound.thrustInhibit.start();
  else if (!effects.thrustDisabled && wasThrustInhibit)
    Sound.thrustInhibit.stop();
  wasThrustInhibit = effects.thrustDisabled;

  if (effects.turnDisabled && !wasTurnInhibit) Sound.turnInhibit.start();
  else if (!effects.turnDisabled && wasTurnInhibit) Sound.turnInhibit.stop();
  wasTurnInhibit = effects.turnDisabled;

  if (effects.controlsReversed && !wasControlReverse)
    Sound.controlReverse.start();
  else if (!effects.controlsReversed && wasControlReverse)
    Sound.controlReverse.stop();
  wasControlReverse = effects.controlsReversed;

  Particles.update(state.particles, dt);
  Camera.update(state.camera, dt);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.save();

  Camera.drawWithCamera(ctx, state.camera, (ctx) => {
    if (state.edit.active) {
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
    }

    Level.fillOutside(state.level, ctx);
    Level.draw(state.level, ctx);
    if (!state.edit.active) {
      Level.drawTransmissionFX(state.level, state.player, ctx);
      Level.drawInhibitorFX(state.level, state.player, ctx);
    }
    Particles.draw(state.particles, ctx);
    Level.drawProjectiles(state.level, ctx);
    if (state.edit.active) ctx.globalAlpha = 0.3;
    Player.draw(state.player, ctx, state.level.dynamic.statusEffects);
    ctx.globalAlpha = 1;
    Edit.drawWorld(state.edit, state.level, ctx, rect, state.camera);
  });

  ctx.restore();

  Edit.drawHUD(state.edit, ctx);

  ctx.save();
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.fillStyle = "#eee";
  const levelText = `LEVEL ${state.currentLevelIndex + 1} / ${state.levels.length}`;
  ctx.strokeText(levelText, rect.width - 12, 12);
  ctx.fillText(levelText, rect.width - 12, 12);
  if (serializeLevels() !== savedSnapshot) {
    ctx.fillStyle = "#ff6666";
    ctx.strokeText("UNSAVED", rect.width - 12, 30);
    ctx.fillText("UNSAVED", rect.width - 12, 30);
  }
  ctx.restore();

  if (!state.edit.active) {
    const total = Level.totalNodes(state.level);
    if (total > 0) {
      const remaining = Level.remainingNodes(state.level);
      ctx.save();
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.fillStyle = "#9cffcf";
      const nodeText = `TRANSMISSION NODES  ${total - remaining} / ${total}`;
      ctx.strokeText(nodeText, rect.width / 2, 16);
      ctx.fillText(nodeText, rect.width / 2, 16);
      ctx.restore();
    }

    drawStatusHUD(ctx, rect, state.level.dynamic.statusEffects);

    if (state.level.dynamic.won) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.font = "bold 48px monospace";
      ctx.fillStyle = "#9cffcf";
      ctx.strokeText("WIN", rect.width / 2, rect.height / 2 - 26);
      ctx.fillText("WIN", rect.width / 2, rect.height / 2 - 26);
      ctx.font = "bold 22px monospace";
      ctx.lineWidth = 5;
      ctx.fillStyle = "#cfe7ff";
      ctx.strokeText("E FOR NEXT LEVEL", rect.width / 2, rect.height / 2 + 24);
      ctx.fillText("E FOR NEXT LEVEL", rect.width / 2, rect.height / 2 + 24);
      ctx.restore();
    } else if (!state.player.alive) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.font = "bold 32px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.fillStyle = "#ff6666";
      ctx.strokeText("R TO RESTART", rect.width / 2, rect.height / 2);
      ctx.fillText("R TO RESTART", rect.width / 2, rect.height / 2);
      ctx.restore();
    }
  }

  Input.resetInput();
});

Input.registerInputListeners(canvas);
