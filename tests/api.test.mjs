import test from 'node:test';
import assert from 'node:assert/strict';
const origin = process.env.NG_TEST_ORIGIN || 'http://localhost:3000';
class Client {
  cookie = '';
  state = null;
  async request(type, extra = {}, requestId = crypto.randomUUID()) {
    const response = await fetch(origin + '/api/game', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: this.cookie,
      },
      body: JSON.stringify({
        type,
        code: this.state?.code,
        name: 'Test Player',
        revision: this.state?.revision,
        requestId,
        ...extra,
      }),
    });
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0];
    const data = await response.json();
    if (response.ok && !data.left) this.state = data;
    return { status: response.status, data };
  }
  async poll(code = this.state.code) {
    const response = await fetch(origin + '/api/game?code=' + code, {
      headers: { Cookie: this.cookie },
    });
    const data = await response.json();
    if (response.ok) this.state = data;
    return { status: response.status, data };
  }
}
test('HTTP multiplayer, access boundaries, reload, concurrent commands, invite, and room closing', async () => {
  const clients = Array.from({ length: 4 }, () => new Client());
  const first = await clients[0].request('create');
  assert.equal(first.status, 200);
  const code = first.data.code;
  assert.match(code, /^\d{6}$/);
  for (const c of clients.slice(1))
    assert.equal((await c.request('join', { code })).status, 200);
  await clients[0].poll();
  const fifth = new Client();
  assert.equal((await fifth.request('join', { code })).status, 200);
  assert.equal((await fifth.poll(code)).status, 200);
  assert.equal(fifth.state.spectator,true);
  await clients[1].poll();
  assert.equal((await clients[1].request('start')).status, 400);
  await clients[0].poll();
  assert.equal((await clients[0].request('start')).status, 200);
  assert.equal((await fifth.request('join', { code })).status, 200);
  for (const c of clients) {
    await c.poll();
    const own = c.state.players.find((p) => p.id === c.state.me);
    assert.equal(own.ng, undefined);
    assert.equal(own.hand.filter((c) => c?.skull).length, 2);
    assert.equal(own.hand.length, 9);
    for (const other of c.state.players.filter((p) => p.id !== c.state.me)) {
      assert.deepEqual(other.hand[0], { hidden: true });
      assert.equal(other.items, undefined);
    }
  }
  for (const c of clients) {
    await c.poll();
    assert.equal(c.state.phase, 'arrange');
    assert.equal(
      (await c.request('ready', { order: [8, 7, 6, 5, 4, 3, 2, 1, 0] })).status,
      200,
    );
  }
  await new Promise((r) => setTimeout(r, 4300));
  await clients[0].poll();
  assert.equal(clients[0].state.phase, 'play');
  const late = new Client();
  assert.equal((await late.request('join',{code})).status,200);
  assert.equal(late.state.spectator,true);
  assert.ok(late.state.players.every(p=>p.items===undefined&&p.hand.every(c=>!c||c.hidden)));
  assert.equal((await late.request('stop')).status,400);
  const current = clients.find((c) => c.state.me === clients[0].state.turn);
  await current.poll();
  const target = current.state.nominees[0];
  assert.equal((await current.request('nominate',{target})).status,200);
  const targetClient = clients.find(c => c.state.me === target);
  await targetClient.poll();
  const safeSlot = targetClient.state.players.find(p => p.id === target).hand.findIndex(c => c && !c.skull && !c.endTurn);
  const beforeHoverRevision = current.state.revision;
  const serial = current.state.turnSerial;
  const sendHover = (client, fields) => fetch(origin+'/api/game',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:client.cookie},body:JSON.stringify({type:'hover',code,requestId:crypto.randomUUID(),serial,...fields})});
  assert.equal((await sendHover(current,{target,slot:safeSlot})).status,200);
  const observer=clients.find(c=>c!==current);
  const hoverState=await fetch(origin+'/api/game?code='+code+'&hover=1',{headers:{Cookie:observer.cookie}}).then(r=>r.json());
  assert.deepEqual(hoverState.hover,{by:current.state.me,target,slot:safeSlot});
  assert.equal((await sendHover(observer,{target,slot:safeSlot})).status,400);
  assert.equal((await sendHover(current,{target,slot:99})).status,400);
  await current.poll();assert.equal(current.state.revision,beforeHoverRevision);
  assert.equal((await sendHover(current,{})).status,200);
  assert.equal((await fetch(origin+'/api/game?code='+code+'&hover=1',{headers:{Cookie:observer.cookie}}).then(r=>r.json())).hover,null);
  const selecting = await current.request('select', { target, slot: safeSlot });
  assert.equal(selecting.status, 200);
  for (const client of clients) {
    await client.poll();
    assert.deepEqual(client.state.intent, {
      by: current.state.me,
      target,
      slot: safeSlot,
    });
    assert.notEqual(
      client.state.players.find((p) => p.id === target).hand[safeSlot],
      null,
    );
  }
  assert.equal((await current.request('stop')).status, 400);
  const command = crypto.randomUUID();
  const result = await current.request('draw', { target, slot: safeSlot }, command);
  assert.equal(result.status, 200);
  const after = result.data;
  const duplicate = await current.request('draw', { target, slot: safeSlot }, command);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.revision, after.revision);
  assert.equal(
    duplicate.data.players.find((p) => p.id === target).hand[safeSlot],
    null,
  );
  const reloaded = new Client();
  reloaded.cookie = current.cookie;
  const restored = await reloaded.poll(code);
  assert.equal(restored.status, 200);
  assert.equal(restored.data.me, current.state.me);
  assert.equal(
    restored.data.players.find((p) => p.id === current.state.me).draws,
    1,
  );
  await clients[0].poll();
  const turnClient = clients.find((c) => c.state.me === clients[0].state.turn);
  await turnClient.poll();
  const pair = await Promise.all([
    turnClient.request('stop'),
    turnClient.request('stop'),
  ]);
  assert.equal(pair.filter((r) => r.status === 200).length, 1);
  assert.equal(pair.filter((r) => r.status === 409).length, 1);
  const csrf = await fetch(origin + '/api/game', {
    method: 'POST',
    headers: {
      Origin: 'https://example.invalid',
      'Content-Type': 'application/json',
      Cookie: clients[0].cookie,
    },
    body: JSON.stringify({
      type: 'close',
      code,
      requestId: crypto.randomUUID(),
    }),
  });
  assert.equal(csrf.status, 403);
  assert.equal((await clients[0].request('close')).status, 200);
  await clients[1].poll();
  assert.equal(clients[1].state.phase, 'closed');
  assert.equal(
    (await clients[1].request('draw', { target: clients[0].state.me, slot: 1 }))
      .status,
    400,
  );
});

