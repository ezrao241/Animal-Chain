# Wildlife facts and game rules

Animal Chain simplifies real savanna ecology into a five-minute game. This note records which behaviours come from
wildlife references and which are game rules, so nobody mistakes a mechanic for science.

## Documented behaviour the game draws on

| Behaviour in the game | What the references say | Source |
| --- | --- | --- |
| Lions stalk close in cover, then make a short charge, and abandon a chase that runs long | Lions seldom charge until within about 30 m, cannot hold top speed beyond roughly 100–200 m, and usually abandon a chase if the first run misses. Single lions by day succeed in under a fifth of hunts. | [LionAlert: predatory behaviour](https://lionalert.org/predatory-behaviour/) |
| Lions do best where cover lets them get close | Lions are opportunist stalk-and-ambush hunters, relying on good cover, acceleration and occasional cooperation. | [Hopcraft et al. 2005, J. Animal Ecology](https://www.esf.edu/biology/faculty/documents/Hopcraftetal2005lionspreyvulnerabilityrisk.pdf) |
| Scavengers find carcasses by watching vultures | Hyenas and jackals following vultures found carcasses nearly twice as fast (Masai Mara fieldwork and modelling). | [Trinity College Dublin summary of Kane et al. 2017](https://www.tcd.ie/news_events/articles/eyes-in-the-sky--how-ground-bound-animals-follow-vultures-to-a-free-lunch/) |
| Impala snort when they see a predator; the herd faces the threat, then bolts in many directions | An impala that spots a predator snorts and moves off; if surprised close, the herd scatters in many directions. | [Mpala Live field guide: impala](https://www.mpalalive.org/field_guide/view/impala) |
| Impala dung middens | Territorial male impala keep habitual dung heaps (middens) to mark territory. | [Mpala Live field guide: impala](https://www.mpalalive.org/field_guide/view/impala) |
| Chalk-white hyena latrines | Hyena droppings turn white from the calcium in the bone they eat; hyenas use latrines at territory edges. | [Inside Science: hyena bone crunching](https://insidescience.org/news/hyenas-bone-crunching-helps-recycle-nutrients) |
| Warthogs back into burrows, often old aardvark holes | Warthogs reverse into burrows so a predator meets their tusks first; they commonly use abandoned aardvark holes. Lions sometimes dig them out, so burrows are not foolproof. | [SANParks: common warthog](https://www.sanparks.org/conservation/parks/marakele-national-park/primary-consumers-herbivores/common-warthog), [Latest Sightings](https://latestsightings.com/single-post/lions-dig-out-warthog-from-hidden-burrow) |
| Zebras kick with the hind legs | Zebra kicks can injure lions and hyenas. The evidence is mostly field reports and video, not systematic study. | [Latest Sightings: zebra kick](https://latestsightings.com/single-post/zebra-lands-a-kick-and-gets-away-from-lion) |

Diets, sizes and the prey matchups (no leopard or lone hyena takes an adult zebra; nothing hunts a lion) were set in the
safari redo and are unchanged here.

## Speeds

Measured in the game with `.lab`-style straight sprints on open ground (2026-10-21): every species reaches exactly its
listed top speed, and holds it for its listed sprint time before tiring (lion 7.7 s, about 170 m; hyena 43 s; zebra
28 s; impala 17 s; leopard 9 s; warthog 13 s). 0 to 90 % of top speed takes 1.7 s (leopard) to 3 s (zebra).

| Animal | Game top speed | Real figures | Source |
| --- | --- | --- | --- |
| Lion | 22 m/s (79 km/h), spent after about 9 s | Collared wild lions: 20.6 m/s (74 km/h) by the third-fastest individual, 13.9 m/s at the 98th percentile; popular figure about 80 km/h. A charge rarely lasts beyond 100–200 m. | [Wilson et al. 2018, Nature 554:183](https://www.researchgate.net/publication/322697727_Biomechanics_of_predator-prey_arms_race_in_lion_zebra_cheetah_and_impala); [LionAlert](https://lionalert.org/predatory-behaviour/) |
| Plains zebra | 18 m/s (65 km/h) | Commonly given as about 55–65 km/h; collared zebras reached 13.8 m/s (50 km/h) in routine running. Lions had about 37 % more acceleration and 72 % more deceleration than their prey in the same study, which the game's zebra acceleration and braking now follow. | [Wilson et al. 2018](https://www.researchgate.net/publication/322697727_Biomechanics_of_predator-prey_arms_race_in_lion_zebra_cheetah_and_impala); [Africa Freak](https://africafreak.com/how-fast-can-a-zebra-run) |
| Impala | 17.7 m/s (64 km/h), 10 m bounds, the tightest turns in the game | Collared impala reached 17.7 m/s (64 km/h), the game's figure; wildlife charities quote up to 90 km/h (unmeasured) and leaps of about 10 m. Impala escape by agility (jinking turns and leaps) rather than by outrunning a lion. | [Wilson et al. 2018](https://www.researchgate.net/publication/322697727_Biomechanics_of_predator-prey_arms_race_in_lion_zebra_cheetah_and_impala); [IFAW: impalas](https://www.ifaw.org/international/animals/impalas) |
| Spotted hyena | 17 m/s (61 km/h) for about 45 s | Up to about 60 km/h; chases often run several kilometres, at about 40–50 km/h when sustained. | [Spotted hyena (Wikipedia, citing Kruuk 1972)](https://en.wikipedia.org/wiki/Spotted_hyena); [Lateral magazine](https://www.lateralmag.com/articles/issue-23/hunters-of-the-night) |
| Leopard | 16.5 m/s (59 km/h), short bursts | About 58–65 km/h in short bursts (popular sources; no field measurement found). | general references, approximate |
| Warthog | 13 m/s (47 km/h) | Common warthog about 48 km/h. | [Africa Freak](https://africafreak.com/how-fast-can-a-warthog-run) |

Simplifications: the 400 × 280 m map can't hold a several-kilometre hyena chase, so a hyena's endurance is shown as a
45 s sprint (and Tireless) rather than a run of kilometres. The zebra's top speed follows the commonly quoted figure,
which is higher than the collar maximum from Wilson et al. (the impala uses the collar figure); the collars logged everyday
running, and the authors note animals rarely reached their limits, so the true maxima are uncertain.

## Game rules (simplifications, not facts)

- **Detection ranges.** Each species has a sight range in game units. Running makes an animal fully noticeable,
  walking about 60 %, and standing still about 35 %. A stalking leopard counts as 45 % of that, and an animal in a tree
  canopy 50 %. Within 4.5 m anything not hidden is noticed. Real detection distances are far longer and vary with light
  and terrain. These numbers are scaled to a 400 × 280 m map.
- **Cover.** Thickets cut detection to 45 % for everything but a zebra. Tall grass cuts it to 50 % only for animals under a metre at the
  shoulder, so a lion or zebra standing in grass is still in plain view. Boulders block sight completely. Acacia trunks
  never do.
- **Wind.** Each round has one fixed breeze direction, shown on the HUD. Scent reaches an animal within 17 m when the
  breeze blows from the source towards it. The references disagree on whether lions choose downwind approaches (LionAlert
  says they don't; [Wijers et al. 2022](https://www.biology.ox.ac.uk/node/2747456) found lions move crosswind more in
  stronger wind), so the game treats it as a clear, learnable rule rather than a claim about real lions.
- **Sound.** A sprinting animal is heard within 19 m, behind boulders too. Hearing gives only a rough direction.
- **Grazing vigilance.** An animal grazing with its head down notices 30 % less. Heads lift on a steady rhythm you can see.
- **Herd alarm.** The first animal to bolt calls. Other prey within 26 m react after their own 0.15–0.8 s delay, and
  each one flees at its own angle.
- **Chase limits.** Wild lions give up after 5 s, leopards after 4 s and hyenas after 12 s, or once the prey gets far
  away. After a failed chase they rest in shade. These are game numbers inspired by the short lion charge described
  above.
- **Defences.** The zebra kick reaches 4 m and only behind the zebra, has an 8 s cooldown and stuns for 2.5 s. The impala
  leap lasts 0.9 s (a bound of about 10 m) with a 6 s cooldown. The warthog burrow needs a burrow within 4.5 m and lasts 5 s with a 9 s cooldown.
- **Hunger and thirst.** Food and water are separate meters. Water falls from full to empty in about four minutes;
  with none left, food burns twice as fast. Food falls faster for grazers (0.6 a second) than for hyenas (0.45),
  leopards (0.4) and lions (0.35), following the real pattern of grazers feeding most of the day and big carnivores
  gorging and then fasting, at game speed. An animal can only drink below 60 % water and eat below 90 % food, so a
  watering hole or a patch of grass can't be farmed for points.
- **Catches.** Pressing Eat / Hunt next to prey commits a lunge that lands 0.25 s later. The prey must be within 65°
  of the way the hunter is moving or facing, with no trunk or boulder in between, and still in reach, not leaping and
  not in a burrow when it lands; a kick in that moment knocks the hunter off balance. The prey sees the lunge coming
  (its danger warning lights up). A leopard's drop from a bough is checked when it lands, not when it jumps. Real
  hunts have a commitment moment too, but 0.25 s is a game number chosen to be readable.
- **Carrion.** The old carcasses scattered on the plains are replaced 2.5 minutes after one is eaten, so they tide a
  predator over between hunts but can't feed it indefinitely. Fresh kills leave a carcass for 90 s.
- **Scoring a life.** Species tasks pay once per species per round, however many lives it takes. Staying alive pays
  10, 20, 30... points for each further minute of the same life, and the menu's New life counts as a death (a 6 s
  wait, and the next animal starts no better fed or watered), so ending a life early never earns more.
- **Who hunts zebra.** Lions favour zebra over smaller prey, and spotted hyenas take zebra only as a clan of three
  or more within 30 m (a lone hyena can't); clan members travel together and join each other's chases. These follow
  the real pattern (zebra is a staple of lions and of hyena clans; leopards take only foals, which the game leaves
  out). Wild lions and hyenas go after favoured prey whenever they can, but only chase warthogs once they are
  properly hungry. A standing zebra is easy to pick out in open grass, so it is seen from
  further away than other still animals.
- **Population mix (simplification).** Six lions, six hyenas and three leopards share the plains with 45 grazers so
  that a five-minute round has encounters. Real savannas carry far more prey for every predator; this ratio is a game
  choice, not a fact.
- **Mud.** Wading through a watering hole or its mud ring slows every animal to 80 %.
- **Tracks.** Footprints are drawn about four times life size so they read from the follow camera. They fade within 55 s, or
  110 s in mud.
- **October 27 playtest tuning (game rules that depart from the facts above).** The impala's in-game sprint is
  16.2 m/s and its run 7.8 m/s, below the measured 17.7 m/s in the speed table, so predators can close on it on this small
  map. While Stalk is active (4 s) a leopard moves at 4.5 m/s and is hidden from every animal sense; the 45 % figure above
  applies outside Stalk. Neither is a claim about real leopards or impala.
- **Hunting and feeding.** A catch needs prey in front (within 85° of the lunge) and within 1.44 × the species
  catch range, with nothing solid between. One landed catch is enough (the October 27 playtest setting). A predator that
  has caught prey stays at the kill for 5 s (lion), 6 s (hyena) or 7 s (leopard) and regains up to 45 food in proportion
  to the time actually spent, and moving, an ability, a climb, a stun or death ends the meal early with only the part
  eaten. These timings and numbers are game abstractions, not
  measured feeding times or injuries.

## Climbing and solid objects

Real behaviour the climbing rules follow:
- **Leopards** are the savanna's tree climbers. They go up a trunk in a few seconds, pulling with the forelimbs and
  pushing with the hind limbs, lie up draped over a bough with legs and tail hanging, carry kills up, and come down
  head first before jumping the last stretch.
- **Lions** do climb, famously in Ishasha (Uganda) and Lake Manyara (Tanzania), but only into big, low, near-level
  limbs. They are heavy and clumsy up there, and they jump down rather than climb down.
- **Hyenas, zebras, impalas and warthogs** don't climb trees.

Game numbers (in `CLIMB` and `BODY`, lib/game.ts):
- A leopard climbs at 2 m/s, walks along a bough at 0.9 m/s, uses wood down to 4.5 cm radius, climbs down at
  1.2 m/s and jumps the last 1.6 m.
- A lion only uses the low resting bough when it starts no higher than 1.8 m and is thick enough (8.5 cm radius or
  more) where its body sits. It climbs at 0.9 m/s and leans into the trunk at about 55° instead of hanging on it. At a
  taller tree it rears, scrabbles to about 1.3 m and slides back.
- Every animal's body is a capsule (nose reach, rump, half-width measured off its model), and that whole body is kept
  out of trunks and boulders, not just its centre point.
- Each acacia's trunk and limbs come from one shared description (lib/acacia.ts), so the bark the paws land on is the
  bark that is drawn.
