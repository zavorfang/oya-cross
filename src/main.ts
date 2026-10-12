import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import './styles.css';
import { GameEngine } from './core/GameEngine';
import { FixedStepLoop } from './core/FixedStepLoop';
import { InputController } from './core/InputController';
import type { Action } from './core/types';
import { SceneRenderer } from './renderer/SceneRenderer';
import { HUD } from './ui/HUD';
import { readBest, readPreferences, writeBest, writePreferences } from './services/LocalSave';
import { challengeText, shareChallenge } from './services/Share';
import { AudioManager } from './audio/AudioManager';

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const fixedSeed = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : null;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const firstSeed = fixedSeed ?? 84621;
const game = new GameEngine(firstSeed);
const loop = new FixedStepLoop();
const sound = new AudioManager();
const preferences = readPreferences();
sound.enabled = preferences.sound;
let best = readBest();
let previousBest = best;
let renderer: SceneRenderer | undefined;
let lastTime = performance.now();
let runs = 0;
let lastHop = '';
let lastNearMiss = 0;
let wasHit = false;
let frameCount = 0;
let totalFrameTime = 0;
let contextLost = false;
let lastOrientation = innerWidth > innerHeight;
const diagnostics = document.createElement('output'); diagnostics.id = 'diagnostics'; diagnostics.hidden = true;
document.body.appendChild(diagnostics);

const start = () => {
  if (game.snapshot.phase !== 'ready' && game.snapshot.phase !== 'result') return;
  previousBest = best;
  const seed = fixedSeed ?? (runs === 0 ? firstSeed : randomSeed());
  game.start(seed); runs++;
  loop.reset(); renderer?.resetCamera();
  lastTime = performance.now(); lastNearMiss = 0; wasHit = false; lastHop = '';
  sound.reset(); sound.unlock();
};
const pause = () => { game.pause(); loop.reset(); sound.suspend(); };
const resume = () => { if (contextLost) return; game.resume(); loop.reset(); lastTime = performance.now(); sound.unlock(); };
const command = (action: Action) => {
  if (hud.dialog.open || contextLost) return;
  if (game.snapshot.phase === 'ready') start();
  if (game.snapshot.phase !== 'playing') return;
  sound.unlock(); game.command(action);
};
const hud = new HUD(document.querySelector<HTMLElement>('#app')!, preferences, {
  start, pause, resume, command, settingsOpened: pause,
  preferences: updated => { writePreferences(updated); sound.enabled = updated.sound; if (updated.sound) sound.unlock(); else sound.suspend(); },
  share: async () => {
    const button = document.querySelector<HTMLButtonElement>('#share-button')!;
    button.disabled = true;
    const result = await shareChallenge(game.snapshot.score, game.snapshot.seed);
    button.disabled = false;
    if (result === 'copied') hud.toast('Challenge copied. Send it to your people.');
    else if (result === 'shared') hud.toast('Challenge sent. Let’s see who gets further.');
    else if (result === 'manual') { hud.manualShare(challengeText(game.snapshot.score, game.snapshot.seed)); hud.toast('Sharing is unavailable. Select and copy your challenge.'); }
  },
});

function createRenderer(): void {
  renderer = new SceneRenderer(hud.viewport);
  const canvas = hud.viewport.querySelector('canvas')!;
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; pause(); hud.toast('Graphics paused. Restoring the street…');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      renderer?.dispose(); createRenderer(); contextLost = false;
      hud.toast('Street restored. Press Keep crossing to continue.');
    } catch (error) {
      console.error('Unable to restore game graphics:', error);
      hud.showFatal('The browser could not restore 3D graphics. Reload the game to try again.');
    }
  });
}
try { createRenderer(); } catch (error) {
  console.error('Unable to start Lagos Crossing renderer:', error);
  hud.showFatal('This browser could not start 3D graphics. Enable hardware acceleration or try a browser with WebGL support.');
}

new InputController(hud.surface, command, () => {
  if (game.snapshot.phase === 'paused') resume(); else pause();
}, () => { if (game.snapshot.phase === 'paused') resume(); else if (game.snapshot.phase === 'playing') command('forward'); else start(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  lastTime = performance.now(); loop.reset();
});
window.addEventListener('blur', pause);
window.addEventListener('resize', () => {
  const landscape = innerWidth > innerHeight;
  if (landscape !== lastOrientation) { pause(); lastOrientation = landscape; }
});

function frame(now: number): void {
  const dt = Math.min(0.12, Math.max(0, (now - lastTime) / 1000)); lastTime = now;
  const phase = game.snapshot.phase;
  loop.advance(dt, !document.hidden && !contextLost && (phase === 'playing' || phase === 'hit'), step => game.update(step));
  const snapshot = game.snapshot;
  if (snapshot.score > best) { best = snapshot.score; writeBest(best); }
  if (snapshot.player.moving) {
    const hop = `${snapshot.player.from.x},${snapshot.player.from.z}>${snapshot.player.to.x},${snapshot.player.to.z}`;
    if (hop !== lastHop) { sound.hop(); lastHop = hop; }
  } else lastHop = '';
  if (snapshot.phase === 'hit' && !wasHit) { wasHit = true; sound.hit(); }
  if (snapshot.phase === 'result' && phase === 'hit' && snapshot.score > previousBest) sound.record();
  if (snapshot.nearMiss > lastNearMiss) { hud.nearMiss(); sound.nearMiss(); lastNearMiss = snapshot.nearMiss; }
  if (snapshot.phase === 'playing' && snapshot.vehicles.some(car => car.stopped && Math.abs(car.rowZ - snapshot.player.z) < 4)) sound.horn(snapshot.time);
  hud.update(snapshot, best, previousBest);
  if (renderer && !document.hidden && !contextLost) renderer.render(snapshot, dt, preferences.reducedMotion);
  if (dt > 0 && !document.hidden) { frameCount++; totalFrameTime += dt; }
  if (frameCount % 15 === 0) diagnostics.textContent = JSON.stringify({
    phase: snapshot.phase, time: +snapshot.time.toFixed(3), score: snapshot.score, cell: snapshot.player.cell,
    seed: snapshot.seed, rows: snapshot.rows.length, vehicles: snapshot.vehicles.length,
    ...renderer?.metrics, sampledFps: +(frameCount / Math.max(totalFrameTime, .01)).toFixed(1),
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only diagnostics for reproducible playtests. No telemetry leaves the browser.
Object.defineProperty(window, '__LAGOS_DIAGNOSTICS__', {
  value: { snapshot: () => structuredClone(game.snapshot), performance: () => ({ ...renderer?.metrics, sampledFps: +(frameCount / Math.max(totalFrameTime, .01)).toFixed(1) }) },
  writable: false,
});
