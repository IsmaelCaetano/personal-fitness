"use client";
import { useState } from "react";
import { CalendarCheck, Clock3, Dumbbell, Play, Replace } from "lucide-react";
import type { FitnessData, Routine } from "@/lib/fitness/model";
import { library } from "@/lib/fitness/seed";
import { Choice, Modal, EmptyState } from "./shared";
import { ExerciseMedia } from "./exercise-media";
import { alternativesFor } from "@/lib/fitness/recommendations";

export function RoutinePreview({
  routine,
  data,
  onClose,
  onStart,
  onChoose,
}: {
  routine: Routine;
  data: FitnessData;
  onClose: () => void;
  onStart: (r: Routine, substitutions?: Record<string, string>) => void;
  onChoose: (r: Routine) => void;
}) {
  const exercises = [...library, ...data.exercises];
  const [substitutions, setSubstitutions] = useState<Record<string, string>>(
    {},
  );
  return (
    <Modal
      open
      wide
      title={routine.name}
      description={
        routine.description ||
        "Confira os exercícios e escolha alternativas apenas para este treino."
      }
      onClose={onClose}
    >
      <div className="preview-overview">
        <span>
          <Dumbbell size={17} />
          {routine.exercises.length} exercícios
        </span>
        <span>{routine.exercises.reduce((n, e) => n + e.sets, 0)} séries</span>
        <span>
          <Clock3 size={17} />
          {Math.round(
            routine.exercises.reduce((n, e) => n + e.sets * (e.rest + 40), 0) /
              60,
          )}{" "}
          min estimados
        </span>
      </div>
      <div className="routine-days">
        {routine.days.length ? (
          routine.days.map((d) => (
            <span key={d}>
              {
                [
                  "Domingo",
                  "Segunda",
                  "Terça",
                  "Quarta",
                  "Quinta",
                  "Sexta",
                  "Sábado",
                ][d]
              }
            </span>
          ))
        ) : (
          <span>Escolha livre, sem dia fixo</span>
        )}
      </div>
      <div className="routine-preview-exercises">
        {routine.exercises.map((plan, i) => {
          const selectedId = substitutions[plan.id] ?? plan.exerciseId;
          const exercise = exercises.find((e) => e.id === selectedId);
          const alternatives = alternativesFor(
            plan.exerciseId,
            plan.alternativeExerciseIds,
            exercises,
          );
          return (
            <article className="preview-exercise card" key={plan.id}>
              <div className="preview-exercise-heading">
                <span className="exercise-number">{i + 1}</span>
                <div>
                  <h3>{exercise?.name ?? "Exercício não disponível"}</h3>
                  <p>
                    {exercise?.muscle} · {exercise?.equipment}
                  </p>
                </div>
                <strong>
                  {plan.sets} ×{" "}
                  {plan.targetText ??
                    `${plan.minReps}${plan.maxReps !== plan.minReps ? `–${plan.maxReps}` : ""} reps`}
                </strong>
              </div>
              <p className="preview-plan">
                Descanso: {plan.rest}s{plan.notes ? ` · ${plan.notes}` : ""}
              </p>
              {alternatives.length > 0 && (
                <div className="preview-alternative">
                  <label>
                    <Replace size={15} />
                    Sugestões automáticas
                  </label>
                  <Choice
                    label={`Exercício ${i + 1}`}
                    value={selectedId}
                    onChange={(id) =>
                      setSubstitutions({ ...substitutions, [plan.id]: id })
                    }
                    options={[
                      {
                        value: plan.exerciseId,
                        label: `${exercises.find((e) => e.id === plan.exerciseId)?.name ?? "Principal"} (principal)`,
                      },
                      ...alternatives.map((id) => ({
                        value: id,
                        label:
                          exercises.find((e) => e.id === id)?.name ??
                          "Alternativa",
                      })),
                    ]}
                  />
                  <p>
                    Compatíveis com o mesmo grupo muscular. A troca vale só para
                    hoje.
                  </p>
                </div>
              )}
              {exercise && <ExerciseMedia exercise={exercise} />}
            </article>
          );
        })}
      </div>
      {!routine.exercises.length && (
        <EmptyState
          title="Rotina vazia"
          description="Adicione os exercícios na edição da rotina."
        />
      )}
      <div className="preview-bottom-actions">
        <button
          className="secondary"
          onClick={() => {
            onChoose(routine);
            onClose();
          }}
        >
          <CalendarCheck size={17} />
          Escolher para hoje
        </button>
        <button
          className="primary"
          disabled={!routine.exercises.length}
          onClick={() => {
            onClose();
            onStart(routine, substitutions);
          }}
        >
          <Play size={17} />
          Iniciar treino
        </button>
      </div>
    </Modal>
  );
}
