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

-- Authenticated email identity, never a student ID from the browser, accepts a single pending invite.
create or replace function public.accept_trainer_invite(p_invite_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_email text; v_trainer uuid;
begin
 if v_user is null then return false; end if;
 select lower(email) into v_email from auth.users where id=v_user;
 select trainer_id into v_trainer from public.trainer_invites
  where id=p_invite_id and lower(email)=v_email and status='pending' and expires_at>now() for update;
 if v_trainer is null then return false; end if;
 insert into public.account_profiles(user_id,account_type,display_name) values(v_user,'individual','') on conflict do nothing;
 if v_trainer=v_user then return false; end if;
 insert into public.trainer_students(trainer_id,student_id,status,started_at)
  values(v_trainer,v_user,'active',now()) on conflict(trainer_id,student_id) do update
  set status='active',started_at=now(),ended_at=null;
 update public.trainer_invites set status='accepted',accepted_at=now() where id=p_invite_id;
 return true;
end; $$;
revoke all on function public.accept_trainer_invite(uuid) from public,anon;
grant execute on function public.accept_trainer_invite(uuid) to authenticated;

-- A student sees only invitations addressed to their verified Auth email.
create policy invite_student_read on public.trainer_invites for select to authenticated
 using (status='pending' and expires_at>now() and lower(email)=(select lower(auth.jwt()->>'email')));

-- A linked trainer may read the student's necessary profile and execution history.
create policy trainer_reads_student_history on public.fitness_resources for select to authenticated
 using (resource in ('profile','session','measurement') and public.is_active_trainer((select auth.uid()),user_id));
create policy account_select_active_trainer on public.account_profiles for select to authenticated
 using (public.is_active_trainer(user_id,(select auth.uid())));
