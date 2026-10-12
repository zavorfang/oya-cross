import { afterEach, describe, expect, it, vi } from 'vitest';
import { challengeText, shareChallenge } from '../services/Share';

afterEach(() => vi.unstubAllGlobals());
function browser(navigator: Record<string, unknown>) {
  vi.stubGlobal('location', { href: 'https://example.com/games/lagos/?campaign=friends' });
  vi.stubGlobal('navigator', navigator);
}
describe('challenge sharing', () => {
  it('keeps deployment path and adds a reproducible route to the exact challenge message', () => {
    browser({});
    expect(challengeText(21, 876)).toBe('I crossed 21 steps in Lagos Crossing. Beat that: https://example.com/games/lagos/?campaign=friends&seed=876');
  });
  it('reports native sharing only after the platform accepts it', async () => {
    const share = vi.fn().mockResolvedValue(undefined); browser({ share });
    expect(await shareChallenge(21, 876)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Lagos Crossing', text: challengeText(21, 876) });
  });
  it('does not claim a copy after the player cancels native sharing', async () => {
    const copy = vi.fn();
    browser({ share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')), clipboard: { writeText: copy } });
    expect(await shareChallenge(21, 876)).toBe('cancelled');
    expect(copy).not.toHaveBeenCalled();
  });
  it('copies when native sharing fails and confirms only successful clipboard writes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    browser({ share: vi.fn().mockRejectedValue(new Error('unavailable')), clipboard: { writeText } });
    expect(await shareChallenge(21, 876)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(challengeText(21, 876));
  });
  it('offers manual text when clipboard is blocked or absent', async () => {
    browser({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await shareChallenge(21, 876)).toBe('manual');
    browser({});
    expect(await shareChallenge(21, 876)).toBe('manual');
  });
});
