'use client';
import {useEffect,useState} from 'react';

export default function RouletteRoll({labels,result}:{labels:string[];result:number}) {
  const [done,setDone]=useState(false);
  useEffect(()=>{
    setDone(false);
    const stop=setTimeout(()=>setDone(true),2400);
    return ()=>clearTimeout(stop);
  },[labels.length,result]);
  const colors=['#a85d5d','#526d9d','#64815d','#8d7446','#8065a0'];
  // 各区画の中央を固定ポインター（12時方向）に合わせて停止させる。
  const stop = -((result + 0.5) * 360 / labels.length);
  const background=`conic-gradient(${labels.map((_,i)=>`${colors[i%colors.length]} ${i*100/labels.length}% ${(i+1)*100/labels.length}%`).join(',')})`;
  return <div className={'roulette-result '+(done?'done':'')} role="status" aria-label={done?`ルーレット結果 ${labels[result]}`:'ルーレットを回しています'}>
    <span className="roulette-pointer">▼</span>
    <div className="roulette-dial" style={{'--segments':labels.length,'--stop':`${stop}deg`,background} as React.CSSProperties}>
      {labels.map((label,i)=><b key={i} style={{'--i':i} as React.CSSProperties}>{label}</b>)}
    </div>
  </div>;
}
