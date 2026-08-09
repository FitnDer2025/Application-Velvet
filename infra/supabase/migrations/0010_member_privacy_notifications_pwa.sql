-- Velvet BETA — préférences membres, confidentialité et notifications web.

create table if not exists public.profile_privacy_settings (
  profile_id uuid primary key references public.member_profiles(id) on delete cascade,
  discoverable_by text[] not null default array['couple','woman','man','trans_nonbinary','other'],
  contactable_by text[] not null default array['couple','woman','man','trans_nonbinary','other'],
  updated_by uuid not null references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_privacy_discoverable_categories check (
    discoverable_by <@ array['couple','woman','man','trans_nonbinary','other']::text[]
  ),
  constraint profile_privacy_contactable_categories check (
    contactable_by <@ array['couple','woman','man','trans_nonbinary','other']::text[]
  )
);

create table if not exists public.member_notification_settings (
  user_id uuid primary key references public.accounts(user_id) on delete cascade,
  notify_from text[] not null default array['couple','woman','man','trans_nonbinary','other'],
  event_types jsonb not null default '{
    "messages": true,
    "likes": true,
    "album_access": true,
    "profile_views": true,
    "events": true,
    "recommendations": true,
    "security": true
  }'::jsonb,
  in_app_enabled boolean not null default true,
  browser_enabled boolean not null default false,
  email_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_notification_source_categories check (
    notify_from <@ array['couple','woman','man','trans_nonbinary','other']::text[]
  )
);

create table if not exists public.browser_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text,
  auth_secret text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists browser_push_subscriptions_user_idx
  on public.browser_push_subscriptions (user_id,revoked_at);

create trigger profile_privacy_settings_updated_at
before update on public.profile_privacy_settings
for each row execute function public.set_updated_at();

create trigger member_notification_settings_updated_at
before update on public.member_notification_settings
for each row execute function public.set_updated_at();

alter table public.profile_privacy_settings enable row level security;
alter table public.member_notification_settings enable row level security;
alter table public.browser_push_subscriptions enable row level security;

create policy profile_privacy_members_read on public.profile_privacy_settings
for select to authenticated
using (public.is_profile_member(profile_id) or public.is_control_user());

create policy profile_privacy_members_insert on public.profile_privacy_settings
for insert to authenticated
with check (public.is_profile_member(profile_id) and updated_by=auth.uid());

create policy profile_privacy_members_update on public.profile_privacy_settings
for update to authenticated
using (public.is_profile_member(profile_id) or public.is_control_user())
with check (public.is_profile_member(profile_id) and updated_by=auth.uid());

create policy notification_settings_self_read on public.member_notification_settings
for select to authenticated
using (user_id=auth.uid() or public.is_control_user());

create policy notification_settings_self_insert on public.member_notification_settings
for insert to authenticated
with check (user_id=auth.uid());

create policy notification_settings_self_update on public.member_notification_settings
for update to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

create policy browser_push_self_read on public.browser_push_subscriptions
for select to authenticated
using (user_id=auth.uid() or public.is_control_user());

create policy browser_push_self_insert on public.browser_push_subscriptions
for insert to authenticated
with check (user_id=auth.uid());

create policy browser_push_self_update on public.browser_push_subscriptions
for update to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

create policy browser_push_self_delete on public.browser_push_subscriptions
for delete to authenticated
using (user_id=auth.uid());

grant select, insert, update on public.profile_privacy_settings to authenticated;
grant select, insert, update on public.member_notification_settings to authenticated;
grant select, insert, update, delete on public.browser_push_subscriptions to authenticated;

create or replace function public.profile_audience_category(target_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when mp.profile_type='couple' then 'couple'
      when lower(coalesce(ip.gender_identity,''))='femme' then 'woman'
      when lower(coalesce(ip.gender_identity,''))='homme' then 'man'
      when lower(coalesce(ip.gender_identity,'')) in (
        'homme trans','femme trans','personne non binaire'
      ) then 'trans_nonbinary'
      else 'other'
    end
    from public.profile_members pm
    join public.member_profiles mp on mp.id=pm.profile_id
    left join public.individual_profiles ip
      on ip.profile_id=pm.profile_id and ip.linked_user_id=pm.user_id
    where pm.user_id=target_user and pm.status='active'
    order by pm.accepted_at desc nulls last, pm.created_at desc
    limit 1
  ), 'other');
$$;

create or replace function public.profile_accepts_audience(target_profile uuid, preference_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when preference_kind='contact' then public.profile_audience_category(auth.uid())=any(s.contactable_by)
      else public.profile_audience_category(auth.uid())=any(s.discoverable_by)
    end
    from public.profile_privacy_settings s
    where s.profile_id=target_profile
  ), true);
$$;

create or replace function public.can_contact_user(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_control_user()
    or target_user=auth.uid()
    or exists (
      select 1
      from public.profile_members pm
      join public.member_profiles mp on mp.id=pm.profile_id
      where pm.user_id=target_user
        and pm.status='active'
        and mp.visibility in ('beta_members','published')
        and mp.admission_status='approved'
        and public.profile_accepts_audience(mp.id,'contact')
    );
$$;

create or replace function public.can_view_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_profile_member(target_profile)
      or public.is_control_user()
      or (
        public.is_beta_approved()
        and public.profile_accepts_audience(target_profile,'discover')
        and exists (
          select 1 from public.member_profiles p
           where p.id = target_profile
             and p.visibility in ('beta_members','published')
             and not exists (
               select 1
                 from public.blocks b
                 join public.profile_members pm
                   on pm.user_id in (b.blocker_user_id,b.blocked_user_id)
                where pm.profile_id = target_profile
                  and (
                    (b.blocker_user_id = auth.uid() and b.blocked_user_id = pm.user_id)
                    or
                    (b.blocked_user_id = auth.uid() and b.blocker_user_id = pm.user_id)
                  )
             )
        )
      );
$$;

drop policy if exists conversation_members_create on public.conversation_members;
create policy conversation_members_create on public.conversation_members
for insert to authenticated
with check (
  user_id=auth.uid()
  or public.is_control_user()
  or (
    public.can_contact_user(user_id)
    and exists (
      select 1 from public.conversations c
      where c.id=conversation_id and c.created_by=auth.uid()
    )
  )
);

revoke all on function public.profile_audience_category(uuid) from public;
revoke all on function public.profile_accepts_audience(uuid,text) from public;
revoke all on function public.can_contact_user(uuid) from public;
grant execute on function public.profile_audience_category(uuid) to authenticated;
grant execute on function public.profile_accepts_audience(uuid,text) to authenticated;
grant execute on function public.can_contact_user(uuid) to authenticated;
