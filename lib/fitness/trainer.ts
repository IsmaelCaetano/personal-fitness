import { z } from 'zod';
import { routineSchema } from './model';
export const trainerRoutinePayload = z.object({ assignmentId: z.string().uuid().optional(), studentId: z.string().uuid(), routine: routineSchema });

export type TrainerRelationship = { trainerId: string; studentId: string; status: 'invited' | 'active' | 'paused' | 'ended' };
export function canAccessStudent(actorId: string, relationship: TrainerRelationship, action: 'read' | 'prescribe' | 'execute') {
  if (relationship.status !== 'active') return false;
  if (action === 'execute') return actorId === relationship.studentId;
  return actorId === relationship.trainerId;
}
