'use client';
import { useState, type FormEvent } from 'react';
import { studentIntakeSchema, type StudentIntake } from '@/lib/fitness/student-intake';
import { goals } from './profile';

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function StudentInviteForm({onInvite}:{onInvite:(payload:{action:'invite';email:string;studentName:string;intake:StudentIntake})=>Promise<boolean>}) {
  const [studentName,setStudentName]=useState('');
  const [email,setEmail]=useState('');
  const [height,setHeight]=useState('');
  const [weight,setWeight]=useState('');
  const [selectedGoals,setSelectedGoals]=useState<string[]>([]);
  const [weeklyGoal,setWeeklyGoal]=useState('');
  const [level,setLevel]=useState<StudentIntake['level']>('iniciante');
  const [duration,setDuration]=useState('60');
  const [preferredDays,setPreferredDays]=useState<number[]>([]);
  const [equipment,setEquipment]=useState('');
  const [preferences,setPreferences]=useState('');
  const [limitations,setLimitations]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError('');
    const parsed=studentIntakeSchema.safeParse({
      height:Number(height.replace(',','.')),weight:Number(weight.replace(',','.')),
      goals:selectedGoals,weeklyGoal:Number(weeklyGoal),level,preferredDuration:Number(duration),
      preferredDays,availableEquipment:equipment.split(',').map(item=>item.trim()).filter(Boolean),
      preferences,limitations,
    });
    if(!parsed.success){setError('Confira altura, peso, objetivo, frequência e duração da ficha.');return;}
    setBusy(true);
    try {
      const saved=await onInvite({action:'invite',email:email.trim(),studentName:studentName.trim(),intake:parsed.data});
      if(saved){setStudentName('');setEmail('');setHeight('');setWeight('');setSelectedGoals([]);setWeeklyGoal('');setPreferredDays([]);setEquipment('');setPreferences('');setLimitations('');}
    } finally {setBusy(false);}
  };
  return <form className="trainer-intake" onSubmit={submit}>
    <p>Preencha a ficha antes do convite. O aluno receberá um link para definir a senha; não precisará repetir este questionário.</p>
    <div className="trainer-invite-fields"><label>Nome do aluno<input required value={studentName} maxLength={80} onChange={event=>setStudentName(event.target.value)} autoComplete="name" /></label><label>E-mail do aluno<input required type="email" maxLength={255} value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" /></label></div>
    <h3>Ficha do aluno</h3>
    <div className="trainer-invite-fields">
      <label>Altura (cm)<input required type="number" inputMode="decimal" min="80" max="250" step="0.1" value={height} onChange={event=>setHeight(event.target.value)} /></label>
      <label>Peso atual (kg)<input required type="number" inputMode="decimal" min="20" max="500" step="0.1" value={weight} onChange={event=>setWeight(event.target.value)} /></label>
      <label>Dias de treino por semana<select required value={weeklyGoal} onChange={event=>setWeeklyGoal(event.target.value)}><option value="">Selecione</option>{[1,2,3,4,5,6,7].map(day=><option value={day} key={day}>{day} {day===1?'dia':'dias'}</option>)}</select></label>
      <label>Experiência<select value={level} onChange={event=>setLevel(event.target.value as StudentIntake['level'])}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label>
      <label>Duração disponível por sessão (min)<input required type="number" min="20" max="180" value={duration} onChange={event=>setDuration(event.target.value)} /></label>
      <label>Equipamentos disponíveis (separados por vírgula)<input maxLength={1000} value={equipment} onChange={event=>setEquipment(event.target.value)} placeholder="Halteres, máquinas, esteira…" /></label>
    </div>
    <fieldset><legend>Objetivos do aluno</legend><div className="trainer-intake-checks">{goals.map(goal=><label key={goal}><input type="checkbox" checked={selectedGoals.includes(goal)} onChange={event=>setSelectedGoals(current=>event.target.checked?[...current,goal]:current.filter(item=>item!==goal))}/>{goal}</label>)}</div></fieldset>
    <fieldset><legend>Dias preferidos (opcional)</legend><div className="trainer-intake-checks">{weekdays.map((day,index)=><label key={day}><input type="checkbox" checked={preferredDays.includes(index)} onChange={event=>setPreferredDays(current=>event.target.checked?[...current,index]:current.filter(item=>item!==index))}/>{day}</label>)}</div></fieldset>
    <label>Preferências de treino<textarea maxLength={1500} value={preferences} onChange={event=>setPreferences(event.target.value)} placeholder="Modalidades, exercícios preferidos, horário…" /></label>
    <label>Limitações relatadas (opcional)<textarea maxLength={1000} value={limitations} onChange={event=>setLimitations(event.target.value)} placeholder="Equipamentos ou movimentos que o aluno prefere evitar. Não informe diagnóstico." /></label>
    {error&&<p className="error-banner" role="alert">{error}</p>}
    <button className="primary" type="submit" disabled={busy}>{busy?'Enviando convite…':'Salvar ficha e enviar convite'}</button>
  </form>;
}
