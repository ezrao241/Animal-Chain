'use client';
// In-round extras: the first-round tutorial, the performance readout (Stats / P) and the field-guide facts about the
// real animals. Kept out of app/page.tsx so the page stays about the room and the round.
import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import {ANIMALS,UNITS_PER_METRE,type Player,type Species} from '@/lib/game';
import {SPECIES_FACTS} from '@/lib/species-facts';

const TUTORIAL_KEY='animal-chain-tutorial-seen';
export function tutorialSeen(){try{return localStorage.getItem(TUTORIAL_KEY)==='1';}catch{return false;}}
const markSeen=()=>{try{localStorage.setItem(TUTORIAL_KEY,'1');}catch{}};

type TutorialInput={dx:number;dy:number;sprint:boolean};
type TutorialAnimal=Pick<Player,'x'|'y'|'born'|'deadUntil'|'posture'|'hunger'|'food'|'hunts'|'drinks'|'scavenged'|'abilityReady'>&{thirst?:number};
type Step={title:string;body:string;todo:string[];done:(me:TutorialAnimal,from:TutorialAnimal&{crouched?:boolean;tried?:boolean},held:number)=>boolean[]};
const M=UNITS_PER_METRE,moved=(a:TutorialAnimal,b:TutorialAnimal)=>Math.hypot(a.x-b.x,a.y-b.y)/M;
// the phone layout (stick and touch buttons) is the one shown at 760 px wide or less, whatever the pointer
const touchScreen=()=>{try{return matchMedia('(max-width:760px)').matches;}catch{return false;}};

/** The first minute of a first round, learnt by doing: each step ticks itself off when the player actually moves, sprints,
 *  crouches, lies down, eats or drinks and uses the special move (the round keeps running). Skip ends it; Next skips a step.
 *  Shown once per browser; "How to play" in the room menu starts it again. Wording follows the layout: keys, or the phone's stick and buttons. */
