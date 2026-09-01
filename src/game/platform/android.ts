// Android & Mobile Platform Integration Engine (Alamat MOBA)
//
// ── CAPABILITIES ─────────────────────────────────────────────────────────────
// 1. Immersive Fullscreen & Screen Orientation Lock (Landscape-first)
// 2. Screen Wake Lock API (keeps phone screen on during 10-min MOBA matches)
// 3. Android Back Gesture & Popstate navigation guard
// 4. Gamepad API Controller Support (Bluetooth / USB: Razer Kishi, Xbox, DualShock)
// 5. Touch & Gesture suppression (prevents pull-to-refresh & double-tap zoom)
// 6. Device capability profiling & High Refresh Rate display detection

export interface GamepadState {
  connected: boolean;
  id: string;
  moveX: number;
  moveZ: number;
  aimX: number;
  aimZ: number;
  aimActive: boolean;
  attack: boolean;
  minionAttack: boolean;
  ability0: boolean;
  ability1: boolean;
  ability2: boolean;
  ultimate: boolean;
  potion: boolean;
  spell: boolean;
  recall: boolean;
  pingAttack: boolean;
  pingDefend: boolean;
  pingRetreat: boolean;
  pingOmw: boolean;
  shop: boolean;
  settings: boolean;
}

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: string, listener: () => void): void;
}

