import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackPayloadSchema } from '../lib/fitness/feedback';
const draft = { trainerId:'a88d54c6-e7be-4d17-9876-3f0d12c5b783', routineId:'d9cd4210-aa33-4954-a3e4-bc7460481e0a', category:'replacement', message:'Prefiro fazer uma remada em outra máquina.' };
test('feedback requires a valid personal, category and bounded message', () => {
  assert(feedbackPayloadSchema.safeParse(draft).success);
  assert(!feedbackPayloadSchema.safeParse({...draft,trainerId:'other-student'}).success);
  assert(!feedbackPayloadSchema.safeParse({...draft,category:'permission_change'}).success);
  assert(!feedbackPayloadSchema.safeParse({...draft,message:'   '}).success);
  assert(!feedbackPayloadSchema.safeParse({...draft,message:'a'.repeat(2001)}).success);
});
