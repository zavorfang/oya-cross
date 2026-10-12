import { describe, expect, it } from 'vitest';
import { GAME } from '../config/game';
import { sweptRectangles } from '../core/Collision';
import { validateBundle } from '../core/FairnessValidator';
import { GameEngine } from '../core/GameEngine';
import { PRNG } from '../core/PRNG';
import { headwaySeconds, isRoad, sampleTraffic, travelAtAge } from '../core/Traffic';
import { generateRows, WorldGenerator } from '../core/WorldGenerator';
import { VEHICLE_DIMENSIONS } from '../core/types';
import type { Action, Row } from '../core/types';

const STEP = 1 / 60;
function tick(game: GameEngine, count: number): void {
  for (let i = 0; i < count; i++) game.update(STEP);
}
function hop(game: GameEngine, action: Action): void { game.command(action); tick(game, 11); }
function lane(overrides: Partial<Row> = {}): Row {
  return { z: 3, kind: 'road_local', direction: 1, speed: 2, gap: 3.5,
    seed: 1, stop: false, vehicleKind: 'sedan', phase: 1.3, bundle: 0, ...overrides };
}

describe('movement, scoring and lifecycle', () => {
  it('holds a rich frozen ready scene until start', () => {
    const game = new GameEngine(41);
    const before = JSON.stringify(game.snapshot);
    expect(game.snapshot.vehicles.length).toBeGreaterThan(10);
    game.command('forward'); tick(game, 60);
    expect(JSON.stringify(game.snapshot)).toBe(before);
    game.start();
    expect(game.snapshot.phase).toBe('playing');
  });

  it('moves a continuous footprint and commits one logical cell per completed hop', () => {
    const game = new GameEngine(42); game.start(); game.command('forward');
    tick(game, 5);
    expect(game.snapshot.player.z).toBeGreaterThan(0);
    expect(game.snapshot.player.z).toBeLessThan(1);
    expect(game.snapshot.player.cell).toEqual({ x: 0, z: 0 });
    tick(game, 6);
    expect(game.snapshot.player.cell).toEqual({ x: 0, z: 1 });
    expect(game.snapshot.player.moving).toBe(false);
    hop(game, 'left'); hop(game, 'right');
    expect(game.snapshot.player.cell).toEqual({ x: 0, z: 1 });
    expect(game.snapshot.score).toBe(1);
  });

  it('scores sequence 0,1,2,1,2,3 only at each new maximum', () => {
    const game = new GameEngine(84); game.start();
    const scores = [game.snapshot.score];
    for (const action of ['forward', 'forward', 'back', 'forward', 'forward'] as Action[]) {
      hop(game, action); scores.push(game.snapshot.score);
    }
    expect(scores).toEqual([0, 1, 2, 2, 2, 3]);
    expect(game.snapshot.phase).toBe('playing');
  });

  it('blocks both lateral edges without moving or awarding points', () => {
    const game = new GameEngine(8); game.start();
    for (let i = 0; i < 12; i++) hop(game, 'left');
    expect(game.snapshot.player.cell.x).toBe(-5);
    for (let i = 0; i < 20; i++) hop(game, 'right');
    expect(game.snapshot.player.cell.x).toBe(5);
    expect(game.snapshot.score).toBe(0);
  });

  it('accepts only one queued action while hopping', () => {
    const game = new GameEngine(8); game.start();
    game.command('forward'); game.command('left');
    for (let i = 0; i < 100; i++) game.command('forward');
    tick(game, 120);
    expect(game.snapshot.player.cell).toEqual({ x: -1, z: 1 });
    expect(game.snapshot.score).toBe(1);
  });

  it('pauses the exact hop and traffic clock, resumes without catch-up, and resets all state', () => {
    const game = new GameEngine(8); game.start(); game.command('forward'); tick(game, 5);
    game.pause(); const before = JSON.stringify(game.snapshot);
    tick(game, 1800); game.command('left');
    expect(JSON.stringify(game.snapshot)).toBe(before);
    game.resume(); tick(game, 6);
    expect(game.snapshot.player.cell).toEqual({ x: 0, z: 1 });
    game.start(22);
    const fresh = new GameEngine(22); fresh.start();
    expect(game.snapshot).toEqual(fresh.snapshot);
  });

  it('warns before a trailing death, ignores dead input, and reaches results in under 0.7 seconds', () => {
    const game = new GameEngine(8); game.start();
    for (let i = 0; i < 6; i++) hop(game, 'back');
    expect(game.snapshot.warning).toBe(true);
    expect(game.snapshot.phase).toBe('playing');
    tick(game, 60);
    expect(game.snapshot.phase).toBe('playing');
    tick(game, 31);
    expect(game.snapshot.phase).toBe('hit');
    const position = { ...game.snapshot.player.cell };
    game.command('forward'); tick(game, 35);
    expect(game.snapshot.phase).toBe('result');
    expect(game.snapshot.player.cell).toEqual(position);
    expect(game.snapshot.deathReason).toBe('Keep up with the city.');
    game.start();
    expect(game.snapshot.warning).toBe(false);
    expect(game.snapshot.deathReason).toBe('');
    expect(game.snapshot.score).toBe(0);
  });

  it('clears the trailing warning when the player comes back into view', () => {
    const game = new GameEngine(8); game.start();
    for (let i = 0; i < 6; i++) hop(game, 'back');
    tick(game, 30); hop(game, 'forward'); tick(game, 120);
    expect(game.snapshot.warning).toBe(false);
    expect(game.snapshot.phase).toBe('playing');
  });

  it('hits once when waiting in real traffic, freezes the crash, and permits immediate retry', () => {
    const game = new GameEngine(17); game.start();
    hop(game, 'forward'); hop(game, 'forward'); hop(game, 'forward');
    expect(game.snapshot.score).toBe(3);
    for (let i = 0; i < 600 && game.snapshot.phase === 'playing'; i++) game.update(STEP);
    expect(game.snapshot.phase).toBe('hit');
    const crashTime = game.snapshot.time;
    const cause = game.snapshot.deathReason;
    tick(game, 42);
    expect(game.snapshot.phase).toBe('result');
    expect(game.snapshot.time).toBe(crashTime);
    expect(game.snapshot.deathReason).toBe(cause);
    game.start(); expect(game.snapshot.player.cell).toEqual({ x: 0, z: 0 });
  });

  it('replays identical actions and simulation ticks deterministically', () => {
    const a = new GameEngine(792), b = new GameEngine(792); a.start(); b.start();
    for (let i = 0; i < 600; i++) {
      if (i % 23 === 0) { const action = (['forward', 'left', 'back', 'right'] as Action[])[i % 4]; a.command(action); b.command(action); }
      a.update(STEP); b.update(STEP);
    }
    expect(a.snapshot).toEqual(b.snapshot);
  });
});