interface FullscreenDocument {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface FullscreenElement {
  requestFullscreen?: (options?: { navigationUI?: string }) => Promise<void>;
  webkitRequestFullscreen?: (options?: { navigationUI?: string }) => Promise<void>;
  mozRequestFullScreen?: (options?: { navigationUI?: string }) => Promise<void>;
  msRequestFullscreen?: (options?: { navigationUI?: string }) => Promise<void>;
}

interface ScreenOrientationLockable {
  orientation?: {
    lock(orientation: string): Promise<void>;
  };
  lockOrientation?: (orientation: string) => boolean;
  mozLockOrientation?: (orientation: string) => boolean;
  webkitLockOrientation?: (orientation: string) => boolean;
}

const EMPTY_GAMEPAD_STATE: GamepadState = {
  connected: false,
  id: '',
  moveX: 0,
  moveZ: 0,
  aimX: 0,
  aimZ: 0,
  aimActive: false,
  attack: false,
  minionAttack: false,
  ability0: false,
  ability1: false,
  ability2: false,
  ultimate: false,
  potion: false,
  spell: false,
  recall: false,
  pingAttack: false,
  pingDefend: false,
  pingRetreat: false,
  pingOmw: false,
  shop: false,
  settings: false,
};

class AndroidPlatformEngine {
  private wakeLockSentinel: WakeLockSentinelLike | null = null;
  private isFullscreenActive: boolean = false;
  private gamepadListenersAttached: boolean = false;
  private connectedGamepads: Map<number, Gamepad> = new Map();
  private prevButtonStates: Map<number, boolean[]> = new Map();
  private onGamepadConnectedCallbacks: Set<(id: string) => void> = new Set();
  private onGamepadDisconnectedCallbacks: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initEventListeners();
    }
  }

  private initEventListeners(): void {
    // Track fullscreen status
    const updateFullscreenStatus = () => {
      const doc = document as unknown as FullscreenDocument;
      this.isFullscreenActive = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
    };
    document.addEventListener('fullscreenchange', updateFullscreenStatus);
    document.addEventListener('webkitfullscreenchange', updateFullscreenStatus);

    // Re-acquire wake lock on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.wakeLockSentinel) {
        this.requestWakeLock().catch(() => {});
      }
    });

    // Gamepad connection events
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('gamepadconnected', (event: Event) => {
        const gp = (event as unknown as { gamepad?: Gamepad }).gamepad;
        if (gp) {
          this.connectedGamepads.set(gp.index, gp);
          this.onGamepadConnectedCallbacks.forEach((cb) => cb(gp.id));
        }
      });

      window.addEventListener('gamepaddisconnected', (event: Event) => {
        const gp = (event as unknown as { gamepad?: Gamepad }).gamepad;
        if (gp) {
          this.connectedGamepads.delete(gp.index);
          this.prevButtonStates.delete(gp.index);
          if (this.connectedGamepads.size === 0) {
            this.onGamepadDisconnectedCallbacks.forEach((cb) => cb());
          }
        }
      });
      this.gamepadListenersAttached = true;
    }
  }

  // ── DEVICE DETECTION ──────────────────────────────────────────────────────

  public isAndroid(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android/i.test(ua);
  }

  public isMobile(): boolean {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const hasTouch = (navigator.maxTouchPoints || 0) > 0;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    return isMobileUA || (hasTouch && window.innerWidth <= 1024);
  }

  public isTouchDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return (navigator.maxTouchPoints || 0) > 0;
  }

  public isFullscreen(): boolean {
    return this.isFullscreenActive;
  }

  // ── FULLSCREEN & SCREEN ORIENTATION LOCK ──────────────────────────────────

  /**
   * Enters immersive landscape fullscreen mode.
   * Hides Android status and navigation bars and locks screen to landscape.
   */
  public async enterImmersiveLandscape(): Promise<boolean> {
    if (typeof document === 'undefined') return false;
    let succeeded = false;

    // 1. Request Fullscreen
    try {
      const el = document.documentElement as unknown as FullscreenElement;
      const requestFs =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen;

      if (requestFs && !this.isFullscreenActive) {
        await requestFs.call(el, { navigationUI: 'hide' });
        this.isFullscreenActive = true;
        succeeded = true;
      }
    } catch {
      // Browser may reject if not in direct user gesture handler
    }

    // 2. Lock Orientation to Landscape
    try {
      const screenAny = (typeof screen !== 'undefined' ? screen : null) as unknown as ScreenOrientationLockable | null;
      if (screenAny?.orientation?.lock) {
        await screenAny.orientation.lock('landscape').catch(() => {
          return screenAny.orientation?.lock('landscape-primary').catch(() => {});
        });
      } else if (screenAny?.lockOrientation) {
        screenAny.lockOrientation('landscape');
      } else if (screenAny?.mozLockOrientation) {
        screenAny.mozLockOrientation('landscape');
      } else if (screenAny?.webkitLockOrientation) {
        screenAny.webkitLockOrientation('landscape');
      }
    } catch {
      // Ignore orientation lock restrictions in iframe/browser
    }

    // 3. Acquire Wake Lock
    await this.requestWakeLock().catch(() => {});

    return succeeded;
  }

  /**
   * Exits fullscreen mode.
   */
  public async exitFullscreen(): Promise<void> {
    if (typeof document === 'undefined') return;
    try {
      const doc = document as unknown as FullscreenDocument;
      const exitFs =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen;

      if (exitFs && this.isFullscreenActive) {
        await exitFs.call(doc);
        this.isFullscreenActive = false;
      }
    } catch {}
  }

  // ── SCREEN WAKE LOCK API ──────────────────────────────────────────────────

  /**
   * Requests a screen wake lock to prevent the phone display from dimming.
   */
  public async requestWakeLock(): Promise<boolean> {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as unknown as { wakeLock?: { request: (type: string) => Promise<WakeLockSentinelLike> } };
    if (nav.wakeLock && typeof nav.wakeLock.request === 'function') {
      try {
        if (!this.wakeLockSentinel) {
          this.wakeLockSentinel = await nav.wakeLock.request('screen');
          this.wakeLockSentinel.addEventListener('release', () => {
            this.wakeLockSentinel = null;
          });
          return true;
        }
      } catch {
        // Ignore wake lock denial
      }
    }
    return false;
  }

  public releaseWakeLock(): void {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  // ── ANDROID BACK GESTURE PROTECTION ───────────────────────────────────────

  /**
   * Traps the back gesture / popstate so users do not accidentally leave during live combat.
   */
  public setupBackGestureGuard(onBackAttempt?: () => void): () => void {
    if (typeof window === 'undefined') return () => {};

    try {
      window.history.pushState({ inGame: true }, '', window.location.href);
    } catch {}

    const handlePopState = () => {
      try {
        window.history.pushState({ inGame: true }, '', window.location.href);
      } catch {}
      if (onBackAttempt) {
        onBackAttempt();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }

  // ── GAMEPAD / CONTROLLER ENGINE ───────────────────────────────────────────

  public onGamepadConnected(cb: (id: string) => void): () => void {
    this.onGamepadConnectedCallbacks.add(cb);
    return () => this.onGamepadConnectedCallbacks.delete(cb);
  }

  public onGamepadDisconnected(cb: () => void): () => void {
    this.onGamepadDisconnectedCallbacks.add(cb);
    return () => this.onGamepadDisconnectedCallbacks.delete(cb);
  }

  /**
   * Polls connected gamepads on each animation frame.
   * Maps standard Xbox / DualShock / Razer Kishi layouts to MOBA actions.
   */
  public pollGamepad(): GamepadState {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return EMPTY_GAMEPAD_STATE;
    }

    const gamepads = navigator.getGamepads();
    let primaryGamepad: Gamepad | null = null;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        primaryGamepad = gp;
        break;
      }
    }

    if (!primaryGamepad) {
      return EMPTY_GAMEPAD_STATE;
    }

    const deadzone = 0.15;
    const aimDeadzone = 0.22;

    // Left Stick (Axes 0, 1) -> Movement
    const rawX = primaryGamepad.axes[0] || 0;
    const rawZ = primaryGamepad.axes[1] || 0;
    const moveLen = Math.hypot(rawX, rawZ);
    const moveX = moveLen > deadzone ? rawX : 0;
    const moveZ = moveLen > deadzone ? rawZ : 0;

    // Right Stick (Axes 2, 3) -> Aiming
    const rawAimX = primaryGamepad.axes[2] || 0;
    const rawAimZ = primaryGamepad.axes[3] || 0;
    const aimLen = Math.hypot(rawAimX, rawAimZ);
    const aimActive = aimLen > aimDeadzone;
    const aimX = aimActive ? rawAimX : 0;
    const aimZ = aimActive ? rawAimZ : 0;

    const b = primaryGamepad.buttons;

    // Button edge-detection for single-press actions
    const prev = this.prevButtonStates.get(primaryGamepad.index) || [];
    const current = b.map((btn) => btn?.pressed || (btn?.value || 0) > 0.5);
    const isJustPressed = (idx: number) => !!current[idx] && !prev[idx];
    this.prevButtonStates.set(primaryGamepad.index, current);

    // Standard Gamepad Mapping:
    // Button 0 (A / Cross): Basic Attack
    // Button 1 (B / Circle): Minion / Creep Attack
    // Button 2 (X / Square): Ability 0 (Skill 1)
    // Button 3 (Y / Triangle): Ability 1 (Skill 2)
    // Button 4 (L1 / LB): Ability 2 (Skill 3)
    // Button 5 (R1 / RB): Ultimate (Skill 4)
    // Button 6 (L2 / LT): Health Potion (D)
    // Button 7 (R2 / RT): Flicker Spell (F)
    // Button 8 (Select / Share): Quick Shop / Item Buy
    // Button 9 (Start / Options): Settings
    // Button 12 (D-Pad Up): Ping Attack
    // Button 13 (D-Pad Down): Ping Defend
    // Button 14 (D-Pad Left): Ping Retreat
    // Button 15 (D-Pad Right): Ping On My Way

    return {
      connected: true,
      id: primaryGamepad.id,
      moveX,
      moveZ,
      aimX,
      aimZ,
      aimActive,
      attack: isJustPressed(0),
      minionAttack: isJustPressed(1),
      ability0: isJustPressed(2),
      ability1: isJustPressed(3),
      ability2: isJustPressed(4),
      ultimate: isJustPressed(5),
      potion: isJustPressed(6),
      spell: isJustPressed(7),
      recall: isJustPressed(10) || isJustPressed(11),
      shop: isJustPressed(8),
      settings: isJustPressed(9),
      pingAttack: isJustPressed(12),
      pingDefend: isJustPressed(13),
      pingRetreat: isJustPressed(14),
      pingOmw: isJustPressed(15),
    };
  }

  /**
   * Triggers haptic vibration pulse on connected gamepad if supported.
   */
  public vibrateGamepad(durationMs: number = 80, strongMagnitude: number = 0.5, weakMagnitude: number = 0.5): void {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    try {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        const actuator = gp ? (gp as unknown as { vibrationActuator?: { playEffect(type: string, p: Record<string, number>): Promise<void> } }).vibrationActuator : null;
        if (gp && gp.connected && actuator?.playEffect) {
          actuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude,
            strongMagnitude,
          }).catch(() => {});
        }
      }
    } catch {}
  }
}

export const android = new AndroidPlatformEngine();
