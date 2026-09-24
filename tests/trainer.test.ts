import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessStudent } from '../lib/fitness/trainer';
const active = { trainerId: 'trainer-a', studentId: 'student-a', status: 'active' as const };
test('trainer A reads and prescribes only student A; other trainer and student cannot edit', () => {
  assert(canAccessStudent('trainer-a',active,'read'));
  assert(canAccessStudent('trainer-a',active,'prescribe'));
  assert(!canAccessStudent('trainer-b',active,'read'));
  assert(!canAccessStudent('student-a',active,'prescribe'));
  assert(!canAccessStudent('student-b',active,'execute'));
  assert(canAccessStudent('student-a',active,'execute'));
});
test('ended and paused relationships do not grant new access', () => {
  assert(!canAccessStudent('trainer-a',{...active,status:'ended'},'read'));
  assert(!canAccessStudent('trainer-a',{...active,status:'paused'},'prescribe'));
});
