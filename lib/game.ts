// Authoritative game rules. This module is imported by server routes and tests only.
export const ITEMS = [
  'dud',
  'counter',
  'reposition',
  'peek',
  'shield',
  'double',
  'recycle',
  'trap',
  'oracle',
  'substitute',
  'nominate',
  'blessing',
] as const;
export type Item = (typeof ITEMS)[number];
export type Card = {
  value: number;
  skull?: boolean;
  angel?: boolean;
  endTurn?: boolean;
  dud?: boolean;
};
export type Player = {
  id: string;
  name: string;
  bot: boolean;
  hand: (Card | null)[];
  completedTurns?: number;
  score: number;
  points: number;
  draws: number;
  roundDraws: number;
  skullsRemaining?: number;
  earned: number;
  status: 'alive' | 'burst' | 'safe';
  redraws: number;
  ready: boolean;
  items: Item[];
  shield: boolean;
  substituteSlot?: number | null;
  counter?: boolean;
  shieldUsed: boolean;
  substituteUsed: boolean;
  doubled: boolean;
  doubleUsed?: boolean;
  doubleGranted?: boolean;
  peeks: {
    target: string;
    slot: number;
    value: number;
    skull?: boolean;
    angel?: boolean;
    endTurn?: boolean;
  }[];
};
export type Event = {
  id: string;
  time: number;
  text: string;
  effect?: { by: string; item: Item | 'deal' | 'notice'; target?: string; text: string };
  draw?: {
    by: string;
    from: string;
    value: number;
      skull?: boolean;
    angel?: boolean;
    endedTurn?: boolean;
    burst: boolean;
    shield: boolean;
    dudConsumedShield?: boolean;
    substitute?: boolean;
    dud?: boolean;
    blessing?: boolean;
    counter?: {face:number; victim?:string; options:string[]};
    points: number;
    finished?: boolean;
  };
};
export type Room = {
  rulesVersion?: number;
  blessingPending?: boolean;
  totalRounds?: number;
  turnPoints?: number;
  guardPenalty?: boolean;
  direction?: 1 | -1;
  chosenTarget?: string | null;
  turnSerial?: number;
  turnStage?: 'items' | 'draw';
  intent?: { by: string; target: string; slot: number } | null;
  code: string;
  host: string;
  players: Player[];
  spectators?: {id:string;name:string}[];
  phase:
    | 'lobby'
    | 'exchange'
    | 'arrange'
    | 'roulette'
    | 'play'
    | 'result'
    | 'final'
    | 'closed';
  round: number;
  turn: string;
  deadline: number;
  lastAction: number;
  lastTarget: string | null;
  streak: number;
  turnTarget: string | null;
  drawnThisTurn: number;
  events: Event[];
  chat: { id: string; name: string; text: string; time: number }[];
  results: {
    round: number;
    winner: string | null;
    draw?: boolean;
    scores: { id: string; score: number; bonus: number }[];
  }[];
  revision: number;
};
export type Action = {
  type: string;
  target?: string;
  slot?: number;
  ownSlot?: number;
  sacrifice?: number;
  slots?: number[];
  order?: number[];
  item?: number;
  value?: number;
  text?: string;
  name?: string;
};
export const now = () => Date.now();
export function random(n: number) {
  if (!Number.isInteger(n) || n < 1) throw Error('invalid random range');
  const a = new Uint32Array(1);
  const limit = 4294967296 - (4294967296 % n);
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= limit);
  return a[0] % n;
}
function shuffled<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function player(id: string, name: string, bot = false): Player {
  return {
    id,
    name,
    bot,
    hand: [],
    score: 0,
    points: 0,
    draws: 0,
    roundDraws: 0,
    skullsRemaining: 2,
    earned: 0,
    status: 'alive',
    redraws: 0,
    ready: false,
    items: [],
    shield: false,
    shieldUsed: false,
    substituteUsed: false,
    doubled: false,
    peeks: [],
  };
}
export function createRoom(code: string, id: string, name: string): Room {
  return {
    code,
    rulesVersion: 2,
    host: id,
    players: [player(id, name)],
    phase: 'lobby',
    round: 0,
    turn: '',
    deadline: 0,
    lastAction: now(),
    lastTarget: null,
    streak: 0,
    turnTarget: null,
    drawnThisTurn: 0,
    events: [],
    chat: [],
    results: [],
    revision: 0,
  };
}
function log(r: Room, text: string, draw?: Event['draw']) {
  r.events.push({
    id: crypto.randomUUID(),
    time: now(),
    text,
    ...(draw ? { draw } : {}),
  });
  r.events = r.events.slice(-70);
}
function must(test: unknown, message: string): asserts test {
  if (!test) throw Error(message);
}
function member(r: Room, id: string) {
  const p = r.players.find((p) => p.id === id);
  must(p, 'ルームに参加していません');
  return p;
}
function remaining(p: Player) {
  return p.hand.filter(Boolean).length;
}
export function nominees(r: Room, p: Player) {
 return r.players.filter(q => q.id !== p.id && q.status === 'alive' && remaining(q)>0);
}
export function targets(r: Room, p: Player) {
 return r.turn===p.id && r.chosenTarget ? nominees(r,p).filter(q=>q.id===r.chosenTarget) : [];
}
export function joinRoom(r: Room,id:string,name:string) {
 must(name.trim().length>0 && name.trim().length<=16,'名前は1〜16文字です');
 if(r.players.some(p=>p.id===id) || r.spectators?.some(p=>p.id===id))return;
 if(r.phase==='lobby' && r.players.length<4)r.players.push(player(id,name.trim()));
 else { must(r.phase!=='closed','ルームは閉じられています'); r.spectators??=[]; must(r.spectators.length<30,'観戦席は満員です');r.spectators.push({id,name:name.trim()}); }
}
export function returnToLobby(r: Room) {
 r.phase='lobby';r.turn='';r.intent=null;r.chosenTarget=null;r.deadline=0;
 const waiting=r.spectators??[];
 while(waiting.length && (r.players.length<4 || r.players.some(p=>p.bot))) {
  if(r.players.length>=4) r.players.splice(r.players.findIndex(p=>p.bot),1);
  const q=waiting.shift()!;r.players.push(player(q.id,q.name));
 }
 r.spectators=waiting;
}
export function itemPool(p: Player, exclude?: Item) {
  return ITEMS.flatMap((item) =>
    item === 'blessing' ||
    item === exclude ||
    ((item === 'double' && (p.doubleGranted || p.items.includes('double') || p.doubled)) ||
      (item === 'shield' && (p.shieldUsed || p.items.includes('shield') || p.shield)) ||
      (item === 'substitute' && (p.substituteUsed || p.items.includes('substitute') || p.substituteSlot != null)))
      ? []
      : (Array(4).fill(item) as Item[]),
  );
}
function grantItem(r: Room, p: Player, exclude?: Item, playerCount = 4) {
  if (r.blessingPending) {
    p.items.push('blessing');
    r.blessingPending = false;
    return 'blessing' as Item;
  }
  const pool = itemPool(p, exclude).filter(item => playerCount !== 2 || item !== 'nominate');
  const item = pool[random(pool.length)];
  p.items.push(item);
  if (item === 'double') p.doubleGranted = true;
  return item;
}
function effect(
  r: Room,
  by: string,
  item: Item | 'deal',
  text: string,
  target?: string,
) {
  r.events.push({
    id: crypto.randomUUID(),
    time: now(),
    text,
    effect: { by, item, text, ...(target ? { target } : {}) },
  });
  r.events = r.events.slice(-70);
}
function beginTurn(r: Room) {
  r.turnPoints = 0;
  r.guardPenalty = false;
  r.turnSerial = (r.turnSerial ?? 0) + 1;
  r.turnStage = 'items';
  r.chosenTarget = null;
  r.intent = null;
  r.drawnThisTurn = 0;
  r.deadline = now() + 120000;
  r.lastAction = now();
  const p = member(r, r.turn);
  // ドクロガードの待機状態は、使用したターンをまたいで持ち越さない。
  p.shield = false;
  p.substituteSlot = null;
  p.counter = false;
  grantItem(r, p, undefined, r.players.length);
  effect(r, p.id, 'deal', `${p.name} にアイテムを1個追加しました`);
}
function startRound(r: Room) {
  r.round++;
  r.turnPoints = 0;
  r.guardPenalty = false;
  r.direction = 1;
  r.chosenTarget = null;
  r.phase = 'arrange';
  r.deadline = now() + 120000;
  r.turn = '';
  r.lastTarget = null;
  r.streak = 0;
  r.turnTarget = null;
  r.drawnThisTurn = 0;
  r.turnStage = 'items';
  r.intent = null;
  for (const p of r.players) {
    p.hand = Array.from({ length: 9 }, () => ({ value: 0, angel: true }));
    for (const slot of shuffled([0,1,2,3,4,5,6,7,8]).slice(0,2)) p.hand[slot] = { value: 0, skull: true };
    p.completedTurns = 0;
    p.score = 0;
    p.roundDraws = 0;
    p.skullsRemaining = 2;
    p.status = 'alive';
    p.redraws = 0;
    p.ready = false;
    p.items = [];
    p.doubleGranted = false;
    p.shield = false;
    p.substituteSlot = null;
    p.counter = false;
    p.shieldUsed = false;
    p.substituteUsed = false;
    p.doubled = false;
    p.doubleUsed = false;
    p.peeks = [];
    for (let i=0;i<2;i++) grantItem(r, p, undefined, r.players.length);
  }
  log(r, `ROUND ${r.round} — 手札を配りました`);
}
function setupProgress(r: Room) {
  if (!r.players.every((p) => p.ready)) return;
  if (r.phase === 'exchange') {
    r.phase = 'arrange';
    r.deadline = now() + 120000;
    for (const p of r.players) p.ready = false;
    log(r, 'カードを好きな順番に配置してください');
  } else if (r.phase === 'arrange') {
    r.turn = r.players[random(r.players.length)].id;
    r.phase = 'roulette';
    r.deadline = now() + 4000;
    log(r, '先攻プレイヤーを抽選中');
  }
}
function finishRound(r: Room) {
  const alive = r.players.filter((p) => p.status === 'alive');
  const goal = r.players.length === 2 ? 7 : r.players.length === 3 ? 11 : 15;
  const reached = r.players.find(p => p.status !== 'burst' && p.score >= goal);
  const contenders = r.players.filter(p => p.status !== 'burst');
  if (!reached && contenders.length > 1 && alive.some(p => (p.completedTurns ?? 0) < 2)) return false;
  // 「生き残り」だけでなく、確定上がり（safe）も含めて引いた枚数でラウンド勝者を決める。
  const max = Math.max(...contenders.map(p => p.score));
  const leaders = contenders.filter(p => p.score === max);
  const winner = reached?.id ?? (leaders.length === 1 ? leaders[0].id : null);
  const draw = !winner;
  const scores = r.players.map((p) => {
    const bonus = p.id === winner ? 1 : 0;
    p.points += bonus;
    return { id: p.id, score: p.score, bonus };
  });
  r.results.push({ round: r.round, winner, draw, scores });
  const earlyMatchWinner = (r.totalRounds ?? 3) === 3 && winner &&
    r.results.filter((result) => result.winner === winner).length >= 2;
  r.phase = r.round >= (r.totalRounds ?? 3) || !!earlyMatchWinner ? 'final' : 'result';
  r.deadline = r.phase==='final' ? now()+60000 : 0;
  log(
    r,
    winner
      ? `${member(r, winner).name} がラウンド勝利`
      : 'ラウンド終了',
  );
  return true;
}
function endTurn(r: Room) {
  const current = member(r, r.turn);
  current.shield = false;
  current.substituteSlot = null;
  current.counter = false;
  current.doubled = false;
  current.completedTurns = (current.completedTurns ?? 0) + 1;
  if (r.turnTarget) {
    if (r.lastTarget === r.turnTarget) r.streak++;
    else {
      r.lastTarget = r.turnTarget;
      r.streak = 1;
    }
  } else {
    r.lastTarget = null;
    r.streak = 0;
  }
  r.turnTarget = null;
  r.drawnThisTurn = 0;
  r.turnStage = 'items';
  r.intent = null;
  if (finishRound(r)) return;
  const i = r.players.findIndex((p) => p.id === r.turn);
  for (let step = 1; step <= r.players.length * 2; step++) {
    const p =
      r.players[
        (i + step + r.players.length * 2) %
          r.players.length
      ];
    if (p.status === 'alive' && (p.completedTurns ?? 0) < 2) {
      r.turn = p.id;
      break;
    }
  }
  beginTurn(r);
  log(r, `${member(r, r.turn).name} のターン`);
}
function card(p: Player, slot: unknown) {
  must(
    Number.isInteger(slot) && Number(slot) >= 0 && Number(slot) < p.hand.length,
    'カードの位置が不正です',
  );
  const c = p.hand[Number(slot)];
  must(c, 'そのカードはもうありません');
  return c;
}
function clearPeeks(r: Room, target: string) {
  for (const p of r.players)
    p.peeks = p.peeks.filter((x) => x.target !== target);
}
export function act(r: Room, id: string, a: Action) {
  if(a.type==='resultsSeen') {
    must(r.phase==='final' && (r.players.some(p=>p.id===id)||r.spectators?.some(p=>p.id===id)),'結果画面ではありません');
    r.deadline=Math.min(r.deadline||Infinity,now()+12000);return;
  }
  if(a.type==='lobby') { must(r.host===id && r.phase==='final','ホストが結果画面から戻れます');returnToLobby(r);return; }
  const p = member(r, id);
  p.items=p.items.filter(i=>ITEMS.includes(i));
  if (p.items.includes('double') || p.doubled) p.doubleGranted = true;
  must(r.phase !== 'closed', 'ルームは閉じられています');
  if (a.type === 'settings') {
    must(r.host === id && r.phase === 'lobby', 'ホストが開始前に設定できます');
    must(a.value === 1 || a.value === 3, 'ラウンド数は1または3です');
    r.totalRounds = a.value;
    return;
  }
  if (a.type === 'chat') {
    must(
      typeof a.text === 'string' &&
        a.text.trim().length > 0 &&
        a.text.length <= 240,
      'メッセージは1〜240文字です',
    );
    const recent = r.chat.filter((x) => x.id === id && now() - x.time < 3000);
    must(recent.length < 3, '少し待ってから送信してください');
    r.chat.push({ id, name: p.name, text: a.text.trim(), time: now() });
    r.chat = r.chat.slice(-80);
    return;
  }
  if (a.type === 'close') {
    must(r.host === id, 'ホストのみ操作できます');
    r.phase = 'closed';
    return;
  }
  if (a.type === 'leave') {
    must(
      r.phase === 'lobby' || r.phase === 'final',
      '対戦中は退出せず、接続を切るとAIが引き継ぎます',
    );
    r.players = r.players.filter((q) => q.id !== id);
    if (!r.players.length) r.phase = 'closed';
    else if (r.host === id) r.host = r.players[0].id;
    return;
  }
  if (a.type === 'kick') {
    must(r.phase === 'lobby' && r.host === id, 'ホストのみキックできます');
    must(typeof a.target === 'string' && a.target !== id, '対象プレイヤーが不正です');
    const target = r.players.find((q) => q.id === a.target);
    must(!!target, 'プレイヤーが見つかりません');
    r.players = r.players.filter((q) => q.id !== a.target);
    r.spectators = [...(r.spectators ?? []), { id: target!.id, name: target!.name }];
    return;
  }
  if (a.type === 'bot') {
    must(
      r.phase === 'lobby' && r.host === id && r.players.length < 4,
      'AIを追加できません',
    );
    r.players.push(
      player(
        crypto.randomUUID(),
        `AI ${r.players.filter((x) => x.bot).length + 1}`,
        true,
      ),
    );
    return;
  }
  if (a.type === 'start' || a.type === 'rematch') {
    must(r.host === id, 'ホストのみ開始できます');
    must(
      (a.type === 'start' && r.phase === 'lobby') ||
        (a.type === 'rematch' && r.phase === 'final'),
      '今は開始できません',
    );
    must(r.players.length >= 2, '2人以上必要です');
    r.round = 0;
    r.results = [];
    for (const q of r.players) {
      q.points = 0;
      q.draws = 0;
      q.earned = 0;
    }
    r.blessingPending = random(100) === 0;
    startRound(r);
    return;
  }
  if (a.type === 'next') {
    must(
      r.host === id && r.phase === 'result',
      'ホストが次のラウンドを開始します',
    );
    startRound(r);
    return;
  }
  if (a.type === 'ready') {
    must(
      (r.phase === 'exchange' || r.phase === 'arrange') && !p.ready,
      '今は確定できません',
    );
    if (r.phase === 'arrange' && a.order) {
      must(
        a.order.length === 9 &&
          new Set(a.order).size === 9 &&
          a.order.every((n) => Number.isInteger(n) && n >= 0 && n < 9),
        '並び順が不正です',
      );
      p.hand = a.order.map((i) => p.hand[i]);
    }
    p.ready = true;
    setupProgress(r);
    return;
  }
  must(
    r.phase === 'play' && r.turn === id && p.status === 'alive',
    'あなたのターンではありません',
  );
  must(now() < r.deadline, '制限時間を過ぎています');
  r.lastAction = now();
  if(a.type==='nominate') {
    must(!r.chosenTarget && r.drawnThisTurn===0,'このターンの相手は指名済みです');
    must(nominees(r,p).some(q=>q.id===a.target),'その相手は指名できません');
    r.chosenTarget=a.target!;r.intent=null;
    log(r,`${p.name} が ${member(r,a.target!).name} を指名しました`);return;
  }
  if (a.type === 'beginDraw') {
    r.turnStage = 'draw';
    r.intent = null;
    return;
  }
  if (a.type === 'select') {
    const q = member(r, a.target ?? '');
    must(
      targets(r, p).some((t) => t.id === q.id),
      'この相手は選択できません',
    );
    card(q, a.slot);
    r.intent = { by: id, target: q.id, slot: a.slot! };
    return;
  }
  if (a.type === 'cancelSelection') {
    r.intent = null;
    return;
  }
  if (a.type === 'stop') {
    must(!r.intent, '選択を解除してからターンを終了してください');
    must(r.drawnThisTurn >= 1 || nominees(r,p).length===0, '最低1枚は引いてください');
    endTurn(r);
    return;
  }
  if (a.type === 'draw') {
    r.turnStage = 'draw';
    r.intent = null;
    const q = member(r, a.target ?? '');
    must(
      targets(r, p).some((t) => t.id === q.id),
      'この相手は選択できません',
    );
    const c = card(q, a.slot);
    q.hand[a.slot!] = null;
    if (c.skull) q.skullsRemaining = Math.max(0, (q.skullsRemaining ?? 2) - 1);
    if (q.status === 'alive' && q.skullsRemaining === 0) {
      q.status = 'safe';
      log(r, `${q.name} はドクロ2枚がなくなり、安全確定しました`);
    }
    clearPeeks(r, q.id);
    p.draws++;
    p.roundDraws = (p.roundDraws ?? 0) + 1;
    r.drawnThisTurn++;
    r.turnTarget = q.id;
    const hit = !!c.skull && !c.dud;
    let counterResult: {face:number; victim?:string; options:string[]} | undefined;
    let protectedHit = false;
    let blessingProtected = false;
    let substituted = false;
    let dudConsumedShield = false;
    let points = 0;
    if (c.dud && p.shield) {
      p.shield = false;
      dudConsumedShield = true;
      log(r, `${p.name} は不発弾を引き、ドクロガードが消滅しました`);
    } else if (hit) {
      if (p.counter) {
        p.counter = false;
        const options = [p.id, ''];
        const face = random(options.length);
        const victim = options[face] ? member(r, options[face]) : undefined;
        if (victim && victim.items.includes('blessing')) {
          victim.items.splice(victim.items.indexOf('blessing'), 1);
          log(r, `${victim.name} の天使の加護が発動し、ランダムガードのバーストを防ぎました`);
          counterResult = {face, options};
        } else if (victim) {
          victim.status = 'burst'; victim.score = 0;
          counterResult = {face, victim:victim.id, options};
        } else {
          counterResult = {face, options};
        }
      } else if (p.substituteSlot != null) {
        substituted = true;
        p.substituteSlot = null;
        points = -Math.min(2, p.score);
        p.score += points;
        p.earned = Math.max(0, p.earned + points);
        effect(r, p.id, 'substitute', '身代わりが発動。バーストを防ぎ、獲得枚数を2枚減らしてターン終了しました（最低0枚）');
      } else if (p.shield) {
        protectedHit = true;
        p.shield = false;
        r.guardPenalty = true;
        points = -(r.turnPoints ?? 0) / 2;
        p.score += points;
        p.earned += points;
        r.turnPoints = (r.turnPoints ?? 0) + points;

        log(r, `${p.name} のドクロガードが発動。バーストを防ぎました。このターンの獲得点は半分になります`);
      } else if (p.items.includes('blessing')) {
        p.items.splice(p.items.indexOf('blessing'), 1);
        blessingProtected = true;
        points = 0;
        log(r, `${p.name} の天使の加護が発動し、バーストを防ぎました`);
      } else {
        p.status = 'burst';
    p.score = 0;
      }
    } else if (!c.dud) {
      points = (p.doubled && r.drawnThisTurn === 1 ? 2 : 1) * (r.guardPenalty ? 0.5 : 1);
      p.score += points;
      if (p.score >= (r.players.length === 2 ? 7 : r.players.length === 3 ? 11 : 15)) p.status = 'safe';
      r.turnPoints = (r.turnPoints ?? 0) + points;
      p.earned += points;
    }
    if (remaining(q) === 0 && q.status === 'alive') {
      q.status = 'safe';
      log(r, `${q.name} は手札0枚で安全確定`);
    }
    log(r, `${p.name} が ${q.name} からカードを引きました`, {
      by: p.id,
      from: q.id,
      value: c.value,
      skull: !!c.skull,
      angel: !!c.angel,
      endedTurn: !!c.endTurn || protectedHit || substituted || !!counterResult?.victim,
      burst: counterResult ? counterResult.victim === p.id : hit && !protectedHit && !substituted && !blessingProtected,
      shield: protectedHit,
      blessing: blessingProtected,
      dudConsumedShield,
      substitute: substituted,
      dud: !!c.dud,
      ...(counterResult ? {counter:counterResult} : {}),
      points,
      finished:p.status==='safe',
    });
    if (!finishRound(r) && (p.status !== 'alive' || c.endTurn || protectedHit || substituted || !!counterResult?.victim || remaining(q)===0 || q.status === 'safe')) {
      if (c.endTurn) log(r, `${p.name} が終了トラップを引き、ターン終了`);
      if (protectedHit) log(r, `${p.name} はドクロガードで防御しましたが、ドクロを引いたためターン終了`);
      endTurn(r);
    }
    return;
  }
  if (a.type === 'item') {
    r.intent = null;
    must(
      Number.isInteger(a.item) && a.item! >= 0 && a.item! < p.items.length,
      'アイテムがありません',
    );
    const item = p.items[a.item!];
    must(ITEMS.includes(item),'このアイテムは廃止されました');
    let q: Player | undefined;
    if (item === 'peek' || item === 'oracle' || item === 'nominate') {
      q = member(r, a.target ?? '');
      must(q.status !== 'burst', 'バーストした相手はこのラウンドの対象にできません');
      must(q.id !== p.id, '相手を選んでください');
    }
    let description = '';
    switch (item) {
      case 'oracle': {
        const slots = shuffled(q!.hand.map((c,i) => c ? i : -1).filter(i => i >= 0)).slice(0,3);
        must(slots.length > 0, '相手の手札がありません');
        const hasSkull = slots.some(i => q!.hand[i]!.skull);
        description = `${q!.name} の ${slots.map(i=>i+1).sort((a,b)=>a-b).join('・')}番（${slots.length}枚）には、ドクロが${hasSkull ? 'あります' : 'ありません'}。使用時点の情報です`;
        break;
      }
      case 'substitute': {
        must(!p.counter, 'ランダムガードと同時には使えません');
        must(!p.substituteUsed, '身代わりは1ラウンド1回までです');
        must(p.substituteSlot == null, '身代わりは使用済みです');
        must(!p.shield, 'ドクロガードと同時には使えません');
        p.substituteSlot = 0;
        p.substituteUsed = true;
        description = 'このターンにドクロを引くと、獲得枚数を2枚減らしてバーストを防ぎ、ターン終了します（最低0枚）';
        break;
      }
      case 'counter':
        must(!p.counter && !p.shield && p.substituteSlot == null, 'ガード・身代わり・カウンターとの併用はできません');
        p.counter = true;
        description = 'このターン、ドクロを引くと自分とセーフの2択ルーレット。自分が選ばれるとバーストし、セーフなら誰もバーストせず、ターン終了';
        break;
      case 'blessing':
        must(false, '天使の加護はドクロを引いたとき自動で発動します');
        break;
      case 'nominate':
        must(r.players.length > 2, '指名変更は3人以上の対戦でのみ使用できます');
        must(q!.status === 'alive' && remaining(q!) > 0, 'そのプレイヤーは指名できません');
        r.chosenTarget = q!.id;
        r.intent = null;
        description = `${q!.name} をこのターンの引く相手に変更しました`;
        break;
      case 'reposition':
        must(Array.isArray(a.order) && a.order.length === p.hand.length && new Set(a.order).size === p.hand.length && a.order.every(i => Number.isInteger(i) && i >= 0 && i < p.hand.length), '配置を確認してください');
        p.hand = a.order.map(i => p.hand[i]);
        clearPeeks(r,p.id);
        description = '再配置を確定しました';
        break;
      case 'dud':
        card(p, a.ownSlot);
        p.hand[a.ownSlot!] = { value: 0, skull: true, dud:true };
        clearPeeks(r, p.id);
        description = `自分の${a.ownSlot!+1}番を不発弾に変更しました`;
        break;
      case 'peek': {
        const c = card(q!, a.slot);
        p.peeks = p.peeks.filter(
          (x) => !(x.target === q!.id && x.slot === a.slot),
        );
        p.peeks.push({
          target: q!.id,
          slot: a.slot!,
          value: 0,
          skull: c.skull,
          angel: c.angel,
          endTurn: c.endTurn,
        });
        description = `${p.name} が ${q!.name} の ${a.slot! + 1}番を透視しました（カードは本人だけに表示）`;
        break;
      }
      case 'shield':
        must(!p.counter, 'ランダムガードと同時には使えません');
        must(p.substituteSlot == null, '身代わりと同時には使えません');
        must(!p.shieldUsed, 'ドクロガードは1ラウンド1回までです');
        p.shield = true;
        p.shieldUsed = true;
        description = `${p.name} を保護。次のドクロを1回だけ無効にします`;
        break;
      case 'double':
        must(!p.doubleUsed, '得点倍化は1ラウンド1回までです');
        must(r.drawnThisTurn === 0, '得点倍化は最初の1枚を引く前に使用してください');
        must(!p.doubled, '倍化はすでに待機中です');
        p.doubled = true;
        p.doubleUsed = true;
        p.doubleGranted = true;
        description = `${p.name} がこのターンの最初の1枚を倍化します`;
        break;
      case 'trap':
        card(p, a.ownSlot).endTurn = true;
        clearPeeks(r, p.id);
        description = `${p.name} が手札に終了トラップを設置しました`;
        break;
      case 'recycle': {
        must(
          Number.isInteger(a.sacrifice) &&
            a.sacrifice! >= 0 &&
            a.sacrifice! < p.items.length &&
            a.sacrifice !== a.item,
          'このアイテム以外の犠牲にするアイテムを選んでください',
        );
        const sacrificed = p.items[a.sacrifice!];
        // Both are consumed. The replacement cannot be the sacrificed type.
        const indices = [a.item!, a.sacrifice!].sort((a, b) => b - a);
        for (const i of indices) p.items.splice(i, 1);
        grantItem(r, p, sacrificed, r.players.length);
        effect(
          r,
          p.id,
          item,
          `${p.name} がアイテム1個を犠牲にして別のアイテムを取得しました`,
        );
        return;
      }
    }
    p.items.splice(a.item!, 1);
    effect(r, p.id, item, description, q?.id);
    if (p.score >= (r.players.length === 2 ? 7 : r.players.length === 3 ? 9 : 11)) {
      p.status = 'safe';
      if (!finishRound(r)) endTurn(r);
    }
    return;
  }
  throw Error('不明な操作です');
}
export function tick(r: Room, presence: Record<string, number>, time = now()) {
  if (r.rulesVersion !== 2) {
    r.players = r.players.map(p => player(p.id, p.name, p.bot));
    r.results = []; r.events = []; r.round = 0; r.rulesVersion = 2;
    r.totalRounds = r.totalRounds === 1 ? 1 : 3;
    returnToLobby(r);
    log(r, 'ルール更新のため待機室へ戻りました。新しい試合を開始してください');
    return true;
  }
  if(r.phase==='final' && r.deadline>0 && time>=r.deadline) {returnToLobby(r);return true;}
  let changed = false;
  const online = r.players.filter(
    (p) => !p.bot && time - (presence[p.id] ?? 0) < 3000,
  );
  if (online.length && !online.some((p) => p.id === r.host)) {
    r.host = online[0].id;
    changed = true;
  }
  if (r.phase === 'exchange' || r.phase === 'arrange') {
    for (const p of r.players) {
      if (
        !p.ready &&
        (p.bot || time - (presence[p.id] ?? 0) > 3000 || time >= r.deadline)
      ) {
        p.ready = true;
        changed = true;
      }
    }
    if (changed) setupProgress(r);
  }
  if (r.phase === 'roulette' && time >= r.deadline) {
    r.phase = 'play';
    beginTurn(r);
    r.deadline = time + 120000;
    r.lastAction = time;
    log(r, `${member(r, r.turn).name} が先攻です`);
    changed = true;
  }
  if (r.phase === 'play') {
    const p = member(r, r.turn);
    if (time >= r.deadline && (r.drawnThisTurn > 0 || !nominees(r,p).length)) {
      endTurn(r); return true;
    }
    // 制限時間までに1枚も引かなかった場合は、対象とカードを自動選択して1枚だけ引き、ターンを終了する。
    if (time >= r.deadline && r.drawnThisTurn === 0 && p.status === 'alive') {
      const candidates = r.chosenTarget ? targets(r, p) : nominees(r, p);
      if (candidates.length) {
        const q = candidates[random(candidates.length)];
        const slots = q.hand.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
        r.chosenTarget = q.id;
        r.deadline = time + 1000;
        act(r, p.id, { type: 'draw', target: q.id, slot: slots[random(slots.length)] });
        if (r.phase === 'play' && r.turn === p.id) endTurn(r);
        log(r, `${p.name} は時間切れのためランダムに1枚引き、ターン終了`);
        return true;
      }
    }
    const takeover =
      p.bot || time - (presence[p.id] ?? 0) > 3000 || time >= r.deadline;
    const delay = p.bot ? 500 : 500;
    if (takeover && time - r.lastAction >= delay) {
      if (time >= r.deadline) r.deadline = time + 120000;
      if(!r.chosenTarget && nominees(r,p).length) {
        const options=nominees(r,p);act(r,p.id,{type:'nominate',target:options[random(options.length)].id});return true;
      }
      const options = targets(r, p);
      if (
        r.intent?.by === p.id &&
        options.some((q) => q.id === r.intent?.target && q.hand[r.intent.slot])
      ) {
        act(r, p.id, {
          type: 'draw',
          target: r.intent.target,
          slot: r.intent.slot,
        });
      } else if (
        !options.length ||
        (r.drawnThisTurn > 0 && random(100) < 45)
      )
        act(r, p.id, { type: 'stop' });
      else {
        const q = options[random(options.length)];
        const slots = q.hand.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
        act(r, p.id, {
          type: 'select',
          target: q.id,
          slot: slots[random(slots.length)],
        });
      }
      changed = true;
    }
  }
  return changed;
}
export function view(r: Room, id: string, presence: Record<string, number>) {
  const spectator=r.spectators?.find(p=>p.id===id);
  const me = spectator ? player(id,spectator.name) : member(r, id);
  return {
    code: r.code,
    host: r.host,
    phase: r.phase,
    totalRounds: r.totalRounds ?? 3,
    guardPenalty: r.guardPenalty ?? false,
    round: r.round,
    direction: r.direction ?? 1,
    turnSerial: r.turnSerial ?? 0,
    chosenTarget: r.chosenTarget ?? null,
    turn: r.turn,
    deadline: r.deadline,
    serverTime: now(),
    revision: r.revision,
    me: id,
    spectator:!!spectator,
    spectators:r.spectators??[],
    nominees:!spectator && r.phase==='play' ? nominees(r,me).map(p=>p.id) : [],
    drawnThisTurn: r.drawnThisTurn,
    turnStage: r.turnStage ?? (r.drawnThisTurn ? 'draw' : 'items'),
    intent: r.phase === 'play' ? (r.intent ?? null) : null,
    targets: r.phase === 'play' ? targets(r, me).map((p) => p.id) : [],
    lastTarget: r.lastTarget,
    streak: r.streak,
    events: r.events.flatMap(e => {
      if (!e.effect) return [e];
      if (e.effect.by === id && (e.effect.item === 'deal' || ITEMS.includes(e.effect.item as Item))) return [e];
      if (['reposition','dud','oracle','peek','double','recycle','nominate'].includes(e.effect.item)) {
        const names: Record<string,string> = {reposition:'再配置',dud:'不発弾',oracle:'お告げ',peek:'透視',double:'得点倍化',recycle:'リサイクル',nominate:'指名変更'};
        const text = `${r.players.find(p=>p.id===e.effect!.by)?.name ?? 'プレイヤー'} が「${names[e.effect.item]}」を使用しました`;
        return [{id:e.id,time:e.time,text,effect:{by:e.effect.by,item:'notice' as const,text}}];
      }
      return [];
    }),
    chat: r.chat,
    results: r.results,
    players: r.players.map((p) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      online: now() - (presence[p.id] ?? 0) < 3000,
      score: p.score,
      points: p.points,
      draws: p.draws,
      roundDraws: p.roundDraws,
      earned: p.earned,
      status: p.status,
      redraws: p.redraws,
      ready: p.ready,
      shield: p.shield,
      shieldUsed: p.id === id ? p.shieldUsed : undefined,
      doubled: p.doubled,
      items: p.id === id ? p.items.filter(i=>ITEMS.includes(i)) : undefined,
      itemCount: p.items.length,
      completedTurns: p.completedTurns ?? 0,
      peeks: p.id === id ? p.peeks : undefined,
      hand: p.hand.map((c) =>
        c
          ? p.id === id
            ? {
                value: c.value,
                skull: c.skull,
                angel: c.angel,
                dud: c.dud,
                endTurn: c.endTurn,
              }
            : { hidden: true }
          : null,
      ),
    })),
  };
}
