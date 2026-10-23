-- TIC Chairman and TIC President are not roles the console needs. Nobody holds
-- either (the two demo accounts were deleted), so the check simply narrows.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in (
    'founder',
    'developer',
    'admin',
    'tic_admin',
    'tic_ceo',
    'tic_coordinator',
    'tic_head'
  ));
