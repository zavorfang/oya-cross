import type { Action } from './types';
export function pointerAction(dx: number, dy: number, elapsed: number): Action | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= 28) {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'back' : 'forward');
  }
  return elapsed <= 220 ? 'forward' : null;
}
const keyActions: Record<string, Action> = {
  ArrowUp: 'forward', w: 'forward', W: 'forward', ArrowDown: 'back', s: 'back', S: 'back',
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
};
export class InputController {
  private abort = new AbortController();
  constructor(surface: HTMLElement, command: (action: Action) => void, togglePause: () => void, primary: () => void) {
    const options = { signal: this.abort.signal };
    let pointer: { id: number; x: number; y: number; time: number } | undefined;
    surface.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('button, input, a, textarea, [data-ui]')) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
      surface.setPointerCapture(event.pointerId);
    }, options);
    surface.addEventListener('pointerup', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const action = pointerAction(event.clientX - pointer.x, event.clientY - pointer.y, performance.now() - pointer.time);
      pointer = undefined;
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
      if (action) command(action);
    }, options);
    surface.addEventListener('pointercancel', () => { pointer = undefined; }, options);
    window.addEventListener('keydown', event => {
      if ((event.target as HTMLElement).closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
      const action = keyActions[event.key];
      if (action) { event.preventDefault(); if (!event.repeat) command(action); }
      else if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') { event.preventDefault(); if (!event.repeat) togglePause(); }
      else if ((event.key === ' ' || event.key === 'Enter') && !(event.target as HTMLElement).closest('button, a')) {
        event.preventDefault(); if (!event.repeat) primary();
      }
    }, options);
  }
  dispose(): void { this.abort.abort(); }
}
