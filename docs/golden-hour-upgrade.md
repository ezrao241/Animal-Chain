# Animal Chain: Golden Hour

## What changed

- Replaced the menu, lobby, results screen, and game HUD. The game now fills the viewport; tasks and vitals are compact overlays. The original tagline is preserved.
- Added original forest title artwork. This is explicitly labeled artwork, not a gameplay screenshot. The live menu uses a 340 KB WebP instead of the 2.6 MB source PNG, which is retained under `art/`.
- Bundled Oxanium locally with its SIL Open Font License. Body text remains a system sans-serif.
- Rebuilt the forest with uneven, leaf-textured ground, organic trails, taller tree canopies, bark, roots, mossy rocks, border trees, fog, and GPU-instanced ground cover/fireflies.
- Rebuilt the behind-animal camera: view-relative movement, drag-to-orbit, bounded zoom, recenter, collision-aware camera distance, and sprint field-of-view feedback.
- Retained articulated animal animation and added smoother GPU geometry, with simpler meshes for compatibility rendering.
- Added three 100-second scoring phases to the existing five-minute round. Forage food earns 5 instead of 3; hunt-phase catches earn 15 instead of 10; last-light escapes earn 10 instead of 5.
- Changed NPC respawns to fixed ecological slots: 6 rabbits, 7 mice, 4 squirrels, 3 snakes, 2 foxes, 2 owls. Human lives remain randomized and never repeat the immediately previous species.
- Added hunger-gated wild predator hunting, obstacle steering, tracking arrows, suitable-prey minimap dots, visible task rewards, and clearer threat warnings.
- Added solo practice without weakening the two-player requirement for multiplayer rounds.
- Added an analog touch joystick, hold-to-sprint, and touch actions. These use the same authoritative server rules as desktop controls.
- Fixed stationary sprint drain/exhaustion, camera zoom jumps, squirrel tree anchoring, prey slot loss, stale client snapshots, and bot-ID authentication.
- Fixed software-renderer terrain culling and near-plane clipping so the forest floor does not disappear behind the chase camera.

## Verification

- `node --test tests/game.test.mjs`: 10 passing tests. Includes a simulated complete five-minute round, ecological slots, scoring phases, diets, hiding/protection, sprinting, collisions, flight/perching, camera direction, and reincarnation.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Two independent browser sessions: created and joined the same code, host started, both entered the same five-minute round, species-specific tasks displayed, and the second player's earned score appeared on the host's leaderboard.
- Browser interaction: solo practice, owl takeoff, camera orbit and bounded zoom, updated title/lobby/HUD, and software-rendered forest floor inspected.
- `tests/multiplayer.mjs` is a reusable local API smoke test. Its direct HTTP attempt in this managed environment returned a proxy 502, so the browser-session check above was used instead. It is not reported as passing.

## Testing limits

The cloud test browser does not support WebGL and used the explicitly labeled compatibility renderer. High-detail WebGL appearance, GPU frame rate, and physical-phone touch performance need device testing. The game remains stylized procedural 3D; the title illustration does not represent its model fidelity. The multiplayer transport remains the existing authoritative room-state polling with client prediction, not WebSockets.

## Art and design references

- Original title artwork generated for this project. Brief: semi-realistic forest at golden hour, dark left side for the menu, lean red fox at right, owl overhead, rabbit in the middle distance, tall pines, moss and ferns; no text or copied game branding.
- Oxanium: https://github.com/google/fonts/tree/main/ofl/oxanium . License distributed at `public/fonts/OFL-Oxanium.txt`.
- WolfQuest's official hunting description informed the use of species-appropriate tracking cues: https://yellowstone.wolfquest.org/wolfopedia/Wolves/hunting . Animal Chain's directional markers are an arcade mechanic, not a biological scent simulation.

Visual QA: `docs/qa/golden-hour-menu.jpg`.
