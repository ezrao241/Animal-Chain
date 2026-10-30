// Progress and rewards: badges for real hunting and escape behaviour, and the natural coat colours they unlock. The
// server decides when a badge is earned (lib/game.ts award, kept owner-only in lib/net.ts); the progress itself (badge
// counts, chosen coats) lives in the player's own browser.
// Every badge and coat points at a real behaviour or a real colour variant with its source (docs/wildlife-sources.md).
import {SPECIES,coatPerk,PERK_SIZE,type Species,type Perk} from './game.ts';
import {SPECIES_FACTS} from './species-facts.ts';

export type BadgeId='stalk10'|'canopy'|'clan'|'kick'|'bound'|'tusks'|'vultures';
export type Badge={id:BadgeId;name:string;how:string;species:Species[];why:string;source:string;url:string};
const fact=(s:Species,i:number)=>({why:SPECIES_FACTS[s].facts[i].text,source:SPECIES_FACTS[s].facts[i].source,url:SPECIES_FACTS[s].facts[i].url});
export const BADGES:Badge[]=[
 {id:'stalk10',name:'Unseen at 10 m',how:'As a predator, creep in to within 10 m of prey you can take before it sees, smells or hears you (moving towards it, not waiting for it to wander close).',species:['lion','leopard','hyena'],...fact('lion',0)},
 {id:'canopy',name:'Out of the canopy',how:'As a leopard, drop from an acacia bough onto prey and land the catch.',species:['leopard'],...fact('leopard',0)},
 {id:'clan',name:'Clan hunt',how:'As a hyena, bring down a zebra with two more hyenas close by.',species:['hyena'],...fact('hyena',0)},
 {id:'kick',name:'Hind-leg kick',how:'As a zebra, land a kick on a predator behind you.',species:['zebra'],...fact('zebra',0)},
 {id:'bound',name:'Ten-metre bound',how:'As an impala, be in the air from a Leap at the moment a predator\'s lunge lands.',species:['impala'],...fact('impala',1)},
 {id:'tusks',name:'Tusks first',how:'As a warthog, back into a burrow while a predator is after you.',species:['warthog'],...fact('warthog',0)},
 {id:'vultures',name:'Followed the vultures',how:'Eat from a fresh kill\'s carcass (circling vultures mark them) as a lion, leopard or hyena.',species:['lion','leopard','hyena'],...fact('hyena',2)},
];
export const badgeById=(id:string)=>BADGES.find(b=>b.id===id);

/** A natural coat colour, unlocked by earning this many badges while playing the animal (each badge counts once a
 *  round). title is its showcase name, name what the variant is really called. The look itself is drawn by
 *  components/game/safari-animals.ts PAINT, in the same order. */
