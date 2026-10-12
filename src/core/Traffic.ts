import { GAME } from '../config/game';
import { VEHICLE_DIMENSIONS } from './types';
import type { Row, Vehicle } from './types';

export const isRoad = (row: Row): boolean => row.kind === 'road_local' || row.kind === 'road_main';

/** Added time compensates for all distance lost while braking, dwelling and accelerating. */
export function headwaySeconds(row: Row): number {
  const length = VEHICLE_DIMENSIONS[row.vehicleKind].length;
  return (length + row.gap) / row.speed + (row.stop ? GAME.brakeSeconds + GAME.dwellSeconds : 0);
}

/** Analytic position from a car's birth at x = +/-14. No teleports or random speed changes. */
export function travelAtAge(row: Row, age: number): { distance: number; speed: number; stopped: boolean } {
  const speed = row.speed;
  if (!row.stop) return { distance: speed * age, speed, stopped: false };
  const brakingDistance = speed * GAME.brakeSeconds / 2;
  const stopDistance = GAME.trafficBoundary + GAME.stopPosition;
  const cruiseTime = (stopDistance - brakingDistance) / speed;
  if (age <= cruiseTime) return { distance: age * speed, speed, stopped: false };
  let t = age - cruiseTime;
  if (t < GAME.brakeSeconds) {
    return {
      distance: stopDistance - brakingDistance + speed * t - speed * t * t / (2 * GAME.brakeSeconds),
      speed: speed * (1 - t / GAME.brakeSeconds), stopped: false,
    };
  }
  t -= GAME.brakeSeconds;
  if (t < GAME.dwellSeconds) return { distance: stopDistance, speed: 0, stopped: true };
  t -= GAME.dwellSeconds;
  if (t < GAME.brakeSeconds) {
    return { distance: stopDistance + speed * t * t / (2 * GAME.brakeSeconds), speed: speed * t / GAME.brakeSeconds, stopped: false };
  }
  t -= GAME.brakeSeconds;
  return { distance: stopDistance + brakingDistance + speed * t, speed, stopped: false };
}

/** Every ID follows a fixed trajectory. Cars enter only in the offscreen halo. */
export function sampleTraffic(row: Row, time: number, previousTime = time): Vehicle[] {
  if (!isRoad(row)) return [];
  const dimensions = VEHICLE_DIMENSIONS[row.vehicleKind];
  const headway = headwaySeconds(row);
  const lifetime = (GAME.trafficBoundary * 2 + dimensions.length) / row.speed + (row.stop ? GAME.brakeSeconds + GAME.dwellSeconds : 0);
  const first = Math.floor((time + row.phase - lifetime) / headway);
  const last = Math.floor((time + row.phase) / headway);
  const vehicles: Vehicle[] = [];

  for (let index = first; index <= last; index++) {
    const birth = index * headway - row.phase;
    const age = time - birth;
    if (age < 0) continue;
    const travel = travelAtAge(row, age);
    const x = row.direction * (travel.distance - GAME.trafficBoundary);
    if (Math.abs(x) > GAME.trafficBoundary + dimensions.length / 2) continue;
    const previous = travelAtAge(row, previousTime - birth);
    vehicles.push({
      id: `${row.z}:${index}`, kind: row.vehicleKind, rowZ: row.z,
      x, previousX: row.direction * (previous.distance - GAME.trafficBoundary),
      length: dimensions.length, width: dimensions.width,
      speed: travel.speed * row.direction, direction: row.direction, stopped: travel.stopped,
    });
  }
  return vehicles;
}
