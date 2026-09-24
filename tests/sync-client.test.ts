import test from 'node:test';
import assert from 'node:assert/strict';
import { FitnessSyncClient, SyncHttpError, type SyncCache, type SyncSnapshot, type SyncTransport } from '../lib/fitness/sync-client';
import { applyChange, type Attempt } from '../lib/fitness/sync';
import { initialData } from '../lib/fitness/seed';
import type { Routine } from '../lib/fitness/model';

const routine = (id = 'a', name = id): Routine => ({ id, name, description: '', days: [1], exercises: [], color: 'lime' });
class Cache implements SyncCache {
  snapshot: SyncSnapshot = { data: initialData('user'), pending: [] };
  fail = false;
  read() { return structuredClone(this.snapshot); }
  write(next: SyncSnapshot) { if (this.fail) throw new Error('Storage full'); this.snapshot = structuredClone(next); }
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
}
class Server implements SyncTransport {
  data = initialData('user');
  writes: Attempt[] = [];
  loseResponse = false;
  down = false;
  pause?: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> };
  async read() { if (this.down) throw new Error('Offline'); return structuredClone(this.data); }
  async save(item: Attempt) {
    this.writes.push(structuredClone(item));
    const pause = this.pause;
    if (pause) { this.pause = undefined; pause.entered.resolve(); await pause.release.promise; }
    if (this.down) throw new Error('Network error');
    if ((this.data.versions[item.id] ?? 0) !== item.version) throw new SyncHttpError(409, 'Conflict');
    const version = item.version + 1;
    const deletedIds = (this.data.deletedIds ?? []).filter(id => id !== item.id);
    if (item.remove) deletedIds.push(item.id);
    this.data = { ...applyChange(this.data, item), versions: { ...this.data.versions, [item.id]: version }, deletedIds };
    if (this.loseResponse) { this.loseResponse = false; throw new Error('Lost response'); }
    return version;
  }
  hold() { const gate = { entered: deferred(), release: deferred() }; this.pause = gate; return gate; }
}

test('A/K: two rapid creates with different IDs both persist exactly once', async () => {
  const server = new Server(), cache = new Cache(), client = new FitnessSyncClient(cache, server);
  await client.load();
  client.mutate('routine', routine('a')); client.mutate('routine', routine('b'));
  await Promise.all([client.flush(), client.flush()]);
  assert.deepEqual(server.data.routines.map(r => r.id), ['a', 'b']);
  assert.equal(server.writes.length, 2); assert.equal(cache.snapshot.pending.length, 0);
});

test('B/M: edits during flight keep the latest value, advance version and preserve other IDs', async () => {
  const server = new Server(), client = new FitnessSyncClient(new Cache(), server);
  await client.load(); client.mutate('routine', routine());
  const gate = server.hold(), flushing = client.flush(); await gate.entered.promise;
  client.mutate('routine', routine('a', 'second')); client.mutate('routine', routine('a', 'third'));
  client.mutate('routine', routine('b'));
  gate.release.resolve(); await flushing;
  assert.equal(server.data.routines.find(r => r.id === 'a')?.name, 'third');
  assert.equal(server.data.versions.a, 2); assert.equal(server.data.versions.b, 1);
  assert.equal(client.state.status, 'saved');
});

for (const source of ['C: week import', 'D: reviewed AI program']) test(`${source}: multiple routines use the same queue without loss`, async () => {
  const server = new Server(), client = new FitnessSyncClient(new Cache(), server);
  await client.load();
  for (let n = 0; n < 12; n++) client.mutate('routine', routine(String(n)));
  await client.flush(); assert.equal(server.data.routines.length, 12); assert.equal(server.writes.length, 12);
});

for (const source of ['E: two tabs', 'F: two devices']) test(`${source}: real conflict requires choice and does not block unrelated writes`, async () => {
  const server = new Server();
  const a = new FitnessSyncClient(new Cache(), server), b = new FitnessSyncClient(new Cache(), server);
  await a.load(); await b.load();
  a.mutate('routine', routine('a', 'device A')); b.mutate('routine', routine('a', 'device B'));
  b.mutate('routine', routine('b')); await a.flush(); await b.flush();
  assert.equal(b.state.conflict, true); assert.equal(server.data.versions.b, 1);
  assert.equal(b.state.data?.routines.find(r => r.id === 'a')?.name, 'device B');
  assert.equal(server.data.routines.find(r => r.id === 'a')?.name, 'device A');
  await b.resolveConflict('local');
  assert.equal(server.data.routines.find(r => r.id === 'a')?.name, 'device B');
  assert.equal(b.state.status, 'saved');
});

