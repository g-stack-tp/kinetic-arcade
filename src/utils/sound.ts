class ArcadeSoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'triangle', delay = 0, gainPeak = 0.08) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Ignore audio failures when blocked by browser autoplay policy
    }
  }

  playQuestComplete(enabled: boolean) {
    if (!enabled) return;
    this.playTone(523.25, 0.14, 'triangle', 0, 0.07);
    this.playTone(659.25, 0.18, 'triangle', 0.07, 0.07);
  }

  playCoinClaim(enabled: boolean) {
    if (!enabled) return;
    this.playTone(880, 0.09, 'sine', 0, 0.06);
    this.playTone(1174.66, 0.16, 'sine', 0.06, 0.07);
  }

  playLevelUp(enabled: boolean) {
    if (!enabled) return;
    this.playTone(523.25, 0.14, 'triangle', 0, 0.08);
    this.playTone(659.25, 0.14, 'triangle', 0.08, 0.08);
    this.playTone(783.99, 0.14, 'triangle', 0.16, 0.08);
    this.playTone(1046.5, 0.28, 'triangle', 0.24, 0.09);
  }

  playTimerBell(enabled: boolean) {
    if (!enabled) return;
    this.playTone(587.33, 0.25, 'sine', 0, 0.08);
    this.playTone(880, 0.35, 'sine', 0.14, 0.08);
  }
}

export const arcadeSound = new ArcadeSoundEngine();
