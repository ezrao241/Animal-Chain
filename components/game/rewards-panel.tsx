'use client';
// Progress and rewards on screen: the Badges & coats book (badges, the natural coats and legendary skins they unlock),
// the tally that turns badges the server awards into lasting progress on this device, the toast when one is earned,
// and the reveal card when a coat unlocks.
import {useCallback,useEffect,useRef,useState,type ReactElement} from 'react';
import {Award,Lock,Sparkles} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {ModelPortrait as Portrait} from '@/components/game/WorldScene';
import {ANIMALS,SPECIES,type Player,type Species} from '@/lib/game';
import {BADGES,SKINS,COSMETIC_NOTE,badgeById,coatUnlocked,coatChoices,coatProgress,unlockedKeys,loadProgress,saveProgress,type Progress,type BadgeId,type Tier} from '@/lib/rewards';

/** The player's progress, loaded from this browser once on mount and saved on every change. */
export function useProgress(){
 const [progress,setProgress]=useState<Progress>({badges:{},earnedAs:{},coats:{}}),[loaded,setLoaded]=useState(false);
 useEffect(()=>{setProgress(loadProgress());setLoaded(true);},[]);
 const update=useCallback((change:(p:Progress)=>Progress)=>setProgress(old=>{const next=change(old);saveProgress(next);return next;}),[]);
 return [progress,update,loaded] as const;
}

/** Counts each badge the server awards this round once (the round's list survives a reload in progress.seen) and
 *  returns the latest one for a toast. */
export function useBadgeTally(me:Player|undefined,round:string,update:(c:(p:Progress)=>Progress)=>void){
 const [latest,setLatest]=useState<{id:BadgeId;at:number}|null>(null),seen=useRef<{round:string;ids:string[]}|null>(null);
 const ids=(me?.badges||[]).join(),species=me?.species;
 useEffect(()=>{
  if(!species||!round)return;
  if(seen.current?.round!==round)seen.current=loadProgress().seen?.round===round?loadProgress().seen!:{round,ids:[]};
  const fresh=(ids?ids.split(','):[]).filter(id=>!seen.current!.ids.includes(id)&&badgeById(id)) as BadgeId[];
  if(!fresh.length)return;
  seen.current={round,ids:[...seen.current.ids,...fresh]};const mark=seen.current;
  update(p=>{const badges={...p.badges},earnedAs={...p.earnedAs};for(const id of fresh){badges[id]=(badges[id]??0)+1;earnedAs[species]=(earnedAs[species]??0)+1;}return{...p,badges,earnedAs,seen:mark,bestRound:Math.max(p.bestRound??0,mark.ids.length)};});
  setLatest({id:fresh[fresh.length-1],at:Date.now()});
 },[ids,round,species,update]);
 return latest;
}

/** Shown for a few seconds (the CSS animation fades it out), anew for each badge. */
export function BadgeToast({latest}:{latest:{id:BadgeId;at:number}|null}){
 const b=latest&&badgeById(latest.id);
 return b?<div key={latest!.at} className="badge-toast" role="status"><Award size={18}/><span><small>BADGE EARNED</small><b>{b.name}</b>{b.why}</span></div>:null;
}

/** The badges earned this round, for the results screen. */
export function RoundBadges({ids}:{ids:string[]}){
 const list=ids.map(badgeById).filter(Boolean);
 if(!list.length)return null;
 return <div className="round-badges"><span className="eyebrow">BADGES THIS ROUND</span><div>{list.map(b=><span key={b!.id} title={b!.how}><Award size={13}/>{b!.name}</span>)}</div></div>;
}

const TIER_NAME:Record<Tier|'common',string>={common:'Common',rare:'Rare',epic:'Epic',legendary:'Legendary'};

/** Coats that unlock while this page is open, one at a time, for the reveal card (none on first load). */
export function useCoatReveal(progress:Progress,loaded:boolean){
 const known=useRef<Set<string>|null>(null),[queue,setQueue]=useState<{s:Species;i:number}[]>([]);
 const keys=unlockedKeys(progress).join();
 useEffect(()=>{
  if(!loaded)return;const now=new Set(keys?keys.split(','):[]);
  if(known.current){const fresh=[...now].filter(k=>!known.current!.has(k)).map(k=>{const [s,i]=k.split(':');return{s:s as Species,i:Number(i)};});if(fresh.length)setQueue(q=>[...q,...fresh]);}
  known.current=now;
 },[keys,loaded]);
 return [queue[0],()=>setQueue(q=>q.slice(1))] as const;
}

