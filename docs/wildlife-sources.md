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
- **Mud.** Wading through a watering hole or its mud ring slows every animal to 80 %.
- **Tracks.** Footprints are drawn about four times life size so they read from the follow camera. They fade within 55 s, or
  110 s in mud.
