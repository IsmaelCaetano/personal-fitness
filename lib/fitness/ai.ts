import { z } from "zod";
import { newId, routineSchema, type Exercise, type Routine } from "./model";
import { suggestAlternativeExerciseIds } from "./recommendations";

export const workoutBriefSchema = z.object({
  style: z.enum(["automatico", "hibrido", "full-body", "upper-lower", "abc", "ppl"]),
  days: z.number().int().min(1).max(7),
  minutes: z.number().int().min(20).max(180),
  experience: z.enum(["iniciante", "intermediario", "avancado"]),
  equipment: z.enum(["academia", "casa-halteres", "peso-corporal", "personalizado"]),
  equipmentNotes: z.string().max(500),
  cardio: z.enum(["corrida", "bike", "eliptico", "remo", "sem-preferencia"]),
  limitations: z.string().max(1000),
  preferences: z.string().max(1500),
});

const generatedExerciseSchema = z.object({
  exerciseId: z.string().min(1).max(200),
  sets: z.number().int().min(1).max(10),
  minReps: z.number().int().min(1).max(100),
  maxReps: z.number().int().min(1).max(100),
  rest: z.number().int().min(0).max(600),
  notes: z.string().max(1000),
  targetType: z.enum(["reps", "minutes", "seconds", "meters", "instruction"]).optional(),
  targetText: z.string().max(120).optional(),
  loadText: z.string().max(120).optional(),
  alternativeExerciseIds: z.array(z.string().min(1).max(200)).max(4).optional(),
});

const generatedRoutineSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(180),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  color: z.enum(["lime", "purple", "blue", "amber"]),
  exercises: z.array(generatedExerciseSchema).min(1).max(20),
});

export const generatedProgramSchema = z.object({
  title: z.string().min(1).max(100),
  rationale: z.array(z.string().min(1).max(280)).min(2).max(6),
  progression: z.array(z.string().min(1).max(280)).min(2).max(6),
  warnings: z.array(z.string().min(1).max(280)).max(5),
  routines: z.array(generatedRoutineSchema).min(1).max(7),
});

export type WorkoutBrief = z.infer<typeof workoutBriefSchema>;
export type GeneratedProgram = z.infer<typeof generatedProgramSchema>;

export function validateGeneratedProgram(program: GeneratedProgram, brief: WorkoutBrief, exercises: Exercise[]): string | null {
  const catalog = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const days = program.routines.flatMap((routine) => routine.days);
  if (days.length !== brief.days || new Set(days).size !== brief.days || program.routines.some((routine) => !routine.days.length))
    return "O plano não respeitou a quantidade de dias. Gere novamente.";
  if (program.routines.some((routine) => routine.exercises.some((plan) =>
    !catalog.has(plan.exerciseId) || plan.maxReps < plan.minReps
  ))) return "O plano contém exercícios ou substituições inválidos. Gere novamente.";
  if (brief.style === "hibrido" && !program.routines.some((routine) => routine.exercises.some((plan) => catalog.get(plan.exerciseId)?.muscle === "Cardio")))
    return "O plano híbrido precisa incluir atividade cardiovascular. Gere novamente.";
  return null;
}

export function compileGeneratedProgram(program: GeneratedProgram, exercises: Exercise[]): Routine[] {
  const validIds = new Set(exercises.map((exercise) => exercise.id));
  return program.routines.map((routine) => {
    const compiled: Routine = {
      id: newId(),
      name: routine.name,
      description: routine.description,
      days: [...new Set(routine.days)],
      color: routine.color,
      exercises: routine.exercises.map((plan) => {
        if (!validIds.has(plan.exerciseId)) throw new Error("A IA sugeriu um exercício fora da biblioteca. Gere novamente.");
        return {
          id: newId(),
          exerciseId: plan.exerciseId,
          alternativeExerciseIds: suggestAlternativeExerciseIds(plan.exerciseId, exercises),
          sets: plan.sets,
          minReps: plan.minReps,
          maxReps: Math.max(plan.minReps, plan.maxReps),
          rest: plan.rest,
          notes: plan.notes,
          targetType: plan.targetType ?? "reps",
          targetText: plan.targetText ?? `${plan.minReps}-${plan.maxReps} repetições`,
          loadText: plan.loadText,
          suggestedWeight: null,
        };
      }),
    };
    return routineSchema.parse(compiled);
  });
}
