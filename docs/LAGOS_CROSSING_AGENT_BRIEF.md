# LAGOS CROSSING
## Agent-ready game design and prototype implementation brief

**Document type:** Game Design Document (GDD) + Technical Design Document (TDD) + Art Bible + Agent Execution Plan  
**Version:** 1.0 — 12 October 2026  
**Status:** Pre-production / prototype kickoff  
**Working title:** *Lagos Crossing* (name clearance and competitor review required before launch)  
**Target:** Free, mobile-first web arcade game, playable by URL without sign-in or installation.  
**Primary benchmark:** The legibility, instant restart and one-more-try loop of *Crossy Road* / classic *Frogger*; **not** a reproduction of their artwork, character designs, UI, audio, branding or exact progression.  
**Production constraint:** Solo developer + coding agent; minimal external spending; original/procedural assets first.

> **EXECUTION DIRECTIVE TO THE BUILD AGENT:** Treat this as authorization to create a functioning local prototype, not merely another plan. Scaffold the project, implement a working game loop with placeholder meshes, add recognizable original Lagos assets, run tests and a production build, and report exactly what is playable. Work in the phase order below. Do not build account systems, multiplayer, shops, paid APIs or unrelated features. If an unspecified detail is nonessential, choose the documented default and proceed. Never claim a feature is tested unless actually tested.

---

# 1. Executive product definition

### One-sentence pitch
Cross chaotic, funny, vividly recognizable Lagos streets in a fast, single-life arcade game: hop one step at a time, dodge danfos and traffic, and challenge friends to beat your distance.

### Player fantasy
“I know this Lagos traffic. I can get further than my friends.” The city feels specific and affectionate, not like a random street wearing Nigerian flags. The player’s anticipation, mistakes and near misses must be compelling even with audio off and gray-box graphics.

### Design pillars
1. **Understandable in three seconds.** See the character, the street, traffic and a visible forward path; tap to advance.
2. **Skill first, fair deaths.** Players read observable patterns. Fast vehicles are telegraphed; spawns cannot materialize on the player.
3. **Lagos in the silhouettes.** The yellow-and-black danfo, blue BRT, keke on suitable roads, roadside sellers, bus-stop signage, pedestrian bridges and layered built environment carry the identity.
4. **Funny, not frustrating.** Quick cartoony accidents, exaggerated traffic personalities, immediate retries; no gore or prolonged failure screens.
5. **Fast enough for a shared link.** Mobile landscape/portrait responsive, sensible low-end device performance, no mandatory downloads or onboarding.
6. **Earn a share.** Every completed run produces a score and an optional human-readable challenge message.

### What success means for this prototype
A new player can open a URL, understand movement without instruction, play at least 3 consecutive rounds and understand exactly why they died. The game should already be fun with simple boxes moving across roads. Viral reach is **not** guaranteed by a familiar mechanic or local imagery; the prototype is designed to test whether the loop deserves investment.

### Explicitly out of scope for v0.1
Real-world street map, open-world navigation, questing, police chases, combat, ragdoll physics, multiplayer, live leaderboards, in-app purchases, realistic vehicles/driving controls, more than one playable character, day/night cycle, licensed music, traffic simulation at city scale, elaborate cutscenes or a level editor.

---

# 2. Core gameplay — exact rules

## 2.1 Session flow
`LOAD -> TITLE/READY -> PLAYING -> HIT/DEAD -> RESULT -> INSTANT RETRY`.

- On initial load, display a frozen, visually rich playable scene, a centered *Tap to Start* affordance, the best local score and sound toggle.
- On first tap, enter a run; audio can be enabled only after this user gesture. Camera centers on the player. First 2–3 rows are safe/tutorial space.
- During a run, movement and traffic continue in real time. Score increments only when reaching a *new farthest forward row*.
- Contact with a vehicle ends the run. Freeze or briefly slow motion for 150–300 ms, show safe non-graphic comic impact, then result in <= 0.7 seconds total.
- Result screen shows current score, best score, *Retry* and *Challenge a friend*; retry restarts with one tap and no page reload.

## 2.2 Grid and world axes (normative)
- Use world **X** for lateral movement, **Y** for height, **Z** for forward progress.
- One grid cell equals **1 world unit**; each row runs along X and occupies `z ∈ [row-0.5, row+0.5)`.
- Default play width: **11 columns**, `x = -5 ... +5`. Hard blocking borders beyond `|x| > 5`, represented by curbs/walls/scene dressing.
- Player logical state: integer `{x, z}` plus an animated render position. **Logical movement and hitboxes may not depend on animation jitter.**
- Start at `{x:0,z:0}`; increasing Z advances into fresh roadway.
- Spawn environment ahead of the camera, despawn rows behind. Keep roughly **8 rows behind + 24 rows ahead** relative to furthest progress; adjust after testing. Use object pooling rather than abandoning thousands of meshes.

## 2.3 Movement (simple and exact)
- **Desktop:** arrow keys or WASD; `Up/W` = `z+1`, `Left/A` = `x-1`, `Right/D` = `x+1`, `Down/S` = `z-1`.
- **Touch primary:** single short tap anywhere inside the gameplay surface = forward hop; swipe left/right/back = corresponding step. Ignore taps originating from UI controls.
- Swipe recognition default: movement >= **28 CSS pixels** and primarily along one axis. A short tap within **220 ms** and below threshold counts as forward. Threshold must be tested across device pixel densities.
- **Optional accessibility control:** toggle large four-direction on-screen buttons if swiping causes failures. No tiny obligatory controls.
- **Repeat:** one accepted discrete command per hop; do not teleport or stack more than one queued command. Default hop interval **0.17 s**, visual motion **0.14 s**, with a short squash/stretch and ground contact. Fine-tune 0.14–0.22 s.
- Prevent immediate uncontrolled repeat from held keyboard keys; after a small initial delay, allow deliberate repeated directional movement (optional for first build). A single `keyup`/`keydown` must never produce double hops.
- Camera follows only forward maximum progress smoothly: backward steps cannot pull camera backward indefinitely.
- Constrain backward walking within camera-visible play area; when the player falls too far behind the forward camera, show a short warning then end the run rather than creating an invisible death.

