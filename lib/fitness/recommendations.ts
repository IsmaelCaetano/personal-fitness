import type { Exercise } from "./model";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Keep legacy exercises valid and decline unknown movements instead of guessing. */
export function classifyExercise(exercise: Exercise) {
  if (exercise.movementPattern && exercise.targetRegion && exercise.mechanics)
    return { pattern: exercise.movementPattern, region: exercise.targetRegion, mechanics: exercise.mechanics, laterality: exercise.laterality ?? "either" };
  const name = normalize(exercise.name);
  const match = (pattern: NonNullable<Exercise["movementPattern"]>, region: string, mechanics: NonNullable<Exercise["mechanics"]> = "isolation") => ({ pattern, region, mechanics, laterality: (exercise.laterality ?? (/unilateral|um braco|uma perna|alternad/.test(name) ? "unilateral" : "either")) as "bilateral" | "unilateral" | "either" });
  if (/crucifixo inverso|reverse pec deck|face pull/.test(name)) return match("rear_delt_fly", "shoulder_posterior");
  if (/elevacao lateral|lateral raise/.test(name)) return match("lateral_raise", "shoulder_lateral");
  if (/desenvolvimento|shoulder press|arnold press/.test(name)) return match("vertical_push", "shoulder_anterior", "compound");
  if (/supino inclinado|chest press inclinado/.test(name)) return match("horizontal_push", "chest_upper", "compound");
  if (/supino|chest press|flexao de bracos/.test(name)) return match("horizontal_push", "chest_mid", "compound");
  if (/crossover|crucifixo|peck deck/.test(name)) return match("horizontal_push", "chest_mid");
  if (/puxada|pulldown|barra fixa/.test(name)) return match("vertical_pull", "back_lat", "compound");
  if (/remada/.test(name)) return match("horizontal_pull", "back_upper", "compound");
  if (/rosca(?! de punho)|biceps curl/.test(name)) return match("elbow_flexion", "biceps");
  if (/triceps/.test(name)) return match("elbow_extension", "triceps");
  if (/agachamento|leg press|afundo|split squat/.test(name)) return match("knee_dominant", "quadriceps", "compound");
  if (/cadeira extensora/.test(name)) return match("knee_dominant", "quadriceps");
  if (/mesa flexora|cadeira flexora|leg curl/.test(name)) return match("knee_flexion", "hamstrings");
  if (/stiff|levantamento romeno|terra romeno/.test(name)) return match("hip_hinge", "hamstrings", "compound");
  if (/elevacao pelvica|hip thrust|ponte de gluteos|extensao de quadril/.test(name)) return match("hip_extension", "glutes", /extensao de quadril/.test(name) ? "isolation" : "compound");
  if (/panturrilha/.test(name)) return match("calf_raise", "calves");
  if (/abdutora/.test(name)) return match("hip_abduction", "glutes");
  if (/abdominal/.test(name)) return match("core_flexion", "abs");
  if (/prancha/.test(name)) return match("anti_rotation", "core");
  return null;
}

export type AlternativeOptions = {
  equipment?: string[];
  excludedIds?: string[];
  approvedIds?: string[];
  blocked?: boolean;
};

export function rankExerciseAlternatives(sourceId: string, exercises: Exercise[], options: AlternativeOptions = {}) {
  if (options.blocked) return [];
  const source = exercises.find((exercise) => exercise.id === sourceId);
  const original = source && classifyExercise(source);
  if (!source || !original) return [];
  const excluded = new Set(options.excludedIds ?? []);
  const approved = options.approvedIds && new Set(options.approvedIds);
  return exercises.flatMap((exercise) => {
    if (exercise.id === sourceId || excluded.has(exercise.id) || (approved && !approved.has(exercise.id))) return [];
    if (options.equipment?.length && !options.equipment.some((available) => normalize(available) === normalize(exercise.equipment))) return [];
    const candidate = classifyExercise(exercise);
    if (!candidate || candidate.pattern !== original.pattern || candidate.region !== original.region || candidate.mechanics !== original.mechanics) return [];
    if (original.laterality !== "either" && candidate.laterality !== "either" && original.laterality !== candidate.laterality) return [];
    const score = 90 + (exercise.equipment === source.equipment ? 10 : 0) + (candidate.laterality === original.laterality ? 3 : 0);
    return [{ exercise, score }];
  }).sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "pt-BR"));
}

export function suggestAlternativeExerciseIds(sourceId: string, exercises: Exercise[], limit = 3, options: AlternativeOptions = {}) {
  return rankExerciseAlternatives(sourceId, exercises, options).slice(0, limit).map(({ exercise }) => exercise.id);
}

export function alternativesFor(sourceId: string, saved: string[] | undefined, exercises: Exercise[], options: AlternativeOptions = {}) {
  const ranked = rankExerciseAlternatives(sourceId, exercises, options);
  const allowed = new Set(ranked.map(({ exercise }) => exercise.id));
  const selected = [...new Set(saved ?? [])].filter((id) => allowed.has(id));
  return selected.length ? selected : ranked.slice(0, 3).map(({ exercise }) => exercise.id);
}
