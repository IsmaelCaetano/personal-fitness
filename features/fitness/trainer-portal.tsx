'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import type { Profile, Routine, Session } from '@/lib/fitness/model';
import { newId } from '@/lib/fitness/model';
import { initialData, library } from '@/lib/fitness/seed';
import { calculateWorkoutVolume } from '@/lib/fitness/domain';
import { downloadWorkoutPdf, toWorkoutPdfModel } from '@/lib/fitness/pdf';
import { RoutineEditor } from './routines';
import { NotificationBell } from './notification-bell';
import { AIWorkoutBuilder } from './ai-workout-builder';
import { effectivePaymentStatus } from '@/lib/fitness/payments';
import { StudentInviteForm } from './student-invite-form';
import type { StudentIntake } from '@/lib/fitness/student-intake';

type Link = { id: string; trainer_id: string; student_id: string; status: string; started_at: string | null };
type Invite = { id: string; trainer_id: string; email: string; student_name: string | null; status: string; expires_at: string };
type Assignment = { id: string; routine: Routine; version: number; updated_at: string };
type Student = { name: string; profile: Profile | null; sessions: Session[]; assignments: Assignment[] };
type Feedback = { id:string; category:string; message:string; response:string|null; status:'open'|'resolved'; created_at:string };
type Payment = { id:string; reference_month:string; due_date:string; amount:number; status:'pending'|'paid'|'overdue'|'waived'; paid_at:string|null; notes:string };
type Summary = { active:number; trainedThisWeek:number; feedbackPending:number; paymentsPending:number; paymentsOverdue:number };
type StudentMetric = { studentId:string; name:string; lastWorkout:string|null; sessions7:number; sessions30:number; planned7:number; completedPlanned7:number; percent:number|null; weeklyStreak:number; feedbackPending:number; paymentsPending:number; paymentsOverdue:number };
type Portal = { viewerId: string; profile: { account_type: 'individual' | 'trainer'; display_name: string }; relationships: Link[]; invites: Invite[]; names: { studentId: string; name: string }[] };

