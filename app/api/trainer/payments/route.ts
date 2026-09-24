import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { paymentInputSchema } from '@/lib/fitness/payments';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return json({error:'Entre com sua conta.'},401);
 const studentId=new URL(request.url).searchParams.get('studentId');if(studentId && !z.string().uuid().safeParse(studentId).success)return json({error:'Aluno inválido.'},400);
 if(studentId){const {data:link}=await supabase.from('trainer_students').select('id').eq('trainer_id',user.id).eq('student_id',studentId).eq('status','active').maybeSingle();if(!link)return json({error:'Aluno não vinculado.'},403);}
 const query=supabase.from('payment_records').select('id,trainer_id,student_id,reference_month,due_date,amount,status,paid_at,notes,created_at,updated_at').order('reference_month',{ascending:false}).limit(100);
 const {data,error}=await (studentId?query.eq('trainer_id',user.id).eq('student_id',studentId):query.eq('student_id',user.id));
 return error?json({error:'Não foi possível carregar pagamentos.'},503):json({payments:data});
}
export async function POST(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return json({error:'Entre com sua conta.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 try{const raw=await request.text();if(raw.length>3000)return json({error:'Dados grandes demais.'},413);
  const parsed=paymentInputSchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Confira valor, vencimento e mês.'},400);
  const body=parsed.data;const {data:link}=await supabase.from('trainer_students').select('id').eq('trainer_id',user.id).eq('student_id',body.studentId).eq('status','active').maybeSingle();if(!link)return json({error:'Aluno não vinculado.'},403);
  const {data,error}=await supabase.from('payment_records').insert({trainer_id:user.id,student_id:body.studentId,reference_month:body.referenceMonth,due_date:body.dueDate,amount:body.amount,status:body.status,paid_at:body.paidAt??null,notes:body.notes}).select('id').single();
  return error?json({error:'Não foi possível criar o registro. Confira se o mês já existe.'},409):json(data,201);
 }catch{return json({error:'Dados inválidos.'},400);}
}
export async function PATCH(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return json({error:'Entre com sua conta.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 try{const raw=await request.text();if(raw.length>3000)return json({error:'Dados grandes demais.'},413);const body=z.object({id:z.string().uuid(),data:paymentInputSchema}).safeParse(JSON.parse(raw));if(!body.success)return json({error:'Dados inválidos.'},400);
  const {data:link}=await supabase.from('trainer_students').select('id').eq('trainer_id',user.id).eq('student_id',body.data.data.studentId).eq('status','active').maybeSingle();if(!link)return json({error:'Aluno não vinculado.'},403);
  const payment=body.data.data;
  const {data,error}=await supabase.from('payment_records').update({reference_month:payment.referenceMonth,due_date:payment.dueDate,amount:payment.amount,status:payment.status,paid_at:payment.paidAt??null,notes:payment.notes,updated_at:new Date().toISOString()}).eq('id',body.data.id).eq('trainer_id',user.id).eq('student_id',payment.studentId).select('id').maybeSingle();
  return error?json({error:'Não foi possível atualizar.'},503):data?json({ok:true}):json({error:'Registro não encontrado.'},404);
 }catch{return json({error:'Dados inválidos.'},400);}
}
