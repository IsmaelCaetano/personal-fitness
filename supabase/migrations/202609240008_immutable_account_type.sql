-- Account type is fixed when Auth first creates the user. Later changes to
-- user_metadata, visits to /trainer or direct RPC calls cannot promote an
-- existing individual account. Existing profiles and links are untouched.
create or replace function public.create_account_for_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 v_name text := left(trim(coalesce(new.raw_user_meta_data->>'name','')),80);
 v_type text := case
   when new.raw_user_meta_data->>'signup_intent'='trainer'
    and new.raw_user_meta_data->>'invited_student' is distinct from 'true'
    then 'trainer' else 'individual' end;
begin
 insert into public.account_profiles(user_id,account_type,display_name)
  values(new.id,v_type,v_name) on conflict(user_id) do nothing;
 if v_type='trainer' then
  insert into public.trainer_profiles(user_id) values(new.id) on conflict do nothing;
 end if;
 return new;
end; $$;

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account after insert on auth.users
 for each row execute function public.create_account_for_new_auth_user();

-- DROP removes the privileged SECURITY DEFINER entry point, not any data.
drop function if exists public.register_trainer(text);
drop policy if exists account_insert on public.account_profiles;
revoke insert on public.account_profiles, public.trainer_profiles from public, anon, authenticated;
revoke all on function public.create_account_for_new_auth_user() from public, anon, authenticated;
