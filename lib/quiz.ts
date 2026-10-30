// The Field Guide Quiz: ten questions on the real animals, each answered by a fact in the field guide
// (lib/species-facts.ts, sources in docs/wildlife-sources.md). Answering all ten right in one go unlocks the Aurora
// skin (lib/rewards.ts SKINS), the only way to get it.
import type {Species} from './game.ts';
import {SPECIES_FACTS} from './species-facts.ts';

export type Question={species:Species;q:string;options:string[];answer:number;fact:number};
export const QUIZ:Question[]=[
 {species:'lion',q:'How fast have collared wild lions been recorded running?',options:['About 35 km/h','Up to 74 km/h','About 110 km/h','About 20 km/h'],answer:1,fact:1},
 {species:'lion',q:'From how far away does a hunting lion usually start its charge?',options:['Seldom more than about 30 m','About 500 m','More than a kilometre','It never charges, only ambushes'],answer:0,fact:0},
 {species:'leopard',q:'Where do leopards often take their kills?',options:['Into a burrow','Into the water','Up into a tree','Back to the pride'],answer:2,fact:0},
 {species:'leopard',q:'How do leopards usually hunt?',options:['In large packs','Alone, by stalking and ambush','By running prey down over many kilometres','Mostly by scavenging'],answer:1,fact:1},
 {species:'hyena',q:'Where do spotted hyenas get most of their food?',options:['Stealing from lions','Fruit and roots','Hunting it themselves','Carcasses left by people'],answer:2,fact:0},
 {species:'hyena',q:'Why do spotted hyena droppings dry chalk-white?',options:['From the calcium in the bone they eat','They eat chalky soil','Sun bleaching only','From the salt they lick'],answer:0,fact:1},
 {species:'hyena',q:'Hyenas that follow circling vultures find carcasses…',options:['No faster','Nearly twice as fast','Ten times as fast','Only at night'],answer:1,fact:2},
 {species:'zebra',q:'How do plains zebras fight off lions and hyenas?',options:['Biting their ears','Hind-leg kicks','Charging with their heads','Hiding in water'],answer:1,fact:0},
 {species:'impala',q:'How far can an escaping impala leap?',options:['About 1 m','About 3 m','Around 10 m','About 40 m'],answer:2,fact:1},
 {species:'warthog',q:'How does a warthog go into its burrow?',options:['Head first','Backwards, tusks facing out','It digs a new one each time','It never uses burrows'],answer:1,fact:0},
];
export const QUIZ_LENGTH=QUIZ.length;
/** the field-guide fact (with its source) that answers question i */
export const quizFact=(q:Question)=>SPECIES_FACTS[q.species].facts[q.fact];
/** a fresh attempt: the questions in a new order, each with its answers shuffled (answer re-pointed) */
export function newAttempt(random:()=>number=Math.random):Question[]{
 const shuffle=<T,>(a:T[])=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
 return shuffle(QUIZ).map(q=>{const order=shuffle(q.options.map((_,i)=>i));return{...q,options:order.map(i=>q.options[i]),answer:order.indexOf(q.answer)};});
}
