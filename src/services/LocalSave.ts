export interface Preferences { sound: boolean; controls: boolean; reducedMotion: boolean }
export const BEST_KEY = 'lagos-crossing:v1:best';
export function readBest(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const value = Number((storage ?? localStorage).getItem(BEST_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}
export function writeBest(best: number, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? localStorage).setItem(BEST_KEY, String(best)); } catch { /* Local storage is optional. */ }
}
export function readPreferences(): Preferences {
  const defaults = { sound: false, controls: false, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
  try {
    const value = JSON.parse(localStorage.getItem('lagos-crossing:v1:preferences') ?? '{}');
    for (const key of Object.keys(defaults) as (keyof Preferences)[]) {
      if (typeof value?.[key] === 'boolean') defaults[key] = value[key];
    }
  } catch { /* Use defaults for unavailable or corrupt storage. */ }
  return defaults;
}
export function writePreferences(preferences: Preferences): void {
  try { localStorage.setItem('lagos-crossing:v1:preferences', JSON.stringify(preferences)); } catch { /* Optional. */ }
}
