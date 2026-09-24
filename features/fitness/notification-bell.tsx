'use client';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
type Notice = { id:string; title:string; body:string; read_at:string|null; created_at:string };
export function NotificationBell() {
  const [notices,setNotices]=useState<Notice[]>([]);
  const [open,setOpen]=useState(false);
  const [error,setError]=useState('');
  async function refresh(){
    try{const response=await fetch('/api/notifications',{cache:'no-store'});if(!response.ok) return;const data=await response.json() as {notifications:Notice[]};setNotices(data.notifications??[]);}catch{setError('Notificações indisponíveis.');}
  }
  useEffect(()=>{fetch('/api/notifications',{cache:'no-store'}).then(async response=>{if(response.ok){const data=await response.json() as {notifications:Notice[]};setNotices(data.notifications??[]);}}).catch(()=>{});},[]);
  async function markRead(id:string){
    try{const response=await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!response.ok)throw new Error();await refresh();}catch{setError('Não foi possível marcar a notificação como lida.');}
  }
  return <div className="card" style={{maxWidth:520,marginBottom:12}}>
    <button className="text-button" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void refresh();}}><Bell size={18}/> Notificações {notices.filter(item=>!item.read_at).length > 0 ? `(${notices.filter(item=>!item.read_at).length})`:''}</button>
    {open && <div><h3>Notificações</h3>{error&&<p role="alert">{error}</p>}{notices.length===0&&<p>Nenhuma notificação.</p>}{notices.map(item=><div key={item.id} className="routine-management"><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleDateString('pt-BR')}</small></div>{!item.read_at&&<button className="secondary" onClick={()=>markRead(item.id)}>Marcar como lida</button>}</div>)}</div>}
  </div>;
}
