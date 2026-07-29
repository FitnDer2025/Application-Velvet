-- Velvet BETA — recherches membres sauvegardées et présence publique approximative.

create table if not exists public.member_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  filters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,name)
);

create index if not exists member_saved_searches_user_idx
  on public.member_saved_searches (user_id,updated_at desc);

drop trigger if exists member_saved_searches_updated_at on public.member_saved_searches;
create trigger member_saved_searches_updated_at
before update on public.member_saved_searches
for each row execute function public.set_updated_at();

alter table public.member_saved_searches enable row level security;

drop policy if exists member_saved_searches_self_read on public.member_saved_searches;
create policy member_saved_searches_self_read on public.member_saved_searches
for select to authenticated
using (user_id=auth.uid());

drop policy if exists member_saved_searches_self_insert on public.member_saved_searches;
create policy member_saved_searches_self_insert on public.member_saved_searches
for insert to authenticated
with check (user_id=auth.uid());

drop policy if exists member_saved_searches_self_update on public.member_saved_searches;
create policy member_saved_searches_self_update on public.member_saved_searches
for update to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

drop policy if exists member_saved_searches_self_delete on public.member_saved_searches;
create policy member_saved_searches_self_delete on public.member_saved_searches
for delete to authenticated
using (user_id=auth.uid());

grant select,insert,update,delete on public.member_saved_searches to authenticated;

create or replace function public.member_presence_snapshot()
returns table (
  profile_id uuid,
  presence_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_beta_approved() then
    raise exception 'member_access_required';
  end if;

  update public.accounts
     set last_seen_at=now()
   where user_id=auth.uid();

  return query
  select
    p.id,
    case
      when max(a.last_seen_at) >= now() - interval '5 minutes' then 'online'
      when (max(a.last_seen_at) at time zone 'Europe/Paris')::date
           = (now() at time zone 'Europe/Paris')::date then 'today'
      else 'offline'
    end
  from public.member_profiles p
  join public.profile_members pm
    on pm.profile_id=p.id
   and pm.status='active'
  join public.accounts a
    on a.user_id=pm.user_id
  where public.can_view_profile(p.id)
  group by p.id;
end;
$$;

grant execute on function public.member_presence_snapshot() to authenticated;
