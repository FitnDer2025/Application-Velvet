-- Velvet BETA — mémoire de consultation, ressentis privés et séries de conversation.
-- Les ressentis ne sont jamais visibles par le profil évalué. Dans un couple,
-- ils sont partagés uniquement entre les deux membres actifs de la fiche commune.

create table if not exists public.profile_view_history (
  viewer_user_id uuid not null references public.accounts(user_id) on delete cascade,
  viewer_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  viewed_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  primary key (viewer_user_id,viewed_profile_id),
  constraint profile_view_history_not_self check (viewer_profile_id <> viewed_profile_id)
);
create index if not exists profile_view_history_recent_idx
  on public.profile_view_history (viewer_user_id,last_viewed_at desc);

create table if not exists public.profile_reactions (
  reactor_user_id uuid not null references public.accounts(user_id) on delete cascade,
  reactor_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  target_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  reaction smallint not null check (reaction in (-1,1,2,3)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (reactor_user_id,target_profile_id),
  constraint profile_reactions_not_self check (reactor_profile_id <> target_profile_id)
);
create index if not exists profile_reactions_couple_compare_idx
  on public.profile_reactions (reactor_profile_id,target_profile_id);

create table if not exists public.conversation_engagement (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  qualified_days integer not null default 0 check (qualified_days >= 0),
  last_qualified_date date,
  last_message_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profile_view_history enable row level security;
alter table public.profile_reactions enable row level security;
alter table public.conversation_engagement enable row level security;

drop policy if exists profile_view_history_private_read on public.profile_view_history;
create policy profile_view_history_private_read on public.profile_view_history
for select to authenticated
using (viewer_user_id=auth.uid() or public.is_control_user());

drop policy if exists profile_reactions_couple_read on public.profile_reactions;
create policy profile_reactions_couple_read on public.profile_reactions
for select to authenticated
using (
  reactor_user_id=auth.uid()
  or public.is_profile_member(reactor_profile_id)
  or public.is_control_user()
);

drop policy if exists conversation_engagement_members_read on public.conversation_engagement;
create policy conversation_engagement_members_read on public.conversation_engagement
for select to authenticated
using (
  public.is_conversation_member(conversation_id)
  or public.is_control_user()
);

grant select on public.profile_view_history to authenticated;
grant select on public.profile_reactions to authenticated;
grant select on public.conversation_engagement to authenticated;

create or replace function public.current_member_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pm.profile_id
  from public.profile_members pm
  join public.member_profiles mp on mp.id=pm.profile_id
  where pm.user_id=auth.uid()
    and pm.status='active'
    and mp.admission_status='approved'
  order by pm.accepted_at desc nulls last,pm.created_at desc
  limit 1;
$$;

create or replace function public.record_profile_view(target_profile_id uuid)
returns public.profile_view_history
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_profile uuid;
  recorded public.profile_view_history;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  viewer_profile := public.current_member_profile_id();
  if viewer_profile is null then raise exception 'photo_admission_required'; end if;
  if target_profile_id=viewer_profile then raise exception 'cannot_view_self'; end if;
  if not public.can_view_profile(target_profile_id) then raise exception 'profile_access_denied'; end if;

  insert into public.profile_view_history (
    viewer_user_id,viewer_profile_id,viewed_profile_id,
    first_viewed_at,last_viewed_at,view_count
  ) values (
    auth.uid(),viewer_profile,target_profile_id,now(),now(),1
  )
  on conflict (viewer_user_id,viewed_profile_id) do update set
    viewer_profile_id=excluded.viewer_profile_id,
    last_viewed_at=now(),
    view_count=public.profile_view_history.view_count+1
  returning * into recorded;

  return recorded;
end;
$$;

create or replace function public.set_profile_reaction(
  target_profile_id uuid,
  reaction_value smallint
)
returns public.profile_reactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id alias for $1;
  reactor_profile uuid;
  recorded public.profile_reactions;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  reactor_profile := public.current_member_profile_id();
  if reactor_profile is null then raise exception 'photo_admission_required'; end if;
  if target_id=reactor_profile then raise exception 'cannot_react_to_self'; end if;
  if not public.can_view_profile(target_id) then raise exception 'profile_access_denied'; end if;

  if reaction_value is null then
    delete from public.profile_reactions pr
    where pr.reactor_user_id=auth.uid() and pr.target_profile_id=target_id;
    return null;
  end if;
  if reaction_value not in (-1,1,2,3) then raise exception 'invalid_profile_reaction'; end if;

  insert into public.profile_reactions (
    reactor_user_id,reactor_profile_id,target_profile_id,reaction,created_at,updated_at
  ) values (
    auth.uid(),reactor_profile,target_id,reaction_value,now(),now()
  )
  on conflict on constraint profile_reactions_pkey do update set
    reactor_profile_id=excluded.reactor_profile_id,
    reaction=excluded.reaction,
    updated_at=now()
  returning * into recorded;

  return recorded;
end;
$$;

revoke all on function public.current_member_profile_id() from public;
revoke all on function public.record_profile_view(uuid) from public;
revoke all on function public.set_profile_reaction(uuid,smallint) from public;
grant execute on function public.record_profile_view(uuid) to authenticated;
grant execute on function public.set_profile_reaction(uuid,smallint) to authenticated;

create or replace function public.refresh_conversation_engagement(target_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity record;
  previous_day date;
  last_day date;
  running_streak integer := 0;
  longest integer := 0;
  day_count integer := 0;
  current_value integer := 0;
  latest_message timestamptz;
  paris_today date := (now() at time zone 'Europe/Paris')::date;
begin
  for activity in
    select (m.created_at at time zone 'Europe/Paris')::date as activity_day
    from public.messages m
    join public.profile_members pm
      on pm.user_id=m.sender_user_id and pm.status='active'
    where m.conversation_id=target_conversation
      and m.deleted_at is null
    group by (m.created_at at time zone 'Europe/Paris')::date
    having count(distinct m.sender_user_id) >= 2
       and count(distinct pm.profile_id) >= 2
    order by activity_day
  loop
    day_count := day_count+1;
    if previous_day is not null and activity.activity_day=previous_day+1 then
      running_streak := running_streak+1;
    else
      running_streak := 1;
    end if;
    longest := greatest(longest,running_streak);
    previous_day := activity.activity_day;
    last_day := activity.activity_day;
  end loop;

  select max(created_at) into latest_message
  from public.messages
  where conversation_id=target_conversation and deleted_at is null;

  current_value := case
    when last_day is null then 0
    when last_day>=paris_today-1 then running_streak
    else 0
  end;

  insert into public.conversation_engagement (
    conversation_id,current_streak,longest_streak,qualified_days,
    last_qualified_date,last_message_at,updated_at
  ) values (
    target_conversation,current_value,longest,day_count,last_day,latest_message,now()
  )
  on conflict (conversation_id) do update set
    current_streak=excluded.current_streak,
    longest_streak=excluded.longest_streak,
    qualified_days=excluded.qualified_days,
    last_qualified_date=excluded.last_qualified_date,
    last_message_at=excluded.last_message_at,
    updated_at=now();
end;
$$;

create or replace function public.refresh_conversation_engagement_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_conversation_engagement(old.conversation_id);
    return old;
  end if;
  perform public.refresh_conversation_engagement(new.conversation_id);
  return new;
end;
$$;

drop trigger if exists messages_refresh_conversation_engagement on public.messages;
create trigger messages_refresh_conversation_engagement
after insert or update or delete on public.messages
for each row execute function public.refresh_conversation_engagement_trigger();

revoke all on function public.refresh_conversation_engagement(uuid) from public;
revoke all on function public.refresh_conversation_engagement_trigger() from public;

do $$
declare
  conversation_row record;
begin
  for conversation_row in select id from public.conversations loop
    perform public.refresh_conversation_engagement(conversation_row.id);
  end loop;
end;
$$;
