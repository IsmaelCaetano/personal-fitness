import type { Exercise } from "./model";

const tokens = (value: string) =>
  new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[,/+·]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );

export function suggestAlternativeExerciseIds(
  exerciseId: string,
  exercises: Exercise[],
  limit = 3,
) {
  const source = exercises.find((exercise) => exercise.id === exerciseId);
  if (!source || /não definido|condicionamento|mobilidade/i.test(source.muscle))
    return [];
  const secondary = tokens(source.secondary);
  const ranked = exercises
    .filter(
      (exercise) =>
        exercise.id !== source.id && exercise.muscle === source.muscle,
    )
    .map((exercise) => ({
      exercise,
      score:
        (exercise.equipment === source.equipment ? 25 : 0) +
        [...tokens(exercise.secondary)].filter((item) => secondary.has(item))
          .length *
          10,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.exercise.name.localeCompare(b.exercise.name, "pt-BR"),
    );
  const selected: Exercise[] = [];
  const closest = ranked.find(
    (item) => item.exercise.equipment === source.equipment,
  );
  if (closest) selected.push(closest.exercise);
  const different = ranked.find(
    (item) => item.exercise.equipment !== source.equipment,
  );
  if (different) selected.push(different.exercise);
  for (const item of ranked)
    if (
      selected.length < limit &&
      !selected.some((exercise) => exercise.id === item.exercise.id)
    )
      selected.push(item.exercise);
  return selected.slice(0, limit).map((exercise) => exercise.id);
}

export function alternativesFor(
  exerciseId: string,
  saved: string[] | undefined,
  exercises: Exercise[],
) {
  const valid = (saved ?? []).filter(
    (id) =>
      id !== exerciseId && exercises.some((exercise) => exercise.id === id),
  );
  return valid.length
    ? valid
    : suggestAlternativeExerciseIds(exerciseId, exercises);
}
