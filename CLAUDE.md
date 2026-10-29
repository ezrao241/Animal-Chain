# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Animal Chain is a browser multiplayer wildlife-survival game set on an African savanna (six species: lion, leopard, spotted hyena, zebra, impala, warthog; five-minute rounds; 60 computer-controlled wildlife slots). It is a Vinext (Next-style app on Vite) project meant to run as a Cloudflare Worker with D1, rendered client-side with Three.js.

There is no Blender or game engine at runtime, and no model or texture files: every animal, tree, rock, grass tuft and the terrain is generated in TypeScript at load time. The `blender/` pipeline mentioned in older notes belongs to an abandoned forest version of the game and is not used.

## Commands

```bash
pnpm install                                   # Node >= 22.13
node --test tests/game.test.mjs tests/route.test.mjs   # all tests (node --test tests/ also picks up helper files and fails)
node scripts/mp-playtest.mjs [shots-dir]       # two browser sessions vs the real route on a local server (needs the play build below)
node --test --test-name-pattern "zebra" tests/game.test.mjs   # a single test by name
pnpm lint                                      # reports pre-existing React-hooks errors in WorldScene.tsx; compare against main rather than expecting zero
```

Tests import `lib/game.ts` directly through Node's built-in TypeScript stripping, so no build step is needed for them.

`pnpm dev` / `pnpm build` do **not** work in this checkout: `vite.config.ts` imports ChatGPT Sites hosting files (`.openai/hosting.json`, `build/*`) that were never committed, and multiplayer needs Cloudflare D1. `tsc --noEmit` reports only those three missing-module errors in `vite.config.ts`.

The playable build is the static solo-practice bundle in `play/` (the real page and scene, with the API answered in the browser by `play/api-shim.ts` against bots):

```bash
node node_modules/vite/bin/vite.js build --config play/vite.config.mjs && node play/split.mjs   # -> dist-play/
```

### Performance measurement

```bash
node scripts/perf/tick-bench.mjs [rounds]          # simulation cost: mean/worst tick() with 60 wildlife, + publicRoom JSON
node scripts/perf/sync-bench.mjs [players] [secs]  # multiplayer sync through the real route: bytes per poll, D1 reads/writes, server ms
node node_modules/vite/bin/vite.js build --config play/vite.config.mjs --minify false && node play/split.mjs
node scripts/perf/profile.mjs [seconds] [out.json] # headless Chromium practice round: frame times, fps, triangles, draw calls, top CPU functions
LAG_MS=250 JITTER_MS=120 node scripts/perf/lag-test.mjs [dist-play]  # two browser sessions on a slow connection: own-animal snap-backs vs the server's copy
```

`profile.mjs` takes `PERF_VIEWPORT=640x360`, `PERF_ROOT=<other dist-play>` (to compare two builds) and `PERF_SEED` (Math.random is seeded by default so both builds spawn the same animals; spawns still vary run to run, so repeat runs). It runs on SwiftShader (software GPU), so absolute fps is far below real hardware; compare builds against each other, not against a target. The auto quality tier can switch mid-run, so for before/after comparisons build both variants with the downgrade disabled. `WorldScene` publishes its own readouts on the `.world-scene` element's dataset (`fps`, `renderMs`, `drawCalls`, `triangles`, `animalDrawCalls`, `quality`).

## Architecture

