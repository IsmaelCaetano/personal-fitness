import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TrainerPortal } from '@/features/fitness/trainer-portal';
export const dynamic = 'force-dynamic';
export default async function TrainerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  return <TrainerPortal />;
}
