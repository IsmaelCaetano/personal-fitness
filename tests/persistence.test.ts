import test from 'node:test';
import assert from 'node:assert/strict';
import { readFitnessData, saveFitnessResource, type FitnessRow } from '../lib/fitness/persistence';
import { initialData } from '../lib/fitness/seed';
import type { Routine } from '../lib/fitness/model';

type Row = FitnessRow & { user_id: string };
const routine: Routine = { id: 'a', name: 'A', description: '', days: [1], color: 'lime', exercises: [] };

// An atomic in-memory stand-in for PostgREST. Tests run the production query
// builder, including user/resource/version predicates and unique constraints.
// This is not a replacement for the separate production RLS validation.
function database() {
  const rows = new Map<string, Row>();
  let beforeBootstrap: (() => void) | undefined;
  const key = (row: Row) => `${row.user_id}:${row.id}`;
  const api = {
    from() {
      let action = 'read', payload: Partial<Row> = {}, ignoreDuplicates = false, single = false;
      const filters: Array<[string, unknown]> = [];
      let ids: string[] | undefined;
      const query = {
        select() { return query; },
        eq(name: string, value: unknown) { filters.push([name, value]); return query; },
        in(_name: string, value: string[]) { ids = value; return query; },
        delete() { action = 'delete'; return query; },
        update(value: Partial<Row>) { action = 'update'; payload = value; return query; },
        insert(value: Partial<Row>) { action = 'insert'; payload = value; return query; },
        upsert(value: Partial<Row>, options: { ignoreDuplicates?: boolean }) { action = 'upsert'; payload = value; ignoreDuplicates = !!options.ignoreDuplicates; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve: (value: { data: Row | Row[] | null; error: { code: string } | null }) => unknown) {
          if (action === 'upsert') { beforeBootstrap?.(); beforeBootstrap = undefined; }
          let result: Row[] = [];
          if (action === 'insert' || action === 'upsert') {
            const row = payload as Row, exists = rows.has(key(row));
            if (exists && action === 'insert') return Promise.resolve(resolve({ data: null, error: { code: '23505' } }));
            if (!exists || !ignoreDuplicates) { rows.set(key(row), structuredClone(row)); result = [row]; }
          } else {
            for (const [id, row] of rows) {
              if (!filters.every(([name, value]) => (row as unknown as Record<string, unknown>)[name] === value) || (ids && !ids.includes(row.id))) continue;
              if (action === 'delete') rows.delete(id);
              if (action === 'update') { const updated = { ...row, ...payload }; rows.set(id, updated); result.push(updated); }
              else result.push(row);
            }
          }
          return Promise.resolve(resolve({ data: structuredClone(single ? result[0] ?? null : result), error: null }));
        },
      };
      return query;
    },
  };
  return { client: api as unknown as Parameters<typeof readFitnessData>[0], rows,
    seed: (row: Row) => rows.set(key(row), structuredClone(row)),
    beforeBootstrap: (callback: () => void) => { beforeBootstrap = callback; },
  };
}

test('bootstrap does not overwrite onboarding completed concurrently', async () => {
  const db = database();
  const profile = { ...initialData('user').profile, name: 'Nome editado', goals: ['Força'], onboarded: true };
  db.beforeBootstrap(() => { db.seed({ user_id: 'user', id: 'user', resource: 'profile', payload: profile, version: 2 }); });
  const result = await readFitnessData(db.client, 'user', 'Nome inicial');
  assert.equal(result.profile.name, 'Nome editado'); assert.equal(result.profile.onboarded, true); assert.equal(result.versions.user, 2);
});

test('bootstrap retains routines and history already present when profile is missing', async () => {
  const db = database(); db.seed({ user_id: 'user', id: 'a', resource: 'routine', payload: routine, version: 4 });
  const result = await readFitnessData(db.client, 'user', 'Nome');
  assert.deepEqual(result.routines, [routine]); assert.equal(result.versions.a, 4); assert.equal(result.versions.user, 1);
});

