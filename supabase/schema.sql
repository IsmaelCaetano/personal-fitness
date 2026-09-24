create table if not exists public.fitness_resources (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  resource text not null check (resource in ('profile','exercise','routine','session','measurement')),
  payload jsonb not null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- For existing installations use the versioned migration before deploying code.
alter table public.fitness_resources add column if not exists deleted_at timestamptz;

alter table public.fitness_resources enable row level security;

create policy "Users can read their fitness data" on public.fitness_resources for select using (auth.uid() = user_id);
create policy "Users can create their fitness data" on public.fitness_resources for insert with check (auth.uid() = user_id);
create policy "Users can update their fitness data" on public.fitness_resources for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their fitness data" on public.fitness_resources for delete using (auth.uid() = user_id);

create index if not exists fitness_resources_user_resource_idx on public.fitness_resources (user_id, resource);

-- Apply after 202609230001_fitness_deletion_versions.sql and before deploying the quota API.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  feature text not null check (length(feature) between 1 and 80),
  usage_count integer not null default 0 check (usage_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start, feature)
);
create table if not exists public.ai_generation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  feature text not null,
  period_start date not null,
  status text not null check (status in ('pending','completed','failed')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, request_id),
  foreign key (user_id, period_start, feature) references public.ai_usage(user_id, period_start, feature)
);
create index if not exists ai_generation_requests_pending_idx on public.ai_generation_requests(user_id, feature, period_start, created_at) where status='pending';
alter table public.ai_usage enable row level security;
alter table public.ai_generation_requests enable row level security;
revoke all on public.ai_usage, public.ai_generation_requests from anon,authenticated;
grant select on public.ai_usage to authenticated;
create policy "Account reads usage" on public.ai_usage for select to authenticated using ((select auth.uid())=user_id);

create or replace function public.reserve_ai_workout(p_user_id uuid,p_request_id uuid,p_limit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_period date:=date_trunc('month',now() at time zone 'UTC')::date;
        v_renew date:=(date_trunc('month',now() at time zone 'UTC')+interval '1 month')::date;
        v_status text; v_response jsonb; v_created timestamptz; v_used integer; v_request_period date; v_expired integer;
begin
  if p_user_id is null or p_request_id is null or p_limit not between 1 and 10000 then raise exception 'Invalid quota arguments'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||v_period::text||'workout_generation',0));
  insert into public.ai_usage(user_id,period_start,feature) values(p_user_id,v_period,'workout_generation') on conflict do nothing;
  with expired as (update public.ai_generation_requests set status='failed',updated_at=now() where user_id=p_user_id and period_start=v_period and feature='workout_generation' and status='pending' and created_at < now()-interval '2 minutes' returning 1)
    select count(*) into v_expired from expired;
  if v_expired>0 then update public.ai_usage set usage_count=greatest(0,usage_count-v_expired),updated_at=now() where user_id=p_user_id and period_start=v_period and feature='workout_generation'; end if;
  select status,response,created_at,period_start into v_status,v_response,v_created,v_request_period from public.ai_generation_requests where user_id=p_user_id and request_id=p_request_id;
  if found then
    if v_request_period<>v_period and v_status='pending' then return pg_catalog.jsonb_build_object('status','failed','used',0,'limit',p_limit,'renewsAt',v_renew); end if;
    select usage_count into v_used from public.ai_usage where user_id=p_user_id and period_start=v_period and feature='workout_generation';
    return pg_catalog.jsonb_build_object('status',v_status,'used',v_used,'limit',p_limit,'renewsAt',v_renew,'program',v_response);
  end if;
  select usage_count into v_used from public.ai_usage where user_id=p_user_id and period_start=v_period and feature='workout_generation';
  if v_used>=p_limit then return pg_catalog.jsonb_build_object('status','limit','used',v_used,'limit',p_limit,'renewsAt',v_renew); end if;
  update public.ai_usage set usage_count=usage_count+1,updated_at=now() where user_id=p_user_id and period_start=v_period and feature='workout_generation';
  insert into public.ai_generation_requests(user_id,request_id,feature,period_start,status) values(p_user_id,p_request_id,'workout_generation',v_period,'pending');
  return pg_catalog.jsonb_build_object('status','granted','used',v_used+1,'limit',p_limit,'renewsAt',v_renew);
end; $$;

