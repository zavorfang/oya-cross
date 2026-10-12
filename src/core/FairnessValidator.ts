import { GAME } from '../config/game';
import { sweptRectangles } from './Collision';
import { sampleTraffic } from './Traffic';
import type { Cell, Row } from './types';

export interface FairnessResult { reachable: boolean; arrivalSeconds: number | null; visited: number }

/**
 * A time-expanded reachability smoke test: wait or hop from the near refuge to
 * the far refuge within five seconds. It checks the entire relative swept path,
 * not merely whether a row has a nominal gap. A small pad conservatively covers
 * the curved braking trajectory between samples. This is not a human-play guarantee.
 */
export function validateBundle(rows: Row[], startTime = 0, horizon = 5): FairnessResult {
  if (!rows.length) return { reachable: true, arrivalSeconds: 0, visited: 1 };
  const startZ = rows[0].z - 1;
  const targetZ = rows[rows.length - 1].z + 1;
  const encode = (cell: Cell) => `${cell.x},${cell.z}`;
  let frontier = new Map<string, Cell>([['0,' + startZ, { x: 0, z: startZ }]]);
  const moves = [[0, 1], [-1, 0], [1, 0], [0, 0], [0, -1]];
  let visited = 1;

  for (let step = 0; step < Math.floor(horizon / GAME.hopSeconds); step++) {
    const t0 = startTime + step * GAME.hopSeconds;
    const t1 = t0 + GAME.hopSeconds;
    const traffic = rows.flatMap(row => sampleTraffic(row, t1, t0));
    const next = new Map<string, Cell>();
    for (const from of frontier.values()) {
      for (const [dx, dz] of moves) {
        const to = { x: from.x + dx, z: from.z + dz };
        if (Math.abs(to.x) > GAME.halfWidth || to.z < startZ || to.z > targetZ || next.has(encode(to))) continue;
        if (traffic.some(car => sweptRectangles(from, to, car, 0.035))) continue;
        if (to.z === targetZ) return { reachable: true, arrivalSeconds: t1 - startTime, visited };
        next.set(encode(to), to);
      }
    }
    visited += next.size;
    frontier = next;
    if (!frontier.size) break;
  }
  return { reachable: false, arrivalSeconds: null, visited };
}
