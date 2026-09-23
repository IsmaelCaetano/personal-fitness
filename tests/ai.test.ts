import test from "node:test";
import assert from "node:assert/strict";
import { compileGeneratedProgram, generatedProgramSchema, validateGeneratedProgram, workoutBriefSchema } from "../lib/fitness/ai";
import { profileSchema } from "../lib/fitness/model";
import { initialData, library } from "../lib/fitness/seed";

const brief = workoutBriefSchema.parse({ style: "hibrido", days: 2, minutes: 45, experience: "iniciante", equipment: "academia", equipmentNotes: "Esteira e máquinas", cardio: "corrida", limitations: "", preferences: "" });
const program = generatedProgramSchema.parse({
  title: "Força e corrida",
  rationale: ["Dois dias com foco em adaptação.", "A sessão de corrida segue a força em dias separados."],
  progression: ["Aumente repetições antes da carga.", "Amplie tempo de corrida gradualmente."],
  warnings: [],
  routines: [
    { name: "Força", description: "Movimentos principais", days: [1], color: "lime", exercises: [{ exerciseId: "base-18", sets: 2, minReps: 8, maxReps: 12, rest: 120, notes: "2 RIR", alternativeExerciseIds: ["base-17"] }] },
    { name: "Corrida leve", description: "Cardio progressivo", days: [4], color: "blue", exercises: [{ exerciseId: "base-31", sets: 1, minReps: 25, maxReps: 30, rest: 0, notes: "Ritmo confortável", targetType: "minutes", targetText: "25–30 min" }] },
  ],
});

test("plan is rejected when it ignores weekly availability or hybrid cardio", () => {
  assert.equal(validateGeneratedProgram(program, brief, library), null);
  assert.match(validateGeneratedProgram({ ...program, routines: program.routines.map((routine) => ({ ...routine, days: [1] })) }, brief, library) ?? "", /quantidade de dias/);
  assert.match(validateGeneratedProgram({ ...program, routines: [program.routines[0]] }, { ...brief, days: 1 }, library) ?? "", /cardiovascular/);
});

test("unknown exercise and unrelated substitution cannot enter generated plan", () => {
  const wrongExercise = { ...program, routines: [{ ...program.routines[0], exercises: [{ ...program.routines[0].exercises[0], exerciseId: "outside" }] }, program.routines[1]] };
  assert.match(validateGeneratedProgram(wrongExercise, brief, library) ?? "", /inválidos/);
  const wrongAlternative = { ...program, routines: [{ ...program.routines[0], exercises: [{ ...program.routines[0].exercises[0], alternativeExerciseIds: ["base-0"] }] }, program.routines[1]] };
  assert.match(validateGeneratedProgram(wrongAlternative, brief, library) ?? "", /inválidos/);
  const compiled = compileGeneratedProgram(program, library);
  assert.equal(compiled[1].exercises[0].targetType, "minutes");
  assert.equal(compiled[0].exercises[0].suggestedWeight, null);
});

test("frequency is required for completed onboarding profile", () => {
  const original = initialData("test-user").profile;
  const completed = { ...original, height: 175, weight: 80, goals: ["Aumentar força"], onboarded: true, weeklyGoal: 3 };
  assert(profileSchema.safeParse(completed).success);
  assert(!profileSchema.safeParse({ ...completed, weeklyGoal: 0 }).success);
  assert(!profileSchema.safeParse({ ...completed, weeklyGoal: 8 }).success);
});
