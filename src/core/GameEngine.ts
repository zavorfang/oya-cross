import { GAME } from '../config/game';
import { sweptRectangles } from './Collision';
import { sampleTraffic } from './Traffic';
import { WorldGenerator } from './WorldGenerator';
import type { Action, Cell, GameSnapshot, Player } from './types';

const ACTION_DELTA: Record<Action, Cell> = {
  forward: { x: 0, z: 1 }, back: { x: 0, z: -1 }, left: { x: -1, z: 0 }, right: { x: 1, z: 0 },
};

function newPlayer(): Player {
  return { cell: { x: 0, z: 0 }, from: { x: 0, z: 0 }, to: { x: 0, z: 0 },
    x: 0, z: 0, hopProgress: 0, moving: false, highestZ: 0 };
}

export class GameEngine {
  private state!: GameSnapshot;
  private world!: WorldGenerator;
  private queued: Action | null = null;
  private hopElapsed = 0;
  private hitElapsed = 0;
  private trailingElapsed = 0;
  private nearMissIds = new Set<string>();

  constructor(seed: number) { this.reset(seed); }
  get snapshot(): GameSnapshot { return this.state; }

  reset(seed = this.state.seed): void {
    this.world = new WorldGenerator(seed >>> 0);
    const rows = this.world.takeThrough(GAME.aheadRows);
    this.state = { phase: 'ready', seed: seed >>> 0, time: 0, score: 0, player: newPlayer(), rows,
      vehicles: rows.flatMap(row => sampleTraffic(row, 0)), deathReason: '', warning: false, nearMiss: 0 };
    this.queued = null;
    this.hopElapsed = 0;
    this.hitElapsed = 0;
    this.trailingElapsed = 0;
    this.nearMissIds.clear();
  }

  start(seed = this.state.seed): void { this.reset(seed); this.state.phase = 'playing'; }
  pause(): void { if (this.state.phase === 'playing') this.state.phase = 'paused'; }
  resume(): void { if (this.state.phase === 'paused') this.state.phase = 'playing'; }

  command(action: Action): void {
    if (this.state.phase !== 'playing') return;
    if (this.state.player.moving) {
      if (this.queued === null) this.queued = action;
      return;
    }
    this.beginHop(action);
  }

  private beginHop(action: Action): void {
    const p = this.state.player;
    const delta = ACTION_DELTA[action];
    const to = { x: p.cell.x + delta.x, z: p.cell.z + delta.z };
    if (Math.abs(to.x) > GAME.halfWidth || to.z < p.highestZ - GAME.behindRows + 1) return;
    p.from = { ...p.cell };
    p.to = to;
    p.moving = true;
    p.hopProgress = 0;
    this.hopElapsed = 0;
  }

  private hit(reason: string): void {
    if (this.state.phase !== 'playing') return;
    this.state.phase = 'hit';
    this.state.deathReason = reason;
    this.state.warning = false;
    this.queued = null;
    this.hitElapsed = 0;
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // The outer loop uses 1/60. Subdivision also makes direct large-tick callers safe.
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-8) {
      const step = Math.min(remaining, 1 / 60);
      this.tick(step);
      remaining -= step;
    }
  }

  private tick(dt: number): void {
    if (this.state.phase === 'hit') {
      this.hitElapsed += dt;
      if (this.hitElapsed >= GAME.impactSeconds) this.state.phase = 'result';
      return;
    }
    if (this.state.phase !== 'playing') return;
    const p = this.state.player;
    const from = { x: p.x, z: p.z };
    const previousTime = this.state.time;
    this.state.time += dt;
    if (p.moving) {
      this.hopElapsed = Math.min(GAME.hopSeconds, this.hopElapsed + dt);
      p.hopProgress = this.hopElapsed / GAME.hopSeconds;
      p.x = p.from.x + (p.to.x - p.from.x) * p.hopProgress;
      p.z = p.from.z + (p.to.z - p.from.z) * p.hopProgress;
    }
    this.state.vehicles = this.state.rows.flatMap(row => sampleTraffic(row, this.state.time, previousTime));
    const to = { x: p.x, z: p.z };
    const collision = this.state.vehicles.find(car => sweptRectangles(from, to, car));
    if (collision) {
      this.hit(collision.kind === 'danfo' ? 'Danfo had other plans.' : collision.kind === 'keke' ? 'Keke came through!' : 'Traffic caught up.');
      return;
    }
    for (const car of this.state.vehicles) {
      if (this.nearMissIds.has(car.id)) continue;
      const edgeBefore = car.direction * (car.previousX - from.x) - (car.length + GAME.playerSize) / 2;
      const edgeAfter = car.direction * (car.x - to.x) - (car.length + GAME.playerSize) / 2;
      const sideGap = Math.abs(p.z - car.rowZ) - (car.width + GAME.playerSize) / 2;
      if (edgeBefore <= GAME.nearMissGap && edgeAfter > GAME.nearMissGap && sideGap < GAME.nearMissGap) {
        this.nearMissIds.add(car.id);
        this.state.nearMiss++;
      }
    }
    if (p.moving && p.hopProgress >= 1) {
      p.cell = { ...p.to };
      p.moving = false;
      p.highestZ = Math.max(p.highestZ, p.cell.z);
      this.state.score = Math.max(0, p.highestZ);
      const added = this.world.takeThrough(p.highestZ + GAME.aheadRows);
      this.state.rows = [...this.state.rows, ...added].filter(row => row.z >= p.highestZ - GAME.behindRows);
      if (added.length) this.state.vehicles.push(...added.flatMap(row => sampleTraffic(row, this.state.time)));
      const minZ = p.highestZ - GAME.behindRows;
      for (const id of this.nearMissIds) if (Number(id.split(':')[0]) < minZ) this.nearMissIds.delete(id);
      if (this.queued !== null) {
        const action = this.queued;
        this.queued = null;
        this.beginHop(action);
      }
    }
    this.state.warning = p.highestZ - p.z >= GAME.trailingDistance;
    this.trailingElapsed = this.state.warning ? this.trailingElapsed + dt : 0;
    if (this.trailingElapsed >= GAME.trailingGrace) this.hit('Keep up with the city.');
  }
}
