import { readHover, writeHover } from '@/lib/hover';
import { database } from '@/db/store';
import {
  act,
  joinRoom,
  createRoom,
  player,
  random,
  tick,
  view,
  type Room,
  type Action,
} from '@/lib/game';
export const dynamic = 'force-dynamic';
type Stored = Room & { commands?: string[] };
async function identity(req: Request) {
  let token = req.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)ng_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  let fresh = false;
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    fresh = true;
  }
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return {
    id: Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    token,
    fresh,
  };
}
function reply(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      Vary: 'Cookie',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });
}
function forwardedValue(req: Request, name: string) {
  return req.headers.get(name)?.split(',')[0]?.trim();
}
function allowedRequestOrigin(req: Request) {
  const requestUrl = new URL(req.url);
  const forwardedHost = forwardedValue(req, 'x-forwarded-host');
  const forwardedProto = forwardedValue(req, 'x-forwarded-proto');
  const host = forwardedHost || req.headers.get('host');
  const proto = forwardedProto || requestUrl.protocol.slice(0, -1);
  const origins = new Set([requestUrl.origin]);
  if (host && (proto === 'http' || proto === 'https'))
    origins.add(`${proto}://${host}`);
  return origins;
}
async function presenceFor(code: string) {
  const result = await database()
    .prepare('SELECT player, seen FROM presence WHERE code = ?')
    .bind(code)
    .all<{ player: string; seen: number }>();
  return Object.fromEntries(result.results.map((p) => [p.player, p.seen]));
}
async function heartbeat(code: string, id: string) {
  await database()
    .prepare(
      'INSERT INTO presence (code, player, seen) VALUES (?, ?, ?) ON CONFLICT(code,player) DO UPDATE SET seen=excluded.seen',
    )
    .bind(code, id, Date.now())
    .run();
}
async function read(code: string) {
  return database()
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .bind(code)
    .first<{ state: string; version: number }>();
}
export async function GET(req: Request) {
  try {
    const { id, token, fresh } = await identity(req);
    const cookie = fresh
      ? `ng_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`
      : undefined;
    const code = new URL(req.url).searchParams.get('code');
    if (!code) return reply({ ready: true }, 200, cookie);
    if (!/^\d{6}$/.test(code))
      return reply({ error: '6桁のコードを入力してください' }, 400, cookie);
    for (let n = 0; n < 5; n++) {
      const row = await read(code);
      if (!row) return reply({ error: 'ルームが見つかりません' }, 404, cookie);
      const r: Stored = JSON.parse(row.state);
      if (!r.players.some((p) => p.id === id) && !r.spectators?.some(p=>p.id===id))
        return reply(
          { error: 'プレイヤー名を入力して参加してください', join: true },
          403,
          cookie,
        );
      if (new URL(req.url).searchParams.has('hover')) return reply({hover: await readHover(r)}, 200, cookie);
      await heartbeat(code, id);
      const presence = await presenceFor(code);
      if (tick(r, presence)) {
        r.revision = row.version + 1;
        const result = await database()
          .prepare(
            'UPDATE rooms SET state = ?, version = version + 1 WHERE code = ? AND version = ?',
          )
          .bind(JSON.stringify(r), code, row.version)
          .run();
        if (!result.meta.changes) continue;
      }
      return reply(view(r, id, presence), 200, cookie);
    }
    return reply({ error: '同期中です。少し待ってください' }, 409, cookie);
  } catch (e) {
    console.error('game read failed', e);
    return reply({ error: '対戦サーバーへの接続に失敗しました' }, 503);
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (!origin || !allowedRequestOrigin(req).has(origin))
      return reply({ error: 'このページから操作してください' }, 403);
    if (Number(req.headers.get('content-length') ?? 0) > 8000)
      return reply({ error: 'リクエストが大きすぎます' }, 413);
    const raw = await req.text();
    if (raw.length > 8000)
      return reply({ error: 'リクエストが大きすぎます' }, 413);
    const body = JSON.parse(raw);
    const { id, token, fresh } = await identity(req);
    const cookie = fresh
      ? `ng_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`
      : undefined;
    if (body.type === 'create') {
      const name = String(body.name ?? '').trim();
      if (!name || name.length > 16)
        return reply(
          { error: '名前は1〜16文字で入力してください' },
          400,
          cookie,
        );
      for (let i = 0; i < 8; i++) {
        const code = String(100000 + random(900000));
        const r = createRoom(code, id, name);
        const result = await database()
          .prepare(
            'INSERT INTO rooms (code, state, version) VALUES (?, ?, 0) ON CONFLICT (code) DO NOTHING',
          )
          .bind(code, JSON.stringify(r))
          .run();
        if (result.meta.changes) {
          await heartbeat(code, id);
          return reply(view(r, id, { [id]: Date.now() }), 200, cookie);
        }
      }
      return reply({ error: 'ルームの作成をやり直してください' }, 503, cookie);
    }
    const code = String(body.code ?? '');
    if (!/^\d{6}$/.test(code))
      return reply({ error: '6桁のコードを入力してください' }, 400, cookie);
    if (typeof body.requestId !== 'string' || body.requestId.length > 80)
      return reply({ error: '操作IDがありません' }, 400, cookie);
    for (let attempt = 0; attempt < 8; attempt++) {
      const row = await read(code);
      if (!row) return reply({ error: 'ルームが見つかりません' }, 404, cookie);
      const r: Stored = JSON.parse(row.state);
      const key = id + ':' + body.requestId;
      const existing = r.players.find((p) => p.id === id) ?? r.spectators?.find(p=>p.id===id);
      if (body.type === 'hover') {
        if (!existing) return reply({error:'参加が必要です'},403,cookie);
        try { await writeHover(r,id,body); return reply({ok:true},200,cookie); } catch { return reply({error:'対象を更新できません'},400,cookie); }
      }
      if (r.commands?.includes(key) && existing)
        return reply(view(r, id, await presenceFor(code)), 200, cookie);
      if (body.type === 'join') {
        try {joinRoom(r,id,String(body.name??''));} catch(e) {return reply({error:(e as Error).message},400,cookie);}
      } else {
        if (!existing)
          return reply({ error: 'ルームに参加してください' }, 403, cookie);
        if (
          [
            'nominate',
            'draw',
            'beginDraw',
            'select',
            'cancelSelection',
            'initialBurstChoice',
            'item',
            'stop',
            'ready',
            'exchange',
            'start',
            'next',
            'rematch',
          ].includes(body.type) &&
          body.revision !== row.version
        )
          return reply(
            {
              error:
                '状況が更新されました。画面を確認してもう一度操作してください',
            },
            409,
            cookie,
          );
        try {
          act(r, id, body as Action);
        } catch (e) {
          return reply(
            { error: e instanceof Error ? e.message : '操作できません' },
            400,
            cookie,
          );
        }
      }
      r.commands = [...(r.commands ?? []), key].slice(-120);
      r.revision = row.version + 1;
      const result = await database()
        .prepare(
          'UPDATE rooms SET state = ?, version = version + 1 WHERE code = ? AND version = ?',
        )
        .bind(JSON.stringify(r), code, row.version)
        .run();
      if (!result.meta.changes) continue;
      await heartbeat(code, id);
      if (!r.players.some((p) => p.id === id) && !r.spectators?.some(p=>p.id===id))
        return reply({ left: true }, 200, cookie);
      return reply(view(r, id, await presenceFor(code)), 200, cookie);
    }
    return reply(
      { error: '同時操作が発生しました。もう一度お試しください' },
      409,
      cookie,
    );
  } catch (e) {
    console.error('game action failed', e);
    return reply({ error: '操作を処理できませんでした' }, 500);
  }
}