## 2.4 Scoring
- `score = max(0, highestZReached)` at first, one point for every new forward row. Sideways and backward hops don't earn points.
- `bestScore` stored locally (`localStorage`, versioned key). Handle disabled/blocked storage gracefully.
- Display current score at top center, best score smaller nearby; avoid obstructing upstream traffic.
- Near miss (vehicle clears within ~0.25 cell of player) gives a *visual/audio flourish only* in v0.1. **Do not add near-miss bonus points in v0.1**; preserve simple fair scoring.
- Challenge text: `I crossed {score} steps in Lagos Crossing. Beat that: {URL}`. Use native share if supported; otherwise copy-to-clipboard with clear success/failure states. Do not silently claim copied.

## 2.5 Lose conditions
1. Vehicle collider intersects player collider during a movement/traffic tick.
2. Player falls behind the camera’s trailing exclusion line after a grace period (start with **1.5 s** after warning).
3. No arbitrary game-over timer in v0.1. If stalling is too effective, adjust the trailing exclusion line rather than making instant off-screen kills.

## 2.6 Collision implementation
- Vehicles are moving **axis-aligned rectangles in X–Z ground plane**. They are not full rigid bodies.
- Player collision footprint in local cell: start with **0.48 x 0.48 units** (feet/body collision, not decorative limbs).
- A car might occupy **1.3 x 0.76** world units; danfo **2.15 x 0.82**; BRT **3.5 x 0.9**. Exact values depend on visual model length; never visually shrink a massive bus into an unfair tiny collider.
- Since vehicles may move quickly between frames, avoid frame-skip tunneling: use fixed timestep **1/60 s**; for high-speed lanes perform swept X interval vs. player footprint or subdivide movement appropriately.
- Resolve new player hop's arrival against traffic and optionally continuous path overlap during the hop. Collisions must align with what's visibly on screen.
- One collision per death: prevent repeated events and duplicate score/result UI.

## 2.7 Fair traffic pattern generation (critical)
A row is one of: `SAFE_SIDEWALK`, `SAFE_REFUGE`, `ROAD_LOCAL`, `ROAD_MAIN`, and (later) `BRT_CORRIDOR`. Each vehicle-bearing row has one lateral direction (left-to-right or right-to-left), speed, spacing/headway, length, spawn phase and telegraphing. Multiple contiguous rows form a visually cohesive road segment with narrow pavement/refuge breaks.

**Recommended v0.1 segment rhythm:**
- Rows 0–2: safe onboarding.
- Early 3–12: small road bundles of 1–2 lanes, then safe pavement/refuge rows.
- Mid 13–35: 2–3 consecutive lanes, some alternating direction.
- Late 36+: mix 3–4 lane bundles with islands, tighter headways, occasional fast lane. Never make every row max speed.

**Fairness invariants, enforceable in code:**
- First moving hazard becomes visible **>= 1.0 s** before it can reach the player’s chosen cell at normal view; avoid spawning into or directly beside the player.
- On a newly revealed row, never spawn a vehicle overlapping player’s current cell or guaranteed next-hop landing cell in the immediate reaction window.
- Traffic spawn intervals depend on physical length and speed: `headwaySeconds >= (vehicleLength + minGapWorld)/abs(speed)`; start `minGapWorld = 1.1–2.2` based on difficulty.
- Maintain **opportunities** to cross: sampled traffic windows should include viable crossing gaps, even if the player must wait for one.
- Generate rows using seeded PRNG; same seed and configuration should yield identical lane layouts and spawn schedules given identical elapsed simulation ticks.
- Run a **reachability/fairness smoke test** on generated row bundles: estimate time-expanded player movement against occupancy for ~5 seconds, and regenerate patterns with no viable crossing route. This is a prototype safety check, not a guarantee every human can succeed.
- No invisible speed change, impossible edge spawn, unreadable background motion or instant untelegraphed reverse.

## 2.8 Difficulty tuning (initial hypotheses, not factual constants)
| Metric | Rows 1–12 | Rows 13–35 | Rows 36+ |
|---|---:|---:|---:|
| Traffic lane speed (units/s) | 1.8–2.9 | 2.4–3.8 | 3.0–4.8 |
| Vehicle gap (world units) | 2.7–4.2 | 2.0–3.5 | 1.6–3.0 |
| Continuous dangerous rows per bundle | 1–2 | 2–3 | 2–4 |
| Safe row frequency | High | Medium | Medium (never zero) |
| Rapid BRT lane | None | Optional after row 25 | Occasional, telegraphed |

These numbers are placeholders for balancing. Begin with **easier-than-expected** runs so players experience a win before getting hit. Instrument local run length and reasons for death; refine from play tests.

---

# 3. Lagos-specific game design, not superficial reskinning

## 3.1 Opening district: "Oshodi-inspired interchange" — stylized, not a literal road model
Grounded reference: bustling public transport, yellow danfos, footbridges, market umbrellas, signboards, overhead structures, street barricades, roadside commerce and a mix of concrete buildings. The prototype compresses these cues into readable toy-diorama strips. Do **not** claim geographically precise reconstruction. A real Oshodi bridge closure or traffic restriction must not be treated as a permanent landmark in-game.

