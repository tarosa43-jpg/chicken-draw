import test from 'node:test';
import assert from 'node:assert/strict';
import { moveInOrder } from '../lib/arrangement.ts';
import { createRoom, player, act } from '../lib/game.ts';
test('dragging across the entire row preserves card identity and server persists the dropped order', () => {
  const r = createRoom('123456', 'a', 'a');
  r.players.push(player('b', 'b'));
  act(r, 'a', { type: 'start' });
  const original = structuredClone(r.players[0].hand);
  let order = moveInOrder([0, 1, 2, 3, 4, 5, 6, 7, 8], 0, 8);
  assert.deepEqual(order, [1, 2, 3, 4, 5, 6, 7, 8, 0]);
  order = moveInOrder(order, 7, 0);
  assert.deepEqual(order, [8, 1, 2, 3, 4, 5, 6, 7, 0]);
  act(r, 'a', { type: 'ready', order });
  assert.deepEqual(
    r.players[0].hand,
    order.map((i) => original[i]),
  );
  assert.equal(r.players[0].hand.filter(c => c.skull).length, 2);
});
test('cancelled or off-board placement preserves order', () => {
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(moveInOrder(order, 3, 3), order);
  assert.deepEqual(moveInOrder(order, 2, -1), order);
  assert.deepEqual(moveInOrder(order, 2, 9), order);
});
