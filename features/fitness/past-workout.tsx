"use client";

import { useMemo, useState } from "react";
import { Check, History } from "lucide-react";
import { toast } from "sonner";
import type { FitnessData, Routine, Session, WorkoutSet } from "@/lib/fitness/model";
import { newId, sessionSchema } from "@/lib/fitness/model";
import { completedSets, currentTimestamp, displayWeight, getPreviousExercisePerformance, localDate, toKg } from "@/lib/fitness/domain";
import { library } from "@/lib/fitness/seed";
import { Choice, Modal } from "./shared";

type Entry = { weight: string; reps: string };

export function PastWorkoutEditor({ data, onClose, onSave }: { data: FitnessData; onClose: () => void; onSave: (session: Session) => void }) {
  const [routineId, setRoutineId] = useState(data.routines[0]?.id ?? "");
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState("21:00");
  const [duration, setDuration] = useState(60);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const routine = data.routines.find((item) => item.id === routineId);
  const exercises = [...library, ...data.exercises];
  const unit = data.profile.unit;
  const startedAt = useMemo(() => new Date(`${date}T${time}:00`).getTime(), [date, time]);

  function previous(exerciseId: string, index: number) {
    const found = getPreviousExercisePerformance(data.sessions, exerciseId, startedAt);
    return found?.exercise ? completedSets(found.exercise)[index] : undefined;
  }
  function setEntry(key: string, patch: Partial<Entry>) {
    setEntries((old) => ({ ...old, [key]: { weight: old[key]?.weight ?? "", reps: old[key]?.reps ?? "", ...patch } }));
  }
  function fillPrevious(plan: Routine["exercises"][number]) {
    const exercise = exercises.find((item) => item.id === plan.exerciseId);
    if (!exercise) return;
    const next = { ...entries };
    for (let index = 0; index < plan.sets; index++) {
      const prior = previous(exercise.id, index);
      if (prior) next[`${plan.id}:${index}`] = { weight: String(displayWeight(prior.weight ?? 0, unit)), reps: String(prior.reps ?? "") };
    }
    setEntries(next);
  }
  function submit() {
    if (!routine) return toast.error("Escolha uma rotina.");
    if (!Number.isFinite(startedAt) || startedAt > currentTimestamp()) return toast.error("Escolha uma data e hora válidas no passado.");
    let invalid = false;
    let completed = 0;
    const sessionExercises = routine.exercises.map((plan) => {
      const exercise = exercises.find((item) => item.id === plan.exerciseId)!;
      const activity = plan.targetType && plan.targetType !== "reps";
      const sets: WorkoutSet[] = Array.from({ length: plan.sets }, (_, index) => {
        const item = entries[`${plan.id}:${index}`] ?? { weight: "", reps: "" };
        if (!activity && ((item.weight && !item.reps) || (!item.weight && item.reps))) invalid = true;
        const done = activity ? item.reps !== "" : item.weight !== "" && item.reps !== "" && Number(item.reps) > 0;
        if (done) completed++;
        return { id: newId(), weight: done ? (activity ? 0 : toKg(Number(item.weight), unit)) : null, reps: done ? Math.max(1, Math.round(Number(item.reps))) : null, rir: null, rpe: null, type: "normal", status: done ? "completed" : "skipped", notes: "", completedAt: done ? new Date(startedAt + (index + 1) * 60000).toISOString() : null };
      });
      return { id: newId(), exercise: { ...exercise }, plan: { ...plan }, sets };
    });
    if (invalid) return toast.error("Preencha carga e repetições juntas em cada série.");
    if (!completed) return toast.error("Registre pelo menos uma série realizada.");
    const draft: Session = { id: newId(), routineId: routine.id, name: routine.name, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date(startedAt + Math.max(1, duration) * 60000).toISOString(), status: "completed", notes: "Treino registrado posteriormente.", isDemo: false, exercises: sessionExercises };
    const result = sessionSchema.safeParse(draft);
    if (!result.success) return toast.error(result.error.issues[0]?.message ?? "Confira o treino.");
    onSave(result.data);
  }

  return <Modal open wide title="Registrar treino antigo" description="Informe o que você realizou. As cargas ficarão disponíveis como referência no próximo treino." onClose={onClose}>
    {!data.routines.length ? <p className="error-text">Crie ou importe uma rotina antes de registrar um treino antigo.</p> : <>
      <div className="past-workout-settings">
        <label>Rotina<Choice label="Rotina realizada" value={routineId} onChange={(id) => { setRoutineId(id); setEntries({}); }} options={data.routines.map((item) => ({ value: item.id, label: item.name }))}/></label>
        <label>Data<input type="date" max={localDate()} value={date} onChange={(event) => setDate(event.target.value)}/></label>
        <label>Horário<input type="time" value={time} onChange={(event) => setTime(event.target.value)}/></label>
        <label>Duração (min)<input type="number" min={1} max={600} value={duration} onChange={(event) => setDuration(Number(event.target.value))}/></label>
      </div>
      <div className="past-exercises">{routine?.exercises.map((plan) => {
        const exercise = exercises.find((item) => item.id === plan.exerciseId);
        if (!exercise) return null;
        const activity = plan.targetType && plan.targetType !== "reps";
        return <section className="past-exercise" key={plan.id}>
          <div className="card-top"><div><h3>{exercise.name}</h3><p>{plan.sets} série(s) · alvo {plan.targetText ?? `${plan.minReps}–${plan.maxReps} reps`}</p></div>{!activity && <button className="text-button" type="button" onClick={() => fillPrevious(plan)}><History size={15}/>Usar carga anterior</button>}</div>
          <div className={`past-set-labels ${activity ? "activity" : ""}`}><span>Série</span>{!activity && <span>Carga ({unit})</span>}<span>{activity ? "Concluído" : "Repetições"}</span></div>
          {Array.from({ length: plan.sets }, (_, index) => {
            const key = `${plan.id}:${index}`;
            const prior = previous(exercise.id, index);
            return <div className={`past-set ${activity ? "activity" : ""}`} key={key}><b>{index + 1}</b>{!activity && <input aria-label={`Carga série ${index + 1} ${exercise.name}`} type="number" min={0} max={2000} step={0.5} placeholder={prior ? String(displayWeight(prior.weight ?? 0, unit)) : "0"} value={entries[key]?.weight ?? ""} onChange={(event) => setEntry(key, { weight: event.target.value })}/>} {activity ? <button type="button" className={entries[key]?.reps ? "activity-done active" : "activity-done"} onClick={() => setEntry(key, { weight: "0", reps: entries[key]?.reps ? "" : "1" })}>{entries[key]?.reps ? "Feito ✓" : plan.targetText ?? "Marcar como feito"}</button> : <input aria-label={`Repetições série ${index + 1} ${exercise.name}`} type="number" min={1} max={1000} placeholder={prior?.reps ? String(prior.reps) : String(plan.minReps)} value={entries[key]?.reps ?? ""} onChange={(event) => setEntry(key, { reps: event.target.value })}/>}</div>;
          })}
        </section>;
      })}</div>
      <div className="form-actions"><button className="secondary" type="button" onClick={onClose}>Cancelar</button><button className="primary" type="button" onClick={submit}><Check size={17}/>Salvar no histórico</button></div>
    </>}
  </Modal>;
}
