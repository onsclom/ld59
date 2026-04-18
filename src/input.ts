export const keysDown = new Set<string>();
export const keysJustPressed = new Set<string>();
export const keysJustReleased = new Set<string>();
export const mouse = {
  onCanvas: false,
  x: 0,
  y: 0,
  justLeftClicked: false,
  justRightClicked: false,
  leftClickDown: false,
  rightClickDown: false,
  wheelDelta: 0,
};

// Call at the end of each tick so `just*` state survives the frame it fired on.
export function resetInput() {
  mouse.justLeftClicked = false;
  mouse.justRightClicked = false;
  mouse.wheelDelta = 0;
  keysJustPressed.clear();
  keysJustReleased.clear();
}

export function registerInputListeners(canvas: HTMLCanvasElement): () => void {
  const controller = new AbortController();
  const { signal } = controller;

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button === 0) {
        mouse.leftClickDown = true;
        mouse.justLeftClicked = true;
      } else if (e.button === 2) {
        mouse.rightClickDown = true;
        mouse.justRightClicked = true;
      }
    },
    { signal },
  );

  canvas.addEventListener(
    "pointerup",
    (e) => {
      if (e.button === 0) {
        mouse.leftClickDown = false;
      } else if (e.button === 2) {
        mouse.rightClickDown = false;
      }
    },
    { signal },
  );

  canvas.addEventListener(
    "pointermove",
    (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    },
    { signal },
  );

  canvas.addEventListener(
    "pointerenter",
    () => {
      mouse.onCanvas = true;
    },
    { signal },
  );

  canvas.addEventListener(
    "pointerleave",
    () => {
      mouse.onCanvas = false;
    },
    { signal },
  );

  canvas.addEventListener(
    "wheel",
    (e) => {
      mouse.wheelDelta += e.deltaY;
    },
    { signal },
  );

  document.body.addEventListener(
    "keydown",
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!keysDown.has(e.key)) {
        keysJustPressed.add(e.key);
      }
      keysDown.add(e.key);
    },
    { signal },
  );

  document.body.addEventListener(
    "keyup",
    (e) => {
      keysDown.delete(e.key);
      keysJustReleased.add(e.key);
    },
    { signal },
  );

  return () => {
    controller.abort();
    keysDown.clear();
    keysJustPressed.clear();
    keysJustReleased.clear();
    mouse.leftClickDown = false;
    mouse.rightClickDown = false;
    mouse.justLeftClicked = false;
    mouse.justRightClicked = false;
    mouse.wheelDelta = 0;
  };
}
