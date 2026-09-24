import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_AI_WORKOUT_GENERATIONS_PER_MONTH,generateWithQuota,utcQuotaPeriod,type QuotaStore,type Reservation } from '../lib/fitness/ai-quota';
import type { GeneratedProgram } from '../lib/fitness/ai';

const plan={title:'Plano',rationale:['Objetivo'],progression:['4 semanas'],warnings:[],routines:[]} as GeneratedProgram;
class FakeQuota implements QuotaStore{
  used=0;calls=0;requests=new Map<string,{status:'pending'|'completed'|'failed';program?:GeneratedProgram}>();
  async reserve(_uid:string,id:string):Promise<Reservation>{
    const existing=this.requests.get(id);
    if(existing)return {status:existing.status,used:this.used,limit:2,renewsAt:'2026-10-01',program:existing.program};
    if(this.used>=FREE_AI_WORKOUT_GENERATIONS_PER_MONTH)return {status:'limit',used:this.used,limit:2,renewsAt:'2026-10-01'};
    this.used++;this.requests.set(id,{status:'pending'});return {status:'granted',used:this.used,limit:2,renewsAt:'2026-10-01'};
  }
  async complete(_uid:string,id:string,value:GeneratedProgram){const row=this.requests.get(id);if(row?.status!=='pending')return false;row.status='completed';row.program=value;return true;}
  async release(_uid:string,id:string){const row=this.requests.get(id);if(row?.status!=='pending')return false;row.status='failed';this.used--;return true;}
  generate=async()=>{this.calls++;return plan;};
}
const verify=(value:unknown)=>{assert.deepEqual(value,plan);return plan;};

test('monthly 0/2, 1/2, 2/2; third unique request cannot call Gemini',async()=>{
  const store=new FakeQuota();
  assert.equal((await generateWithQuota(store,'u','1',store.generate,verify)).used,1);
  assert.equal((await generateWithQuota(store,'u','2',store.generate,verify)).used,2);
  assert.equal((await generateWithQuota(store,'u','3',store.generate,verify)).kind,'limit');
  assert.equal(store.calls,2);
});
test('retry of completed request returns same plan, including lost HTTP response',async()=>{
  const store=new FakeQuota();await generateWithQuota(store,'u','1',store.generate,verify);
  const retry=await generateWithQuota(store,'u','1',store.generate,verify);
  assert.equal(retry.kind,'plan');assert.equal(store.used,1);assert.equal(store.calls,1);
});
test('simultaneous requests at 1/2 reserve at most one more slot',async()=>{
  const store=new FakeQuota();await generateWithQuota(store,'u','1',store.generate,verify);
  const outcomes=await Promise.all([generateWithQuota(store,'u','2',store.generate,verify),generateWithQuota(store,'u','3',store.generate,verify)]);
  assert.deepEqual(outcomes.map(x=>x.kind).sort(),['limit','plan']);
});
test('AI, timeout, invalid JSON, Zod and domain failures release the reservation',async()=>{
  for(const error of [new Error('Gemini unavailable'),new Error('timeout'),new SyntaxError('JSON'),new Error('Zod'),new Error('domain')]){
    const store=new FakeQuota();
    await assert.rejects(generateWithQuota(store,'u','1',async()=>{throw error;},verify));
    assert.equal(store.used,0);
    assert.equal((await generateWithQuota(store,'u','2',store.generate,verify)).kind,'plan');
  }
});
test('pending identical retry does not generate again; month is UTC calendar',async()=>{
  const store=new FakeQuota();await store.reserve('u','1');
  assert.equal((await generateWithQuota(store,'u','1',store.generate,verify)).kind,'pending');assert.equal(store.calls,0);
  assert.equal(utcQuotaPeriod(new Date('2026-12-31T23:59:59Z')).renewsAt,'2027-01-01');
  assert.equal(utcQuotaPeriod(new Date('2027-01-01T00:00:00Z')).periodStart,'2027-01-01');
});
test('ambiguous confirmation never returns an unregistered plan',async()=>{
  const store=new FakeQuota();store.complete=async()=>{throw new Error('lost DB response');};
  await assert.rejects(generateWithQuota(store,'u','1',store.generate,verify));assert.equal(store.used,1);
});
