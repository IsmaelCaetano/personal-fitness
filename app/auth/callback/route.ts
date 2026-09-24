import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {safeReturnPath} from '@/lib/supabase/redirect';

export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get('code');const next=safeReturnPath(url.searchParams.get('next'));if(code){const supabase=await createClient();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error){if(next==='/trainer'){const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.redirect(new URL('/',url.origin));const {data:profile}=await supabase.from('account_profiles').select('account_type').eq('user_id',user.id).maybeSingle();if(profile?.account_type!=='trainer')return NextResponse.redirect(new URL('/',url.origin));}return NextResponse.redirect(new URL(next,url.origin));}}return NextResponse.redirect(new URL('/?auth_error=1',url.origin));}