**Core environmental ingredients:**
- Yellow/black danfo mini-buses: unmistakable boxy vans, black side stripes, dark side glazing and rear plate; lightly hand-authored damage; silhouette is more important than decorative text.
- Private sedans/SUVs: white, silver, charcoal, maroon; a few larger SUVs, avoiding an unrealistic endless parade of danfos.
- Blue LAMATA-like BRT-inspired bus: long blue mass-transit silhouette, large dark windows and heavier mass; in a **separated BRT corridor only**. Use fictional markings, no official logo.
- Keke Marwa: angular yellow three-wheeler with black roof, narrow body; place on selected **local roads only**, not in expressways/BRT lanes.
- Okada: optional v0.2 street-side traffic only; route restrictions mean it should not appear everywhere.
- Roadside stalls: compact umbrella shades, crate stacks, fruit/coconut/water displays (static), cash-and-carry shops, POS signs, small generator units.
- Dividers and crossing: curbs, concrete median, bollards, pedestrian overpass in distant background, barriers along BRT lanes, drainage gutters.
- City dressing: compound walls, laundry lines, shopfronts, layered low/mid-rise facades, billboards with **invented brands**, exposed cables, streetlights, satellite dishes, distant modern towers.
- Weather/sound: bright slightly hazy afternoon, warm hard sunlight, colorful shade, layered horns and traffic chatter. Game must remain clear at a glance.

**Avoid a poverty caricature.** Lagos is varied: pair bustling informal transport with modern bus infrastructure and functioning shops. Use humor about traffic *situations*, not about local people being inherently reckless or incompetent.

## 3.2 Unique Lagos mechanics: prioritize wisely
**V0.1: ONE distinguishing system — Danfo stop/start pattern.** Some danfo rows use a legible cycle: vehicle slows at a designated stop, briefly stops, then accelerates; a conductor silhouette leans out or arm gestures while stationary. This produces a pattern players can learn, rather than random erratic swerving. Keep its trigger deterministic and its animation separate from collision logic.

**V0.2 options (not required to ship):**
- **Go-slow wave:** a traffic lane temporarily slows; a wave of vehicles re-accelerates with a horn cue. Readable enough to predict; not random freeze/unfreeze kills.
- **BRT express:** one separated lane carries long blue buses, fast but low frequency, with 1.5–2 s advance horn/brake sound and road marking.
- **Overhead footbridge choice:** at a safe island, player chooses between a longer, protected upper route with guaranteed survival but modest score time, or a riskier ground-level lane with faster progress. Implement only after base movement is validated; do not imply dangerous crossings are advisable in real life.
- **Rain-puddle slick look:** cosmetic at first; slippery physics undermines tight grid fairness and is deferred.
- **Traffic warden crossing phase:** high-visibility NPC signals a predictable opening in traffic; time-boxed puzzle segment, later release.

## 3.3 Vehicle personality without losing fairness
- Danfo: slight body bounce, exposed door detail, stop/start at bus stop, short horn.
- Sedan: normal steady traffic.
- SUV: slightly wider hitbox and lower acceleration illusion; not arbitrary speed changes.
- Keke: wobbling decorative canopy at steady predictable lane velocity.
- BRT: very long, faster, loud approach signal, dedicated lane, no abrupt surprise.
- Delivery van: long silhouette and slower appearance; optional asset variety.

No cars physically swerve across grid lanes in v0.1. That would destroy the mental model. Animate wheel turn / suspension bounce visually only.

---

# 4. Visual art bible

## 4.1 Choose an original art language
**"Handmade Lagos Toybox"** — a premium, clean, low-poly/isometric miniature city, not a direct copy of Crossy Road’s voxel/pixelized visual grammar. Geometry is slightly beveled, simple sculpted silhouettes with selective painted decals, expressive proportions and carefully art-directed color. Think coherent plastic/wooden tabletop models with a touch of stylized editorial illustration.

Rules:
- 3D perspective from an elevated fixed orthographic camera. Slight yaw reveals vehicle sides and storefront depth.
- Avoid jagged all-cube voxel forms as the sole visual identity; beveled buses, smooth simple wheel arches, umbrella cones and chamfered buildings create a recognizable signature.
- Large graphic shapes read on a phone at **360 CSS px** width; no gameplay-critical object requires tiny text to identify.
- Moderately exaggerated vehicle proportions; bus roof slightly higher; black/yellow high contrast; outlines through light, contact shadow and contrast, not mandatory ink strokes.
- Subtle directional shadows, ambient hemispherical light, cheap blob shadows; no expensive real-time postprocessing in MVP.
- Animations at 60fps simulation/render target when possible; stylistically snappy hops and squash/stretch.
- Storytelling decals: route boards such as `OSHODI`, `YABA`, `OJUELEGBA` in small groups; only when plausible and readable. Fictional route typography, not real trademarks.

## 4.2 Camera and layout
- Orthographic Three.js camera, suggested starting view `position offset = (5.5, 13, 18)` aimed slightly forward of player. Tweak until **forward Z projects predominantly toward screen top** and lateral X remains intuitive.
- Player remains around **lower-center 35–42%** of usable gameplay frame. Show ~4–6 rows behind and >= 7–10 rows ahead at mobile width. Prioritize upcoming traffic over city skyline.
- Camera follows maxZ, not lateral x aggressively. Small sideways look-ahead <=0.35 units allowed.
- Vertical **9:16 portrait is priority**; 16:9 should also work with side scenery and same fairness. Support aspect ratios from ~0.5 to ~2.2.
- For mobile, dynamically adjust orthographic frustum to preserve **minimum 8–9 visible world units** in horizontal play area; if that conflicts with ahead-view, prefer legible lane telegraphing and move speed rather than cropping surprise cars.
- HUD elements anchored to screen-space HTML overlay; keep touch surfaces away from phone safe areas (`env(safe-area-inset-*)`).
- Temporary readable shadows and occlusion: vehicle roofs should not hide the player’s feet/collider. In case of obstruction, fade foreground scenery rather than the player.

