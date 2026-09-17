 'use client';
import {useEffect,useState} from 'react';
export default function DiceRoll({result}:{result?:number}){
 const [face,setFace]=useState(0);
 const [rolling,setRolling]=useState(true);
 useEffect(()=>{setRolling(true);const timer=setInterval(()=>setFace(f=>(f+1)%6),100);const stop=setTimeout(()=>{clearInterval(timer);if(result)setFace(result-1);setRolling(false);},2200);return()=>{clearInterval(timer);clearTimeout(stop);};},[result]);
 return <span className="rolling-die" style={rolling?undefined:{animation:'none'}} aria-label={rolling?'サイコロを振っています':`${face+1}の目`}>{['⚀','⚁','⚂','⚃','⚄','⚅'][face]}</span>;
}
