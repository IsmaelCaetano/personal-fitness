import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { exerciseDemoIds } from '../features/fitness/exercise-media';
import { library } from '../lib/fitness/seed';

test('every built-in exercise demonstration can be cached offline', () => {
  const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const cached = new Set([...worker.matchAll(/'([\w-]+)'/g)].map((match) => match[1]));
  for (const [id, source] of Object.entries(exerciseDemoIds)) {
    assert(library.some((exercise) => exercise.id === id), `Missing library exercise: ${id}`);
    assert(cached.has(source), `Demonstration ${source} for ${id} is not pre-cached`);
  }
  assert(Object.keys(exerciseDemoIds).length >= 45);
});