## 4.3 Initial palette (suggested hex, tweak in-engine)
| Role | Colors | Use |
|---|---|---|
| Danfo yellow | `#F6BC22`, `#E9A91A` | Main recognition anchor |
| Danfo stripe / chassis | `#20252A` | Black stripes/tires |
| BRT blue | `#1683C7`, `#115D9A` | Designated BRT lanes only |
| Road asphalt | `#494E52`, `#5B6062` | Flat contrast base |
| Concrete | `#B7B5A9`, `#D1CDC0` | Islands, elevated road, curbs |
| Warm building stucco | `#E0B57D`, `#CA8E66` | Street-facing buildings |
| Market canopy accents | `#D74642`, `#317F68`, `#F0C84C` | Identity through small pops |
| Sky/haze | `#C7DCE1` | Background, light |
| Player outfit | `#7A41B7` or `#7D40BC` | Distinct purple against yellow buses |

Use ambient color grouping, but ensure scene does **not** become a sea of yellow: danfos should pop from asphalt and buildings.

## 4.4 Model kit with target proportions and priorities
All models are original, UV-light, stylized, and simple enough to procedurally generate with Three.js primitives first; replace in Blender with GLB only after gameplay exists. Target low-end mobile budget is **total visible triangles ~50k–100k** and **<=100–150 draw calls** as an aspirational profiling target, not a hard browser guarantee.

| Asset ID | Model | Approx world footprint | Visual spec | Phase |
|---|---|---|---|---|
| `char_commuter_01` | Player | 0.48 x 0.48 collision; ~0.95 high | Dark-skinned Nigerian adult, stylized geometric head, simple short hairstyle; purple T-shirt/hoodie, dark trousers, white sneakers, small messenger bag | P0 |
| `veh_danfo_01` | Danfo | length 2.1, width 0.8, height ~1.0 | Yellow boxy van, black stripe, dark windows, 4 wheels, open-door hint; fictional route placard | P0 |
| `veh_sedan_01` | Sedan | length 1.45, width 0.72 | Clear windshield, two box volumes, wheel arches | P0 |
| `veh_keke_01` | Keke | length 1.25, width 0.65 | 3 wheels, yellow nose, dark canopy/bench | P1 |
| `veh_suv_01` | SUV | length 1.75, width 0.78 | Taller body; contrasting windows | P1 |
| `veh_brt_01` | BRT bus | length 3.5, width 0.86 | Blue articulated-looking silhouette or one long body; windows | P2 |
| `road_local_01` | Asphalt row tile | 11 x 1 | Clean tile, subtle tire wear, intermittent edge line | P0 |
| `sidewalk_01` | Safe paving row | 11 x 1 | Light textured curb, slab seams | P0 |
| `road_refuge_01` | Safe island | 11 x 1 | Concrete mid-road island with low barrier at edges | P0 |
| `prop_busstop_01` | Bus stop sign/shelter | 0.7–1.8 wide | Fictional `BUS STOP` + optional Lagos route text | P1 |
| `prop_market_umbrella` | Stall umbrella | 0.8–1.2 wide | Broad color wedge canopy; dark steel stand; crates | P1 |
| `prop_footbridge_bg` | Footbridge | Backdrop, non-collidable | Truss/railings above road, partially cropped for composition | P2 |
| `prop_streetlight` | Streetlight | 0.1 x 0.1 | Tall, tapered post, simple lamp | P1 |
| `prop_generator` | Small generator | 0.5 x 0.4 | Familiar boxy frame, avoid making noise dominant | P2 |
| `bg_shops_module` | Shopfront slice | Background | Flat facades with shutters, awnings, invented signage | P1 |
| `bg_midrise_module` | Midrise block | Background | Windows, balcony rhythms, AC units, muted color | P1 |
| `vfx_impact` | Impact burst | 1–2 units | Soft comic dust/confetti, no gore | P0 |

**Character representation notes:** adult proportions deliberately stylized (head 25–30% total height), very clear directional movement, warm dark skin material with lighting that preserves value and facial readability. Do not rely on skin tone alone to communicate Nigerian identity; clothes, gestures, environment and typography do the work. No copyrighted celebrities or unlicensed likenesses.

### Model creation constraints
- Export axes consistently for Three.js (`Y` up, `+Z` forward for character, vehicles travel locally along `+X` after orienting root node).
- Asset pivot is ground center for characters/props; **vehicle pivot center on ground plane**; align visual center to collision center.
- No high-poly normals/baked 4k PBR maps. Flat material colors + 256–512 px shared decal atlas where needed.
- Aim ~100–500 triangles per prop, 300–1200 for character, 250–1500 per vehicle. These are guidelines, not hard blockers.
- Wheels can be cylinders; rotation visual-only. Optional shared geometry/material instances for identical vehicles.
- Preview every moving vehicle silhouette against asphalt in a phone-sized test at 360px width; if it is not recognizable, adjust proportions, not polycount.
- Use **original content** or verified permissively licensed assets; record source and license in `ASSET_LICENSES.md`.

