'use client';

import {useState,type FormEvent} from 'react';
import {ArrowRight,Check,Dumbbell,Scale,Ruler,Target} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {newId,type FitnessData,type Measurement} from '@/lib/fitness/model';
import {localDate} from '@/lib/fitness/domain';
import type {FitnessStore} from './use-fitness';
import {goals} from './profile';

export function ProfileOnboarding({data,mutate}:{data:FitnessData;mutate:FitnessStore['mutate']}){
 const [height,setHeight]=useState(data.profile.height?String(data.profile.height):'');
 const [weight,setWeight]=useState(data.profile.weight?String(data.profile.weight):'');
 const [selectedGoals,setSelectedGoals]=useState<string[]>(data.profile.goals);
 const [error,setError]=useState('');
 const submit=(event:FormEvent)=>{event.preventDefault();const heightValue=Number(height.replace(',','.'));const weightValue=Number(weight.replace(',','.'));if(!Number.isFinite(heightValue)||heightValue<80||heightValue>250){setError('Informe uma altura válida entre 80 e 250 cm.');return;}if(!Number.isFinite(weightValue)||weightValue<20||weightValue>500){setError('Informe um peso válido entre 20 e 500 kg.');return;}if(!selectedGoals.length){setError('Escolha pelo menos um objetivo.');return;}setError('');const measurement:Measurement={id:newId(),date:localDate(),weight:weightValue,waist:null,chest:null,arm:null,thigh:null,hip:null};mutate('measurement',measurement);mutate('profile',{...data.profile,height:heightValue,weight:weightValue,goals:selectedGoals,onboarded:true});};
 return <main className="profile-onboarding-page"><section className="profile-onboarding-card"><div className="profile-onboarding-brand"><span><Dumbbell size={24}/></span><strong>personal fitness.</strong></div><div className="profile-onboarding-progress"><span>1</span><i/><span className="active">2</span><i/><span>3</span></div><div className="profile-onboarding-heading"><p className="eyebrow">SEU PONTO DE PARTIDA</p><h1>Vamos personalizar seu espaço.</h1><p>Essas informações ajudam a acompanhar sua evolução. Você poderá alterá-las depois no perfil.</p></div><form onSubmit={submit}><div className="onboarding-measures"><label><span><Ruler size={18}/>Altura</span><div><input type="text" inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)} placeholder="175" aria-label="Altura em centímetros" required/><b>cm</b></div></label><label><span><Scale size={18}/>Peso atual</span><div><input type="text" inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="80,0" aria-label="Peso atual em quilogramas" required/><b>kg</b></div></label></div><fieldset><legend><Target size={18}/>Qual é o seu objetivo?</legend><p>Você pode escolher mais de um.</p><div className="onboarding-objectives">{goals.map(goal=><label className={selectedGoals.includes(goal)?'selected':''} key={goal}><Checkbox checked={selectedGoals.includes(goal)} onCheckedChange={checked=>setSelectedGoals(checked?[...selectedGoals,goal]:selectedGoals.filter(item=>item!==goal))}/><span>{goal}</span>{selectedGoals.includes(goal)&&<Check size={17}/>}</label>)}</div></fieldset>{error&&<p className="onboarding-error" role="alert">{error}</p>}<button className="primary profile-onboarding-submit" type="submit">Salvar e continuar<ArrowRight size={18}/></button></form><p className="profile-onboarding-privacy">Seus dados ficam vinculados apenas à sua conta.</p></section></main>;
}
