/** Gameplay values use world units and simulation seconds. */
export const GAME = {
  halfWidth: 5,
  hopSeconds: 0.17,
  playerSize: 0.48,
  behindRows: 8,
  aheadRows: 24,
  trailingDistance: 6,
  trailingGrace: 1.5,
  impactSeconds: 0.48,
  trafficBoundary: 14,
  stopPosition: 2.9,
  brakeSeconds: 0.7,
  dwellSeconds: 0.9,
  nearMissGap: 0.24,
} as const;
