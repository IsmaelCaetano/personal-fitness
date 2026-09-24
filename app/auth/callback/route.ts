import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {safeReturnPath} from '@/lib/supabase/redirect';

export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get('code');const next=safeReturnPath(url.searchParams.get('next'));if(code){const supabase=await createClient();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error){if(next==='/trainer'){const {data:{user}}=await supabase.auth.getUser();if(user?.user_metadata?.signup_intent==='trainer'){const name=String(user.user_metadata.name??'').trim();if(name.length>0&&name.length<=80)await supabase.rpc('register_trainer',{p_display_name:name});}}return NextResponse.redirect(new URL(next,url.origin));}}return NextResponse.redirect(new URL('/?auth_error=1',url.origin));}
