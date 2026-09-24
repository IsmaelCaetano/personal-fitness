import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Entre com sua conta.'},{status:401});
  await supabase.rpc('refresh_payment_reminders');
  const {data,error}=await supabase.from('notifications').select('id,type,title,body,read_at,created_at,metadata').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
  return error?Response.json({error:'Não foi possível carregar notificações.'},{status:503}):Response.json({notifications:data},{headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Entre com sua conta.'},{status:401});
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
  try{const raw=await request.text();if(raw.length>100)return Response.json({error:'Dados grandes demais.'},{status:413});const parsed=z.object({id:z.string().uuid()}).safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Notificação inválida.'},{status:400});
    const {data,error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',parsed.data.id).eq('user_id',user.id).select('id').maybeSingle();
    return error?Response.json({error:'Não foi possível marcar como lida.'},{status:503}):data?Response.json({ok:true}):Response.json({error:'Não encontrada.'},{status:404});
  }catch{return Response.json({error:'Dados inválidos.'},{status:400});}
}
