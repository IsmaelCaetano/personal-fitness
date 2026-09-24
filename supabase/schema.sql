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
