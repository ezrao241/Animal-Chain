// Field-guide facts about the six real species, each with where it comes from. These are biology, kept apart from the
// game's own numbers (diet lists, threats, speeds and timers in ANIMALS are game rules; see docs/wildlife-sources.md).
import type {Species} from './game.ts';

export type Fact={text:string;source:string;url:string};
const AWF='https://www.awf.org/wildlife-conservation/';
const WILSON={source:'Wilson et al. 2018, Nature',url:'https://www.researchgate.net/publication/322697727_Biomechanics_of_predator-prey_arms_race_in_lion_zebra_cheetah_and_impala'};
const MPALA={source:'Mpala Live field guide',url:'https://www.mpalalive.org/field_guide/view/impala'};

export const SPECIES_FACTS:Record<Species,{awf:string;facts:Fact[]}>={
 lion:{awf:AWF+'lion',facts:[
  {text:'Lions stalk close in cover and seldom charge from more than about 30 m away; they cannot hold top speed past roughly 100 to 200 m.',source:'LionAlert',url:'https://lionalert.org/predatory-behaviour/'},
  {text:'Collared wild lions were recorded at up to 74 km/h, and had more acceleration and braking than the zebra they hunt.',...WILSON},
 ]},
 leopard:{awf:AWF+'leopard',facts:[
  {text:'Leopards are the savanna\'s tree climbers: they rest draped along boughs and often haul kills into trees, out of reach of lions and hyenas.',source:'African Wildlife Foundation',url:AWF+'leopard'},
  {text:'Leopards are solitary, stalk-and-ambush hunters that take mostly medium-sized prey such as impala.',source:'African Wildlife Foundation',url:AWF+'leopard'},
 ]},
 hyena:{awf:AWF+'hyena',facts:[
  {text:'Spotted hyenas hunt most of their own food, often running prey down over several kilometres, as well as scavenging.',source:'Kruuk 1972, The Spotted Hyena',url:'https://en.wikipedia.org/wiki/Spotted_hyena'},
  {text:'Their droppings dry chalk-white from the calcium in the bone they eat.',source:'Inside Science',url:'https://insidescience.org/news/hyenas-bone-crunching-helps-recycle-nutrients'},
  {text:'Hyenas that follow circling vultures find carcasses nearly twice as fast.',source:'Kane et al. 2017 (Trinity College Dublin)',url:'https://www.tcd.ie/news_events/articles/eyes-in-the-sky--how-ground-bound-animals-follow-vultures-to-a-free-lunch/'},
 ]},
 zebra:{awf:AWF+'zebra',facts:[
  {text:'Plains zebras defend themselves with hind-leg kicks that can injure lions and hyenas (mostly field reports and video).',source:'Latest Sightings',url:'https://latestsightings.com/single-post/zebra-lands-a-kick-and-gets-away-from-lion'},
  {text:'Collared zebras reached about 50 km/h in everyday running; popular figures give 55 to 65 km/h.',...WILSON},
 ]},
 impala:{awf:AWF+'impala',facts:[
  {text:'An impala that spots a predator snorts an alarm; surprised at close range, the herd scatters in many directions.',...MPALA},
  {text:'Collared impala ran at up to 64 km/h; they escape mostly by jinking turns and leaps of around 10 m.',...WILSON},
  {text:'Territorial males keep habitual dung heaps (middens) to mark their ground.',...MPALA},
 ]},
 warthog:{awf:AWF+'warthog',facts:[
  {text:'Warthogs back into burrows, often old aardvark holes, so a predator meets their tusks first.',source:'SANParks',url:'https://www.sanparks.org/conservation/parks/marakele-national-park/primary-consumers-herbivores/common-warthog'},
  {text:'Burrows are not foolproof: lions sometimes dig warthogs out.',source:'Latest Sightings',url:'https://latestsightings.com/single-post/lions-dig-out-warthog-from-hidden-burrow'},
 ]},
};
