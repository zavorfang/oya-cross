import { describe, it, expect, vi } from 'vitest';
import { FixedStepLoop } from '../core/FixedStepLoop';
describe('fixed step browser timing', () => {
  it('does not replay time spent paused', () => {
    const loop = new FixedStepLoop(); const tick = vi.fn();
    loop.advance(.01, true, tick); loop.advance(40, false, tick);
    expect(loop.advance(.01, true, tick)).toBe(0);
    expect(loop.advance(.01, true, tick)).toBe(1);
  });
  it('caps catch-up work after a long frame and uses fixed intervals', () => {
    const loop = new FixedStepLoop(); const tick = vi.fn();
    expect(loop.advance(60, true, tick)).toBe(7);
    expect(tick.mock.calls.every(([dt]) => dt === 1 / 60)).toBe(true);
  });
});
