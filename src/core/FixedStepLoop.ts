export class FixedStepLoop {
  private accumulator = 0;
  readonly step = 1 / 60;
  advance(elapsed: number, active: boolean, update: (dt: number) => void): number {
    if (!active) { this.accumulator = 0; return 0; }
    this.accumulator = Math.min(this.accumulator + Math.max(0, elapsed), 0.12);
    let ticks = 0;
    while (this.accumulator >= this.step) { update(this.step); this.accumulator -= this.step; ticks++; }
    return ticks;
  }
  reset(): void { this.accumulator = 0; }
}
