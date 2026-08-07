-- Zwit v1.5 — Priorité capitale #7
-- Soirées confirmées dont le chat est ouvert, sans identifiant de compte exposé.

create or replace function public.zwit_v15_my_event_chat_candidates()
returns table (
  event_id uuid,
  title text,
  starts_at timestamptz,
  chat_open boolean
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  return query
  select e.id,e.title,e.starts_at,true
  from public.event_registrations r
  join public.events e on e.id=r.event_id
  where r.user_id=v_user_id
    and r.status in ('confirmed','checked_in')
    and e.starts_at<=now()+interval '48 hours'
    and coalesce(nullif(to_jsonb(e)->>'ends_at','')::timestamptz,e.starts_at+interval '12 hours')>=now()-interval '48 hours'
  order by e.starts_at asc
  limit 30;
end;
$$;

revoke all on function public.zwit_v15_my_event_chat_candidates() from public;
grant execute on function public.zwit_v15_my_event_chat_candidates() to authenticated;
