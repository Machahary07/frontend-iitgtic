-- Security pass over profiles and the public functions.
--
-- 1. "profiles: read own company" looked the reader's company up in profiles
--    from inside a profiles policy, so Postgres refused every authenticated
--    read of the table ("infinite recursion detected"). It also ignored
--    member_status: anyone could sign up with company_id in their user
--    metadata, land as a pending member, and read every profile in that
--    company. my_company_ids() is definer (no recursion) and only returns
--    companies the reader owns or is an approved member of.
--
-- 2. handle_new_user took company_id from raw_user_meta_data, which the public
--    signUp call sets freely. It now reads raw_app_meta_data, which only the
--    service role can write (the founder console's createUser call).
--
-- 3. Profiles are created by the signup trigger, never by the client, and the
--    client insert grant included role -- a founder could have inserted
--    themselves as admin if their profile row was ever missing.
--
-- 4. search_path pinned on the three functions the linter flagged, and anon
--    loses EXECUTE on functions only authenticated policies or triggers use.
--    is_company_verified stays: the anon jobs policy calls it.

drop policy if exists "profiles: read own company" on public.profiles;
create policy "profiles: read own company"
  on public.profiles for select to authenticated
  using (company_id is not null and company_id in (select public.my_company_ids()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_company_id uuid := nullif(new.raw_app_meta_data ->> 'company_id', '')::uuid;
begin
  insert into public.profiles (id, role, full_name, email, phone, company_id, member_status)
  values (
    new.id,
    'founder',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    meta_company_id,
    case when meta_company_id is not null then 'pending' else 'approved' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke insert on public.profiles from authenticated;
drop policy if exists "profiles: insert own" on public.profiles;

alter function public.slugify(text) set search_path = '';
alter function public.touch_updated_at() set search_path = '';
alter function public.audit_actor() set search_path = '';

revoke execute on function public.my_company_ids() from public, anon;
revoke execute on function public.company_owns_job_slug(text) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.audit_trigger() from public, anon, authenticated;
