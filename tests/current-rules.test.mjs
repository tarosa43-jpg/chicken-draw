import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,player,act,tick,view,ITEMS,itemPool} from '../lib/game.ts';
function game(n=2) {
 const r=createRoom('123456','a','A');
 for(let i=1;i<n;i++)r.players.push(player(String.fromCharCode(97+i),'P'+i));
 act(r,'a',{type:'start'});
 for(const p of r.players)act(r,p.id,{type:'ready'});
 tick(r,Object.fromEntries(r.players.map(p=>[p.id,r.deadline])),r.deadline);
 r.turn='a';r.chosenTarget=null;r.deadline=Date.now()+120000;
 for(const p of r.players)p.hand=Array.from({length:9},()=>({value:0,angel:true}));
 for(const p of r.players)p.items=[];
 return r;
}
function draw(r,id='a',slot=0,target='b') {
 if(!r.chosenTarget)act(r,id,{type:'nominate',target});
 act(r,id,{type:'draw',target,slot});
}
test('two players: seventh angel immediately wins; second round starts from zero',()=>{
 const r=game();for(let i=0;i<7;i++)draw(r,'a',i);
 assert.equal(r.phase,'result');assert.equal(r.results[0].winner,'a');
 act(r,'a',{type:'next'});
 assert.equal(r.players[0].roundDraws,0);assert.equal(r.players[0].score,0);assert.equal(r.players[0].draws,7);
 for(const p of r.players)act(r,p.id,{type:'ready'});
 tick(r,Object.fromEntries(r.players.map(p=>[p.id,r.deadline])),r.deadline);
 r.turn='a';r.chosenTarget=null;r.players[1].hand[0]={value:0,angel:true};draw(r);
 assert.equal(r.phase,'play');assert.equal(r.players[0].score,1);
});
test('double applies only to the first angel drawn after activation',()=>{
 const r=game(3);const p=r.players[0];p.items=['double'];
 act(r,'a',{type:'item',item:0});draw(r,'a',0);assert.equal(p.score,2);
 draw(r,'a',1);assert.equal(p.score,3);act(r,'a',{type:'stop'});assert.equal(p.doubled,false);
});