export type Tier='rare'|'epic'|'legendary';
export type Coat={title:string;name:string;tier:Tier;note:string;unlock:number;source:string;url:string};
/** badges as one animal that open its rarer coat */
export const RARE=5;
export const COATS:Record<Species,Coat[]>={
 lion:[
  {title:'Black Mane',tier:'rare',name:'Dark-maned',note:'Mane colour varies from blond to near black; darker manes are more common in cooler places and signal a male in good condition.',unlock:1,source:'West & Packer 2002, Science',url:'https://doi.org/10.1126/science.1073257'},
  {title:'Timbavati Ghost',tier:'epic',name:'White lion',note:'A rare cream coat from a recessive TYR gene variant (leucism, not albinism), known from the Timbavati area of South Africa.',unlock:RARE,source:'OMIA 000202-9689 (Cho et al. 2013)',url:'https://omia.org/4133'},
 ],
 leopard:[
  {title:'Strawberry',tier:'rare',name:'Erythristic (strawberry) leopard',note:'Erythristic leopards: black in the coat replaced by red-brown. Two of 28 leopards at one Mpumalanga reserve were this colour.',unlock:1,source:'Pirie, Thomas & Fellowes 2016, Bothalia',url:'https://library.aosis.co.za/index.php/record/view/33448'},
  {title:'Black Panther',tier:'epic',name:'Melanistic (black) leopard',note:'Melanistic leopards: the rosettes are still there, dark on dark. Camera traps in Laikipia, Kenya, confirmed one in 2019.',unlock:RARE,source:'Pilfold et al. 2019, African Journal of Ecology',url:'https://www.nationalgeographic.com/animals/article/rare-black-panther-spotted-in-africa-century'},
 ],
 hyena:[
  {title:'Clan Elder',tier:'rare',name:'Old hyena, faded spots',note:'Each hyena keeps its own spot pattern for life, but in very old animals the hair grows short and the spots fade and brown.',unlock:1,source:'Hyena Project (Leibniz-IZW), methods',url:'https://hyena-project.com/methods'},
  {title:'Sandstone',tier:'epic',name:'Pale-coated hyena',note:'The background coat ranges from cream to light brown between individuals.',unlock:RARE,source:'hyaenidae.org: spotted hyaena description',url:'https://www.hyaenidae.org/the-hyaenidae/spotted-hyena-crocuta-crocuta/crocuta-physical-description/'},
 ],
 zebra:[
  {title:'Southern Fade',tier:'rare',name:'Lighter southern striping',note:'Plains zebra striping varies across Africa: in some regions the stripes are thinner and lighter and fade on the legs.',unlock:1,source:'Larison et al. 2015, Royal Society Open Science',url:'https://doi.org/10.1098/rsos.140452'},
  {title:'Polka-dot',tier:'epic',name:'Pseudomelanistic zebra',note:'Pseudomelanism: the pigment is there but forms dots instead of stripes. A foal like this was photographed in the Masai Mara in 2019.',unlock:RARE,source:'National Geographic 2019',url:'https://www.nationalgeographic.com/animals/article/zebra-pseudo-melanism-kenya-masai'},
 ],
 impala:[
  {title:'Kaokoveld Blackface',tier:'epic',name:'Black-faced impala',note:'The black-faced impala (Aepyceros melampus petersi) of north-west Namibia and south-west Angola has a dark blaze down the face.',unlock:3,source:'Mammal Diversity Database',url:'https://www.mammaldiversity.org/taxon/1006130'},
 ],
 warthog:[
  {title:'Red Earth',tier:'rare',name:'Red-soil wallower',note:'Warthogs have little hair and wallow in mud to keep cool and shed parasites, so their skin takes the colour of the local soil.',unlock:1,source:'Maryland Zoo: warthog',url:'https://www.marylandzoo.org/animal/common-warthog'},
  {title:'Pale Clay',tier:'epic',name:'Pale-clay wallower',note:'The same wallowing in pale, yellowish clay leaves a sandy coat.',unlock:RARE,source:'Maryland Zoo: warthog',url:'https://www.marylandzoo.org/animal/common-warthog'},
 ],
};

/** Legendary skins: fantasy finishes for any animal, for the hardest goals. Cosmetic only, not real animals, and the
 *  game says so wherever they are shown. They sit after the natural coats in the coat code (digits 3, 4, 5, 6). Aurora
 *  comes only from a perfect Field Guide Quiz (lib/quiz.ts): no badge count opens it. */
