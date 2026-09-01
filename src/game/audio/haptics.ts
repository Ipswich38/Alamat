// Mobile & Gamepad Haptic Feedback Vibration Engine (Alamat MOBA)
//
// ── PURPOSE ─────────────────────────────────────────────────────────────────
// Visceral tactile feedback for Android mobile devices and Bluetooth gamepads.
// Adapts dynamically to user preferences (on/off) and browser capability.

import { android } from '@/game/platform/android';

class HapticEngine {
  private enabled: boolean = true;
  private intensity: number = 1.0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('talisman_player_profile_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.settings?.hapticsEnabled !== undefined) {
            this.enabled = !!parsed.settings.hapticsEnabled;
          }
        }
      } catch {
        // Fallback default enabled
      }
    }
  }

  public setEnabled(value: boolean): void {
    this.enabled = value;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setIntensity(val: number): void {
    this.intensity = Math.max(0.2, Math.min(1.5, val));
  }

  private vibrate(pattern: number | number[]): void {
    if (!this.enabled || typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        if (typeof pattern === 'number') {
          navigator.vibrate(Math.max(1, Math.round(pattern * this.intensity)));
        } else {
          navigator.vibrate(pattern.map((p) => Math.max(1, Math.round(p * this.intensity))));
        }
      } catch {
        // Ignore vibration restrictions on some mobile browsers
      }
    }
  }

  /** Subtle 12ms tick on UI touch, cancel zone or joystick snap */
  public tick(): void {
    this.vibrate(12);
  }

  /** 20ms cancel tick when dragging into cancel zone */
  public cancel(): void {
    this.vibrate([15, 10, 15]);
  }

  /** 25ms crisp snap on skillshot release / ability cast */
  public cast(): void {
    this.vibrate(25);
    android.vibrateGamepad(40, 0.4, 0.2);
  }

  /** 35ms solid pulse on hitting an enemy */
  public hit(): void {
    this.vibrate(35);
    android.vibrateGamepad(60, 0.5, 0.4);
  }

  /** Dual pulse [40, 30, 60] on critical hit or big ability strike */
  public crit(): void {
    this.vibrate([40, 30, 60]);
    android.vibrateGamepad(120, 0.8, 0.6);
  }

  /** 50ms pulse when taking damage */
  public damage(): void {
    this.vibrate(50);
    android.vibrateGamepad(80, 0.6, 0.5);
  }

  /** Danger double-beat [80, 50, 80] when health is critically low (<25%) */
  public lowHealthDanger(): void {
    this.vibrate([80, 50, 80]);
    android.vibrateGamepad(150, 0.7, 0.7);
  }

  /** Level-Up fanfare rhythm [30, 40, 50, 40, 90] */
  public levelUp(): void {
    this.vibrate([30, 40, 50, 40, 90]);
    android.vibrateGamepad(200, 0.5, 0.9);
  }

  /** Hero takedown impact [70, 50, 110] */
  public kill(): void {
    this.vibrate([70, 50, 110]);
    android.vibrateGamepad(220, 0.9, 0.8);
  }

  /** Tower destruction rumble [120, 60, 150] */
  public towerDestroyed(): void {
    this.vibrate([120, 60, 150]);
    android.vibrateGamepad(300, 1.0, 0.7);
  }

  /** Triumphant match victory fanfare [100, 50, 100, 50, 240] */
  public victory(): void {
    this.vibrate([100, 50, 100, 50, 240]);
    android.vibrateGamepad(400, 0.8, 1.0);
  }
}

export const haptics = new HapticEngine();
