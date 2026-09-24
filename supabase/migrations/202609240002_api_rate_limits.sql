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
