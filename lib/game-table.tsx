'use client';
import { useCardHover } from '@/lib/use-card-hover';
import { playSound } from '@/lib/sound';
import { Gift, Skull, OctagonX } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Dice5,
  ScanEye,
  Sparkles,
  Shuffle,
  ArrowLeftRight,
  ShieldCheck,
  ChevronsUp,
  VenetianMask,
  RotateCcw,
  MousePointer2,
  Recycle,
  Feather,
  Flame,
  ArrowRight,
  Check,
  X,
  GripVertical,
  Smartphone,
} from 'lucide-react';
import type { Event, Item, view } from '@/lib/game';
import DiceRoll from '@/components/dice-roll';
import RouletteRoll from '@/components/roulette-roll';
import { moveInOrder } from '@/lib/arrangement';
import { ITEM_INFO } from '@/lib/item-info';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
type State = ReturnType<typeof view>;
type Props = {
  s: State;
  busy: boolean;
  resultReady: boolean;
  effect?: {item:string; target?:string};
  event?: Event;
  revealStage?: number;
  turnBanner?: string;
  seconds: number;
  send: (type: string, data?: Record<string, unknown>) => Promise<unknown>;
};
const icons = {
  trap: OctagonX,
  dice: Dice5,
  eye: ScanEye,
  oracle: Sparkles,
  shuffle: Shuffle,
  swap: ArrowLeftRight,
  shield: ShieldCheck,
  double: ChevronsUp,
  mask: VenetianMask,
  reverse: RotateCcw,
  choose: MousePointer2,
  recycle: Recycle,
  point: MousePointer2,
  blessing: Sparkles,
};
export function ItemIcon({ item }: { item: Item }) {
  const Icon = icons[ITEM_INFO[item].icon as keyof typeof icons];
  return <Icon aria-hidden="true" />;
}
export default function GameTable({ s, busy, seconds, send, resultReady, effect, event, revealStage = 0, turnBanner }: Props) {
  const result = s.results.at(-1);
  const celebrating = resultReady && (s.phase === 'result' || s.phase === 'final');
  const winnerIds = result ? (result.winner ? [result.winner] : result.scores.filter(p => p.score === Math.max(...result.scores.map(q => q.score))).map(p => p.id)) : [];
  useEffect(() => { if (celebrating) playSound('win'); }, [celebrating, s.round]);
  const me = s.players.find((p) => p.id === s.me) ?? s.players[0];
  const myTurn = s.phase === 'play' && s.turn === s.me && me.status === 'alive';
  const activePlayer = s.players.find((p) => p.id === s.turn);
  const turnLabel = activePlayer
    ? (activePlayer.completedTurns ?? 0) === 0 ? '1stターン' : 'Finalターン'
    : '';
  const [tip,setTip]=useState('');
  const [arrangePicked,setArrangePicked]=useState<number|null>(null);
  const [itemDrag,setItemDrag]=useState<{index:number;x:number;y:number;startX:number;startY:number;active:boolean;pid?:string;slot?:number}|null>(null);
  const itemDragRef=useRef<typeof itemDrag>(null);
  const itemClickSuppressed=useRef(false);
  const [order, setOrder] = useState(Array.from({ length: 9 }, (_, i) => i)),
    [selected, setSelected] = useState<number[]>([]),
    [itemIndex, setItemIndex] = useState<number | null>(null),
    [target, setTarget] = useState(''),
    [ownSlot, setOwnSlot] = useState<number | null>(null),
    [slot, setSlot] = useState<number | null>(null),
    [sacrifice, setSacrifice] = useState<number | null>(null),
    [chat, setChat] = useState(''),
    [tab, setTab] = useState('actions');
  type Drag = {
    from: number;
    to: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
    value: number;
  };
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    setOrder(Array.from({ length: 9 }, (_, i) => i));
    setSelected([]);
    setArrangePicked(null);
    dragRef.current = null;
    setDrag(null);
  }, [s.round, s.phase]);
  useEffect(() => {
    setItemIndex(null);
    setTarget('');
    setOwnSlot(null);
    setSlot(null);
    setSacrifice(null);
    setTab('actions');
    itemDragRef.current=null;setItemDrag(null);
  }, [s.turnSerial, s.turn, s.round]);
  const inspectedItem = itemIndex === null ? null : (me.items?.[itemIndex] ?? null);
  const item = myTurn ? inspectedItem : null;
  const {hover, point} = useCardHover(s, myTurn && !item && !busy && !s.intent);
  const needOwn =
      !!item && ['dud', 'trap'].includes(item),
    needTarget =
      !!item &&
      (item === 'peek' || item === 'oracle' || item === 'nominate'),
    needCard = !!item && item === 'peek';
  const resetItem = () => {
    setItemIndex(null);
    setTarget('');
    setSlot(null);
    setOwnSlot(null);
    setSacrifice(null);
  };
  function selectItem(i: number) {
    setOrder(Array.from({length:9},(_,i)=>i));
    setItemIndex(i);
    setTarget('');
    setSlot(null);
    setOwnSlot(null);
    setSacrifice(null);
  }
  function cardClick(pid: string, position: number) {
    if (suppressClick.current) return;
    if(pid===s.me && ((s.phase==='arrange'&&!me.ready)||(myTurn&&item==='reposition'))) {
      if(arrangePicked===null) setArrangePicked(position);
      else {setOrder(old=>moveInOrder(old,old.indexOf(arrangePicked),old.indexOf(position)));setArrangePicked(null);}
      return;
    }
    if (s.phase === 'arrange') return;
    if (s.phase === 'exchange' && pid === s.me) {
      setSelected((old) =>
        old.includes(position)
          ? old.filter((i) => i !== position)
          : [...old, position],
      );
      return;
    }
    if (!myTurn) return;
    if (item) {
      if (pid === s.me && needOwn) setOwnSlot(ownSlot===position?null:position);
      else if (needCard && (pid !== s.me)) {
        setTarget(pid);
        setSlot(position);
      }
      return;
    }
    if (s.targets.includes(pid))
      void send(s.intent?.target===pid && s.intent.slot===position ? 'cancelSelection' : 'select', { target: pid, slot: position });
  }
  function moveItem(e:React.PointerEvent<HTMLButtonElement>) {
    const d=itemDragRef.current;if(!d)return;
    const hit=document.elementsFromPoint(e.clientX,e.clientY).map(el=>el.closest<HTMLElement>('[data-item-player]')).find(Boolean);
    const key=me.items?.[d.index];const pid=hit?.dataset.itemPlayer;const pos=hit?.dataset.itemSlot;
    const candidate=s.players.find(p=>p.id===pid);
    const valid=key==='dud'||key==='trap' ? pid===s.me&&pos!==undefined : (key==='peek'||key==='oracle')&&pid!==s.me&&candidate&&candidate.status!=='burst'&&(key==='oracle'||pos!==undefined);
    const next={...d,x:e.clientX,y:e.clientY,active:d.active||Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>6,pid:valid?pid:undefined,slot:valid&&pos!==undefined?Number(pos):undefined};
    itemDragRef.current=next;setItemDrag(next);
  }
  function dropItem(e:React.PointerEvent<HTMLButtonElement>) {
    const d=itemDragRef.current;if(!d)return;
    if(d.active) {
      itemClickSuppressed.current=true;
      if(d.pid===s.me&&d.slot!==undefined)setOwnSlot(d.slot);
      else if(d.pid){setTarget(d.pid);setSlot(d.slot??null);}
      setTimeout(()=>{itemClickSuppressed.current=false},0);
    }
    itemDragRef.current=null;setItemDrag(null);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function pointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    from: number,
    value: number,
  ) {
    if (!((s.phase === 'arrange' && !me.ready) || (myTurn && item === 'reposition')) || busy || e.button !== 0) return;
    e.preventDefault();
    suppressClick.current = false;
    const next = {
      from,
      to: from,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      value,
    };
    dragRef.current = next;
    setDrag(next);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    const hit = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((el) => el.closest('[data-own-arrange]'))
      .find(Boolean);
    const to = hit ? Number(hit.getAttribute('data-own-arrange')) : d.to;
    const next = {
      ...d,
      x: e.clientX,
      y: e.clientY,
      to,
      active:
        d.active || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4,
    };
    dragRef.current = next;
    setDrag(next);
  }
  function pointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    if (d.active) {
      setArrangePicked(null);
      suppressClick.current = true;
      setOrder((old) => moveInOrder(old, d.from, d.to));
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    dragRef.current = null;
    setDrag(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function trapDescription(card: {endTurn?: boolean}, peek?: {endTurn?: boolean}) { return card.endTurn || peek?.endTurn ? "このカードを引くとターン終了" : ""; }
  function cards(p: State['players'][number]) {
    const own = p.id === s.me;
    const arranging = own && ((s.phase === 'arrange' && !me.ready) || (myTurn && item === 'reposition'));
    const indices =
      arranging
        ? order
        : Array.from({ length: 9 }, (_, i) => i);
    return (
      <div className={'hand ' + (arranging ? 'arranging' : '') + (effect?.item==='shuffle' && effect.target===p.id ? ' shuffling-hand' : '')}>
        {indices.map((actual, i) => {
          const card = p.hand[actual];
          const peek = me.peeks?.find(
            (x) => x.target === p.id && x.slot === actual,
          );
          const value = card && 'value' in card ? card.value : peek?.value;
          const realSkull = card && 'skull' in card ? card.skull : peek?.skull;
          const angel = card && 'angel' in card ? card.angel : peek?.angel;
          const skull = realSkull;
          const details = (own || peek) && card ? [trapDescription(card, peek), own && card.dud ? '不発弾：引いてもバーストせず、獲得枚数にもなりません' : skull ? 'ドクロ：引くとバースト' : '天使：獲得枚数が増えます'].filter(Boolean).join(' ／ ') : '';
          const trap = card && 'endTurn' in card ? card.endTurn : peek?.endTurn;
          const hovering = !s.intent && hover?.target === p.id && hover.slot === actual;
          const aimed = s.intent?.target === p.id && s.intent.slot === actual;
          const picked =
            (own &&
              ((selected.includes(actual) && s.phase === 'exchange') ||
                (ownSlot === actual && !!item))) ||
            (target === p.id && slot === actual && !!item);
          const usable =
            !!card &&
            !busy &&
            (arranging ||
              (own && s.phase === 'exchange' && !me.ready && !realSkull) ||
              (myTurn &&
                (item
                  ? (own && needOwn) ||
                    (needCard && (p.id !== s.me) && p.status === 'alive')
                  : s.targets.includes(p.id))));
          return (
            <button
              key={actual}
              type="button"
              className={
                'playing-card ' +
                (value !== undefined ? 'front' : 'back') +
                (skull ? ' skull-card' : '') +
                (angel ? ' angel-card' : '') +
                (own&&trap?' trapped-card':'') +
                (!card ? ' empty' : '') +
                (aimed ? ' aimed' : '') +
                (hovering ? ' cursor-hovered' : '') +
                (picked ? ' picked' : '') +
                (arranging && arrangePicked===actual ? ' picked' : '') +
                (usable ? ' actionable-card' : '') +
                (itemDrag?.pid===p.id && itemDrag.slot===actual ? ' item-drop-target' : '') +
                (drag?.active && arranging && drag.to === i
                  ? ' drop-target'
                  : '') +
                (drag?.active && arranging && drag.from === i
                  ? ' dragging'
                  : '')
              }
              title={details || undefined}
              data-effect-tip={details || undefined}
              disabled={!usable && !details}
              aria-disabled={!usable}
              data-own-arrange={arranging ? i : undefined}
              data-item-player={card?p.id:undefined}
              data-item-slot={card?actual:undefined}
              onPointerEnter={() => { setTip(details); if (myTurn && !item && s.targets.includes(p.id)) point(p.id, actual); }}
              onPointerLeave={() => {point();setTip('');}}
              onFocus={() => {setTip(details); if (myTurn && !item && s.targets.includes(p.id)) point(p.id, actual); }}
              onBlur={() => {point();setTip('');}}
              onPointerDown={
                arranging ? (e) => pointerDown(e, i, skull?0:1) : undefined
              }
              onPointerMove={arranging ? pointerMove : undefined}
              onPointerUp={arranging ? pointerUp : undefined}
              onPointerCancel={() => {
                dragRef.current = null;
                setDrag(null);
              }}
              onDragStart={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (
                  arranging &&
                  (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
                ) {
                  e.preventDefault();
                  const to = Math.max(
                    0,
                    Math.min(8, i + (e.key === 'ArrowLeft' ? -1 : 1)),
                  );
                  setOrder((old) => moveInOrder(old, i, to));
                }
              }}
              onClick={() => {setTip(details);if(usable)cardClick(p.id, actual);}}
              aria-label={`${p.name} ${i + 1}番${value !== undefined ? (skull ? ' ドクロ' : ' 天使') : ''}${arranging ? ' ドラッグで移動' : ''}`}
              aria-pressed={!!picked || (arranging && arrangePicked===actual)}
            >
              <span className="card-position">
                {String(i + 1).padStart(2, '0')}
              </span>
              {card ? (
                <>
                  <span className="card-corner">
                    {skull ? '☠' : angel ? '✦' : (value ?? 'CD')}
                    <Feather />
                  </span>
                  <span className="card-center">
                    {value !== undefined ? (
                      <>
                        <Feather />
                        <b>{skull ? <Skull /> : angel ? '✦' : value}</b>
                      </>
                    ) : (
                      <>
                        <Feather />
                        <strong aria-label="カード裏面">✦</strong>
                      </>
                    )}
                  </span>
                  <span className="card-corner opposite">
                    {skull ? '☠' : angel ? '✦' : (value ?? 'CD')}
                    <Feather />
                  </span>
                  {peek && !own && <span className="fake-label">透視</span>}
                  {trap && (
                    <span className="trap-label" title="引いた相手のターンを終了">
                      <OctagonX />
                    </span>
                  )}
                </>
              ) : (
                <span>—</span>
              )}
              {hovering && <span className="hover-dot" aria-label="カーソル位置" />}
              {aimed && <span className="selection-dot" aria-label="選択中" />}
            </button>
          );
        })}
      </div>
    );
  }
  const myIndex = Math.max(0,s.players.findIndex((p) => p.id === s.me));
  const others = Array.from(
    { length: s.players.length - 1 },
    (_, i) => s.players[(myIndex + i + 1) % s.players.length],
  );
  const seatClass = (i: number) =>
    others.length === 1
      ? 'north'
      : others.length === 2
        ? i === 0
          ? 'west'
          : 'east'
        : ['west', 'north', 'east'][i];
  const active = s.players.find((p) => p.id === s.turn);
  const pullTarget = myTurn
    ? s.players.find((p) => p.id === s.targets[0])
    : undefined;
  const selectedName = s.players.find((p) => p.id === s.intent?.target)?.name;
  const rank = [...s.players].sort((a,b)=>b.score-a.score);
  const arrangingNow=!s.spectator&&((s.phase==='arrange'&&!me.ready)||(myTurn&&item==='reposition'));
  const focusPlayer=item&&needTarget ? s.players.find(p=>p.id===target) : myTurn&&pullTarget&&!item ? pullTarget : me;
  const actionTitle=arrangingNow ? '手札を並べて確定' : myTurn ? item ? `${ITEM_INFO[item].name}を使う` : !s.chosenTarget ? '引く相手を選ぶ' : s.intent ? '選んだカードを引く' : 'カードを選ぶ' : s.phase==='play' ? `${active?.name} のターン` : s.phase==='arrange' ? 'みんなの準備を待っています' : s.phase==='roulette' ? '先攻を抽選中' : 'ラウンド結果';
  return (
    <div className="game-workspace intuitive-workspace">
      <div className="landscape-prompt" role="status"><Smartphone/><b>横向きで卓を囲もう</b><span>スマホを横にすると、卓と操作パネルが並びます。</span></div>
      {tip&&<div className="card-effect-tooltip" role="status">{tip}</div>}
      <div className="square-slot">
        <section className="square-table" aria-label="正方形のゲーム卓">
          {s.phase === 'play' && turnBanner && !event && (
            <div className="screen-overlay turn-intro" role="status">
              <p className="eyebrow">NEXT TURN</p>
              <h2>{s.turn === s.me ? 'あなたのターン' : `${turnBanner} のターン`}</h2>
              <p>アイテムを1個追加。次の一手を決めよう。</p>
            </div>
          )}
          {event?.effect && (
            <div className={'effect-banner ' + (['dice','shuffle'].includes(event.effect.item) ? 'dice-effect' : '')} role="status">
              <span className="effect-icon">
                {['dice','shuffle'].includes(event.effect.item) ? <DiceRoll /> : event.effect.item === 'deal' || event.effect.item === 'notice' ? <Gift /> : <ItemIcon item={event.effect.item as Item} />}
              </span>
              <div>
                <b>{event.effect.item === 'notice' ? 'アイテム使用' : event.effect.item === 'deal' ? 'ITEM +1' : ITEM_INFO[event.effect.item as Item].name}</b>
                <p>{event.effect.text}</p>
              </div>
            </div>
          )}
          {event?.draw && (
            <div className={'screen-overlay draw-reveal ' + (event.draw.burst && revealStage ? 'burst-scene' : '')} role="alert">
              <p className="eyebrow">{s.players.find((p) => p.id === event.draw?.by)?.name} が引いたカード</p>
              {event.draw.initialBurstChoice && <><h2 className="initial-burst-title">初手バースト！</h2><p>このままバーストしますか？</p></>}
              {event.draw.counter && <RouletteRoll key={event.id} result={event.draw.counter.face} labels={event.draw.counter.options.map(id => id ? (s.players.find(p => p.id === id)?.name ?? 'プレイヤー') : 'セーフ')} />}
              <div className={`revealed-card${event.draw.angel ? ' angel-reveal' : ''}`} key={revealStage}>
                <Feather />
                <b>{event.draw.skull ? <Skull /> : event.draw.angel ? '✦' : event.draw.value}</b>
              </div>
              {event.draw.initialBurstChoice ? event.draw.by === s.me ? <div className="initial-burst-actions"><button disabled={busy} onClick={() => void send('initialBurstChoice', { choice: 'burst' })}>バーストする<small>0点・ラウンド脱落</small></button><button disabled={busy} onClick={() => void send('initialBurstChoice', { choice: 'continue' })}>−3点で継続する<small>このターン終了・次ターンから再開</small></button></div> : <p>初手バーストの判定を待っています。</p> : event.draw.burst ? <><Flame className="burst-flame" /><h2 className="burst-title">BURST</h2><p className="burst-loss">ラウンド獲得枚数 <b>0</b></p><p>このラウンドから脱落</p></> : event.draw.counter ? <h2>{event.draw.counter.victim ? 'ランダムガード · バースト' : 'ランダムガード · ターン続行'}</h2> : event.draw.dud ? <><h2>不発弾</h2><p>バーストなし・獲得枚数なし</p></> : event.draw.finished ? <><h2>確定上がり！</h2><p>目標枚数に到達しました</p></> : <><h2>{event.draw.substitute ? 'バースト回避 · ターン終了' : event.draw.endedTurn && !event.draw.shield ? '終了トラップ · ターン終了' : event.draw.shield ? 'ドクロガード 発動' : event.draw.blessing ? '天使の加護 発動 · ターン続行' : `+${event.draw.points}枚`}</h2>{event.draw.shield && <p>ドクロを防ぎました。このターンの獲得枚数は半分になります。</p>}{event.draw.blessing && <p>バーストを防ぎ、得点減少なしでターンを続行します。</p>}</>}
            </div>
          )}
          {celebrating && <div className="round-victory" key={s.round} role="status">
            <span className="victory-crown">♛</span>
            <small>ROUND {s.round} · {result?.draw ? 'DRAW' : winnerIds.length > 1 ? 'WINNERS' : 'WINNER'}</small>
            <strong>{winnerIds.map(id => s.players.find(p => p.id === id)?.name).join(' ＆ ')}</strong>
            <span>{result?.draw ? 'Draw：勝利数は増えません' : result?.winner ? 'ラウンド勝利！' : 'ラウンド最多枚数！'}</span>
          </div>}
          <div className="table-rail" />
          {others.map((p, i) => (
            <section
              className={
                'table-seat ' +
                seatClass(i) +
                (myTurn && s.targets.includes(p.id) ? ' draw-source' : '') +
                (s.turn === p.id && s.phase === 'play' ? ' current-seat' : '')
                + (myTurn && ((!item&&!s.chosenTarget&&s.nominees.includes(p.id)) || (needTarget&&p.status!=='burst')) ? ' selectable-seat' : '')
                + (itemDrag?.pid===p.id ? ' item-drop-target' : '')
              }
              key={p.id}
              data-item-player={p.id}
            >
              <div className="seat-plaque">
                <b>{p.name}</b>
                <span className="seat-card-count">
                  残り {p.hand.filter(Boolean).length}枚{' '}
                  {''}
                </span>
                <small>
                  {`${p.score} / ${s.players.length === 2 ? 7 : s.players.length === 3 ? 9 : 11}枚`} · {p.points}勝{' '}
                  {p.status === 'burst'
                    ? 'BURST'
                    : p.status === 'safe'
                      ? '安全確定'
                      : p.bot
                        ? 'AI'
                        : !p.online
                          ? 'AI代行'
                          : ''}
                </small>
              </div>
              {myTurn && !item && !s.chosenTarget && s.nominees.includes(p.id) && <button className="seat-pick" disabled={busy} onClick={()=>void send('nominate',{target:p.id})}>この人から引く</button>}
              {myTurn && item==='oracle' && p.status!=='burst' && <button className="seat-pick" onClick={()=>setTarget(p.id)}>{target===p.id?'選択中':'この人を調べる'}</button>}
              {myTurn && s.targets.includes(p.id) && (
                <span className="source-tag">ここから引く</span>
              )}
              {cards(p)}
            </section>
          ))}
          <div className="table-center">
            <Feather className="table-feather" />
            <h1>
              CHICKEN
              <br />
              <em>DRAW</em>
            </h1>
            <span className="round-chip">ROUND {s.round} / {s.totalRounds}</span>
            {s.phase === 'play' ? (
              <>
                <p className="active-label">
                  {myTurn ? 'あなたのターン' : `${active?.name} のターン`}
                </p>
                <b className={'countdown ' + (seconds < 20 ? 'danger' : '')}>
                  {Math.floor(seconds / 60)}:
                  {String(seconds % 60).padStart(2, '0')}
                </b>
                {s.intent && (
                  <p className="intent-line">
                    {active?.name} → {selectedName}
                    <br />
                    {s.intent.slot + 1}番を選択中
                  </p>
                )}
              </>
            ) : (
              <p className="active-label">
                {s.phase === 'exchange'
                  ? '手札交換'
                  : s.phase === 'arrange'
                    ? 'カード配置'
                    : s.phase === 'roulette'
                      ? '先攻を抽選中'
                      : s.phase === 'final'
                        ? 'FINAL RESULTS'
                        : 'ROUND RESULTS'}
              </p>
            )}
          </div>
          <section
            className={'table-seat south ' + (myTurn ? 'current-seat' : '')}
          >
            <div className="seat-plaque self-plaque">
              <b>
                {me.name} <small>{s.spectator ? '観戦中' : 'YOU'}</small>
              </b>
              <span>
                {me.score}枚 · {me.points}勝
              </span>
              <span className="skull-reminder">
                <Skull />
                ドクロを引かせよう
              </span>
            </div>
            {cards(me)}
            {!s.spectator && s.phase === 'arrange' && !me.ready && (
              <span className="drag-tip">
                <GripVertical />
                ドラッグで移動 · 2枚をタップでも移動
              </span>
            )}
            {me.status !== 'alive' && (
              <span className="out-status">
                {me.status === 'burst'
                  ? 'BURST · ラウンド獲得枚数 0'
                  : '安全確定 · 獲得枚数を保持'}
              </span>
            )}
          </section>
        </section>
      </div>
      <aside className="game-dock">
        <div className="turn-status"><div><small>ROUND {s.round} / {s.totalRounds}{turnLabel && ` · ${turnLabel}`}</small><b>{actionTitle}</b></div><strong className={seconds<20?'danger':''}>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong></div>
        <div className="live-scores" aria-label="現在の獲得枚数">{s.players.map(p=><div key={p.id} className={s.turn===p.id?'active':''}><span>{p.name}</span><b>{p.score}<small>枚</small></b><small>{p.status==='burst'?'BURST':p.status==='safe'?'確定':`${p.points}勝`}</small></div>)}</div>
        <section className="persistent-inventory" aria-label="自分のアイテム">
          <div className="inventory-heading"><b>アイテム · {me.items?.length??0}</b><small>{myTurn?'タップで選択 · 対象へドラッグも可能':'タップで効果を確認'}</small></div>
          <div className="inventory">{me.items?.map((key,i)=><button key={i} className={'item-tile '+(itemIndex===i?'selected':'')} aria-pressed={itemIndex===i} title={ITEM_INFO[key].description}
            onPointerDown={e=>{if(!myTurn||busy||e.button!==0)return;selectItem(i);setTab('actions');const d={index:i,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,active:false};itemDragRef.current=d;setItemDrag(d);e.currentTarget.setPointerCapture(e.pointerId);}}
            onPointerMove={moveItem} onPointerUp={dropItem} onPointerCancel={()=>{itemDragRef.current=null;setItemDrag(null);}}
            onClick={()=>{if(itemClickSuppressed.current)return;selectItem(i);setTab('actions')}}><ItemIcon item={key}/><span>{ITEM_INFO[key].name}</span></button>)}</div>
          {!me.items?.length&&<p className="muted">アイテムなし</p>}
          {inspectedItem&&!(myTurn)&&<p className="inventory-description"><b>{ITEM_INFO[inspectedItem].name}</b>：{ITEM_INFO[inspectedItem].description}</p>}
        </section>
        <Tabs value={tab} onValueChange={setTab} className="dock-tabs">
          <TabsList className="dock-tab-list">
            <TabsTrigger value="actions">操作</TabsTrigger>
            <TabsTrigger value="talk">会話</TabsTrigger>
            <TabsTrigger value="log">履歴</TabsTrigger>
          </TabsList>
          <TabsContent value="actions" className="dock-content">
            {focusPlayer && (arrangingNow || (myTurn&&(s.chosenTarget||needOwn||needCard))) && <div className="focus-hand"><div><b>{focusPlayer.id===s.me?'自分':focusPlayer.name}の手札</b><small>{arrangingNow ? 'ドラッグ / 2枚をタップ' : needOwn||needCard ? '効果を付けるカードを選択' : '1枚を選択 → 引く'}</small></div>{cards(focusPlayer)}</div>}
            <div className="dock-heading">
              <p className="eyebrow">
                {s.phase === 'play'
                  ? myTurn
                    ? 'YOUR TURN'
                    : 'WAITING'
                  : 'PREPARATION'}
              </p>
              <h2>
                {s.phase === 'play'
                  ? myTurn
                    ? item
                      ? 'アイテムを使う'
                      : 'カードを引く'
                    : `${active?.name} のターン`
                  : s.phase === 'exchange'
                    ? '手札を整える'
                    : s.phase === 'arrange'
                      ? '罠を配置しよう'
                      : s.phase === 'roulette'
                        ? '先攻ルーレット'
                        : '結果'}
              </h2>
            </div>
            {!s.spectator && (s.phase === 'exchange' || s.phase === 'arrange') && (
              <>
                <p className="muted">
                  {s.phase === 'exchange'
                    ? '数字カードだけ交換できます。ドクロは交換できません。'
                    : '手元のカードをつかんで移動先へ。配置は確定するまで相手には分かりません。'}
                </p>
                <p>残り {seconds}秒</p>
                {me.ready ? (
                  <p className="ready-note">
                    <Check />
                    確定しました。全員の準備を待っています。
                  </p>
                ) : s.phase === 'exchange' ? (
                  <div className="action-stack">
                    <button
                      className="secondary"
                      onClick={() =>
                        setSelected(
                          me.hand
                            .map((c, i) =>
                              c && 'skull' in c && c.skull ? -1 : i,
                            )
                            .filter((i) => i >= 0),
                        )
                      }
                    >
                      交換できるカードを選択
                    </button>
                    <button
                      disabled={busy || !selected.length || me.redraws >= 2}
                      onClick={async () => {
                        if (await send('exchange', { slots: selected }))
                          setSelected([]);
                      }}
                    >
                      {selected.length}枚を交換（{me.redraws}/2）
                    </button>
                    <button disabled={busy} onClick={() => void send('ready')}>
                      交換を終了 <ArrowRight />
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={busy || !!drag}
                    onClick={() => void send('ready', { order })}
                  >
                    この配置で確定 <Check />
                  </button>
                )}
              </>
            )}
            {s.phase === 'roulette' && <div className="roulette-stage"><span className="wheel-pointer">▼</span><div className="roulette-wheel" style={{'--stop': `${-s.players.findIndex(p=>p.id===s.turn)*360/s.players.length-180/s.players.length}deg`, background:`conic-gradient(${s.players.map((p,i)=>`${['#bf924f','#476f65','#a65e60','#526c9b'][i]} ${i*360/s.players.length}deg ${(i+1)*360/s.players.length}deg`).join(',')})`} as React.CSSProperties}>{s.players.map((p,i)=><span key={p.id} style={{transform:`translate(-50%,-50%) rotate(${i*360/s.players.length+180/s.players.length}deg) translateY(-65px) rotate(-${i*360/s.players.length+180/s.players.length}deg)`}}>{p.name}</span>)}</div><b>先攻を抽選中</b></div>}
            {(s.phase === 'result' || s.phase === 'final') && (
              <div className="scoreboard">
                {rank.map((p, i) => (
                  <div key={p.id}>
                    <b>
                      {rank.findIndex(
                        (q) =>
                          q.score === p.score,
                      ) + 1}
                      . {p.name}
                    </b>
                    <span>{p.score} / {s.players.length === 2 ? 7 : s.players.length === 3 ? 11 : 15}枚</span>
                    <small>
                      {p.draws}枚 / 累計 {p.draws}枚
                    </small>
                  </div>
                ))}
                {s.host === s.me ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void send(s.phase === 'final' ? 'lobby' : 'next')
                    }
                  >
                    {s.phase === 'final' ? 'ロビーに戻る' : '次のラウンドへ'}
                  </button>
                ) : (
                  <p>ホストの操作を待っています。</p>
                )}
              </div>
            )}
            {s.phase === 'play' && (
              <>
                {myTurn ? (
                  <>
                    {!s.chosenTarget && !item && <div className="nomination-panel"><h3>誰の手札から引く？</h3><p>このターンの相手を選択</p><div className="player-choices">{s.players.filter(p=>s.nominees.includes(p.id)).map(p=><button disabled={busy} key={p.id} onClick={()=>void send('nominate',{target:p.id})}><b>{p.name}</b><small>残り{p.hand.filter(Boolean).length}枚</small><ArrowRight/></button>)}</div></div>}
                    <div className="target-summary">
                      <MousePointer2 />
                      <span>
                        ドロー先：
                        <b>{pullTarget?.name ?? '指名待ち'}</b>
                      </span>
                    </div>
                    {item ? (
                      <>
                        <p className="muted">
                          アイテムは自分のターン中、カードを引いた後も使えます。
                        </p>
                        {item && (
                          <div className="item-editor">
                            <div className="item-title">
                              <ItemIcon item={item} />
                              <b>{ITEM_INFO[item].name}</b>
                              <button
                                className="quiet"
                                aria-label="アイテム選択を閉じる"
                                onClick={resetItem}
                              >
                                <X />
                              </button>
                            </div>
                            <p>{ITEM_INFO[item].description}</p>
                            {item === 'reposition' && <p role="status">自分のカードをドラッグして並べ替え、「配置を確定」で完了。動かさず確定しても構いません。</p>}
                            {needOwn && (
                              <button
                                className="pick-step"
                                onClick={() => setOwnSlot(null)}
                              >
                                {ownSlot === null
                                  ? '① 効果を付ける自分のカードを押す'
                                  : `① 自分の ${ownSlot + 1}番を選択済み`}
                              </button>
                            )}
                            {needTarget && (
                              <>
                                <p className="muted">
                                  {needOwn ? '②' : '①'}{' '}
                                  {needCard
                                    ? '相手のカードをタップして選択'
                                    : '相手を選択'}
                                </p>
                                <div className="player-choices">
                                  {s.players
                                    .filter(
                                      (p) =>
                                        (p.id !== s.me) &&
                                        p.hand.some(Boolean) && p.status === 'alive',
                                    )
                                    .map((p) => (
                                      <button
                                        key={p.id}
                                        className={
                                          target === p.id
                                            ? 'chosen'
                                            : 'secondary'
                                        }
                                        onClick={() => {
                                          setTarget(p.id);
                                          setSlot(null);
                                        }}
                                      >
                                        {p.name}
                                      </button>
                                    ))}
                                </div>
                                {needCard && (
                                  <p>
                                    {slot === null
                                      ? '対象カード：未選択'
                                      : `${s.players.find((p) => p.id === target)?.name} の ${slot + 1}番`}
                                  </p>
                                )}
                              </>
                            )}
                            {item === 'recycle' && (
                              <>
                                <p>犠牲にするアイテムを選択</p>
                                <div className="player-choices">
                                  {me.items?.map((k, i) =>
                                    i === itemIndex ? null : (
                                      <button
                                        key={i}
                                        className={
                                          sacrifice === i
                                            ? 'chosen'
                                            : 'secondary'
                                        }
                                        onClick={() => setSacrifice(i)}
                                      >
                                        <ItemIcon item={k} />
                                        {ITEM_INFO[k].name}
                                      </button>
                                    ),
                                  )}
                                </div>
                                {me.items?.length === 1 && (
                                  <p>ほかのアイテムが必要です。</p>
                                )}
                              </>
                            )}
                            <button
                              disabled={
                                busy ||
                                (item === 'double' && s.drawnThisTurn > 0) ||
                                (needOwn && ownSlot === null) ||
                                (needTarget && !target) ||
                                (needCard && slot === null) ||
                                (item === 'recycle' && sacrifice === null)
                              }
                              onClick={async () => {
                                if (
                                  await send('item', {
                                    item: itemIndex,
                                    target,
                                    slot,
                                    ownSlot,
                                    sacrifice,
                                    ...(item === 'reposition' ? {order} : {}),
                                    
                                  })
                                )
                                  resetItem();
                              }}
                            >
                              {item === 'reposition' ? '配置を確定' : '使用する'} <Check />
                            </button>
                          </div>
                        )}
                        <button
                          className="proceed"
                          disabled={busy}
                          onClick={() => {
                            resetItem();

                          }}
                        >
                          カード選択に戻る <ArrowRight />
                        </button>
                      </>
                    ) : (
                      <>
                        {s.intent ? (
                          <div className="draw-decision">
                            <p>
                              {selectedName} の <b>{s.intent.slot + 1}番</b>
                            </p>
                            <button
                              className="draw-button"
                              disabled={busy}
                              onClick={() =>
                                void send('draw', {
                                  target: s.intent!.target,
                                  slot: s.intent!.slot,
                                })
                              }
                            >
                              <Feather />
                              このカードを引く
                            </button>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => void send('cancelSelection')}
                            >
                              選択を解除
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="turn-progress">このターン <b>{s.drawnThisTurn}枚</b> 引きました <span>{s.drawnThisTurn===0?'まず1枚引こう':'続けるか、ここで終了'}</span></p>
                            <button
                              className="secondary stop-button"
                              disabled={busy || (s.drawnThisTurn < 1 && s.nominees.length > 0)}
                              onClick={() => void send('stop')}
                            >
                              {s.drawnThisTurn<1?'1枚引くとターン終了できます':'ここでターンを終了'}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="waiting">
                    <Feather />
                    <p>相手がどのカードを狙うか、注目しよう。</p>
                    <p className="muted">
                      {me.items?.length}個のアイテムを所持
                      <br />
                      自分の番になると使用できます。
                    </p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="talk" className="dock-content talk-panel">
            <h2>TABLE TALK</h2>
            <div className="messages" aria-live="polite">
              {s.chat.length ? (
                s.chat.map((m, i) => (
                  <div key={i}>
                    <b>{m.name}</b>
                    <p>{m.text}</p>
                  </div>
                ))
              ) : (
                <p className="muted">会話も戦略。ブラフを仕掛けよう。</p>
              )}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await send('chat', { text: chat })) setChat('');
              }}
            >
              <input
                aria-label="チャット"
                maxLength={240}
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                placeholder="メッセージを書く"
              />
              <button disabled={busy || !chat.trim()}>送信</button>
            </form>
          </TabsContent>
          <TabsContent value="log" className="dock-content">
            <h2>TABLE LOG</h2>
            {[...s.events].reverse().map((e) => (
              <p className="log-entry" key={e.id}>
                {e.text}
                {e.draw && (
                  <b>
                    {e.draw.burst
                      ? ' BURST'
                      : e.draw.shield
                        ? ' NG無効'
                        : ` +${e.draw.points}枚`}
                  </b>
                )}
              </p>
            ))}
          </TabsContent>
        </Tabs>
      </aside>
      {itemDrag?.active && createPortal(<div className={'item-drag-ghost '+(itemDrag.pid?'valid':'')} style={{left:itemDrag.x,top:itemDrag.y}}><ItemIcon item={me.items![itemDrag.index]}/><b>{ITEM_INFO[me.items![itemDrag.index]].name}</b><small>{itemDrag.pid?'離して対象を選択':'対象のカード・プレイヤーへ'}</small></div>,document.body)}
      {drag?.active &&
        createPortal(
          <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
            <Feather />
            <b>{drag.value === 0 ? <Skull /> : '✦'}</b>
          </div>,
          document.body,
        )}
    </div>
  );
}
