// The shared merge rules (assets/account/merge.js), used by both the site and the Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import M from '../../../assets/account/merge.js';

test('which keys travel', () => {
  for (const k of ['ek_watch', 'ek_notes', 'ck_tools', 'wl_main', 'ps_x']) assert.ok(M.syncable(k), k);
  for (const k of ['ck_lang', 'ek_pro_lang', 'ek_sync', 'ek_sync_backup', 'ek_acct', 'ek_gpu', 'ek_px_cache', 'other', 'ek_' + 'x'.repeat(90), '__proto__'])
    assert.ok(!M.syncable(k), k);
});

test('first contact: lists united, objects merged, a deletion never wipes data', () => {
  const j = M.joinKey({ v: '["SOL",{"id":2,"t":"b"}]', t: 0 }, { v: '["BTC",{"id":2,"t":"a"},{"id":1}]', t: 5 });
  assert.deepEqual(JSON.parse(j.v), ['BTC', { id: 2, t: 'a' }, { id: 1 }, 'SOL']);
  const o = M.joinKey({ v: '{"a":1,"b":{"x":1}}', t: 0 }, { v: '{"b":{"y":2},"c":3}', t: 5 });
  assert.deepEqual(JSON.parse(o.v), { a: 1, b: { x: 1, y: 2 }, c: 3 });
  assert.equal(M.joinKey({ v: 'keep', t: 0 }, { v: null, t: 9 }).v, 'keep');
  assert.equal(M.joinKey({ v: null, t: 9 }, { v: 'keep', t: 0 }).v, 'keep');
  assert.equal(M.joinKey({ v: 'local', t: 0 }, { v: 'account', t: 5 }).v, 'account');   // plain values: the account's wins
});

test('day to day: newer wins, a tie keeps the stored copy', () => {
  assert.ok(M.wins({ t: 2 }, { t: 1 }));
  assert.ok(!M.wins({ t: 1 }, { t: 1 }));
  assert.ok(!M.wins({ t: 0 }, { t: 1 }));
  assert.ok(M.wins({ t: 0 }, null));
});

test('a joined value that would be too big falls back to the newer one', () => {
  const big = JSON.stringify(Array.from({ length: 6000 }, (_, i) => 'item' + i));
  const big2 = JSON.stringify(Array.from({ length: 6000 }, (_, i) => 'other' + i));
  const j = M.joinKey({ v: big, t: 0 }, { v: big2, t: 5 });
  assert.equal(j.v, big2);
});
