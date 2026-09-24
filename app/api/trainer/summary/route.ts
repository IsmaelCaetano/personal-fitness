import { createClient } from '@/lib/supabase/server';
import { calculateAdherence } from '@/lib/fitness/adherence';
import { effectivePaymentStatus } from '@/lib/fitness/payments';
import { profileSchema, routineSchema, sessionSchema } from '@/lib/fitness/model';
export const dynamic='force-dynamic';
export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return Response.json({error:'Entre com sua conta.'},{status:401});
 const {data:profile}=await supabase.from('account_profiles').select('account_type').eq('user_id',user.id).maybeSingle();
 if(profile?.account_type!=='trainer')return Response.json({error:'Apenas personal.'},{status:403});
 const {data:links,error}=await supabase.from('trainer_students').select('student_id').eq('trainer_id',user.id).eq('status','active');
 if(error)return Response.json({error:'Não foi possível carregar os alunos.'},{status:503});
 const today=new Date().toISOString().slice(0,10);
 try { const students=await Promise.all((links??[]).slice(0,100).map(async link=>{
  const id=link.student_id;
  const [resources,assignments,feedback,payments]=await Promise.all([
   supabase.from('fitness_resources').select('resource,payload').eq('user_id',id).in('resource',['profile','session']),
   supabase.from('trainer_routines').select('routine').eq('student_id',id).eq('trainer_id',user.id),
   supabase.from('student_feedback').select('id,status').eq('student_id',id).eq('trainer_id',user.id).eq('status','open'),
   supabase.from('payment_records').select('status,due_date').eq('student_id',id).eq('trainer_id',user.id),
  ]);
  if(resources.error||assignments.error||feedback.error||payments.error)throw new Error('STUDENT_QUERY_FAILED');
  const athlete=profileSchema.safeParse(resources.data?.find(row=>row.resource==='profile')?.payload);
  const sessions=(resources.data??[]).filter(row=>row.resource==='session').flatMap(row=>{const parsed=sessionSchema.safeParse(row.payload);return parsed.success?[parsed.data]:[];});
  const routines=(assignments.data??[]).flatMap(row=>{const parsed=routineSchema.safeParse(row.routine);return parsed.success?[parsed.data]:[];});
  const adherence=calculateAdherence(routines,sessions);
  const statuses=(payments.data??[]).map(payment=>effectivePaymentStatus({status:payment.status,dueDate:payment.due_date},today));
  return {studentId:id,name:athlete.success?athlete.data.name:'Aluno',...adherence,feedbackPending:(feedback.data??[]).length,paymentsPending:statuses.filter(status=>status==='pending').length,paymentsOverdue:statuses.filter(status=>status==='overdue').length};
 }));
 return Response.json({students,summary:{active:students.length,trainedThisWeek:students.filter(student=>student.sessions7>0).length,feedbackPending:students.reduce((n,s)=>n+s.feedbackPending,0),paymentsPending:students.reduce((n,s)=>n+s.paymentsPending,0),paymentsOverdue:students.reduce((n,s)=>n+s.paymentsOverdue,0)}},{headers:{'Cache-Control':'no-store'}});
 } catch { return Response.json({error:'Não foi possível carregar o resumo.'},{status:503}); }
}
