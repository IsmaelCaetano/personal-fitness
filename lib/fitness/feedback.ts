import { z } from 'zod';
export const feedbackPayloadSchema = z.object({
  trainerId: z.string().uuid(),
  routineId: z.string().uuid().optional(),
  sessionId: z.string().min(1).max(200).optional(),
  exerciseId: z.string().min(1).max(200).optional(),
  category: z.enum(['too_heavy','too_light','discomfort','equipment','dislike','replacement','comment']),
  message: z.string().trim().min(1).max(2000),
});
