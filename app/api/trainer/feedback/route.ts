import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { feedbackPayloadSchema } from '@/lib/fitness/feedback';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const resolveSchema = z.object({ id: z.string().uuid(), response: z.string().trim().max(2000), status: z.enum(['open','resolved']) });
async function auth() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return { supabase, user }; }
export async function GET(request: Request) {
  const { supabase,user } = await auth();
  if (!user) return json({ error: 'Entre com sua conta.' }, 401);
  const studentId = new URL(request.url).searchParams.get('studentId');
  const id = studentId ? z.string().uuid().safeParse(studentId) : null;
  if (studentId && !id?.success) return json({ error: 'Aluno inválido.' }, 400);
  if (studentId) {
    const { data: relationship } = await supabase.from('trainer_students').select('id').eq('trainer_id',user.id).eq('student_id',studentId).eq('status','active').maybeSingle();
    if (!relationship) return json({ error: 'Aluno não vinculado.' }, 403);
  }
  const query = supabase.from('student_feedback').select('id,student_id,trainer_id,routine_id,session_id,exercise_id,category,message,response,status,created_at,resolved_at').order('created_at', { ascending: false }).limit(100);
  const { data,error } = await (studentId ? query.eq('trainer_id',user.id).eq('student_id',studentId) : query.eq('student_id',user.id));
  return error ? json({ error: 'Não foi possível carregar os feedbacks.' }, 503) : json({ feedback: data });
}
export async function POST(request: Request) {
  const { supabase,user } = await auth();
  if (!user) return json({ error: 'Entre com sua conta.' }, 401);
  const origin=request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origem inválida.' }, 403);
  try {
    const raw=await request.text();
    if (raw.length>3500) return json({ error: 'Texto grande demais.' }, 413);
    const parsed=feedbackPayloadSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ error: 'Preencha o comentário e a categoria.' }, 400);
    const { trainerId,routineId,sessionId,exerciseId,category,message }=parsed.data;
    const { data: link }=await supabase.from('trainer_students').select('id').eq('student_id',user.id).eq('trainer_id',trainerId).eq('status','active').maybeSingle();
    if (!link) return json({ error: 'Vínculo inativo.' }, 403);
    if (routineId) {
      const { data: assignment } = await supabase.from('trainer_routines').select('id').eq('id',routineId).eq('student_id',user.id).eq('trainer_id',trainerId).maybeSingle();
      if (!assignment) return json({ error: 'Prescrição inválida.' }, 403);
    }
    const limit=await supabase.rpc('consume_api_rate_limit',{p_operation:'student_feedback'});
    if (limit.error) return json({error:'Feedback indisponível no momento.'},503);
    if (!limit.data) return json({error:'Limite temporário de feedbacks atingido.'},429);
    const { data,error }=await supabase.from('student_feedback').insert({student_id:user.id,trainer_id:trainerId,routine_id:routineId,session_id:sessionId,exercise_id:exerciseId,category,message}).select('id').single();
    return error ? json({error:'Não foi possível enviar o feedback.'},503) : json(data,201);
  } catch { return json({error:'Dados inválidos.'},400); }
}
export async function PATCH(request: Request) {
  const { supabase,user }=await auth();
  if (!user) return json({error:'Entre com sua conta.'},401);
  const origin=request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({error:'Origem inválida.'},403);
  try {
    const raw=await request.text();
    if (raw.length>2500) return json({error:'Texto grande demais.'},413);
    const parsed=resolveSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({error:'Resposta inválida.'},400);
    const { data: feedback }=await supabase.from('student_feedback').select('student_id').eq('id',parsed.data.id).eq('trainer_id',user.id).maybeSingle();
    if (!feedback) return json({error:'Feedback não encontrado.'},404);
    const { data: relationship }=await supabase.from('trainer_students').select('id').eq('trainer_id',user.id).eq('student_id',feedback.student_id).eq('status','active').maybeSingle();
    if (!relationship) return json({error:'Vínculo inativo.'},403);
    const { error }=await supabase.from('student_feedback').update({response:parsed.data.response,status:parsed.data.status,resolved_at:parsed.data.status==='resolved'?new Date().toISOString():null}).eq('id',parsed.data.id).eq('trainer_id',user.id);
    return error ? json({error:'Não foi possível responder.'},503) : json({ok:true});
  } catch { return json({error:'Dados inválidos.'},400); }
}