describe('relative swept rectangle collision', () => {
  const car = { x: 0, previousX: 0, rowZ: 0, length: 1.45, width: 0.74 };
  it('hits identical positions and exact boundary contact', () => {
    expect(sweptRectangles({ x: 0, z: 0 }, { x: 0, z: 0 }, car)).toBe(true);
    const x = (car.length + GAME.playerSize) / 2;
    expect(sweptRectangles({ x, z: 0 }, { x, z: 0 }, car)).toBe(true);
    expect(sweptRectangles({ x: x + 0.001, z: 0 }, { x: x + 0.001, z: 0 }, car)).toBe(false);
  });
  it('catches fast cars passing entirely through a stationary footprint', () => {
    expect(sweptRectangles({ x: 0, z: 0 }, { x: 0, z: 0 }, { ...car, previousX: -4, x: 4 })).toBe(true);
    expect(sweptRectangles({ x: 0, z: 2 }, { x: 0, z: 2 }, { ...car, previousX: -4, x: 4 })).toBe(false);
  });
  it('checks the player hop path and relative timing, rather than just destination or union boxes', () => {
    expect(sweptRectangles({ x: -2, z: 0 }, { x: 2, z: 0 }, car)).toBe(true);
    expect(sweptRectangles({ x: -2, z: 0 }, { x: 2, z: 0 }, { ...car, previousX: 2, x: 6 })).toBe(false);
    expect(sweptRectangles({ x: 0, z: -1 }, { x: 0, z: 1 }, car)).toBe(true);
  });
});

describe('deterministic traffic and danfo stops', () => {
  it('spawns new vehicles far outside play boundaries with more than one second of approach', () => {
    for (const direction of [-1, 1] as const) {
      const row = lane({ direction, speed: 4.8 });
      let ids = new Set(sampleTraffic(row, 0).map(car => car.id));
      let births = 0;
      for (let i = 1; i < 1200; i++) {
        const cars = sampleTraffic(row, i * STEP, (i - 1) * STEP);
        for (const car of cars) if (!ids.has(car.id)) {
          births++;
          const edgeDistance = Math.abs(car.x) - car.length / 2 - GAME.halfWidth;
          expect(edgeDistance / row.speed).toBeGreaterThan(1);
          expect(Math.abs(car.x)).toBeGreaterThan(13.8);
        }
        ids = new Set(cars.map(car => car.id));
      }
      expect(births).toBeGreaterThan(4);
    }
  });

  it('stops each danfo at its designated stop and smoothly resumes without reversing', () => {
    const row = lane({ vehicleKind: 'danfo', stop: true, speed: 2.6 });
    let stopped = 0, previousDistance = -Infinity, previousSpeed = row.speed;
    for (let i = 0; i < 1000; i++) {
      const travel = travelAtAge(row, i * STEP);
      expect(travel.distance).toBeGreaterThanOrEqual(previousDistance);
      expect(Math.abs(travel.speed - previousSpeed)).toBeLessThanOrEqual(row.speed / GAME.brakeSeconds * STEP + 1e-8);
      if (travel.stopped) { stopped++; expect(travel.distance - GAME.trafficBoundary).toBeCloseTo(GAME.stopPosition); }
      previousDistance = travel.distance; previousSpeed = travel.speed;
    }
    expect(stopped).toBeGreaterThan(45);
    expect(previousSpeed).toBe(row.speed);
  });

  it('preserves minimum physical headways even through stop/start compression', () => {
    for (const direction of [-1, 1] as const) {
      const row = lane({ direction, vehicleKind: 'danfo', stop: true, speed: 4.8, gap: 1.8 });
      expect(headwaySeconds(row)).toBeGreaterThanOrEqual((VEHICLE_DIMENSIONS.danfo.length + row.gap) / row.speed);
      for (let i = 0; i < 400; i++) {
        const cars = sampleTraffic(row, i * 0.05).sort((a, b) => a.x - b.x);
        for (let c = 1; c < cars.length; c++) {
          expect(cars[c].x - cars[c - 1].x - cars[c].length).toBeGreaterThanOrEqual(row.gap - 1e-8);
        }
      }
    }
  });
});

