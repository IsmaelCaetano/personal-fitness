import { newId, type Exercise, type Plan, type Routine } from "./model";
import { suggestAlternativeExerciseIds } from "./recommendations";
export type TargetType =
  "reps" | "minutes" | "seconds" | "meters" | "instruction";
export type ImportRow = {
  id: string;
  name: string;
  exerciseId: string | null;
  alternativeExerciseIds: string[];
  sets: number;
  minReps: number;
  maxReps: number;
  rest: number;
  notes: string;
  recognized: boolean;
  issue?: string;
  targetType: TargetType;
  targetText: string;
  suggestedWeight: number | null;
  targetWeights?: number[];
  loadText: string;
};
export type ImportDraft = {
  id: string;
  name: string;
  days: number[];
  rows: ImportRow[];
};
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const weekday = (name: string): number | null => {
  const match = /^(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)(?:-feira)?\b/i.exec(name.trim());
  if (!match) return null;
  return ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"].indexOf(normalize(match[1]));
};
const isRest = (line: string) => /\b(?:descanso|folga|repouso)\b/i.test(normalize(line));
function cardioRow(line: string) {
  const detail = line.replace(/^cardio\s*[—–:-]\s*/i, "").trim();
  const duration = /(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(h(?:oras?)?|min(?:utos?)?)\b/i.exec(detail);
  if (!duration) return `${detail || "Cardio"} — conforme descrição`;
  const factor = duration[3].toLowerCase().startsWith("h") ? 60 : 1;
  const minutes = Math.round(Number(duration[1].replace(",", ".")) * factor);
  const maxMinutes = duration[2] ? Math.round(Number(duration[2].replace(",", ".")) * factor) : null;
  const name = /futebol/i.test(detail) ? "Futebol" : /bike|bicicleta/i.test(detail) ? "Bicicleta ergométrica" : /remador|remo/i.test(detail) ? "Remo ergométrico" : "Cardio";
  return `${name} — ${minutes}${maxMinutes ? `–${maxMinutes}` : ""} min — ${detail}`;
}
const aliases: Record<string, string[]> = {
  "base-0": [
    "supino reto",
    "supino reto barra",
    "supino barra",
    "barbell bench press",
  ],
  "base-1": [
    "supino inclinado",
    "supino inclinado halter",
    "supino inclinado halteres",
  ],
  "base-2": ["crucifixo maquina", "peck deck", "voador", "voador maquina"],
  "base-3": ["crossover", "crossover cabo"],
  "base-4": [
    "puxada frente",
    "puxada frontal",
    "puxada alta",
    "puxador frente",
    "lat pulldown",
  ],
  "base-5": ["remada baixa", "remada no cabo", "remada sentada"],
  "base-6": ["remada serrote", "remada unilateral"],
  "base-7": ["remada maquina", "remada maquina ou cabo"],
  "base-8": [
    "desenvolvimento halteres",
    "desenvolvimento com halteres",
  ],
  "base-9": ["elevacao lateral"],
  "base-10": ["crucifixo inverso", "voador invertido", "face pull"],
  "base-11": ["rosca direta", "rosca biceps"],
  "base-12": ["rosca alternada"],
  "base-13": ["rosca martelo"],
  "base-14": ["triceps pulley", "triceps na polia", "triceps corda"],
  "base-15": ["triceps frances"],
  "base-16": ["triceps testa"],
  "base-17": ["agachamento", "agachamento livre"],
  "base-18": ["leg press", "leg press 45", "leg 45"],
  "base-19": ["extensora", "cadeira extensora"],
  "base-20": ["mesa flexora", "flexora deitada"],
  "base-21": ["cadeira flexora", "flexora sentada"],
  "base-22": ["stiff", "stiff barra", "terra romeno com barra"],
  "base-23": ["levantamento romeno", "romeno halteres"],
  "base-24": ["elevacao pelvica", "hip thrust"],
  "base-25": ["panturrilha sentado", "panturrilha sentada"],
  "base-26": [
    "panturrilha em pe",
    "panturrilha maquina",
    "panturrilha peso corporal",
  ],
  "base-27": ["abdominal no cabo", "abdominal polia"],
  "base-28": ["abdominal solo", "abdominal"],
  "base-29": ["rosca punho", "rosca de punho"],
  "base-30": ["agachamento smith", "agachamento no smith"],
  "base-42": ["supino inclinado na maquina", "supino inclinado maquina"],
  "base-43": ["desenvolvimento de ombros na maquina", "desenvolvimento ombros maquina", "iso lateral shoulder press"],
  "base-44": ["remada com apoio", "remada apoiada"],
  "base-45": ["extensao de quadril no cabo", "coice no cabo"],
  "base-46": ["abdomen na maquina", "abdominal na maquina"],
  "base-47": ["crossover baixo para alto"],
  "base-48": ["abdutora", "cadeira abdutora"],
  "base-49": ["chest press", "supino maquina"],
  "base-50": ["panturrilhas na maquina", "panturrilha na maquina"],
  "base-51": ["futebol", "jogar futebol"],
  "base-52": ["bike", "bicicleta", "bike leve"],
  "base-53": ["remador", "remo"],
};
export function matchExercise(name: string, exercises: Exercise[]) {
  const target = normalize(name);
  const exact = exercises.find((e) => normalize(e.name) === target);
  if (exact) return exact;
  return exercises.find((e) => aliases[e.id]?.includes(target));
}

function parseRow(
  raw: string,
  exercises: Exercise[],
  defaultRest: number,
): ImportRow {
  const line = raw
    .trim()
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "");
  const rx =
    /(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*[x×]\s*(\d{1,3})(?:\s*[-–a]\s*(\d{1,3}))?\s*(min(?:utos?)?|s(?:egundos?)?|m(?:etros?)?)?(?:\s+por\s+(?:lado|perna))?/i.exec(
      line,
    );
  const duration = !rx
    ? /(\d{1,3})(?:\s*[-–a]\s*(\d{1,3}))?\s*(min(?:utos?)?|s(?:egundos?)?|h(?:oras?)?)\b/i.exec(
        line,
      )
    : null;
  let name = line,
    sets = 1,
    minReps = 1,
    maxReps = 1,
    targetType: TargetType = "instruction",
    targetText = "Executar conforme a descrição",
    recognized = true,
    issue: string | undefined;
  let tail = "";
  if (rx) {
    name = line.slice(0, rx.index).replace(/[\s:;|–—-]+$/, "");
    sets = Number(rx[1]);
    minReps = Number(rx[3]);
    maxReps = Number(rx[4] ?? rx[3]);
    tail = line
      .slice(rx.index + rx[0].length)
      .trim()
      .replace(/^[;|,\s–—-]+/, "");
    const unit = (rx[5] ?? "").toLowerCase();
    targetType = unit.startsWith("min")
      ? "minutes"
      : unit.startsWith("s")
        ? "seconds"
        : unit.startsWith("m")
          ? "meters"
          : "reps";
    targetText = `${rx[3]}${rx[4] ? `–${rx[4]}` : ""}${unit ? ` ${unit.startsWith("min") ? "min" : unit.startsWith("s") ? "s" : "m"}` : " reps"}${/por\s+(lado|perna)/i.test(rx[0]) ? " por lado" : ""}`;
    if (rx[2])
      tail = `Faixa prevista de ${rx[1]}–${rx[2]} séries. ${tail}`.trim();
  } else if (duration) {
    name = line.slice(0, duration.index).replace(/[\s:;|–—-]+$/, "");
    const hours = duration[3].toLowerCase().startsWith("h");
    minReps = Number(duration[1]) * (hours ? 60 : 1);
    maxReps = Number(duration[2] ?? duration[1]) * (hours ? 60 : 1);
    tail = line
      .slice(duration.index + duration[0].length)
      .trim()
      .replace(/^[;|,\s–—-]+/, "");
    targetType = hours || duration[3].toLowerCase().startsWith("min")
      ? "minutes"
      : "seconds";
    targetText = `${minReps}${duration[2] ? `–${maxReps}` : ""} ${targetType === "minutes" ? "min" : "s"}`;
  } else {
    const pieces = line.split(/\s+[—–]\s+/);
    name = pieces.shift() ?? line;
    tail = pieces.join(" — ");
    targetText = tail || "Executar";
  }
  const rest =
    /(?:descanso\s*:?\s*)(\d+)\s*(?:[-–a]\s*(\d+)\s*)?(segundos?|segs?|s|min(?:utos?)?)\b/i.exec(
      tail,
    ) ?? /^(\d+)\s*(?:[-–a]\s*(\d+)\s*)?(segundos?|segs?|s)\b/i.exec(tail);
  let restSeconds = defaultRest;
  if (rest)
    restSeconds =
      Number(rest[1]) * (rest[3].toLowerCase().startsWith("min") ? 60 : 1);
  const targetLoads = /cargas?\s+alvo\s*:\s*((?:\d+[.,]?\d*\s*[/|]\s*)+\d+[.,]?\d*)\s*(kg|lbs?)\b/i.exec(tail);
  const startLoad = /come[cç]ar\s+com\s+(\d+[.,]?\d*)(?:\s*[-–]\s*(\d+[.,]?\d*))?\s*(kg|lbs?)\b/i.exec(tail);
  const conditionalLoad = /(?:progredir\s+at[eé]|at[eé])\s+\d+[.,]?\d*\s*(?:kg|lbs?)\b/i.test(tail);
  const load = /(\d+[.,]?\d*)(?:\s*[-–a]\s*(\d+[.,]?\d*))?\s*(kg|lbs?)\b/i.exec(tail);
  let suggestedWeight: number | null = null,
    loadText = "";
  let targetWeights: number[] | undefined;
  if (targetLoads) {
    loadText = targetLoads[0] + (/\bpor\s+lado\b/i.test(tail) ? " por lado" : "");
    targetWeights = targetLoads[1].split(/\s*[/|]\s*/).map((value) => {
      const number = Number(value.replace(",", "."));
      return targetLoads[2].toLowerCase().startsWith("lb") ? number / 2.2046226218 : number;
    });
    if (!/\bpor\s+lado\b/i.test(tail)) suggestedWeight = targetWeights[0];
    else targetWeights = undefined;
  } else if (startLoad) {
    loadText = startLoad[0];
    const number = Number(startLoad[1].replace(",", "."));
    suggestedWeight = startLoad[3].toLowerCase().startsWith("lb") ? number / 2.2046226218 : number;
  } else if (load) {
    loadText = conditionalLoad ? `até ${load[0]}` : load[0];
    if (!conditionalLoad && !/\bpor\s+lado\b/i.test(tail)) {
      const number = Number(load[1].replace(",", "."));
      suggestedWeight = load[3].toLowerCase().startsWith("lb") ? number / 2.2046226218 : number;
    }
  } else {
    const descriptive =
      /(\d+\s*barras?|peso corporal|carga (?:leve|moderada|leve a moderada|leve ou moderada))/i.exec(
        tail,
      );
    if (descriptive) loadText = descriptive[0];
    if (/peso corporal/i.test(tail)) suggestedWeight = 0;
  }
  if (!name.trim()) {
    name = line;
    recognized = false;
    issue = "Nome não reconhecido. Edite antes de importar.";
  }
  if (
    sets < 1 ||
    sets > 12 ||
    minReps < 1 ||
    maxReps < minReps ||
    maxReps > (targetType === "reps" ? 100 : 600) ||
    restSeconds > 900
  ) {
    recognized = false;
    issue =
      "Séries, alvo ou descanso fora dos limites. Corrija antes de importar.";
  }
  const exercise = matchExercise(name, exercises);
  return {
    id: newId(),
    name: name.slice(0, 120),
    exerciseId: exercise?.id ?? null,
    alternativeExerciseIds: [],
    sets,
    minReps,
    maxReps,
    rest: restSeconds,
    notes: tail.slice(0, 2000),
    recognized,
    issue,
    targetType,
    targetText,
    suggestedWeight,
    targetWeights,
    loadText,
  };
}

export function parseWorkoutText(
  text: string,
  exercises: Exercise[],
  defaultRest = 90,
): ImportDraft[] {
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const source = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { routines?: unknown[] }).routines)
          ? (parsed as { routines: unknown[] }).routines
          : [];
      return source
        .map((value, index) => {
          const item = value as {
            name?: unknown;
            days?: unknown;
            exercises?: unknown;
          };
          const rows = Array.isArray(item.exercises) ? item.exercises : [];
          return {
            id: newId(),
            name:
              typeof item.name === "string"
                ? item.name.slice(0, 80)
                : `Treino ${index + 1}`,
            days: Array.isArray(item.days)
              ? item.days
                  .filter(
                    (d): d is number =>
                      Number.isInteger(d) && Number(d) >= 0 && Number(d) <= 7,
                  )
                  .map((d) => d % 7)
              : [],
            rows: rows.map((raw) => {
              const e = raw as {
                name?: unknown;
                sets?: unknown;
                reps?: unknown;
                rest?: unknown;
                weight?: unknown;
                notes?: unknown;
                alternatives?: unknown;
              };
              const name = typeof e.name === "string" ? e.name : "Exercício";
              const sets = Number(e.sets) || 1;
              const reps =
                typeof e.reps === "string" || typeof e.reps === "number"
                  ? String(e.reps)
                  : "1";
              const rest = Number(e.rest) || defaultRest;
              const weight =
                typeof e.weight === "string" || typeof e.weight === "number"
                  ? ` — ${e.weight}`
                  : "";
              const notes = typeof e.notes === "string" ? ` — ${e.notes}` : "";
              const row = parseRow(
                `${name} — ${sets}x${reps}${weight} — descanso ${rest}s${notes}`,
                exercises,
                defaultRest,
              );
              row.alternativeExerciseIds = Array.isArray(e.alternatives)
                ? e.alternatives
                    .map((value) =>
                      typeof value === "string"
                        ? matchExercise(value, exercises)?.id
                        : null,
                    )
                    .filter((id): id is string => !!id && id !== row.exerciseId)
                    .slice(0, 8)
                : [];
              return row;
            }),
          };
        })
        .filter((d) => d.rows.length);
    } catch {
      return [];
    }
  }
  const inlineDay =
    /^(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?(?:\s*[-–—]\s*([^:]+))?\s*:\s*(.+)$/i.exec(
      text.trim(),
    );
  if (inlineDay) {
    const rows = inlineDay[3].split(
      /\s*(?:,|\se\s)(?=[^,;]+\d{1,2}(?:\s*[-–]\s*\d+)?\s*[x×]\s*\d)/i,
    );
    return [
      {
        id: newId(),
        name: `Treino ${inlineDay[1]}${inlineDay[2] ? ` — ${inlineDay[2]}` : ""}`,
        days: [],
        rows: rows.map((x) => parseRow(x, exercises, defaultRest)),
      },
    ];
  }
  const schedule: { day: number; name: string }[] = [];
  const drafts: ImportDraft[] = [];
  const lines = text.split(/\r?\n/).map((x) => x.replace(/[\u00a0\u202f]/g, " ").trim().replace(/^#{1,4}\s+|^[-*•]\s+/, ""));
  let current: ImportDraft | null = null;
  const hasPrescription = (line: string) =>
    /\d+\s*(?:[-–]\s*\d+\s*)?[x×]\s*\d+|\d+\s*(?:[-–a]\s*\d+\s*)?(?:min(?:utos?)?|segundos?)\b/i.test(
      line,
    );
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || /^semana\b/i.test(line)) continue;
    const scheduled = /^dia\s+([1-7])\s*[—–:-]\s*(.+)$/i.exec(line);
    if (scheduled) {
      const explicitDay = weekday(scheduled[2]);
      schedule.push({
        day: explicitDay ?? Number(scheduled[1]) % 7,
        name: scheduled[2].replace(/^(?:domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)(?:-feira)?\s*:\s*/i, "").trim(),
      });
      continue;
    }
    if (/^(?:exerc[ií]cio|nome)\s*[;|\t]/i.test(line)) continue;
    const datedHeader = /^(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)(?:-feira)?\s*[—–:-]\s*(.+)$/i.exec(line);
    if (datedHeader && !hasPrescription(line)) {
      if (isRest(datedHeader[2])) { current = null; continue; }
      current = { id: newId(), name: `${datedHeader[1]} — ${datedHeader[2]}`.slice(0, 80), days: [weekday(datedHeader[1])!], rows: [] };
      drafts.push(current);
      continue;
    }
    if (/^cardio\s*[—–:-]/i.test(line)) {
      if (!current) { current = { id: newId(), name: "Cardio", days: [], rows: [] }; drafts.push(current); }
      current.rows.push(parseRow(cardioRow(line), exercises, defaultRest));
      continue;
    }
    if (isRest(line) && !hasPrescription(line)) { current = null; continue; }
    const next = lines.slice(i + 1).find(Boolean) ?? "";
    const explicitHeader =
      /^(?:treino|rotina)\b/i.test(line) ||
      (/^(?:corrida(?:\s|$)|recupera[cç][aã]o\b|p[eé]\s+(?:e|\+)\s+tornozelo\b)/i.test(
        line,
      ) &&
        !hasPrescription(line));
    const inferredHeader =
      !hasPrescription(line) &&
      !/[—–:;|\t]/.test(line) &&
      hasPrescription(next);
    if (explicitHeader || inferredHeader) {
      current = {
        id: newId(),
        name: line.replace(/^#{1,3}\s*/, "").slice(0, 80),
        days: [],
        rows: [],
      };
      drafts.push(current);
      continue;
    }
    if (!current) {
      current = { id: newId(), name: "Meu treino", days: [], rows: [] };
      drafts.push(current);
    }
    current.rows.push(parseRow(line, exercises, defaultRest));
  }
  for (let i = drafts.length - 1; i >= 0; i--)
    if (!drafts[i].rows.length) drafts.splice(i, 1);
  for (const item of schedule) {
    if (isRest(item.name)) continue;
    const wanted = normalize(item.name).replace(/\s+opcional$/, "");
    const found = drafts.find((d) => {
      const key = normalize(d.name);
      return (
        key === wanted ||
        key.startsWith(`${wanted} `) ||
        wanted.startsWith(`${key} `) ||
        (d.days.includes(item.day) && (key.includes(wanted) || wanted.includes(key)))
      );
    });
    if (found && !found.days.includes(item.day)) found.days.push(item.day);
  }
  return drafts;
}
export function compileImport(drafts: ImportDraft[], exercises: Exercise[]) {
  const routines: Routine[] = [],
    custom: Exercise[] = [];
  for (const d of drafts) {
    if (!d.rows.length || d.rows.length > 40)
      throw new Error("Cada rotina deve ter de 1 a 40 exercícios.");
    const plans: Plan[] = d.rows.map((row) => {
      let exercise =
        [...exercises, ...custom].find((e) => e.id === row.exerciseId) ||
        matchExercise(row.name, [...exercises, ...custom]);
      if (!exercise) {
        exercise = {
          id: newId(),
          name: row.name,
          muscle:
            row.targetType === "reps"
              ? "Não definido"
              : "Condicionamento / Mobilidade",
          equipment: "Não definido",
          secondary: "",
          notes: "",
        };
        custom.push(exercise);
      }
      const available = [...exercises, ...custom];
      return {
        id: newId(),
        exerciseId: exercise.id,
        alternativeExerciseIds: row.alternativeExerciseIds.length
          ? row.alternativeExerciseIds
          : suggestAlternativeExerciseIds(exercise.id, available),
        sets: row.sets,
        minReps: row.minReps,
        maxReps: row.maxReps,
        rest: row.rest,
        notes: row.notes,
        targetType: row.targetType,
        targetText: row.targetText,
        suggestedWeight: row.suggestedWeight,
        targetWeights: row.targetWeights,
        loadText: row.loadText,
      };
    });
    routines.push({
      id: newId(),
      name: d.name,
      description: "",
      days: d.days,
      color: "lime",
      exercises: plans,
    });
  }
  return { routines, custom };
}
