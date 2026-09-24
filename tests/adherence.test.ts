import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAdherence } from '../lib/fitness/adherence';
import type { Routine, Session } from '../lib/fitness/model';
const routine:Routine={id:'r',name:'A',description:'',days:[1,3],color:'lime',exercises:[]};
const make=(date:string,routineId:string|null='r',status:Session['status']='completed'):Session=>({id:date+routineId,routineId,name:'A',startedAt:`${date}T10:00:00.000Z`,finishedAt:`${date}T11:00:00.000Z`,status,notes:'',isDemo:false,exercises:[]});
test('planned days compare to actual sessions, capped once per routine/day, with no demo',()=>{
 const sessions=[make('2026-09-21'),make('2026-09-21'),make('2026-09-23'),make('2026-09-22',null),{...make('2026-09-20'),isDemo:true},make('2026-09-24','r','cancelled')];
 const metric=calculateAdherence([routine],sessions,new Date('2026-09-24T20:00:00Z'));
 assert.equal(metric.planned7,2);
 assert.equal(metric.completedPlanned7,2);
 assert.equal(metric.percent,100);
 assert.equal(metric.sessions7,4);
 assert.equal(metric.sessions30,4);
 assert.equal(metric.weeklyStreak,1);
});
test('no scheduled days gives null percentage, no sessions gives zero streak',()=>{
 const metric=calculateAdherence([{...routine,days:[]}],[],new Date('2026-09-24T20:00:00Z'));
 assert.equal(metric.percent,null);
 assert.equal(metric.lastWorkout,null);
 assert.equal(metric.weeklyStreak,0);
});
