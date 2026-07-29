-- Velvet BETA — centre de notifications réel et événements automatiques.

create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  actor_profile_id uuid references public.member_profiles(id) on delete set null,
  event_type text not null
    check (event_type in ('messages','likes','album_access','events','recommendations','security')),
  entity_type text not null
    check (entity_type in ('conversation','media','album','event','profile','account')),
  entity_id uuid,
  title text not null check (char_length(title) between 2 and 180),
  body text check (char_length(body) <= 600),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists member_notifications_feed_idx
  on public.member_notifications (user_id,read_at,created_at desc);

alter table public.member_notifications enable row level security;

create policy member_notifications_self_read
on public.member_notifications
for select to authenticated
using (user_id=auth.uid() or public.is_control_user());

create policy member_notifications_self_update
on public.member_notifications
for update to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

grant select,update on public.member_notifications to authenticated;

create or replace function public.member_notification_allowed(
  target_user_id uuid,
  target_event_type text,
  actor_user_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.member_notification_settings;
  actor_category text;
begin
  select * into settings
  from public.member_notification_settings
  where user_id=target_user_id;
  if settings.user_id is null then return true; end if;
  if not settings.in_app_enabled then return false; end if;
  if coalesce((settings.event_types ->> target_event_type)::boolean,false)=false then
    return false;
  end if;
  if actor_user_id is not null then
    actor_category := public.profile_audience_category(actor_user_id);
    if actor_category is not null and not (actor_category=any(settings.notify_from)) then
      return false;
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.create_member_notification(
  target_user_id uuid,
  target_actor_profile_id uuid,
  target_event_type text,
  target_entity_type text,
  target_entity_id uuid,
  target_title text,
  target_body text,
  actor_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null or target_user_id=actor_user_id then return; end if;
  if not public.member_notification_allowed(target_user_id,target_event_type,actor_user_id) then
    return;
  end if;
  insert into public.member_notifications (
    user_id,actor_profile_id,event_type,entity_type,entity_id,title,body
  ) values (
    target_user_id,target_actor_profile_id,target_event_type,target_entity_type,
    target_entity_id,left(target_title,180),left(target_body,600)
  );
end;
$$;

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile uuid;
  recipient record;
begin
  actor_profile := public.current_member_profile_id();
  for recipient in
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id=new.conversation_id
      and cm.user_id<>new.sender_user_id
      and cm.left_at is null
  loop
    perform public.create_member_notification(
      recipient.user_id,actor_profile,'messages','conversation',new.conversation_id,
      'Nouveau message Velvet',
      coalesce(new.sender_identity,'Un membre') || ' vient de vous écrire.',
      new.sender_user_id
    );
  end loop;
  return new;
end;
$$;

create or replace function public.notify_photo_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  media_row public.media_assets;
  recipient record;
  reaction_label text;
begin
  if tg_op='UPDATE' and old.reaction is not distinct from new.reaction then
    return new;
  end if;
  select * into media_row from public.media_assets where id=new.media_id;
  reaction_label := case new.reaction
    when 'adore' then 'a adoré votre photo'
    when 'love' then 'a envoyé un cœur sur votre photo'
    else 'a aimé votre photo'
  end;
  for recipient in
    select pm.user_id
    from public.profile_members pm
    where pm.profile_id=media_row.profile_id and pm.status='active'
  loop
    perform public.create_member_notification(
      recipient.user_id,new.reactor_profile_id,'likes','media',new.media_id,
      'Une réaction sur votre photo',
      'Un membre ' || reaction_label || '.',
      new.reactor_user_id
    );
  end loop;
  return new;
end;
$$;

create or replace function public.notify_album_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  album_name text;
  owner_profile uuid;
  recipient record;
begin
  if new.revoked_at is not null then return new; end if;
  select a.name,a.profile_id into album_name,owner_profile
  from public.albums a where a.id=new.album_id;
  for recipient in
    select pm.user_id
    from public.profile_members pm
    where pm.status='active'
      and (
        pm.user_id=new.grantee_user_id
        or (new.grantee_profile_id is not null and pm.profile_id=new.grantee_profile_id)
      )
  loop
    perform public.create_member_notification(
      recipient.user_id,owner_profile,'album_access','album',new.album_id,
      'Album privé déverrouillé',
      'Vous pouvez maintenant découvrir « ' || coalesce(album_name,'Album privé') || ' ».',
      new.granted_by
    );
  end loop;
  return new;
end;
$$;

create or replace function public.notify_event_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  actor_profile uuid;
begin
  if tg_op='UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  select * into event_row from public.events where id=new.event_id;
  select pm.profile_id into actor_profile
  from public.profile_members pm
  where pm.user_id=new.user_id and pm.status='active'
  limit 1;
  perform public.create_member_notification(
    event_row.created_by,actor_profile,'events','event',new.event_id,
    'Nouvelle inscription',
    'Un membre vient de ' ||
      case when new.status='waitlisted' then 'rejoindre la liste d’attente de ' else 's’inscrire à ' end ||
      event_row.title || '.',
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists messages_create_notification on public.messages;
create trigger messages_create_notification
after insert on public.messages
for each row execute function public.notify_new_message();

drop trigger if exists photo_reactions_create_notification on public.photo_reactions;
create trigger photo_reactions_create_notification
after insert or update of reaction on public.photo_reactions
for each row execute function public.notify_photo_reaction();

drop trigger if exists album_access_create_notification on public.album_access_grants;
create trigger album_access_create_notification
after insert on public.album_access_grants
for each row execute function public.notify_album_access();

drop trigger if exists event_registrations_create_notification on public.event_registrations;
create trigger event_registrations_create_notification
after insert or update of status on public.event_registrations
for each row
when (new.status in ('confirmed','waitlisted'))
execute function public.notify_event_registration();

revoke all on function public.member_notification_allowed(uuid,text,uuid) from public;
revoke all on function public.create_member_notification(uuid,uuid,text,text,uuid,text,text,uuid) from public;
revoke all on function public.notify_new_message() from public;
revoke all on function public.notify_photo_reaction() from public;
revoke all on function public.notify_album_access() from public;
revoke all on function public.notify_event_registration() from public;
