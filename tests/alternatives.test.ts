import test from "node:test";
import assert from "node:assert/strict";
import { library } from "../lib/fitness/seed";
import { alternativesFor, alternativesForPlan, rankExerciseAlternatives, suggestAlternativeExerciseIds } from "../lib/fitness/recommendations";

const id = (name: string) => {
  const exercise = library.find((item) => item.name === name);
  assert(exercise, name);
  return exercise.id;
};
const suggestions = (name: string) => suggestAlternativeExerciseIds(id(name), library, 50);

test("lateral raise keeps lateral deltoid stimulus, not shoulder press or rear fly", () => {
  const ranked = suggestions("Elevação lateral");
  assert(ranked.includes(id("Elevação lateral na polia")));
  assert(ranked.includes(id("Elevação lateral na máquina")));
  assert(!ranked.includes(id("Desenvolvimento com halteres")));
  assert(!ranked.includes(id("Crucifixo inverso")));
});
test("shoulder press allows machine/bar and rejects lateral raise", () => {
  const ranked = suggestions("Desenvolvimento com halteres");
  assert(ranked.includes(id("Desenvolvimento de ombros na máquina")));
  assert(ranked.includes(id("Desenvolvimento com barra")));
  assert(!ranked.includes(id("Elevação lateral")));
});
test("rear fly allows reverse pec deck and rejects shoulder press", () => {
  const ranked = suggestions("Crucifixo inverso");
  assert(ranked.includes(id("Reverse pec deck")));
  assert(!ranked.includes(id("Desenvolvimento com halteres")));
});
test("horizontal press prioritizes chest press over fly", () => {
  const ranked = suggestions("Supino reto com barra");
  assert(ranked.includes(id("Chest press")));
  assert(!ranked.includes(id("Crucifixo na máquina")));
});
test("knee extension does not replace squat and biceps curl keeps elbow flexion", () => {
  assert(!suggestions("Agachamento livre").includes(id("Cadeira extensora")));
  assert(suggestions("Rosca direta").includes(id("Rosca direta na polia")));
});
test("equipment filter, no equivalent and old inappropriate saved ids", () => {
  const source = id("Elevação lateral");
  assert.deepEqual(rankExerciseAlternatives(source, library, { equipment: ["Bicicleta"] }), []);
  assert.deepEqual(suggestions("Rosca de punho"), []);
  assert(!alternativesFor(source, [id("Desenvolvimento com halteres")], library).includes(id("Desenvolvimento com halteres")));
});
test("trainer approved list and block override automatic candidates", () => {
  const source = id("Elevação lateral");
  assert.deepEqual(suggestAlternativeExerciseIds(source, library, 3, { approvedIds: [id("Elevação lateral na polia")] }), [id("Elevação lateral na polia")]);
  assert.deepEqual(suggestAlternativeExerciseIds(source, library, 3, { blocked: true }), []);
  assert.deepEqual(suggestAlternativeExerciseIds(source, library, 3, { excludedIds: [id("Elevação lateral na polia")] }).includes(id("Elevação lateral na polia")), false);
});
test('trainer restrictions apply to saved plans even when older suggestions exist', () => {
  const source = id('Elevação lateral');
  const approved = id('Elevação lateral na polia');
  const plan = { id: 'plan', exerciseId: source, sets: 2, minReps: 8, maxReps: 12, rest: 90, notes: '', alternativeExerciseIds: [approved, id('Desenvolvimento com halteres')] };
  assert.deepEqual(alternativesForPlan({ ...plan, substitutionRule: 'approved' }, library), [approved]);
  assert.deepEqual(alternativesForPlan({ ...plan, substitutionRule: 'blocked' }, library), []);
});
test("metadata on new exercise determines compatibility", () => {
  const custom = { ...library[0], id: "custom", name: "Meu movimento", movementPattern: "horizontal_push" as const, targetRegion: "chest_mid", mechanics: "compound" as const };
  assert(suggestAlternativeExerciseIds(id("Supino reto com barra"), [...library, custom], 50).includes(custom.id));
});
