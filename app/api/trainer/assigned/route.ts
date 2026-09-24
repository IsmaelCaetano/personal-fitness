import { createClient } from '@/lib/supabase/server';
import { routineSchema } from '@/lib/fitness/model';
export const dynamic = 'force-dynamic';
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Entre com sua conta.' }, { status: 401 });
  const { data: links, error: linkError } = await supabase.from('trainer_students').select('trainer_id').eq('student_id', user.id).eq('status', 'active');
  if (linkError) return Response.json({ error: 'Não foi possível carregar seu vínculo.' }, { status: 503 });
  const trainers = (links ?? []).map((link) => link.trainer_id);
  if (!trainers.length) return Response.json({ routines: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const { data, error } = await supabase.from('trainer_routines').select('id,routine,trainer_id').eq('student_id', user.id).in('trainer_id', trainers);
  if (error) return Response.json({ error: 'Não foi possível carregar suas prescrições.' }, { status: 503 });
  const trainersWithNames = await Promise.all(trainers.map(async (id) => {
    const { data: profile } = await supabase.from('account_profiles').select('display_name').eq('user_id',id).maybeSingle();
    return [id, profile?.display_name || 'Personal'] as const;
  }));
  const names = new Map(trainersWithNames);
  const routines = (data ?? []).flatMap((row) => { const parsed = routineSchema.safeParse(row.routine); return parsed.success ? [{ ...parsed.data, assignmentId: row.id, trainerId: row.trainer_id, trainerName: names.get(row.trainer_id) }] : []; });
  return Response.json({ routines }, { headers: { 'Cache-Control': 'no-store' } });
}
