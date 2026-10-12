export class AudioManager {
  private context?: AudioContext;
  enabled = false;
  private lastHorn = -10;
  unlock(): void {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch { /* Audio is optional; silent play always works. */ }
  }
  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, endFrequency?: number, delay = 0): void {
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running') return;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency ?? frequency, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at); oscillator.stop(at + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  hop(): void { this.tone(360, 0.065, 'sine', 0.065, 620); }
  hit(): void { this.tone(190, 0.22, 'triangle', 0.12, 45); }
  record(): void { this.tone(660, 0.15, 'sine', 0.055); this.tone(880, 0.25, 'sine', 0.045, 880, 0.1); }
  nearMiss(): void { this.tone(820, 0.13, 'sine', 0.04, 1300); }
  horn(time: number): void {
    if (time - this.lastHorn < 3) return;
    this.lastHorn = time;
    this.tone(260, 0.1, 'triangle', 0.04);
    this.tone(330, 0.15, 'triangle', 0.04, 330, 0.12);
  }
  reset(): void { this.lastHorn = -10; }
  suspend(): void { void this.context?.suspend().catch(() => undefined); }
}
