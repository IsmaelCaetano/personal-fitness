"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  CalendarCheck,
  Upload,
  Copy,
  Dumbbell,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  newId,
  routineSchema,
  exerciseSchema,
  type Exercise,
  type Routine,
  type Plan,
  type FitnessData,
} from "@/lib/fitness/model";
import { ImportWorkout } from "./import-workout";
import { AIWorkoutBuilder } from "./ai-workout-builder";
import { library } from "@/lib/fitness/seed";
import { Choice, Modal, Confirm, EmptyState } from "./shared";
import type { FitnessStore } from "./use-fitness";
import { suggestAlternativeExerciseIds, rankExerciseAlternatives } from "@/lib/fitness/recommendations";
const muscles = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Quadríceps",
  "Posteriores",
  "Glúteos",
  "Panturrilhas",
  "Abdômen",
  "Antebraços",
];
const equipments = [
  "Barra",
  "Halteres",
  "Máquina",
  "Cabo",
  "Peso corporal",
  "Smith machine",
];
export function Routines({
  data,
  mutate,
  onExercise,
  onPreview,
  onChoose,
  createInitially = false,
}: {
  data: FitnessData;
  mutate: FitnessStore["mutate"];
  onExercise: (id: string) => void;
  onPreview: (r: Routine) => void;
  onChoose: (r: Routine) => void;
  createInitially?: boolean;
}) {
  const allExercises = [...library, ...data.exercises];
  const emptyRoutine = (): Routine => ({
    id: newId(),
    name: "",
    description: "",
    days: [],
    color: "lime",
    exercises: [],
  });
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clearAll, setClearAll] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(
    createInitially ? emptyRoutine() : null,
  );
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [custom, setCustom] = useState(false);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("Todos");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SEU PLANO, SEU RITMO</div>
          <h1>Treinos</h1>
          <p>Organize suas rotinas e faça cada série contar.</p>
        </div>
        <div className="routine-page-actions">
          <button className="secondary ai-action" onClick={() => setGenerating(true)}>
            <Sparkles size={18} />
            Criar com IA
          </button>
          <button className="secondary" onClick={() => setImporting(true)}>
            <Upload size={18} />
            Organizar meu treino
          </button>
          <button
            className="primary"
            onClick={() => setEditing(emptyRoutine())}
          >
            <Plus size={19} />
            Nova rotina
          </button>
        </div>
      </div>
      <Tabs defaultValue="routines">
        <TabsList className="view-tabs">
          <TabsTrigger value="routines">
            Minhas rotinas <span className="count">{data.routines.length}</span>
          </TabsTrigger>
          <TabsTrigger value="library">Biblioteca de exercícios</TabsTrigger>
        </TabsList>
        <TabsContent value="routines">
          {data.routines.length > 0 && (
            <div className="routine-management">
              <p>
                Escolha um treino avulso ou programe os dias em{" "}
                <strong>Editar rotina</strong>.
              </p>
              <button className="text-button" onClick={() => setClearAll(true)}>
                <Trash2 size={16} />
                Excluir todas as rotinas
              </button>
            </div>
          )}
          <div className="routine-grid">
            {data.routines.map((r) => (
              <article className={`card routine-card ${r.color}`} key={r.id}>
                <div className="card-top">
                  <div className={`icon-box ${r.color}`}>
                    <Dumbbell size={24} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="icon-button"
                      aria-label={`Opções de ${r.name}`}
                    >
                      <MoreHorizontal size={21} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onPreview(r)}>
                        <Eye />
                        Ver treino
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onChoose(r)}>
                        <CalendarCheck />
                        Escolher para hoje
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditing(structuredClone(r))}
                      >
                        <Pencil />
                        Editar rotina
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          mutate("routine", {
                            ...r,
                            id: newId(),
                            name: `${r.name} (cópia)`,
                            days: [],
                            exercises: r.exercises.map((e) => ({
                              ...e,
                              id: newId(),
                            })),
                          });
                          toast.success("Rotina duplicada");
                        }}
                      >
                        <Copy />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleting(r)}>
                        <Trash2 />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h2>{r.name}</h2>
                <p>{r.description || "Sua rotina personalizada"}</p>
                <div className="routine-days">
                  {r.days.length ? (
                    [...r.days]
                      .sort((a, b) => a - b)
                      .map((d) => (
                        <span key={d}>
                          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d]}
                        </span>
                      ))
                  ) : (
                    <span>Sem dia fixo</span>
                  )}
                </div>
                <div className="routine-exercise-list">
                  {r.exercises.slice(0, 4).map((p) => (
                    <div key={p.id}>
                      <span>
                        {allExercises.find((e) => e.id === p.exerciseId)
                          ?.name ?? "Exercício"}
                      </span>
                      <small>
                        {p.sets} × {p.targetText ?? `${p.minReps}–${p.maxReps}`}
                      </small>
                    </div>
                  ))}
                  {r.exercises.length > 4 && (
                    <p>+ {r.exercises.length - 4} exercícios</p>
                  )}
                </div>
                <div className="routine-footer">
                  <button className="secondary" onClick={() => onPreview(r)}>
                    <Eye size={16} />
                    Ver treino
                  </button>
                  <button className="primary" onClick={() => onChoose(r)}>
                    <CalendarCheck size={16} />
                    Fazer hoje
                  </button>
                </div>
                <div className="routine-card-tools">
                  <button
                    className="text-button"
                    onClick={() => setEditing(structuredClone(r))}
                  >
                    <Pencil size={15} />
                    Editar rotina
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDeleting(r)}
                  >
                    <Trash2 size={15} />
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!data.routines.length && (
            <EmptyState
              title="Monte seu primeiro treino"
              description="Escolha como quer montar seu plano e revise antes de salvar."
            >
              <button className="secondary" onClick={() => setGenerating(true)}><Sparkles size={17}/>Criar com IA</button>
              <button
                className="primary"
                onClick={() => setEditing(emptyRoutine())}
              >
                Criar rotina
              </button>
            </EmptyState>
          )}
        </TabsContent>
        <TabsContent value="library">
          <div className="library-toolbar">
            <label className="search-input">
              <Search size={18} />
              <input
                aria-label="Buscar exercícios"
                placeholder="Buscar exercício..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Choice
              label="Grupo muscular"
              value={group}
              onChange={setGroup}
              options={["Todos", ...muscles]}
            />
            <button className="secondary" onClick={() => setCustom(true)}>
              <Plus size={18} />
              Criar exercício
            </button>
          </div>
          <div className="exercise-library">
            {allExercises
              .filter(
                (e) =>
                  (group === "Todos" || e.muscle === group) &&
                  e.name
                    .toLocaleLowerCase("pt-BR")
                    .includes(search.toLocaleLowerCase("pt-BR")),
              )
              .map((e) => (
                <button
                  className="exercise-library-item card"
                  key={e.id}
                  onClick={() => onExercise(e.id)}
                >
                  <div className="icon-box">
                    <Dumbbell size={22} />
                  </div>
                  <div>
                    <strong>{e.name}</strong>
                    <p>
                      {e.muscle} · {e.equipment}
                    </p>
                    {e.secondary && (
                      <small className="muted">
                        Secundários: {e.secondary}
                      </small>
                    )}
                  </div>
                  <span>↗</span>
                </button>
              ))}
          </div>
        </TabsContent>
      </Tabs>
      {importing && (
        <ImportWorkout
          exercises={allExercises}
          routines={data.routines}
          rest={data.profile.rest}
          onClose={() => setImporting(false)}
          onImport={(result, removeIds) => {
            result.custom.forEach((e) => mutate("exercise", e));
            result.routines.forEach((r) => mutate("routine", r));
            data.routines
              .filter((r) => removeIds.includes(r.id))
              .forEach((r) => mutate("routine", r, true));
            if (
              data.profile.todayChoice?.routineId &&
              removeIds.includes(data.profile.todayChoice.routineId)
            )
              mutate("profile", { ...data.profile, todayChoice: undefined });
            setImporting(false);
            toast.success(
              `${result.routines.length} rotina(s) adicionada(s). Confira o indicador de salvamento.`,
            );
          }}
        />
      )}
      {generating && <AIWorkoutBuilder data={data} exercises={allExercises} onClose={() => setGenerating(false)} onSave={(routines) => { routines.forEach((routine) => mutate("routine", routine)); setGenerating(false); }} />}
      <Confirm
        open={clearAll}
        title="Excluir todas as rotinas?"
        description="Suas rotinas serão excluídas. O histórico e os exercícios personalizados serão preservados. Essa ação não pode ser desfeita."
        action="Excluir todas as rotinas"
        onClose={() => setClearAll(false)}
        onConfirm={() => {
          data.routines.forEach((r) => mutate("routine", r, true));
          mutate("profile", { ...data.profile, todayChoice: undefined });
          setClearAll(false);
        }}
      />
      {editing && (
        <RoutineEditor
          routine={editing}
          exercises={allExercises}
          defaultRest={data.profile.rest}
          onClose={() => setEditing(null)}
          onCreateExercise={() => setCustom(true)}
          onSave={(r) => {
            mutate("routine", r);
            setEditing(null);
            toast.success("Rotina atualizada");
          }}
        />
      )}
      <Confirm
        open={!!deleting}
        title="Excluir esta rotina?"
        description="Os treinos já concluídos continuarão no histórico."
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            mutate("routine", deleting, true);
            if (data.profile.todayChoice?.routineId === deleting.id)
              mutate("profile", { ...data.profile, todayChoice: undefined });
          }
          setDeleting(null);
        }}
      />
      {custom && (
        <ExerciseEditor
          onClose={() => setCustom(false)}
          onSave={(e) => {
            mutate("exercise", e);
            setCustom(false);
            toast.success("Exercício adicionado à biblioteca");
          }}
        />
      )}
    </>
  );
}
function RoutineEditor({
  routine,
  exercises,
  defaultRest,
  onClose,
  onSave,
  onCreateExercise,
}: {
  routine: Routine;
  exercises: Exercise[];
  defaultRest: number;
  onClose: () => void;
  onSave: (r: Routine) => void;
  onCreateExercise: () => void;
}) {
  const [draft, setDraft] = useState(routine);
  const [error, setError] = useState("");
  const changePlan = (id: string, patch: Partial<Plan>) =>
    setDraft({
      ...draft,
      exercises: draft.exercises.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });
  const autoAlternatives = (plan: Plan) =>
    suggestAlternativeExerciseIds(plan.exerciseId, exercises);
  const move = (i: number, offset: number) => {
    const next = [...draft.exercises];
    [next[i], next[i + offset]] = [next[i + offset], next[i]];
    setDraft({ ...draft, exercises: next });
  };
  return (
    <Modal
      open
      title={routine.name ? "Editar rotina" : "Nova rotina"}
      description="Defina exercícios, alternativas, séries e dias. Você pode ajustar tudo depois."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = routineSchema.safeParse(draft);
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          if (!draft.exercises.length) {
            setError("Adicione pelo menos um exercício.");
            return;
          }
          onSave(parsed.data);
        }}
      >
        <div className="form-grid">
          <label>
            Nome da rotina
            <input
              required
              maxLength={80}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex.: Upper A"
            />
          </label>
          <label>
            Descrição
            <input
              maxLength={180}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Ex.: Peito, costas e braços"
            />
          </label>
        </div>
        <div className="field-label">Dias da semana</div>
        <div className="day-picker">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, i) => (
            <label key={i}>
              <Checkbox
                checked={draft.days.includes(i)}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    days: checked
                      ? [...draft.days, i]
                      : draft.days.filter((d) => d !== i),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        {!!draft.exercises.length && (
          <div className="automatic-alternatives">
            <div>
              <Sparkles size={18} />
              <span>
                <strong>Substituições automáticas</strong>
                <small>
                  Mesmo grupo muscular, considerando equipamento e músculos
                  secundários.
                </small>
              </span>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setDraft({
                  ...draft,
                  exercises: draft.exercises.map((plan) => ({
                    ...plan,
                    alternativeExerciseIds: autoAlternatives(plan),
                  })),
                })
              }
            >
              Gerar para toda a rotina
            </button>
          </div>
        )}
        <div className="editor-exercises">
          {draft.exercises.map((p, i) => (
            <div className="plan-editor" key={p.id}>
              <div className="plan-editor-title">
                <b>
                  {i + 1}. {exercises.find((e) => e.id === p.exerciseId)?.name}
                </b>
                <div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Mover para cima"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Mover para baixo"
                    disabled={i === draft.exercises.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remover exercício"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        exercises: draft.exercises.filter((x) => x.id !== p.id),
                      })
                    }
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>
              <div className="plan-fields">
                <label>
                  Séries
                  <input
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={p.sets}
                    onChange={(e) =>
                      changePlan(p.id, { sets: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Reps mín.
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={p.minReps}
                    onChange={(e) =>
                      changePlan(p.id, { minReps: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Reps máx.
                  <input
                    type="number"
                    min={p.minReps}
                    max={100}
                    required
                    value={p.maxReps}
                    onChange={(e) =>
                      changePlan(p.id, { maxReps: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Descanso (s)
                  <input
                    type="number"
                    min={0}
                    max={900}
                    required
                    value={p.rest}
                    onChange={(e) =>
                      changePlan(p.id, { rest: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <div className="alternative-editor">
                <div>
                  <strong>Exercícios alternativos</strong>
                  <span>Você poderá trocar apenas no treino do dia.</span>
                </div>
                {p.alternativeExerciseIds?.length ? (
                  <div className="alternative-chips">
                    {p.alternativeExerciseIds.map((id) => (
                      <span key={id}>
                        {exercises.find((e) => e.id === id)?.name ??
                          "Exercício"}
                        <button
                          type="button"
                          aria-label="Remover alternativa"
                          onClick={() =>
                            changePlan(p.id, {
                              alternativeExerciseIds:
                                p.alternativeExerciseIds?.filter(
                                  (x) => x !== id,
                                ),
                            })
                          }
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <Combobox<Exercise>
                  items={rankExerciseAlternatives(p.exerciseId, exercises).map(({ exercise }) => exercise).filter((e) => !p.alternativeExerciseIds?.includes(e.id))}
                  itemToStringLabel={(e) => e.name}
                  value={null}
                  onValueChange={(exercise) => {
                    if (exercise)
                      changePlan(p.id, {
                        alternativeExerciseIds: [
                          ...(p.alternativeExerciseIds ?? []),
                          exercise.id,
                        ],
                      });
                  }}
                >
                  <ComboboxInput
                    placeholder="Adicionar alternativa..."
                    aria-label={`Adicionar alternativa para ${exercises.find((e) => e.id === p.exerciseId)?.name ?? "exercício"}`}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>
                      Nenhuma alternativa encontrada.
                    </ComboboxEmpty>
                    <ComboboxList>
                      {(e: Exercise) => (
                        <ComboboxItem key={e.id} value={e}>
                          {e.name}
                          <span className="muted"> · {e.equipment}</span>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <input
                className="plan-notes"
                aria-label="Observações do exercício"
                placeholder="Observações (opcional)"
                maxLength={2000}
                value={p.notes}
                onChange={(e) => changePlan(p.id, { notes: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="add-exercise">
          <Combobox<Exercise>
            items={exercises}
            itemToStringLabel={(e) => e.name}
            value={null}
            onValueChange={(exercise) => {
              if (exercise)
                setDraft({
                  ...draft,
                  exercises: [
                    ...draft.exercises,
                    {
                      id: newId(),
                      exerciseId: exercise.id,
                      alternativeExerciseIds: [],
                      sets: 3,
                      minReps: 8,
                      maxReps: 12,
                      rest: defaultRest,
                      notes: "",
                    },
                  ],
                });
            }}
          >
            <ComboboxInput
              placeholder="Buscar e adicionar exercício..."
              aria-label="Adicionar exercício à rotina"
            />
            <ComboboxContent>
              <ComboboxEmpty>Nenhum exercício encontrado.</ComboboxEmpty>
              <ComboboxList>
                {(e: Exercise) => (
                  <ComboboxItem key={e.id} value={e}>
                    {e.name}
                    <span className="muted"> · {e.muscle}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <button
            type="button"
            className="text-button"
            onClick={onCreateExercise}
          >
            <Plus size={16} />
            Criar personalizado
          </button>
        </div>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" type="submit">
            Salvar rotina
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ExerciseEditor({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (e: Exercise) => void;
}) {
  const [draft, setDraft] = useState<Exercise>({
    id: newId(),
    name: "",
    muscle: "Peito",
    secondary: "",
    equipment: "Halteres",
    notes: "",
  });
  return (
    <Modal
      open
      title="Criar exercício"
      description="Este exercício ficará disponível na sua biblioteca."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const result = exerciseSchema.safeParse(draft);
          if (result.success) onSave(result.data);
          else toast.error(result.error.issues[0].message);
        }}
      >
        <label>
          Nome
          <input
            required
            maxLength={120}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Grupo principal
            <Choice
              label="Grupo principal"
              value={draft.muscle}
              onChange={(muscle) => setDraft({ ...draft, muscle })}
              options={muscles}
            />
          </label>
          <label>
            Equipamento
            <Choice
              label="Equipamento"
              value={draft.equipment}
              onChange={(equipment) => setDraft({ ...draft, equipment })}
              options={equipments}
            />
          </label>
        </div>
        <label>
          Grupos secundários
          <input
            value={draft.secondary}
            maxLength={150}
            onChange={(e) => setDraft({ ...draft, secondary: e.target.value })}
          />
        </label>
        <label>
          Observações
          <textarea
            value={draft.notes}
            maxLength={2000}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        <button className="primary full" type="submit">
          Adicionar exercício
        </button>
      </form>
    </Modal>
  );
}