test('G/H/J: lost response and retry after reload acknowledge frozen request before newer edit', async () => {
  const server = new Server(), cache = new Cache(), client = new FitnessSyncClient(cache, server);
  await client.load(); client.mutate('routine', routine('a', 'sent'));
  const gate = server.hold(); server.loseResponse = true;
  const flushing = client.flush(); await gate.entered.promise;
  client.mutate('routine', routine('a', 'newer')); gate.release.resolve(); await flushing;
  assert.equal((cache.snapshot.pending[0].attempt?.entity as Routine).name, 'sent');
  client.dispose(); const reloaded = new FitnessSyncClient(cache, server); await reloaded.load();
  assert.equal(reloaded.state.conflict, false); assert.equal(server.data.versions.a, 2);
  assert.equal(server.data.routines[0].name, 'newer'); assert.equal(cache.snapshot.pending.length, 0);
});

test('I: choosing cloud resolves only conflicted entity and keeps another pending creation', async () => {
  const server = new Server(), cache = new Cache(), client = new FitnessSyncClient(cache, server);
  await client.load(); client.mutate('routine', routine('a', 'local'));
  await server.save({ resource: 'routine', id: 'a', entity: routine('a', 'cloud'), version: 0, stamp: 1 });
  await client.flush(); client.mutate('routine', routine('b'));
  await client.resolveConflict('cloud');
  assert.equal(server.data.routines.find(r => r.id === 'a')?.name, 'cloud');
  assert.equal(server.data.versions.b, 1); assert.equal(cache.snapshot.pending.length, 0);
});

test('L: identical duplicate create with same ID does not duplicate an entity', async () => {
  const server = new Server();
  const a = new FitnessSyncClient(new Cache(), server), b = new FitnessSyncClient(new Cache(), server);
  await a.load(); await b.load(); a.mutate('routine', routine()); b.mutate('routine', routine());
  await Promise.all([a.flush(), b.flush()]);
  assert.equal(server.data.routines.length, 1); assert.equal(server.data.versions.a, 1);
  assert.equal(b.state.conflict, false); assert.equal(b.state.status, 'saved');
});

test('N/O: offline startup restores queue before new edits; reconnect saves all', async () => {
  const server = new Server(), cache = new Cache(); let online = false;
  const first = new FitnessSyncClient(cache, server, () => online);
  first.mutate('routine', routine()); first.dispose();
  const reloaded = new FitnessSyncClient(cache, server, () => online);
  await reloaded.load(); reloaded.mutate('routine', routine('b')); await reloaded.flush();
  assert.equal(cache.snapshot.pending.length, 2); assert.equal(server.writes.length, 0);
  online = true; await reloaded.flush();
  assert.equal(server.data.routines.length, 2); assert.equal(reloaded.state.status, 'saved');
});

test('network drops before commit; retry retains both the attempted and latest edit', async () => {
  const server = new Server(), client = new FitnessSyncClient(new Cache(), server);
  await client.load(); client.mutate('routine', routine());
  const gate = server.hold(), flushing = client.flush(); await gate.entered.promise;
  server.down = true; client.mutate('routine', routine('a', 'new')); gate.release.resolve(); await flushing;
  assert(client.hasPending()); server.down = false; await client.flush();
  assert.equal(server.data.routines[0].name, 'new'); assert.equal(client.state.conflict, false);
});

test('lost delete response then recreate acknowledges deletion before creating again', async () => {
  const server = new Server(), cache = new Cache(), client = new FitnessSyncClient(cache, server);
  await client.load(); client.mutate('routine', routine()); await client.flush();
  client.mutate('routine', routine(), true); const gate = server.hold(); server.loseResponse = true;
  const flushing = client.flush(); await gate.entered.promise;
  client.mutate('routine', routine('a', 'recreated')); gate.release.resolve(); await flushing;
  await client.flush(); assert.equal(server.data.routines[0].name, 'recreated'); assert.equal(client.state.conflict, false);
  assert.equal(server.data.versions.a, 3);
});

