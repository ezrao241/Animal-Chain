# Visual reference: the Golden Plains

The map is one place at one time, so the light, colours and vegetation stay consistent.

## Place, season and time

- **Place:** central Serengeti, Tanzania, around Seronera: open grassland with scattered umbrella thorn acacias, granite kopjes and seasonal watering holes. About 2.3° S.
- **Season:** early dry season, late June. Little rain, clear skies with a few fair-weather cumulus. The grass is drying to straw and tan but still grey-green at the base, with green flushes near water and in damp swales.
- **Time:** about 10:30 in the morning. At this latitude in late June the sun is roughly 50° above the horizon in the north-east, so shadows are short and fall to the south-west.

## How the game shows it

| Element | In the game |
| --- | --- |
| Sun | One direction (`SUN` in `components/game/savanna-world.ts`, north is -z) drives the directional light, the sun disc, the sky glow, the painted shade under trees, bushes and kopjes, and the contact shadow under each animal. |
| Light | Near-white sun, blue skylight filling the shade, a warm bounce from the dry grass, exposure 1.0 with ACES tone mapping, so the ground is not blown out and shade is cool rather than black. |
| Sky and haze | Deep dry-season blue overhead fading to a pale dusty horizon. Distance haze is pale blue-grey and starts at about half the draw range, so nearby animals are never hidden. |
| Ground | Straw, tan and grey-green mixed per facet; olive swales; red-brown bare soil; greener grass and mud at the watering holes; pale worn game trails; dug earth at burrows. |
| Trees | Umbrella thorn acacias with grey-olive dry-season canopies. Their trunks and limbs come from `lib/acacia.ts`, which the climbing rules also use. |
| Kopjes | Grey-pink granite boulders with pale tops and yellow-orange lichen, sunk into low mounds. |
| Home screen | Keeps its separate golden-hour look (low sun in the north-west); only the game itself uses late morning. |

`?graphics=performance|balanced|high` on the page URL pins the quality tier. Real shadow maps are drawn on `high`; the other tiers use the painted shade.

## Sources

- Dry-season timing and July conditions: [Discover Africa, Serengeti in July](https://www.discoverafrica.com/safaris/serengeti-national-park/serengeti-july/), [Champion Traveler, best time to visit Serengeti](https://championtraveler.com/dates/best-time-to-visit-serengeti-national-park-tz/). These are travel sources; the season is a broad choice, not a precise climate claim.
- Kopjes as exposed granite inselbergs with vegetation in soil-filled cracks, and as refuges and lookouts for animals: [Amusing Planet, The Kopjes of Serengeti](https://www.amusingplanet.com/2014/09/the-kopjes-of-serengeti.html), [World Safaris, kopjes as islands of biodiversity](https://worldsafaris.com/incredible-kopjes-islands-of-biodiversity/).
- Sun height and direction are worked out from the latitude and the June solstice declination (about +23.4°), not taken from a source.

## Simplifications

- The map is 400 x 280 m, much smaller than any real home range, and denser in trees, kopjes and water than real open plains.
- Grass is shown as scattered tufts over a coloured ground, not continuous sward, to keep the frame rate up.
