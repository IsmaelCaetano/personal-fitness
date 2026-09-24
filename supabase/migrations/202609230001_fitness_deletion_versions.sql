begin;

-- Additive migration. Existing rows and RLS policies remain unchanged.
-- Deleted resources keep only id/resource/version and a timestamp; the API
-- clears the payload. Versions must not restart after restoring an ID.
alter table public.fitness_resources
  add column if not exists deleted_at timestamptz;

comment on column public.fitness_resources.deleted_at is
  'Deletion marker. Keep version monotonic when an offline client restores the same ID.';

commit;
