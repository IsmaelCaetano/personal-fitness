"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  Flag,
  Layers3,
  Plus,
  Replace,
  SkipForward,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import type {
  FitnessData,
  Session,
  WorkoutSet,
  SessionExercise,
} from "@/lib/fitness/model";
import { newId } from "@/lib/fitness/model";
import {
  calculateWorkoutDuration,
  calculateWorkoutVolume,
  clock,
  completedSets,
  currentTimestamp,
  detectPersonalRecord,
  displayWeight,
  fmt,
  getPreviousExercisePerformance,
  suggestProgression,
  toKg,
} from "@/lib/fitness/domain";
import { Choice, Confirm, Modal } from "./shared";
import { ExerciseMedia } from "./exercise-media";
import { library } from "@/lib/fitness/seed";
import { alternativesFor } from "@/lib/fitness/recommendations";
export function Workout({
  session,
  data,
  onChange,
  onFinish,
  onBack,
}: {
  session: Session;
  data: FitnessData;
  onChange: (s: Session) => void;
  onFinish: (s: Session) => void;
  onBack: () => void;
}) {
  const [now, setNow] = useState(currentTimestamp);
  const [finish, setFinish] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [rest, setRest] = useState<{
    end: number;
    name: string;
    target: string;
  } | null>(null);
  const unit = data.profile.unit;
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`rest:${session.id}`);
      if (cached) queueMicrotask(() => setRest(JSON.parse(cached)));
    } catch {}
    const t = setInterval(() => setNow(currentTimestamp()), 1000);
    return () => clearInterval(t);
  }, [session.id]);
  useEffect(() => {
    try {
      if (rest) sessionStorage.setItem(`rest:${session.id}`, JSON.stringify(rest));
      else sessionStorage.removeItem(`rest:${session.id}`);
    } catch {}
  }, [rest, session.id]);
  useEffect(() => {
    if (rest && rest.end <= now) {
      const timer = setTimeout(() => {
        setRest(null);
        toast("Descanso concluído. Próxima série!");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [rest, now]);
  const changeSet = (
    exerciseId: string,
    setId: string,
    patch: Partial<WorkoutSet>,
  ) =>
    onChange({
      ...session,
      exercises: session.exercises.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: e.sets.map((s) =>
                s.id === setId ? { ...s, ...patch } : s,
              ),
            }
          : e,
      ),
    });
  const sets = session.exercises.flatMap((e) => e.sets),
    done = sets.filter((s) => s.status === "completed").length,
    all = sets.length;
  const previous = data.sessions
    .filter(
      (s) =>
        s.status === "completed" &&
        !s.isDemo &&
        s.routineId === session.routineId,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const currentVolume = calculateWorkoutVolume(session),
    oldVolume = previous ? calculateWorkoutVolume(previous) : 0;
  const records = detectPersonalRecord(session, data.sessions);
  const repCount = (s: Session) =>
    s.exercises.flatMap(completedSets).reduce((n, s) => n + (s.reps ?? 0), 0);
  const average = (s: Session) => {
    const sets = s.exercises.flatMap(completedSets);
    return sets.length
      ? sets.reduce((n, x) => n + (x.weight ?? 0), 0) / sets.length
      : 0;
  };
  return (
    <>
      <button className="text-button back-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Voltar para Hoje
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow lime">TREINO EM ANDAMENTO</div>
          <h1>{session.name}</h1>
          <p>Uma série de cada vez. A evolução vem com a constância.</p>
        </div>
        <button className="secondary" onClick={() => setCancel(true)}>
          <X size={16} />
          Cancelar treino
        </button>
      </div>
      <div className="workout-live-stats card">
        <div>
          <Clock3 size={18} />
          <span>
            <strong>{clock(calculateWorkoutDuration(session, now))}</strong>
            <small>Tempo de treino</small>
          </span>
        </div>
        <div>
          <Layers3 size={18} />
          <span>
            <strong>
              {fmt(displayWeight(currentVolume, unit))} <small>{unit}</small>
            </strong>
            <small>Volume total</small>
          </span>
        </div>
        <div>
          <Check size={18} />
          <span>
            <strong>
              {done}
              <small> / {all}</small>
            </strong>
            <small>Séries concluídas</small>
          </span>
        </div>
      </div>
      <Progress
        className="session-progress"
        value={all ? (done / all) * 100 : 0}
        aria-label="Séries concluídas"
      />
      <WorkoutSubstitutions session={session} data={data} onChange={onChange} />
      <div className="session-exercises">
        {session.exercises.map((e, i) => {
          const past = getPreviousExercisePerformance(
            data.sessions,
            e.exercise.id,
            new Date(session.startedAt).getTime(),
          );
          const prior = past?.exercise ? completedSets(past.exercise) : [];
          const suggestion = prior.length
            ? suggestProgression(prior, e.plan)
            : "INSUFFICIENT_DATA";
          const activity = e.plan.targetType && e.plan.targetType !== "reps";
          return (
            <section className="card session-exercise" key={e.id}>
              <div className="exercise-heading">
                <span className="exercise-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{e.exercise.name}</h2>
                  <p>
                    {e.exercise.muscle} ·{" "}
                    {e.plan.targetText ??
                      `${e.plan.minReps}–${e.plan.maxReps} reps`}{" "}
                    · {e.plan.rest}s de descanso
                    {e.plan.loadText ? ` · carga: ${e.plan.loadText}` : ""}
                  </p>
                </div>
                <span className="set-count">
                  {completedSets(e).length}/{e.sets.length}
                </span>
              </div>
              {(e.plan.notes || e.exercise.notes) && (
                <p className="exercise-note">
                  {e.plan.notes || e.exercise.notes}
                </p>
              )}
              <ExerciseMedia exercise={e.exercise} compact />
              {suggestion === "READY_TO_PROGRESS" && (
                <div className="progression-note">
                  ↗ Topo da faixa atingido em todas as séries anteriores.
                  Considere aumentar a carga.
                </div>
              )}
              {suggestion === "REVIEW_LOAD" && (
                <div className="progression-note warning">
                  Várias séries anteriores ficaram abaixo da faixa. Considere
                  revisar a carga.
                </div>
              )}
              <div className="set-grid set-labels">
                <span>SÉRIE</span>
                <span>ANTERIOR</span>
                <span>{activity ? "ALVO" : unit.toUpperCase()}</span>
                <span>{activity ? "ETAPA" : "REPS"}</span>
                <span aria-label="Concluída">✓</span>
              </div>
              {e.sets.map((s, k) => (
                <div
                  className={`set-block ${s.status === "completed" ? "completed" : ""} ${s.status === "skipped" ? "skipped" : ""}`}
                  key={s.id}
                >
                  <div className="set-grid">
                    <span className="set-index">
                      {s.type === "warmup" ? "A" : k + 1}
                    </span>
                    <span className="previous-set">
                      {prior[k]
                        ? `${fmt(displayWeight(prior[k].weight ?? 0, unit), 1)} × ${prior[k].reps}`
                        : "—"}
                    </span>
                    <input
                      aria-label={`Carga série ${k + 1} ${e.exercise.name}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="2000"
                      step="0.5"
                      placeholder="—"
                      value={
                        s.weight === null ? "" : displayWeight(s.weight, unit)
                      }
                      onChange={(event) => {
                        const v = event.target.value;
                        changeSet(e.id, s.id, {
                          weight:
                            v === ""
                              ? null
                              : Math.max(0, toKg(Number(v), unit)),
                          status:
                            s.status === "completed" ? "pending" : s.status,
                          completedAt: null,
                        });
                      }}
                    />
                    <input
                      aria-label={`Repetições série ${k + 1} ${e.exercise.name}`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="1000"
                      placeholder={`${e.plan.minReps}–${e.plan.maxReps}`}
                      value={s.reps ?? ""}
                      onChange={(event) =>
                        changeSet(e.id, s.id, {
                          reps:
                            event.target.value === ""
                              ? null
                              : Math.max(
                                  0,
                                  Math.round(Number(event.target.value)),
                                ),
                          status:
                            s.status === "completed" ? "pending" : s.status,
                          completedAt: null,
                        })
                      }
                    />
                    <button
                      className="set-check"
                      aria-label={`${s.status === "completed" ? "Desmarcar" : "Concluir"} série ${k + 1} ${e.exercise.name}`}
                      aria-pressed={s.status === "completed"}
                      onClick={() => {
                        if (s.status === "completed") {
                          changeSet(e.id, s.id, {
                            status: "pending",
                            completedAt: null,
                          });
                          return;
                        }
                        if (
                          s.weight === null ||
                          s.reps === null ||
                          s.reps < 1
                        ) {
                          toast.error(
                            "Preencha carga e repetições. Para peso corporal, use carga 0.",
                          );
                          return;
                        }
                        changeSet(e.id, s.id, {
                          status: "completed",
                          completedAt: new Date().toISOString(),
                        });
                        if (e.plan.rest > 0)
                          setRest({
                            end: Date.now() + e.plan.rest * 1000,
                            name: e.exercise.name,
                            target: `Meta: ${e.plan.minReps}–${e.plan.maxReps} reps`,
                          });
                      }}
                    >
                      <Check size={20} />
                    </button>
                  </div>
                  <details className="set-options">
                    <summary>
                      Detalhes da série{" "}
                      <span>
                        {
                          {
                            normal: "Normal",
                            warmup: "Aquecimento",
                            backoff: "Back-off",
                            drop: "Drop-set",
                          }[s.type]
                        }
                        {s.rir !== null
                          ? ` · RIR ${s.rir === 4 ? "4+" : s.rir}`
                          : ""}
                      </span>
                    </summary>
                    <div className="set-detail-fields">
                      <label>
                        Tipo
                        <Choice
                          label={`Tipo série ${k + 1}`}
                          value={s.type}
                          onChange={(v) =>
                            changeSet(e.id, s.id, {
                              type: v as WorkoutSet["type"],
                            })
                          }
                          options={[
                            { value: "normal", label: "Normal" },
                            { value: "warmup", label: "Aquecimento" },
                            { value: "backoff", label: "Back-off" },
                            { value: "drop", label: "Drop-set" },
                          ]}
                        />
                      </label>
                      <label>
                        RIR (opcional)
                        <Choice
                          label={`RIR série ${k + 1}`}
                          value={s.rir === null ? "none" : String(s.rir)}
                          onChange={(v) =>
                            changeSet(e.id, s.id, {
                              rir: v === "none" ? null : Number(v),
                            })
                          }
                          options={[
                            { value: "none", label: "—" },
                            "0",
                            "1",
                            "2",
                            "3",
                            { value: "4", label: "4+" },
                          ]}
                        />
                      </label>
                      <label>
                        RPE (1–10)
                        <input
                          type="number"
                          min={1}
                          max={10}
                          step={0.5}
                          value={s.rpe ?? ""}
                          onChange={(event) =>
                            changeSet(e.id, s.id, {
                              rpe: event.target.value
                                ? Math.min(
                                    10,
                                    Math.max(1, Number(event.target.value)),
                                  )
                                : null,
                            })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Observação
                      <input
                        maxLength={1000}
                        value={s.notes}
                        onChange={(event) =>
                          changeSet(e.id, s.id, { notes: event.target.value })
                        }
                      />
                    </label>
                    <button
                      className="text-button"
                      onClick={() =>
                        changeSet(e.id, s.id, {
                          status:
                            s.status === "skipped" ? "pending" : "skipped",
                          completedAt: null,
                        })
                      }
                    >
                      <SkipForward size={14} />
                      {s.status === "skipped" ? "Retomar série" : "Pular série"}
                    </button>
                  </details>
                </div>
              ))}
              <button
                className="add-set"
                disabled={e.sets.length >= 20}
                onClick={() =>
                  onChange({
                    ...session,
                    exercises: session.exercises.map((x) =>
                      x.id === e.id
                        ? {
                            ...x,
                            sets: [
                              ...x.sets,
                              {
                                id: newId(),
                                weight: null,
                                reps: null,
                                rir: null,
                                rpe: null,
                                type: "normal",
                                status: "pending",
                                notes: "",
                                completedAt: null,
                              },
                            ],
                          }
                        : x,
                    ),
                  })
                }
              >
                <Plus size={16} />
                Adicionar série
              </button>
            </section>
          );
        })}
      </div>
      <label className="session-notes">
        Anotações do treino
        <textarea
          placeholder="Como você se sentiu hoje?"
          maxLength={2000}
          value={session.notes}
          onChange={(e) => onChange({ ...session, notes: e.target.value })}
        />
      </label>
      <div className="finish-row">
        <span>
          {done} de {all} séries concluídas
        </span>
        <button
          className="primary"
          disabled={!done}
          onClick={() => setFinish(true)}
        >
          <Flag size={18} />
          Finalizar treino
        </button>
      </div>
      {rest && (
        <div className="rest-timer" role="status">
          <div className="rest-main">
            <Timer size={20} />
            <div>
              <span>DESCANSO</span>
              <strong>{clock((rest.end - now) / 1000)}</strong>
            </div>
          </div>
          <div className="rest-next">
            <strong>{rest.name}</strong>
            <small>{rest.target}</small>
          </div>
          <button onClick={() => setRest({ ...rest, end: rest.end + 30000 })}>
            +30s
          </button>
          <button onClick={() => setRest(null)}>
            Pular
            <SkipForward size={16} />
          </button>
        </div>
      )}
      <Modal
        open={finish}
        title="Bom treino. Mais um passo!"
        description="Confira o resumo antes de finalizar."
        onClose={() => setFinish(false)}
      >
        <div className="summary-icon">
          <Check size={36} />
        </div>
        <h2 className="summary-name">{session.name}</h2>
        <div className="summary-grid">
          <div>
            <strong>{clock(calculateWorkoutDuration(session, now))}</strong>
            <span>Duração</span>
          </div>
          <div>
            <strong>{done}</strong>
            <span>Séries</span>
          </div>
          <div>
            <strong>{fmt(displayWeight(currentVolume, unit))}</strong>
            <span>{unit} de volume</span>
          </div>
          <div>
            <strong>{records.length}</strong>
            <span>Recordes</span>
          </div>
        </div>
        {previous && (
          <div className="comparison">
            <span>VS. ÚLTIMO {session.name.toUpperCase()}</span>
            <p>
              Volume:{" "}
              {oldVolume
                ? `${((currentVolume / oldVolume - 1) * 100).toFixed(1)}%`
                : "sem base"}
            </p>
            <p>
              Carga média:{" "}
              {average(previous)
                ? `${((average(session) / average(previous) - 1) * 100).toFixed(1)}%`
                : "sem base"}
            </p>
            <p>
              Repetições:{" "}
              {repCount(session) - repCount(previous) >= 0 ? "+" : ""}
              {repCount(session) - repCount(previous)}
            </p>
          </div>
        )}
        {records.length > 0 && (
          <p className="lime">
            <Trophy size={18} className="inline-icon" />
            Novos recordes em {
              new Set(records.map((r) => r.exercise)).size
            }{" "}
            exercício(s).
          </p>
        )}
        {done < all && (
          <p className="small muted">
            {all - done} série(s) não concluída(s) serão marcadas como puladas.
          </p>
        )}
        <button
          className="primary full"
          onClick={() => {
            setRest(null);
            setFinish(false);
            onFinish({
              ...session,
              status: "completed",
              finishedAt: new Date().toISOString(),
              exercises: session.exercises.map((e) => ({
                ...e,
                sets: e.sets.map((s) =>
                  s.status === "pending" ? { ...s, status: "skipped" } : s,
                ),
              })),
            });
          }}
        >
          Concluir e ver histórico
          <Check size={18} />
        </button>
      </Modal>
      <Confirm
        open={cancel}
        title="Cancelar este treino?"
        description="As séries registradas serão preservadas no histórico como treino cancelado."
        action="Cancelar treino"
        onClose={() => setCancel(false)}
        onConfirm={() => {
          setRest(null);
          onFinish({
            ...session,
            status: "cancelled",
            finishedAt: new Date().toISOString(),
          });
        }}
      />
    </>
  );
}

function WorkoutSubstitutions({
  session,
  data,
  onChange,
}: {
  session: Session;
  data: FitnessData;
  onChange: (s: Session) => void;
}) {
  const exercises = [...library, ...data.exercises];
  const entries = session.exercises
    .map((entry) => ({
      entry,
      alternativeIds: alternativesFor(
        entry.plan.exerciseId,
        entry.plan.alternativeExerciseIds,
        exercises,
      ),
    }))
    .filter((item) => item.alternativeIds.length);
  if (!entries.length) return null;
  function swap(entry: SessionExercise, exerciseId: string) {
    if (completedSets(entry).length) {
      toast.error(
        "Desmarque as séries concluídas antes de trocar este exercício.",
      );
      return;
    }
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const past = getPreviousExercisePerformance(
      data.sessions,
      exercise.id,
      new Date(session.startedAt).getTime(),
    );
    const previous = past?.exercise ? completedSets(past.exercise) : [];
    const activity = entry.plan.targetType && entry.plan.targetType !== "reps";
    onChange({
      ...session,
      exercises: session.exercises.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              exercise: { ...exercise },
              sets: item.sets.map((set, index) => ({
                ...set,
                weight:
                  previous[index]?.weight ??
                  (activity ? 0 : (entry.plan.suggestedWeight ?? null)),
                reps:
                  previous[index]?.reps ??
                  (activity ? Math.max(1, entry.plan.minReps) : null),
                status: "pending",
                completedAt: null,
              })),
            }
          : item,
      ),
    });
    toast.success(`${exercise.name} escolhido apenas para este treino`);
  }
  return (
    <section className="card workout-substitutions">
      <div className="substitution-heading">
        <Replace size={20} />
        <div>
          <h2>Substituições automáticas</h2>
          <p>
            Sugestões do mesmo grupo muscular e com equipamentos compatíveis.
            Troque antes da primeira série; a rotina original não muda.
          </p>
        </div>
      </div>
      <div className="substitution-grid">
        {entries.map(({ entry, alternativeIds }) => {
          const ids = [entry.plan.exerciseId, ...alternativeIds];
          const locked = completedSets(entry).length > 0;
          return (
            <label key={entry.id}>
              <span>
                {exercises.find((e) => e.id === entry.plan.exerciseId)?.name ??
                  entry.exercise.name}
              </span>
              {locked ? (
                <small>
                  Exercício iniciado: desmarque as séries para trocar.
                </small>
              ) : (
                <Choice
                  label={`Substituir ${entry.exercise.name}`}
                  value={entry.exercise.id}
                  onChange={(id) => swap(entry, id)}
                  options={ids.map((id) => ({
                    value: id,
                    label:
                      exercises.find((e) => e.id === id)?.name ?? "Exercício",
                  }))}
                />
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
