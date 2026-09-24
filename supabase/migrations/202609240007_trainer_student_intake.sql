-- Trainer prepares a student's fitness profile before sending the invitation.
-- Old pending invitations without intake still follow the previous onboarding flow.
alter table public.trainer_invites add column if not exists intake jsonb
  check (intake is null or (jsonb_typeof(intake) = 'object' and pg_column_size(intake) <= 4000));

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
  -- Build the profile from an explicit allowlist. Invitation content cannot
  -- override id, role, owner, theme, unit, or any future privileged field.
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