test('dud consumes an active shield without bursting',()=>{
 const r=game(3);const p=r.players[0];p.items=['shield'];act(r,'a',{type:'item',item:0});
 r.players[1].hand[0]={value:0,skull:true,dud:true};draw(r,'a',0,'b');
 assert.equal(p.shield,false);assert.equal(p.status,'alive');assert.equal(p.score,0);
 assert.equal(r.events.findLast(e=>e.draw).draw.dudConsumedShield,true);
});
test('guard halves turn earnings and ends turn, preserving previous rounds of play',()=>{
 const r=game(3);const p=r.players[0];p.score=3;p.items=['shield'];
 draw(r,'a',0);draw(r,'a',1);act(r,'a',{type:'item',item:0});
 r.players[1].hand[2]={value:0,skull:true};draw(r,'a',2);
 assert.equal(p.score,4);assert.equal(p.status,'alive');assert.notEqual(r.turn,'a');assert.equal(p.shield,false);
});
test('unused shield expires on turn end',()=>{const r=game(3);r.players[0].items=['shield'];act(r,'a',{type:'item',item:0});draw(r);act(r,'a',{type:'stop'});assert.equal(r.players[0].shield,false);});
test('peek is private, shows angel and trap; other player can use it on their turn',()=>{
 const r=game();r.turn='b';r.players[1].items=['peek'];r.players[0].hand[0].endTurn=true;
 act(r,'b',{type:'item',item:0,target:'a',slot:0});
 assert.equal(view(r,'b',{}).players[1].peeks[0].angel,true);
 assert.equal(view(r,'b',{}).players[1].peeks[0].endTurn,true);
 assert.equal(view(r,'a',{}).players[1].peeks,undefined);
});
test('current items are the only grantable items',()=>{assert.deepEqual([...ITEMS].sort(),['blessing','counter','double','dud','nominate','oracle','peek','recycle','reposition','shield','substitute','trap']);});
test('oracle privately reports three sampled positions, and handles short hands',()=>{
 const r=game();r.players[0].items=['oracle','oracle'];
 act(r,'a',{type:'item',item:0,target:'b'});
 const e=r.events.at(-1);assert.match(e.text,/3枚.*ありません/);
 assert.ok(view(r,'a',{}).events.some(x=>x.id===e.id));
 const publicEvent=view(r,'b',{}).events.find(x=>x.id===e.id);
 assert.equal(publicEvent.effect.item,'notice');assert.equal(publicEvent.effect.target,undefined);assert.doesNotMatch(publicEvent.text,/3枚|ありません/);assert.match(publicEvent.text,/お告げ/);
 r.players[1].hand=[{value:0,skull:true},null];
 act(r,'a',{type:'item',item:0,target:'b'});assert.match(r.events.at(-1).text,/1番（1枚）.*あります/);
});
test('substitute subtracts two without exchanging cards and ends turn',()=>{
 const r=game(3);const p=r.players[0];p.items=['substitute'];p.score=5;p.earned=5;
 const angel={value:0,angel:true,endTurn:true};p.hand[4]=angel;
 const skull={value:0,skull:true};r.players[1].hand[0]=skull;
 act(r,'a',{type:'item',item:0});draw(r);
 assert.equal(p.hand[4],angel);assert.equal(r.players[1].hand[0],null);
 assert.equal(p.status,'alive');assert.equal(p.score,3);assert.equal(p.earned,3);assert.notEqual(r.turn,'a');
 assert.equal(p.substituteSlot,null);assert.equal(r.events.findLast(e=>e.draw).draw.burst,false);
});
test('substitute rejects shields, needs no selected card and expires unused',()=>{
 const r=game(3);const p=r.players[0];p.items=['substitute','shield'];p.hand[0]={value:0,skull:true};
 act(r,'a',{type:'item',item:0});
 assert.throws(()=>act(r,'a',{type:'item',item:0}));
 draw(r);act(r,'a',{type:'stop'});assert.equal(p.substituteSlot,null);
});
test('substitute cannot reduce earnings below zero',()=>{
 for(const score of [0,1,1.5,2]) {
  const r=game(3);const p=r.players[0];p.score=score;p.items=['substitute'];
  r.players[1].hand[0]={value:0,skull:true};
  act(r,'a',{type:'item',item:0});draw(r);assert.equal(p.score,0);assert.equal(p.status,'alive');
 }
});
test('item announcements are private to the user, including for spectators',()=>{
 const r=game();r.players[0].items=['trap'];
 r.spectators=[{id:'observer',name:'Observer'}];
 act(r,'a',{type:'item',item:0,ownSlot:0});
 const announcement=r.events.at(-1);
 assert.equal(announcement.effect.item,'trap');
 assert.ok(view(r,'a',{}).events.some(e=>e.id===announcement.id));
 for(const id of ['b','observer'])assert.ok(!view(r,id,{}).events.some(e=>e.id===announcement.id));
 assert.equal(r.players[0].hand[0].endTurn,true);
 draw(r);
 for(const id of ['a','b','observer'])assert.ok(view(r,id,{}).events.some(e=>e.draw));
});
test('arrangement is applied once and preserved on confirmation',()=>{
 const r=createRoom('123456','a','A');r.players.push(player('b','B'));act(r,'a',{type:'start'});
 assert.equal(r.phase,'arrange');const before=structuredClone(r.players[0].hand);const order=[8,0,1,2,3,4,5,6,7];
 act(r,'a',{type:'ready',order});assert.deepEqual(r.players[0].hand,order.map(i=>before[i]));
 act(r,'b',{type:'ready'});assert.deepEqual(r.players[0].hand,order.map(i=>before[i]));
});
test('timeout draws exactly once from nominated player and ends turn',()=>{
 const r=game(3);act(r,'a',{type:'nominate',target:'c'});r.deadline=Date.now()-1;
 tick(r,Object.fromEntries(r.players.map(p=>[p.id,Date.now()])));
 assert.equal(r.players[0].draws,1);assert.notEqual(r.turn,'a');assert.equal(r.events.findLast(e=>e.draw).draw.from,'c');
});
test('two wins end a three-round match',()=>{
 const r=game();r.round=2;r.results=[{round:1,winner:'a',scores:[],draw:false}];
 for(let i=0;i<7;i++)draw(r,'a',i);
 assert.equal(r.phase,'final');assert.equal(r.results.at(-1).winner,'a');
});
test('dud looks like a skull to peek and oracle but does not burst or score',()=>{
 const r=game(3);r.players[0].items=['dud'];
 act(r,'a',{type:'item',item:0,ownSlot:0});
 r.turn='b';r.chosenTarget=null;r.players[1].items=['peek','oracle'];
 act(r,'b',{type:'item',item:0,target:'a',slot:0});
 const seen=r.players[1].peeks[0];assert.equal(seen.skull,true);assert.equal(seen.dud,undefined);
 r.players[0].hand=r.players[0].hand.map((c,i)=>i===0?c:null);
 act(r,'b',{type:'item',item:0,target:'a'});assert.match(r.events.at(-1).text,/ドクロがあります/);
 draw(r,'b',0,'a');assert.equal(r.players[1].score,0);assert.notEqual(r.players[1].status,'burst');assert.equal(r.events.findLast(e=>e.draw).draw.dud,true);
});
test('random guard roulette selects self or safe',t=>{
 for(const sample of [0,1]) {
  const r=game(3);r.players[0].items=['counter'];r.players[1].hand[0]={value:0,skull:true};
  act(r,'a',{type:'item',item:0});
  const stub=t.mock.method(globalThis.crypto,'getRandomValues',a=>{a.fill(sample);return a;});
  draw(r);stub.mock.restore();
  const roll=r.events.findLast(e=>e.draw).draw.counter;
  assert.equal(roll.face,sample);assert.equal(roll.victim,sample===0?'a':undefined);
  assert.deepEqual(roll.options,['a','']);
  if(roll.victim) assert.equal(r.players.find(p=>p.id===roll.victim).status,'burst');
    if (sample === 1) assert.equal(r.turn, 'a');
  for(const p of r.players)assert.deepEqual(view(r,p.id,{}).events.findLast(e=>e.draw).draw.counter,roll);
 }
});

