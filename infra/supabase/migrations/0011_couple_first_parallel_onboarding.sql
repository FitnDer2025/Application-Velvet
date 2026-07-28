-- Velvet BETA — création du couple avant les fiches personnelles.
-- Le profil partagé peut être créé, photographié et invité avant que chacun
-- complète sa fiche individuelle. Aucun droit d'un partenaire n'est transféré.

alter table public.couple_partner_invitations
  add column if not exists delivery_status text not null default 'not_attempted',
  add column if not exists delivery_provider text,
  add column if not exists delivery_message_id text,
  add column if not exists delivery_attempted_at timestamptz;

alter table public.couple_partner_invitations
  drop constraint if exists couple_partner_invitation_delivery_status_check;
alter table public.couple_partner_invitations
  add constraint couple_partner_invitation_delivery_status_check
  check (delivery_status in ('not_attempted','sent','failed','not_configured'));

create or replace function public.create_my_couple_profile(profile_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_value uuid;
  existing_kind text;
  member_slot_value text;
  display_name_value text := btrim(coalesce(profile_payload ->> 'display_name',''));
  description_value text := btrim(coalesce(profile_payload ->> 'description',''));
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.is_beta_approved() then raise exception 'beta_account_not_active'; end if;
  if char_length(display_name_value) < 2 or char_length(display_name_value) > 120 then
    raise exception 'invalid_display_name';
  end if;
  if char_length(description_value) < 20 or char_length(description_value) > 4000 then
    raise exception 'profile_identity_required';
  end if;

  select pm.profile_id,pm.member_slot,p.profile_type
    into profile_id_value,member_slot_value,existing_kind
    from public.profile_members pm
    join public.member_profiles p on p.id=pm.profile_id
   where pm.user_id=auth.uid()
     and pm.status='active'
   order by pm.created_at
   limit 1
   for update of p;

  if profile_id_value is not null and (existing_kind<>'couple' or member_slot_value<>'partner_a') then
    raise exception 'couple_creator_required';
  end if;

  if profile_id_value is null then
    insert into public.member_profiles (
      created_by,profile_type,display_name,city,location_zone,
      story,description,search_text,practices,values_list,
      visibility,is_demo,published_at,relationship_since,
      journey,favorite_places,availability_text,admission_status
    ) values (
      auth.uid(),'couple',display_name_value,
      nullif(btrim(profile_payload ->> 'city'),''),
      nullif(btrim(profile_payload ->> 'location_zone'),''),
      nullif(btrim(profile_payload ->> 'story'),''),
      description_value,
      nullif(btrim(profile_payload ->> 'search_text'),''),
      array(select jsonb_array_elements_text(coalesce(profile_payload -> 'practices','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(profile_payload -> 'values_list','[]'::jsonb))),
      'private',false,null,
      nullif(profile_payload ->> 'relationship_since','')::smallint,
      nullif(btrim(profile_payload ->> 'journey'),''),
      array(select jsonb_array_elements_text(coalesce(profile_payload -> 'favorite_places','[]'::jsonb))),
      nullif(btrim(profile_payload ->> 'availability_text'),''),
      'partner_required'
    ) returning id into profile_id_value;

    insert into public.profile_members (
      profile_id,user_id,member_slot,status,accepted_at
    ) values (
      profile_id_value,auth.uid(),'partner_a','active',now()
    );
  else
    update public.member_profiles set
      display_name=display_name_value,
      city=nullif(btrim(profile_payload ->> 'city'),''),
      location_zone=nullif(btrim(profile_payload ->> 'location_zone'),''),
      story=nullif(btrim(profile_payload ->> 'story'),''),
      description=description_value,
      search_text=nullif(btrim(profile_payload ->> 'search_text'),''),
      practices=array(select jsonb_array_elements_text(coalesce(profile_payload -> 'practices','[]'::jsonb))),
      values_list=array(select jsonb_array_elements_text(coalesce(profile_payload -> 'values_list','[]'::jsonb))),
      relationship_since=nullif(profile_payload ->> 'relationship_since','')::smallint,
      journey=nullif(btrim(profile_payload ->> 'journey'),''),
      favorite_places=array(select jsonb_array_elements_text(coalesce(profile_payload -> 'favorite_places','[]'::jsonb))),
      availability_text=nullif(btrim(profile_payload ->> 'availability_text'),''),
      visibility=case when visibility='suspended' then visibility else 'private' end,
      is_demo=false,
      updated_at=now()
    where id=profile_id_value;
  end if;

  perform public.refresh_profile_admission(profile_id_value);

  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'user','couple_shared_profile_created','member_profile',profile_id_value,
    jsonb_build_object('source','couple_first_onboarding','personal_profile_created',false)
  );

  return profile_id_value;
end;
$$;

create or replace function public.record_couple_invitation_delivery(
  target_invitation_id uuid,
  target_status text,
  target_provider text default null,
  target_message_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if target_status not in ('sent','failed','not_configured') then
    raise exception 'invalid_delivery_status';
  end if;

  update public.couple_partner_invitations
     set delivery_status=target_status,
         delivery_provider=nullif(btrim(target_provider),''),
         delivery_message_id=nullif(btrim(target_message_id),''),
         delivery_attempted_at=now()
   where id=target_invitation_id
     and inviter_user_id=auth.uid();

  if not found then raise exception 'couple_invitation_owner_required'; end if;
end;
$$;

revoke all on function public.create_my_couple_profile(jsonb) from public;
revoke all on function public.record_couple_invitation_delivery(uuid,text,text,text) from public;
grant execute on function public.create_my_couple_profile(jsonb) to authenticated;
grant execute on function public.record_couple_invitation_delivery(uuid,text,text,text) to authenticated;
