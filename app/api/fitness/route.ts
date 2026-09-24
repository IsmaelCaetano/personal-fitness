import {createClient} from '@/lib/supabase/server';
import {resourceSchemas} from '@/lib/fitness/model';
import {readFitnessData,saveFitnessResource} from '@/lib/fitness/persistence';
import {z} from 'zod';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const requestSchema=z.object({resource:z.enum(['profile','exercise','routine','session','measurement']),entity:z.unknown(),id:z.string().min(1).max(200),version:z.number().int().nonnegative(),remove:z.boolean().optional()});

async function authenticated(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user};}

export async function GET(){const {supabase,user}=await authenticated();if(!user)return json({error:'Entre com sua conta para continuar.'},401);try{const metadataName=typeof user.user_metadata?.name==='string'?user.user_metadata.name.trim():'';const fallbackName=user.email?.split('@')[0]??'Atleta';return json(await readFitnessData(supabase,user.id,metadataName||fallbackName));}catch{return json({error:'Não foi possível carregar seus treinos. Tente novamente.'},503);}}

export async function POST(request:Request){const {supabase,user}=await authenticated();if(!user)return json({error:'Sua sessão expirou. Entre novamente.'},401);const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 try{const raw=await request.text();if(raw.length>500000)return json({error:'Dados muito grandes.'},413);let body:unknown;try{body=JSON.parse(raw);}catch{return json({error:'JSON inválido.'},400);}const parsed=requestSchema.safeParse(body);if(!parsed.success)return json({error:'Dados inválidos.'},400);const {resource,id,version,remove,entity}=parsed.data;const uid=user.id;if(resource==='profile'&&(id!==uid||remove))return json({error:'Operação não permitida.'},403);
 let validated;
 if(!remove){const valid=resourceSchemas[resource].safeParse(entity);if(!valid.success)return json({error:valid.error.issues[0]?.message??'Confira os campos.'},400);if(valid.data.id!==id)return json({error:'Identificador inválido.'},400);validated=valid.data;}
 const savedVersion=await saveFitnessResource(supabase,uid,{resource,id,version,remove,entity:validated});
 if(savedVersion===null)return json({error:'Este registro mudou. Suas alterações estão neste aparelho; resolva o conflito para continuar.'},409);
 return json({id,version:savedVersion});
 }catch{return json({error:'Não foi possível salvar agora. Suas alterações serão mantidas neste aparelho.'},503);}}
