-- Run once in the Supabase SQL Editor. Idempotent; does not activate users.
begin;
create table if not exists public.tracker_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now()
);
alter table public.tracker_members enable row level security;
revoke all on public.tracker_members from anon, authenticated;
grant select on public.tracker_members to authenticated;
grant all on public.tracker_members to service_role;
drop policy if exists tracker_read_self on public.tracker_members;
create policy tracker_read_self on public.tracker_members
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.tracker_member_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tracker_members(user_id) values(new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.tracker_member_created() from public, anon, authenticated;
drop trigger if exists tracker_member_created on auth.users;
create trigger tracker_member_created after insert on auth.users
  for each row execute function public.tracker_member_created();
insert into public.tracker_members(user_id) select id from auth.users
  on conflict (user_id) do nothing;
commit;
