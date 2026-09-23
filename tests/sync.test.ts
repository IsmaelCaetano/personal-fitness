import test from 'node:test';
import assert from 'node:assert/strict';
import { initialData } from '../lib/fitness/seed';
import { reconcilePending, type PendingChange } from '../lib/fitness/sync';
import type { Routine } from '../lib/fitness/model';

const routine: Routine = { id: 'new-routine', name: 'Treino híbrido', description: 'Força e cardio', days: [1], color: 'lime', exercises: [] };
const change: PendingChange = { id: routine.id, resource: 'routine', entity: routine, version: 0, stamp: 1 };

test('uma resposta perdida após salvar a rotina não cria conflito ao entrar novamente', () => {
  const server = { ...initialData('user'), routines: [{ ...routine, days: [1] }], versions: { [routine.id]: 1 } };
  const result = reconcilePending(server, [{ ...change, entity: { ...routine, days: [1] } }]);
  assert.deepEqual(result, { remaining: [], conflicts: [] });
});

test('uma edição diferente na nuvem exige escolha e preserva outros registros pendentes', () => {
  const server = { ...initialData('user'), routines: [{ ...routine, name: 'Alterado em outra aba' }], versions: { [routine.id]: 2 } };
  const second = { ...change, id: 'outra-rotina', entity: { ...routine, id: 'outra-rotina' }, stamp: 2 };
  const result = reconcilePending(server, [{ ...change, version: 1 }, second]);
  assert.deepEqual(result.remaining, [{ ...change, version: 1 }, second]);
  assert.deepEqual(result.conflicts, [{ ...change, version: 1 }]);
});

test('exclusão já confirmada no servidor não é reenviada', () => {
  const result = reconcilePending(initialData('user'), [{ ...change, remove: true, version: 3 }]);
  assert.deepEqual(result, { remaining: [], conflicts: [] });
});
