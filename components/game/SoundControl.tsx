'use client';
import {useEffect,useRef,useState} from 'react';
import {Volume1,Volume2,VolumeX} from 'lucide-react';
import type {SoundLevels} from '@/lib/animal-sounds';

/** The top bar's sound button: a click opens volume and ambience sliders and a mute switch; M mutes from anywhere. */
export function SoundControl({levels,setLevels}:{levels:SoundLevels;setLevels:(l:SoundLevels)=>void}){
 const [open,setOpen]=useState(false),box=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const away=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('pointerdown',away);window.addEventListener('keydown',esc);return()=>{window.removeEventListener('pointerdown',away);window.removeEventListener('keydown',esc);};},[open]);
 const silent=levels.muted||levels.volume===0,Icon=silent?VolumeX:levels.volume<.45?Volume1:Volume2;
 const slider=(key:'volume'|'ambience',label:string)=><label className="sound-slider"><span>{label}<b>{Math.round(levels[key]*100)}</b></span><input type="range" min={0} max={1} step={.05} value={levels[key]} onChange={e=>setLevels({...levels,[key]:Number(e.target.value),muted:false})} aria-label={label}/></label>;
 return <div className="sound-control" ref={box}>
  <button type="button" className="icon-button sound-button" aria-label={silent?'Sound is off: open sound settings':'Sound settings'} aria-expanded={open} onClick={()=>setOpen(o=>!o)}><Icon size={19}/></button>
  {open&&<div className="sound-panel glass" role="group" aria-label="Sound">
   <div className="sound-head"><span>Sound</span><button type="button" className={levels.muted?'on':''} aria-pressed={levels.muted} onClick={()=>setLevels({...levels,muted:!levels.muted})}>{levels.muted?'Muted':'Mute'} <kbd>M</kbd></button></div>
   {slider('volume','Volume')}
   {slider('ambience','Savanna ambience')}
   <small>Wind, birds, insects and far-off calls change with the time of day. Headphones let you hear which side a call comes from.</small>
  </div>}
 </div>;
}
