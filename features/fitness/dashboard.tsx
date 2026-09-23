"use client";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Dumbbell,
  Flame,
  Flag,
  Layers3,
  Play,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { Choice, Modal } from "./shared";
import { Progress } from "@/components/ui/progress";
import type { FitnessData, Routine, Session } from "@/lib/fitness/model";
import {
  calculateWorkoutDuration,
  calculateWorkoutVolume,
  completedSets,
  displayWeight,
  fmt,
  localDate,
} from "@/lib/fitness/domain";
import { EmptyState, SectionTitle } from "./shared";
import { FitnessChart } from "./charts";
import { QuickActivity } from "./quick-activity";
export function Dashboard({
  data,
  onStart,
  onNavigate,
  onSession,
  onPreview,
  onChoose,
  onAuto,
  onFinish,
  onAddActivity,
}: {
  data: FitnessData;
  onStart: (r: Routine) => void;
  onNavigate: (v: string) => void;
  onSession: (s: Session) => void;
  onPreview: (r: Routine) => void;
  onChoose: (r: Routine) => void;
  onAuto: () => void;
  onFinish: (s: Session) => void;
  onAddActivity: (s: Session) => void;
}) {
  const [finishConfirm, setFinishConfirm] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const today = new Date();
  const active = data.sessions.find((s) => s.status === "active");
  const manual =
    data.profile.todayChoice?.date === localDate(today)
      ? data.routines.find((r) => r.id === data.profile.todayChoice?.routineId)
      : undefined;
  const planned =
    manual ?? data.routines.find((r) => r.days.includes(today.getDay()));
  const routine = active
    ? (data.routines.find((r) => r.id === active.routineId) ?? planned)
    : planned;
  const all = data.sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const real = all.filter((s) => !s.isDemo);
  const sample = !real.length && all.some((s) => s.isDemo);
  const shown = sample ? all.filter((s) => s.isDemo) : real;
  const last = shown[0];
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekly = real.filter((s) => new Date(s.startedAt) >= monday);
  const count = weekly.length;
  const goal = data.profile.weeklyGoal;
  const unit = data.profile.unit;
  const chartSessions = shown
    .filter((s) => s.name === shown[0]?.name)
    .slice(0, 6)
    .reverse();
  const activeDone = active
    ? active.exercises.flatMap(completedSets).length
    : 0;
  const activeAll = active
    ? active.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
    : 0;
  return (
    <>
      <div className="dashboard-title">
        <div>
          <div className="eyebrow">UM TREINO DE CADA VEZ</div>
          <h1>
            Vamos treinar, {data.profile.name.split(" ")[0]}
            <span className="lime">.</span>
          </h1>
          <p>Seu próximo passo começa com a primeira série.</p>
        </div>
        <div className="date-label">
          <span>{today.toLocaleDateString("pt-BR", { weekday: "long" })}</span>
          <strong>
            {today.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
            })}
          </strong>
        </div>
      </div>
      <div className="week-strip">
        <div className="week-label">
          <span className="eyebrow">SUA SEMANA</span>
          <span>
            <strong>{count}</strong> de {goal} treinos
          </span>
        </div>
        <div className="week-days">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            const isToday = localDate(d) === localDate(today);
            const done = real.some(
              (s) => localDate(new Date(s.startedAt)) === localDate(d),
            );
            const scheduled = data.routines.some((r) =>
              r.days.includes(d.getDay()),
            );
            return (
              <div
                key={i}
                className={`week-day ${isToday ? "today" : ""} ${done ? "done" : ""}`}
              >
                <span>
                  {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"][i]}
                </span>
                <b>{done ? <Check size={18} /> : d.getDate()}</b>
                <i className={scheduled ? "scheduled" : ""} />
              </div>
            );
          })}
        </div>
        <div className="week-message">
          <Flame size={22} />
          <span>
            Constância constrói
            <br />
            <strong>resultados.</strong>
          </span>
        </div>
      </div>
      <div className="today-layout">
        <section className="today-workout card">
          <div className="card-top">
            <span className="eyebrow lime">
              {active ? "TREINO EM ANDAMENTO" : "TREINO DE HOJE"}
            </span>
            <span className="tag">
              {active
                ? "Em andamento"
                : manual
                  ? "Escolhido por você"
                  : routine
                    ? "Programado"
                    : "Dia livre"}
            </span>
          </div>
          <div className="workout-title-row">
            <div>
              <h2>{active?.name ?? routine?.name ?? "No seu ritmo."}</h2>
              <p>
                {routine?.description ?? "Nenhuma rotina programada para hoje."}
              </p>
            </div>
            <div className="workout-monogram">
              {routine?.name.startsWith("Lower") ? "L" : "U"}
              <span>{routine?.name.endsWith("B") ? "B" : "A"}</span>
            </div>
          </div>
          {routine && (
            <div className="workout-facts">
              <span>
                <Dumbbell size={17} />
                {routine.exercises.length} exercícios
              </span>
              <span>
                <Layers3 size={17} />
                {routine.exercises.reduce((n, e) => n + e.sets, 0)} séries
              </span>
              <span>
                <Clock3 size={17} />
                {Math.round(
                  routine.exercises.reduce(
                    (n, e) => n + e.sets * (e.rest + 40),
                    0,
                  ) / 60,
                )}{" "}
                min estimados
              </span>
            </div>
          )}
          <div className="workout-start-row">
            <button
              className="primary start-button"
              onClick={() =>
                active
                  ? onNavigate("active")
                  : routine
                    ? onStart(routine)
                    : onNavigate("routines")
              }
            >
              <Play size={18} fill="currentColor" />
              {active
                ? "Continuar treino"
                : routine
                  ? "Iniciar treino"
                  : "Escolher um treino"}
              <ArrowRight size={19} />
            </button>
            {routine && (
              <button
                className="text-button"
                onClick={() => onPreview(routine)}
              >
                Ver treino
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
          <div className="today-extra-actions">
            {active && (
              <div className="today-finish-area">
                <button
                  className="secondary today-finish-button"
                  disabled={!activeDone}
                  onClick={() => setFinishConfirm(true)}
                >
                  <Flag size={17} />
                  Concluir treino
                </button>
                {!activeDone && (
                  <small>Conclua pelo menos uma série para finalizar.</small>
                )}
              </div>
            )}
            <button
              className="secondary today-activity-button"
              onClick={() => setAddingActivity(true)}
            >
              {active ? <Plus size={17} /> : <Activity size={17} />}
              Registrar outra atividade
            </button>
          </div>
          {!active && data.routines.length > 0 && (
            <div className="today-picker">
              <label>Qual treino você quer fazer hoje?</label>
              <Choice
                label="Escolher treino de hoje"
                value={manual?.id ?? "auto"}
                onChange={(id) => {
                  if (id === "auto") onAuto();
                  else {
                    const selected = data.routines.find((r) => r.id === id);
                    if (selected) onChoose(selected);
                  }
                }}
                options={[
                  { value: "auto", label: "Seguir programação da semana" },
                  ...data.routines.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
              <p>
                {manual
                  ? "Esta escolha vale apenas para hoje. Sua programação semanal continua igual."
                  : "Os dias de cada rotina são definidos em Treinos → Editar rotina."}
              </p>
            </div>
          )}
        </section>
        <section className="card goal-card">
          <div className="card-top">
            <h2>Meta da semana</h2>
            <Target size={19} className="muted" />
          </div>
          <div className="goal-content">
            <div className="goal-ring">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle
                  cx="60"
                  cy="60"
                  r="49"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="7"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="49"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="7"
                  strokeDasharray={`${Math.min(count / goal, 1) * 308} 308`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div>
                <strong>
                  {count}
                  <small>/{goal}</small>
                </strong>
                <span>treinos</span>
              </div>
            </div>
            <div>
              <strong>
                {count >= goal ? "Meta alcançada!" : "Cada treino conta."}
              </strong>
              <p>
                {count >= goal
                  ? "Você cumpriu sua meta da semana."
                  : `Faltam ${goal - count} treinos para sua meta.`}
              </p>
              <span className="small muted">Apenas seus registros reais</span>
            </div>
          </div>
        </section>
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <span>
            <Dumbbell size={17} />
            Treinos concluídos
          </span>
          <div>
            {real.length}
            <small>no total</small>
          </div>
        </div>
        <div className="metric-card">
          <span>
            <Layers3 size={17} />
            Volume nesta semana
          </span>
          <div>
            {fmt(
              displayWeight(
                weekly.reduce((n, s) => n + calculateWorkoutVolume(s), 0),
                unit,
              ),
            )}
            <small>{unit}</small>
          </div>
        </div>
        <div className="metric-card">
          <span>
            <Clock3 size={17} />
            Tempo de treino
          </span>
          <div>
            {Math.round(
              weekly.reduce((n, s) => n + calculateWorkoutDuration(s), 0) / 60,
            )}
            <small>min nesta semana</small>
          </div>
        </div>
      </div>
      <div className="bottom-grid">
        <section>
          <SectionTitle
            title="Último treino"
            action="Ver histórico"
            onClick={() => onNavigate("history")}
          />
          {last ? (
            <button
              className="card last-workout"
              onClick={() => onSession(last)}
            >
              <div className="last-top">
                <div className="icon-box purple">
                  <Dumbbell size={23} />
                </div>
                <div>
                  <h3>{last.name}</h3>
                  <p>
                    {new Date(last.startedAt).toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "long",
                    })}
                    {sample && <span className="demo-label">Exemplo</span>}
                  </p>
                </div>
                <ArrowUpRight size={20} className="muted" />
              </div>
              <div className="last-stats">
                <div>
                  <span>Duração</span>
                  <strong>
                    {Math.round(calculateWorkoutDuration(last) / 60)}{" "}
                    <small>min</small>
                  </strong>
                </div>
                <div>
                  <span>Volume</span>
                  <strong>
                    {fmt(displayWeight(calculateWorkoutVolume(last), unit))}{" "}
                    <small>{unit}</small>
                  </strong>
                </div>
                <div>
                  <span>Exercícios</span>
                  <strong>
                    {
                      last.exercises.filter((e) => completedSets(e).length)
                        .length
                    }
                  </strong>
                </div>
              </div>
              <div className="last-foot">
                <Check size={15} />
                Treino concluído
                <span>
                  Ver detalhes
                  <ArrowRight size={15} />
                </span>
              </div>
            </button>
          ) : (
            <EmptyState
              title="Sua história começa aqui"
              description="Finalize um treino para ver seu primeiro registro."
            />
          )}
          <div className="routine-shortcuts">
            <SectionTitle
              title="Suas rotinas"
              action="Gerenciar"
              onClick={() => onNavigate("routines")}
            />
            <div className="shortcut-grid">
              {data.routines.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  className={`shortcut ${r.color}`}
                  onClick={() => onPreview(r)}
                >
                  <Dumbbell size={18} />
                  <span>
                    <strong>{r.name}</strong>
                    <small>{r.exercises.length} exercícios</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          </div>
        </section>
        <section>
          <SectionTitle
            title="Evolução em volume"
            action="Ver progresso"
            onClick={() => onNavigate("progress")}
          />
          <div className="card evolution-card">
            <div className="card-top">
              <div>
                <h3>{chartSessions[0]?.name ?? "Seu progresso"}</h3>
                <p>Volume total por sessão · {unit}</p>
              </div>
              {sample ? (
                <span className="tag">Demonstração</span>
              ) : (
                <TrendingUp size={20} className="lime" />
              )}
            </div>
            {chartSessions.length ? (
              <>
                <FitnessChart
                  points={chartSessions.map((s) => ({
                    date: new Date(s.startedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    }),
                    value: displayWeight(calculateWorkoutVolume(s), unit),
                  }))}
                  label="Volume"
                  unit={unit}
                />
                <div className="chart-caption">
                  <span className="chart-key" />{" "}
                  {sample
                    ? "Valores fictícios para visualizar o gráfico"
                    : "Soma de carga × repetições das séries concluídas"}
                </div>
              </>
            ) : (
              <EmptyState
                title="Evolução, série após série"
                description="Seus gráficos aparecerão depois do primeiro treino."
              />
            )}
          </div>
        </section>
      </div>
      {active && (
        <Modal
          open={finishConfirm}
          title="Concluir este treino?"
          description="Confira o resumo. As séries ainda pendentes serão marcadas como puladas."
          onClose={() => setFinishConfirm(false)}
        >
          <div className="summary-grid">
            <div>
              <strong>
                {Math.round(calculateWorkoutDuration(active) / 60)} min
              </strong>
              <span>Duração</span>
            </div>
            <div>
              <strong>{activeDone}</strong>
              <span>Séries concluídas</span>
            </div>
            <div>
              <strong>
                {fmt(displayWeight(calculateWorkoutVolume(active), unit))}
              </strong>
              <span>{unit} de volume</span>
            </div>
            <div>
              <strong>{Math.max(0, activeAll - activeDone)}</strong>
              <span>Séries pendentes</span>
            </div>
          </div>
          <div className="form-actions">
            <button
              className="secondary"
              onClick={() => setFinishConfirm(false)}
            >
              Continuar treino
            </button>
            <button
              className="primary"
              onClick={() => {
                setFinishConfirm(false);
                onFinish({
                  ...active,
                  status: "completed",
                  finishedAt: new Date().toISOString(),
                  exercises: active.exercises.map((exercise) => ({
                    ...exercise,
                    sets: exercise.sets.map((set) =>
                      set.status === "pending"
                        ? { ...set, status: "skipped" as const }
                        : set,
                    ),
                  })),
                });
              }}
            >
              <Flag size={17} />
              Concluir e ver histórico
            </button>
          </div>
        </Modal>
      )}
      {addingActivity && (
        <QuickActivity
          onClose={() => setAddingActivity(false)}
          onSave={(session) => {
            setAddingActivity(false);
            onAddActivity(session);
          }}
        />
      )}
    </>
  );
}
