-- Velvet BETA — sas d'admission photo et référentiel de lieux.
-- La dernière requête affiche la clé HMAC à copier UNE FOIS dans le secret
-- Cloudflare PHOTO_MODERATION_HMAC_KEY.

create schema if not exists velvet_private;
revoke all on schema velvet_private from public, anon, authenticated;

create table if not exists velvet_private.system_secrets (
  secret_name text primary key,
  secret_value bytea not null,
  created_at timestamptz not null default now()
);
revoke all on velvet_private.system_secrets from public, anon, authenticated;

insert into velvet_private.system_secrets (secret_name,secret_value)
values ('photo_moderation_hmac',extensions.gen_random_bytes(32))
on conflict (secret_name) do nothing;

alter table public.member_profiles
  add column if not exists admission_status text not null default 'profile_pending';

alter table public.member_profiles
  drop constraint if exists member_profiles_admission_status_check;
alter table public.member_profiles
  add constraint member_profiles_admission_status_check
  check (admission_status in (
    'profile_pending',
    'partner_required',
    'photos_required',
    'ai_review',
    'changes_required',
    'approved',
    'suspended'
  ));

alter table public.media_assets
  add column if not exists individual_profile_id uuid
    references public.individual_profiles(id) on delete cascade,
  add column if not exists media_role text not null default 'album',
  add column if not exists is_primary boolean not null default false,
  add column if not exists ai_assessment jsonb not null default '{}'::jsonb,
  add column if not exists ai_reviewed_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.albums
  drop constraint if exists albums_confidentiality_check;
alter table public.albums
  add constraint albums_confidentiality_check
  check (confidentiality in (
    'public',
    'request',
    'trusted_circle',
    'private_circle',
    'favorites',
    'temporary'
  ));

alter table public.album_access_grants
  add column if not exists grantee_profile_id uuid
    references public.member_profiles(id) on delete cascade;
create index if not exists album_access_grants_profile_idx
  on public.album_access_grants (album_id,grantee_profile_id)
  where revoked_at is null;

update public.media_assets ma
set media_role=case
  when ma.album_id is not null then 'album'
  when mp.profile_type='couple' then 'couple_gallery'
  else 'individual_gallery'
end
from public.member_profiles mp
where mp.id=ma.profile_id
  and ma.media_role='album'
  and ma.album_id is null;

alter table public.media_assets
  drop constraint if exists media_assets_media_role_check;
alter table public.media_assets
  add constraint media_assets_media_role_check
  check (media_role in (
    'couple_gallery',
    'individual_gallery',
    'individual_portrait',
    'album'
  ));

alter table public.media_assets
  drop constraint if exists media_assets_role_target_check;
alter table public.media_assets
  add constraint media_assets_role_target_check
  check (
    (media_role='individual_portrait' and individual_profile_id is not null and album_id is null)
    or
    (media_role in ('couple_gallery','individual_gallery') and individual_profile_id is null and album_id is null)
    or
    (media_role='album' and album_id is not null)
  );

create index if not exists media_assets_admission_idx
  on public.media_assets (profile_id,media_role,moderation_status);

-- Les utilisateurs ne peuvent jamais s'auto-attribuer une validation IA.
drop policy if exists media_owner_write on public.media_assets;
drop policy if exists media_owner_insert on public.media_assets;
create policy media_owner_insert on public.media_assets
for insert to authenticated
with check (
  owner_user_id=auth.uid()
  and moderation_status='pending'
  and public.is_profile_member(profile_id)
  and (
    individual_profile_id is null
    or exists (
      select 1 from public.individual_profiles ip
       where ip.id=individual_profile_id
         and ip.profile_id=media_assets.profile_id
         and ip.linked_user_id=auth.uid()
    )
  )
);

drop policy if exists media_owner_delete on public.media_assets;
create policy media_owner_delete on public.media_assets
for delete to authenticated
using (owner_user_id=auth.uid() or public.is_control_user());

