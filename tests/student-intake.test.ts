import test from 'node:test';
import assert from 'node:assert/strict';
import { studentIntakeSchema, profileFromStudentIntake } from '../lib/fitness/student-intake';
import { profileSchema } from '../lib/fitness/model';

const intake = {
  height: 175, weight: 77, goals: ['Ganhar massa'], weeklyGoal: 4,
  level: 'intermediario', preferredDuration: 60, preferredDays: [1, 3, 5],
  availableEquipment: ['Halteres', 'Polia'], preferences: 'Treino à tarde',
  limitations: 'Evita saltos',
} as const;

test('trainer intake produces a ready profile owned by the invited student', () => {
  const data = studentIntakeSchema.parse({ ...intake, preferredDays: [...intake.preferredDays], availableEquipment: [...intake.availableEquipment], goals: [...intake.goals] });
  const profile = profileFromStudentIntake('student-uid', 'Ana Lima', data);
  assert(profileSchema.safeParse(profile).success);
  assert.equal(profile.id, 'student-uid');
  assert.equal(profile.name, 'Ana Lima');
  assert.equal(profile.onboarded, true);
  assert.equal(profile.weeklyGoal, 4);
  assert.equal(profile.limitations, 'Evita saltos');
});

test('invalid or privileged intake cannot produce a student profile', () => {
  const valid = { ...intake, preferredDays: [1], availableEquipment: ['Halteres'], goals: ['Ganhar massa'] };
  assert(!studentIntakeSchema.safeParse({ ...valid, goals: [] }).success);
  assert(!studentIntakeSchema.safeParse({ ...valid, weeklyGoal: 8 }).success);
  assert(!studentIntakeSchema.safeParse({ ...valid, height: 0 }).success);
  assert(!studentIntakeSchema.safeParse({ ...valid, role: 'trainer' }).success);
  assert(!studentIntakeSchema.safeParse({ ...valid, onboarded: false }).success);
});
