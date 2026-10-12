# Lagos Crossing

A playable, mobile-first 3D arcade prototype: hop through an original Lagos toybox, read the traffic, dodge yellow-and-black danfos, and try again. Built from the supplied brief through the P0 mechanics and P1 visual slice. The world is Oshodi-inspired, rather than a geographic reconstruction.

## Run locally

Requires a current Node.js runtime compatible with Vite 8 (Node 20.19+ or 22.12+). Developed with Node 24.13.0.

```powershell
git clone https://github.com/zavorfang/oya-cross.git
cd oya-cross
npm install
npm run dev
```

The original local working copy is at `E:\programming\lagos-crossing`; run the npm commands there if using that copy.

Open the Local URL printed by Vite (normally http://localhost:5173). On Windows, use `npm.cmd` if PowerShell blocks its script launcher. The project-local npm cache avoids needing writes to the global user cache.

```powershell
npm run test
npm run build
npm run preview
```

`build` typechecks TypeScript and produces a standalone static `dist/` directory. `preview` serves the production build, normally on port 4173. Relative asset URLs support deployment in a subdirectory. Public hosting has not been configured or published.

For a real phone on the same Wi-Fi, use the Network URL printed by Vite. That URL is local to your network and may require your normal firewall configuration. Clipboard and native sharing depend on browser support and secure context; a selectable challenge is available when copying is unavailable. Localhost links are useful on this computer only. Deploy `dist/` to HTTPS hosting before inviting remote friends.

## Controls and rules

| Action | Keyboard | Touch |
| --- | --- | --- |
| Forward | Up / W | Short tap, or upward swipe |
| Left / right | Left / A, Right / D | Swipe left / right |
| Back | Down / S | Swipe down |
| Pause / resume | P / Escape | Pause button, then Keep crossing |
| Start / retry | Enter / Space, or button | Let’s cross / One more crossing |

Settings provide large direction buttons and reduced motion. Sound defaults off and unlocks only after a player gesture. Browser-generated held-key repeat is ignored; one in-progress hop may queue one additional command. Tap threshold is 220 ms; swipe threshold is 28 CSS pixels, independent of device pixel ratio.

The 11-column field runs from x=-5 to x=+5. The first three rows are safe. Hops take 0.17 seconds. Only the highest completed forward row earns points. Backtracking and sideways movement cannot farm score. Vehicle contact ends the run, followed by results in 0.48 seconds and a single-click retry. Walking six rows behind the furthest reached row shows a warning, then ends the run after a 1.5-second grace period. Safe-row waiting has no arbitrary time limit.

Some danfos brake into a marked stop, dwell briefly with a waving conductor, then accelerate. Amber double chevrons at the incoming lane edge warn of approaching traffic before it enters the playable columns. Kekes appear only on local roads. Sedans and SUVs provide other traffic silhouettes. Difficulty adds longer road bundles and faster lanes while preserving refuge rows.

Best score and settings save locally with guarded storage calls. No accounts, backend, analytics transmission, trackers, paid services, or imported vehicle artwork are required.

## Repeat a route

Append `?seed=84621` to the URL to replay a fixed route. A seed fixes lane layouts, phases, traffic trajectories, and stop cycles; identical commands at identical simulation ticks reproduce the same run. Routes depend on player timing, so a seed alone does not fix a human player's outcome. Without a seed parameter, the opening route is curated and subsequent retries use fresh random seeds.

Challenge text includes the run’s seed and current page URL. Native sharing is attempted first, clipboard second, and selectable text last. Cancellation does not silently copy anything.

## Architecture

Vite + TypeScript + Three.js + a DOM HUD + Vitest. No React or physics engine.

- `src/core/GameEngine.ts`: lifecycle, continuous hop path, one-command queue, score, collision, near misses, and trailing warning.
- `src/core/Traffic.ts`: analytic seeded vehicle trajectories and individual danfo stop cycles. Simulation time drives traffic; wall-clock time never drives hazard spawns.
- `src/core/WorldGenerator.ts`: progressive road bundles and safe refuges, generated incrementally with bounded row retention.
- `src/core/FairnessValidator.ts`: five-second time-expanded reachability smoke test, including waiting and sideways movement. Failed bundles are regenerated or eased.
- `src/core/Collision.ts`: relative swept axis-aligned rectangles in the X–Z plane. Player animation never changes the collision footprint.
- `src/core/FixedStepLoop.ts`: 60 Hz simulation, capped frame catch-up, and no paused-time accumulation.
- `src/core/InputController.ts`: keyboard and pointer-to-hop translation.
- `src/renderer/`: procedural bevelled meshes, local sign atlas, pooled vehicles, merged scenery, instanced contact shadows and lane cues. A reflected display Z keeps forward/up and left/right intuitive while core coordinates remain unchanged.
- `src/ui/HUD.ts`: ready, game, pause, results, settings, warnings, sharing feedback, and storage-driven best score display.
- `src/services/`: safe optional local persistence and native/copy/manual sharing.
- `src/audio/AudioManager.ts`: original Web Audio hop, horn, impact, record, and near-miss tones.
- `src/config/game.ts`: centralized gameplay tuning values.

The camera follows the maximum reached row and keeps all columns visible across portrait and landscape. Device pixel ratio is capped at 1.5. Tab hiding, focus loss, and portrait/landscape rotation pause a live run; resuming is explicit. Context loss pauses play and tries to restore graphics; unsupported WebGL displays a reload message.

For local profiling, inspect `window.__LAGOS_DIAGNOSTICS__.snapshot()` and `.performance()` in browser developer tools. The hidden `#diagnostics` output supplies the same compact state for browser QA. These values stay in the browser. The FPS counter is a simple rAF sample, not a calibrated benchmark.

## Verification and limitations

See [QA.md](docs/QA.md) for the exact automated and manual checks. Browser viewport checks do not substitute for physical Android and iPhone testing. Fairness validation demonstrates available routes in sampled schedules; it is not a guarantee that every decision is survivable or human-readable.

This prototype contains original danfos, sedans, SUVs, kekes, a purple commuter, bus stops, market umbrellas, produce crates, planted medians, shopfronts, lamps, signs, and side-street wires. BRT, overhead bridge gameplay, music, other districts, multiplayer, and live leaderboards are deferred. The current art is a procedural kit with repeated props; local players still need to validate the Lagos identity.

## Next three priorities

1. Test on actual low/midrange Android and iPhone hardware; tune portrait scale, edge warnings, touch thresholds, and frame cost from those observations.
2. Run the brief’s Lagos recognition and playability sessions; tune early traffic, danfo stops, collision readability, and retry appeal from feedback.
3. Put the verified static build on HTTPS hosting and test real remote challenge links, native sharing, and clipboard fallback before broader distribution.

## Screenshots and captures

Open a fixed seed, start a run, and pause on a safe refuge for a reproducible gameplay capture. Use a 360×800 portrait viewport for the phone view and 1366×768 for desktop. Result and start screens can be captured without timers. Saved QA screenshots, when present, are in `docs/screenshots/`.

Original meshes and synthesized cues are documented in [ASSET_LICENSES.md](ASSET_LICENSES.md). The supplied design reference is retained under `docs/`.