export function TrainerPortal() {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [replies, setReplies] = useState<Record<string,string>>({});
  const [payments,setPayments]=useState<Payment[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [metrics,setMetrics]=useState<StudentMetric[]>([]);
  const [amount,setAmount]=useState('');
  const [dueDate,setDueDate]=useState('');
  const [referenceMonth,setReferenceMonth]=useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Assignment | 'new' | {draftRoutine:Routine} | null>(null);
  const [drafts,setDrafts]=useState<Routine[]>([]);
  const [generating,setGenerating]=useState(false);
  const [newDraft, setNewDraft] = useState<Routine | null>(null);
  const [currentTime] = useState(() => Date.now());
  const [today] = useState(() => new Date().toISOString().slice(0,10));
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/trainer', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setPortal(await response.json() as Portal);
      const summaryResponse=await fetch('/api/trainer/summary',{cache:'no-store'});
      if(summaryResponse.ok){const payload=await summaryResponse.json() as {summary:Summary;students:StudentMetric[]};setSummary(payload.summary);setMetrics(payload.students);}
    } catch { setError('Não foi possível carregar o modo personal. Confira a conexão e as migrações.'); }
  }, []);
  const loadStudent = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/trainer/student?studentId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setStudent(await response.json() as Student);
      setSelected(id);
      const feedbackResponse=await fetch(`/api/trainer/feedback?studentId=${encodeURIComponent(id)}`,{cache:'no-store'});
      if(feedbackResponse.ok){const payload=await feedbackResponse.json() as {feedback:Feedback[]};setFeedback(payload.feedback??[]);}
      const paymentsResponse=await fetch(`/api/trainer/payments?studentId=${encodeURIComponent(id)}`,{cache:'no-store'});
      if(paymentsResponse.ok){const payload=await paymentsResponse.json() as {payments:Payment[]};setPayments(payload.payments??[]);}
    } catch { setError('Não foi possível abrir o aluno.'); }
  }, []);
  useEffect(() => {
    fetch('/api/trainer', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error();
      setPortal(await response.json() as Portal);
    }).catch(() => setError('Não foi possível carregar o modo personal. Confira a conexão e as migrações.'));
  }, []);
  async function action(body: {action:'register';displayName:string}|{action:'accept';inviteId:string}|{action:'invite';email:string;studentName:string;intake:StudentIntake}): Promise<boolean> {
    setError('');
    try {
      const response = await fetch('/api/trainer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string; delivery?: string };
      if (!response.ok) { setError(payload.error ?? 'Não foi possível concluir.'); return false; }
      await load();
      toast.success(body.action === 'invite' ? payload.delivery === 'in_app' ? 'Convite disponível no app para a conta existente. Avise o aluno para entrar.' : 'Convite enviado' : body.action === 'accept' ? 'Convite aceito' : 'Modo personal ativado');
      return true;
    } catch { setError('Sem conexão. Tente novamente.'); return false; }
  }
  const isTrainer = portal?.profile.account_type === 'trainer';
  const students = portal?.relationships.filter((link) => link.trainer_id !== link.student_id && link.status === 'active') ?? [];
  const ownStudents = isTrainer ? students : [];
  const completed = student?.sessions.filter((session) => session.status === 'completed' && !session.isDemo) ?? [];
  const recent = completed.filter((session) => currentTime - new Date(session.startedAt).getTime() < 7 * 86400000);
  const draft: Routine = editing === 'new' && newDraft ? newDraft : editing && editing !== 'new' ? 'draftRoutine' in editing ? editing.draftRoutine : editing.routine : { id: '', name: '', description: '', days: [], exercises: [], color: 'lime' };
  const studentData = student && selected ? { ...initialData(selected,student.name), profile: student.profile ?? initialData(selected,student.name).profile, sessions: student.sessions } : null;
  async function saveRoutine(routine: Routine) {
    if (!selected) return;
    const current = editing;
    if(current&&current!=='new'&&'draftRoutine' in current){setDrafts(previous=>previous.map(item=>item.id===current.draftRoutine.id?routine:item));setEditing(null);toast.success('Rascunho atualizado. Atribua quando estiver pronto.');return;}
    const response = await fetch('/api/trainer/student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: selected, routine, ...(current && current !== 'new' ? { assignmentId: current.id, version: current.version } : {}) }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setError(payload.error ?? 'Não foi possível atribuir o treino.'); return; }
    setEditing(null);
    await loadStudent(selected);
    toast.success('Treino atribuído ao aluno');
  }
  async function assignDraft(routine:Routine){
    if(!selected)return;
    const response=await fetch('/api/trainer/student',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:selected,routine})});
    const payload=await response.json() as {error?:string};
    if(!response.ok){setError(payload.error??'Não foi possível atribuir o rascunho.');return;}
    setDrafts(previous=>previous.filter(item=>item.id!==routine.id));await loadStudent(selected);toast.success('Treino atribuído ao aluno');
  }
  async function exportStudent(assignment: Assignment) {
    if (!student) return;
    const data = initialData(selected ?? '', student.name);
    data.profile = student.profile ?? { ...data.profile, name: student.name, goals: [], weeklyGoal: 1 };
    data.sessions = student.sessions;
    const model = toWorkoutPdfModel(data, [assignment.routine]);
    model.trainer = portal?.profile.display_name;
    await downloadWorkoutPdf(model);
  }
  async function respond(item:Feedback){
    try{const response=await fetch('/api/trainer/feedback',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,response:replies[item.id]??item.response??'',status:'resolved'})});
      if(!response.ok)throw new Error();if(selected)await loadStudent(selected);toast.success('Resposta enviada e feedback resolvido');
    }catch{setError('Não foi possível responder ao feedback.');}
  }
  async function savePayment(){
    if(!selected)return;
    const response=await fetch('/api/trainer/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:selected,referenceMonth:`${referenceMonth}-01`,dueDate,amount:Number(amount),status:'pending',notes:''})});
    const payload=await response.json() as {error?:string};
    if(!response.ok){setError(payload.error??'Não foi possível registrar o pagamento.');return;}
    await loadStudent(selected);await load();setAmount('');toast.success('Controle de pagamento criado');
  }
  async function markPayment(payment:Payment,status:'paid'|'waived'|'pending'){
    if(!selected)return;
    const response=await fetch('/api/trainer/payments',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:payment.id,data:{studentId:selected,referenceMonth:payment.reference_month,dueDate:payment.due_date,amount:payment.amount,status,paidAt:status==='paid'?new Date().toISOString():null,notes:payment.notes}})});
    if(!response.ok){setError('Não foi possível alterar o pagamento.');return;}
    await loadStudent(selected);await load();
  }
  return <div className="content-area trainer-portal" style={{ maxWidth: 1150, margin: 'auto', padding: 24 }}>
    <Toaster />
    <div className="page-heading"><div><div className="eyebrow">PERSONAL FITNESS</div><h1>Personal e alunos</h1><p>Convites, prescrições e acompanhamento.</p></div><Link className="secondary" href="/">Voltar aos meus treinos</Link></div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <NotificationBell />
    {!portal && !error && <p>Carregando...</p>}
    {portal && !isTrainer && <section className="card"><h2>Ativar modo personal</h2><p>Se você acompanha alunos, informe seu nome profissional.</p><label>Nome<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label><button className="primary" disabled={!name.trim()} onClick={() => action({ action: 'register', displayName: name })}>Ativar modo personal</button></section>}
    {portal?.invites.filter((invite) => !isTrainer && invite.status === 'pending').map((invite) => <section className="card" key={invite.id}><h2>Convite para acompanhamento</h2><p>Convite recebido para {invite.email}. Expira em {new Date(invite.expires_at).toLocaleDateString('pt-BR')}.</p><button className="primary" onClick={() => action({ action: 'accept', inviteId: invite.id })}>Aceitar convite</button></section>)}
    {isTrainer && <>
      {summary&&<section className="card"><h2>Resumo do acompanhamento</h2><div className="summary-grid"><div><strong>{summary.active}</strong><span>Alunos ativos</span></div><div><strong>{summary.trainedThisWeek}</strong><span>Treinaram em 7 dias</span></div><div><strong>{summary.feedbackPending}</strong><span>Feedbacks pendentes</span></div><div><strong>{summary.paymentsPending}</strong><span>Pagamentos pendentes</span></div><div><strong>{summary.paymentsOverdue}</strong><span>Pagamentos atrasados</span></div></div></section>}
      <section className="card"><h2>Pré-cadastrar aluno</h2><StudentInviteForm onInvite={action}/>{portal.invites.some(invite=>invite.status==='pending'&&invite.trainer_id===portal.viewerId)&&<div className="trainer-invite-list"><h3>Convites pendentes</h3>{portal.invites.filter(invite=>invite.status==='pending'&&invite.trainer_id===portal.viewerId).map(invite=><p key={invite.id}>{invite.student_name || 'Aluno'} · {invite.email} · expira em {new Date(invite.expires_at).toLocaleDateString('pt-BR')}</p>)}</div>}</section>
      <section className="card"><h2>Alunos ativos: {ownStudents.length}</h2>{ownStudents.length ? ownStudents.map((link) => {const metric=metrics.find(item=>item.studentId===link.student_id);return <div key={link.id} className="routine-management"><button className="secondary" onClick={() => loadStudent(link.student_id)}>{portal.names.find((person) => person.studentId === link.student_id)?.name ?? 'Abrir aluno'}</button><span>Último: {metric?.lastWorkout?.slice(0,10)??'—'} · 7d: {metric?.sessions7??'—'} · 30d: {metric?.sessions30??'—'} · Aderência: {metric?.percent==null?'—':`${metric.percent}%`} · Feedback: {metric?.feedbackPending??0} · Pendentes: {metric?.paymentsPending??0} · Atrasados: {metric?.paymentsOverdue??0}</span></div>;}) : <p>Envie um convite e aguarde o aluno aceitar.</p>}</section>
      {selected && student && <section className="card"><h2>{student.name}</h2><p>Objetivo: {student.profile?.goals.join(', ') || 'Não informado'} · Meta: {student.profile?.weeklyGoal ?? '—'} dias/semana</p><p>Último treino: {completed[0] ? new Date(completed.sort((a,b) => b.startedAt.localeCompare(a.startedAt))[0].startedAt).toLocaleDateString('pt-BR') : 'Sem registros'} · Treinos nos últimos 7 dias: {recent.length}</p><button className="primary" onClick={() => { setNewDraft({ id: newId(), name: '', description: '', days: [], exercises: [], color: 'lime' }); setEditing('new'); }}>Criar e atribuir treino</button><h3>Prescrições</h3>{student.assignments.map((assignment) => <div key={assignment.id} className="routine-management"><strong>{assignment.routine.name}</strong><button className="secondary" onClick={() => setEditing(assignment)}>Editar</button><button className="secondary" onClick={() => exportStudent(assignment).catch(() => setError('Não foi possível criar o PDF.'))}>PDF</button></div>)}<h3>Histórico</h3>{completed.sort((a,b) => b.startedAt.localeCompare(a.startedAt)).slice(0,10).map((session) => <p key={session.id}>{new Date(session.startedAt).toLocaleDateString('pt-BR')} · {session.name} · Volume {Math.round(calculateWorkoutVolume(session))} kg</p>)}<h3>Feedbacks pendentes: {feedback.filter(item=>item.status==='open').length}</h3>{feedback.map(item=><div key={item.id} className="routine-management"><div><strong>{item.category} · {item.status}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleDateString('pt-BR')}</small></div>{item.status==='open'?<div><label>Resposta<textarea maxLength={2000} value={replies[item.id]??item.response??''} onChange={event=>setReplies({...replies,[item.id]:event.target.value})}/></label><button className="secondary" onClick={()=>respond(item)}>Responder e resolver</button></div>:<p>{item.response}</p>}</div>)}</section>}
      {selected&&student&&<section className="card"><h2>Constância e pagamentos</h2>{metrics.find(item=>item.studentId===selected)&&<p>Planejado vs concluído (7 dias): {metrics.find(item=>item.studentId===selected)?.completedPlanned7}/{metrics.find(item=>item.studentId===selected)?.planned7} · Aderência: {metrics.find(item=>item.studentId===selected)?.percent??"—"}% · Sequência semanal: {metrics.find(item=>item.studentId===selected)?.weeklyStreak??0}</p>}<h3>Registrar mensalidade</h3><div className="form-grid"><label>Mês de referência<input type="month" value={referenceMonth} onChange={event=>setReferenceMonth(event.target.value)}/></label><label>Vencimento<input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)}/></label><label>Valor (R$)<input type="number" min="0" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/></label></div><button className="primary" disabled={!referenceMonth||!dueDate||!amount} onClick={()=>savePayment().catch(()=>setError('Não foi possível salvar.'))}>Adicionar pagamento</button><h3>Registros</h3>{payments.length===0&&<p>Sem registros.</p>}{payments.map(payment=><div key={payment.id} className="routine-management"><span>{payment.reference_month.slice(0,7)} · R$ {payment.amount} · vencimento {payment.due_date} · {effectivePaymentStatus({status:payment.status,dueDate:payment.due_date},today)}</span><button className="secondary" onClick={()=>markPayment(payment,'paid')}>Pago</button><button className="secondary" onClick={()=>markPayment(payment,'waived')}>Isento</button><button className="secondary" onClick={()=>markPayment(payment,'pending')}>Pendente</button></div>)}</section>}
      {selected&&student&&<section className="card"><h2>Rascunhos para {student.name}</h2><button className="secondary" disabled={!student.profile?.onboarded} onClick={()=>setGenerating(true)}>Criar rascunho com IA</button>{!student.profile?.onboarded&&<p>O aluno deve concluir seu perfil antes da geração por IA.</p>}{drafts.map(routine=><div className="routine-management" key={routine.id}><strong>{routine.name}</strong><button className="secondary" onClick={()=>setEditing({draftRoutine:routine})}>Editar rascunho</button><button className="primary" onClick={()=>assignDraft(routine).catch(()=>setError('Não foi possível atribuir.'))}>Atribuir ao aluno</button></div>)}</section>}
    </>}
    {generating&&selected&&studentData&&<AIWorkoutBuilder data={studentData} studentId={selected} exercises={library} onClose={()=>setGenerating(false)} onSave={routines=>{setDrafts(previous=>[...previous,...routines]);setGenerating(false);}}/>}
    {editing && selected && <RoutineEditor key={editing === 'new' ? 'new' : 'draftRoutine' in editing ? editing.draftRoutine.id : editing.id} routine={draft} exercises={library} defaultRest={student?.profile?.rest ?? 90} onClose={() => setEditing(null)} onCreateExercise={() => toast('Use a biblioteca para prescrever este aluno.')} onSave={saveRoutine} />}
  </div>;
}
