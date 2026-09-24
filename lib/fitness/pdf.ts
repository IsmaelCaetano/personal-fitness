import type { FitnessData, Routine } from "./model";
import { library } from "./seed";

export type WorkoutPdfModel = {
  athlete: string;
  trainer?: string;
  objective: string;
  date: string;
  weeklyGoal: number;
  routines: { name: string; description: string; rows: { exercise: string; sets: string; target: string; load: string; lastLoad: string; rest: string; effort: string; notes: string }[] }[];
};

export function toWorkoutPdfModel(data: FitnessData, routines: Routine[], date = new Date()): WorkoutPdfModel {
  const exercises = new Map([...library, ...data.exercises].map((exercise) => [exercise.id, exercise]));
  return {
    athlete: data.profile.name,
    objective: data.profile.goals.join(", "),
    date: date.toISOString().slice(0, 10),
    weeklyGoal: data.profile.weeklyGoal,
    routines: routines.map((routine) => ({
      name: routine.name,
      description: routine.description,
      rows: routine.exercises.map((plan) => {
        const last = data.sessions.filter((session) => session.status === "completed" && !session.isDemo && session.exercises.some((item) => item.exercise.id === plan.exerciseId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
        const set = last?.exercises.find((item) => item.exercise.id === plan.exerciseId)?.sets.find((item) => item.status === "completed" && item.weight !== null);
        return {
          exercise: exercises.get(plan.exerciseId)?.name ?? "Exercício removido",
          sets: String(plan.sets),
          target: plan.targetText || `${plan.minReps}${plan.maxReps === plan.minReps ? "" : `–${plan.maxReps}`} reps`,
          load: plan.loadText || (plan.suggestedWeight == null ? "—" : `${plan.suggestedWeight} kg`),
          lastLoad: set?.weight == null ? "—" : `${set.weight} kg`,
          rest: `${plan.rest}s`,
          effort: plan.notes.match(/(?:RIR|RPE)\s*[:=]?\s*\d+(?:[–-]\d+)?/i)?.[0] ?? "—",
          notes: plan.notes,
        };
      }),
    })),
  };
}

/** Import only on click so PDF code is excluded from initial app loading. */
export async function downloadWorkoutPdf(model: WorkoutPdfModel, filename = "personal-fitness.pdf") {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  let y = 18;
  const ensure = (height: number) => { if (y + height > 282) { pdf.addPage(); y = 18; } };
  const line = (label: string, text: string) => {
    const lines = pdf.splitTextToSize(`${label}: ${text || "—"}`, 180) as string[];
    ensure(lines.length * 5 + 2);
    pdf.setFontSize(9);
    pdf.setTextColor(55, 60, 55);
    pdf.text(lines, margin, y);
    y += lines.length * 5 + 2;
  };
  pdf.setFillColor(190, 249, 102);
  pdf.rect(0, 0, 210, 5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(25, 35, 25);
  pdf.text("PERSONAL FITNESS", margin, y);
  y += 10;
  pdf.setFont("helvetica", "normal");
  line("Atleta", model.athlete);
  if (model.trainer) line("Treinador", model.trainer);
  line("Objetivo", model.objective);
  line("Data", model.date);
  line("Meta semanal", `${model.weeklyGoal} dias`);
  for (const routine of model.routines) {
    ensure(20);
    y += 5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(35, 60, 25);
    pdf.text(routine.name, margin, y);
    y += 7;
    pdf.setFont("helvetica", "normal");
    if (routine.description) line("Orientações", routine.description);
    ensure(9);
    pdf.setFillColor(240, 245, 235);
    pdf.rect(margin, y - 4, 180, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    [["Exercício", 16], ["Séries", 70], ["Reps / Meta", 88], ["Carga", 125], ["Descanso", 150], ["RIR/RPE", 174]].forEach(([heading, x]) => pdf.text(String(heading), Number(x), y));
    y += 10;
    for (const row of routine.rows) {
      const note = pdf.splitTextToSize(`Última carga: ${row.lastLoad}. Observações: ${row.notes || "—"}`, 174) as string[];
      ensure(7 + note.length * 4 + 4);
      pdf.setDrawColor(220, 225, 220);
      pdf.line(margin, y - 3, 195, y - 3);
      pdf.setFontSize(9);
      pdf.setTextColor(30, 35, 30);
      pdf.text(row.exercise.slice(0, 26), 16, y);
      pdf.text(row.sets, 70, y);
      pdf.text(row.target.slice(0, 19), 88, y);
      pdf.text(row.load.slice(0, 12), 125, y);
      pdf.text(row.rest, 150, y);
      pdf.text(row.effort, 174, y);
      y += 7;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 105, 100);
      pdf.text(note, margin + 2, y);
      y += note.length * 4 + 3;
    }
  }
  pdf.save(filename);
}
