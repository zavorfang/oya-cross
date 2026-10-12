export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'manual';
export function challengeText(score: number, seed: number): string {
  const url = new URL(location.href);
  url.searchParams.set('seed', String(seed));
  return `I crossed ${score} steps in Lagos Crossing. Beat that: ${url.href}`;
}
export async function shareChallenge(score: number, seed: number): Promise<ShareResult> {
  const text = challengeText(score, seed);
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: 'Lagos Crossing', text }); return 'shared'; }
    catch (error) { if (error instanceof Error && error.name === 'AbortError') return 'cancelled'; }
  }
  try {
    if (!navigator.clipboard?.writeText) return 'manual';
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch { return 'manual'; }
}
