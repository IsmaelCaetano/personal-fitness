"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ChevronRight,
  CloudCheck,
  Dumbbell,
  House,
  ChartNoAxesCombined,
  History,
  LoaderCircle,
  UserRound,
  WifiOff,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Confirm } from "./shared";
import { RoutinePreview } from "./routine-preview";
import { Dashboard } from "./dashboard";
import { Routines } from "./routines";
import { Workout } from "./workout";
import { History as HistoryPage, SessionDetails } from "./history";
import { ProgressPage } from "./progress";
import { ProfilePage } from "./profile";
import { ProfileOnboarding } from "./profile-onboarding";
import { useFitness } from "./use-fitness";
import { library } from "@/lib/fitness/seed";
import { newId, type Routine, type Session } from "@/lib/fitness/model";
import {
  completedSets,
  getPreviousExercisePerformance,
  localDate,
} from "@/lib/fitness/domain";
import { alternativesForPlan } from "@/lib/fitness/recommendations";
import { NotificationBell } from './notification-bell';
import { AssignedFeedback } from './assigned-feedback';
const navigation = [
  { id: "today", label: "Hoje", icon: House },
  { id: "routines", label: "Treinos", icon: Dumbbell },
  { id: "history", label: "Histórico", icon: History },
  { id: "progress", label: "Progresso", icon: ChartNoAxesCombined },
  { id: "profile", label: "Perfil", icon: UserRound },
];
export function FitnessApp({ uid, email }: { uid: string; email: string }) {
  const store = useFitness(uid);
  const { data, mutate } = store;
  const [view, setView] = useState("today");
  const [details, setDetails] = useState<Session | null>(null);
  const [exerciseId, setExerciseId] = useState<string>();
  const [newRoutine, setNewRoutine] = useState(false);
  const [resolve, setResolve] = useState(false);
  const [preview, setPreview] = useState<Routine | null>(null);
  const [assigned, setAssigned] = useState<(Routine & { trainerId: string; assignmentId: string; trainerName?: string })[]>([]);
  useEffect(() => {
    fetch('/api/trainer/assigned', { cache: 'no-store' }).then((response) => response.ok ? response.json() : { routines: [] }).then((payload: { routines: (Routine & { trainerId: string; assignmentId: string; trainerName?: string })[] }) => setAssigned(payload.routines)).catch(() => {});
  }, []);
  useEffect(() => {
    const initial = window.location.hash.slice(1);
    if (["today", "routines", "history", "progress", "profile", "active"].includes(initial)) queueMicrotask(() => setView(initial));
    const listener = () => setView(window.location.hash.slice(1) || "today");
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
  }, []);
  useEffect(() => {
    if (data) document.documentElement.dataset.theme = data.profile.theme;
  }, [data]);
  const navigate = (next: string) => {
    setView(next);
    if (next !== "routines") setNewRoutine(false);
    window.history.pushState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
  };
  function start(r: Routine, substitutions?: Record<string, string>) {
    if (!data) return;
    if (data.sessions.some((s) => s.status === "active")) {
      navigate("active");
      toast("Você já tem um treino em andamento.");
      return;
    }
    if (!r.exercises.length) {
      toast.error("Adicione exercícios à rotina antes de iniciar.");
      return;
    }
    const exercises = [...library, ...data.exercises];
    if (
      substitutions === undefined &&
      r.exercises.some(
        (p) =>
          alternativesForPlan(p, exercises)
            .length,
      )
    ) {
      setPreview(r);
      return;
    }
    const chosen = substitutions ?? {};
    const session: Session = {
      id: newId(),
      routineId: r.id,
      name: r.name,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: "active",
      notes: "",
      isDemo: false,
      exercises: r.exercises.map((p) => {
        const requested = chosen[p.id];
        const exerciseId =
          requested &&
          alternativesForPlan(p, exercises).includes(requested)
            ? requested
            : p.exerciseId;
        const exercise =
          exercises.find((e) => e.id === exerciseId) ??
          exercises.find((e) => e.id === p.exerciseId)!;
        const old = getPreviousExercisePerformance(data.sessions, exercise.id);
        const previous = old?.exercise ? completedSets(old.exercise) : [];
        const activity = p.targetType && p.targetType !== "reps";
        return {
          id: newId(),
          exercise: { ...exercise },
          plan: { ...p },
          sets: Array.from({ length: p.sets }, (_, i) => ({
            id: newId(),
            weight:
              previous[i]?.weight ??
              (activity ? 0 : (p.targetWeights?.[i] ?? p.suggestedWeight ?? null)),
            reps:
              previous[i]?.reps ?? (activity ? Math.max(1, p.minReps) : null),
            rir: null,
            rpe: null,
            type: "normal",
            status: "pending",
            notes: "",
            completedAt: null,
          })),
        };
      }),
    };
    mutate("session", session);
    navigate("active");
  }
  const choose = (r: Routine) => {
    if (!data) return;
    mutate("profile", {
      ...data.profile,
      todayChoice: { date: localDate(), routineId: r.id },
    });
    toast.success(`${r.name} escolhido para hoje`);
    navigate("today");
  };
  const finishSession = (session: Session) => {
    mutate("session", session);
    navigate("history");
    setDetails(session);
    toast.success(
      session.status === "completed"
        ? "Treino concluído. Bom trabalho!"
        : "Treino cancelado.",
    );
  };
  const addActivity = (session: Session) => {
    mutate("session", session);
    navigate("history");
    setDetails(session);
    toast.success(`${session.name} registrado no histórico`);
  };
  const active = data?.sessions.find((s) => s.status === "active");
  const selected = view === "active" ? "today" : view;
  const statusLabel =
    store.status === "loading"
      ? "Carregando..."
      : store.status === "saving"
        ? "Salvando..."
        : store.status === "offline"
          ? store.localSafe
            ? "Salvo neste aparelho"
            : "Não salvo"
          : store.status === "error"
            ? "Erro ao salvar"
            : "Tudo salvo";
  if (data && !data.profile.onboarded)
    return (
      <>
        <ProfileOnboarding data={data} mutate={mutate} />
        <Toaster position="top-center" theme={data.profile.theme} richColors />
      </>
    );
  return (
    <SidebarProvider>
      <Sidebar collapsible="none" className="fitness-sidebar">
        <SidebarHeader className="brand">
          <div className="brand-icon">
            <Dumbbell size={25} />
          </div>
          <div>
            personal
            <span>
              fitness<span className="brand-dot">.</span>
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-label">SEU ESPAÇO</div>
          <SidebarMenu>
            {navigation.map(({ id, label, icon: Icon }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  isActive={selected === id}
                  onClick={() => navigate(id)}
                  className="fitness-nav-item"
                >
                  <Icon />
                  <span>{label}</span>
                  {selected === id && <span className="nav-indicator" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          {active && (
            <button
              className="sidebar-active"
              onClick={() => navigate("active")}
            >
              <Activity size={18} />
              <span>
                Treino em andamento<strong>{active.name}</strong>
              </span>
              <ChevronRight size={17} />
            </button>
          )}
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-mantra">
            <div className="eyebrow">
              FEITO É MELHOR
              <br />
              QUE PERFEITO.
            </div>
            <p>Volte. Registre. Evolua.</p>
          </div>
          <button
            className="sidebar-profile"
            onClick={() => navigate("profile")}
          >
            <span className="avatar">
              {data?.profile.name.slice(0, 1) ?? "I"}
            </span>
            <span>
              <strong>{data?.profile.name ?? "Ismael"}</strong>
              <small>Meu espaço pessoal</small>
            </span>
            <ChevronRight size={17} />
          </button>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-brand">
              <Dumbbell size={21} />
            </span>
            <span>Personal Fitness</span>
            <ChevronRight size={14} />
            <strong>
              {navigation.find((n) => n.id === selected)?.label ?? "Hoje"}
            </strong>
          </div>
          <div className="topbar-right">
            <span
              className={`save-status ${store.status === "error" ? "error-text" : ""}`}
              role="status"
            >
              {store.status === "saving" ? (
                <LoaderCircle size={15} className="spin" />
              ) : store.status === "offline" || !store.online ? (
                <WifiOff size={15} />
              ) : (
                <CloudCheck size={15} />
              )}
              <span>
                {!store.online && store.status === "saved"
                  ? "Sem conexão"
                  : statusLabel}
              </span>
            </span>
            <button
              className="avatar"
              onClick={() => navigate("profile")}
              aria-label="Abrir perfil"
            >
              {data?.profile.name.slice(0, 1) ?? "I"}
            </button>
          </div>
        </header>
        <main className="content-area">
          {store.error && (
            <div className="error-banner" role="alert">
              <span>{store.error}</span>
              <button
                onClick={() =>
                  store.conflict
                    ? setResolve(true)
                    : data
                      ? store.retry()
                      : store.reload()
                }
              >
                {store.conflict ? "Resolver conflito" : "Tentar novamente"}
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-page">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
              <p>
                {store.status === "error"
                  ? "Seus dados não puderam ser carregados."
                  : "Preparando seu espaço de treino..."}
              </p>
              {store.error.includes("Entre") && (
                <a
                  href="/signin-with-chatgpt?return_to=%2F"
                  target="_top"
                  className="primary"
                >
                  Entrar com ChatGPT
                </a>
              )}
            </div>
          ) : (
            <>
              {view === "today" && (
                <>
                <NotificationBell />
                {assigned.length > 0 && <section className="card"><h2>Treinos atribuídos pelo personal</h2><p>Escolha uma prescrição para ver e executar hoje. Seu histórico individual permanece salvo.</p><div>{assigned.map((routine) => <div className="routine-management" key={routine.id}><button className="secondary" onClick={() => setPreview(routine)}>{routine.name} · Ver treino</button><AssignedFeedback trainerId={routine.trainerId} assignmentId={routine.assignmentId}/></div>)}</div></section>}
                <Dashboard
                  data={data}
                  onStart={start}
                  onPreview={setPreview}
                  onChoose={choose}
                  onAuto={() =>
                    mutate("profile", {
                      ...data.profile,
                      todayChoice: undefined,
                    })
                  }
                  onNavigate={navigate}
                  onSession={setDetails}
                  onFinish={finishSession}
                  onAddActivity={addActivity}
                />
                </>
              )}{" "}
              {view === "routines" && (
                <Routines
                  data={data}
                  onPreview={setPreview}
                  onChoose={choose}
                  mutate={mutate}
                  createInitially={newRoutine}
                  onExercise={(id) => {
                    setExerciseId(id);
                    navigate("progress");
                  }}
                />
              )}
              {view === "active" &&
                (active ? (
                  <Workout
                    session={active}
                    data={data}
                    onChange={(s) => mutate("session", s)}
                    onProfileChange={(profile) => mutate("profile", profile)}
                    trainerAssignment={assigned.find((routine) => routine.id === active.routineId)}
                    onFinish={finishSession}
                    onBack={() => navigate("today")}
                  />
                ) : (
                  <Dashboard
                    data={data}
                    onPreview={setPreview}
                    onChoose={choose}
                    onAuto={() =>
                      mutate("profile", {
                        ...data.profile,
                        todayChoice: undefined,
                      })
                    }
                    onStart={start}
                    onNavigate={navigate}
                    onSession={setDetails}
                    onFinish={finishSession}
                    onAddActivity={addActivity}
                  />
                ))}
              {view === "history" && (
                <HistoryPage
                  data={data}
                  onSession={setDetails}
                  onAdd={(session) => {
                    mutate("session", session);
                    toast.success("Treino antigo adicionado ao histórico");
                  }}
                  onDelete={(session) => {
                    mutate("session", session, true);
                    if (details?.id === session.id) setDetails(null);
                    toast.success("Registro excluído do histórico");
                  }}
                />
              )}{" "}
              {view === "progress" && (
                <ProgressPage
                  key={exerciseId ?? "progress"}
                  data={data}
                  mutate={mutate}
                  initialExercise={exerciseId}
                />
              )}{" "}
              {view === "profile" && (
                <ProfilePage data={data} email={email} mutate={mutate} />
              )}{" "}
              {preview && (
                <RoutinePreview
                  routine={preview}
                  data={data}
                  onClose={() => setPreview(null)}
                  onStart={start}
                  onChoose={choose}
                  assigned={assigned.some((routine) => routine.id === preview.id)}
                  trainerName={assigned.find((routine) => routine.id === preview.id)?.trainerName}
                />
              )}{" "}
              {details && (
                <SessionDetails
                  session={details}
                  data={data}
                  onClose={() => setDetails(null)}
                />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>Personal Fitness</span>
          <span>Seu progresso. No seu ritmo.</span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Navegação principal">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            className={selected === id ? "active" : ""}
            aria-current={selected === id ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <Confirm
        open={resolve}
        title="Qual versão das alterações você quer manter?"
        description="Há versões diferentes do mesmo registro neste aparelho e na nuvem. Manter as alterações deste aparelho substitui somente os registros em conflito; usar a nuvem descarta somente essas alterações pendentes. Os outros treinos e o histórico ficam preservados."
        action="Manter minhas alterações"
        secondaryAction="Usar versão da nuvem"
        onClose={() => setResolve(false)}
        onSecondary={() => {
          setResolve(false);
          void store.resolveConflict('cloud');
        }}
        onConfirm={() => {
          setResolve(false);
          void store.resolveConflict('local');
        }}
      />
      <Toaster
        position="top-center"
        theme={data?.profile.theme ?? "dark"}
        richColors
      />
    </SidebarProvider>
  );
}
