'use client';
import { useState } from 'react';
import { toast } from 'sonner';
type Category='too_heavy'|'too_light'|'discomfort'|'equipment'|'dislike'|'replacement'|'comment';
export function AssignedFeedback({trainerId,assignmentId,sessionId,exerciseId}:{trainerId:string;assignmentId:string;sessionId?:string;exerciseId?:string}){
  const [open,setOpen]=useState(false);
  const [category,setCategory]=useState<Category>('replacement');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(){
    setBusy(true);
    try{const response=await fetch('/api/trainer/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainerId,routineId:assignmentId,sessionId,exerciseId,category,message})});
      const data=await response.json() as {error?:string};
      if(!response.ok){toast.error(data.error??'Não foi possível enviar.');return;}
      toast.success('Feedback enviado ao personal');setMessage('');setOpen(false);
    }catch{toast.error('Sem conexão. Tente novamente.');}finally{setBusy(false);}
  }
  return <div><button className="secondary" onClick={()=>setOpen(!open)}>{exerciseId?'Solicitar outra opção':'Enviar feedback ao personal'}</button>
    {open&&<div className="card"><label>Assunto<select value={category} onChange={event=>setCategory(event.target.value as Category)}><option value="replacement">Pedir troca</option><option value="too_heavy">Treino muito pesado</option><option value="too_light">Treino muito leve</option><option value="discomfort">Dor ou desconforto</option><option value="equipment">Equipamento indisponível</option><option value="dislike">Não gostei</option><option value="comment">Comentário</option></select></label><label>Mensagem<textarea maxLength={2000} value={message} onChange={event=>setMessage(event.target.value)} placeholder="Conte ao personal o que precisa mudar" /></label><button className="primary" disabled={busy||!message.trim()} onClick={submit}>Enviar</button>{category==='discomfort'&&<p>Este contato não substitui avaliação profissional para dor.</p>}</div>}
  </div>;
}