create or replace function public.complete_ai_workout(p_user_id uuid,p_request_id uuid,p_program jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_period date; v_status text;
begin
  if p_program is null or pg_catalog.jsonb_typeof(p_program)<>'object' then return false; end if;
  select period_start into v_period from public.ai_generation_requests where user_id=p_user_id and request_id=p_request_id;
  if not found then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||v_period::text||'workout_generation',0));
  select status into v_status from public.ai_generation_requests where user_id=p_user_id and request_id=p_request_id for update;
  if v_status<>'pending' then return false; end if;
  update public.ai_generation_requests set status='completed',response=p_program,updated_at=now() where user_id=p_user_id and request_id=p_request_id;
  return true;
end; $$;

create or replace function public.release_ai_workout(p_user_id uuid,p_request_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_period date; v_status text;
begin
  select period_start into v_period from public.ai_generation_requests where user_id=p_user_id and request_id=p_request_id;
  if not found then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text||v_period::text||'workout_generation',0));
  select status into v_status from public.ai_generation_requests where user_id=p_user_id and request_id=p_request_id for update;
  if v_status<>'pending' then return false; end if;
  update public.ai_generation_requests set status='failed',updated_at=now() where user_id=p_user_id and request_id=p_request_id;
  update public.ai_usage set usage_count=usage_count-1,updated_at=now() where user_id=p_user_id and period_start=v_period and feature='workout_generation' and usage_count>0;
  return true;
end; $$;

revoke all on function public.reserve_ai_workout(uuid,uuid,integer), public.complete_ai_workout(uuid,uuid,jsonb),public.release_ai_workout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_workout(uuid,uuid,integer),public.complete_ai_workout(uuid,uuid,jsonb),public.release_ai_workout(uuid,uuid) to service_role;
-- Per-user transactional limits; no browser may choose an operation's server limit.
create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  window_start timestamptz not null,
  usage_count integer not null default 0 check (usage_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, operation, window_start)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;
create or replace function public.consume_api_rate_limit(p_operation text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_seconds integer;
  v_bucket timestamptz;
  v_count integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  case p_operation
    when 'ocr' then v_limit := 12; v_seconds := 3600;
    when 'workout_generation' then v_limit := 6; v_seconds := 3600;
    when 'trainer_invite' then v_limit := 10; v_seconds := 86400;
    when 'student_feedback' then v_limit := 10; v_seconds := 3600;
    else raise exception 'INVALID_OPERATION';
  end case;
  v_bucket := to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds);
  insert into public.api_rate_limits(user_id, operation, window_start, usage_count)
    values (v_user, p_operation, v_bucket, 1)
  on conflict (user_id, operation, window_start) do update
    set usage_count = public.api_rate_limits.usage_count + 1, updated_at = now()
    where public.api_rate_limits.usage_count < v_limit
  returning usage_count into v_count;
  return v_count is not null;
