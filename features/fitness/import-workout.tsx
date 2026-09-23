"use client";
import { useRef, useState } from "react";
import { Check, FileImage, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { toast } from "sonner";
import { Modal } from "./shared";
import {
  parseWorkoutText,
  compileImport,
  type ImportDraft,
  type ImportRow,
} from "@/lib/fitness/import";
import {
  routineSchema,
  type Exercise,
  type Routine,
} from "@/lib/fitness/model";
const example =
  "SEMANA PADRÃO\nDia 1 — Segunda: Push (manhã) + Pull (noite)\nDia 2 — Terça: Pernas + futebol\nDia 7 — Domingo: descanso\n\nSEGUNDA — PUSH (MANHÃ)\nSupino reto — 3×6–8 — cargas alvo: 100 / 110 / 120 kg — descanso 180 s\nCrossover — 3×10–12 — 1–2 repetições de reserva — descanso 90 s\n\nSEGUNDA — PULL (NOITE)\nPuxada alta — 3×8–12 — aumentar a carga a cada série — descanso 120 s\n\nTERÇA — PERNAS\nLeg press — 3×10–12 — começar com 160–200 kg — descanso 180 s\nCardio — futebol, aproximadamente 1 h.\n\nDOMINGO — DESCANSO";
const jsonExample = JSON.stringify(
  {
    routines: [
      {
        name: "Treino A",
        days: [1, 4],
        exercises: [
          {
            name: "Leg Press",
            sets: 3,
            reps: "8-12",
            weight: "200 kg",
            rest: 120,
            notes: "RIR 2-3",
            alternatives: ["Agachamento livre", "Cadeira extensora"],
          },
        ],
      },
    ],
  },
  null,
  2,
);
export function ImportWorkout({
  exercises,
  routines,
  rest,
  onClose,
  onImport,
}: {
  exercises: Exercise[];
  routines: Routine[];
  rest: number;
  onClose: () => void;
  onImport: (
    result: { routines: Routine[]; custom: Exercise[] },
    removeIds: string[],
  ) => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<ImportDraft[] | null>(null);
  const [remove, setRemove] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [readingImage, setReadingImage] = useState(false);
  const [imageName, setImageName] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const imageFile = useRef<HTMLInputElement>(null);
  function patch(did: string, rid: string, values: Partial<ImportRow>) {
    setDrafts((previous) =>
      previous!.map((d) =>
        d.id === did
          ? {
              ...d,
              rows: d.rows.map((r) => (r.id === rid ? { ...r, ...values } : r)),
            }
          : d,
      ),
    );
  }
  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 250000) {
      setError("Use um arquivo de texto com até 250 KB.");
      return;
    }
    if (!/\.(txt|csv|tsv|md|json)$/i.test(file.name)) {
      setError(
        "Use JSON, TXT, CSV, TSV ou MD. Para PDF ou foto, copie o texto da ficha e cole abaixo.",
      );
      return;
    }
    setText(await file.text());
    setError("");
  }
  async function loadImage(selected: File | undefined) {
    if (!selected) return;
    if (selected.size > 8_000_000) { setError("Use uma imagem de até 8 MB."); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowed.includes(selected.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(selected.name)) { setError("Use uma foto JPG, PNG, WEBP ou HEIC."); return; }
    setReadingImage(true); setError(""); setImageName(selected.name);
    try {
      const original = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Não foi possível abrir a imagem.")); reader.readAsDataURL(selected); });
      let image = original;
      let mimeType = selected.type || (selected.name.toLowerCase().endsWith(".heic") ? "image/heic" : selected.name.toLowerCase().endsWith(".webp") ? "image/webp" : selected.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      image = image.replace(/^data:[^;]+;base64,/, `data:${mimeType};base64,`);
      if (selected.size > 2_500_000) {
        image = await new Promise<string>((resolve, reject) => { const picture = new Image(); picture.onload = () => { const scale = Math.min(1, 2200 / Math.max(picture.width, picture.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(picture.width * scale); canvas.height = Math.round(picture.height * scale); canvas.getContext("2d")?.drawImage(picture, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.8)); }; picture.onerror = () => reject(new Error("O navegador não conseguiu reduzir a foto. Use JPG ou PNG menor.")); picture.src = original; });
        mimeType = "image/jpeg";
      }
      if (image.length > 3_700_000) throw new Error("A foto continua grande demais. Recorte a ficha e tente novamente.");
      const response = await fetch("/api/ai/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, mimeType }) });
      const result = await response.json() as { text?: string; error?: string };
      if (!response.ok || !result.text) throw new Error(result.error ?? "Não foi possível ler a imagem.");
      setText(result.text); toast.success("Imagem lida. Revise a transcrição antes de organizar.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível ler a imagem."); }
    finally { setReadingImage(false); if (imageFile.current) imageFile.current.value = ""; }
  }
  function review() {
    setError("");
    if (!text.trim()) {
      setError("Cole sua ficha ou selecione um arquivo de texto.");
      return;
    }
    const parsed = parseWorkoutText(text, exercises, rest);
    if (!parsed.length) {
      setError("Nenhum exercício encontrado. Confira o guia de formato.");
      return;
    }
    if (parsed.length > 12) {
      setError(
        `Foram detectadas ${parsed.length} rotinas. Use um título em uma linha e os exercícios logo abaixo, conforme o guia.`,
      );
      return;
    }
    setDrafts(parsed);
  }
  function commit() {
    try {
      if (!drafts) return;
      for (const d of drafts)
        for (const r of d.rows)
          if (!r.name.trim())
            throw new Error("Preencha o nome de todos os exercícios.");
      const result = compileImport(drafts, exercises);
      for (const r of result.routines) {
        const valid = routineSchema.safeParse(r);
        if (!valid.success)
          throw new Error(
            `Confira ${r.name}: ${valid.error.issues[0].message}`,
          );
      }
      if (remove.length && !confirmed)
        throw new Error("Confirme a exclusão das rotinas selecionadas.");
      onImport(result, remove);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise a ficha.");
    }
  }
  return (
    <Modal
      open
      wide
      title={drafts ? "Confira sua ficha" : "Organizar e importar meu treino"}
      description={
        drafts
          ? "Revise nomes e números antes de adicionar. Nada foi salvo ainda."
          : "Cole uma descrição do seu treino. O organizador identifica rotinas, exercícios, séries, repetições e descanso."
      }
      onClose={onClose}
    >
      {!drafts && (
        <details className="import-guide" open>
          <summary>Guia do formato recomendado</summary>
          <div className="import-guide-body">
            <ol>
              <li>Uma semana pode ter duas sessões no mesmo dia: use títulos como “SEGUNDA — PUSH (MANHÃ)” e “SEGUNDA — PULL (NOITE)”.</li>
              <li>Logo abaixo, coloque um exercício por linha.</li>
              <li>
                Use a ordem: exercício — séries e repetições — carga — descanso
                — observações.
              </li>
              <li>
                A agenda aceita “Dia 1 — Segunda: Push + Pull”, cardio no fim da sessão e “DOMINGO — DESCANSO”. O descanso não cria um treino.
              </li>
              <li>Cargas por série (“100 / 110 / 120 kg”), carga por lado, metas condicionais e minutos são mantidos na prévia. Confira cada associação antes de salvar.</li>
              <li>
                As substituições são sugeridas automaticamente. No JSON, use
                “alternatives” com nomes de exercícios para ajustar as escolhas.
              </li>
            </ol>
            <code>Supino reto — 3×6–8 — cargas alvo: 100 / 110 / 120 kg — descanso 180 s</code>
            <div className="guide-actions">
              <button
                className="secondary"
                type="button"
                onClick={() => setText(example)}
              >
                Inserir modelo em texto
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => setText(jsonExample)}
              >
                Inserir modelo JSON
              </button>
            </div>
          </div>
        </details>
      )}
      {!drafts ? (
        <>
          <div className="import-format">
            <FileText size={21} />
            <div>
              <strong>Pode escrever do seu jeito</strong>
              <p>
                Cole uma semana inteira, inclusive duas sessões no mesmo dia,
                futebol, cardio e descanso. JSON também é aceito.
              </p>
            </div>
          </div>
          <label className="import-input-label">
            Sua ficha
            <textarea
              rows={12}
              value={text}
              maxLength={50000}
              onChange={(e) => setText(e.target.value)}
              placeholder={example}
              aria-label="Texto da ficha de treino"
            />
          </label>
          <input
            ref={file}
            type="file"
            accept=".json,.txt,.csv,.tsv,.md,application/json,text/plain,text/csv,text/tab-separated-values,text/markdown"
            hidden
            onChange={(e) => void loadFile(e.target.files?.[0])}
          />
          <input ref={imageFile} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" hidden onChange={(e) => void loadImage(e.target.files?.[0])}/>
          <div className="import-actions">
            <div className="import-upload-group"><button className="secondary" onClick={() => file.current?.click()}><Upload size={16} />Selecionar arquivo</button><button className="secondary" disabled={readingImage} onClick={() => imageFile.current?.click()}>{readingImage ? <LoaderCircle className="spin" size={16}/> : <FileImage size={16}/>} {readingImage ? "Lendo imagem..." : "Ler foto da ficha"}</button></div>
            <button className="text-button" onClick={() => setText(example)}>
              Usar exemplo de formato
            </button>
          </div>
          {imageName && <div className="image-read-status"><FileImage size={16}/><span><strong>{imageName}</strong>{readingImage ? " está sendo analisada" : " foi transcrita. Confira o texto acima."}</span></div>}
          <p className="small muted">
            Texto livre, foto, JSON, TXT, CSV, TSV ou MD. Cargas em kg/lbs,
            descanso, RIR, minutos, segundos e metros são reconhecidos. A foto
            é enviada ao provedor de IA para transcrição e você revisa antes de salvar.
          </p>
          <button className="primary full" disabled={readingImage} onClick={review}>
            Organizar treino e revisar
          </button>
        </>
      ) : (
        <>
          <div className="import-summary">
            <Check size={19} />
            {drafts.length} rotina(s) ·{" "}
            {drafts.reduce((n, d) => n + d.rows.length, 0)} exercícios
          </div>
          {drafts.map((d) => (
            <section key={d.id} className="import-routine">
              <label>
                Nome da rotina
                <input
                  value={d.name}
                  maxLength={80}
                  onChange={(e) =>
                    setDrafts(
                      drafts.map((x) =>
                        x.id === d.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <div className="import-day-picker">
                <span>Dia(s) da semana</span>
                <div>
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, day) => (
                    <button key={day} type="button" className={d.days.includes(day) ? "selected" : ""} aria-pressed={d.days.includes(day)} aria-label={`${label} para ${d.name}`} onClick={() => setDrafts(drafts.map((item) => item.id === d.id ? { ...item, days: item.days.includes(day) ? item.days.filter((value) => value !== day) : [...item.days, day] } : item))}>{label}</button>
                  ))}
                </div>
              </div>
              {d.rows.map((r, i) => (
                <div className="import-row" key={r.id}>
                  <div className="import-row-title">
                    <strong>{i + 1}.</strong>
                    <input
                      aria-label={`Nome do exercício ${i + 1}`}
                      value={r.name}
                      maxLength={120}
                      onChange={(e) =>
                        patch(d.id, r.id, {
                          name: e.target.value,
                          exerciseId: null,
                        })
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label={`Remover ${r.name}`}
                      onClick={() =>
                        setDrafts(
                          drafts.map((x) =>
                            x.id === d.id
                              ? {
                                  ...x,
                                  rows: x.rows.filter((row) => row.id !== r.id),
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="import-match">
                    <span>
                      {r.exerciseId
                        ? "Vinculado à biblioteca"
                        : "Novo exercício personalizado"}
                    </span>
                    <Combobox<Exercise>
                      items={exercises}
                      value={
                        exercises.find((e) => e.id === r.exerciseId) ?? null
                      }
                      itemToStringLabel={(e) => e.name}
                      onValueChange={(e) => {
                        if (e)
                          patch(d.id, r.id, { exerciseId: e.id, name: e.name });
                      }}
                    >
                      <ComboboxInput
                        placeholder="Associar a um exercício da biblioteca..."
                        aria-label={`Vincular ${r.name}`}
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>
                          Sem correspondência. Será criado como personalizado.
                        </ComboboxEmpty>
                        <ComboboxList>
                          {(e: Exercise) => (
                            <ComboboxItem key={e.id} value={e}>
                              {e.name}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                  <div className="plan-fields">
                    <label>
                      Séries
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={r.sets}
                        onChange={(e) =>
                          patch(d.id, r.id, { sets: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Reps mín.
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={r.minReps}
                        onChange={(e) =>
                          patch(d.id, r.id, { minReps: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Reps máx.
                      <input
                        type="number"
                        min={r.minReps}
                        max={100}
                        value={r.maxReps}
                        onChange={(e) =>
                          patch(d.id, r.id, { maxReps: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Descanso (s)
                      <input
                        type="number"
                        min={0}
                        max={900}
                        value={r.rest}
                        onChange={(e) =>
                          patch(d.id, r.id, { rest: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <p className="import-target">
                    Alvo: <strong>{r.targetText}</strong>
                    {r.loadText ? ` · Carga: ${r.loadText}` : ""}
                  </p>
                  {r.issue && <p className="import-warning">{r.issue}</p>}
                  <label className="import-notes">
                    Observações
                    <input
                      value={r.notes}
                      maxLength={2000}
                      onChange={(e) =>
                        patch(d.id, r.id, { notes: e.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
            </section>
          ))}
          {routines.length > 0 && (
            <section className="import-replace">
              <h3>Excluir alguma rotina antiga?</h3>
              <p>
                Apenas as rotinas marcadas serão excluídas. Seus treinos já
                registrados serão preservados.
              </p>
              <div className="replace-options">
                {routines.map((r) => (
                  <label key={r.id}>
                    <Checkbox
                      checked={remove.includes(r.id)}
                      onCheckedChange={(checked) => {
                        setRemove(
                          checked
                            ? [...remove, r.id]
                            : remove.filter((id) => id !== r.id),
                        );
                        setConfirmed(false);
                      }}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
              {remove.length > 0 && (
                <label className="delete-confirm-label">
                  <Checkbox
                    checked={confirmed}
                    onCheckedChange={(v) => setConfirmed(!!v)}
                  />
                  Confirmo a exclusão de {remove.length} rotina(s)
                  selecionada(s).
                </label>
              )}
            </section>
          )}
          <div className="form-actions">
            <button className="secondary" onClick={() => setDrafts(null)}>
              Voltar ao texto
            </button>
            <button
              className="primary"
              disabled={
                !drafts.some((d) => d.rows.length) ||
                (!!remove.length && !confirmed)
              }
              onClick={commit}
            >
              <Check size={17} />
              Importar {drafts.length} rotina(s)
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </Modal>
  );
}