## 4.5 Specific hero-shot target
A strong promotional frame shows the purple-clothed commuter on a pale median in the lower center, one black-striped yellow danfo just missing them left-to-right, a yellow keke in a side street, blue BRT in a separated upper road, bright market umbrellas, a distant pedestrian bridge, and compact signage reading `OSHODI`. Screenshot must read "Lagos" before anyone sees the game title.

---

# 5. Audio and feedback

**All audio off until user gesture; obvious mute toggle.** Support silent gameplay fully. Use short original/permissively licensed samples; never rip movie, music or game SFX.

- Footstep/hop: tight soft sneaker tick with slightly springy pitch variation.
- Vehicle layers: short horn chirp, low bus acceleration, muffled highway bed; cap simultaneous horns to prevent ear fatigue.
- Danfo stop: simple two-note horn + optional self-recorded vendor/conductor shout (only if natural and respectful, e.g. "Oshodi!"; don't generate caricatured accents).
- Impact: comedic rubbery "bop" or dust burst; no realistic injury sound.
- Score/record: one tiny positive sound on new best, not every point.
- Music: **none required** for MVP. Optional original very quiet percussion/groove in later build; never use copyrighted Afrobeats tracks.
- Pause/mute controls persist while the tab is open; visibility loss must pause/unpause safely.

---

# 6. UI, controls and accessibility

## 6.1 Screens
**A. Ready:** Logo wordmark *Lagos Crossing*, active diorama background, “Tap to cross,” “Tap = forward · Swipe = sides / back,” best score and sound icon. No modal paragraphs.

**B. Playing:** Top current score, unobtrusive pause/sound icon, tiny contextual first-run guidance that fades after first 3 hops. No permanent menu panel. Make safe area handling robust.

**C. Result:** “YOU CROSSED {n} STEPS” / “NEW BEST!”, Retry as largest CTA, Share/Challenge secondary, optional humorous short original tagline from a small pool (e.g. “Danfo: 1. You: 0.”). Never lock retry behind share.

## 6.2 Input/UI edge cases
- Disable browser page scrolling/zoom gestures on game canvas (`touch-action: none`) while leaving DOM buttons accessible.
- Pointer input distinguishes taps from swipes using movement/time; prevent duplicate pointer and synthetic click handling.
- Repeated presses during death transition must not start 2 runs.
- Respect `prefers-reduced-motion`: reduce camera shake/impact flashes; keep hop readability.
- Colorblind-safe collision readability: distinguish vehicles by silhouette, speed and placement, never only color.
- Avoid strobing and loud abrupt audio spikes. Use a pause button; pause when tab is hidden.
- In portrait, no HUD collisions with notches; in landscape, avoid clipped controls.

---

# 7. Technical architecture (recommended default)

## 7.1 Stack
**Vite + TypeScript + Three.js + minimal DOM/CSS HUD + Vitest**. No React dependency is needed for this tiny game. Use a browser renderer with WebGL compatibility and a graceful unsupported-device message; do not assume WebGPU support. Keep npm versions current and pinned by lockfile. Vite `vanilla-ts` template is sufficient.

**Why this stack:** browser link distribution, zero installation, clean access to an orthographic stylized 3D world, rapid scripted creation of placeholder models, clear deterministic pure-logic tests. Three.js documents efficient `InstancedMesh` use for repeated objects; adopt only when profiling indicates draw-call pressure.

**Expected scripts:**
```bash
npm install
npm run dev
npm run build
npm run test
npm run preview
```

**Suggested dependencies:** `three`, `@types/three`, `typescript`, `vite`, `vitest`. Add a tiny fixed-seed RNG utility locally instead of importing a large RNG dependency. Avoid a physics engine: analytic rectangles suffice.

## 7.2 Code organization
```text
lagos-crossing/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  public/
    audio/                     # if any; original, small, compressed
    icons/
  src/
    main.ts                     # bootstrap, lifecycle, errors
    app/Game.ts                 # game coordinator and lifecycle
    config/gameConfig.ts        # numeric tuning in one place
    core/types.ts               # authoritative game state types
    core/GameState.ts           # ready/playing/dead/result/pause
    core/FixedStepLoop.ts       # accumulator, dt, pause
    core/PRNG.ts                # seeded reproducibility
    core/InputController.ts     # touch/key translation to actions
    core/Movement.ts            # grid action, hop progress
    core/Collision.ts           # swept/overlap collisions
    core/Traffic.ts             # vehicle spawn/update/despawn
    core/WorldGenerator.ts      # rows and segment patterns
    core/FairnessValidator.ts   # procedural test/smoke-check
    core/Score.ts               # max forward progress
    renderer/SceneRenderer.ts   # lights, render, resizing
    renderer/CameraRig.ts       # follow and framing
    renderer/AssetFactory.ts    # procedural materials/models
    renderer/VehicleFactory.ts  # danfo/sedan/... geometries
    renderer/WorldView.ts       # rows/props object pooling
    renderer/VFX.ts             # hit/near-miss feedback
    ui/HUD.ts                   # DOM HUD
    ui/screens.ts               # ready/result state
    services/LocalSave.ts       # best score safely guarded
    services/Share.ts           # native share/copy fallback
    audio/AudioManager.ts       # opt-in sound
    styles.css
    tests/
      movement.test.ts
      collision.test.ts
      scoring.test.ts
      generation.test.ts
      traffic.test.ts
  README.md
  ASSET_LICENSES.md
  CHANGELOG.md
```

Files may be merged initially if agent velocity benefits, but preserve **logic/render separation** and deterministic testability.

## 7.3 Core data contracts
```ts
type Vec2i = { x: number; z: number };
type RowKind = 'sidewalk' | 'refuge' | 'road_local' | 'road_main' | 'brt';
type Direction = -1 | 1;
type VehicleKind = 'danfo' | 'sedan' | 'keke' | 'suv' | 'brt';

type Lane = {
  rowZ: number;
  kind: RowKind;
  direction: Direction;
  speed: number;              // world units/sec, signed via direction
  vehicleKinds: VehicleKind[];
  minGap: number;             // minimum free space in world units
  seed: number;
  nextSpawnTime: number;      // deterministic simulation time
};

type VehicleState = {
  id: number;
  kind: VehicleKind;
  rowZ: number;
  x: number;                 // center X, unbounded while offscreen
  length: number;
  width: number;
  speed: number;             // signed X velocity
};

type PlayerState = {
  cell: Vec2i;
  fromCell: Vec2i;
  toCell: Vec2i;
  hopAlpha: number;          // 0..1 animated interpolation
  alive: boolean;
  highestZ: number;
};
```

## 7.4 Fixed-timestep update example
```ts
const STEP = 1 / 60;
let accumulator = 0;
let previous = performance.now();
function frame(now: number) {
  const rawDt = (now - previous) / 1000;
  previous = now;
  accumulator = Math.min(accumulator + rawDt, 0.12);
  if (game.isPlaying) {
    while (accumulator >= STEP) {
      game.update(STEP);          // lane clocks, traffic, moves, collisions
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  game.render(accumulator / STEP); // interpolate appearance only
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

Correct ordering: collect input -> validate/commit logical move -> update traffic (fixed step) -> collision/hit result -> score -> camera target -> render. If moving player during a hop, check collision along its path rather than exclusively at the destination.

## 7.5 Traffic scheduler pseudocode
```ts
function updateLane(lane: Lane, simTime: number, dt: number) {
  for (const car of lane.active) car.x += car.speed * dt;
  lane.active = lane.active.filter(c => withinExtendedBounds(c.x, c.length));
  if (simTime < lane.nextSpawnTime) return;
  const kind = chooseVehicle(lane.vehicleKinds, seededRngFor(lane));
  const length = vehicleDimensions[kind].length;
  const spawnX = lane.direction === 1 ? -HALF_WIDTH - length : HALF_WIDTH + length;
  if (spawnWouldOverlapNearestVehicle(lane, spawnX, length)) return;
  spawnVehicle(lane, kind, spawnX);
  lane.nextSpawnTime = simTime + (length + lane.minGap) / lane.speed
                         + seededJitter(lane, 0.15, 0.75);
}
```

Use signed travel separately from positive speed to avoid negative headways. Spawn scheduling must pause cleanly when the browser loses focus. Collision and spawn state are **simulation-time**, not `Date.now()`.

## 7.6 Camera, rendering and optimization
- Request WebGL first, avoid enormous shadow maps and all screen-space post-processing in P0.
- Clamp device pixel ratio e.g. `Math.min(devicePixelRatio, 1.5)`; user testing decides if 1.25 should be default for weak devices.
- Reuse materials and mesh geometries. Pool offscreen vehicle meshes; don't build new geometries on every spawn.
- Merge / instance identical curb slabs, road marks and building windows when it materially reduces draw calls.
- Only update model transforms for moving cars/player; static props don't tick.
- Watch for WebGL context lost/restored; display recover/reload message rather than a black frozen canvas.
- Use local procedural assets for first render; GLB loading should be optional enhancement, not required for game boot.
- Pause on `visibilitychange`, and resume only when the player returns; do not accumulate huge missed time.
- Responsive resize tests for 360x800, 393x852, 412x915, 800x360, 1366x768 and high-DPR screens.

## 7.7 Local data and analytics
P0: no backend. Save local best score and toggles. Define optional non-personal event interface (`run_start`, `run_end`, `restart`, `share_clicked`, `first_hop`) for later testing, but don't transmit anything without deliberate privacy review and consent implementation. Avoid trackers, fingerprinting or collecting identifying information just to validate gameplay. For playtesting, participants can manually report screenshots of scores and short observations.

---

# 8. Production plan — rigid phase gates

## Phase P0 — playable gray-box (highest priority)
**Goal:** mechanical fun before pretty art. Build time planning estimate: ~1–3 productive coding days for an experienced browser-game developer/agent pair; not a guarantee.

Deliver:
- Vite TypeScript Three.js scene with ortho camera and camera follow.
- 11-column grid, safe rows, 1–3 traffic lanes, two types of primitive rectangular vehicles.
- Keyboard controls and mobile tap/swipe.
- Deterministic traffic motion and collision.
- Score, local best, death/result and one-tap restart.
- 2 unit tests for movement/scoring + 2 for collision/generator as a minimum; scripts build successfully.

**Gate:** P0 must be fun and responsive on mobile. If not, do **not** spend a day building detailed buses. Tune speed/gaps and visibility first.

## Phase P1 — Lagos recognizable vertical slice
**Goal:** visual identity and first sharing test. Estimate ~2–5 productive days after P0, variable with art.

Deliver:
- Original danfo, sedan, simple commuter + ground materials.
- At least one keke and recognizable bus-stop/market props.
- Danfo stop/start cue on a subset of lanes.
- Responsive HUD, audio toggle, brief non-graphic impact VFX.
- Share challenge with native fallback.
- Build runs in browser, no runtime errors, asset licenses listed.

**Gate:** Take screenshot on a phone at 360px width. Ask five Lagosians what city it evokes without showing the title. Target **4/5 name Lagos or recognizably Nigerian city**, not a mathematically representative study.

## Phase P2 — polish and fairness
**Goal:** iteration-ready public test build, not an engine rewrite.

Deliver:
- Coherent row bundle generation and validator.
- Progressive difficulty with fixed seed replay mode.
- BRT on a separated lane only if fair and visually legible.
- 5–10 seconds of original audio cues.
- Better low-end profiling, contextual tutorial and reduced-motion toggle.
- Playtest with 10–20 target players and log manual feedback.

**Gate:** no obvious impossible sequences, near-zero unfair hit reports in observed runs, fast retry. Only then consider public share/marketing.

## Phase P3 — strictly optional follow-ons
New characters, themed districts (Ikeja / Marina / Yaba), overhead footbridge, daily seed challenge, weekly leaderboard (backend needed), weather variants, achievements, PWA packaging, accessibility controls, measured marketing experiment. **Do not silently promote these into P0/P1.**

---

# 9. Definition of done, testing and QA

### Acceptance checklist (must demonstrate)
- [ ] `npm install`, `npm run dev`, `npm run build`, `npm run test` all work from a clean checkout.
- [ ] Desktop arrow/WASD and touch tap/swipe each move exactly one logical cell per action.
- [ ] Player cannot leave lateral bounds; repeated key/swipe does not cause uncontrolled double hops.
- [ ] Score increases only at new max forward row; backward/sideways farming is impossible.
- [ ] Cars cannot instantly spawn inside player's current hitbox; collision detection holds at minimum and maximum configured traffic speed.
- [ ] Traffic lanes are deterministic for a saved seed; new run reinitializes all timers/state.
- [ ] Death occurs once; impact effect then result; retry starts within one tap without page refresh.
- [ ] At least 3 recognizable original Lagos assets are visible from 360px phone view, **including danfo**.
- [ ] Portait and landscape controls remain readable; essential road space isn't hidden under HUD.
- [ ] Sound defaults sensibly and never violates browser interaction policy; game works silent.
- [ ] Browser background/re-entry does not jump traffic or cause surprise death.
- [ ] Best score persists across refresh; localStorage errors never crash gameplay.
- [ ] Share gives a usable URL/message or a clear copy fallback. No dead/inert buttons.
- [ ] Original/properly licensed assets only; no copied Crossy Road designs.
- [ ] README includes setup, controls, architecture, game rules, known limitations, future roadmap.

### Automated test cases
**Movement:** forward changes z +1; left/right changes x only; blocked bounds; queue max 1 action; input while dead ignored.  
**Scoring:** z sequence `0,1,2,1,2,3` yields score 3; restarting resets run score, not best.  
**Collision:** identical positions hit; contact on bounds hits; safe separation doesn't; fast vehicle moves 2+ footprint lengths within a long frame and cannot tunnel.  
**Generation:** same seed => identical row IDs and initial lane parameters; hundreds of seeds generate valid widths and at least configured safe segments; no lane with nonpositive spacing or negative spawn wait.  
**Lifecycle:** pause/resume without giant simulation jump; a single collision only one death event; restart clears old traffic.  
**Storage:** corrupt local best score becomes 0 safely.

### Manual test matrix
| Scenario | Pass condition |
|---|---|
| First-time phone user, no explanation | Learns first hop quickly and identifies traffic danger |
| Small portrait Android Chrome | At least 30fps target, input consistent, legible traffic |
| iPhone Safari | No accidental scroll; audio unlocked only by gesture |
| Laptop Chrome/Firefox | Arrows/WASD responsive, no ghost key repeat |
| Device rotated mid-run | Camera/frustum recompute, no crash; ideally auto-pause briefly |
| Switch app mid-hop | Game pauses without collision when hidden |
| Device in silent mode | No mandatory sound dependency |
| New player dies first 5 rows | Determine whether tutorial/visibility is too punishing |
| Player intentionally waits | Behavior predictable; delayed camera exclusion warning |
| Collision on max-speed lane | No visual pass-through or false hit |

### Hypothesis metrics for a tiny private playtest
Target values **to test**, not industry benchmarks: 80% understand controls without spoken assistance, median first run >15 seconds, 60% voluntarily retry 3 times, 20% tap share, and fewer than 1 of 10 observed deaths described as visibly unfair. If weaker, fix onboarding/fairness before adding skins or new districts. Capture *why* players stop, not just score averages.

---

# 10. Monetization and distribution: deliberately deferred

**Prototype mode:** free, no login, no advertising network, no forced installation. Host static files (Cloudflare Pages, Netlify, GitHub Pages or similar). Keep deployment path configurable and avoid hardcoded origin URLs in share text.

Later options, **only after retention evidence**: optional rewarded continuation (can harm fairness), cosmetic characters, tasteful sponsorships, nonintrusive ads between runs and ad-free mode. Avoid on-screen ad placements obstructing traffic or prompting mid-run clicks. Do not invent traffic authority/company endorsements. Be cautious using an official Lagos transit agency logo or real business names without permission.

Launch teaser: 8–12-second vertical screen recording with a near miss, unmistakable danfo, funny impact, immediate replay and score challenge. The payoff is gameplay, not a long narrator explanation.

---

# 11. Risk register and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| “Crossy Road but Lagos” feels derivative | Poor discovery, IP risk | Original handmade toybox art, locally authored traffic rhythm, distinct UI, unique models/audio, no copied assets |
| Lagos only identifiable from wordmark | Weak organic share | Silhouette test; danfo black stripe, BRT blue lane, vendor umbrellas, signs in first viewport |
| Traffic generation unfair | No retries | Seeded tests, minimum headways, telegraphs, visible spawn and fairness validator |
| Mobile browser slow | Abandonment | Low-poly primitive assets, draw-call/material reuse, DPR cap, no heavy shaders |
| Portrait crop hides hazards | Surprise deaths | Dynamic ortho camera, test tiny widths, upstream minimum view requirement |
| Stalling exploits difficulty | Score inflation / boredom | Only max forward progress scores; mild trailing camera exclusion warning |
| Big feature list delays prototype | Project stalls | P0/P1 gates; no accounts/multiplayer/open-world |
| Unlicensed samples/logos/photos | Legal trouble | All-original or verified license; credit manifest, invented branding |
| Road safety perception | Reputational concern | Clearly exaggerated arcade framing; pedestrian overpass celebrated; avoid real-life crossing advice |
| Humor turns into a Lagos caricature | Local backlash | Show modern transport and everyday dignity alongside chaos; seek Lagosian review |

---

# 12. Copy-paste kickoff task for your coding agent

> **BUILD TASK — LAGOS CROSSING P0 → P1**  
> You are the lead gameplay engineer and technical artist. Build a **running, tested, mobile-first** browser game from `LAGOS_CROSSING_AGENT_BRIEF.md`. Use TypeScript, Vite and Three.js, with original low-poly procedural 3D meshes and a lightweight DOM HUD. Begin with P0 mechanics and prove the loop works; then implement as much of P1 as the time budget permits.  
> 
> **Implement first:** orthographic camera, grid-based four-direction hop movement, swipe/tap + keyboard inputs, seeded traffic in road rows, vehicle rectangles with fixed-step collision, current/best scores, non-graphic death, instant restart. Distinguish Lagos immediately with a recognizably yellow-and-black danfo model, a commuter character and at least one recognizable roadside element.  
> 
> Keep game logic separate from rendering, prevent random impossible deaths, and use procedural placeholder geometries instead of blocking on asset sourcing. Code configurable numeric values instead of hard-coded difficulty scattered through modules. The game must run locally with `npm run dev` and build with `npm run build`; include meaningful automated tests and README instructions.  
> 
> **Do not stop after creating a plan or stub files.** Create files, run commands and resolve compile/test failures. At completion, report: what plays; controls; screenshots or capture instructions; tests/build status; performance observations if actually measured; known bugs; and the next three highest-priority improvements. Where anything remains untested, label it untested.

---

# 13. Research-backed reference notes and links

The following sources informed the design. They are **references, not permission to copy artwork, source code, commercial logos or photographs**. Dates and regulations can change; use the sources for art/research context and check before making claims in public marketing.

1. **Official Crossy Road press kit**, Hipster Whale: game identity, free-to-play arcade hopping, roads and obstacles. https://www.crossyroad.com/crossy-road-classic-press-kit
2. **Official Crossy Road homepage**, Hipster Whale: current official reference/brand ownership. https://www.crossyroad.com/
3. **Lagos Metropolitan Area Transport Authority (LAMATA)**: official description of dedicated BRT bus lanes. https://www.lamata-ng.com/bus-services/
4. **Lagos State Government**, 29 April 2025: enforcement on restricted okada routes and bridges. https://lagosstate.gov.ng/news/all/view/6812e78d5e4c9d6ceca07d06
5. **Federal Ministry of Information and National Orientation**, 30 January 2020: historical restrictions on motorcycles and tricycles on major highways. https://fmino.gov.ng/lagos-bans-commercial-motorcycles-tricycles-on-major-highways/
6. **PUNCH**, 4 March 2025: pedestrian bridge usage and temporary congestion near Oshodi. https://punchng.com/lagos-commuters-lament-crowded-pedestrian-bridge-seek-govt-intervention/
7. **Wikimedia Commons: Danfo category and individual photos**, reference silhouettes and details; individual licenses vary. https://commons.wikimedia.org/wiki/Category:Danfo
8. **Wikimedia Commons: Eromonsele Emmanuel Oigiagbe's yellow danfo photo**, CC BY-SA 4.0; reference only, commercial reuse requires following license terms. https://commons.wikimedia.org/wiki/File:Conductors_commuting_on_the_popular_Yellow_of_Lagos_-_Danfo.jpg
9. **Three.js documentation:** `InstancedMesh` draw-call optimization. https://threejs.org/docs/pages/InstancedMesh.html
10. **Three.js installation documentation:** npm/Vite guidance. https://threejs.org/manual/pages/installation.html
11. **Vite official project scaffolding:** vanilla TypeScript application. https://github.com/vitejs/vite/blob/main/packages/create-vite/README.md
12. **MDN Web Audio best practices:** browser audio needs an explicit user gesture. https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices

## Suggested additional visual field-reference search terms
`Oshodi interchange Lagos pedestrian bridge`, `Ojuelegba danfo traffic`, `yellow Lagos danfo black stripe side view`, `Lagos keke marwa profile`, `Lagos BRT blue bus segregated lane`, `Lagos market umbrella street stall`, `Lagos bus stop roadside architecture`, `Lagos compound wall street signage`.

**IMPORTANT:** Reference searches are for observation. Artists/code agents should generate their own meshes, textures, decals, audio and branding. Check asset use rights and record licenses if importing any external content.

---

# 14. Final product decision checkpoints

Before expanding beyond P1, answer yes/no:

1. Is the movement immediately understandable on mobile?
2. Can the player tell if a gap is safe without guesswork?
3. Does the first gameplay screenshot say "Lagos" even without the title?
4. Are collisions legible and fair?
5. Is restarting fun enough to repeat voluntarily?
6. Does it run acceptably on an actual low/midrange Android phone, not only a desktop?
7. Can a friend be challenged with one tap and a shareable link?

If **any** answer is no, fix it before adding more environments, characters or monetization.

**North-star principle:** Don't build “a simulation of Lagos.” Build **a great ten-second arcade decision repeated a hundred times**, in a world that could only have been designed with Lagos in mind.
