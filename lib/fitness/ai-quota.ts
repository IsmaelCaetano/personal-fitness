import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { GeneratedProgram } from './ai';

export const FREE_AI_WORKOUT_GENERATIONS_PER_MONTH = 2;
const reservationSchema = z.object({status:z.enum(['granted','pending','completed','failed','limit']),used:z.number().int().nonnegative(),limit:z.number().int().positive(),renewsAt:z.string(),program:z.unknown().optional()});
export type Reservation=z.infer<typeof reservationSchema>;
export interface QuotaStore {
  reserve(uid:string,requestId:string):Promise<Reservation>;
  complete(uid:string,requestId:string,plan:GeneratedProgram):Promise<boolean>;
  release(uid:string,requestId:string):Promise<boolean>;
}
/** Service role never leaves the server; RPC grants exclude browser roles. */
export function createQuotaStore():QuotaStore {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('AI_QUOTA_NOT_CONFIGURED');
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return {
    async reserve(uid,requestId){const {data,error}=await admin.rpc('reserve_ai_workout',{p_user_id:uid,p_request_id:requestId,p_limit:FREE_AI_WORKOUT_GENERATIONS_PER_MONTH});if(error)throw error;return reservationSchema.parse(data);},
    async complete(uid,requestId,plan){const {data,error}=await admin.rpc('complete_ai_workout',{p_user_id:uid,p_request_id:requestId,p_program:plan});if(error)throw error;return data===true;},
    async release(uid,requestId){const {data,error}=await admin.rpc('release_ai_workout',{p_user_id:uid,p_request_id:requestId});if(error)throw error;return data===true;},
  };
}
export function utcQuotaPeriod(date=new Date()){const year=date.getUTCFullYear(),month=date.getUTCMonth();return {periodStart:new Date(Date.UTC(year,month,1)).toISOString().slice(0,10),renewsAt:new Date(Date.UTC(year,month+1,1)).toISOString().slice(0,10)};}
export type QuotaResult={kind:'plan';plan:GeneratedProgram;used:number;limit:number;renewsAt:string}|{kind:'limit';used:number;limit:number;renewsAt:string}|{kind:'pending';used:number;limit:number;renewsAt:string}|{kind:'failed';used:number;limit:number;renewsAt:string};
/** Verify both fresh and stored responses. A failed Gemini/Zod/domain result releases its slot. */
export async function generateWithQuota(store:QuotaStore,uid:string,requestId:string,generate:()=>Promise<GeneratedProgram>,verify:(input:unknown)=>GeneratedProgram):Promise<QuotaResult>{
  const reservation=await store.reserve(uid,requestId);
  if(reservation.status==='completed')return {kind:'plan',plan:verify(reservation.program),used:reservation.used,limit:reservation.limit,renewsAt:reservation.renewsAt};
  if(reservation.status!=='granted')return {kind:reservation.status==='limit'?'limit':reservation.status==='failed'?'failed':'pending',used:reservation.used,limit:reservation.limit,renewsAt:reservation.renewsAt};
  let plan:GeneratedProgram;
  try{plan=verify(await generate());}catch(error){await store.release(uid,requestId);throw error;}
  // If confirmation is ambiguous, do not release: the database may have committed.
  if(!await store.complete(uid,requestId,plan))throw new Error('AI_CONFIRMATION_UNCERTAIN');
  return {kind:'plan',plan,used:reservation.used,limit:reservation.limit,renewsAt:reservation.renewsAt};
}
