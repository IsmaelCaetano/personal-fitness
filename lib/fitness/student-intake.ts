import { z } from 'zod';
import { profileSchema, type Profile } from './model';

// Collected by the trainer before inviting a student. The student never needs
// to answer onboarding questions to activate a new, trainer-managed account.
export const studentIntakeSchema = z.object({
  height: z.number().finite().min(80).max(250),
  weight: z.number().finite().min(20).max(500),
  goals: z.array(z.string().trim().min(1).max(100)).min(1).max(5),
  weeklyGoal: z.number().int().min(1).max(7),
  level: z.enum(['iniciante', 'intermediario', 'avancado']),
  preferredDuration: z.number().int().min(20).max(180),
  preferredDays: z.array(z.number().int().min(0).max(6)).max(7),
  availableEquipment: z.array(z.string().trim().min(1).max(60)).max(30),
  preferences: z.string().trim().max(1500),
  limitations: z.string().trim().max(1000),
}).strict();

export type StudentIntake = z.infer<typeof studentIntakeSchema>;

export function profileFromStudentIntake(userId: string, name: string, intake: StudentIntake): Profile {
  return profileSchema.parse({
    id: userId, name, ...studentIntakeSchema.parse(intake), unit: 'kg', rest: 90,
    theme: 'dark', onboarded: true,
  });
}
