import { startLoop } from "./game-loop";
import * as Camera from "./camera";
import * as Edit from "./edit";
import * as Input from "./input";
import * as Level from "./level";
import * as LevelIntro from "./level-intro";
import * as Particles from "./particles";
import * as Player from "./player";
import * as Satellite from "./satellite";
import * as Sound from "./sound";
import * as Transitions from "./transitions";

const DEV_MODE =
  process.env.NODE_ENV !== "production" ||
  new URLSearchParams(window.location.search).has("dev");

const COVER_MODE = new URLSearchParams(window.location.search).has("cover");

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
    transition: Transitions.create(),
    levelIntro: LevelIntro.create(),
    gameStartedAt: performance.now(),
    phase: "title" as "title" | "intro" | "playing" | "end",
  };
}
const state = createInitState();

function serializeLevels() {
  return JSON.stringify(state.levels.map(Level.toData));
}
let savedSnapshot = serializeLevels();

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
    state.gameStartedAt = performance.now();
  })
  .catch((err) => console.warn("load error", err));

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveLevels();
  }
  if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "f") {
    e.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
});

let wasThrusting = false;
let wasTransmitting = false;
let wasThrustInhibit = false;
let wasTurnInhibit = false;
let wasControlReverse = false;

let nodeHudPunch = 0;
const NODE_HUD_PUNCH_AMP = 0.3;
const NODE_HUD_PUNCH_DECAY_PER_MS = 0.005;

const GAME_SIZE = 100;
const GRID_SPACING = 10;
const GRID_DOT_RADIUS = 0.4;

const WIN_OVERLAY_FADE_MS = 400;
const WIN_TITLE_START_MS = 120;
const WIN_TITLE_DURATION_MS = 480;
const WIN_STATS_START_MS = 460;
const WIN_STATS_DURATION_MS = 340;
const WIN_HINT_START_MS = 780;
const WIN_HINT_DURATION_MS = 300;
const WIN_INPUT_LOCKOUT_MS = 800;

