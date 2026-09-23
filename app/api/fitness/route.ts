import {createClient} from '@/lib/supabase/server';
import {initialData} from '@/lib/fitness/seed';
import {resourceSchemas,type FitnessData,type Resource} from '@/lib/fitness/model';
import {z} from 'zod';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const requestSchema=z.object({resource:z.enum(['profile','exercise','routine','session','measurement']),entity:z.unknown(),id:z.string().min(1).max(200),version:z.number().int().nonnegative(),remove:z.boolean().optional()});
type Row={id:string;resource:Resource;payload:unknown;version:number};

async function authenticated(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user};}

async function readData(supabase:Awaited<ReturnType<typeof createClient>>,uid:string):Promise<FitnessData>{
 const {data,error}=await supabase.from('fitness_resources').select('id,resource,payload,version').eq('user_id',uid);
 if(error)throw error;let rows=(data??[]) as Row[];
 if(!rows.some(row=>row.resource==='profile')){const seed=initialData(uid);const resources=[{user_id:uid,id:uid,resource:'profile',payload:seed.profile,version:1},...seed.routines.map(payload=>({user_id:uid,id:payload.id,resource:'routine',payload,version:1})),...seed.sessions.map(payload=>({user_id:uid,id:payload.id,resource:'session',payload,version:1}))];const created=await supabase.from('fitness_resources').upsert(resources,{onConflict:'user_id,id'}).select('id,resource,payload,version');if(created.error)throw created.error;rows=(created.data??[]) as Row[];}
 const profile=rows.find(row=>row.resource==='profile');if(!profile)throw new Error('Perfil indisponível.');const list=(resource:Resource)=>rows.filter(row=>row.resource===resource).map(row=>row.payload);return {profile:profile.payload as FitnessData['profile'],exercises:list('exercise') as FitnessData['exercises'],routines:list('routine') as FitnessData['routines'],sessions:list('session') as FitnessData['sessions'],measurements:list('measurement') as FitnessData['measurements'],versions:Object.fromEntries(rows.map(row=>[row.id,row.version]))};
}

export async function GET(){const {supabase,user}=await authenticated();if(!user)return json({error:'Entre com sua conta para continuar.'},401);try{return json(await readData(supabase,user.id));}catch(error){console.error('fitness load',error);return json({error:'Não foi possível carregar seus treinos. Tente novamente.'},503);}}

export async function POST(request:Request){const {supabase,user}=await authenticated();if(!user)return json({error:'Sua sessão expirou. Entre novamente.'},401);const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 try{const raw=await request.text();if(raw.length>500000)return json({error:'Dados muito grandes.'},413);const parsed=requestSchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Dados inválidos.'},400);const {resource,id,version,remove,entity}=parsed.data;const uid=user.id;if(resource==='profile'&&(id!==uid||remove))return json({error:'Operação não permitida.'},403);
 if(remove){const result=await supabase.from('fitness_resources').delete().eq('user_id',uid).eq('id',id).eq('version',version).select('id');if(result.error)throw result.error;if(!result.data?.length)return json({error:'Este registro mudou em outra aba. Recarregue antes de continuar.'},409);return json({id,version:0});}
 const valid=resourceSchemas[resource].safeParse(entity);if(!valid.success)return json({error:valid.error.issues[0]?.message??'Confira os campos.'},400);if(valid.data.id!==id)return json({error:'Identificador inválido.'},400);
 if(version===0){const created=await supabase.from('fitness_resources').insert({user_id:uid,id,resource,payload:valid.data,version:1}).select('version').maybeSingle();if(created.error){if(created.error.code==='23505')return json({error:'Este registro mudou em outra aba. Recarregue antes de continuar.'},409);throw created.error;}return json({id,version:created.data?.version??1});}
 const updated=await supabase.from('fitness_resources').update({payload:valid.data,version:version+1,updated_at:new Date().toISOString()}).eq('user_id',uid).eq('id',id).eq('resource',resource).eq('version',version).select('version').maybeSingle();if(updated.error)throw updated.error;if(!updated.data)return json({error:'Este registro mudou em outra aba. Suas alterações estão neste aparelho; recarregue para resolver o conflito.'},409);return json({id,version:updated.data.version});
 }catch(error){console.error('fitness save',error);return json({error:'Não foi possível salvar agora. Suas alterações serão mantidas neste aparelho.'},503);}}
