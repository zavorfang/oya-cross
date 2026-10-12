export type Action = 'forward' | 'back' | 'left' | 'right';
export type Phase = 'ready' | 'playing' | 'paused' | 'hit' | 'result';
export type RowKind = 'sidewalk' | 'refuge' | 'road_local' | 'road_main';
export type VehicleKind = 'danfo' | 'sedan' | 'keke' | 'suv';
export interface Cell { x: number; z: number }
export interface Row {
  z: number; kind: RowKind; direction: -1 | 1; speed: number;
  gap: number; seed: number; stop: boolean; vehicleKind: VehicleKind;
  phase: number; bundle: number;
}
export interface Vehicle {
  id: string; kind: VehicleKind; rowZ: number; x: number; previousX: number;
  length: number; width: number; speed: number; direction: -1 | 1; stopped: boolean;
}
export interface Player {
  cell: Cell; from: Cell; to: Cell; x: number; z: number;
  hopProgress: number; moving: boolean; highestZ: number;
}
export interface GameSnapshot {
  phase: Phase; seed: number; time: number; score: number;
  player: Player; rows: Row[]; vehicles: Vehicle[];
  deathReason: string; warning: boolean; nearMiss: number;
}
export const VEHICLE_DIMENSIONS: Record<VehicleKind, { length: number; width: number }> = {
  danfo: { length: 2.15, width: 0.82 }, sedan: { length: 1.45, width: 0.74 },
  keke: { length: 1.1, width: 0.7 }, suv: { length: 1.65, width: 0.8 },
};
