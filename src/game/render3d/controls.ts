// How the player drives the camera: turn it, and get closer or further away.
//
// ── WHY IT IS NOT IN THE COMPONENT ──────────────────────────────────────────
// Three different inputs write the same two numbers — a wheel, a right-drag,
// two keys and two on-screen buttons — and every one of them has to obey the
// same clamp. Spread through a frame loop that also runs a fight, the fourth
// one always forgets: the initial zoom really did bypass the limits the wheel
// enforced, and the view could START somewhere it was not allowed to reach.
//
// ⚠ IT OWNS YAW AND ZOOM AND NOTHING ELSE OWNS THEM. The compass reads yaw
// back out; it never keeps its own copy, because a needle that disagrees with
// the camera is worse than no needle.

import { ZOOM_MAX, ZOOM_MIN } from './stage';

/** Radians per second the view turns while a key or button is held. */
const TURN_RATE = 1.6;

/** The stage surface the controls drive. Kept narrow so this file cannot reach further. */
interface ControlledStage {
  setYaw(yaw: number): void;
  setViewHeight(height: number): void;
}

export interface CameraControls {
  readonly yaw: number;
  readonly zoom: number;
  /** Multiplicative, so a step feels the same at every distance. */
  zoomBy(factor: number): void;
  /** Advance the held turn. `input` is -1, 0 or 1. */
  update(dt: number, input: number): void;
  dispose(): void;
}

export function createCameraControls(
  canvas: HTMLCanvasElement,
  stage: ControlledStage,
  startZoom: number,
  onZoomChange: (zoom: number) => void
): CameraControls {
  let yaw = Math.PI / 4;
  let zoom = clamp(startZoom);

  function clamp(v: number): number {
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
  }

  function setZoom(next: number): void {
    zoom = clamp(next);
    stage.setViewHeight(zoom);
    onZoomChange(zoom);
  }

  setZoom(zoom);
  stage.setYaw(yaw);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // Additive zoom crawls when far out and lurches when close in.
    setZoom(zoom * (1 + Math.sign(e.deltaY) * 0.12));
  };

  // Dragging with the right button or the middle turns the view. The left
  // button is left free for whatever selects and targets later.
  let dragging = false;
  let lastX = 0;
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 2 && e.button !== 1) return;
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw -= (e.clientX - lastX) * 0.008;
    lastX = e.clientX;
  };
  const onPointerUp = () => {
    dragging = false;
  };
  const onContext = (e: Event) => e.preventDefault();

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', onContext);

  return {
    get yaw() {
      return yaw;
    },
    get zoom() {
      return zoom;
    },
    zoomBy: (factor) => setZoom(zoom * factor),
    update: (dt, input) => {
      if (input !== 0) yaw += input * dt * TURN_RATE;
      stage.setYaw(yaw);
    },
    dispose: () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('contextmenu', onContext);
    },
  };
}