describe('seeded world generation and reachability smoke tests', () => {
  it('reproduces rows and PRNG outputs, and changes layouts when the seed changes', () => {
    expect(generateRows(123, 60)).toEqual(generateRows(123, 60));
    expect(generateRows(123, 60)).not.toEqual(generateRows(124, 60));
    const a = new PRNG(0), b = new PRNG(0);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it('generates the same world incrementally without duplicate or missing row IDs', () => {
    const world = new WorldGenerator(229);
    const streamed = [24, 27, 33, 47, 60, 81, 100].flatMap(z => world.takeThrough(z));
    expect(streamed).toEqual(generateRows(229, 100));
    expect(new Set(streamed.map(row => row.z)).size).toBe(streamed.length);
    expect(world.takeThrough(100)).toEqual([]);
  });

  it('actually rejects a solid barrier and finds a route through moving gaps', () => {
    expect(validateBundle([lane({ gap: 0.01 })]).reachable).toBe(false);
    const route = validateBundle([lane({ z: 3 }), lane({ z: 4, direction: -1, phase: 2.8 })]);
    expect(route.reachable).toBe(true);
    expect(route.arrivalSeconds).toBeLessThanOrEqual(5);
    expect(route.visited).toBeGreaterThan(3);
  });

  it('keeps opening center traffic clear through the first reaction window', () => {
    for (let seed = 0; seed < 48; seed++) {
      const rows = generateRows(seed, 8).filter(isRoad);
      for (const row of rows) for (let t = 0; t <= 1.2; t += 0.05) {
        for (const car of sampleTraffic(row, t)) expect(Math.abs(car.x)).toBeGreaterThan((car.length + GAME.playerSize) / 2);
      }
    }
  });

  it('sweeps 128 seeds for safe onboarding, valid lanes, local-only kekes, refuges, and reachable bundles', () => {
    for (let seed = 0; seed < 128; seed++) {
      const rows = generateRows(seed, 48);
      expect(rows.filter(row => row.z >= 0 && row.z <= 2).every(row => !isRoad(row))).toBe(true);
      const roads = rows.filter(isRoad);
      expect(roads.some(row => row.vehicleKind === 'danfo')).toBe(true);
      expect(roads.some(row => row.vehicleKind === 'keke')).toBe(true);
      const bundles = new Map<number, Row[]>();
      for (const row of roads) {
        expect(row.speed).toBeGreaterThan(0); expect(row.speed).toBeLessThanOrEqual(4.8);
        expect(row.gap).toBeGreaterThanOrEqual(1.8);
        expect(headwaySeconds(row)).toBeGreaterThan(0);
        if (row.vehicleKind === 'keke') expect(row.kind).toBe('road_local');
        if (row.stop) expect(row.vehicleKind).toBe('danfo');
        bundles.set(row.bundle, [...(bundles.get(row.bundle) ?? []), row]);
      }
      for (const bundle of bundles.values()) {
        expect(bundle.length).toBeLessThanOrEqual(bundle[0].z < 13 ? 2 : bundle[0].z < 36 ? 3 : 4);
        expect(validateBundle(bundle).reachable).toBe(true);
      }
      expect(rows.filter(row => !isRoad(row) && row.z > 2).length).toBeGreaterThan(8);
    }
  }, 30000);

  it('retains crossing routes at later traffic phases in dense late-game bundles', () => {
    for (let seed = 0; seed < 24; seed++) {
      const rows = generateRows(seed, 96).filter(row => isRoad(row) && row.z >= 36);
      const bundles = new Map<number, Row[]>();
      for (const row of rows) bundles.set(row.bundle, [...(bundles.get(row.bundle) ?? []), row]);
      for (const bundle of bundles.values()) for (const startTime of [7, 22, 55]) {
        expect(validateBundle(bundle, startTime).reachable, `seed ${seed}, bundle ${bundle[0].bundle}, time ${startTime}`).toBe(true);
      }
    }
  }, 30000);
});
