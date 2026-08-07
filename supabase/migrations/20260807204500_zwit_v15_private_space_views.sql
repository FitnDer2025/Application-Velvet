-- Zwit v1.5 — Priorité capitale #7
-- Lectures assainies : aucun user_id des autres membres n'est renvoyé au client.

create or replace function public.zwit_v15_my_spaces()
returns table (
  space_id uuid,
  kind text,
  title text,
  description text,
  event_id uuid,
  role text,
  status text,
  member_count bigint,
  unread_count bigint,
  last_message_at timestamptz,
  closes_at timestamptz
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  return query
  select s.id,s.kind,s.title,s.description,s.event_id,sm.role,sm.status,
    (select count(*) from public.community_space_members m where m.space_id=s.id and m.status='active'),
    (select count(*) from public.community_space_messages msg where msg.space_id=s.id and msg.deleted_at is null and msg.created_at>coalesce(sm.last_read_at,'epoch'::timestamptz) and msg.sender_user_id<>v_user_id),
    (select max(msg.created_at) from public.community_space_messages msg where msg.space_id=s.id and msg.deleted_at is null),
    s.closes_at
  from public.community_space_members sm
  join public.community_spaces s on s.id=sm.space_id
  where sm.user_id=v_user_id and sm.status in ('active','invited') and s.archived_at is null
    and (s.closes_at is null or s.closes_at>now())
  order by coalesce((select max(msg.created_at) from public.community_space_messages msg where msg.space_id=s.id and msg.deleted_at is null),s.created_at) desc;
end;
$$;

create or replace function public.zwit_v15_space_messages(target_space_id uuid,after_message_id bigint default 0)
returns table (
  message_id bigint,
  body text,
  created_at timestamptz,
  mine boolean,
  sender_profile_id uuid,
  sender_display_name text
)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.community_space_members sm where sm.space_id=target_space_id and sm.user_id=v_user_id and sm.status='active') then
    raise exception 'space_membership_required';
  end if;
  update public.community_space_members sm set last_read_at=now() where sm.space_id=target_space_id and sm.user_id=v_user_id;
  return query
  select msg.id,msg.body,msg.created_at,(msg.sender_user_id=v_user_id),
    p.profile_id,p.display_name
  from public.community_space_messages msg
  left join lateral (
    select mp.id as profile_id,mp.display_name
    from public.profile_members pm join public.member_profiles mp on mp.id=pm.profile_id
    where pm.user_id=msg.sender_user_id and pm.status='active'
    order by pm.created_at desc limit 1
  ) p on true
  where msg.space_id=target_space_id and msg.deleted_at is null and msg.id>greatest(after_message_id,0)
  order by msg.id asc limit 200;
end;
$$;

create or replace function public.zwit_v15_space_members(target_space_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  role text,
  membership_status text,
  mine boolean
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.community_space_members sm where sm.space_id=target_space_id and sm.user_id=v_user_id and sm.status in ('active','invited')) then
    raise exception 'space_membership_required';
  end if;
  return query
  select p.profile_id,p.display_name,sm.role,sm.status,(sm.user_id=v_user_id)
  from public.community_space_members sm
  left join lateral (
    select mp.id as profile_id,mp.display_name
    from public.profile_members pm join public.member_profiles mp on mp.id=pm.profile_id
    where pm.user_id=sm.user_id and pm.status='active'
    order by pm.created_at desc limit 1
  ) p on true
  where sm.space_id=target_space_id and sm.status in ('active','invited')
  order by case sm.role when 'owner' then 0 when 'moderator' then 1 else 2 end,coalesce(p.display_name,'') asc;
end;
$$;

revoke all on function public.zwit_v15_my_spaces() from public;
revoke all on function public.zwit_v15_space_messages(uuid,bigint) from public;
revoke all on function public.zwit_v15_space_members(uuid) from public;
grant execute on function public.zwit_v15_my_spaces() to authenticated;
grant execute on function public.zwit_v15_space_messages(uuid,bigint) to authenticated;
grant execute on function public.zwit_v15_space_members(uuid) to authenticated;
