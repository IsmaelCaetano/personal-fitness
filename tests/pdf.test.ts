import test from "node:test";
import assert from "node:assert/strict";
import { toWorkoutPdfModel } from "../lib/fitness/pdf";
import { initialData, library } from "../lib/fitness/seed";
import type { Routine, Session } from "../lib/fitness/model";

const routine: Routine = { id: 'private-routine-id', name: 'Força A', description: 'Progressão dupla por 6 semanas', days: [1], color: 'lime', exercises: [{ id: 'private-plan-id', exerciseId: library[0].id, sets: 3, minReps: 6, maxReps: 8, rest: 180, notes: 'RIR 2; manter o movimento controlado', suggestedWeight: 70 }] };
test('PDF view model includes athlete, goal, plan, actual history and no internal IDs', () => {
  const data = initialData('private-user-id');
  data.profile = { ...data.profile, name: 'Atleta', goals: ['Força'], weeklyGoal: 3 };
  const completed: Session = { id: 'private-session-id', routineId: routine.id, name: 'Força A', startedAt: '2026-09-22T12:00:00.000Z', finishedAt: '2026-09-22T13:00:00.000Z', status: 'completed', notes: '', isDemo: false, exercises: [{ id: 'entry', exercise: library[0], plan: routine.exercises[0], sets: [{ id: 'set', weight: 75, reps: 8, rir: 2, rpe: null, type: 'normal', status: 'completed', notes: '', completedAt: '2026-09-22T12:30:00.000Z' }] }] };
  data.sessions = [completed];
  const model = toWorkoutPdfModel(data, [routine], new Date('2026-09-24T00:00:00Z'));
  assert.equal(model.athlete, 'Atleta');
  assert.equal(model.objective, 'Força');
  assert.equal(model.weeklyGoal, 3);
  assert.equal(model.routines[0].rows[0].lastLoad, '75 kg');
  assert.equal(model.routines[0].rows[0].effort, 'RIR 2');
  assert.equal(model.routines[0].rows[0].rest, '180s');
  assert(!JSON.stringify(model).includes('private-'));
});