end;
$$;
revoke all on function public.consume_api_rate_limit(text) from public, anon;
grant execute on function public.consume_api_rate_limit(text) to authenticated;
-- Trainer relationships remain relational and separate from personal fitness history.
create table public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'individual' check (account_type in ('individual','trainer')),
  display_name text not null default '' check (length(display_name) <= 80),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.trainer_profiles (
  user_id uuid primary key references public.account_profiles(user_id) on delete cascade,
  bio text not null default '' check (length(bio) <= 1000),
  phone text check (length(phone) <= 50), registration text check (length(registration) <= 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.trainer_students (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.account_profiles(user_id),
  student_id uuid not null references public.account_profiles(user_id),
  status text not null check (status in ('invited','active','paused','ended')),
  created_at timestamptz not null default now(), started_at timestamptz, ended_at timestamptz,
  check (trainer_id <> student_id), unique(trainer_id,student_id)
);
create index trainer_students_student_status_idx on public.trainer_students(student_id,status);
create index trainer_students_trainer_status_idx on public.trainer_students(trainer_id,status);
create table public.trainer_invites (
  id uuid primary key default gen_random_uuid(), trainer_id uuid not null references public.account_profiles(user_id),
  email text not null check (length(email) between 5 and 255),
  student_name text check (student_name is null or length(student_name) between 1 and 80),
  intake jsonb check (intake is null or (jsonb_typeof(intake) = 'object' and pg_column_size(intake) <= 4000)),
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz not null, created_at timestamptz not null default now(), accepted_at timestamptz
);
create index trainer_invites_trainer_status_idx on public.trainer_invites(trainer_id,status);
create index trainer_invites_email_status_idx on public.trainer_invites(lower(email),status);
create table public.trainer_routines (
  id uuid primary key default gen_random_uuid(), trainer_id uuid not null references public.account_profiles(user_id),
  student_id uuid not null references public.account_profiles(user_id), routine jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,student_id)
);
create index trainer_routines_student_idx on public.trainer_routines(student_id,updated_at desc);
create table public.student_feedback (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.account_profiles(user_id),
  trainer_id uuid not null references public.account_profiles(user_id),
  routine_id uuid references public.trainer_routines(id), session_id text, exercise_id text,
  category text not null check (category in ('too_heavy','too_light','discomfort','equipment','dislike','replacement','comment')),
  message text not null check (length(message) between 1 and 2000),
  response text check (length(response) <= 2000), status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create index student_feedback_trainer_status_idx on public.student_feedback(trainer_id,status,created_at desc);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.account_profiles(user_id),
  type text not null, title text not null check (length(title) <= 120),
  body text not null check (length(body) <= 500), read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
create table public.payment_records (
  id uuid primary key default gen_random_uuid(), trainer_id uuid not null references public.account_profiles(user_id),
  student_id uuid not null references public.account_profiles(user_id),
  reference_month date not null, due_date date not null, amount numeric(10,2) not null check (amount >= 0 and amount <= 1000000),
  status text not null default 'pending' check (status in ('pending','paid','overdue','waived')),
  paid_at timestamptz, notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(trainer_id,student_id,reference_month)
);
create index payment_records_trainer_due_idx on public.payment_records(trainer_id,status,due_date);
create index payment_records_student_idx on public.payment_records(student_id,reference_month desc);

create or replace function public.is_active_trainer(p_trainer uuid,p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select (auth.uid()=p_trainer or auth.uid()=p_student) and exists(select 1 from public.trainer_students where trainer_id=p_trainer and student_id=p_student and status='active')
$$;
revoke all on function public.is_active_trainer(uuid,uuid) from public,anon;
grant execute on function public.is_active_trainer(uuid,uuid) to authenticated;

alter table public.account_profiles enable row level security;
alter table public.trainer_profiles enable row level security;
alter table public.trainer_students enable row level security;
alter table public.trainer_invites enable row level security;
alter table public.trainer_routines enable row level security;
alter table public.student_feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.payment_records enable row level security;

create policy account_select on public.account_profiles for select to authenticated using (user_id=(select auth.uid()) or public.is_active_trainer((select auth.uid()),user_id));
create policy account_insert on public.account_profiles for insert to authenticated with check (user_id=(select auth.uid()) and account_type='individual');
create policy account_update on public.account_profiles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke update on public.account_profiles from authenticated;
grant update(display_name) on public.account_profiles to authenticated;
create policy trainer_profile_select on public.trainer_profiles for select to authenticated using (user_id=(select auth.uid()) or public.is_active_trainer(user_id,(select auth.uid())));
create policy trainer_profile_update on public.trainer_profiles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy relationship_read on public.trainer_students for select to authenticated using (trainer_id=(select auth.uid()) or student_id=(select auth.uid()));
create policy invites_read on public.trainer_invites for select to authenticated using (trainer_id=(select auth.uid()));
create policy routine_read on public.trainer_routines for select to authenticated using (student_id=(select auth.uid()) or (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id)));
create policy routine_insert on public.trainer_routines for insert to authenticated with check (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id));
create policy routine_update on public.trainer_routines for update to authenticated using (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id)) with check (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id));
create policy routine_delete on public.trainer_routines for delete to authenticated using (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id));
revoke update on public.trainer_routines from authenticated;
grant update(routine,version,updated_at) on public.trainer_routines to authenticated;
create policy feedback_read on public.student_feedback for select to authenticated using (student_id=(select auth.uid()) or (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id)));
create policy feedback_insert on public.student_feedback for insert to authenticated with check (student_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id) and (routine_id is null or exists(select 1 from public.trainer_routines where id=routine_id and trainer_id=student_feedback.trainer_id and student_id=student_feedback.student_id)));
create policy feedback_update on public.student_feedback for update to authenticated using (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id)) with check (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id));
revoke update on public.student_feedback from authenticated;
grant update(response,status,resolved_at) on public.student_feedback to authenticated;
create policy notification_read on public.notifications for select to authenticated using (user_id=(select auth.uid()));
create policy notification_update on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy payments_read on public.payment_records for select to authenticated using (student_id=(select auth.uid()) or (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id)));
create policy payments_insert on public.payment_records for insert to authenticated with check (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id));
create policy payments_update on public.payment_records for update to authenticated using (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id)) with check (trainer_id=(select auth.uid()) and public.is_active_trainer(trainer_id,student_id));
revoke update on public.payment_records from authenticated;
grant update(reference_month,due_date,amount,status,paid_at,notes,updated_at) on public.payment_records to authenticated;

