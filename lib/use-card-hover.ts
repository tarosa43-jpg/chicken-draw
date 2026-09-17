 'use client';
import {useEffect,useRef,useState} from 'react';
import type {view} from './game';
type Hover={by:string;target:string;slot:number};
export function useCardHover(s:ReturnType<typeof view>, enabled:boolean) {
 const desired=useRef<{target:string;slot:number}|null>(null);
 const [remote,setRemote]=useState<Hover|null>(null);
 const [local,setLocal]=useState<{target:string;slot:number}|null>(null);
 const serial=s.turnSerial;
 useEffect(()=>{
  desired.current=null;setLocal(null);setRemote(null);
  if(s.phase!=='play')return;
  let stopped=false,reading=false,writing=false,last='',lastSent=0;
  const controller=new AbortController();
  async function sync(){
   if(stopped || document.hidden)return;
   if(!reading){reading=true;
    void fetch(`/api/game?code=${s.code}&hover=1`,{cache:'no-store',signal:controller.signal}).then(async r=>{
      if(r.ok){const data=await r.json() as {hover:Hover|null};if(!stopped)setRemote(data.hover);}
    }).catch(()=>{if(!stopped)setRemote(null);}).finally(()=>{reading=false;});
   }
   if(s.turn!==s.me || !enabled || writing)return;
   const value=desired.current; const key=JSON.stringify(value);
   if(key===last && (!value || Date.now()-lastSent<600))return;
   writing=true;last=key;lastSent=Date.now();
   try{await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({type:'hover',code:s.code,serial,requestId:crypto.randomUUID(),...(value??{})})});}catch{}finally{writing=false;}
  }
  void sync();const timer=setInterval(sync,500);
  const clear=()=>{desired.current=null;setLocal(null);};
  window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  return()=>{stopped=true;controller.abort();clearInterval(timer);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};
 },[s.code,s.phase,s.turn,s.me,serial,enabled]);
 return {hover:s.turn===s.me ? (local?{...local,by:s.me}:null) : remote, point:(target?:string,slot?:number)=>{const next=enabled&&target&&slot!==undefined?{target,slot}:null;desired.current=next;setLocal(next);}};
}
