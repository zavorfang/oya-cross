import { GAME } from '../config/game';
import { validateBundle } from './FairnessValidator';
import { PRNG } from './PRNG';
import { headwaySeconds, sampleTraffic } from './Traffic';
import type { Row, VehicleKind } from './types';

export class WorldGenerator {
  private rng: PRNG;
  private nextZ = 3;
  private bundle = 0;
  private pending: Row[];
  public fallbackCount = 0;

  constructor(public readonly seed: number) {
    this.rng = new PRNG(seed);
    this.pending = Array.from({ length: 11 }, (_, i) => this.safeRow(i - GAME.behindRows));
  }

  private safeRow(z: number, refuge = false): Row {
    return { z, kind: refuge ? 'refuge' : 'sidewalk', direction: 1, speed: 0, gap: 0,
      seed: (this.seed ^ Math.imul(z, 2654435761)) >>> 0, stop: false,
      vehicleKind: 'sedan', phase: 0, bundle: this.bundle };
  }

  private road(z: number, lane: number, attempt: number): Row {
    const early = z < 13;
    const mid = z < 36;
    const first = this.bundle === 0;
    const second = this.bundle === 1;
    const local = early || this.rng.next() < 0.42;
    const roll = this.rng.next();
    const vehicleKind: VehicleKind = first ? 'danfo' : second ? 'keke' :
      roll < 0.35 ? 'danfo' : local && roll < 0.54 ? 'keke' : roll < 0.84 ? 'sedan' : 'suv';
    const speed = z < 9 ? this.rng.between(1.8, 2.2) : early ? this.rng.between(1.8, 2.9) :
      mid ? this.rng.between(2.4, 3.8) : this.rng.between(3, 4.8);
    const row: Row = {
      z, kind: local ? 'road_local' : 'road_main', direction: ((this.bundle + lane) % 2 ? -1 : 1),
      speed: attempt === 3 ? 1.8 : speed,
      gap: attempt === 3 ? 5.8 : z < 9 ? 4.2 : early ? this.rng.between(2.7, 4.2) : mid ? this.rng.between(2.3, 3.5) : this.rng.between(1.8, 3),
      seed: this.rng.integer(0, 0xffffffff), stop: vehicleKind === 'danfo' && (first || this.rng.next() < 0.38),
      vehicleKind, phase: this.rng.next() * 20, bundle: this.bundle,
    };
    // Opening traffic is visible immediately, with a readable first center gap.
    if (z < 9) {
      const initialPhase = row.phase;
      const period = headwaySeconds(row);
      for (let i = 0; i < 64; i++) {
        row.phase = initialPhase + period * i / 64;
        let clear = true;
        for (let t = 0; t <= 1.2; t += 0.1) {
          if (sampleTraffic(row, t).some(car => Math.abs(car.x) < (car.length + GAME.playerSize) / 2 + 0.15)) { clear = false; break; }
        }
        if (clear) break;
      }
    }
    return row;
  }

  private generateBundle(): void {
    const count = this.bundle < 2 ? 1 : this.nextZ < 13 ? this.rng.integer(1, 2) :
      this.nextZ < 36 ? this.rng.integer(2, 3) : this.rng.integer(2, 4);
    let roads: Row[] = [];
    for (let attempt = 0; attempt <= 3; attempt++) {
      roads = Array.from({ length: count }, (_, lane) => this.road(this.nextZ + lane, lane, attempt));
      if (validateBundle(roads).reachable) break;
      this.fallbackCount++;
    }
    // A final slower, widely spaced alternative is still validated, not blindly accepted.
    if (!validateBundle(roads).reachable) {
      roads = [this.road(this.nextZ, 0, 3)];
      roads[0].stop = false;
      roads[0].gap = 8;
    }
    this.pending.push(...roads);
    this.nextZ += roads.length;
    this.pending.push(this.safeRow(this.nextZ++, this.bundle % 3 !== 0));
    if (this.bundle === 0 || (this.nextZ < 13 && this.rng.next() < 0.3)) this.pending.push(this.safeRow(this.nextZ++));
    this.bundle++;
  }

  takeThrough(z: number): Row[] {
    while (this.nextZ <= z) this.generateBundle();
    const result = this.pending.filter(row => row.z <= z);
    this.pending = this.pending.filter(row => row.z > z);
    return result;
  }
}

export function generateRows(seed: number, highestRow = 48): Row[] {
  return new WorldGenerator(seed).takeThrough(highestRow);
}
