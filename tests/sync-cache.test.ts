import test from 'node:test';
import assert from 'node:assert/strict';
import { openFitnessCache, type CacheStorage, type ClaimCache } from '../lib/fitness/sync-cache';
import { FitnessSyncClient, type SyncSnapshot } from '../lib/fitness/sync-client';
import { initialData } from '../lib/fitness/seed';
import type { Routine } from '../lib/fitness/model';

class Storage implements CacheStorage {
  entries = new Map<string, string>();
  get length() { return this.entries.size; }
  key(index: number) { return [...this.entries.keys()][index] ?? null; }
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
  removeItem(key: string) { this.entries.delete(key); }
}
function locks(): ClaimCache {
  const locked = new Set<string>();
  return async key => {
    if (locked.has(key)) return;
    locked.add(key); return () => { locked.delete(key); };
  };
}
const routine = (id: string): Routine => ({ id, name: id, days: [1], description: '', exercises: [], color: 'lime' });
const snapshot = (id: string): SyncSnapshot => ({ data: initialData('user'), pending: [{ resource: 'routine', id, entity: routine(id), version: 0, stamp: 1 }] });

test('two live tabs cannot overwrite each other in shared localStorage', async () => {
  const storage = new Storage(), claim = locks();
  const a = await openFitnessCache('user', storage, claim), b = await openFitnessCache('user', storage, claim);
  a.write(snapshot('a')); b.write(snapshot('b'));
  assert.equal(a.read().pending[0].id, 'a'); assert.equal(b.read().pending[0].id, 'b');
  a.close(); b.close();
  const reloadA = await openFitnessCache('user', storage, claim), reloadB = await openFitnessCache('user', storage, claim);
  assert.deepEqual([reloadA.read().pending[0].id, reloadB.read().pending[0].id].sort(), ['a', 'b']);
  reloadA.close(); reloadB.close();
});

test('new cache migrates old pending queue without deleting its snapshot or losing offline edits', async () => {
  const storage = new Storage();
  storage.setItem('personal-fitness-pending:user', JSON.stringify(snapshot('legacy').pending));
  storage.setItem('personal-fitness-data:user', JSON.stringify(initialData('user')));
  const cache = await openFitnessCache('user', storage, locks());
  const client = new FitnessSyncClient(cache, { read: async () => { throw new Error('Offline'); }, save: async () => { throw new Error('Offline'); } }, () => false);
  await client.load(); client.mutate('routine', routine('new'));
  assert.deepEqual(cache.read().pending.map(item => item.id), ['legacy', 'new']);
  assert.equal(client.state.data?.routines.length, 2);
  assert.equal(storage.getItem('personal-fitness-pending:user'), null);
  assert(storage.getItem('personal-fitness-data:user')); cache.close();
});

test('cache lock releases on unmount and abandoned queue can be claimed on refresh', async () => {
  const storage = new Storage(), claim = locks();
  const first = await openFitnessCache('user', storage, claim); first.write(snapshot('a')); first.close();
  const second = await openFitnessCache('user', storage, claim); assert.equal(second.read().pending[0].id, 'a'); second.close();
});

test('drained tab recovers orphan queues sequentially without clearing a live tab', async () => {
  const storage = new Storage(), claim = locks();
  const first = await openFitnessCache('user', storage, claim);
  const orphan = await openFitnessCache('user', storage, claim); orphan.write(snapshot('orphan'));
  const live = await openFitnessCache('user', storage, claim); live.write(snapshot('live')); orphan.close();
  const recovered: string[] = [];
  assert(await first.recoverNext?.(data => { recovered.push(data.pending[0].id); return true; }));
  assert.deepEqual(recovered, ['orphan']); assert.equal(live.read().pending[0].id, 'live');
  first.close(); live.close();
});

test('failed cache migration never removes legacy queue', async () => {
  const storage = new Storage(); storage.setItem('personal-fitness-pending:user', JSON.stringify(snapshot('a').pending));
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(openFitnessCache('user', storage, locks()));
  assert(storage.getItem('personal-fitness-pending:user'));
});

test('corrupted legacy queue is preserved instead of replaced with an empty queue', async () => {
  const storage = new Storage(); storage.setItem('personal-fitness-pending:user', '{broken');
  await assert.rejects(openFitnessCache('user', storage, locks()));
  assert.equal(storage.getItem('personal-fitness-pending:user'), '{broken');
});

test('cache is isolated per authenticated account', async () => {
  const storage = new Storage(), claim = locks();
  const user = await openFitnessCache('user', storage, claim); user.write(snapshot('private')); user.close();
  const other = await openFitnessCache('other', storage, claim);
  assert.deepEqual(other.read(), { data: null, pending: [] }); other.close();
});

test('new account without completed onboarding can still open its offline snapshot', async () => {
  const storage = new Storage(), claim = locks(); const cache = await openFitnessCache('user', storage, claim);
  cache.write({ data: initialData('user'), pending: [] }); cache.close();
  const reloaded = await openFitnessCache('user', storage, claim);
  assert.equal(reloaded.read().data?.profile.onboarded, false); reloaded.close();
});
