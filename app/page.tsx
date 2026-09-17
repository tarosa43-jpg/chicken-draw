'use client';
import { playSound, unlockSound, setSoundVolume } from '@/lib/sound';
import { Skull } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Feather,
  Check,
  ArrowRight,
  RotateCcw,
  X,
  BookOpen,
  Link as LinkIcon,
  LogOut,
} from 'lucide-react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import GameTable from '@/components/game-table';
import { ITEM_INFO } from '@/lib/item-info';
import type { view, Event } from '@/lib/game';
type State = ReturnType<typeof view>;
type ApiState = State & { error?: string; left?: boolean; join?: boolean };
export default function Home() {
  const [s, setS] = useState<State | null>(null),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [active, setActive] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(true),
    [clock, setClock] = useState(Date.now()),
    [close, setClose] = useState(false),
    [leaveOpen, setLeaveOpen] = useState(false),
    [ngIntro, setNgIntro] = useState(false),
    [turnBanner, setTurnBanner] = useState(''),
    [queue, setQueue] = useState<Event[]>([]),
    [revealStage, setRevealStage] = useState(0);
  const [soundVolume, setVolume] = useState(45);
  useEffect(() => {
    const saved = Number(localStorage.getItem('cd-volume') ?? (localStorage.getItem('cd-sound') === 'off' ? '0' : '45'));
    const level = Number.isFinite(saved) ? Math.max(0, Math.min(100, saved)) : 45;
    setVolume(level); setSoundVolume(level / 100);
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const element = (event.target as Element).closest('button:not(:disabled),[role="tab"],input[type="range"]');
      if (!element || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return;
      playSound(element.classList.contains('playing-card') ? 'cardHover' : 'hover');
    };
    const click = (event: MouseEvent) => { if ((event.target as Element).closest('button:not(:disabled),[role="tab"]')) playSound('click'); };
    document.addEventListener('pointerdown', unlockSound);
    document.addEventListener('keydown', unlockSound);
    document.addEventListener('pointerover', over);
    document.addEventListener('click', click);
    return () => { document.removeEventListener('pointerdown', unlockSound); document.removeEventListener('keydown', unlockSound); document.removeEventListener('pointerover', over); document.removeEventListener('click', click); };
  }, []);
  const announcedTurn=useRef('');
  const current = useRef<State | null>(null),
    inflight = useRef(false),
    offset = useRef(0),
    seenEvents = useRef(new Set<string>());
  current.current = s;
  const accept = useCallback((data: State) => {
    offset.current = data.serverTime - Date.now();
    setS((old) =>
      old && old.code === data.code && old.revision > data.revision
        ? old
        : data,
    );
    setConnected(true);
  }, []);
  useEffect(() => {
    const invite = new URLSearchParams(location.search).get('room');
    const saved = localStorage.getItem('ng-room');
    const c = invite || saved;
    if (c && /^\d{6}$/.test(c)) {
      setCode(c);
      setActive(c);
    }
    setName(localStorage.getItem('ng-name') || '');
    fetch('/api/game', { cache: 'no-store' }).catch(() => setConnected(false));
    const timer = setInterval(() => setClock(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!active) return;
    let stopped = false,
      running = false;
    async function poll() {
      if (running) return;
      running = true;
      try {
        const response = await fetch('/api/game?code=' + active, {
          cache: 'no-store',
        });
        const data = (await response.json()) as ApiState;
        if (stopped) return;
        if (response.ok) accept(data);
        else if (data.join || response.status === 404) {
          setS(null);
          setActive('');
          if (!data.join) setError(data.error || 'ルームが見つかりません');
        } else setConnected(false);
      } catch {
        if (!stopped) setConnected(false);
      } finally {
        running = false;
      }
    }
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, accept]);
  const send = useCallback(
    async (type: string, extra: Record<string, unknown> = {}) => {
      if (inflight.current) return null;
      inflight.current = true;
      setBusy(true);
      setError('');
      try {
        const live = current.current;
        const response = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            code: live?.code || code,
            name,
            revision: live?.revision,
            requestId: crypto.randomUUID(),
            ...extra,
          }),
        });
        const data = (await response.json()) as ApiState;
        if (!response.ok) throw Error(data.error || '操作できませんでした');
        if (data.left) {
          setS(null);
          setActive('');
          localStorage.removeItem('ng-room');
          history.replaceState(null, '', location.pathname);
          return data;
        }
        accept(data);
        setActive(data.code);
        setCode(data.code);
        localStorage.setItem('ng-room', data.code);
        localStorage.setItem('ng-name', name);
        history.replaceState(null, '', '?room=' + data.code);
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : '接続に失敗しました');
        return null;
      } finally {
        inflight.current = false;
        setBusy(false);
      }
    },
    [code, name, accept],
  );
  useEffect(() => {
    if (!s?.round || s.phase === 'lobby' || s.spectator) return;
    setNgIntro(true);
    const timer = setTimeout(() => setNgIntro(false), 4500);
    return () => clearTimeout(timer);
  }, [s?.code, s?.round]);
  useEffect(() => {
    if(s?.phase!=='play'){setTurnBanner('');return;}
    if(queue.length||ngIntro)return;
    const key=`${s.code}:${s.round}:${s.turnSerial}:${s.turn}`;
    if(announcedTurn.current===key)return;
    announcedTurn.current=key;playSound('turn');
    setTurnBanner(s.players.find(p=>p.id===s.turn)?.name||'');
  },[s?.phase,s?.turnSerial,s?.turn,queue.length,ngIntro]);
  useEffect(()=>{if(!turnBanner)return;const timer=setTimeout(()=>setTurnBanner(''),2500);return()=>clearTimeout(timer);},[turnBanner]);
  useEffect(() => {
    if (!s) return;
    const added: Event[] = [];
    for (const e of s.events) {
      if (seenEvents.current.has(e.id)) continue;
      seenEvents.current.add(e.id);
      if ((e.draw || e.effect) && Date.now() + offset.current - e.time < 7000)
        added.push(e);
    }
    if (added.length) setQueue((old) => [...old, ...added]);
  }, [s?.code, s?.events.at(-1)?.id]);
  const shown = queue[0]
    ? s?.events.find((event) => event.id === queue[0].id) ?? queue[0]
    : undefined;
  const resultAck=useRef('');
  useEffect(()=>{
    if(s?.phase!=='final'||queue.length||ngIntro)return;
    const key=`${s.code}:${s.round}:${s.results.length}:${s.events.at(-1)?.id}`;
    if(resultAck.current===key)return;
    resultAck.current=key;void send('resultsSeen');
  },[s?.phase,s?.round,queue.length,ngIntro,send]);
  useEffect(() => {
    if (!shown || ngIntro) return;
    if (shown.draw?.initialBurstChoice) return;
    setRevealStage(0);
    if (shown.effect) playSound('item');
    else playSound('draw');
    const flip = setTimeout(() => { setRevealStage(1); if (shown.draw?.burst || shown.draw?.counter?.victim) playSound('burst'); }, shown.draw?.counter ? 2500 : 1000);
    const timer = setTimeout(
      () => setQueue((old) => old.slice(1)),
      shown.draw
        ? shown.draw.counter ? 5200 : shown.draw.burst
          ? 4700
          : 2600
        : shown.effect?.item === 'deal'
          ? 1300
          : 3000,
    );
    return () => {
      clearTimeout(flip);
      clearTimeout(timer);
    };
  }, [shown?.id, shown?.draw?.initialBurstChoice, ngIntro]);
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: { registerTool: (t: unknown, o: unknown) => unknown };
      }
    ).modelContext;
    if (!ctx?.registerTool) return;
    const lifetime = new AbortController();
    for (const tool of [
      {
        name: 'read_chicken_draw_table',
        description:
          'Read only the current player-visible state of CHICKEN DRAW.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => current.current,
      },
      {
        name: 'end_chicken_draw_turn',
        description: 'End your turn. Not available while a card is selected.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input: unknown) => {
          if (
            !input ||
            typeof input !== 'object' ||
            Object.keys(input).length ||
            current.current?.intent ||
            current.current?.turn !== current.current?.me
          )
            throw Error('Cannot end turn');
          const result = await send('stop');
          if (!result) throw Error('Could not end turn');
          return { turn: result.turn };
        },
      },
    ]) {
      try {
        void Promise.resolve(
          ctx.registerTool(tool, { signal: lifetime.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifetime.abort();
  }, [send]);
  const seconds = s?.deadline
    ? Math.max(0, Math.ceil((s.deadline - clock - offset.current) / 1000))
    : 0;
  const game = !!s && !['lobby', 'closed'].includes(s.phase);
  async function invite() {
    try {
      await navigator.clipboard.writeText(
        location.origin + '/?room=' + s!.code,
      );
      setError('招待URLをコピーしました');
    } catch {
      setError('アドレス欄のURLをコピーしてください');
    }
  }
  function leaveLocal() {
    setS(null);
    setActive('');
    localStorage.removeItem('ng-room');
    history.replaceState(null, '', location.pathname);
  }
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <Feather />
          <b>
            CHICKEN <span>DRAW</span>
          </b>
        </div>
        <div className="header-meta">
          <label className="sound-volume">SE <input aria-label="効果音の音量" type="range" min="0" max="100" value={soundVolume} onChange={e => { const value = Number(e.target.value); setVolume(value); setSoundVolume(value / 100); localStorage.setItem('cd-volume', String(value)); }} onPointerUp={() => playSound('item')} /><output>{soundVolume}%</output></label>
          {s && (
            <>
              <span className="room-code">ROOM {s.code}</span>
              <span className={connected ? 'online' : 'danger'}>
                {connected ? '● ONLINE' : '● 再接続中'}
              </span>
            </>
          )}
          <Dialog>
            <DialogTrigger className="quiet rules-button" aria-label="遊び方">
              <BookOpen /> ルール
            </DialogTrigger>
            <DialogContent className="rules-modal">
              <DialogTitle>CHICKEN DRAW · 遊び方</DialogTitle>
              <p>
                手札は天使カードとドクロカード。自分のドクロは見え、自由に配置できます。ドクロを引くとバーストします。引いた枚数が多い人が勝利し、人数に応じた目標枚数で確定上がりです。
              </p>
              <p>
                1ラウンドは1人2ターン。手番の最初に相手を指名し、そのターンはその人から必ず1枚以上引きます。1枚も引かずに時間切れになると自動で1枚引いてターン終了。得点倍化はそのターンの最初の1枚だけを倍にします。
              </p>
              <p>
                初期アイテムは全ラウンド2個、毎ターン1個追加。ドクロガードは使用したターンだけ有効で、ドクロを防いでもそのターンは終了します。終了トラップは引いた人のターンを終了します。
              </p>
              <p>
                天使の獲得枚数を競います。2人対戦は7枚、3人対戦は11枚、4人対戦は15枚に到達するとラウンド勝利。得点倍化はそのターンの最初の1枚だけを倍にします。1または3ラウンドを選択できます。3ラウンドでは2勝先取で試合終了。同枚数はDrawで勝利数は増えません。最終順位は勝利数、累計ドロー枚数の順で決め、それも同じなら同順位です。
              </p>
              <p>
                ラウンドで最初に引いた1枚がドクロだった場合は、通常どおり0点で脱落するか、−3点でラウンドを継続するかを選べます。継続を選ぶとそのターンは終了し、次のターンから通常どおりプレイします。
              </p>
              <div className="rule-items">
                {Object.entries(ITEM_INFO).map(([key, info]) => (
                  <p key={key}>
                    <b>{info.name}</b>：{info.description}
                  </p>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          {s && s.phase !== 'closed' && (
            <>
              <button
                className="quiet icon-button"
                onClick={() => void invite()}
                aria-label="招待URLをコピー"
              >
                <LinkIcon />
              </button>
              {s.host === s.me && (
                <AlertDialog open={close} onOpenChange={setClose}>
                  <AlertDialogTrigger
                    className="quiet icon-button"
                    aria-label="ルームを閉じる"
                  >
                    <X />
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rules-modal">
                    <AlertDialogTitle>ルームを終了しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      全員の対戦が終了します。
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel>戻る</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          setClose(false);
                          void send('close');
                        }}
                      >
                        終了する
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {game && (
                <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                  <AlertDialogTrigger
                    className="quiet leave-game-button"
                    aria-label="試合から退出"
                  >
                    <LogOut /> <span>退出</span>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rules-modal">
                    <AlertDialogTitle>試合から退出しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      退出すると、この試合ではAIがあなたの代わりに操作します。
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel>戻る</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          setLeaveOpen(false);
                          await send('leave');
                          leaveLocal();
                        }}
                      >
                        退出する
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      </header>
      {error && (
        <div role="status" className="notice">
          {error}
          <button
            className="quiet"
            onClick={() => setError('')}
            aria-label="通知を閉じる"
          >
            <X />
          </button>
        </div>
      )}
      {!s ? (
        <section className="welcome">
          <div className="welcome-copy">
            <p className="eyebrow">BLUFF. DRAW. SURVIVE.</p>
            <h1>
              もう一枚。
              <br />
              <span>
                その勇気が、
                <br />
                罠になる。
              </span>
            </h1>
            <p>ドクロを隠して、相手の一手を誘い出せ。</p>
            <small>2–4 PLAYERS / 1–3 ROUNDS</small>
          </div>
          <section className="entry-panel">
            <h2>テーブルに参加</h2>
            <label>
              プレイヤー名
              <input
                value={name}
                maxLength={16}
                onChange={(e) => setName(e.target.value)}
                placeholder="あなたの名前"
              />
            </label>
            <button
              disabled={busy || !name.trim()}
              onClick={() => void send('create')}
            >
              ルームを作成 <ArrowRight />
            </button>
            <div className="divider">招待を受けた方</div>
            <label htmlFor="party-code">6桁のパーティコード</label>
            <InputOTP
              id="party-code"
              maxLength={6}
              pattern="[0-9]*"
              value={code}
              onChange={setCode}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot index={i} key={i} className="otp-slot" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <button
              className="secondary"
              disabled={busy || !name.trim() || code.length !== 6}
              onClick={() => void send('join')}
            >
              コードで参加
            </button>
          </section>
        </section>
      ) : s.phase === 'closed' ? (
        <section className="closed-panel">
          <h1>ルームが終了しました</h1>
          <button onClick={leaveLocal}>トップへ戻る</button>
        </section>
      ) : s.phase === 'lobby' ? (
        <section className="lobby">
          <div>
            <p className="eyebrow">PARTY CODE</p>
            <h1 className="party-code">{s.code}</h1>
            <p>全{s.totalRounds}ラウンド。コードか招待URLを友達に送ってください。</p>
            <button className="secondary" onClick={() => void invite()}>
              招待URLをコピー <LinkIcon />
            </button>
          </div>
          <div className="lobby-seats">
            {s.spectators.length>0&&<p className="spectator-list">観戦・参加待ち：{s.spectators.map(p=>p.name).join('、')}（対戦は最大4人）</p>}
            {[0, 1, 2, 3].map((i) => (
              <div className="lobby-seat" key={i}>
                <span className="seat-number">0{i + 1}</span>
                <b>{s.players[i]?.name || '参加を待っています'}</b>
                <small>
                  {s.players[i]?.id === s.host
                    ? 'HOST'
                    : s.players[i]?.bot
                      ? 'AI'
                      : ''}
                </small>
                {s.host === s.me && s.players[i] && s.players[i].id !== s.me && (
                  <button
                    className="lobby-kick"
                    disabled={busy}
                    onClick={() => void send('kick', { target: s.players[i]!.id })}
                    title={`${s.players[i]!.name}をキック`}
                  >
                    キック
                  </button>
                )}
              </div>
            ))}
            {s.host === s.me ? (
              <div className="lobby-actions">
                <label>ラウンド数
                  <select value={s.totalRounds} disabled={busy} onChange={e => void send('settings', {value: Number(e.target.value)})}>
                    {[1,3].map(n => <option key={n} value={n}>{n}ラウンド</option>)}
                  </select>
                </label>
                <button
                  disabled={busy || s.players.length < 2}
                  onClick={() => void send('start')}
                >
                  ゲーム開始 <ArrowRight />
                </button>
                <button
                  className="secondary"
                  disabled={busy || s.players.length >= 4}
                  onClick={() => void send('bot')}
                >
                  AIを追加
                </button>
              </div>
            ) : (
              <p>ホストの開始を待っています。</p>
            )}
            <button className="quiet" onClick={() => void send('leave')}>
              退出する
            </button>
          </div>
        </section>
      ) : (
        <GameTable
          s={s}
          effect={shown?.effect}
          event={shown}
          revealStage={revealStage}
          turnBanner={turnBanner}
          resultReady={!ngIntro && queue.length === 0}
          seconds={seconds}
          busy={busy || (!!shown?.draw && !shown.draw.initialBurstChoice)}
          send={send}
        />
      )}
      {s?.phase==='final' && !shown && !ngIntro && <section className="match-results" role="dialog" aria-label="試合結果">
        <p className="eyebrow">CHICKEN DRAW</p><h1>MATCH RESULTS</h1>
        <div className="final-ranking">{[...s.players].sort((a,b)=>b.points-a.points||b.draws-a.draws).map((p,i,all)=><div key={p.id}><b>{all.findIndex(q=>q.points===p.points&&q.draws===p.draws)+1}</b><strong>{p.name}</strong><span>{p.points} PT</span><small>{p.draws}枚 · 獲得{p.earned}枚</small></div>)}</div>
        <p>まもなくロビーに戻ります。観戦者は空席・AI席から次の試合に参加できます。</p>
        {s.host===s.me&&<button onClick={()=>void send('lobby')}>ロビーに戻る</button>}
      </section>}
      <footer>
        <span>BLUFF. DRAW. SURVIVE.</span>
        <span>
          {game
            ? '相手の心理を読んで天使を引こう。'
            : '最後まで、チキンになるな。'}
        </span>
      </footer>
      {ngIntro && s && (
        <div className="screen-overlay ng-intro" role="status">
          <p className="eyebrow">ROUND {s.round} · SKULL DRAW</p>
          <h2>ドクロを相手に引かせよう</h2>
          <div className="skull-intro-card">
            <Skull />
            <b>SKULL</b>
          </div>
          <p>自分の手札にドクロが2枚。位置を動かして罠を仕掛けよう。</p>
          <p>ドクロは配り直しできません。</p>
          <button onClick={() => setNgIntro(false)}>
            確認した <Check />
          </button>
        </div>
      )}
    </main>
  );
}
