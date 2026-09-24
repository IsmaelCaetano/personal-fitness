import type {Session, SessionExercise, WorkoutSet,Plan} from './model';
export const currentTimestamp=()=>Date.now();
export const completedSets=(e:SessionExercise)=>e.sets.filter(s=>s.status==='completed');
export const workingSets=(e:SessionExercise)=>completedSets(e).filter(s=>s.type!=='warmup');
export const calculateSetVolume=(s:WorkoutSet)=>s.status==='completed'?(s.weight??0)*(s.reps??0):0;
export const calculateExerciseVolume=(e:SessionExercise)=>e.sets.reduce((v,s)=>v+calculateSetVolume(s),0);
export const calculateWorkoutVolume=(s:Session)=>s.exercises.reduce((v,e)=>v+calculateExerciseVolume(e),0);
export const calculateEstimated1RM=(weight:number,reps:number)=>weight<=0||reps<1?0:reps===1?weight:weight*(1+reps/30);
export const calculateWorkoutDuration=(s:Session,now=Date.now())=>Math.max(0,Math.floor(((s.finishedAt?new Date(s.finishedAt).getTime():now)-new Date(s.startedAt).getTime())/1000));
export function getPreviousExercisePerformance(sessions:Session[],exerciseId:string,before=Infinity,isDemo=false){return sessions.filter(s=>s.status==='completed'&&s.isDemo===isDemo&&new Date(s.startedAt).getTime()<before).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).map(s=>({session:s,exercise:s.exercises.find(e=>e.exercise.id===exerciseId)})).find(x=>x.exercise&&completedSets(x.exercise).length);}
export function suggestProgression(sets:WorkoutSet[],plan:Plan){const work=sets.filter(s=>s.type==='normal'&&s.status==='completed');if(work.length<plan.sets)return 'INSUFFICIENT_DATA';if(work.every(s=>(s.reps??0)>=plan.maxReps))return 'READY_TO_PROGRESS';if(work.filter(s=>(s.reps??0)<plan.minReps).length>=2)return 'REVIEW_LOAD';return 'MAINTAIN';}
export function detectPersonalRecord(s:Session,previous:Session[]){const records:{exercise:string;kind:string;value:number}[]=[];for(const e of s.exercises){const old=previous.filter(x=>x.id!==s.id&&x.status==='completed'&&x.isDemo===s.isDemo&&x.startedAt<s.startedAt).flatMap(x=>x.exercises.filter(y=>y.exercise.id===e.exercise.id));const past=old.flatMap(workingSets),current=workingSets(e);if(!current.length||!past.length)continue;const max=(ss:WorkoutSet[])=>Math.max(0,...ss.map(x=>x.weight??0));if(max(current)>max(past))records.push({exercise:e.exercise.name,kind:'Maior carga',value:max(current)});const rm=(ss:WorkoutSet[])=>Math.max(0,...ss.filter(x=>(x.reps??0)<=12).map(x=>calculateEstimated1RM(x.weight??0,x.reps??0)));if(rm(current)>rm(past))records.push({exercise:e.exercise.name,kind:'1RM estimado',value:rm(current)});if(calculateExerciseVolume(e)>Math.max(0,...old.map(calculateExerciseVolume)))records.push({exercise:e.exercise.name,kind:'Maior volume',value:calculateExerciseVolume(e)});if(current.some(x=>past.some(p=>p.weight===x.weight)&&(x.reps??0)>Math.max(...past.filter(p=>p.weight===x.weight).map(p=>p.reps??0))))records.push({exercise:e.exercise.name,kind:'Repetições na mesma carga',value:Math.max(...current.map(x=>x.reps??0))});}return records;}
export const fmt=(n:number,digits=0)=>n.toLocaleString('pt-BR',{maximumFractionDigits:digits});
export const clock=(seconds:number)=>{const s=Math.max(0,Math.floor(seconds));return s>=3600?`${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor(s/60%60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`:`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;};
export const displayWeight=(kg:number,unit:'kg'|'lb')=>unit==='lb'?Math.round(kg*2.2046226218*10)/10:kg;
export const toKg=(weight:number,unit:'kg'|'lb')=>unit==='lb'?weight/2.2046226218:weight;
export const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export function coachSetFeedback(input: { plan: Plan; set: WorkoutSet; recent?: WorkoutSet[]; objective?: string }): string | null {
  const { plan, set } = input;
  if (set.status !== 'completed' || set.reps == null || plan.targetType && plan.targetType !== 'reps' || set.type === 'warmup') return null;
  if (set.reps < plan.minReps) return set.rir === 0 || (set.rpe ?? 0) >= 9
    ? 'A carga parece alta para a faixa prevista. Considere manter ou reduzir levemente.'
    : 'Você ficou abaixo da faixa. Mantenha a carga ou ajuste levemente e priorize a execução.';
  if (set.reps >= plan.maxReps && set.rir != null && set.rir >= 2 && (set.rpe ?? 0) < 9)
    return 'Você atingiu o topo da faixa com margem. Considere aumentar levemente a carga na próxima sessão.';
  if ((set.rir != null && set.rir <= 1) || (set.rpe != null && set.rpe >= 9))
    return 'Boa execução dentro da faixa. Mantenha a carga e tente alcançar o topo antes de progredir.';
  if (!input.recent?.length) return 'Primeira referência registrada. Use este resultado para comparar as próximas sessões.';
  return 'Você está dentro da faixa. Continue progredindo as repetições antes de aumentar a carga.';
}