test('two initial reads create one profile without version reset', async () => {
  const db = database(); const result = await Promise.all([readFitnessData(db.client, 'user', 'Nome'), readFitnessData(db.client, 'user', 'Nome')]);
  assert.equal(db.rows.size, 1); assert.equal(result[0].versions.user, 1); assert.equal(result[1].versions.user, 1);
});

test('two inserts with same ID produce one success and one 23505 conflict', async () => {
  const db = database(); const change = { id: 'a', resource: 'routine' as const, entity: routine, version: 0 };
  assert.deepEqual(await Promise.all([saveFitnessResource(db.client, 'user', change), saveFitnessResource(db.client, 'user', change)]), [1, null]);
  assert.equal(db.rows.size, 1);
});

test('two simultaneous updates at same version cannot both succeed', async () => {
  const db = database(); const change = { id: 'a', resource: 'routine' as const, entity: routine, version: 0 };
  await saveFitnessResource(db.client, 'user', change);
  const results = await Promise.all([saveFitnessResource(db.client, 'user', { ...change, version: 1 }), saveFitnessResource(db.client, 'user', { ...change, version: 1, entity: { ...routine, name: 'B' } })]);
  assert.deepEqual(results, [2, null]); assert.equal((db.rows.get('user:a')?.payload as Routine).name, 'A');
});

test('different IDs persist independently and same ID is scoped to user', async () => {
  const db = database();
  const change = { id: 'a', resource: 'routine' as const, entity: routine, version: 0 };
  const results = await Promise.all([saveFitnessResource(db.client, 'user', change), saveFitnessResource(db.client, 'other', change), saveFitnessResource(db.client, 'user', { ...change, id: 'b', entity: { ...routine, id: 'b' } })]);
  assert.deepEqual(results, [1, 1, 1]); assert.equal(db.rows.size, 3);
});

test('delete CAS checks authenticated user, resource type and version', async () => {
  const db = database(); const change = { id: 'a', resource: 'routine' as const, entity: routine, version: 0 };
  await saveFitnessResource(db.client, 'user', change);
  assert.equal(await saveFitnessResource(db.client, 'other', { ...change, remove: true, version: 1 }), null);
  assert.equal(await saveFitnessResource(db.client, 'user', { ...change, resource: 'exercise', remove: true, version: 1 }), null);
  assert.equal(await saveFitnessResource(db.client, 'user', { ...change, remove: true, version: 2 }), null);
  assert.equal(db.rows.size, 1);
  assert.equal(await saveFitnessResource(db.client, 'user', { ...change, remove: true, version: 1 }), 2);
  assert.deepEqual(db.rows.get('user:a')?.payload, {});
});

test('deleting and restoring an ID never reuses a version accepted by a stale device', async () => {
  const db = database(); const change = { id: 'a', resource: 'routine' as const, entity: routine, version: 0 };
  const first = await saveFitnessResource(db.client, 'user', change);
  const deleted = await saveFitnessResource(db.client, 'user', { ...change, remove: true, version: first! });
  const restored = await saveFitnessResource(db.client, 'user', { ...change, version: deleted!, entity: { ...routine, name: 'Restored' } });
  assert.notEqual(restored, first);
  assert.equal(await saveFitnessResource(db.client, 'user', { ...change, version: first!, entity: { ...routine, name: 'Stale device' } }), null);
});

test('GET hides deleted payloads but returns their versions for offline conflict detection', async () => {
  const db = database();
  await readFitnessData(db.client, 'user', 'Nome');
  await saveFitnessResource(db.client, 'user', { id: 'a', resource: 'routine', entity: routine, version: 0 });
  await saveFitnessResource(db.client, 'user', { id: 'a', resource: 'routine', remove: true, version: 1 });
  const result = await readFitnessData(db.client, 'user', 'Nome');
  assert.deepEqual(result.routines, []); assert.deepEqual(result.deletedIds, ['a']); assert.equal(result.versions.a, 2);
});
