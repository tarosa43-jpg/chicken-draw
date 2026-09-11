import { database } from '@/db/store';
import { targets, type Room } from '@/lib/game';
let ready: Promise<unknown> | undefined;
function init() {
 return ready ??= database().prepare('CREATE TABLE IF NOT EXISTS card_hover (code TEXT PRIMARY KEY, player TEXT NOT NULL, serial INTEGER NOT NULL, target TEXT, slot INTEGER, seen INTEGER NOT NULL)').run().catch(e => { ready=undefined; throw e; });
}
export async function readHover(r: Room) {
 await init();
 const h = await database().prepare('SELECT player AS by, serial, target, slot, seen FROM card_hover WHERE code = ?').bind(r.code).first<{by:string;serial:number;target:string;slot:number;seen:number}>();
 if (!h || !h.target || r.phase !== 'play' || h.by !== r.turn || h.serial !== (r.turnSerial ?? 0) || Date.now()-h.seen > 1500 || r.intent) return null;
 const p=r.players.find(p=>p.id===r.turn)!;
 if (!targets(r,p).some(q=>q.id===h.target && q.hand[h.slot])) return null;
 return {by:h.by,target:h.target,slot:h.slot};
}
export async function writeHover(r: Room, id: string, body: {target?:string;slot?:number;serial?:number}) {
 const p=r.players.find(p=>p.id===id);
 if (r.phase!=='play' || r.turn!==id || p?.status!=='alive' || body.serial!==(r.turnSerial??0) || Date.now()>=r.deadline) throw Error('現在の手番ではありません');
 if (body.target && (!Number.isInteger(body.slot) || !targets(r,p).some(q=>q.id===body.target && q.hand[body.slot!]))) throw Error('対象カードが不正です');
 await init();
 await database().prepare('INSERT INTO card_hover(code,player,serial,target,slot,seen) VALUES(?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET player=excluded.player,serial=excluded.serial,target=excluded.target,slot=excluded.slot,seen=excluded.seen').bind(r.code,id,body.serial,body.target??null,body.target ? body.slot! : null,Date.now()).run();
}
