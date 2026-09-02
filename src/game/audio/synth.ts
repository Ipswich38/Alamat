// Procedural Web Audio SFX Engine (Zero-Asset Sound Synthesizer)
//
// ── ZERO EXTERNAL ASSET ARCHITECTURE ──────────────────────────────────────────
// No MP3s, WAVs, or external sound files needed. Everything is synthesized
// in real-time via Web Audio API oscillators, noise generators, biquad filters,
// and exponential decay gain envelopes.
//
// Browsers require a user interaction (click / keypress / touch) to unlock
// the AudioContext. We lazily initialize and resume on first trigger.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private volume: number = 0.65;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.init();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true, once: true });
      window.addEventListener('touchstart', unlock, { passive: true, once: true });
      window.addEventListener('keydown', unlock, { passive: true, once: true });
    }
  }

  private init(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // ── COMBAT SOUNDS ─────────────────────────────────────────────────────────

  /** Blade slash / Blade metallic strike */
  public playMeleeHit() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Metallic ring (high resonance bandpass)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.12);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1320, now);
    osc2.frequency.exponentialRampToValueAtTime(440, now + 0.08);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);

    // Metal impact crunch (filtered noise)
    const noise = this.ctx.createBufferSource();
    const noiseBuffer = this.createNoiseBuffer();
    if (noiseBuffer) {
      noise.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.Q.setValueAtTime(3.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 0.1);
    }
  }

  /** Heavy blunt strike / Veer hoof stomp / Treant fist */
  public playBluntHit() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** Rushing dash woosh sound */
  public playDash() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;

    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.3);
    filter.Q.setValueAtTime(2.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.33);
  }

  /** Spell cast activation based on shape */
  public playSpellCast(shape: 'line' | 'cone' | 'ground' | 'projectile' | 'dash' | string = 'projectile') {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (shape === 'dash') {
      this.playDash();
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (shape === 'projectile' || shape === 'line') {
      // Laser / Beam / Ray Sweep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    } else if (shape === 'cone') {
      // Sweeping burst
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.25);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.27);
      return;
    } else {
      // Ground AoE summon / vortex
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(320, now + 0.2);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.45);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Spell impact / detonation */
  public playSpellImpact() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.33);
  }

  /** Tower firing energy beam */
  public playTowerShot() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.23);
  }

  /** Tower beam impact explosion */
  public playTowerImpact() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  /** Minion attack hit */
  public playMinionHit() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // ── UI, FANFARE & EVENT SOUNDS ────────────────────────────────────────────

  /** Tactical Ping Chime */
  public playPing(type: string = 'generic') {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const isDanger = type.toLowerCase().includes('danger') || type.toLowerCase().includes('retreat');
    const f1 = isDanger ? 880 : 659.25; // A5 or E5
    const f2 = isDanger ? 1174.66 : 1046.5; // D6 or C6

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f1, now);
    osc1.frequency.setValueAtTime(f2, now + 0.08);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(f1 * 1.5, now);
    osc2.frequency.setValueAtTime(f2 * 1.5, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  }

  /** Level Up Fanfare (Ascending Major Pentatonic Arpeggio) */
  public playLevelUp() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    const stepDuration = 0.07;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const noteTime = now + idx * stepDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.35, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  }

  /** Hero / Boss Takedown Mythic Gong */
  public playKillAnnouncement() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Sub-bass gong
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.9);
  }

  /** Victory Horn Fanfare */
  public playVictory() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const chords = [
      [523.25, 659.25, 783.99], // C Major
      [587.33, 739.99, 880.0],  // D Major
      [659.25, 830.61, 987.77], // E Major
      [783.99, 987.77, 1174.66, 1567.98], // G Major / Octave
    ];

    chords.forEach((chord, step) => {
      const stepTime = now + step * 0.28;
      chord.forEach((freq) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, stepTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, stepTime);

        gain.gain.setValueAtTime(0.25, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.45);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(stepTime);
        osc.stop(stepTime + 0.5);
      });
    });
  }

  /** Shop Item Purchase Coin Sound */
  public playBuyItem() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [1567.98, 2093.0].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const noteTime = now + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    });
  }

  /** Health potion gulp & sparkle */
  public playPotion() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.15);
    osc.frequency.linearRampToValueAtTime(600, now + 0.25);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  /** Traditional Chime bronze gong 5-note pattern (ancient Gong Melody) */
  public playChimeChime() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    // Chime tuning pentatonic scale (E5, F#5, G#5, B5, C#6)
    const freqs = [659.25, 739.99, 830.61, 987.77, 1108.73];

    freqs.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.08;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Fundamental metallic bell
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(f, t);

      // Bronze high harmonic overtone
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(f * 2.76, t);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.48);
      osc2.stop(t + 0.48);
    });
  }

  /** Traditional Bamboo Reed Jaw Harp twang */
  public playReedTwang() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.25);
    filter.Q.setValueAtTime(6.0, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Altar Shrine Blessing Fanfare */
  public playAltarBlessing() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [440, 554.37, 659.25, 880, 1108.73].forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  /** Maw Celestial Eclipse Deep War Gong */
  public playEclipseGong() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 1.5);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.85);
  }

  /** First Blood (Unang Dugo) Announcement Fanfare */
  public playFirstBlood() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // War drum punch
    const drum = this.ctx.createOscillator();
    const drumGain = this.ctx.createGain();
    drum.type = 'sine';
    drum.frequency.setValueAtTime(180, now);
    drum.frequency.exponentialRampToValueAtTime(40, now + 0.35);
    drumGain.gain.setValueAtTime(0.8, now);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    drum.connect(drumGain);
    drumGain.connect(this.masterGain);
    drum.start(now);
    drum.stop(now + 0.42);

    // Rising brass fanfare (G4 -> C5 -> E5 -> G5)
    [392.0, 523.25, 659.25, 783.99].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + 0.08 + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  /** Double Kill (Dalawang Pagpaslang) */
  public playDoubleKill() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [587.33, 880.0, 1174.66].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  /** Triple Kill (Tatlong Pagpaslang) */
  public playTripleKill() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, t);

      gain.gain.setValueAtTime(0.38, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  /** Mega Kill / Rampage (Walang Kapantay!) */
  public playMegaKill() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Sub-bass rumble
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(80, now);
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.8);
    subGain.gain.setValueAtTime(0.7, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.95);

    // Shimmering choral arpeggios
    [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + 0.05 + idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  /** Structure/Tower Collapse Rumble */
  public playTowerDestroyed(isAlly = false) {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Deep earthquake crash
    const noise = this.ctx.createBufferSource();
    const buffer = this.createNoiseBuffer();
    if (buffer) {
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(60, now + 0.8);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.9);
    }

    // Horn tone
    const horn = this.ctx.createOscillator();
    const hornGain = this.ctx.createGain();
    horn.type = 'sawtooth';
    horn.frequency.setValueAtTime(isAlly ? 160 : 320, now + 0.1);
    horn.frequency.exponentialRampToValueAtTime(isAlly ? 90 : 440, now + 0.7);

    const hFilter = this.ctx.createBiquadFilter();
    hFilter.type = 'lowpass';
    hFilter.frequency.setValueAtTime(1000, now + 0.1);

    hornGain.gain.setValueAtTime(0.4, now + 0.1);
    hornGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    horn.connect(hFilter);
    hFilter.connect(hornGain);
    hornGain.connect(this.masterGain);
    horn.start(now + 0.1);
    horn.stop(now + 0.8);
  }

  /** Epic Maw Slain Triumphant Mythic Chime */
  public playMawSlain() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    this.playEclipseGong();
    this.playLevelUp();
    this.playChimeChime();
  }

  /** Multi-Kill Triumphant Brass & Synth Fanfare */
  public playMultiKill(count: number = 2) {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (count === 2) {
      // Double Kill: Duo punchy brass blast (G5 -> C6)
      const freqs = [783.99, 1046.5];
      freqs.forEach((f, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const t = now + idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.38, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    } else if (count === 3) {
      // Triple Kill: Triad fanfares (E5 -> G5 -> E6)
      const freqs = [659.25, 783.99, 1318.51];
      freqs.forEach((f, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const t = now + idx * 0.11;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.42, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.42);
      });
      this.playKillAnnouncement();
    } else if (count === 4) {
      // Mega / Quadra Kill: High-energy power ascent (C5 -> E5 -> G5 -> C6 -> G6)
      const freqs = [523.25, 659.25, 783.99, 1046.5, 1567.98];
      freqs.forEach((f, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const t = now + idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.48);
      });
      this.playEclipseGong();
    } else {
      // 5+ Savage / Legendary / Pentakill: Full mythical major progression + gong
      this.playVictory();
      this.playEclipseGong();
      this.playChimeChime();
    }
  }

  /** Shutdown / End of Enemy Killing Spree */
  public playShutdown() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [880.0, 739.99, 587.33, 440.0];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  /** Objective / Boss Slain Fanfare */
  public playObjectiveSlay(_bossName: string = 'Boss') {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    this.playKillAnnouncement();
    this.playLevelUp();
  }

  /** Defeat (Kasawian) Solemn Minor Progression */
  public playDefeat() {
    if (!this.init() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const chords = [
      [440.0, 523.25, 659.25], // A minor
      [392.0, 466.16, 587.33], // G minor
      [349.23, 415.3, 523.25], // F minor
      [220.0, 261.63, 329.63], // Low A minor
    ];

    chords.forEach((chord, step) => {
      const stepTime = now + step * 0.45;
      chord.forEach((freq) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, stepTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, stepTime);

        gain.gain.setValueAtTime(0.28, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(stepTime);
        osc.stop(stepTime + 0.65);
      });
    });
  }
}

export const sound = new SoundEngine();
