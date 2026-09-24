-- Run after 202609240008 in SQL Editor as a privileged database role.
-- All synthetic accounts, invitations and profiles are rolled back.
begin;
do $$
declare
 v_trainer uuid := gen_random_uuid();
 v_individual uuid := gen_random_uuid();
 v_student uuid := gen_random_uuid();
 v_invite uuid;
 v_student_email text := 'student-' || gen_random_uuid()::text || '@example.invalid';
 v_intake jsonb := '{"height":175,"weight":75,"goals":["Ganhar massa"],"weeklyGoal":3,"level":"iniciante","preferredDuration":60,"preferredDays":[1,3,5],"availableEquipment":["Halteres"],"preferences":"","limitations":""}'::jsonb;
begin
 if to_regprocedure('public.register_trainer(text)') is not null then
  raise exception 'Old trainer promotion RPC is still available';
 end if;
 if has_table_privilege('authenticated','public.account_profiles','INSERT')
    or has_column_privilege('authenticated','public.account_profiles','account_type','UPDATE') then
  raise exception 'Authenticated accounts can still change their type';
 end if;

 insert into auth.users(id,email,raw_user_meta_data) values
  (v_trainer,'trainer-'||v_trainer::text||'@example.invalid','{"name":"Personal","signup_intent":"trainer"}'::jsonb),
  (v_individual,'individual-'||v_individual::text||'@example.invalid','{"name":"Individual","signup_intent":"individual"}'::jsonb),
  (v_student,v_student_email,'{"name":"Aluno","signup_intent":"trainer","invited_student":true}'::jsonb);
 if (select account_type from public.account_profiles where user_id=v_trainer) <> 'trainer'
   or not exists(select 1 from public.trainer_profiles where user_id=v_trainer) then
  raise exception 'New trainer does not have a professional profile';
 end if;
 if (select account_type from public.account_profiles where user_id=v_individual) <> 'individual'
   or (select account_type from public.account_profiles where user_id=v_student) <> 'individual' then
  raise exception 'Individual or invited student was promoted';
 end if;

 update auth.users set raw_user_meta_data=jsonb_set(raw_user_meta_data,'{signup_intent}','"trainer"')
  where id=v_individual;
 if (select account_type from public.account_profiles where user_id=v_individual) <> 'individual' then
  raise exception 'Editing metadata changed an existing account type';
 end if;

 insert into public.trainer_invites(trainer_id,email,student_name,intake,expires_at)
  values(v_trainer,v_student_email,'Aluno Teste',v_intake,now()+interval '1 day') returning id into v_invite;
 perform set_config('request.jwt.claim.sub',v_student::text,true);
 if not public.accept_trainer_invite(v_invite) then raise exception 'Invitation was not accepted'; end if;
 if not exists(select 1 from public.trainer_students where trainer_id=v_trainer and student_id=v_student and status='active')
   or not exists(select 1 from public.fitness_resources where user_id=v_student and resource='profile'
     and payload->>'onboarded'='true' and payload->>'name'='Aluno Teste') then
  raise exception 'Student link or completed profile is missing';
 end if;
 if public.accept_trainer_invite(v_invite) then raise exception 'Invitation could be reused'; end if;
 raise notice 'Trainer signup, immutable individual, invitation and student profile: PASS (rolled back)';
end $$;
rollback;
