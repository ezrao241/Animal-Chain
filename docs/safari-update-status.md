# Safari update implementation status

Based on confirmed safari branch c78d214, edited in /workspace/scratch/fafca077b41d/animal-chain.

Implemented: health-based multi-hit hunts (lion 46, leopard 38, hyena 32 base damage; zebra .7 and warthog .85 damage multipliers), 900 ms hit grace, existing matchup rules, 20% wider hunt acquisition and landing range, proportional feeding (lion 5s, hyena 6s, leopard 7s), movement/ability/damage cancellation, health and feeding HUD, host-selected 300/600/unlimited durations, explicit host end, matching offline practice protocol.

The new poacher encounter is procedural art and server simulation: one placement attempt per round on a screened west-bound exit corridor, predator warning, retaliation after explicit E engagement, retreat, entry transition, driving exit, and a subdued state after repeated attacks. Shots deal 25 health, respect protection, solid-prop obstruction, concealment and range, and never target prey. The jeep yields to animals. A safe placement may not be found, in which case no encounter spawns.

Verification: 36 Node tests pass; TypeScript noEmit passes; production build via Sites build-site.mjs passes. Targeted ESLint reports 31 errors and 16 warnings, including existing hook/any patterns; lint is not clean. Existing capture fixtures now explicitly represent wounded prey; new tests cover healthy prey surviving, duplicate resolution, feeding cancellation, range boundary, all durations and shot/prey rules.

Limitations: procedural feeding is a lowered-head approximation, not authored feeding clips. Human/jeep models and entry motion need visual acceptance. Poacher hits currently resolve directly on E, unlike prey lunges. Server sight checks use solid props, not terrain-height occlusion. Escape is a screened straight corridor, not general vehicle pathfinding; an animal camping in front can delay escape indefinitely. Carcass scavenging remains one separate established food reward after 7.5 seconds; feeding cancellation does not expose a resumable remainder. No eight-device or hardware performance validation was performed. Do not label this draft submission-ready or fully verified.

Browser smoke test on the latest checkout: initialized the local D1 database using the existing drizzle/0000_conscious_gravity.sql migration. Room creation works. The lobby saved 10 minutes and displayed 10:00, then saved Unlimited and displayed infinity. Solo practice launched with a leopard, an increasing ELAPSED timer, active food/water drain, and the health HUD. Inspected a gameplay screenshot in compatibility graphics mode. Poacher combat, vehicle movement, feeding animation, mobile layout and cross-device synchronization were not visually validated.
The host's End round for everyone control was clicked in unlimited solo practice and successfully reached the practice results screen. Results still use generic 'Alive at the bell' copy rather than explaining the host-ended reason; this is a remaining UI limitation.

## Release follow-up

The follow-up uses the same safari source. Jeep steering now probes alternate collision-safe headings around stationary animals (regression test passes), and entry interpolates the full-size human into the driver's seat. The driver remains visible while escaping. Repeated hits no longer restart the retaliation warning clock. Poacher sight now samples the same triangulated terrain-height implementation as the renderer. Host-ended results explicitly explain why the round ended.

Current verification: 38/38 Node tests pass, TypeScript --noEmit passes, and the Sites production build passes. Browser testing used local-only database encounter fixtures, not production data: the normal Hunt button provoked a shot reducing lion health from 100 to 75; a healthy impala survived the first hit at 54 health; subsequent Hunt presses resolved one hunt and completed a meal with hunger restored. Screenshots inspected the human/rifle silhouette and the resulting gameplay HUD. The short feeding/entry transition was not captured reliably by the browser tool, so animation quality remains only partially visually assessed. Existing procedural animal models were retained; the new human/jeep art is procedural and faceted, not realistic authored GLB art.

Remaining limitations: a fully surrounded jeep waits safely rather than crushing animals; this steering is local avoidance, not general pathfinding. On-foot retreat does not have full crowd avoidance. Feeding is a lowered-head procedural approximation, and canceled meals cannot be resumed. No mobile hardware or eight-device performance validation. Earlier lint failures remain outside this focused correction.

Final requested damage tuning: lion 60, leopard 52, hyena 48 base prey damage; zebra receives 80% and warthog 90%. Each allowed matchup takes two or three landed hits against healthy prey. Poacher attack damage is unchanged. Added a regression test across the allowed species matchups, including the existing hyena clan requirement for zebra.

## One-hit and responsiveness revision

Per the latest playtest request, one valid landed hunt now catches healthy prey again. The 20% wider range and existing protection, species eligibility, cover, cooldown and escape checks remain. Feeding still uses 5/6/7 seconds with proportional restoration. Impala running speed is 7.8 m/s (from 9) and sprint is 16.2 m/s (from 17.7). Leopard Stalk now runs at 4.5 m/s (from 1) and is fully concealed from every animal sense for the existing four-second duration; this is explicitly a game ability.

Release stops movement immediately, bodies face actual travel instead of future steering, reconciliation is tightened, and outdated moving snapshots no longer pull a stopped local player backward. Request cadence accounts for request time and estimates transit delay. Visual traces update at 10 Hz for visible animals; auto quality starts in performance mode. CPU compatibility rendering uses nearer foliage LOD, lower decorative grass density and shorter draw distance without reducing wildlife population.

Poachers spawned in 20/20 sampled rounds. They now wait until engaged rather than retreating just for seeing a predator. Tracking shows a directional jeep marker and a minimap square, including compatibility mode.

Verification: 41/41 Node tests pass; TypeScript noEmit and Sites production build pass. Browser input tested forward/sideways movement and Stalk; screenshots confirmed the jeep tracking cue. Observed compatibility-renderer FPS samples improved from 2.1 to 13.4 after the fallback-specific changes, but these are cloud-browser samples, not a hardware benchmark or a claim of smooth FPS on every device. GPU-device and multi-device performance remain unmeasured. Previous lint failures were not re-run in this scope.

## Edge encounters and aiming follow-up

Hunt range is now 1.44 times the original (another 20% over 1.2), with a forward aiming half-angle of 85 degrees instead of 65. All original obstacle, protection, species and cooldown gates remain. War thog model and shadow are hidden during burrow even for the owning player. Four separately rendered encounters are distributed across north/east/south/west edges with screened exit routes. The nearest jeep is shown on the tracking compass and all active jeeps appear on the minimap. Direction-aware steering and seated-driver transforms support all four exits.

Engaged poachers allow 1.2 seconds of warning, fire 25-health shots at least 1.5 seconds apart for up to 7 seconds, and can defeat a predator that remains exposed. They retreat on lost contact or at 35 health or below. They do not target prey or shoot an unengaged predator.

Latest checks: full suite 44/44 passes, TypeScript noEmit passes, production build passes. Tests cover four-edge spawning across 20 rounds, all four exit directions, relaxed aim boundaries, and spaced lethal fire without one-shots. Final burrow visibility and four-encounter rendering are code-checked but were not captured in a final browser screenshot after the browser session reset. Earlier movement/stalk and tracking screenshots and cloud FPS samples apply to the same performance changes, before the final edge/facing additions.
