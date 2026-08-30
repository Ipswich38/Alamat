// Mobile Haptic Feedback Vibration Engine
//
// ── PURPOSE ─────────────────────────────────────────────────────────────────
// Visceral tactile feedback for mobile devices running Talisman.
// Adapts dynamically to user preferences (on/off) and browser capability.

class HapticEngine {
  private enabled: boolean = true;

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

  private vibrate(pattern: number | number[]): void {
    if (!this.enabled || typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration restrictions on some mobile browsers
      }
    }
  }

  /** Subtle 10ms tick on UI touch or joystick snap */
  public tick(): void {
    this.vibrate(10);
  }

  /** 25ms crisp snap on skillshot release / ability cast */
  public cast(): void {
    this.vibrate(25);
  }

  /** 35ms solid pulse on hitting an enemy */
  public hit(): void {
    this.vibrate(35);
  }

  /** Dual pulse [40, 30, 60] on critical hit or big ability strike */
  public crit(): void {
    this.vibrate([40, 30, 60]);
  }

  /** 50ms pulse when taking damage */
  public damage(): void {
    this.vibrate(50);
  }

  /** Danger double-beat [80, 50, 80] when health is critically low (<25%) */
  public lowHealthDanger(): void {
    this.vibrate([80, 50, 80]);
  }

  /** Level-Up fanfare rhythm [30, 40, 50, 40, 90] */
  public levelUp(): void {
    this.vibrate([30, 40, 50, 40, 90]);
  }

  /** Hero takedown impact [70, 50, 110] */
  public kill(): void {
    this.vibrate([70, 50, 110]);
  }

  /** Tower destruction rumble [120, 60, 150] */
  public towerDestroyed(): void {
    this.vibrate([120, 60, 150]);
  }

  /** Triumphant match victory fanfare [100, 50, 100, 50, 240] */
  public victory(): void {
    this.vibrate([100, 50, 100, 50, 240]);
  }
}

export const haptics = new HapticEngine();