test('deleting a creation before debounce needs no request', async () => {
  const server = new Server(), client = new FitnessSyncClient(new Cache(), server);
  await client.load(); client.mutate('routine', routine()); client.mutate('routine', routine(), true);
  await client.load(); assert.equal(server.writes.length, 0); assert.equal(client.state.status, 'saved');
});

test('reload while GET is in flight cannot replace a newly queued edit', async () => {
  const server = new Server(), cache = new Cache(), gate = deferred();
  const client = new FitnessSyncClient(cache, { ...server, save: item => server.save(item), read: async () => { await gate.promise; return server.read(); } });
  const loading = client.load(); client.mutate('routine', routine()); gate.resolve(); await loading;
  assert.equal(server.data.routines.length, 1); assert.equal(client.state.status, 'saved');
});

test('edits in the same millisecond have distinct acknowledgments', async () => {
  const server = new Server(), cache = new Cache(), client = new FitnessSyncClient(cache, server);
  await client.load(); client.mutate('routine', routine()); const stamp = cache.snapshot.pending[0].stamp;
  client.mutate('routine', routine('a', 'new')); assert(cache.snapshot.pending[0].stamp > stamp);
});

test('cloud changes again before resolution: do not silently overwrite it', async () => {
  const server = new Server(), client = new FitnessSyncClient(new Cache(), server);
  await client.load(); client.mutate('routine', routine('a', 'local'));
  await server.save({ resource: 'routine', id: 'a', entity: routine('a', 'cloud'), version: 0, stamp: 1 });
  await client.flush();
  await server.save({ resource: 'routine', id: 'a', entity: routine('a', 'cloud newer'), version: 1, stamp: 2 });
  await client.resolveConflict('local');
  assert.equal(client.state.conflict, true); assert.equal(server.data.routines[0].name, 'cloud newer');
  await client.resolveConflict('local'); assert.equal(server.data.routines[0].name, 'local');
});

test('storage failure does not report local copy as safe or discard pending memory', async () => {
  const cache = new Cache(), client = new FitnessSyncClient(cache, new Server(), () => false);
  cache.fail = true; client.mutate('routine', routine());
  assert.equal(client.state.localSafe, false); assert(client.hasPending()); assert.match(client.state.error, /Mantenha a página/);
});

test('401 preserves queue and requires a fresh load before retry', async () => {
  const cache = new Cache(), server = new Server(); let expired = true;
  const client = new FitnessSyncClient(cache, { read: () => server.read(), save: item => { if (expired) return Promise.reject(new SyncHttpError(401, 'Entre novamente')); return server.save(item); } });
  await client.load(); client.mutate('routine', routine()); await client.flush();
  assert.equal(cache.snapshot.pending.length, 1); expired = false; await client.load();
  assert.equal(client.state.status, 'saved');
});

test('unreadable cache aborts initialization instead of letting GET overwrite it', () => {
  let writes = 0;
  assert.throws(() => new FitnessSyncClient({ read: () => { throw new Error('Unreadable'); }, write: () => { writes++; } }, new Server()));
  assert.equal(writes, 0);
});

test('server deletion conflicts with offline edit; choosing local restores at a newer version', async () => {
  const server = new Server(), client = new FitnessSyncClient(new Cache(), server);
  await client.load(); client.mutate('routine', routine()); await client.flush();
  client.mutate('routine', routine('a', 'local edit'));
  await server.save({ resource: 'routine', id: 'a', entity: routine(), version: 1, stamp: 1, remove: true });
  await client.flush(); assert.equal(client.state.conflict, true); assert.equal(server.data.routines.length, 0);
  await client.resolveConflict('local');
  assert.equal(server.data.versions.a, 3); assert.equal(server.data.routines[0].name, 'local edit');
});

test('conflict choice waits for an unrelated in-flight save instead of ignoring the click', async () => {
  const server = new Server(), client = new FitnessSyncClient(new Cache(), server);
  await client.load(); client.mutate('routine', routine('a', 'local'));
  await server.save({ resource: 'routine', id: 'a', entity: routine('a', 'cloud'), version: 0, stamp: 1 });
  await client.flush(); client.mutate('routine', routine('b'));
  const gate = server.hold(), saving = client.flush(); await gate.entered.promise;
  const resolving = client.resolveConflict('cloud'); gate.release.resolve(); await saving; await resolving;
  assert.equal(client.state.conflict, false); assert.equal(client.state.status, 'saved');
  assert.equal(client.state.data?.routines.find(r => r.id === 'a')?.name, 'cloud');
});
