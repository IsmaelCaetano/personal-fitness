create unique index notifications_payment_reminder_once_idx on public.notifications(user_id,type,(metadata->>'paymentId')) where type in ('payment_due','payment_overdue');
create or replace function public.refresh_payment_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); p record;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 for p in select id,reference_month,due_date from public.payment_records
  where (student_id=v_user or trainer_id=v_user) and status='pending' and due_date<=current_date+7
  order by due_date desc limit 50
 loop
  insert into public.notifications(user_id,type,title,body,metadata)
   values(v_user,case when p.due_date<current_date then 'payment_overdue' else 'payment_due' end,
    case when p.due_date<current_date then 'Pagamento atrasado' else 'Pagamento próximo' end,
    'Referência '||to_char(p.reference_month,'MM/YYYY')||' · vencimento '||to_char(p.due_date,'DD/MM/YYYY'),
    pg_catalog.jsonb_build_object('paymentId',p.id))
   on conflict do nothing;
 end loop;
end; $$;
revoke all on function public.refresh_payment_reminders() from public,anon;
grant execute on function public.refresh_payment_reminders() to authenticated;
