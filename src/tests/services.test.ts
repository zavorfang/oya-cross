import { describe, expect, it } from 'vitest';
import { pointerAction } from '../core/InputController';
import { readBest, writeBest } from '../services/LocalSave';
describe('touch gestures in CSS pixels', () => {
  it('recognizes one tap or dominant-axis swipe', () => {
    expect(pointerAction(2, 3, 200)).toBe('forward');
    expect(pointerAction(28, 4, 300)).toBe('right');
    expect(pointerAction(-36, 4, 200)).toBe('left');
    expect(pointerAction(10, 40, 200)).toBe('back');
    expect(pointerAction(4, -40, 300)).toBe('forward');
  });
  it('ignores long presses and subthreshold drags', () => {
    expect(pointerAction(0, 0, 221)).toBeNull();
    expect(pointerAction(27, 0, 230)).toBeNull();
  });
});
describe('optional local best storage', () => {
  it.each(['broken', '-1', '1.5', 'Infinity', 'NaN', 'null'])('rejects corrupt value %s', value => {
    expect(readBest({ getItem: () => value })).toBe(0);
  });
  it('reads saved scores and tolerates blocked storage', () => {
    expect(readBest({ getItem: () => '42' })).toBe(42);
    expect(readBest({ getItem: () => { throw new Error('blocked'); } })).toBe(0);
    expect(() => writeBest(42, { setItem: () => { throw new Error('blocked'); } })).not.toThrow();
  });
});
