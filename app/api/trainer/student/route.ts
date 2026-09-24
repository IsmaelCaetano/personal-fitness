import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { trainerRoutinePayload } from '@/lib/fitness/trainer';
import { library } from '@/lib/fitness/seed';
import { profileSchema, sessionSchema } from '@/lib/fitness/model';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const relationshipSchema = z.object({ studentId: z.string().uuid() });

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Entre com sua conta.' }, 401);
  const params = relationshipSchema.safeParse({ studentId: new URL(request.url).searchParams.get('studentId') });
  if (!params.success) return json({ error: 'Aluno inválido.' }, 400);
  const studentId = params.data.studentId;
  const { data: link, error: linkError } = await supabase.from('trainer_students').select('status').eq('trainer_id', user.id).eq('student_id', studentId).eq('status', 'active').maybeSingle();
  if (linkError || !link) return json({ error: 'Aluno não vinculado.' }, 403);
  const [account, resources, assignments] = await Promise.all([
    supabase.from('account_profiles').select('display_name').eq('user_id', studentId).maybeSingle(),
    supabase.from('fitness_resources').select('resource,payload').eq('user_id', studentId).in('resource', ['profile','session','measurement']),
    supabase.from('trainer_routines').select('id,routine,version,updated_at').eq('trainer_id', user.id).eq('student_id', studentId).order('updated_at', { ascending: false }),
  ]);
  if (account.error || resources.error || assignments.error) return json({ error: 'Não foi possível abrir este aluno.' }, 503);
  const profile = profileSchema.safeParse(resources.data?.find((row) => row.resource === 'profile')?.payload);
  const sessions = (resources.data ?? []).filter((row) => row.resource === 'session').flatMap((row) => { const result = sessionSchema.safeParse(row.payload); return result.success ? [result.data] : []; });
  return json({ name: account.data?.display_name || (profile.success ? profile.data.name : 'Aluno'), profile: profile.success ? profile.data : null, sessions, assignments: assignments.data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Entre com sua conta.' }, 401);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origem inválida.' }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 120000) return json({ error: 'Treino grande demais.' }, 413);
    const body = trainerRoutinePayload.safeParse(JSON.parse(raw));
    if (!body.success) return json({ error: 'Treino inválido.' }, 400);
    const { studentId, routine, assignmentId } = body.data;
    const { data: link } = await supabase.from('trainer_students').select('id').eq('trainer_id', user.id).eq('student_id', studentId).eq('status', 'active').maybeSingle();
    if (!link) return json({ error: 'Aluno não vinculado.' }, 403);
    const allowed = new Set(library.map((exercise) => exercise.id));
    if (routine.exercises.some((plan) => !allowed.has(plan.exerciseId) || plan.alternativeExerciseIds?.some((id) => !allowed.has(id)))) return json({ error: 'Escolha exercícios da biblioteca.' }, 400);
    if (assignmentId) {
      const version = z.number().int().positive().safeParse(JSON.parse(raw).version);
      if (!version.success) return json({ error: 'Versão da prescrição obrigatória.' }, 400);
      const { data, error } = await supabase.from('trainer_routines').update({ routine, version: version.data + 1, updated_at: new Date().toISOString() }).eq('id', assignmentId).eq('trainer_id', user.id).eq('student_id', studentId).eq('version', version.data).select('id,version').maybeSingle();
      if (error) return json({ error: 'Não foi possível atualizar o treino.' }, 503);
      return data ? json(data) : json({ error: 'Esta prescrição mudou. Recarregue antes de editar.' }, 409);
    }
    const { data, error } = await supabase.from('trainer_routines').insert({ trainer_id: user.id, student_id: studentId, routine }).select('id,version').single();
    return error ? json({ error: 'Não foi possível atribuir o treino.' }, 503) : json(data, 201);
  } catch { return json({ error: 'Dados inválidos.' }, 400); }
}