export type Skin={id:'gilded'|'ember'|'starlight'|'aurora';title:string;goal:string;have:(p:Progress)=>number;need:number};
export const SKIN_BASE=3;
export const SKINS:Skin[]=[
 {id:'gilded',title:'Sun-Gilded',goal:'Earn every badge at least once',have:p=>BADGES.filter(b=>p.badges[b.id]).length,need:BADGES.length},
 {id:'ember',title:'Emberhide',goal:'Earn 25 badges in all',have:p=>Object.values(p.badges).reduce((n,x)=>n+(x??0),0),need:25},
 {id:'starlight',title:'Starlight',goal:'Earn 3 different badges in one round',have:p=>p.bestRound??0,need:3},
 {id:'aurora',title:'Aurora',goal:'Answer every Field Guide Quiz question right in one go',have:p=>p.quizPerfect?1:0,need:1},
];
export const COSMETIC_NOTE='Fantasy skin: not a real animal colour.';
/** what a coat's perk does, in words, for its card (the rule itself is lib/game.ts COAT_PERKS) */
export const PERK_TEXT:Record<Perk,string>={night:`Night camouflage: ${PERK_SIZE.night*100}% harder to see in the dark`,bite:`Longer reach: lunges reach ${PERK_SIZE.bite*100}% further`,speed:`Swift: ${PERK_SIZE.speed*100}% faster run and sprint`,stamina:`Enduring: sprint lasts ${PERK_SIZE.stamina*100}% longer`};
export const perkText=(s:Species,i:number)=>{const k=coatPerk(s,i);return k?PERK_TEXT[k]:undefined;};

// ---------------------------------------------------------------- the player's own progress (this browser only)
export type Progress={badges:Partial<Record<BadgeId,number>>;earnedAs:Partial<Record<Species,number>>;coats:Partial<Record<Species,number>>;
 /** most badges earned in a single round */
 bestRound?:number;
 /** a Field Guide Quiz answered with every question right (opens the Aurora skin), and the best score so far */
 quizPerfect?:boolean;quizBest?:number;
 /** the badges of the current round already counted (a reload mid-round doesn't count them twice) */
 seen?:{round:string;ids:string[]}};
const KEY='animal-chain-progress';
const empty=():Progress=>({badges:{},earnedAs:{},coats:{}});
export function loadProgress():Progress{try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');return raw&&typeof raw==='object'?{...empty(),...raw}:empty();}catch{return empty();}}
export function saveProgress(p:Progress){try{localStorage.setItem(KEY,JSON.stringify(p));}catch{}}
/** coat 0 is the usual colour and always open */
export function coatUnlocked(p:Progress,s:Species,i:number){
 if(i===0)return true;
 if(i>=SKIN_BASE){const k=SKINS[i-SKIN_BASE];return!!k&&k.have(p)>=k.need;}
 const c=COATS[s][i-1];return!!c&&(p.earnedAs[s]??0)>=c.unlock;
}
/** every coat a species can wear, natural then legendary, as [code digit, coat] */
export const coatChoices=(s:Species)=>[...COATS[s].map((c,i)=>[i+1,c] as const),...SKINS.map((k,i)=>[SKIN_BASE+i,{title:k.title,name:k.title,tier:'legendary' as Tier,note:COSMETIC_NOTE,unlock:k.need,source:'',url:''}] as const)];
/** what still stands between the player and a coat: progress so far and the target */
export function coatProgress(p:Progress,s:Species,i:number){
 if(i>=SKIN_BASE){const k=SKINS[i-SKIN_BASE];return{have:Math.min(k.have(p),k.need),need:k.need,goal:k.goal};}
 const c=COATS[s][i-1];return{have:Math.min(p.earnedAs[s]??0,c.unlock),need:c.unlock,goal:c.unlock===1?'Earn a badge as this animal':`Earn ${c.unlock} badges as this animal`};
}
/** every coat (species and code digit) open with this progress, for spotting new unlocks */
export const unlockedKeys=(p:Progress)=>SPECIES.flatMap(s=>coatChoices(s).filter(([i])=>coatUnlocked(p,s,i)).map(([i])=>s+':'+i));
/** The chosen coat for each species, one digit each in SPECIES order, as sent to the room ('000000' = all usual). */
export const coatCode=(p:Progress)=>SPECIES.map(s=>{const i=p.coats[s]??0;return coatUnlocked(p,s,i)?i:0;}).join('');
export const coatOf=(code:string|undefined,s:Species)=>{const i=Number(code?.[SPECIES.indexOf(s)]??0);return i>0&&i<=COATS[s].length||i>=SKIN_BASE&&i<SKIN_BASE+SKINS.length?i:0;};
