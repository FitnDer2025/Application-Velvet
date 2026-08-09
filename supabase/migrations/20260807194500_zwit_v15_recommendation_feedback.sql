-- Zwit v1.5 — Priorité capitale #6
-- Mémoire explicite et minimale des recommandations : garder / masquer.

create table if not exists public.member_recommendation_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('profile','event','venue')),
  entity_id uuid not null,
  signal text not null check (signal in ('more_like_this','dismiss')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

create index if not exists member_recommendation_feedback_recent_idx
  on public.member_recommendation_feedback (user_id, updated_at desc);

alter table public.member_recommendation_feedback enable row level security;

drop policy if exists member_recommendation_feedback_select_own on public.member_recommendation_feedback;
create policy member_recommendation_feedback_select_own
  on public.member_recommendation_feedback for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.member_recommendation_feedback from authenticated;

create or replace function public.set_my_recommendation_feedback(
  target_entity_type text,
  target_entity_id uuid,
  target_signal text
)
returns table (entity_type text, entity_id uuid, signal text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if target_entity_type not in ('profile','event','venue') then raise exception 'invalid_recommendation_entity'; end if;
  if target_signal not in ('more_like_this','dismiss') then raise exception 'invalid_recommendation_signal'; end if;

  insert into public.member_recommendation_feedback(user_id,entity_type,entity_id,signal)
  values(v_user_id,target_entity_type,target_entity_id,target_signal)
  on conflict (user_id,entity_type,entity_id) do update
    set signal=excluded.signal,updated_at=now();

  return query
    select f.entity_type,f.entity_id,f.signal,f.updated_at
    from public.member_recommendation_feedback f
    where f.user_id=v_user_id and f.entity_type=target_entity_type and f.entity_id=target_entity_id;
end;
$$;

revoke all on function public.set_my_recommendation_feedback(text,uuid,text) from public;
grant execute on function public.set_my_recommendation_feedback(text,uuid,text) to authenticated;