function smoothstep(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function easeOutBack(x: number) {
  const t = Math.max(0, Math.min(1, x));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

const STATUS_CHIP_LABELS: Record<keyof Player.StatusEffects, string> = {
  thrustDisabled: "THRUST JAMMED",
  turnDisabled: "TURN JAMMED",
  controlsReversed: "CONTROLS INVERTED",
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

function formatTimeMs(ms: number): string {
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

const titlePlayer = Player.create();
titlePlayer.thrusting = true;
titlePlayer.hasThrusted = true;
const titleEffects = Player.createEffects();

let coverNoisePattern: CanvasPattern | null = null;
function getCoverNoisePattern(
  ctx: CanvasRenderingContext2D,
): CanvasPattern | null {
  if (coverNoisePattern) return coverNoisePattern;
  const N = 192;
  const tile = document.createElement("canvas");
  tile.width = N;
  tile.height = N;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  const img = tctx.createImageData(N, N);
  const data = img.data;
  let s = 0x9e3779b9;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return ((s >>> 8) & 0xffffff) / 0x1000000;
  };
  for (let i = 0; i < data.length; i += 4) {
    const r = rand();
    let dv = 0;
    if (r < 0.08) dv = Math.floor(rand() * 10) + 4;
    else if (r > 0.995) dv = Math.floor(rand() * 18) + 14;
    else dv = Math.floor(rand() * 4) - 1;
    data[i] = Math.max(0, Math.min(255, 20 + dv));
    data[i + 1] = Math.max(0, Math.min(255, 20 + dv));
    data[i + 2] = Math.max(0, Math.min(255, 21 + dv));
    data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return null;
  coverNoisePattern = pat;
  return pat;
}

const INTRO_MESSAGES = [
  "YOU ARE THE TRANSMITTER",
  "YOUR TASK IS TO COLLECT SIGNALS FROM TRANSMISSION NODES",
  "THESE SIGNALS WILL SAVE EARTH FROM IMPENDING DOOM",
  "WASD OR ARROW KEYS TO FLY",
];
const INTRO_CHAR_INTERVAL_MS = 35;

const intro = {
  index: 0,
  charsRevealed: 0,
  charTimer: 0,
};

function resetIntro() {
  intro.index = 0;
  intro.charsRevealed = 0;
  intro.charTimer = 0;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryLine).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = tryLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawIntroScreen(ctx: CanvasRenderingContext2D, rect: DOMRect) {
  const message = INTRO_MESSAGES[intro.index] ?? "";
  const visible = message.slice(0, intro.charsRevealed);
  const fullyRevealed = intro.charsRevealed >= message.length;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";

  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const fontSize = Math.max(18, Math.min(36, Math.floor(rect.width / 28)));
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.lineWidth = Math.max(4, Math.floor(fontSize / 6));
  ctx.fillStyle = "#9cffcf";

  const maxWidth = rect.width * 0.8;
  const lines = wrapText(ctx, visible, maxWidth);
  const lineHeight = fontSize * 1.35;
  const totalH = lineHeight * lines.length;
  const startY = cy - totalH / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    ctx.strokeText(lines[i]!, cx, y);
    ctx.fillText(lines[i]!, cx, y);
  }

  if (fullyRevealed) {
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 280);
    ctx.globalAlpha = pulse;
    const hintSize = Math.max(14, Math.floor(fontSize * 0.6));
    ctx.font = `bold ${hintSize}px monospace`;
    ctx.lineWidth = Math.max(3, Math.floor(hintSize / 5));
    ctx.fillStyle = "#cfe7ff";
    const isLast = intro.index >= INTRO_MESSAGES.length - 1;
    const hint = isLast ? "PRESS ANY KEY TO BEGIN" : "PRESS ANY KEY";
    const hintY = startY + totalH + lineHeight;
    ctx.strokeText(hint, cx, hintY);
    ctx.fillText(hint, cx, hintY);
  }
  ctx.restore();
}

function drawTitleScreen(ctx: CanvasRenderingContext2D, rect: DOMRect) {
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  if (COVER_MODE) {
    const pat = getCoverNoisePattern(ctx);
    ctx.fillStyle = pat ?? "#141414";
    ctx.fillRect(0, 0, rect.width, rect.height);

    titlePlayer.rotation = 0;
    const rocketScale = Math.min(rect.width, rect.height) / 10.5;
    ctx.save();
    ctx.translate(cx, cy - 60);
    ctx.scale(rocketScale, rocketScale);
    Player.draw(titlePlayer, ctx, titleEffects);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.font = "bold 46px monospace";
    ctx.lineWidth = 6;
    ctx.fillStyle = "#9cffcf";
    const titleY = rect.height - 42;
    ctx.strokeText("THE TRANSMITTER", cx, titleY);
    ctx.fillText("THE TRANSMITTER", cx, titleY);
    ctx.restore();
    return;
  }

  const t = performance.now();
  titlePlayer.rotation = Math.sin(t / 1800) * 0.22;
  const bobX = Math.sin(t / 1400) * 0.5;
  const bobY = Math.sin(t / 900) * 0.7;

  const rocketScale = Math.min(rect.width, rect.height) / 9;

  ctx.save();
  ctx.translate(cx + bobX * rocketScale, cy + 10 + bobY * rocketScale);
  ctx.scale(rocketScale, rocketScale);
  Player.draw(titlePlayer, ctx, titleEffects);
  ctx.restore();

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";

  ctx.font = "bold 72px monospace";
  ctx.lineWidth = 8;
  ctx.fillStyle = "#9cffcf";
  const angle = Math.sin(performance.now() / 220) * 0.08;
  ctx.save();
  ctx.translate(cx, cy - 40);
  ctx.rotate(angle);
  ctx.strokeText("THE TRANSMITTER", 0, 0);
  ctx.fillText("THE TRANSMITTER", 0, 0);
  ctx.restore();

  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
  ctx.globalAlpha = pulse;
  ctx.font = "bold 22px monospace";
  ctx.lineWidth = 5;
  ctx.fillStyle = "#cfe7ff";
  ctx.strokeText("PRESS ANY KEY TO START", cx, cy + 60);
  ctx.fillText("PRESS ANY KEY TO START", cx, cy + 60);
  ctx.restore();
}

function drawEndScreen(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  s: typeof state,
) {
  const totalTime = s.levels.reduce((acc, l) => acc + l.stats.timeMs, 0);
  const totalResets = s.levels.reduce((acc, l) => acc + l.stats.resets, 0);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";

  const cx = rect.width / 2;
  const cy = rect.height / 2;

  ctx.font = "bold 64px monospace";
  ctx.lineWidth = 7;
  ctx.fillStyle = "#9cffcf";
  const angle = Math.sin(performance.now() / 180) * 0.1;
  ctx.save();
  ctx.translate(cx, cy - 80);
  ctx.rotate(angle);
  ctx.strokeText("THE END", 0, 0);
  ctx.fillText("THE END", 0, 0);
  ctx.restore();

  ctx.font = "bold 20px monospace";
  ctx.lineWidth = 5;
  ctx.fillStyle = "#eaeaea";
  const timeText = `TOTAL TIME    ${formatTimeMs(totalTime)}`;
  const resetText = `TOTAL RESETS  ${totalResets}`;
  ctx.strokeText(timeText, cx, cy - 20);
  ctx.fillText(timeText, cx, cy - 20);
  ctx.strokeText(resetText, cx, cy + 8);
  ctx.fillText(resetText, cx, cy + 8);

  ctx.font = "bold 24px monospace";
  ctx.lineWidth = 5;
  ctx.fillStyle = "#ffd89c";
  ctx.strokeText("THANKS FOR PLAYING!", cx, cy + 56);
  ctx.fillText("THANKS FOR PLAYING!", cx, cy + 56);
  ctx.restore();
}

function drawStatusHUD(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  effects: Player.StatusEffects,
) {
  const active = STATUS_CHIP_ORDER.filter((k) => effects[k]);
  if (active.length === 0) return;

  ctx.save();
  ctx.font = "bold 15px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const padX = 14;
  const chipH = 30;
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

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(10, 10, 14, 0.88)";
    ctx.fillRect(x, y, w, chipH);

    ctx.globalAlpha = 0.18 * pulse;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, chipH);

    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, chipH);

    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
    ctx.strokeText(STATUS_CHIP_LABELS[k], x + w / 2, y + chipH / 2 + 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(STATUS_CHIP_LABELS[k], x + w / 2, y + chipH / 2 + 1);

    x += w + gap;
  }
  ctx.restore();
}

