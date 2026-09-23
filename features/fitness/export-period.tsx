"use client";
import { useMemo, useState } from "react";
import { Download, FileJson, FileText } from "lucide-react";
import type { FitnessData } from "@/lib/fitness/model";
import {
  calculateWorkoutDuration,
  calculateWorkoutVolume,
  completedSets,
  fmt,
  localDate,
} from "@/lib/fitness/domain";
import { library } from "@/lib/fitness/seed";
import { alternativesFor } from "@/lib/fitness/recommendations";
import { Modal } from "./shared";

const day = (iso: string) => localDate(new Date(iso));
const fileName = (start: string, end: string, extension: string) =>
  `treinos-${start}-a-${end}.${extension}`;
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportPeriod({
  data,
  onClose,
}: {
  data: FitnessData;
  onClose: () => void;
}) {
  const today = localDate();
  const initial = new Date(`${today}T12:00:00`);
  initial.setDate(initial.getDate() - 29);
  const [start, setStart] = useState(localDate(initial));
  const [end, setEnd] = useState(today);
  const exercises = [...library, ...data.exercises];
  const sessions = useMemo(
    () =>
      data.sessions
        .filter(
          (session) =>
            !session.isDemo &&
            (session.status === "completed" ||
              session.status === "cancelled") &&
            day(session.startedAt) >= start &&
            day(session.startedAt) <= end,
        )
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    [data.sessions, start, end],
  );
  const payload = () => ({
    format: "personal-fitness-v1",
    exportedAt: new Date().toISOString(),
    period: { start, end },
    routines: data.routines.map((routine) => ({
      name: routine.name,
      description: routine.description,
      days: routine.days,
      exercises: routine.exercises.map((plan) => ({
        name:
          exercises.find((exercise) => exercise.id === plan.exerciseId)?.name ??
          "Exercício",
        sets: plan.sets,
        reps: plan.targetText ?? `${plan.minReps}-${plan.maxReps}`,
        weight: plan.loadText || (plan.suggestedWeight ?? ""),
        rest: plan.rest,
        notes: plan.notes,
        alternatives: alternativesFor(
          plan.exerciseId,
          plan.alternativeExerciseIds,
          exercises,
        )
          .map((id) => exercises.find((exercise) => exercise.id === id)?.name)
          .filter(Boolean),
      })),
    })),
    history: sessions.map((session) => ({
      date: day(session.startedAt),
      name: session.name,
      status: session.status,
      durationMinutes: Math.round(calculateWorkoutDuration(session) / 60),
      volumeKg: Number(calculateWorkoutVolume(session).toFixed(2)),
      notes: session.notes,
      exercises: session.exercises.map((entry) => ({
        name: entry.exercise.name,
        sets: completedSets(entry).map((set) => ({
          weightKg: set.weight,
          reps: set.reps,
          rir: set.rir,
          rpe: set.rpe,
          type: set.type,
          notes: set.notes,
        })),
      })),
    })),
  });
  const text = () =>
    [
      `RELATÓRIO DE TREINOS · ${start} a ${end}`,
      `${sessions.length} sessão(ões)`,
      ...sessions.flatMap((session) => [
        "",
        `${day(session.startedAt)} — ${session.name} — ${session.status === "completed" ? "Concluído" : "Cancelado"}`,
        `Duração: ${Math.round(calculateWorkoutDuration(session) / 60)} min · Volume: ${fmt(calculateWorkoutVolume(session))} kg`,
        ...session.exercises.map((entry) => {
          const sets = completedSets(entry);
          return `${entry.exercise.name}: ${sets.length ? sets.map((set) => `${fmt(set.weight ?? 0, 1)} kg × ${set.reps ?? 0}${set.rir !== null ? ` · RIR ${set.rir}` : ""}`).join(" | ") : "sem séries concluídas"}`;
        }),
        session.notes ? `Observações: ${session.notes}` : "",
      ]),
    ].join("\n");
  return (
    <Modal
      open
      title="Exportar período"
      description="Baixe um resumo para leitura ou um JSON editável. O personal pode alterar as rotinas no JSON e você pode importar o arquivo novamente."
      onClose={onClose}
      wide
    >
      <div className="export-period-fields">
        <label>
          Data inicial
          <input
            type="date"
            value={start}
            max={end}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Data final
          <input
            type="date"
            value={end}
            min={start}
            max={today}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
      </div>
      <div className="export-summary">
        <strong>{sessions.length}</strong>
        <span>
          treino(s) real(is) encontrado(s) no período. Dados de demonstração não
          entram no arquivo.
        </span>
      </div>
      <div className="export-options">
        <button
          className="secondary"
          onClick={() =>
            download(
              fileName(start, end, "txt"),
              text(),
              "text/plain;charset=utf-8",
            )
          }
        >
          <FileText size={19} />
          <span>
            <strong>Resumo para o personal</strong>
            <small>TXT fácil de ler e comentar</small>
          </span>
          <Download size={17} />
        </button>
        <button
          className="primary"
          onClick={() =>
            download(
              fileName(start, end, "json"),
              JSON.stringify(payload(), null, 2),
              "application/json;charset=utf-8",
            )
          }
        >
          <FileJson size={19} />
          <span>
            <strong>Plano editável</strong>
            <small>JSON compatível com a importação</small>
          </span>
          <Download size={17} />
        </button>
      </div>
      <p className="small muted">
        O JSON inclui suas rotinas atuais, alternativas automáticas e o
        histórico do período. A importação usa o bloco “routines” e ignora o
        histórico.
      </p>
    </Modal>
  );
}
