"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Download,
  Layers3,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FitnessData, Session } from "@/lib/fitness/model";
import {
  calculateWorkoutDuration,
  calculateWorkoutVolume,
  clock,
  completedSets,
  detectPersonalRecord,
  displayWeight,
  fmt,
} from "@/lib/fitness/domain";
import { Choice, Modal, EmptyState, Confirm } from "./shared";
import { PastWorkoutEditor } from "./past-workout";
import { ExportPeriod } from "./export-period";

export function History({
  data,
  onSession,
  onAdd,
  onDelete,
}: {
  data: FitnessData;
  onSession: (s: Session) => void;
  onAdd: (s: Session) => void;
  onDelete: (s: Session) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState<Session | null>(null);
  const sessions = data.sessions
    .filter((s) => s.status === "completed" || s.status === "cancelled")
    .filter(
      (s) => filter === "all" || (filter === "real" ? !s.isDemo : s.isDemo),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const months = [
    ...new Set(
      sessions.map((s) =>
        new Date(s.startedAt).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        }),
      ),
    ),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CADA SÉRIE FICA NA HISTÓRIA</div>
          <h1>Histórico</h1>
          <p>Reveja cargas, volume e consistência.</p>
        </div>
        <div className="history-actions">
          <Choice
            label="Filtrar histórico"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todos os registros" },
              { value: "real", label: "Meus treinos" },
              { value: "demo", label: "Demonstração" },
            ]}
          />
          <button className="secondary" onClick={() => setExporting(true)}>
            <Download size={17} />
            Exportar período
          </button>
          <button className="primary" onClick={() => setAdding(true)}>
            <Plus size={17} />
            Registrar treino antigo
          </button>
        </div>
      </div>
      {!sessions.length ? (
        <EmptyState
          title="Nenhum treino por aqui"
          description="Seus treinos finalizados aparecerão nesta página."
        >
          <button className="primary" onClick={() => setAdding(true)}>
            Registrar treino antigo
          </button>
        </EmptyState>
      ) : (
        months.map((month) => (
          <section key={month} className="history-month">
            <h2>{month}</h2>
            {sessions
              .filter(
                (s) =>
                  new Date(s.startedAt).toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  }) === month,
              )
              .map((s) => {
                const volume = calculateWorkoutVolume(s);
                return (
                  <article className="card history-item" key={s.id}>
                    <button
                      className="history-open"
                      onClick={() => onSession(s)}
                    >
                      <div className="history-date">
                        <strong>{new Date(s.startedAt).getDate()}</strong>
                        <span>
                          {new Date(s.startedAt)
                            .toLocaleDateString("pt-BR", { weekday: "short" })
                            .replace(".", "")}
                        </span>
                      </div>
                      <div className="history-name">
                        <h3>{s.name}</h3>
                        <span>
                          {s.status === "cancelled"
                            ? "Cancelado"
                            : `${s.exercises.filter((e) => completedSets(e).length).length} exercícios`}
                          {s.isDemo && (
                            <span className="demo-label">Exemplo</span>
                          )}
                        </span>
                      </div>
                      <div className="history-metrics">
                        <span>
                          <Clock3 size={16} />
                          {Math.round(calculateWorkoutDuration(s) / 60)} min
                        </span>
                        <span className="history-volume">
                          <Layers3 size={16} />
                          <b>Volume</b>{" "}
                          {fmt(displayWeight(volume, data.profile.unit))}{" "}
                          {data.profile.unit}
                        </span>
                      </div>
                      <ArrowUpRight size={19} />
                    </button>
                    <button
                      className="history-delete icon-button"
                      aria-label={`Excluir ${s.name} de ${new Date(s.startedAt).toLocaleDateString("pt-BR")}`}
                      onClick={() => setDeleting(s)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </article>
                );
              })}
          </section>
        ))
      )}
      {adding && (
        <PastWorkoutEditor
          data={data}
          onClose={() => setAdding(false)}
          onSave={(session) => {
            onAdd(session);
            setAdding(false);
          }}
        />
      )}
      {exporting && (
        <ExportPeriod data={data} onClose={() => setExporting(false)} />
      )}
      <Confirm
        open={!!deleting}
        title="Excluir este registro?"
        description="Este treino será removido do histórico e deixará de contar no volume e nos gráficos. A rotina continuará disponível."
        action="Excluir registro"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) onDelete(deleting);
          setDeleting(null);
        }}
      />
    </>
  );
}

export function SessionDetails({
  session,
  data,
  onClose,
}: {
  session: Session;
  data: FitnessData;
  onClose: () => void;
}) {
  const records = detectPersonalRecord(session, data.sessions);
  return (
    <Modal
      open
      title={session.name}
      description={`${new Date(session.startedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })} · ${session.status === "cancelled" ? "Cancelado" : "Concluído"}${session.isDemo ? " · Dados demonstrativos" : ""}`}
      onClose={onClose}
      wide
    >
      <div className="summary-grid">
        <div>
          <strong>{clock(calculateWorkoutDuration(session))}</strong>
          <span>Duração</span>
        </div>
        <div>
          <strong>{session.exercises.flatMap(completedSets).length}</strong>
          <span>Séries</span>
        </div>
        <div>
          <strong>
            {fmt(
              displayWeight(calculateWorkoutVolume(session), data.profile.unit),
            )}
          </strong>
          <span>{data.profile.unit} de volume</span>
        </div>
        <div>
          <strong>{records.length}</strong>
          <span>Recordes</span>
        </div>
      </div>
      {session.exercises.map((e) => (
        <div className="history-exercise" key={e.id}>
          <h3>{e.exercise.name}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Série</TableHead>
                <TableHead>Carga</TableHead>
                <TableHead>Reps/Alvo</TableHead>
                <TableHead>RIR</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {e.sets.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {i + 1}
                    <small className="block muted">
                      {
                        {
                          warmup: "Aquecimento",
                          normal: "Normal",
                          drop: "Drop-set",
                          backoff: "Back-off",
                        }[s.type]
                      }
                    </small>
                  </TableCell>
                  <TableCell>
                    {e.plan.targetType && e.plan.targetType !== "reps"
                      ? "—"
                      : s.weight === null
                        ? "—"
                        : `${fmt(displayWeight(s.weight, data.profile.unit), 1)} ${data.profile.unit}`}
                  </TableCell>
                  <TableCell>
                    {e.plan.targetType && e.plan.targetType !== "reps"
                      ? e.plan.targetText
                      : (s.reps ?? "—")}
                  </TableCell>
                  <TableCell>{s.rir === 4 ? "4+" : (s.rir ?? "—")}</TableCell>
                  <TableCell>
                    {s.status === "completed" ? (
                      <Check size={17} className="lime" />
                    ) : s.status === "skipped" ? (
                      "Pulada"
                    ) : (
                      "Pendente"
                    )}
                    {s.notes && <p className="small">{s.notes}</p>}
                    {s.rpe !== null && <small>RPE {s.rpe}</small>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      {records.length > 0 && (
        <div className="records-list">
          <h3>
            <Trophy size={18} />
            Recordes nesta sessão
          </h3>
          {records.map((r, i) => (
            <p key={i}>
              {r.exercise}
              <span>{r.kind}</span>
            </p>
          ))}
        </div>
      )}
      {session.notes && <p className="session-detail-notes">{session.notes}</p>}
    </Modal>
  );
}