export function Tutorial({species,me,input,onClose}:{species:Species;me:TutorialAnimal;input:MutableRefObject<TutorialInput>;onClose:()=>void}){
 const a=ANIMALS[species],[touch]=useState(touchScreen),hunter=a.prey.length>0;
 const k=(key:string,button:string)=>touch?button:key;
 const steps:Step[]=[
  {title:'Move',body:`${k('WASD or the arrow keys move you','The left stick moves you')} the way the camera looks. ${k('Drag the mouse','Drag the screen')} to look around; the camera swings back behind you as you turn.`,
   todo:['Walk 10 metres'],done:(m,f)=>[moved(m,f)>=10]},
  {title:'Sprint',body:`${k('Hold Shift','Hold the SPRINT button')} while moving to run flat out. A sprint burns stamina, and in this game a ${a.name.toLowerCase()} is spent after about ${a.gait.sprintTime} seconds, so save it for a chase or an escape.`,
   todo:['Sprint for a moment'],done:(_m,_f,held)=>[held>=1.2]},
  {title:'Hide',body:`Real hunters creep up low and animals lie up to rest. Crouching keeps you to a walk but makes you harder to spot; lying flat hides you more and gets your stamina back faster. Moving gets you up again.`,
   todo:[k('Press C to crouch','Tap Crouch'),k('Press X to lie down','Tap Lie down')],done:(m,f)=>[m.posture==='crouch'||f.crouched===true,m.posture==='lie']},
  {title:hunter?'Hunt, eat and drink':'Eat and drink',body:`${hunter?`Creep close to prey from behind or the side, staying low, then ${k('press E','tap Eat / Hunt')} to strike. You can also eat carrion where vultures circle.`:`Graze where you see your food: when its ring lights up you are close enough, so ${k('press E','tap Eat / Hunt')}.`} ${k('E','The same button')} drinks at a watering hole. You only take food once Food is under 90% and water once Water is under 60%, so keep an eye on both meters. You eat: ${a.diet}.`,
   todo:[k('Press E','Tap Eat / Hunt')+(hunter?' to strike, eat or drink':' to eat or drink')],done:(m,f)=>[!!f.tried||m.food+m.hunts+m.drinks+m.scavenged>f.food+f.hunts+f.drinks+f.scavenged]},
  {title:'Survive',body:`${/^Nothing hunts/.test(a.threat)?'':'When the screen edges glow red you are being hunted: sprint, turn hard and make for cover. '}Watch for: ${a.threat}. Your special move is ${a.ability} (${k('Space','its button')}): ${a.tip} Your three tasks are on the right, and every extra minute a life lasts scores more.`,
   todo:[`Use ${a.ability}`],done:(m,f)=>[m.abilityReady>f.abilityReady]},
 ];
 const [step,setStep]=useState(0),[ticks,setTicks]=useState<boolean[]>([]),from=useRef<TutorialAnimal&{crouched?:boolean;tried?:boolean}>({...me}),held=useRef(0),last=useRef(me),advancing=useRef(false);
 useEffect(()=>{last.current=me;});
 const close=()=>{markSeen();onClose();};
 const go=(n:number)=>{if(n>=steps.length)return close();from.current={...last.current};held.current=0;advancing.current=false;setTicks([]);setStep(n);};
 // an eat/hunt press counts as trying it (food only goes in when the animal is hungry or thirsty enough)
 useEffect(()=>{const press=(e:Event)=>{if(step!==3)return;if(e instanceof KeyboardEvent?e.key.toLowerCase()==='e':(e.target as HTMLElement)?.closest?.('.touch-hunt,.primary-action'))from.current.tried=true;};
  window.addEventListener('keydown',press,true);window.addEventListener('pointerdown',press,true);window.addEventListener('click',press,true);return()=>{window.removeEventListener('keydown',press,true);window.removeEventListener('pointerdown',press,true);window.removeEventListener('click',press,true);};},[step]);
 // checks run on a timer rather than on each server update so a held sprint is timed even between updates
 useEffect(()=>{const timer=setInterval(()=>{const m=last.current;if(m.deadUntil||advancing.current)return;
  if(m.born!==from.current.born){from.current={...m,tried:from.current.tried};held.current=0;}// a new life starts the step's count again
  const i=input.current;if(i.sprint&&(i.dx||i.dy))held.current+=.25;
  if(m.posture==='crouch')from.current.crouched=true;
  const now=steps[step].done(m,from.current,held.current);setTicks(now);
  if(now.every(Boolean)){advancing.current=true;setTimeout(()=>go(step+1),900);}},250);return()=>clearInterval(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[step]);
 const s=steps[step],last1=step===steps.length-1;
 // not a dialog: the game ignores keys pressed inside dialogs, and this card must let every key through
 return <div className="tutorial-card glass" role="region" aria-label="How to play" aria-live="polite"><span className="eyebrow">FIRST MINUTE · {step+1} / {steps.length}</span><h3>{s.title}</h3><p>{s.body}</p>
  <ul className="tutorial-todo">{s.todo.map((t,i)=><li key={t} className={ticks[i]?'done':''}><span aria-hidden="true">{ticks[i]?'✓':'○'}</span>{t}</li>)}</ul>
  <div className="tutorial-progress" aria-hidden="true">{steps.map((_,i)=><i key={i} className={i<step?'past':i===step?'now':''}/>)}</div>
  <div className="tutorial-actions"><button className="quiet-link" onClick={e=>{e.currentTarget.blur();close();}}>Skip tutorial</button><button className="tutorial-next" onClick={e=>{e.currentTarget.blur();go(step+1);}}>{last1?'Got it':'Next'}</button></div></div>;
}

export type NetSample={rttMs:number;receivedAt:number};
type LinkInfo={quality:string;srtt:number;losses:number[];pollMs():number};
const HISTORY=60;
/** FPS and drawing time come from the renderer's own two-second samples (WorldScene publishes them on .world-scene);
 *  round-trip is the last game request; snapshot age is how long since the last state arrived. */
export function StatsPanel({net,link}:{net:React.MutableRefObject<NetSample>;link?:React.MutableRefObject<LinkInfo>}){
 const [, setTick]=useState(0),history=useRef<number[]>([]),lastFps=useRef('');
 useEffect(()=>{const id=setInterval(()=>{const el=document.querySelector<HTMLElement>('.world-scene');const fps=el?.dataset.fps;if(fps&&fps!==lastFps.current){lastFps.current=fps;history.current.push(Number(fps));if(history.current.length>HISTORY)history.current.shift();}setTick(t=>t+1);},250);return()=>clearInterval(id);},[]);
 const el=typeof document!=='undefined'?document.querySelector<HTMLElement>('.world-scene'):null,h=history.current;
 const age=net.current.receivedAt?Date.now()-net.current.receivedAt:0,stale=age>1500;
 const low=h.length?Math.min(...h):0,avg=h.length?h.reduce((x,y)=>x+y,0)/h.length:0;
 return <div className="stats-panel glass" role="status" aria-label="Performance"><span className="eyebrow">STATS · P</span>
  <dl><dt>FPS</dt><dd>{el?.dataset.fps??'–'}<small>{h.length?` avg ${avg.toFixed(0)} · low ${low.toFixed(0)}`:''}</small></dd>
  <dt>Round trip</dt><dd>{net.current.rttMs?`${Math.round(net.current.rttMs)} ms`:'–'}</dd>
  {link&&<><dt>Connection</dt><dd>{link.current.quality}<small>{` · ${link.current.pollMs()} ms polls · ${link.current.losses.length} lost`}</small></dd></>}
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