test('angel blessing prevents a skull without penalty or ending the turn',()=>{
 const r=game(3);const p=r.players[0];p.items=['blessing'];p.score=4;
 r.players[1].hand[0]={value:0,skull:true};
 draw(r);
 const event=r.events.findLast(e=>e.draw).draw;
 assert.equal(p.status,'alive');assert.equal(p.score,4);assert.equal(r.turn,'a');
 assert.equal(event.blessing,true);assert.equal(event.shield,false);assert.equal(event.burst,false);assert.equal(event.endedTurn,false);
});

test('nominate item is announced publicly without exposing private details',()=>{
 const r=game(3);r.players[0].items=['nominate'];
 act(r,'a',{type:'item',item:0,target:'b'});
 const notice=view(r,'b',{}).events.findLast(e=>e.effect);
 assert.deepEqual(notice.effect,{by:'a',item:'notice',text:'A が「指名変更」を使用しました'});
});

test('counter is in the normal item pool for three-player games',()=>{
 const pool=itemPool(player('pool','Pool'));
 for(const item of ITEMS) assert.equal(pool.filter(candidate=>candidate===item).length,item==='blessing'?0:4);
});

test('counter conflicts with defenses in either order and ignores dud',()=>{
 for(const defense of ['shield','substitute'])for(const first of [true,false]) {
  const r=game(3);r.players[0].items=first?['counter',defense]:[defense,'counter'];
  act(r,'a',{type:'item',item:0});assert.throws(()=>act(r,'a',{type:'item',item:0}));
 }
 const r=game(3);r.players[0].items=['counter'];act(r,'a',{type:'item',item:0});
 r.players[1].hand[0]={value:0,skull:true,dud:true};draw(r);
 assert.equal(r.players[0].counter,true);assert.equal(r.players[0].status,'alive');assert.equal(r.players[0].score,0);
});
test('reposition preserves identities including holes, rejects invalid order, clears peeks',()=>{
 const r=game(3);const p=r.players[0];p.items=['reposition','reposition'];p.hand[0]=null;
 const before=structuredClone(p.hand);
 assert.throws(()=>act(r,'a',{type:'item',item:0,order:[0,0]}));assert.equal(p.items.length,2);
 r.players[1].peeks=[{target:'a',slot:1,value:0,angel:true}];
 const order=[8,7,6,5,4,3,2,1,0];act(r,'a',{type:'item',item:0,order});
 assert.deepEqual(p.hand,order.map(i=>before[i]));assert.equal(r.players[1].peeks.length,0);
 const same=structuredClone(p.hand);act(r,'a',{type:'item',item:0,order:[0,1,2,3,4,5,6,7,8]});assert.deepEqual(p.hand,same);
});

test('six public item notices show names but conceal targets and results from opponents and spectators',()=>{
 for(const item of ['reposition','dud','oracle','peek','double','recycle']) {
  const r=game(3);r.spectators=[{id:'observer',name:'Observer'}];r.players[0].items=[item,'trap'];
  act(r,'a',{type:'item',item:0,ownSlot:0,target:'b',slot:0,sacrifice:1,order:[0,1,2,3,4,5,6,7,8]});
  const event=r.events.at(-1);
  assert.equal(view(r,'a',{}).events.find(e=>e.id===event.id).effect.item,item);
  for(const id of ['b','c','observer']) {
   const notice=view(r,id,{}).events.find(e=>e.id===event.id);
   const names={reposition:'再配置',dud:'不発弾',oracle:'お告げ',peek:'透視',double:'得点倍化',recycle:'リサイクル'};
   const text=`A が「${names[item]}」を使用しました`;
   assert.deepEqual(notice.effect,{by:'a',item:'notice',text});
   assert.equal(notice.text,text);
  }
 }
});
