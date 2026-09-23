'use client';
import {useState} from 'react';
import {LogOut,ShieldCheck,Trash2} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {Switch} from '@/components/ui/switch';
import {createClient} from '@/lib/supabase/client';
import {Choice,Confirm} from './shared';
import type {FitnessData,Profile} from '@/lib/fitness/model';
import type {FitnessStore} from './use-fitness';

export const goals=['Perder gordura','Ganhar massa','Aumentar força','Recomposição corporal'];

export function ProfilePage({data,email,mutate}:{data:FitnessData;email:string;mutate:FitnessStore['mutate']}){
 const p=data.profile;const [clear,setClear]=useState(false);const update=(patch:Partial<Profile>)=>mutate('profile',{...p,...patch});
 const signOut=async()=>{await createClient().auth.signOut();window.location.assign('/');};
 return <>
  <div className="page-heading"><div><div className="eyebrow">DO SEU JEITO</div><h1>Perfil</h1><p>Seus objetivos e preferências de treino.</p></div></div>
  <div className="profile-layout">
   <section className="card profile-card">
    <div className="profile-identity"><div className="avatar large">{p.name.slice(0,1).toUpperCase()}</div><div><h2>{p.name}</h2><p>{email}</p><span className="small lime"><ShieldCheck size={14} className="inline-icon"/>Conta protegida pelo Supabase</span></div></div>
    <div className="form-grid"><label>Nome<input defaultValue={p.name} maxLength={80} onBlur={e=>{const name=e.target.value.trim();if(name)update({name});else e.target.value=p.name;}}/></label><label>Altura (cm)<input type="number" min={1} max={250} defaultValue={p.height??''} onBlur={e=>{const n=Number(e.target.value);if(!e.target.value)update({height:null});else if(n>0&&n<=250)update({height:n});else e.target.value=String(p.height??'');}}/></label></div>
    <h3>O que você quer conquistar?</h3><div className="goal-options">{goals.map(g=><label key={g}><Checkbox checked={p.goals.includes(g)} onCheckedChange={checked=>update({goals:checked?[...p.goals,g]:p.goals.filter(x=>x!==g)})}/>{g}</label>)}</div>
   </section>
   <section className="card preferences-card"><h2>Preferências</h2><div className="preference"><div><strong>Unidade de carga</strong><p>Conversão automática dos registros.</p></div><Choice label="Unidade de carga" value={p.unit} onChange={unit=>update({unit:unit as 'kg'|'lb'})} options={[{value:'kg',label:'kg'},{value:'lb',label:'lb'}]}/></div><div className="preference"><div><strong>Descanso padrão</strong><p>Para novos exercícios nas rotinas.</p></div><Choice label="Descanso padrão" value={String(p.rest)} onChange={rest=>update({rest:Number(rest)})} options={[30,45,60,90,120,150,180,240,300].map(v=>({value:String(v),label:`${v}s`}))}/></div><div className="preference"><div><strong>Meta semanal</strong><p>Quantidade de treinos na semana.</p></div><Choice label="Meta semanal" value={String(p.weeklyGoal)} onChange={v=>update({weeklyGoal:Number(v)})} options={[1,2,3,4,5,6,7].map(v=>({value:String(v),label:`${v} treinos`}))}/></div><div className="preference"><div><strong>Tema escuro</strong><p>Mais conforto durante o treino.</p></div><Switch aria-label="Tema escuro" checked={p.theme==='dark'} onCheckedChange={v=>update({theme:v?'dark':'light'})}/></div></section>
  </div>
  <section className="card data-card"><div><h2>Dados demonstrativos</h2><p>Os exemplos ajudam a explorar o app. Seus treinos reais ficam separados e serão preservados.</p></div><button className="secondary" disabled={!data.sessions.some(s=>s.isDemo)} onClick={()=>setClear(true)}><Trash2 size={17}/>Remover exemplos</button></section>
  <button className="text-button signout" onClick={signOut}><LogOut size={17}/>Sair da conta</button>
  <Confirm open={clear} title="Remover históricos de exemplo?" description="Esta ação remove somente as sessões fictícias. Suas rotinas, medidas e treinos reais serão mantidos." action="Remover exemplos" onClose={()=>setClear(false)} onConfirm={()=>{data.sessions.filter(s=>s.isDemo).forEach(s=>mutate('session',s,true));setClear(false);}}/>
 </>;
}