/** A coat just unlocked: a showcase of the animal in it, its rarity, and Wear it / Later. */
/** compact: the in-round version, at the side and smaller, so it never covers the animal mid-hunt */
export function CoatReveal({next,done,update,compact=false}:{next:{s:Species;i:number}|undefined;done:()=>void;update:(c:(p:Progress)=>Progress)=>void;compact?:boolean}){
 if(!next)return null;const c=coatChoices(next.s).find(([i])=>i===next.i)?.[1];if(!c)return null;
 return <div className={`coat-reveal tier-${c.tier} ${compact?'compact':''}`} role="dialog" aria-label="New coat unlocked"><span className="reveal-rays" aria-hidden="true"/>
  <span className="eyebrow"><Sparkles size={13}/> NEW {TIER_NAME[c.tier].toUpperCase()} COAT</span>
  <div className="reveal-portrait"><Portrait species={next.s} coat={next.i} size={compact?96:150}/></div>
  <h3>{c.title}</h3><small>{ANIMALS[next.s].name}{c.tier==='legendary'?'':' · '+c.name}</small>{compact?null:<p>{c.note}</p>}
  <div className="reveal-actions"><button className="quiet-link" onClick={done}>Later</button><button className="tutorial-next" onClick={()=>{update(p=>({...p,coats:{...p.coats,[next.s]:next.i}}));done();}}>Wear it</button></div></div>;
}

type Tab='badges'|'coats';
export function RewardsBook({progress,update,trigger}:{progress:Progress;update:(c:(p:Progress)=>Progress)=>void;trigger:ReactElement}){
 const [tab,setTab]=useState<Tab>('badges');
 const earned=BADGES.filter(b=>progress.badges[b.id]).length;
 const coats=SPECIES.reduce((n,s)=>n+coatChoices(s).filter(([i])=>coatUnlocked(progress,s,i)).length,0),allCoats=SPECIES.reduce((n,s)=>n+coatChoices(s).length,0);
 return <Dialog><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="guide-dialog rewards-book"><DialogHeader><DialogTitle>Badges & coats</DialogTitle></DialogHeader>
  <p className="small-note">Badges are for real hunting and escape behaviour, and every badge you earn as an animal counts towards its coats (each badge once a round). Rare and Epic coats are real colour variants of the wild animal; Legendary skins are fantasy finishes for the hardest goals. Your progress stays in this browser.</p>
  <div className="rewards-tabs" role="tablist">{([['badges',`Badges ${earned}/${BADGES.length}`],['coats',`Coats ${coats}/${allCoats}`]] as const).map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'on':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
  {tab==='badges'&&<div className="badge-list">{BADGES.map(b=>{const n=progress.badges[b.id]??0;return <div key={b.id} className={n?'earned':''}><span className="badge-medal">{n?<Award size={20}/>:<Lock size={16}/>}</span><div><strong>{b.name}{n>1?<small> ×{n}</small>:null}</strong><p>{b.how}</p><p className="badge-why">{b.why} <a href={b.url} target="_blank" rel="noreferrer">{b.source}</a></p><small className="badge-who">{b.species.map(s=>ANIMALS[s].name).join(' · ')}</small></div></div>;})}</div>}
  {tab==='coats'&&<CoatPicker progress={progress} update={update}/>}
 </DialogContent></Dialog>;
}

function CoatPicker({progress,update}:{progress:Progress;update:(c:(p:Progress)=>Progress)=>void}){
 return <div className="coat-list">
  <div className="skin-goals"><span className="eyebrow"><Sparkles size={13}/> LEGENDARY SKINS · ANY ANIMAL</span>{SKINS.map(k=>{const have=Math.min(k.have(progress),k.need);return <div key={k.id} className={have>=k.need?'won':''}><b>{k.title}</b><small>{k.goal}</small><i><em style={{width:`${have/k.need*100}%`}}/></i><span>{have}/{k.need}</span></div>;})}<p className="small-note">{COSMETIC_NOTE} Legendary skins are made up for the game.</p></div>
  {SPECIES.map(s=>{const chosen=progress.coats[s]??0;
  return <section key={s}><strong>{ANIMALS[s].name}</strong><div className="coat-row">{[[0,null] as const,...coatChoices(s)].map(([i,c])=>{const open=coatUnlocked(progress,s,i),tier=c?.tier??'common',goal=i?coatProgress(progress,s,i):null;
   return <button key={i} className={`coat-option tier-${tier} ${chosen===i?'on':''} ${open?'':'locked'}`} disabled={!open} aria-pressed={chosen===i} onClick={()=>update(p=>({...p,coats:{...p.coats,[s]:i}}))} title={c?.note||'The usual coat'}>
    <span className="coat-tier">{TIER_NAME[tier]}</span>
    <span className="coat-portrait"><Portrait species={s} coat={i} size={64}/>{open?null:<span className="coat-lock"><Lock size={14}/></span>}</span>
    <b>{c?.title??'Usual'}</b>{c&&c.tier!=='legendary'&&<small className="coat-real">{c.name}</small>}
    {c&&(open?<small>{c.note}</small>:<span className="coat-goal"><small>{goal!.goal}</small><i><em style={{width:`${goal!.have/goal!.need*100}%`}}/></i><small>{goal!.have}/{goal!.need}</small></span>)}
    {c?.url&&open?<a href={c.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{c.source}</a>:null}
   </button>;})}</div></section>;})}
  <p className="small-note">Rare and Epic coats are real colour variants of the wild species, from the source shown; some are very rare in the wild. Legendary skins are cosmetic. Other players see your coat in multiplayer rounds.</p></div>;
}
