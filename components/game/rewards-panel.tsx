'use client';
// Progress and rewards on screen: the Badges & coats book (badges and the natural coat colours they unlock), the
// tally that turns badges the server awards into lasting progress on this device, and the toast when one is earned.
import {useCallback,useEffect,useRef,useState,type ReactElement} from 'react';
import {Award,Lock} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {ModelPortrait as Portrait} from '@/components/game/WorldScene';
import {ANIMALS,SPECIES,type Player} from '@/lib/game';
import {BADGES,COATS,RARE,badgeById,coatUnlocked,loadProgress,saveProgress,type Progress,type BadgeId} from '@/lib/rewards';

/** The player's progress, loaded from this browser once on mount and saved on every change. */
export function useProgress(){
 const [progress,setProgress]=useState<Progress>({badges:{},earnedAs:{},coats:{}});
 useEffect(()=>{setProgress(loadProgress());},[]);
 const update=useCallback((change:(p:Progress)=>Progress)=>setProgress(old=>{const next=change(old);saveProgress(next);return next;}),[]);
 return [progress,update] as const;
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
  update(p=>{const badges={...p.badges},earnedAs={...p.earnedAs};for(const id of fresh){badges[id]=(badges[id]??0)+1;earnedAs[species]=(earnedAs[species]??0)+1;}return{...p,badges,earnedAs,seen:mark};});
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

type Tab='badges'|'coats';
export function RewardsBook({progress,update,trigger}:{progress:Progress;update:(c:(p:Progress)=>Progress)=>void;trigger:ReactElement}){
 const [tab,setTab]=useState<Tab>('badges');
 const earned=BADGES.filter(b=>progress.badges[b.id]).length;
 const coats=SPECIES.reduce((n,s)=>n+COATS[s].filter((_,i)=>coatUnlocked(progress,s,i+1)).length,0),allCoats=SPECIES.reduce((n,s)=>n+COATS[s].length,0);
 return <Dialog><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="guide-dialog rewards-book"><DialogHeader><DialogTitle>Badges & coats</DialogTitle></DialogHeader>
  <p className="small-note">{`Badges are for real hunting and escape behaviour. Earn one as an animal to unlock its first natural coat colour, and ${RARE} as that animal for the rarer one (each badge counts once a round). Your progress stays in this browser.`}</p>
  <div className="rewards-tabs" role="tablist">{([['badges',`Badges ${earned}/${BADGES.length}`],['coats',`Coats ${coats}/${allCoats}`]] as const).map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'on':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
  {tab==='badges'&&<div className="badge-list">{BADGES.map(b=>{const n=progress.badges[b.id]??0;return <div key={b.id} className={n?'earned':''}><span className="badge-medal">{n?<Award size={20}/>:<Lock size={16}/>}</span><div><strong>{b.name}{n>1?<small> ×{n}</small>:null}</strong><p>{b.how}</p><p className="badge-why">{b.why} <a href={b.url} target="_blank" rel="noreferrer">{b.source}</a></p><small className="badge-who">{b.species.map(s=>ANIMALS[s].name).join(' · ')}</small></div></div>;})}</div>}
  {tab==='coats'&&<CoatPicker progress={progress} update={update}/>}
 </DialogContent></Dialog>;
}

function CoatPicker({progress,update}:{progress:Progress;update:(c:(p:Progress)=>Progress)=>void}){
 return <div className="coat-list">{SPECIES.map(s=>{const chosen=progress.coats[s]??0;
  const options=[{name:'Usual',note:'',source:'',url:'',unlock:0},...COATS[s]];
  return <section key={s}><strong>{ANIMALS[s].name}</strong><div className="coat-row">{options.map((c,i)=>{const open=coatUnlocked(progress,s,i);
   const have=progress.earnedAs[s]??0,need=c.unlock===1?'Earn a badge as this animal':`Earn ${c.unlock} badges as this animal (${have}/${c.unlock})`;
   return <button key={i} className={`coat-option ${chosen===i?'on':''} ${open?'':'locked'}`} disabled={!open} aria-pressed={chosen===i} onClick={()=>update(p=>({...p,coats:{...p.coats,[s]:i}}))} title={open?c.note:need}>
    <Portrait species={s} coat={open?i:0} size={58}/><b>{open?null:<Lock size={11}/>}{c.name}</b>
    {i>0&&<small>{open?c.note:need}</small>}{i>0&&open&&<a href={c.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{c.source}</a>}
   </button>;})}</div></section>;})}
  <p className="small-note">Every coat is a real colour variant of the wild species, from the source shown. Some are very rare in the wild; here anyone can earn them. Other players see your coat in multiplayer rounds.</p></div>;
}
