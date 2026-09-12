-- ---------------------------------------------------------------------------
-- Company signup now collects a contact person's email and phone number.
--
-- Both are persisted on public.companies so the TIC admin dashboard can see
-- them. Phone also continues to flow into profiles.phone via the existing
-- handle_new_user() path (it already read `phone` from signup metadata).
-- ---------------------------------------------------------------------------

alter table public.companies
  add column if not exists contact_email text not null default '',
  add column if not exists phone         text not null default '';

-- A company may write these two columns for its own row (RLS still limits it to
-- auth.uid() = id). The trigger below inserts them as security definer, so these
-- grants only matter for later self-service edits from the settings page.
grant insert (contact_email, phone) on public.companies to authenticated;
grant update (contact_email, phone) on public.companies to authenticated;

-- Copy contact_email + phone from signup metadata into the new company row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := coalesce(new.raw_user_meta_data ->> 'role', 'founder');
  meta_company text := coalesce(new.raw_user_meta_data ->> 'company_name', '');
begin
  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    case when meta_role = 'company' then 'company' else 'founder' end,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  if meta_role = 'company' then
    insert into public.companies (id, email, company_name, company_slug, website, contact_name, contact_email, phone)
    values (
      new.id,
      coalesce(new.email, ''),
      meta_company,
      left(public.slugify(meta_company), 64),
      coalesce(new.raw_user_meta_data ->> 'website', ''),
      coalesce(new.raw_user_meta_data ->> 'contact_name', ''),
      coalesce(new.raw_user_meta_data ->> 'contact_email', ''),
      coalesce(new.raw_user_meta_data ->> 'phone', '')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
