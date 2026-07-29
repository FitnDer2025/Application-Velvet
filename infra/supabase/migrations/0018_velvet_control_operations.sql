-- Velvet BETA — gouvernance réelle des établissements et organisateurs.

create policy establishments_control_create
on public.establishments
for insert to authenticated
with check (public.has_role('admin') or public.has_role('direction'));

create policy establishments_control_update
on public.establishments
for update to authenticated
using (public.has_role('admin') or public.has_role('direction'))
with check (public.has_role('admin') or public.has_role('direction'));

create or replace function public.control_accounts()
returns table (user_id uuid,email text,status text,roles text[])
language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not public.is_control_user() then raise exception 'control_required'; end if;
  return query
  select a.user_id,u.email::text,a.status,
         coalesce(array_agg(ar.role_code) filter (where ar.role_code is not null),'{}'::text[])
  from public.accounts a join auth.users u on u.id=a.user_id
  left join public.account_roles ar on ar.user_id=a.user_id and (ar.expires_at is null or ar.expires_at>now())
  group by a.user_id,u.email,a.status order by u.email;
end;
$$;

create or replace function public.control_create_establishment(
  target_name text,target_slug text,target_kind text,target_owner uuid
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare target_id uuid;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then raise exception 'control_admin_required'; end if;
  if target_name is null or char_length(btrim(target_name))<2 or target_kind not in ('club','spa','bar','love_room','other') then raise exception 'invalid_establishment'; end if;
  if not exists(select 1 from public.accounts where user_id=target_owner and status='active') then raise exception 'invalid_owner'; end if;
  insert into public.establishments(slug,name,kind,visibility)
  values(lower(btrim(target_slug)),btrim(target_name),target_kind,'draft') returning id into target_id;
  insert into public.establishment_staff(establishment_id,user_id,staff_role,status)
  values(target_id,target_owner,'owner','active');
  insert into public.account_roles(user_id,role_code,granted_by)
  values(target_owner,'pro_owner',auth.uid()) on conflict(user_id,role_code) do update set expires_at=null,granted_by=auth.uid(),granted_at=now();
  insert into public.audit_events(actor_user_id,actor_type,action,entity_type,entity_id,metadata)
  values(auth.uid(),'user','establishment_created','establishment',target_id,jsonb_build_object('owner',target_owner));
  return target_id;
end;
$$;

create or replace function public.control_decide_organizer(target_request uuid,target_decision text)
returns void
language plpgsql security definer set search_path=''
as $$
declare request_row public.organizer_requests;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('moderator')) then raise exception 'control_moderation_required'; end if;
  if target_decision not in ('approved','declined') then raise exception 'invalid_decision'; end if;
  select * into request_row from public.organizer_requests where id=target_request and status='pending' for update;
  if request_row.id is null then raise exception 'organizer_request_unavailable'; end if;
  update public.organizer_requests set status=target_decision,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=target_request;
  if target_decision='approved' then
    insert into public.organizer_profiles(member_profile_id,status,approved_by,approved_at)
    values(request_row.member_profile_id,'approved',auth.uid(),now())
    on conflict(member_profile_id) do update set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now();
    insert into public.account_roles(user_id,role_code,granted_by)
    values(request_row.user_id,'organizer',auth.uid()) on conflict(user_id,role_code) do update set expires_at=null,granted_by=auth.uid(),granted_at=now();
  end if;
end;
$$;

grant execute on function public.control_accounts() to authenticated;
grant execute on function public.control_create_establishment(text,text,text,uuid) to authenticated;
grant execute on function public.control_decide_organizer(uuid,text) to authenticated;
