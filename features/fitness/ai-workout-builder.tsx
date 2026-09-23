"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, Check, Clock3, Dumbbell, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Choice, Modal } from "./shared";
import { compileGeneratedProgram, generatedProgramSchema, validateGeneratedProgram, type GeneratedProgram, type WorkoutBrief } from "@/lib/fitness/ai";
import type { Exercise, FitnessData, Routine } from "@/lib/fitness/model";

const styles = [
  { value: "automatico", label: "IA decide a melhor divisão" },
  { value: "hibrido", label: "Híbrido: força + cardio" },
  { value: "full-body", label: "Full body" },
  { value: "upper-lower", label: "Upper / Lower" },
  { value: "abc", label: "A / B / C" },
  { value: "ppl", label: "Push / Pull / Legs" },
];

export function AIWorkoutBuilder({ data, exercises, onClose, onSave }: { data: FitnessData; exercises: Exercise[]; onClose: () => void; onSave: (routines: Routine[]) => void }) {
  const [brief, setBrief] = useState<WorkoutBrief>({ style: "automatico", days: data.profile.weeklyGoal, minutes: 60, experience: "intermediario", equipment: "academia", equipmentNotes: "", cardio: "sem-preferencia", limitations: "", preferences: "" });
  const [program, setProgram] = useState<GeneratedProgram | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recentSessions = useMemo(() => data.sessions.filter((session) => session.status === "completed" && !session.isDemo).length, [data.sessions]);

  async function generate() {
    setBusy(true); setError(""); setProgram(null); setRoutines([]);
    try {
      const response = await fetch("/api/ai/workout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief }) });
      const payload = await response.json() as GeneratedProgram & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível gerar o treino.");
      const parsed = generatedProgramSchema.parse(payload);
      const issue = validateGeneratedProgram(parsed, brief, exercises);
      if (issue) throw new Error(issue);
      setProgram(parsed); setRoutines(compileGeneratedProgram(parsed, exercises));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar o treino.");
    } finally { setBusy(false); }
  }

  return <Modal open wide title={program ? program.title : "Criar treino com IA"} description={program ? "Confira a divisão, o volume e a progressão antes de salvar." : "A IA cruza seu objetivo, frequência, tempo, equipamentos, preferências e histórico recente."} onClose={onClose}>
    {!program ? <div className="ai-builder">
      <div className="ai-builder-intro"><BrainCircuit size={23}/><div><strong>Planejamento individual, não uma ficha pronta</strong><p>Quanto mais contexto você informar, mais específico será o resultado.</p></div></div>
      <div className="ai-form-grid">
        <label>Tipo de treino<Choice label="Tipo de treino" value={brief.style} onChange={(value) => setBrief({ ...brief, style: value as WorkoutBrief["style"] })} options={styles}/></label>
        <label>Dias por semana<Choice label="Dias por semana" value={String(brief.days)} onChange={(value) => setBrief({ ...brief, days: Number(value) })} options={[1,2,3,4,5,6,7].map((value) => ({ value: String(value), label: `${value} dia${value > 1 ? "s" : ""}` }))}/></label>
        <label>Tempo por treino<Choice label="Tempo por treino" value={String(brief.minutes)} onChange={(value) => setBrief({ ...brief, minutes: Number(value) })} options={[30,40,45,50,60,75,90,120].map((value) => ({ value: String(value), label: `${value} min` }))}/></label>
        <label>Nível atual<Choice label="Nível atual" value={brief.experience} onChange={(value) => setBrief({ ...brief, experience: value as WorkoutBrief["experience"] })} options={[{value:"iniciante",label:"Iniciante"},{value:"intermediario",label:"Intermediário"},{value:"avancado",label:"Avançado"}]}/></label>
        <label>Onde vai treinar<Choice label="Equipamentos" value={brief.equipment} onChange={(value) => setBrief({ ...brief, equipment: value as WorkoutBrief["equipment"] })} options={[{value:"academia",label:"Academia completa"},{value:"casa-halteres",label:"Casa com halteres"},{value:"peso-corporal",label:"Peso corporal"},{value:"personalizado",label:"Equipamentos específicos"}]}/></label>
        <label>Cardio preferido<Choice label="Cardio preferido" value={brief.cardio} onChange={(value) => setBrief({ ...brief, cardio: value as WorkoutBrief["cardio"] })} options={[{value:"sem-preferencia",label:"Sem preferência"},{value:"corrida",label:"Corrida"},{value:"bike",label:"Bicicleta"},{value:"eliptico",label:"Elíptico"},{value:"remo",label:"Remo"}]}/></label>
      </div>
      <label className="ai-wide-field">Equipamentos disponíveis<input value={brief.equipmentNotes} onChange={(event) => setBrief({ ...brief, equipmentNotes: event.target.value })} maxLength={500} placeholder="Ex.: rack, barra, banco, halteres até 30 kg, esteira..."/></label>
      <label className="ai-wide-field">Limitações, dores ou movimentos a evitar<textarea rows={3} value={brief.limitations} onChange={(event) => setBrief({ ...brief, limitations: event.target.value })} maxLength={1000} placeholder="Ex.: evito impacto, desconforto no ombro acima da cabeça..."/></label>
      <label className="ai-wide-field">Preferências e contexto<textarea rows={3} value={brief.preferences} onChange={(event) => setBrief({ ...brief, preferences: event.target.value })} maxLength={1500} placeholder="Ex.: quero melhorar corrida de 5 km, gosto de máquinas, não quero treinos aos domingos..."/></label>
      <div className="ai-context-summary"><Sparkles size={17}/><span>Será considerado: {data.profile.goals.join(", ")} · {data.profile.height ?? "—"} cm · {data.profile.weight ?? "—"} kg · {recentSessions} treino(s) disponível(is) no histórico. Perfil e respostas são enviados ao provedor de IA para montar o plano.</span></div>
      {error && <p className="ai-error" role="alert">{error}</p>}
      <button className="primary full ai-generate" disabled={busy} onClick={() => void generate()}>{busy ? <><RefreshCw className="spin" size={18}/>Analisando e montando...</> : <><BrainCircuit size={18}/>Gerar meu plano personalizado</>}</button>
      <p className="small muted ai-safety"><ShieldAlert size={14}/>A IA auxilia o planejamento, mas não substitui avaliação médica ou acompanhamento profissional.</p>
    </div> : <div className="ai-result">
      <section className="ai-reasoning"><div><Sparkles size={18}/><strong>Por que este plano combina com você</strong></div><ul>{program.rationale.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <div className="ai-routine-list">{routines.map((routine) => <article className={`ai-routine-card ${routine.color}`} key={routine.id}><div><span className={`icon-box ${routine.color}`}><Dumbbell size={19}/></span><div><h3>{routine.name}</h3><p>{routine.description}</p></div></div><div className="ai-routine-meta"><span><Clock3 size={14}/>{routine.exercises.length} exercícios</span><span>{routine.exercises.reduce((total, plan) => total + plan.sets, 0)} séries</span><span>{routine.days.map((day) => ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][day]).join(" · ") || "Dia flexível"}</span></div><ol>{routine.exercises.map((plan) => <li key={plan.id}><span>{exercises.find((exercise) => exercise.id === plan.exerciseId)?.name}</span><b>{plan.sets} × {plan.targetText ?? `${plan.minReps}-${plan.maxReps}`}</b><small>{plan.notes}</small></li>)}</ol></article>)}</div>
      <section className="ai-progression"><strong>Como evoluir</strong><ul>{program.progression.map((item) => <li key={item}>{item}</li>)}</ul></section>
      {!!program.warnings.length && <section className="ai-warnings"><strong><ShieldAlert size={16}/>Cuidados</strong><ul>{program.warnings.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {error && <p className="ai-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary" onClick={() => { setProgram(null); setRoutines([]); }}>Ajustar respostas</button><button className="secondary" disabled={busy} onClick={() => void generate()}><RefreshCw size={16}/>Gerar outra versão</button><button className="primary" onClick={() => { onSave(routines); toast.success(`${routines.length} rotina(s) adicionada(s)`); }}><Check size={17}/>Salvar plano</button></div>
    </div>}
  </Modal>;
}
