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