startLoop(canvas, (ctx, dt) => {
  const rect = ctx.canvas.getBoundingClientRect();
  state.camera.zoom = Camera.aspectFitZoom(rect, GAME_SIZE, GAME_SIZE);

  if (state.phase === "title") {
    Transitions.update(state.transition, state, dt);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, rect.width, rect.height);
    drawTitleScreen(ctx, rect);
    Transitions.drawOverlay(ctx, state.transition, rect.width, rect.height);
    if (
      !Transitions.isLocked(state.transition) &&
      (Input.keysJustPressed.size > 0 || Input.mouse.justLeftClicked)
    ) {
      Transitions.begin(state.transition, { kind: "startGame" });
      state.gameStartedAt = performance.now();
      resetIntro();
      Sound.sfx.advance();
    }
    Input.resetInput();
    return;
  }

  if (state.phase === "intro") {
    Transitions.update(state.transition, state, dt);
    const message = INTRO_MESSAGES[intro.index] ?? "";
    const fullyRevealed = intro.charsRevealed >= message.length;
    if (!Transitions.isLocked(state.transition) && !fullyRevealed) {
      intro.charTimer += dt;
      while (
        intro.charTimer >= INTRO_CHAR_INTERVAL_MS &&
        intro.charsRevealed < message.length
      ) {
        intro.charTimer -= INTRO_CHAR_INTERVAL_MS;
        const ch = message.charAt(intro.charsRevealed);
        intro.charsRevealed += 1;
        if (ch !== " ") Sound.sfx.typeChar();
      }
    }
    const advancePressed =
      !Transitions.isLocked(state.transition) &&
      (Input.keysJustPressed.size > 0 || Input.mouse.justLeftClicked);
    if (advancePressed) {
      if (!fullyRevealed) {
        intro.charsRevealed = message.length;
        intro.charTimer = 0;
      } else if (intro.index < INTRO_MESSAGES.length - 1) {
        intro.index += 1;
        intro.charsRevealed = 0;
        intro.charTimer = 0;
        Sound.sfx.select();
      } else {
        Transitions.begin(state.transition, { kind: "startPlaying" });
        state.gameStartedAt = performance.now();
        Sound.sfx.advance();
      }
    }
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, rect.width, rect.height);
    drawIntroScreen(ctx, rect);
    Transitions.drawOverlay(ctx, state.transition, rect.width, rect.height);
    Input.resetInput();
    return;
  }

  if (state.phase === "end") {
    Transitions.update(state.transition, state, dt);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, rect.width, rect.height);
    drawEndScreen(ctx, rect, state);
    Transitions.drawOverlay(ctx, state.transition, rect.width, rect.height);
    Input.resetInput();
    return;
  }

  if (DEV_MODE && Input.keysJustPressed.has("Shift")) {
    state.edit.active = !state.edit.active;
    if (state.edit.active) {
      state.edit.cameraX = state.player.x;
      state.edit.cameraY = state.player.y;
      state.edit.pendingStart = null;
    }
  }

  const transitionLocked = Transitions.isLocked(state.transition);
  const introActive = LevelIntro.isActive(state.levelIntro);
  const inputLocked = transitionLocked || introActive;

  if (DEV_MODE && !inputLocked && Input.keysJustPressed.has("q")) {
    const action = { kind: "switchLevel" as const, dir: -1 };
    if (state.edit.active) Transitions.apply(state, action);
    else Transitions.begin(state.transition, action);
  }
  const won = state.level.dynamic.won;
  const wonAndPlayable = !state.edit.active && won;
  const winElapsedMs =
    won && state.level.dynamic.wonAtMs !== null
      ? performance.now() - state.level.dynamic.wonAtMs
      : 0;
  const winInputLocked = wonAndPlayable && winElapsedMs < WIN_INPUT_LOCKOUT_MS;
  const anyInputPressed =
    Input.keysJustPressed.size > 0 || Input.mouse.justLeftClicked;
  const advancePressed =
    !inputLocked &&
    (wonAndPlayable
      ? anyInputPressed && !winInputLocked
      : Input.keysJustPressed.has("e"));
  let advancedFromWin = false;
  if (advancePressed) {
    const onLast = state.currentLevelIndex === state.levels.length - 1;
    if (!state.edit.active && won && onLast) {
      state.phase = "end";
      Sound.sfx.advance();
      advancedFromWin = true;
    } else if (DEV_MODE || (!state.edit.active && won)) {
      const action = { kind: "switchLevel" as const, dir: 1 };
      if (state.edit.active) Transitions.apply(state, action);
      else Transitions.begin(state.transition, action);
      Sound.sfx.advance();
      advancedFromWin = wonAndPlayable;
    }
  }

  if (state.edit.active) {
    if (Input.keysJustPressed.has("n")) insertLevelAfter();
    if (Input.keysJustPressed.has("x")) deleteCurrentLevel();
  }

  if (!advancedFromWin && !inputLocked && Input.keysJustPressed.has("r")) {
    const wasEdit = state.edit.active;
    state.edit.active = false;
    state.edit.pendingStart = null;
    const action = { kind: "restart" as const };
    if (wasEdit) Transitions.apply(state, action);
    else Transitions.begin(state.transition, action);
    Sound.sfx.retry();
  }

  Transitions.update(state.transition, state, dt);
  LevelIntro.update(state.levelIntro, dt);
  const introActiveNow = LevelIntro.isActive(state.levelIntro);

  if (!state.edit.active && !state.level.dynamic.won && !introActiveNow) {
    state.level.stats.timeMs += dt;
  }

  if (state.edit.active) {
    state.player.thrusting = false;
    Edit.update(state.edit, state.level, state.player, state.camera, rect, dt);
    Level.computeStatus(state.level, state.player, false);
  } else if (introActiveNow) {
    state.player.thrusting = false;
    Level.computeStatus(state.level, state.player, false);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
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
      if (newlyCompleted > 0) nodeHudPunch = 1;
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

    const bgAlpha = introActiveNow ? LevelIntro.bgAlpha(state.levelIntro) : 1;
    if (!state.edit.active) {
      Level.fillInside(
        state.level,
        ctx,
        state.camera.x,
        state.camera.y,
        bgAlpha,
      );
      Level.fillOutside(
        state.level,
        ctx,
        state.camera.x,
        state.camera.y,
        bgAlpha,
      );
    }
    const introForDraw = introActiveNow
      ? {
          wall: (i: number) => LevelIntro.wallProgress(state.levelIntro, i),
          sat: (i: number) => LevelIntro.satelliteProgress(state.levelIntro, i),
        }
      : undefined;
    Level.draw(state.level, ctx, introForDraw);
    if (!state.edit.active && !introActiveNow) {
      Level.drawTransmissionFX(state.level, state.player, ctx);
      Level.drawInhibitorFX(state.level, state.player, ctx);
    }
    Particles.draw(state.particles, ctx);
    Level.drawProjectiles(state.level, ctx);
    const playerP = introActiveNow
      ? LevelIntro.playerProgress(state.levelIntro)
      : 1;
    if (playerP > 0) {
      ctx.save();
      if (state.edit.active) ctx.globalAlpha = 0.3;
      else if (playerP < 1) {
        ctx.globalAlpha = playerP;
        ctx.translate(state.player.x, state.player.y);
        ctx.scale(playerP, playerP);
        ctx.translate(-state.player.x, -state.player.y);
      }
      Player.draw(state.player, ctx, state.level.dynamic.statusEffects);
      ctx.restore();
    }
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
      const punchScale = 1 + nodeHudPunch * NODE_HUD_PUNCH_AMP;
      ctx.translate(rect.width / 2, 16);
      ctx.scale(punchScale, punchScale);
      ctx.strokeText(nodeText, 0, 0);
      ctx.fillText(nodeText, 0, 0);
      ctx.restore();
      nodeHudPunch *= Math.exp(-NODE_HUD_PUNCH_DECAY_PER_MS * dt);
    }

    drawStatusHUD(ctx, rect, state.level.dynamic.statusEffects);

    if (state.level.dynamic.won) {
      const elapsed =
        state.level.dynamic.wonAtMs !== null
          ? performance.now() - state.level.dynamic.wonAtMs
          : 0;

      const overlayP = smoothstep(elapsed / WIN_OVERLAY_FADE_MS);
      const titleP = smoothstep(
        (elapsed - WIN_TITLE_START_MS) / WIN_TITLE_DURATION_MS,
      );
      const titleScale = easeOutBack(
        (elapsed - WIN_TITLE_START_MS) / WIN_TITLE_DURATION_MS,
      );
      const statsP = smoothstep(
        (elapsed - WIN_STATS_START_MS) / WIN_STATS_DURATION_MS,
      );
      const hintP = smoothstep(
        (elapsed - WIN_HINT_START_MS) / WIN_HINT_DURATION_MS,
      );

      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.6 * overlayP})`;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      const cx = rect.width / 2;
      const cy = rect.height / 2;

      if (titleP > 0) {
        const settle = Math.max(
          0,
          (elapsed - WIN_TITLE_START_MS - WIN_TITLE_DURATION_MS) / 250,
        );
        const rockAmp = smoothstep(settle) * 0.12;
        const winAngle = Math.sin(performance.now() / 180) * rockAmp;
        ctx.save();
        ctx.globalAlpha = titleP;
        ctx.translate(cx, cy - 64);
        ctx.rotate(winAngle);
        ctx.scale(titleScale, titleScale);
        ctx.font = "bold 48px monospace";
        ctx.lineWidth = 6;
        ctx.fillStyle = "#9cffcf";
        ctx.strokeText("LEVEL COMPLETE", 0, 0);
        ctx.fillText("LEVEL COMPLETE", 0, 0);
        ctx.restore();
      }

      if (statsP > 0) {
        ctx.save();
        ctx.globalAlpha = statsP;
        const slide = (1 - statsP) * 12;
        ctx.font = "bold 20px monospace";
        ctx.lineWidth = 5;
        ctx.fillStyle = "#eaeaea";
        const timeText = `TIME  ${formatTimeMs(state.level.stats.timeMs)}`;
        ctx.strokeText(timeText, cx, cy - 10 + slide);
        ctx.fillText(timeText, cx, cy - 10 + slide);
        const resetText = `RESETS  ${state.level.stats.resets}`;
        ctx.strokeText(resetText, cx, cy + 18 + slide);
        ctx.fillText(resetText, cx, cy + 18 + slide);
        ctx.restore();
      }

      if (hintP > 0) {
        const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 280);
        ctx.save();
        ctx.globalAlpha = hintP * pulse;
        ctx.font = "bold 22px monospace";
        ctx.lineWidth = 5;
        ctx.fillStyle = "#cfe7ff";
        ctx.strokeText("PRESS ANY KEY", cx, cy + 64);
        ctx.fillText("PRESS ANY KEY", cx, cy + 64);
        ctx.restore();
      }
      ctx.restore();
    } else if (!state.player.alive) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      const cx = rect.width / 2;
      const cy = rect.height / 2;

      ctx.font = "bold 48px monospace";
      ctx.lineWidth = 6;
      ctx.fillStyle = "#ff6666";
      const deadAngle = Math.sin(performance.now() / 180) * 0.12;
      ctx.save();
      ctx.translate(cx, cy - 32);
      ctx.rotate(deadAngle);
      ctx.strokeText("DEAD", 0, 0);
      ctx.fillText("DEAD", 0, 0);
      ctx.restore();

      ctx.font = "bold 24px monospace";
      ctx.lineWidth = 5;
      ctx.fillStyle = "#eaeaea";
      ctx.strokeText("R TO RETRY", cx, cy + 24);
      ctx.fillText("R TO RETRY", cx, cy + 24);
      ctx.restore();
    }
  }

  Transitions.drawOverlay(ctx, state.transition, rect.width, rect.height);

  Input.resetInput();
});

Input.registerInputListeners(canvas);
