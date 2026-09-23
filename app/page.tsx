import {FitnessApp} from '@/features/fitness/app';
import {AccessGate} from '@/features/fitness/access-gate';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function Page(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return <AccessGate/>;return <FitnessApp uid={user.id} email={user.email??''}/>;}
