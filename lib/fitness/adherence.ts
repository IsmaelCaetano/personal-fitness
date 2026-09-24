import type { Routine, Session } from './model';
const DAY=86400000;
export type Adherence = { lastWorkout: string | null; sessions7: number; sessions30: number; planned7: number; completedPlanned7: number; percent: number | null; weeklyStreak: number };
/** Calendar days use UTC; a completed planned routine counts once per day. */
export function calculateAdherence(routines: Routine[], sessions: Session[], now = new Date()): Adherence {
  const end = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  const valid = sessions.filter((session) => session.status==='completed' && !session.isDemo && Number.isFinite(new Date(session.startedAt).getTime()) && new Date(session.startedAt).getTime() <= end+DAY);
  const recent = (days:number) => valid.filter((session)=>new Date(session.startedAt).getTime()>=end-(days-1)*DAY);
  const lastWorkout = [...valid].sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0]?.startedAt ?? null;
  const planned = new Set<string>();
  for(let offset=0;offset<7;offset++){
    const date=new Date(end-offset*DAY);
    for(const routine of routines) if(routine.days.includes(date.getUTCDay())) planned.add(`${routine.id}:${date.toISOString().slice(0,10)}`);
  }
  const completed = new Set(recent(7).filter((session)=>session.routineId).map((session)=>`${session.routineId}:${session.startedAt.slice(0,10)}`));
  const completedPlanned7=[...planned].filter((key)=>completed.has(key)).length;
  const weekStart=end-new Date(end).getUTCDay()*DAY;
  let weeklyStreak=0;
  for(let week=0;week<52;week++){
    if(!valid.some((session)=>{const time=new Date(session.startedAt).getTime();return time>=weekStart-week*7*DAY && time<weekStart-(week-1)*7*DAY;}))break;
    weeklyStreak++;
  }
  return {lastWorkout,sessions7:recent(7).length,sessions30:recent(30).length,planned7:planned.size,completedPlanned7,percent:planned.size?Math.round(100*completedPlanned7/planned.size):null,weeklyStreak};
}
