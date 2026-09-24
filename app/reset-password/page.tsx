'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {KeyRound} from 'lucide-react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import {validateNewPassword} from '@/lib/fitness/password';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ResetPassword(){
 const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [inviteId,setInviteId]=useState<string|null>(null);
 const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const initialInviteTokens=useRef<{accessToken:string;refreshToken:string}|null>(null);
 const validation=useRef<Promise<boolean>|null>(null);
 useEffect(()=>{
  let active=true;
  const invite=new URLSearchParams(window.location.search).get('invite');
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  const accessToken=fragment.get('access_token')??initialInviteTokens.current?.accessToken;
  const refreshToken=fragment.get('refresh_token')??initialInviteTokens.current?.refreshToken;
  if(accessToken&&refreshToken)initialInviteTokens.current={accessToken,refreshToken};
  if(window.location.hash)window.history.replaceState(null,'',window.location.pathname+window.location.search);
  if(invite&&(!uuid.test(invite)||!accessToken||!refreshToken)){queueMicrotask(()=>{if(active)setError('O convite expirou ou está incompleto. Peça um novo convite ao personal.');});return()=>{active=false;};}
  const auth=createClient().auth;
  validation.current??=(async()=>{
   if(accessToken&&refreshToken){const session=await auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(session.error)throw session.error;}
   const {data,error:authError}=await auth.getUser();
   return !authError&&!!data.user;
  })();
  void validation.current.then(valid=>{if(!active)return;if(invite)setInviteId(invite);if(valid)setReady(true);else setError('O link expirou ou é inválido. Peça um novo convite ou solicite a recuperação da senha.');}).catch(()=>{if(active)setError('Não foi possível validar este acesso. Tente novamente.');});
  return()=>{active=false;};
 },[]);
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(!ready)return;
  const issue=validateNewPassword(password,confirmation);if(issue){setError(issue);return;}
  setBusy(true);setError('');setMessage('');
  try{
   const result=await createClient().auth.updateUser({password});
   if(result.error)throw result.error;
   setPassword('');setConfirmation('');
   if(inviteId){
    const response=await fetch('/api/trainer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'accept',inviteId})});
    if(!response.ok){setMessage('Senha definida. Entre no aplicativo para aceitar o convite pendente ou peça outro convite ao personal.');return;}
    setMessage('Senha criada e acompanhamento ativado.');
   }else setMessage('Senha alterada com sucesso.');
   window.setTimeout(()=>window.location.assign('/'),1200);
  }catch{setError('Não foi possível definir a senha. Confira o link recebido e tente novamente.');}
  finally{setBusy(false);}
 };
 return <main className="access-page reset-only"><section className="access-panel"><form className="access-card" onSubmit={submit}><div className="access-icon"><KeyRound size={24}/></div><p className="eyebrow">{inviteId?'CONVITE DO PERSONAL':'NOVA SENHA'}</p><h2>{inviteId?'Defina sua senha':'Crie uma nova senha'}</h2><p className="access-description">{inviteId?'Seu personal preparou seu acesso. Defina sua senha para ativar o acompanhamento.':'Escolha uma senha com pelo menos 8 caracteres.'}</p><div className="access-fields"><label>Nova senha<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></div>{error&&<p className="access-feedback error" role="alert">{error}</p>}{message&&<p className="access-feedback success" role="status">{message}</p>}<button className="primary access-action" disabled={busy||!ready}>{busy?'Salvando...':ready?'Salvar senha':'Validando convite...'}</button>{message&&<Link href="/" className="secondary">Entrar no aplicativo</Link>}</form></section></main>;
}