-- A clear opt-in switches the current authenticated account into trainer mode.
create or replace function public.register_trainer(p_display_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null or length(trim(p_display_name)) not between 1 and 80 then return false; end if;
 insert into public.account_profiles(user_id,account_type,display_name) values(v_user,'trainer',trim(p_display_name))
 on conflict(user_id) do update set account_type='trainer',display_name=excluded.display_name,updated_at=now();
 insert into public.trainer_profiles(user_id) values(v_user) on conflict do nothing;
 return true;
end; $$;
revoke all on function public.register_trainer(text) from public,anon;
grant execute on function public.register_trainer(text) to authenticated;

create or replace function public.accept_trainer_invite(p_invite_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 v_user uuid := auth.uid(); v_email text; v_trainer uuid; v_name text; v_intake jsonb;
 v_profile jsonb;
begin
 if v_user is null then return false; end if;
 select lower(email) into v_email from auth.users where id=v_user;
 select trainer_id,student_name,intake into v_trainer,v_name,v_intake from public.trainer_invites
  where id=p_invite_id and lower(email)=v_email and status='pending' and expires_at>now() for update;
 if v_trainer is null or v_trainer=v_user then return false; end if;
 insert into public.account_profiles(user_id,account_type,display_name)
  values(v_user,'individual',coalesce(v_name,'')) on conflict do nothing;
 if v_intake is not null and v_name is not null then
  v_profile := jsonb_build_object(
   'id',v_user::text,'name',v_name,'height',v_intake->'height',
   'weight',v_intake->'weight','goals',v_intake->'goals',
   'weeklyGoal',v_intake->'weeklyGoal','level',v_intake->'level',
   'preferredDuration',v_intake->'preferredDuration',
   'preferredDays',v_intake->'preferredDays',
   'availableEquipment',v_intake->'availableEquipment',
   'preferences',v_intake->'preferences','limitations',v_intake->'limitations',
   'unit','kg','rest',90,'theme','dark','onboarded',true);
  insert into public.fitness_resources(user_id,id,resource,payload,version)
   values(v_user,v_user::text,'profile',v_profile,1)
   on conflict(user_id,id) do update
    set payload=public.fitness_resources.payload || (excluded.payload - 'id' - 'unit' - 'rest' - 'theme'),
        version=public.fitness_resources.version+1,updated_at=now(),deleted_at=null
    where public.fitness_resources.resource='profile'
      and coalesce((public.fitness_resources.payload->>'onboarded')::boolean,false)=false;
 end if;
 insert into public.trainer_students(trainer_id,student_id,status,started_at)
  values(v_trainer,v_user,'active',now()) on conflict(trainer_id,student_id) do update
  set status='active',started_at=now(),ended_at=null;
 update public.trainer_invites set status='accepted',accepted_at=now() where id=p_invite_id;
 return true;
end; $$;
revoke all on function public.accept_trainer_invite(uuid) from public,anon;
grant execute on function public.accept_trainer_invite(uuid) to authenticated;
create policy invite_student_read on public.trainer_invites for select to authenticated
 using (status='pending' and expires_at>now() and lower(email)=(select lower(auth.jwt()->>'email')));
create policy trainer_reads_student_history on public.fitness_resources for select to authenticated
 using (resource in ('profile','session','measurement') and public.is_active_trainer((select auth.uid()),user_id));
create policy account_select_active_trainer on public.account_profiles for select to authenticated
 using (public.is_active_trainer(user_id,(select auth.uid())));
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
