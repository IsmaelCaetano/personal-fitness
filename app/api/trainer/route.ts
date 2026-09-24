import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('register'), displayName: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal('invite'), email: z.string().trim().email().max(255) }),
  z.object({ action: z.literal('accept'), inviteId: z.string().uuid() }),
]);
const result = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return result({ error: 'Entre com sua conta.' }, 401);
  const [profile, students, invites] = await Promise.all([
    supabase.from('account_profiles').select('account_type,display_name').eq('user_id', user.id).maybeSingle(),
    supabase.from('trainer_students').select('id,trainer_id,student_id,status,created_at,started_at').or(`trainer_id.eq.${user.id},student_id.eq.${user.id}`),
    supabase.from('trainer_invites').select('id,trainer_id,email,status,expires_at').eq('status', 'pending'),
  ]);
  if (profile.error || students.error || invites.error) return result({ error: 'Configuração de personal ainda não disponível.' }, 503);
  return result({ profile: profile.data ?? { account_type: 'individual', display_name: '' }, relationships: students.data, invites: invites.data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return result({ error: 'Entre com sua conta.' }, 401);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return result({ error: 'Origem inválida.' }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 1000) return result({ error: 'Dados muito grandes.' }, 413);
    const body = bodySchema.safeParse(JSON.parse(raw));
    if (!body.success) return result({ error: 'Confira os dados.' }, 400);
    if (body.data.action === 'register') {
      const { data, error } = await supabase.rpc('register_trainer', { p_display_name: body.data.displayName });
      return error || !data ? result({ error: 'Não foi possível ativar o modo personal.' }, 503) : result({ ok: true });
    }
    if (body.data.action === 'accept') {
      const { data, error } = await supabase.rpc('accept_trainer_invite', { p_invite_id: body.data.inviteId });
      return error ? result({ error: 'Não foi possível aceitar o convite.' }, 503) : data ? result({ ok: true }) : result({ error: 'Convite expirado, já utilizado ou enviado a outro e-mail.' }, 403);
    }
    const { data: profile, error: profileError } = await supabase.from('account_profiles').select('account_type').eq('user_id', user.id).single();
    if (profileError || profile?.account_type !== 'trainer') return result({ error: 'Apenas personal trainers podem convidar.' }, 403);
    if (body.data.email.toLowerCase() === user.email?.toLowerCase()) return result({ error: 'Escolha o e-mail de um aluno.' }, 400);
    const limit = await supabase.rpc('consume_api_rate_limit', { p_operation: 'trainer_invite' });
    if (limit.error) return result({ error: 'Convites indisponíveis agora.' }, 503);
    if (!limit.data) return result({ error: 'Limite temporário de convites atingido.' }, 429);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!key || !url) return result({ error: 'Envio de convites ainda não configurado.' }, 503);
    const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: invite, error: saveError } = await admin.from('trainer_invites').insert({ trainer_id: user.id, email: body.data.email.toLowerCase(), expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }).select('id').single();
    if (saveError || !invite) return result({ error: 'Não foi possível preparar o convite.' }, 503);
    const redirectTo = new URL('/auth/callback?next=%2F', request.url).toString();
    const { error: emailError } = await admin.auth.admin.inviteUserByEmail(body.data.email.toLowerCase(), { redirectTo });
    if (emailError) {
      await admin.from('trainer_invites').update({ status: 'revoked' }).eq('id', invite.id).eq('trainer_id', user.id);
      return result({ error: 'Não foi possível enviar o convite. Confira o e-mail ou peça ao aluno para entrar na conta existente.' }, 422);
    }
    return result({ id: invite.id });
  } catch {
    return result({ error: 'Não foi possível completar a solicitação.' }, 503);
  }
}
