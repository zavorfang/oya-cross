import { GAME } from '../config/game';
import type { Cell, Vehicle } from './types';

/** Relative-motion slab test, including boundary contact and stationary axes. */
export function sweptRectangles(
  from: Cell,
  to: Cell,
  vehicle: Pick<Vehicle, 'previousX' | 'x' | 'rowZ' | 'length' | 'width'>,
  padding = 0,
): boolean {
  const hx = (vehicle.length + GAME.playerSize) / 2 + padding;
  const hz = (vehicle.width + GAME.playerSize) / 2 + padding;
  const x0 = from.x - vehicle.previousX;
  const z0 = from.z - vehicle.rowZ;
  const dx = to.x - from.x - (vehicle.x - vehicle.previousX);
  const dz = to.z - from.z;
  let enter = 0;
  let exit = 1;

  for (const [origin, delta, half] of [[x0, dx, hx], [z0, dz, hz]]) {
    if (Math.abs(delta) < 1e-10) {
      if (Math.abs(origin) > half) return false;
    } else {
      const a = (-half - origin) / delta;
      const b = (half - origin) / delta;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
      if (enter > exit) return false;
    }
  }
  return enter <= exit;
}
