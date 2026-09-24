-- The name entered by a trainer belongs to a pending invitation, not to the
-- student's fitness history. Existing invitations keep working without it.
alter table public.trainer_invites
  add column if not exists student_name text
  check (student_name is null or length(student_name) between 1 and 80);
