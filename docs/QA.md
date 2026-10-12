# Prototype verification — 12 October 2026

## Automated checks

- `npm.cmd install`: passed from a freshly scaffolded project, with a project-local cache. Subsequent font dependencies also installed successfully. A separate clone/`npm ci` run has not been performed.
- `npm.cmd run test`: **38 tests passed across four files**; final test run completed in 3.67 seconds.
- `npm.cmd run build`: **passed**, including TypeScript checking and static Vite output.
- `npm.cmd run dev`: served a successful HTTP 200 and a playable browser scene.
- `npm.cmd run preview`: served the production build with HTTP 200 on port 4173; two forward hops were played in that build.

Tests cover continuous movement and committed cells, both lateral bounds, one queued action, max-forward scoring, deterministic replay, frozen ready and paused scenes, restart cleanup, one traffic death, impact timing, trailing warning and recovery, exact collision contact, high-speed tunneling and relative movement, danfo braking/dwell/acceleration, physical headway preservation, generator streaming equivalence, safe onboarding, local-only kekes, a real blocked-route rejection, and seeded reachable bundles.

Generation sweeps include 128 seeds through row 48, 48 seeds for the opening reaction window, and 24 seeds through row 96 at traffic phases 7, 22, and 55 seconds. Timing tests check that paused wall-clock time is discarded and long frames have bounded fixed-step catch-up. Storage tests reject corrupt best scores and tolerate blocked reads/writes. Gesture tests check the CSS-pixel threshold and long-press rejection. Share tests cover native success, cancellation, fallback copy success, denied clipboard, and manual fallback.

The production bundle emits one size advisory for the Three.js chunk: approximately **544 kB minified / 136 kB gzip**. It is a warning, not a build failure. Fonts and license notices are local assets.

## Browser checks actually performed

Browser: the Codex in-app Chromium browser on this Windows desktop. Mobile dimensions were emulated; no physical phone was connected.

| Check | Observed result |
| --- | --- |
| Arrow keys | Two sequential forward hops reached z=1/2 and scores 1/2. Left/right moved x=-1/0 while score remained 2. |
| WASD | W advanced a second run through the first traffic row. |
| Tap | One canvas tap reached `{x:0,z:1}`, score 1. |
| Swipe | Left reached `{-1,1}`, right `{0,1}`, down `{0,0}`; score remained 1 through lateral/back movement. |
| Three rounds | Three separate runs reached traffic contact, showed one result, and retried in place. The third run used canvas taps/swipes. |
| Fresh route retry | After the final renderer fix, a production run ended at score 3; retry reset score/cell and generated seed 3547420945 without console errors. |
| Pause | Simulation time remained exactly 0.583 seconds across a 1.1-second pause observation; player/traffic state stayed fixed. Resume restored play. |
| Orientation | Changing from portrait to 800×360 paused the live run and rendered a readable pause screen. |
| Optional controls | Direction-button setting showed the pad; one forward button produced score 1. The pad is hidden on ready, pause, and results. |
| Reduced motion | Unchecking immediately removed `.reduced-motion`; checking immediately added it. |
| Sound controls | Toggle enabled then muted without console errors. Actual perceived sound quality was not assessed. |
| Best score | Full page reload retained best score 3 at the dev-server origin. Dev and production-preview ports have separate local storage origins. |
| Native sharing | Share action opened the platform flow; Escape cancelled it and re-enabled the button. No challenge was sent to another person. |
| Runtime | No captured console errors or warnings during the observed play and production checks. |
| Local output | Production preview booted and played using built JS/CSS/font files. |

Responsive checks requested 360×800, 393×852, 412×915, 800×360, and 1366×768. The browser rounded the 393-pixel request to 394 CSS pixels. No horizontal or vertical page overflow was observed in the inspected layouts. Landscape and desktop screenshots were captured after resizing settled. Actual high-DPR hardware, 30 FPS behavior under load, iOS Safari, Firefox, and background app switching remain untested.

## Rendering observations

The desktop browser's simple rAF diagnostics sampled roughly **55–60 FPS**, including the phone-sized viewport. Opening scenes observed approximately **48–79 draw calls** and **74,000–94,000 triangles**. These measurements reflect this desktop's browser and GPU; they do not establish low-end phone performance or late-run worst-case cost.

Vehicle geometry/materials are reused, vehicle objects are pooled, row geometry is evicted behind the player, static scenery is merged, and shadows/cues are instanced. Device pixel ratio is capped at 1.5.

## Issues fixed during inspection

- Moved the portrait camera target so the ready button no longer covers the commuter.
- Added predictive incoming chevrons where narrow portrait framing gave too little visible traffic lead-in near lateral edges.
- Reduced scene lighting/exposure and strengthened contact shadows for clearer silhouettes.
- Applied reduced-motion styling immediately after a settings change.
- Displayed the correct trailing-death cause.
- Reattached WebGL recovery listeners whenever the renderer is recreated.
- Hid the direction pad outside live play and hid the keyboard tutorial when the pad is enabled.
- Included vehicle kind in renderer pool lookup keys so reused IDs on a fresh route cannot retain a model with a different collision size.

## Unverified / next validation

The incoming chevrons warn 1.6 simulation seconds before a vehicle front reaches the lateral collision boundary. Their legibility and effectiveness on a small physical screen still require human testing. The reachability smoke test is a safety check, rather than proof that all generated decisions are readable or every human attempt can survive.

Physical Android/iPhone playability, native share delivery, real clipboard fallback permissions, blocked storage in an actual browser, WebGL context loss/restoration, focus/background recovery, high-DPR touch behavior, long-run memory profiling, and the brief's five-Lagosian recognition / 10–20-player enjoyment gates have not been validated. Those gates should be completed before public release or feature expansion.

No known reproducible blocker remained in the inspected local loop. This statement is limited to the checks above.

## Captures

- [Phone ready](screenshots/mobile-ready.jpg)
- [Phone gameplay](screenshots/mobile-playing.jpg)
- [Landscape ready](screenshots/landscape-ready.jpg)
- [Landscape pause](screenshots/landscape-paused.jpg)
- [Desktop ready](screenshots/desktop-ready.jpg)
- [Desktop gameplay](screenshots/desktop-playing.jpg)

Screenshots are evidence of the local prototype, not promotional renders or physical-device captures.
