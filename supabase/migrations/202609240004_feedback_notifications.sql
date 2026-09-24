-- Notifications follow feedback creation and reply atomically.
create or replace function public.notify_student_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then
   insert into public.notifications(user_id,type,title,body,metadata)
   values(new.trainer_id,case when new.category='replacement' then 'replacement_request' else 'feedback' end,
     'Novo feedback do aluno',left(new.message,240),pg_catalog.jsonb_build_object('feedbackId',new.id));
 elsif tg_op='UPDATE' and (new.response is distinct from old.response or new.status is distinct from old.status) then
   insert into public.notifications(user_id,type,title,body,metadata)
   values(new.student_id,'feedback_response','Seu personal respondeu ao feedback',
     left(coalesce(new.response,'Feedback resolvido'),240),pg_catalog.jsonb_build_object('feedbackId',new.id));
 end if;
 return new;
end; $$;
create trigger feedback_notification_insert after insert on public.student_feedback
 for each row execute function public.notify_student_feedback();
create trigger feedback_notification_update after update of response,status on public.student_feedback
 for each row execute function public.notify_student_feedback();

create or replace function public.notify_trainer_routine()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.notifications(user_id,type,title,body,metadata)
 values(new.student_id,'trainer_plan',
  case when tg_op='INSERT' then 'Novo treino atribuído' else 'Seu personal alterou um treino' end,
  left(coalesce(new.routine->>'name','Treino'),240),pg_catalog.jsonb_build_object('assignmentId',new.id));
 return new;
end; $$;
create trigger trainer_routine_notify_insert after insert on public.trainer_routines
 for each row execute function public.notify_trainer_routine();
create trigger trainer_routine_notify_update after update of routine on public.trainer_routines
 for each row when (new.routine is distinct from old.routine) execute function public.notify_trainer_routine();
create or replace function public.notify_new_student()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status='active' and (tg_op='INSERT' or old.status is distinct from new.status) then
  insert into public.notifications(user_id,type,title,body,metadata)
  values(new.student_id,'invite_accepted','Acompanhamento iniciado','Seu personal agora pode atribuir treinos.',pg_catalog.jsonb_build_object('relationshipId',new.id));
  insert into public.notifications(user_id,type,title,body,metadata)
  values(new.trainer_id,'invite_accepted','Aluno aceitou o convite','O vínculo está ativo.',pg_catalog.jsonb_build_object('relationshipId',new.id));
 end if;
 return new;
end; $$;
create trigger trainer_student_notify_insert after insert on public.trainer_students
 for each row execute function public.notify_new_student();
create trigger trainer_student_notify_update after update of status on public.trainer_students
 for each row execute function public.notify_new_student();
