/**
 * ABANDONED: HOSPITAL 13
 * Procedural Horror Audio Engine
 * Zero external audio files required.
 */

class HorrorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private isMuted = false;
  private isRunning = false;
  private isChasing = false;

  private heartbeatInterval: number | null = null;
  private spookyTimeout: number | null = null;

  private panicLevel = 0;
  private lastFootstep = 0;

  // --------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------

  public init() {
    if (this.ctx) {
      this.resume();
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {
          webkitAudioContext: typeof AudioContext;
        }).webkitAudioContext;

      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.7;
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.55;
      this.ambientGain.connect(this.masterGain);

      this.isRunning = true;

      this.startDarkDrone();
      this.startFluorescentHum();
      this.createWindHiss();
      this.scheduleSpookyStings();

      this.resume();
    } catch (error) {
      console.warn("Horror audio initialization failed:", error);
    }
  }

  public resume() {
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.7,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // --------------------------------------------------
  // INTERNAL SOUND HELPERS
  // --------------------------------------------------

  private getContext(): AudioContext | null {
    if (!this.ctx || this.isMuted) return null;

    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private playTone(
    frequency: number,
    duration: number,
    volume = 0.15,
    type: OscillatorType = "sine",
    endFrequency?: number
  ) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(
        Math.max(1, frequency),
        now
      );

      if (endFrequency !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, endFrequency),
          now + duration
        );
      }

      gain.gain.setValueAtTime(Math.max(0.001, volume), now);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + duration
      );

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Ignore unsupported audio operations.
    }
  }

  private playNoise(
    duration: number,
    volume: number,
    filterFrequency: number,
    filterType: BiquadFilterType = "lowpass"
  ) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const length = Math.max(
        1,
        Math.floor(ctx.sampleRate * duration)
      );

      const buffer = ctx.createBuffer(
        1,
        length,
        ctx.sampleRate
      );

      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      source.buffer = buffer;

      filter.type = filterType;
      filter.frequency.value = filterFrequency;

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration
      );

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      source.start();
      source.stop(ctx.currentTime + duration);
    } catch {
      // Ignore unsupported audio operations.
    }
  }

  // --------------------------------------------------
  // HOSPITAL AMBIENCE
  // --------------------------------------------------

  private startDarkDrone() {
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 100;

    const gain = ctx.createGain();
    gain.gain.value = 0.22;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    osc1.type = "sawtooth";
    osc1.frequency.value = 42;

    osc2.type = "sine";
    osc2.frequency.value = 46;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    osc1.start();
    osc2.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 22;

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
  }

  private startFluorescentHum() {
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.value = 60;

    filter.type = "lowpass";
    filter.frequency.value = 180;

    gain.gain.value = 0.025;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    osc.start();
  }

  private createWindHiss() {
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain) return;

    try {
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(
        1,
        length,
        ctx.sampleRate
      );

      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      noise.buffer = buffer;
      noise.loop = true;

      filter.type = "bandpass";
      filter.frequency.value = 280;
      filter.Q.value = 0.8;

      gain.gain.value = 0.035;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientGain);

      noise.start();
    } catch {}
  }

  // --------------------------------------------------
  // PLAYER FOOTSTEPS
  // --------------------------------------------------

  public playFootstep(isSprinting = false) {
    const now = Date.now();

    if (now - this.lastFootstep < 100) return;
    this.lastFootstep = now;

    this.playTone(
      isSprinting ? 85 : 65,
      0.11,
      isSprinting ? 0.22 : 0.13,
      "sine",
      28
    );

    this.playNoise(
      0.07,
      isSprinting ? 0.055 : 0.025,
      500,
      "lowpass"
    );
  }

  // --------------------------------------------------
  // MONSTER FOOTSTEPS
  // Call when the monster takes a step.
  // --------------------------------------------------

  public playMonsterFootstep() {
    this.playTone(
      48 + Math.random() * 12,
      0.22,
      0.32,
      "sine",
      20
    );

    this.playNoise(
      0.16,
      0.10,
      220,
      "lowpass"
    );
  }

  // --------------------------------------------------
  // MONSTER BREATHING
  // Call repeatedly while the monster is nearby.
  // --------------------------------------------------

  public playMonsterBreathing() {
    this.playNoise(
      0.65,
      0.13,
      650,
      "bandpass"
    );

    this.playTone(
      75,
      0.55,
      0.10,
      "sawtooth",
      48
    );
  }

  // --------------------------------------------------
  // MONSTER GROWL
  // --------------------------------------------------

  public playMonsterGrowl() {
    this.playTone(
      110,
      0.85,
      0.28,
      "sawtooth",
      32
    );

    this.playNoise(
      0.75,
      0.17,
      500,
      "bandpass"
    );
  }

  // --------------------------------------------------
  // CHASE START
  // --------------------------------------------------

  public playChaseStart() {
    if (this.isChasing) return;

    this.isChasing = true;

    this.playTone(90, 0.65, 0.32, "sawtooth", 38);
    this.playNoise(0.75, 0.22, 900, "bandpass");

    this.setPanicLevel(0.8);
  }

  public stopChase() {
    this.isChasing = false;
    this.setPanicLevel(0);
  }

  public getIsChasing(): boolean {
    return this.isChasing;
  }

  // --------------------------------------------------
  // HEARTBEAT
  // --------------------------------------------------

  public setPanicLevel(level: number) {
    this.panicLevel = Math.max(0, Math.min(1, level));

    if (this.panicLevel > 0.3 && !this.heartbeatInterval) {
      this.startHeartbeat();
    } else if (
      this.panicLevel <= 0.3 &&
      this.heartbeatInterval !== null
    ) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval !== null) return;

    const beat = () => {
      if (!this.isRunning || this.panicLevel <= 0.3) {
        if (this.heartbeatInterval !== null) {
          window.clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
        return;
      }

      this.playHeartbeatThud();

      const delay = 800 - this.panicLevel * 350;

      window.clearInterval(this.heartbeatInterval!);

      this.heartbeatInterval = window.setInterval(
        beat,
        delay
      );
    };

    this.heartbeatInterval = window.setInterval(
      beat,
      300
    );
  }

  private playHeartbeatThud() {
    this.playTone(
      58,
      0.16,
      0.23 * this.panicLevel,
      "sine",
      25
    );

    window.setTimeout(() => {
      this.playTone(
        48,
        0.13,
        0.16 * this.panicLevel,
        "sine",
        24
      );
    }, 150);
  }

  // --------------------------------------------------
  // JUMPSCARE
  // --------------------------------------------------

  public playStinger() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;

      // Sudden dissonant impact.
      const frequencies = [55, 82, 110, 165, 220, 311, 415];

      frequencies.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = index % 2 === 0 ? "sawtooth" : "square";

        osc.frequency.setValueAtTime(
          frequency * 1.6,
          now
        );

        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, frequency * 0.45),
          now + 0.8
        );

        gain.gain.setValueAtTime(
          index < 3 ? 0.19 : 0.10,
          now
        );

        gain.gain.exponentialRampToValueAtTime(
          0.001,
          now + 1.35
        );

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(now);
        osc.stop(now + 1.4);
      });

      this.playNoise(0.65, 0.30, 1400, "highpass");
    } catch {}
  }

  public playGameOver() {
    this.stopChase();
    this.playStinger();

    window.setTimeout(() => {
      this.playTone(65, 1.1, 0.20, "sine", 22);
    }, 350);
  }

  // --------------------------------------------------
  // FLASHLIGHT
  // --------------------------------------------------

  public playLightSpark() {
    this.playNoise(
      0.12,
      0.18,
      1800,
      "highpass"
    );

    this.playTone(
      280,
      0.12,
      0.08,
      "sawtooth",
      100
    );
  }

  public playFlashlightClick(turnOn: boolean) {
    this.playTone(
      turnOn ? 2000 : 1600,
      0.045,
      0.10,
      "triangle",
      450
    );
  }

  // --------------------------------------------------
  // PICKUP
  // --------------------------------------------------

  public playPickup() {
    this.playTone(520, 0.18, 0.14, "sine", 880);

    window.setTimeout(() => {
      this.playTone(880, 0.22, 0.12, "sine", 1100);
    }, 100);
  }

  // --------------------------------------------------
  // DOOR
  // --------------------------------------------------

  public playDoorCreak() {
    this.playTone(
      140,
      0.65,
      0.17,
      "sawtooth",
      75
    );

    this.playNoise(
      0.55,
      0.09,
      500,
      "bandpass"
    );
  }

  // --------------------------------------------------
  // DISTANT HORROR SOUNDS
  // --------------------------------------------------

  private scheduleSpookyStings() {
    if (this.spookyTimeout !== null) {
      window.clearTimeout(this.spookyTimeout);
    }

    const trigger = () => {
      if (!this.isRunning) return;

      if (!this.isMuted && Math.random() < 0.55) {
        if (Math.random() < 0.5) {
          this.playDistantClank();
        } else {
          this.playDistantWhisper();
        }
      }

      this.spookyTimeout = window.setTimeout(
        trigger,
        14000 + Math.random() * 18000
      );
    };

    this.spookyTimeout = window.setTimeout(
      trigger,
      10000
    );
  }

  private playDistantClank() {
    this.playTone(
      190 + Math.random() * 80,
      0.7,
      0.09,
      "triangle",
      55
    );
  }

  private playDistantWhisper() {
    this.playNoise(
      1.0,
      0.055,
      1200,
      "bandpass"
    );

    this.playTone(
      260,
      0.8,
      0.035,
      "sine",
      170
    );
  }

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  public dispose() {
    this.isRunning = false;
    this.isChasing = false;

    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.spookyTimeout !== null) {
      window.clearTimeout(this.spookyTimeout);
      this.spookyTimeout = null;
    }

    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }

    this.masterGain = null;
    this.ambientGain = null;
  }
}

export const horrorAudio = new HorrorAudioEngine();