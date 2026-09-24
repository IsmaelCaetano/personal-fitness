import test from 'node:test';
import assert from 'node:assert/strict';
import { coachSetFeedback } from '../lib/fitness/domain';
import type { Plan, WorkoutSet } from '../lib/fitness/model';
const plan: Plan = { id: 'p', exerciseId: 'e', sets: 3, minReps: 8, maxReps: 10, rest: 90, notes: '' };
const set: WorkoutSet = { id: 's', weight: 50, reps: 10, rir: 3, rpe: 7, type: 'normal', status: 'completed', notes: '', completedAt: '2026-09-24T12:00:00Z' };
test('top range and spare reps recommend modest load progression', () => {
  assert.match(coachSetFeedback({plan,set}) ?? '', /aumentar levemente/);
});
test('under range and max effort indicate high load', () => {
  assert.match(coachSetFeedback({plan,set:{...set,reps:7,rir:0,rpe:10}}) ?? '', /alta/);
});
test('inside target near failure holds load', () => {
  assert.match(coachSetFeedback({plan,set:{...set,reps:9,rir:1}}) ?? '', /Mantenha a carga/);
});
test('high RPE overrides top range progression', () => {
  assert.doesNotMatch(coachSetFeedback({plan,set:{...set,rpe:9}}) ?? '', /aumentar/);
});
test('no history establishes baseline; history prompts double progression', () => {
  assert.match(coachSetFeedback({plan,set:{...set,reps:9,rir:2}}) ?? '', /Primeira referência/);
  assert.match(coachSetFeedback({plan,set:{...set,reps:9,rir:2},recent:[set]}) ?? '', /repetições/);
});
test('skip warmup, uncompleted and duration targets', () => {
  assert.equal(coachSetFeedback({plan,set:{...set,status:'pending'}}),null);
  assert.equal(coachSetFeedback({plan,set:{...set,type:'warmup'}}),null);
  assert.equal(coachSetFeedback({plan:{...plan,targetType:'minutes'},set}),null);
});