revoke update on public.media_assets from authenticated;

-- Un album public est lisible après modération. Un album privé exige une
-- autorisation valide et ne révèle jamais de média en attente ou refusé.
drop policy if exists media_authorized_read on public.media_assets;
create policy media_authorized_read on public.media_assets
for select to authenticated
using (
  public.is_profile_member(profile_id)
  or (
    visibility='profile'
    and moderation_status='approved'
    and public.can_view_profile(profile_id)
  )
  or (
    album_id is not null
    and moderation_status='approved'
    and exists (
      select 1 from public.album_access_grants g
       where g.album_id=media_assets.album_id
         and g.grantee_user_id=auth.uid()
         and g.revoked_at is null
         and (g.expires_at is null or g.expires_at>now())
    )
  )
  or public.is_control_user()
);

create or replace function public.grant_private_album_to_profile(
  target_album_id uuid,
  target_profile_id uuid,
  duration_hours integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_confidentiality text;
  granted_count integer;
  target_expiration timestamptz;
begin
  if duration_hours is not null and duration_hours not in (1,2,4,8,12,24) then
    raise exception 'invalid_album_access_duration';
  end if;
  if target_profile_id is null then raise exception 'target_profile_required'; end if;

  select confidentiality into target_confidentiality
    from public.albums
   where id=target_album_id
     and public.is_profile_member(profile_id)
   for update;
  if target_confidentiality is null then raise exception 'album_owner_required'; end if;
  if target_confidentiality='public' then raise exception 'public_album_needs_no_grant'; end if;
  if not public.can_view_profile(target_profile_id) then
    raise exception 'target_profile_unavailable';
  end if;

  target_expiration := case
    when duration_hours is null then null
    else now() + make_interval(hours => duration_hours)
  end;

  insert into public.album_access_grants (
    album_id,grantee_user_id,grantee_profile_id,granted_by,granted_at,expires_at,revoked_at
  )
  select
    target_album_id,pm.user_id,target_profile_id,auth.uid(),now(),target_expiration,null
  from public.profile_members pm
  where pm.profile_id=target_profile_id
    and pm.status='active'
    and pm.user_id<>auth.uid()
  on conflict (album_id,grantee_user_id) do update set
    granted_by=excluded.granted_by,
    grantee_profile_id=excluded.grantee_profile_id,
    granted_at=excluded.granted_at,
    expires_at=excluded.expires_at,
    revoked_at=null;

  get diagnostics granted_count = row_count;
  if granted_count=0 then raise exception 'target_profile_has_no_active_member'; end if;
  return granted_count;
end;
$$;

create or replace function public.revoke_private_album_from_profile(
  target_album_id uuid,
  target_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare revoked_count integer;
begin
  if not exists (
    select 1 from public.albums a
     where a.id=target_album_id
       and public.is_profile_member(a.profile_id)
  ) then
    raise exception 'album_owner_required';
  end if;

  update public.album_access_grants g
     set revoked_at=now()
   where g.album_id=target_album_id
     and (
       g.grantee_profile_id=target_profile_id
       or g.grantee_user_id in (
         select pm.user_id
           from public.profile_members pm
          where pm.profile_id=target_profile_id
       )
     )
     and g.revoked_at is null;
  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$$;

revoke all on function public.grant_private_album_to_profile(uuid,uuid,integer) from public;
revoke all on function public.revoke_private_album_from_profile(uuid,uuid) from public;
grant execute on function public.grant_private_album_to_profile(uuid,uuid,integer) to authenticated;
grant execute on function public.revoke_private_album_from_profile(uuid,uuid) to authenticated;

create or replace function public.refresh_profile_admission(target_profile uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_kind text;
  current_status text;
  required_people integer;
  required_portraits integer;
  people_count integer;
  approved_gallery integer;
  submitted_gallery integer;
  approved_portraits integer;
  submitted_portraits integer;
  rejected_count integer;
  next_status text;
begin
  select profile_type,admission_status
    into profile_kind,current_status
    from public.member_profiles
   where id=target_profile
   for update;

  if profile_kind is null then return null; end if;
  if current_status='suspended' then return current_status; end if;

  required_people := case when profile_kind='couple' then 2 else 1 end;
  required_portraits := case when profile_kind='couple' then 2 else 0 end;

  select count(*) into people_count
    from public.individual_profiles
   where profile_id=target_profile
     and linked_user_id is not null;

  select
    count(*) filter (
      where moderation_status='approved'
        and media_role=case when profile_kind='couple' then 'couple_gallery' else 'individual_gallery' end
    ),
    count(*) filter (
      where media_role=case when profile_kind='couple' then 'couple_gallery' else 'individual_gallery' end
    ),
    count(distinct individual_profile_id) filter (
      where moderation_status='approved'
        and media_role='individual_portrait'
    ),
    count(distinct individual_profile_id) filter (
      where media_role='individual_portrait'
    ),
    count(*) filter (where moderation_status='rejected')
  into approved_gallery,submitted_gallery,approved_portraits,submitted_portraits,rejected_count
  from public.media_assets
  where profile_id=target_profile
    and album_id is null;

  next_status := case
    when people_count < required_people and profile_kind='couple' then 'partner_required'
    when people_count < required_people then 'profile_pending'
    when approved_gallery >= 3 and approved_portraits >= required_portraits then 'approved'
    when rejected_count > 0 then 'changes_required'
    when submitted_gallery >= 3 and submitted_portraits >= required_portraits then 'ai_review'
    else 'photos_required'
  end;

  update public.member_profiles
     set admission_status=next_status,
         visibility=case when next_status='approved' then 'beta_members' else 'private' end,
         published_at=case when next_status='approved' then coalesce(published_at,now()) else published_at end,
         updated_at=now()
   where id=target_profile;

  return next_status;
end;
$$;

revoke all on function public.refresh_profile_admission(uuid) from public;

create or replace function public.recalculate_profile_admission_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_profile_admission(old.profile_id);
    return old;
  end if;
  perform public.refresh_profile_admission(new.profile_id);
  return new;
end;
$$;

drop trigger if exists media_assets_recalculate_admission on public.media_assets;
create trigger media_assets_recalculate_admission
after insert or update of moderation_status or delete on public.media_assets
for each row execute function public.recalculate_profile_admission_trigger();

drop trigger if exists individual_profiles_recalculate_admission on public.individual_profiles;
create trigger individual_profiles_recalculate_admission
after insert or update of linked_user_id or delete on public.individual_profiles
for each row execute function public.recalculate_profile_admission_trigger();

drop trigger if exists profile_members_recalculate_admission on public.profile_members;
create trigger profile_members_recalculate_admission
after insert or update of status or delete on public.profile_members
for each row execute function public.recalculate_profile_admission_trigger();

create or replace function public.is_admitted_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profile_members pm
      join public.member_profiles mp on mp.id=pm.profile_id
     where pm.user_id=auth.uid()
       and pm.status='active'
       and mp.admission_status='approved'
  );
$$;

create or replace function public.record_photo_ai_decision(
  target_media_id uuid,
  decision text,
  assessment jsonb,
  signed_at bigint,
  signature text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_value bytea;
  expected_signature text;
  owner_value uuid;
  profile_value uuid;
  normalized_decision text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if decision not in ('approved','rejected','review') then
    raise exception 'invalid_ai_decision';
  end if;
  if abs(extract(epoch from now())::bigint - signed_at) > 300 then
    raise exception 'expired_ai_signature';
  end if;

  select owner_user_id,profile_id into owner_value,profile_value
    from public.media_assets
   where id=target_media_id
   for update;
  if owner_value is null or owner_value<>auth.uid() then
    raise exception 'media_owner_required';
  end if;

  select ss.secret_value into secret_value
    from velvet_private.system_secrets ss
   where ss.secret_name='photo_moderation_hmac';

  expected_signature := encode(
    extensions.hmac(
      convert_to(target_media_id::text || '|' || decision || '|' || signed_at::text,'UTF8'),
      secret_value,
      'sha256'
    ),
    'hex'
  );
  if expected_signature<>lower(signature) then
    raise exception 'invalid_ai_signature';
  end if;

  normalized_decision := case when decision='review' then 'pending' else decision end;
  update public.media_assets
     set moderation_status=normalized_decision,
         ai_assessment=coalesce(assessment,'{}'::jsonb),
         ai_reviewed_at=now(),
         rejection_reason=case
           when decision='rejected' then nullif(assessment ->> 'summary','')
           when decision='review' then 'Contrôle humain nécessaire'
           else null
         end
   where id=target_media_id;

  perform public.refresh_profile_admission(profile_value);
  return normalized_decision;
end;
$$;

revoke all on function public.record_photo_ai_decision(uuid,text,jsonb,bigint,text) from public;
grant execute on function public.record_photo_ai_decision(uuid,text,jsonb,bigint,text) to authenticated;

-- Empêche les contacts tant que le sas photo n'est pas validé.
drop policy if exists conversations_create on public.conversations;
create policy conversations_create on public.conversations
for insert to authenticated
with check (
  public.is_beta_approved()
  and public.is_admitted_member()
  and created_by=auth.uid()
);

drop policy if exists messages_member_insert on public.messages;
create policy messages_member_insert on public.messages
for insert to authenticated
with check (
  sender_user_id=auth.uid()
  and public.is_admitted_member()
  and public.is_conversation_member(conversation_id)
);

create table if not exists public.venue_directory (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('openstreetmap','velvet','professional')),
  source_id text not null,
  name text not null,
  kind text not null check (kind in ('club','spa','bar','love_room','other')),
  city text,
  country_code text not null check (country_code in ('FR','BE')),
  address_public text,
  latitude double precision,
  longitude double precision,
  website text,
  verification_status text not null default 'source_only'
    check (verification_status in ('source_only','community_confirmed','professional_verified','closed')),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source,source_id)
);

create index if not exists venue_directory_search_idx
  on public.venue_directory (lower(name),country_code,kind);

alter table public.venue_directory enable row level security;

drop policy if exists venue_directory_members_read on public.venue_directory;
create policy venue_directory_members_read on public.venue_directory
for select to authenticated
using (public.is_beta_approved());

drop policy if exists venue_directory_admin_write on public.venue_directory;
create policy venue_directory_admin_write on public.venue_directory
for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

grant select on public.venue_directory to authenticated;
grant insert,update,delete on public.venue_directory to authenticated;

-- Le chemin devient <profil>/<propriétaire>/<uuid>.<ext>.
drop policy if exists media_bucket_owner_insert on storage.objects;
create policy media_bucket_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='velvet-media'
  and public.is_profile_member(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2]=auth.uid()::text
);

drop policy if exists media_bucket_owner_update on storage.objects;
create policy media_bucket_owner_update
on storage.objects for update to authenticated
using (
  bucket_id='velvet-media'
  and (storage.foldername(name))[2]=auth.uid()::text
)
with check (
  bucket_id='velvet-media'
  and (storage.foldername(name))[2]=auth.uid()::text
);

drop policy if exists media_bucket_owner_delete on storage.objects;
create policy media_bucket_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id='velvet-media'
  and (storage.foldername(name))[2]=auth.uid()::text
);

do $$
declare profile_row record;
begin
  for profile_row in select id from public.member_profiles loop
    perform public.refresh_profile_admission(profile_row.id);
  end loop;
end;
$$;

-- À copier dans Cloudflare comme secret PHOTO_MODERATION_HMAC_KEY.
select encode(secret_value,'hex') as photo_moderation_hmac_key
from velvet_private.system_secrets
where secret_name='photo_moderation_hmac';