**`lib/game.ts` is the single source of truth for rules and is shared by three consumers:** the Worker route (`app/api/game/route.ts`, rooms in D1), the offline shim (`play/api-shim.ts`, rooms in memory), and the client (`app/page.tsx`, `components/game/WorldScene.tsx`). It holds species data (`ANIMALS`, including real-world `gait` numbers), the deterministic map layout (`props(417)` / `layout()`, seeded `rng`), movement (`move`), stamina, senses (`sense`: sight/scent/sound/close, used by the AI, by the player's Tracking labels and by danger cues alike), abilities, and the wildlife AI (`steer` -> `grazer` / `hunter`). `tick(room, now)` advances the room in ≤0.1 s sub-steps.

- Units: 10 game units = 1 m; the map is `W x H` = 4000 x 2800 (400 x 280 m). `gait` speeds are m/s, converted with `UNITS_PER_METRE`.
- The prop table must stay identical across server and client: the renderer places acacias, kopjes, burrows, thickets and watering holes from the same `props(417)` the server collides against. Changing `layout()` (or anything it calls, such as `dist`) moves the whole map; hash `props(417)` / `trails()` / `makeFoods(417)` before and after any change that might touch it.
- Collisions and steering use the uniform grid behind `solidNear()`; `ofKind(ps, kind)` caches per-kind prop lists. Prefer these over scanning the whole prop table in per-step code.

**Room sessions (`lib/net.ts`).** Shared by the route and the shim: `roomRequest` handles join/sync/start/leave/restart against a loaded room (host succession after a 10 s grace, stale lobby removal, reconnect with a valid token, idempotent start, empty-room deletion); `applyActions` runs one-shot presses (ability/interact/perch) at most once by per-player increasing id, dropping presses from an earlier life (`born`), while dead, outside a round or older than 1.5 s; `viewFor` builds what one player is sent (concealed animals omitted for others, server-only and owner-only fields stripped, far animals trimmed, food as changes from `makeFoods(seed)`), and the client rebuilds the food table with `expandView`. New private `Player` fields must be added to `SERVER_ONLY` or `OWNER_ONLY` there. Issue log and measurements: `docs/multiplayer-issues.md`.

**Client loop.** `app/page.tsx` polls `/api/game` (`action:'sync'`) every ~140 ms while playing and keeps the room in React state; E/Space/Q presses wait in a queue and are resent until the server acknowledges them (`act`). `WorldScene.tsx` owns one `requestAnimationFrame` loop: it moves the player's own animal locally with the same `move()` and every sync reports that position, which the server accepts when it was reachable at the species' top speed (`claim` in `lib/net.ts`; the client rejoins the server's animal only while the server holds it or after a refusal, `fix`). It carries other animals forward along their velocity between updates, poses rigs, places the camera, and draws a 2D overlay canvas (labels, minimap) at ~20 Hz. Graphics tiers (`performance`/`balanced`/`high`) change pixel ratio, draw range, fog and whether real shadow maps are on; `auto` drops to `performance` after two slow 2-second samples. A `SoftwareRenderer` fallback is used when WebGL is unavailable.

**Procedural art (`components/game/`).**
- `faceted.ts`: the modelling kit (`Model.loft` / `blob` / `spike` / `mirror`, per-triangle coat colours, `lod` parameter that cuts ring sides and subdivision). Everything is flat-shaded vertex colour on one shared `MeshStandardMaterial`.
- `safari-animals.ts`: per-species anatomy specs in metres, a joint hierarchy (body, neck, head, ears, two tail segments, three per leg), procedural gait animation (`animateSafari`), camera profiles, and menu portraits. Geometry is built once per species and LOD and cached.
- `animal-batches.ts`: rigs keep their articulated scene-graph transforms but are not drawn directly; each frame every visible body part is copied into one `InstancedMesh` per part geometry (lod 0 or lod 1 beyond 26 m), and animals outside the camera frustum are skipped unless shadow maps are on.
- `savanna-world.ts`: terrain height grid (`groundY` interpolates the exact triangles drawn, so animals stand on the facets), terrain and pooled ground shade split into tiles for frustum culling, instanced acacias/boulders with near/far LOD and far-plane culling (re-levelled every 40 units of movement), grass/flower/pebble instancing in 400-unit chunks thinned with distance, wind in a patched grass vertex shader, water, sky, clouds and horizon.
- `safari-food.ts` and `safari-traces.ts` (tracks, trails, vultures) are instanced the same way.

## Project rules from the owner

- Keep wildlife behaviour and movement faithful to the real animals (speeds, stamina, gaits, turning, habitat-based spawning, prey-size matchups); `docs/wildlife-sources.md` separates real facts from game rules.
- Movement is vector steering (velocity bends toward the input, limited by accel/brake/grip); body facing turns separately at `gait.turnRate`. Don't return to heading-rotation steering.
- Climbing is species-accurate: only the leopard truly climbs (Q, acacias); solid props (rocks, trunks) block animals.
- Visual direction: faceted low-poly with realistic anatomy, warm sunlight and cool shade. Optimise without lowering model detail or changing the look.
