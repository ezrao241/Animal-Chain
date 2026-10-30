'use client';
// In-round extras: the first-round tutorial, the performance readout (Stats / P) and the field-guide facts about the
// real animals. Kept out of app/page.tsx so the page stays about the room and the round.
import {useEffect,useRef,useState} from 'react';
import {ANIMALS,type Species} from '@/lib/game';
import {SPECIES_FACTS} from '@/lib/species-facts';

const TUTORIAL_KEY='animal-chain-tutorial-seen';
export function tutorialSeen(){try{return localStorage.getItem(TUTORIAL_KEY)==='1';}catch{return false;}}
const markSeen=()=>{try{localStorage.setItem(TUTORIAL_KEY,'1');}catch{}};

/** Three short cards over the running round (the clock doesn't wait). Shown once per browser; the room menu reopens it. */
export function Tutorial({species,onClose}:{species:Species;onClose:()=>void}){
 const [step,setStep]=useState(0),a=ANIMALS[species];
 const steps=[
  {title:'Move',body:'WASD or the arrow keys move you the way the camera looks (on a phone, the left stick). Shift sprints until your stamina runs out. Drag to look around; R puts the camera behind you. C crouches and X lies down, like the wild animals do.'},
  {title:'Survive',body:'Keep Food and Water up: E eats, drinks or hunts when you are close enough, and the ring around food you can eat lights up. Your three tasks are on the right; every extra minute a life lasts scores more.'},
  {title:`Your ${a.name.toLowerCase()}`,body:`You eat: ${a.diet}. Watch for: ${a.threat}. ${a.ability} (Space): ${a.tip}`},
 ];
 const close=()=>{markSeen();onClose();};
 const s=steps[step];
 return <div className="tutorial-card glass" role="dialog" aria-label="How to play" aria-live="polite"><span className="eyebrow">HOW TO PLAY · {step+1} / 3</span><h3>{s.title}</h3><p>{s.body}</p>
  <div className="tutorial-actions"><button className="quiet-link" onClick={close}>Skip</button>{step<2?<button className="tutorial-next" onClick={()=>setStep(step+1)}>Next</button>:<button className="tutorial-next" onClick={close}>Got it</button>}</div></div>;
}

export type NetSample={rttMs:number;receivedAt:number};
const HISTORY=60;
/** FPS and drawing time come from the renderer's own two-second samples (WorldScene publishes them on .world-scene);
 *  round-trip is the last game request; snapshot age is how long since the last state arrived. */
export function StatsPanel({net}:{net:React.MutableRefObject<NetSample>}){
 const [, setTick]=useState(0),history=useRef<number[]>([]),lastFps=useRef('');
 useEffect(()=>{const id=setInterval(()=>{const el=document.querySelector<HTMLElement>('.world-scene');const fps=el?.dataset.fps;if(fps&&fps!==lastFps.current){lastFps.current=fps;history.current.push(Number(fps));if(history.current.length>HISTORY)history.current.shift();}setTick(t=>t+1);},250);return()=>clearInterval(id);},[]);
 const el=typeof document!=='undefined'?document.querySelector<HTMLElement>('.world-scene'):null,h=history.current;
 const age=net.current.receivedAt?Date.now()-net.current.receivedAt:0,stale=age>1500;
 const low=h.length?Math.min(...h):0,avg=h.length?h.reduce((x,y)=>x+y,0)/h.length:0;
 return <div className="stats-panel glass" role="status" aria-label="Performance"><span className="eyebrow">STATS · P</span>
  <dl><dt>FPS</dt><dd>{el?.dataset.fps??'–'}<small>{h.length?` avg ${avg.toFixed(0)} · low ${low.toFixed(0)}`:''}</small></dd>
  <dt>Round trip</dt><dd>{net.current.rttMs?`${Math.round(net.current.rttMs)} ms`:'–'}</dd>
  <dt>Drawing</dt><dd>{el?.dataset.renderMs?`${el.dataset.renderMs} ms`:'–'}</dd>
  <dt>Snapshot age</dt><dd className={stale?'stale':''}>{age?`${age} ms`:'–'}</dd></dl>
  {stale&&<p className="stats-waiting">Waiting for the server…</p>}
  <p className="small-note">{h.length} of {HISTORY} two-second samples kept.</p></div>;
}

/** What the field guide and the room menu say about the real animal, each line with its source. */
export function AnimalFacts({species,compact=false}:{species:Species;compact?:boolean}){
 const f=SPECIES_FACTS[species];
 return <div className={`animal-facts ${compact?'compact':''}`}><ul>{f.facts.map((x,i)=><li key={i}>{x.text} <a href={x.url} target="_blank" rel="noreferrer">{x.source}</a></li>)}</ul><a className="awf-link" href={f.awf} target="_blank" rel="noreferrer">More on the {ANIMALS[species].name.toLowerCase()} from the African Wildlife Foundation</a></div>;
}
