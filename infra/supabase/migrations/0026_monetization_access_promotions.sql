-- Velvet — production : accès Découverte / Signature / Pro, quotas,
-- campagnes promotionnelles et pilotage Control.
--
-- Cette migration ne raccorde volontairement aucun prestataire de paiement.
-- Les références fournisseur restent nulles jusqu'à validation écrite du
-- prestataire compatible avec l'activité et les contenus de Velvet.

alter table public.accounts
  add column if not exists suspended_until timestamptz,
  add column if not exists moderation_reason text;

create table if not exists public.billing_plans (
  code text primary key
    check (code in ('member_discovery','member_signature','pro_workspace')),
  label text not null,
  audience text not null check (audience in ('member','pro')),
  active boolean not null default true,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_prices (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null references public.billing_plans(code) on delete cascade,
  price_code text not null unique,
  currency text not null default 'EUR' check (currency='EUR'),
  amount_cents integer not null check (amount_cents>=0),
  interval_unit text not null check (interval_unit in ('month','year')),
  interval_count smallint not null default 1 check (interval_count between 1 and 12),
  provider text,
  provider_price_reference text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_plans(code,label,audience,features) values
  (
    'member_discovery','Velvet Découverte','member',
    '{"advanced_search":false,"saved_searches":false,"new_conversations_per_week":3,"follow_limit":10,"profile_ai_lifetime":1}'::jsonb
  ),
  (
    'member_signature','Velvet Signature','member',
    '{"advanced_search":true,"saved_searches":true,"new_conversations_per_week":null,"follow_limit":null,"profile_ai_per_month":20,"follow_connection_alerts":true,"personalized_alerts":true}'::jsonb
  ),
  (
    'pro_workspace','Velvet Pro','pro',
    '{"managed_establishments":1,"event_commission_percent":0,"workspace":true}'::jsonb
  )
on conflict(code) do update set
  label=excluded.label,
  audience=excluded.audience,
  features=excluded.features,
  active=true,
  updated_at=now();

insert into public.billing_prices(
  plan_code,price_code,currency,amount_cents,interval_unit,interval_count
) values
  ('member_signature','signature_monthly_eur','EUR',1490,'month',1),
  ('member_signature','signature_quarterly_eur','EUR',3490,'month',3),
  ('member_signature','signature_annual_eur','EUR',9990,'year',1),
  ('pro_workspace','pro_monthly_eur','EUR',3990,'month',1),
  ('pro_workspace','pro_annual_eur','EUR',39900,'year',1)
on conflict(price_code) do update set
  plan_code=excluded.plan_code,
  currency=excluded.currency,
  amount_cents=excluded.amount_cents,
  interval_unit=excluded.interval_unit,
  interval_count=excluded.interval_count,
  active=true,
  updated_at=now();

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  provider text not null,
  provider_customer_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,user_id),
  unique(provider,provider_customer_reference)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('profile','establishment')),
  subject_id uuid not null,
  plan_code text not null references public.billing_plans(code) on delete restrict,
  price_id uuid references public.billing_prices(id) on delete set null,
  provider text not null,
  provider_subscription_reference text not null,
  status text not null
    check (status in ('incomplete','trialing','active','past_due','paused','cancelled','expired')),
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_subscription_reference)
);
create index if not exists billing_subscriptions_subject_idx
  on public.billing_subscriptions(subject_type,subject_id,status,current_period_ends_at desc);

create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('profile','establishment')),
  subject_id uuid not null,
  entitlement_code text not null check (entitlement_code in ('member_signature','pro_workspace')),
  source text not null
    check (source in ('verified_woman','founder','promotion','paid','manual','trial')),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.accounts(user_id) on delete set null,
  revoked_by uuid references public.accounts(user_id) on delete set null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at>starts_at)
);
create index if not exists access_grants_active_subject_idx
  on public.access_grants(subject_type,subject_id,entitlement_code,ends_at desc)
  where status='active';

create table if not exists public.promotion_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  code_hash text unique check (code_hash is null or code_hash~'^[0-9a-f]{64}$'),
  distribution_mode text not null default 'code'
    check (distribution_mode in ('code','control')),
  subject_type text not null check (subject_type in ('profile','establishment')),
  entitlement_code text not null check (entitlement_code in ('member_signature','pro_workspace')),
  target_audience text not null
    check (target_audience in ('couple','solo_man','paid_member','any_member','pro')),
  duration_days integer not null check (duration_days between 1 and 3650),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions between 1 and 1000000),
  redemption_count integer not null default 0 check (redemption_count>=0),
  per_subject_limit smallint not null default 1 check (per_subject_limit between 1 and 20),
  active boolean not null default true,
  created_by uuid references public.accounts(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at>starts_at),
  check (
    (subject_type='profile' and entitlement_code='member_signature' and target_audience<>'pro')
    or
    (subject_type='establishment' and entitlement_code='pro_workspace' and target_audience='pro')
  )
);

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.promotion_campaigns(id) on delete restrict,
  subject_type text not null check (subject_type in ('profile','establishment')),
  subject_id uuid not null,
  redeemed_by uuid references public.accounts(user_id) on delete set null,
  grant_id uuid not null references public.access_grants(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  redeemed_at timestamptz not null default now(),
  unique(campaign_id,subject_type,subject_id,grant_id)
);
create index if not exists promotion_redemptions_subject_idx
  on public.promotion_redemptions(subject_type,subject_id,redeemed_at desc);

create table if not exists public.feature_usage_counters (
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  feature_code text not null check (feature_code in ('profile_ai','new_conversation')),
  period_key text not null check (char_length(period_key) between 4 and 32),
  usage_count integer not null default 0 check (usage_count>=0),
  updated_at timestamptz not null default now(),
  primary key(profile_id,feature_code,period_key)
);

create table if not exists public.account_feature_usage_counters (
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  feature_code text not null check (feature_code='profile_ai_onboarding'),
  period_key text not null default 'lifetime' check (period_key='lifetime'),
  usage_count integer not null default 0 check (usage_count>=0),
  updated_at timestamptz not null default now(),
  primary key(user_id,feature_code,period_key)
);

drop trigger if exists billing_plans_updated_at on public.billing_plans;
create trigger billing_plans_updated_at before update on public.billing_plans
for each row execute function public.set_updated_at();
drop trigger if exists billing_prices_updated_at on public.billing_prices;
create trigger billing_prices_updated_at before update on public.billing_prices
for each row execute function public.set_updated_at();
drop trigger if exists billing_customers_updated_at on public.billing_customers;
create trigger billing_customers_updated_at before update on public.billing_customers
for each row execute function public.set_updated_at();
drop trigger if exists billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger billing_subscriptions_updated_at before update on public.billing_subscriptions
for each row execute function public.set_updated_at();
drop trigger if exists access_grants_updated_at on public.access_grants;
create trigger access_grants_updated_at before update on public.access_grants
for each row execute function public.set_updated_at();
drop trigger if exists promotion_campaigns_updated_at on public.promotion_campaigns;
create trigger promotion_campaigns_updated_at before update on public.promotion_campaigns
for each row execute function public.set_updated_at();

insert into public.promotion_campaigns(
  name,distribution_mode,subject_type,entitlement_code,target_audience,
  duration_days,max_redemptions,active
)
select
  seed.name,seed.distribution_mode,seed.subject_type,seed.entitlement_code,
  seed.target_audience,seed.duration_days,seed.max_redemptions,true
from (
  values
    ('Fondateurs couples · lancement','control','profile','member_signature','couple',90,250),
    ('Fondateurs hommes seuls · lancement','control','profile','member_signature','solo_man',90,150),
    ('Fondateurs Velvet Pro · lancement','control','establishment','pro_workspace','pro',90,30)
) as seed(
  name,distribution_mode,subject_type,entitlement_code,target_audience,
  duration_days,max_redemptions
)
where not exists(
  select 1 from public.promotion_campaigns existing
  where existing.name=seed.name and existing.distribution_mode='control'
);

alter table public.billing_plans enable row level security;
alter table public.billing_prices enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.access_grants enable row level security;
alter table public.promotion_campaigns enable row level security;
alter table public.promotion_redemptions enable row level security;
alter table public.feature_usage_counters enable row level security;
alter table public.account_feature_usage_counters enable row level security;

drop policy if exists billing_plans_authenticated_read on public.billing_plans;
create policy billing_plans_authenticated_read on public.billing_plans
for select to authenticated using (active or public.is_control_user());
drop policy if exists billing_prices_authenticated_read on public.billing_prices;
create policy billing_prices_authenticated_read on public.billing_prices
for select to authenticated using (active or public.is_control_user());

drop policy if exists billing_customers_self_read on public.billing_customers;
create policy billing_customers_self_read on public.billing_customers
for select to authenticated using (user_id=auth.uid() or public.is_control_user());
drop policy if exists billing_subscriptions_subject_read on public.billing_subscriptions;
create policy billing_subscriptions_subject_read on public.billing_subscriptions
for select to authenticated using (
  public.is_control_user()
  or (subject_type='profile' and public.is_profile_member(subject_id))
  or (subject_type='establishment' and public.is_venue_staff(subject_id))
);
drop policy if exists access_grants_subject_read on public.access_grants;
create policy access_grants_subject_read on public.access_grants
for select to authenticated using (
  public.is_control_user()
  or (subject_type='profile' and public.is_profile_member(subject_id))
  or (subject_type='establishment' and public.is_venue_staff(subject_id))
);
drop policy if exists promotion_campaigns_control_read on public.promotion_campaigns;
create policy promotion_campaigns_control_read on public.promotion_campaigns
for select to authenticated using (public.is_control_user());
drop policy if exists promotion_redemptions_subject_read on public.promotion_redemptions;
create policy promotion_redemptions_subject_read on public.promotion_redemptions
for select to authenticated using (
  public.is_control_user()
  or (subject_type='profile' and public.is_profile_member(subject_id))
  or (subject_type='establishment' and public.is_venue_staff(subject_id))
);
drop policy if exists feature_usage_counters_self_read on public.feature_usage_counters;
create policy feature_usage_counters_self_read on public.feature_usage_counters
for select to authenticated using (public.is_profile_member(profile_id) or public.is_control_user());
drop policy if exists account_feature_usage_counters_self_read on public.account_feature_usage_counters;
create policy account_feature_usage_counters_self_read on public.account_feature_usage_counters
for select to authenticated using (user_id=auth.uid() or public.is_control_user());

grant select on public.billing_plans,public.billing_prices,public.billing_customers,
  public.billing_subscriptions,public.access_grants,public.promotion_campaigns,
  public.promotion_redemptions,public.feature_usage_counters to authenticated;
grant select on public.account_feature_usage_counters to authenticated;
revoke insert,update,delete on public.billing_customers,public.billing_subscriptions,
  public.access_grants,public.promotion_campaigns,public.promotion_redemptions,
  public.feature_usage_counters,public.account_feature_usage_counters from authenticated;

create or replace function public.member_profile_is_verified_woman(target_profile uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.member_profiles profile
    join public.individual_profiles person
      on person.profile_id=profile.id and person.member_slot='individual'
    where profile.id=target_profile
      and profile.profile_type='individual'
      and profile.verification_status='verified'
      and person.gender_identity='Femme'
  );
$$;

create or replace function public.member_profile_has_signature(target_profile uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select
    public.member_profile_is_verified_woman(target_profile)
    or exists(
      select 1 from public.access_grants grant_row
      where grant_row.subject_type='profile'
        and grant_row.subject_id=target_profile
        and grant_row.entitlement_code='member_signature'
        and grant_row.status='active'
        and grant_row.starts_at<=now()
        and (grant_row.ends_at is null or grant_row.ends_at>now())
    )
    or exists(
      select 1 from public.billing_subscriptions subscription
      where subscription.subject_type='profile'
        and subscription.subject_id=target_profile
        and subscription.plan_code='member_signature'
        and subscription.status in ('trialing','active')
        and (
          subscription.current_period_ends_at is null
          or subscription.current_period_ends_at>now()
        )
    );
$$;

create or replace function public.member_access_snapshot()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  target_profile uuid;
  has_signature boolean;
  entitlement_source text;
  entitlement_until timestamptz;
  ai_period text;
  ai_used integer;
  conversation_period text;
  conversation_used integer;
  following_used integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  target_profile := public.current_member_profile_id();
  if target_profile is null then raise exception 'member_profile_required'; end if;
  has_signature := public.member_profile_has_signature(target_profile);

  if public.member_profile_is_verified_woman(target_profile) then
    entitlement_source := 'verified_woman';
  else
    select source,ends_at into entitlement_source,entitlement_until
    from (
      select grant_row.source,grant_row.ends_at,2 as priority
      from public.access_grants grant_row
      where grant_row.subject_type='profile'
        and grant_row.subject_id=target_profile
        and grant_row.entitlement_code='member_signature'
        and grant_row.status='active'
        and grant_row.starts_at<=now()
        and (grant_row.ends_at is null or grant_row.ends_at>now())
      union all
      select 'paid',subscription.current_period_ends_at,1
      from public.billing_subscriptions subscription
      where subscription.subject_type='profile'
        and subscription.subject_id=target_profile
        and subscription.plan_code='member_signature'
        and subscription.status in ('trialing','active')
        and (
          subscription.current_period_ends_at is null
          or subscription.current_period_ends_at>now()
        )
    ) entitlement
    order by priority,ends_at desc nulls first
    limit 1;
  end if;

  ai_period := case
    when has_signature then to_char(now() at time zone 'Europe/Paris','YYYY-MM')
    else 'lifetime'
  end;
  if has_signature then
    select coalesce(usage_count,0) into ai_used
    from public.feature_usage_counters
    where profile_id=target_profile and feature_code='profile_ai' and period_key=ai_period;
  else
    select coalesce(usage_count,0) into ai_used
    from public.account_feature_usage_counters
    where user_id=auth.uid() and feature_code='profile_ai_onboarding'
      and period_key='lifetime';
  end if;
  ai_used := coalesce(ai_used,0);

  conversation_period := to_char(now() at time zone 'Europe/Paris','IYYY-IW');
  select coalesce(usage_count,0) into conversation_used
  from public.feature_usage_counters
  where profile_id=target_profile and feature_code='new_conversation'
    and period_key=conversation_period;
  conversation_used := coalesce(conversation_used,0);

  select count(*)::integer into following_used
  from public.favorites where owner_user_id=auth.uid();

  return jsonb_build_object(
    'profileId',target_profile,
    'tier',case when has_signature then 'signature' else 'discovery' end,
    'planCode',case when has_signature then 'member_signature' else 'member_discovery' end,
    'source',coalesce(entitlement_source,'standard'),
    'validUntil',entitlement_until,
    'features',jsonb_build_object(
      'advancedSearch',has_signature,
      'savedSearches',has_signature,
      'newConversationsPerWeek',case when has_signature then null else 3 end,
      'newConversationsUsed',conversation_used,
      'followLimit',case when has_signature then null else 10 end,
      'followingUsed',following_used,
      'profileAiLimit',case when has_signature then 20 else 1 end,
      'profileAiUsed',ai_used,
      'profileAiPeriod',ai_period,
      'followConnectionAlerts',has_signature,
      'personalizedAlerts',has_signature
    )
  );
end;
$$;

create or replace function public.consume_my_profile_ai()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  target_profile uuid;
  has_signature boolean;
  usage_period text;
  usage_limit integer;
  next_usage integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  target_profile := public.current_member_profile_id();
  if target_profile is null then
    select member.profile_id into target_profile
    from public.profile_members member
    where member.user_id=auth.uid() and member.status in ('active','pending')
    order by member.accepted_at desc nulls last,member.created_at desc
    limit 1;
  end if;
  has_signature := target_profile is not null
    and public.member_profile_has_signature(target_profile);
  if not has_signature then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(auth.uid()::text || ':profile_ai_onboarding',0)
    );
    insert into public.account_feature_usage_counters(
      user_id,feature_code,period_key,usage_count
    ) values (
      auth.uid(),'profile_ai_onboarding','lifetime',1
    )
    on conflict(user_id,feature_code,period_key) do update
      set usage_count=public.account_feature_usage_counters.usage_count+1,
          updated_at=now()
    returning usage_count into next_usage;
    if next_usage>1 then raise exception 'signature_profile_ai_limit'; end if;
    return jsonb_build_object(
      'allowed',true,'used',next_usage,'limit',1,'remaining',0,'period','onboarding'
    );
  end if;
  usage_period := to_char(now() at time zone 'Europe/Paris','YYYY-MM');
  usage_limit := 20;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_profile::text || ':profile_ai:' || usage_period,0)
  );
  insert into public.feature_usage_counters(profile_id,feature_code,period_key,usage_count)
  values(target_profile,'profile_ai',usage_period,1)
  on conflict(profile_id,feature_code,period_key) do update
    set usage_count=public.feature_usage_counters.usage_count+1,updated_at=now()
  returning usage_count into next_usage;
  if next_usage>usage_limit then
    raise exception 'signature_profile_ai_limit';
  end if;
  return jsonb_build_object(
    'allowed',true,'used',next_usage,'limit',usage_limit,
    'remaining',greatest(usage_limit-next_usage,0),'period',usage_period
  );
end;
$$;

create or replace function public.set_my_profile_favorite(
  target_profile_id uuid,
  target_enabled boolean
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  source_profile uuid;
  has_signature boolean;
  next_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  source_profile := public.current_member_profile_id();
  if source_profile is null then raise exception 'photo_admission_required'; end if;
  if target_profile_id is null or target_profile_id=source_profile
    or not public.can_view_profile(target_profile_id) then
    raise exception 'invalid_target_profile';
  end if;
  has_signature := public.member_profile_has_signature(source_profile);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':favorites',0)
  );
  if coalesce(target_enabled,false) then
    select count(*)::integer into next_count
    from public.favorites where owner_user_id=auth.uid();
    if not has_signature
      and next_count>=10
      and not exists(
        select 1 from public.favorites
        where owner_user_id=auth.uid() and profile_id=target_profile_id
      ) then
      raise exception 'signature_follow_limit';
    end if;
    insert into public.favorites(owner_user_id,profile_id)
    values(auth.uid(),target_profile_id) on conflict do nothing;
  else
    delete from public.favorites
    where owner_user_id=auth.uid() and profile_id=target_profile_id;
  end if;
  select count(*)::integer into next_count
  from public.favorites where owner_user_id=auth.uid();
  return jsonb_build_object(
    'favorite',coalesce(target_enabled,false),
    'followingUsed',next_count,
    'followLimit',case when has_signature then null else 10 end
  );
end;
$$;

create or replace function public.start_direct_profile_conversation(
  target_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_profile_id uuid;
  profile_a uuid;
  profile_b uuid;
  conversation_id_value uuid;
  source_category text;
  usage_period text;
  next_usage integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  source_profile_id := public.current_member_profile_id();
  if source_profile_id is null then raise exception 'photo_admission_required'; end if;
  if target_profile_id is null or target_profile_id=source_profile_id then
    raise exception 'invalid_target_profile';
  end if;
  if not exists (
    select 1 from public.member_profiles mp
    where mp.id=target_profile_id
      and mp.admission_status='approved'
      and mp.visibility in ('beta_members','published')
  ) then
    raise exception 'target_profile_unavailable';
  end if;

  source_category := public.profile_audience_category(auth.uid());
  if exists (
    select 1 from public.profile_privacy_settings pps
    where pps.profile_id=target_profile_id
      and not (source_category=any(pps.contactable_by))
  ) then
    raise exception 'profile_contact_not_allowed';
  end if;
  if exists (
    select 1
    from public.profile_members target_member
    join public.blocks b
      on (
        b.blocker_user_id=auth.uid()
        and b.blocked_user_id=target_member.user_id
      ) or (
        b.blocker_user_id=target_member.user_id
        and b.blocked_user_id=auth.uid()
      )
    where target_member.profile_id=target_profile_id
      and target_member.status='active'
  ) then
    raise exception 'profile_contact_blocked';
  end if;

  if source_profile_id::text < target_profile_id::text then
    profile_a := source_profile_id;
    profile_b := target_profile_id;
  else
    profile_a := target_profile_id;
    profile_b := source_profile_id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(profile_a::text || profile_b::text,0)
  );
  select dcp.conversation_id into conversation_id_value
  from public.direct_conversation_profiles dcp
  where dcp.profile_a_id=profile_a and dcp.profile_b_id=profile_b;

  if conversation_id_value is null then
    if not public.member_profile_has_signature(source_profile_id) then
      usage_period := to_char(now() at time zone 'Europe/Paris','IYYY-IW');
      insert into public.feature_usage_counters(
        profile_id,feature_code,period_key,usage_count
      ) values (
        source_profile_id,'new_conversation',usage_period,1
      )
      on conflict(profile_id,feature_code,period_key) do update
        set usage_count=public.feature_usage_counters.usage_count+1,updated_at=now()
      returning usage_count into next_usage;
      if next_usage>3 then
        raise exception 'signature_conversation_limit';
      end if;
    end if;

    insert into public.conversations (kind,subject,created_by)
    values ('direct',null,auth.uid())
    returning id into conversation_id_value;
    insert into public.direct_conversation_profiles(
      conversation_id,profile_a_id,profile_b_id
    ) values (
      conversation_id_value,profile_a,profile_b
    );
  end if;

  insert into public.conversation_members(
    conversation_id,user_id,display_identity,left_at
  )
  select conversation_id_value,pm.user_id,ip.first_name,null
  from public.profile_members pm
  left join public.individual_profiles ip
    on ip.profile_id=pm.profile_id and ip.linked_user_id=pm.user_id
  where pm.profile_id in (source_profile_id,target_profile_id)
    and pm.status='active'
  on conflict(conversation_id,user_id) do update
    set display_identity=excluded.display_identity,left_at=null;
  return conversation_id_value;
end;
$$;

create or replace function public.promotion_subject_matches(
  target_campaign public.promotion_campaigns,
  target_subject uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select case target_campaign.target_audience
    when 'pro' then exists(
      select 1 from public.establishments where id=target_subject
    )
    when 'couple' then exists(
      select 1 from public.member_profiles
      where id=target_subject and profile_type='couple'
    )
    when 'solo_man' then exists(
      select 1
      from public.member_profiles profile
      join public.individual_profiles person
        on person.profile_id=profile.id and person.member_slot='individual'
      where profile.id=target_subject and profile.profile_type='individual'
        and person.gender_identity='Homme'
    )
    when 'paid_member' then exists(
      select 1 from public.member_profiles
      where id=target_subject
    ) and not public.member_profile_is_verified_woman(target_subject)
    when 'any_member' then exists(
      select 1 from public.member_profiles where id=target_subject
    )
    else false
  end;
$$;

create or replace function public.apply_promotion_campaign(
  target_campaign_id uuid,
  target_subject_type text,
  target_subject_id uuid,
  target_actor uuid
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  campaign public.promotion_campaigns;
  redeemed integer;
  base_start timestamptz;
  grant_end timestamptz;
  saved_grant uuid;
begin
  select * into campaign
  from public.promotion_campaigns
  where id=target_campaign_id for update;
  if campaign.id is null or not campaign.active then raise exception 'promotion_unavailable'; end if;
  if campaign.subject_type<>target_subject_type then raise exception 'promotion_audience_mismatch'; end if;
  if campaign.starts_at is not null and campaign.starts_at>now() then raise exception 'promotion_not_started'; end if;
  if campaign.ends_at is not null and campaign.ends_at<=now() then raise exception 'promotion_expired'; end if;
  if campaign.max_redemptions is not null
    and campaign.redemption_count>=campaign.max_redemptions then
    raise exception 'promotion_limit_reached';
  end if;
  if not public.promotion_subject_matches(campaign,target_subject_id) then
    raise exception 'promotion_audience_mismatch';
  end if;
  select count(*)::integer into redeemed
  from public.promotion_redemptions
  where campaign_id=campaign.id
    and subject_type=target_subject_type
    and subject_id=target_subject_id;
  if redeemed>=campaign.per_subject_limit then raise exception 'promotion_already_used'; end if;

  select greatest(
    now(),
    coalesce(max(end_at),now())
  ) into base_start
  from (
    select grant_row.ends_at as end_at
    from public.access_grants grant_row
    where grant_row.subject_type=target_subject_type
      and grant_row.subject_id=target_subject_id
      and grant_row.entitlement_code=campaign.entitlement_code
      and grant_row.status='active'
      and grant_row.starts_at<=now()
      and grant_row.ends_at>now()
    union all
    select subscription.current_period_ends_at
    from public.billing_subscriptions subscription
    where subscription.subject_type=target_subject_type
      and subscription.subject_id=target_subject_id
      and subscription.plan_code=campaign.entitlement_code
      and subscription.status in ('trialing','active')
      and subscription.current_period_ends_at>now()
  ) current_access;
  grant_end := base_start + make_interval(days=>campaign.duration_days);
  insert into public.access_grants(
    subject_type,subject_id,entitlement_code,source,starts_at,ends_at,
    created_by,metadata
  ) values (
    target_subject_type,target_subject_id,campaign.entitlement_code,
    case when campaign.distribution_mode='control' then 'founder' else 'promotion' end,
    base_start,grant_end,target_actor,jsonb_build_object('campaignId',campaign.id)
  ) returning id into saved_grant;
  insert into public.promotion_redemptions(
    campaign_id,subject_type,subject_id,redeemed_by,grant_id,starts_at,ends_at
  ) values (
    campaign.id,target_subject_type,target_subject_id,target_actor,
    saved_grant,base_start,grant_end
  );
  update public.promotion_campaigns
  set redemption_count=redemption_count+1,updated_at=now()
  where id=campaign.id;
  if target_subject_type='establishment' then
    update public.establishments
    set subscription_status='trial',updated_at=now()
    where id=target_subject_id;
  end if;
  return jsonb_build_object(
    'ok',true,'grantId',saved_grant,'startsAt',base_start,'endsAt',grant_end
  );
end;
$$;

create or replace function public.redeem_my_promotion(target_code_hash text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  target_profile uuid;
  campaign_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if target_code_hash is null or target_code_hash!~'^[0-9a-f]{64}$' then
    raise exception 'promotion_invalid';
  end if;
  target_profile := public.current_member_profile_id();
  if target_profile is null then raise exception 'member_profile_required'; end if;
  select id into campaign_id
  from public.promotion_campaigns
  where code_hash=target_code_hash
    and distribution_mode='code'
    and subject_type='profile';
  if campaign_id is null then raise exception 'promotion_invalid'; end if;
  perform public.apply_promotion_campaign(
    campaign_id,'profile',target_profile,auth.uid()
  );
  return public.member_access_snapshot();
end;
$$;

create or replace function public.control_create_promotion(
  target_name text,
  target_code_hash text,
  target_subject_type text,
  target_audience text,
  target_duration_days integer,
  target_max_redemptions integer,
  target_starts_at timestamptz default null,
  target_ends_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  campaign_id uuid;
  entitlement text;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'control_admin_required';
  end if;
  if target_code_hash is null or target_code_hash!~'^[0-9a-f]{64}$' then
    raise exception 'invalid_promotion_code';
  end if;
  entitlement := case
    when target_subject_type='profile' then 'member_signature'
    when target_subject_type='establishment' then 'pro_workspace'
    else null
  end;
  if entitlement is null then raise exception 'invalid_promotion_subject'; end if;
  insert into public.promotion_campaigns(
    name,code_hash,distribution_mode,subject_type,entitlement_code,
    target_audience,duration_days,max_redemptions,starts_at,ends_at,created_by
  ) values (
    btrim(target_name),target_code_hash,'code',target_subject_type,entitlement,
    target_audience,target_duration_days,target_max_redemptions,
    target_starts_at,target_ends_at,auth.uid()
  ) returning id into campaign_id;
  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'control','promotion_created','promotion_campaign',campaign_id,
    jsonb_build_object(
      'subject_type',target_subject_type,'audience',target_audience,
      'duration_days',target_duration_days,'max_redemptions',target_max_redemptions
    )
  );
  return campaign_id;
end;
$$;

create or replace function public.control_set_promotion_active(
  target_campaign uuid,
  target_active boolean
)
returns void
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'control_admin_required';
  end if;
  update public.promotion_campaigns
  set active=target_active,updated_at=now()
  where id=target_campaign;
  if not found then raise exception 'promotion_not_found'; end if;
  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'control','promotion_status_changed','promotion_campaign',
    target_campaign,jsonb_build_object('active',target_active)
  );
end;
$$;

create or replace function public.control_grant_campaign(
  target_campaign uuid,
  target_subject_type text,
  target_subject uuid
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'control_admin_required';
  end if;
  result := public.apply_promotion_campaign(
    target_campaign,target_subject_type,target_subject,auth.uid()
  );
  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'control','founder_access_granted',target_subject_type,target_subject,
    jsonb_build_object('campaign_id',target_campaign)
  );
  return result;
end;
$$;

create or replace function public.control_set_member_access(
  target_profile uuid,
  target_mode text,
  target_duration_days integer default null,
  target_reason text default null
)
returns void
language plpgsql security definer set search_path=''
as $$
declare grant_end timestamptz;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'control_admin_required';
  end if;
  if target_mode not in ('discovery','signature') then raise exception 'invalid_access_mode'; end if;
  if not exists(select 1 from public.member_profiles where id=target_profile) then
    raise exception 'profile_not_found';
  end if;
  update public.access_grants set
    status='revoked',revoked_by=auth.uid(),revoked_at=now(),updated_at=now()
  where subject_type='profile' and subject_id=target_profile
    and entitlement_code='member_signature' and status='active'
    and source in ('manual','founder','promotion','trial');
  if target_mode='signature' then
    if target_duration_days is not null
      and (target_duration_days<1 or target_duration_days>3650) then
      raise exception 'invalid_access_duration';
    end if;
    grant_end := case when target_duration_days is null then null
      else now()+make_interval(days=>target_duration_days) end;
    insert into public.access_grants(
      subject_type,subject_id,entitlement_code,source,ends_at,created_by,metadata
    ) values (
      'profile',target_profile,'member_signature','manual',grant_end,auth.uid(),
      jsonb_build_object('reason',nullif(btrim(target_reason),''))
    );
  end if;
  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'control','member_access_changed','profile',target_profile,
    jsonb_build_object(
      'mode',target_mode,'duration_days',target_duration_days,
      'reason',nullif(btrim(target_reason),'')
    )
  );
end;
$$;

create or replace function public.control_manage_account(
  target_user uuid,
  target_action text,
  target_duration_hours integer default null,
  target_reason text default null
)
returns void
language plpgsql security definer set search_path=''
as $$
declare next_status text; next_until timestamptz;
  target_profile uuid;
  previous_visibility text;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'control_admin_required';
  end if;
  if target_user=auth.uid() then raise exception 'cannot_manage_own_control_account'; end if;
  if target_action='activate' then
    next_status := 'active'; next_until := null;
  elsif target_action='suspend' then
    if target_duration_hours is null or target_duration_hours<1
      or target_duration_hours>8760 then raise exception 'invalid_suspension_duration'; end if;
    next_status := 'suspended';
    next_until := now()+make_interval(hours=>target_duration_hours);
  elsif target_action in ('block','delete') then
    next_status := 'closed'; next_until := null;
  else
    raise exception 'invalid_account_action';
  end if;
  update public.accounts set
    status=next_status,suspended_until=next_until,
    moderation_reason=nullif(btrim(target_reason),'')
  where user_id=target_user;
  if not found then raise exception 'account_not_found'; end if;
  if next_status<>'active' then
    update public.member_profiles profile set
      visibility_before_lifecycle=coalesce(profile.visibility_before_lifecycle,profile.visibility),
      visibility='private',updated_at=now()
    where exists(
      select 1 from public.profile_members member
      where member.profile_id=profile.id and member.user_id=target_user
    );
  else
    update public.member_profiles profile set
      visibility=case
        when profile.lifecycle_state='active'
          then coalesce(profile.visibility_before_lifecycle,'beta_members')
        else profile.visibility
      end,
      visibility_before_lifecycle=case
        when profile.lifecycle_state='active' then null
        else profile.visibility_before_lifecycle
      end,
      updated_at=now()
    where exists(
      select 1 from public.profile_members member
      where member.profile_id=profile.id and member.user_id=target_user
    );
  end if;
  if target_action='delete' then
    select profile.id,profile.visibility_before_lifecycle
      into target_profile,previous_visibility
    from public.member_profiles profile
    join public.profile_members member on member.profile_id=profile.id
    where member.user_id=target_user and member.status='active'
    limit 1 for update of profile;
    if target_profile is not null and not exists(
      select 1 from public.profile_lifecycle_actions
      where profile_id=target_profile and status in ('pending','confirmed')
    ) then
      insert into public.profile_lifecycle_actions(
        profile_id,action_type,requested_by,status,previous_visibility,
        confirmed_at,execute_after
      ) values (
        target_profile,'delete',auth.uid(),'confirmed',
        coalesce(previous_visibility,'private'),now(),now()+interval '30 days'
      );
      update public.member_profiles set
        lifecycle_state='deletion_pending',visibility='private',updated_at=now()
      where id=target_profile;
    end if;
  end if;
  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'control','account_'||target_action,'account',target_user,
    jsonb_build_object(
      'duration_hours',target_duration_hours,
      'suspended_until',next_until,'reason',nullif(btrim(target_reason),'')
    )
  );
end;
$$;

create or replace function public.resume_my_expired_suspension()
returns boolean
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.accounts set
    status='active',suspended_until=null,moderation_reason=null
  where user_id=auth.uid()
    and status='suspended'
    and suspended_until is not null
    and suspended_until<=now();
  if not found then return false; end if;
  update public.member_profiles profile set
    visibility=case
      when profile.lifecycle_state='active'
        then coalesce(profile.visibility_before_lifecycle,'beta_members')
      else profile.visibility
    end,
    visibility_before_lifecycle=case
      when profile.lifecycle_state='active' then null
      else profile.visibility_before_lifecycle
    end,
    updated_at=now()
  where exists(
    select 1 from public.profile_members member
    where member.profile_id=profile.id and member.user_id=auth.uid()
  );
  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'system','account_suspension_expired','account',auth.uid(),'{}'::jsonb
  );
  return true;
end;
$$;

drop function if exists public.control_accounts();
create function public.control_accounts()
returns table(
  user_id uuid,
  email text,
  status text,
  suspended_until timestamptz,
  moderation_reason text,
  roles text[],
  profile_id uuid,
  display_name text,
  profile_type text,
  gender_identity text,
  verification_status text,
  access_tier text,
  access_source text,
  access_until timestamptz
)
language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not public.is_control_user() then
    raise exception 'control_required';
  end if;
  return query
  select
    account.user_id,user_row.email::text,account.status,account.suspended_until,
    account.moderation_reason,
    coalesce(
      array_agg(distinct role_row.role_code)
        filter(where role_row.role_code is not null),
      '{}'::text[]
    ),
    profile.id,profile.display_name,profile.profile_type,person.gender_identity,
    profile.verification_status,
    case when profile.id is null then null
      when public.member_profile_has_signature(profile.id) then 'signature'
      else 'discovery' end,
    case
      when profile.id is null then null
      when public.member_profile_is_verified_woman(profile.id) then 'verified_woman'
      else coalesce(access_row.source,'standard')
    end,
    access_row.ends_at
  from public.accounts account
  join auth.users user_row on user_row.id=account.user_id
  left join public.account_roles role_row
    on role_row.user_id=account.user_id
    and (role_row.expires_at is null or role_row.expires_at>now())
  left join public.profile_members profile_member
    on profile_member.user_id=account.user_id and profile_member.status='active'
  left join public.member_profiles profile on profile.id=profile_member.profile_id
  left join public.individual_profiles person
    on person.profile_id=profile.id and person.linked_user_id=account.user_id
  left join lateral (
    select grant_row.source,grant_row.ends_at
    from public.access_grants grant_row
    where grant_row.subject_type='profile'
      and grant_row.subject_id=profile.id
      and grant_row.entitlement_code='member_signature'
      and grant_row.status='active'
      and grant_row.starts_at<=now()
      and (grant_row.ends_at is null or grant_row.ends_at>now())
    order by grant_row.ends_at desc nulls first limit 1
  ) access_row on true
  group by
    account.user_id,user_row.email,account.status,account.suspended_until,
    account.moderation_reason,profile.id,profile.display_name,profile.profile_type,
    person.gender_identity,profile.verification_status,access_row.source,
    access_row.ends_at
  order by user_row.email;
end;
$$;

create or replace function public.control_set_establishment_subscription(
  target_establishment uuid,target_status text
)
returns void
language plpgsql security definer set search_path=''
as $$
declare grant_end timestamptz;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'control_admin_required';
  end if;
  if target_status not in ('inactive','trial','active','past_due','cancelled') then
    raise exception 'invalid_subscription_status';
  end if;
  update public.establishments
  set subscription_status=target_status,updated_at=now()
  where id=target_establishment;
  if not found then raise exception 'establishment_not_found'; end if;
  update public.access_grants set
    status='revoked',revoked_by=auth.uid(),revoked_at=now(),updated_at=now()
  where subject_type='establishment' and subject_id=target_establishment
    and entitlement_code='pro_workspace' and status='active'
    and source in ('manual','trial');
  if target_status in ('trial','active') then
    grant_end := case when target_status='trial'
      then now()+interval '90 days' else null end;
    insert into public.access_grants(
      subject_type,subject_id,entitlement_code,source,ends_at,created_by
    ) values (
      'establishment',target_establishment,'pro_workspace',
      case when target_status='trial' then 'trial' else 'manual' end,
      grant_end,auth.uid()
    );
  end if;
  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'control','establishment_subscription_changed','establishment',
    target_establishment,jsonb_build_object('status',target_status,'ends_at',grant_end)
  );
end;
$$;

revoke all on function public.member_profile_is_verified_woman(uuid) from public;
revoke all on function public.member_profile_has_signature(uuid) from public;
revoke all on function public.member_access_snapshot() from public;
revoke all on function public.consume_my_profile_ai() from public;
revoke all on function public.set_my_profile_favorite(uuid,boolean) from public;
revoke all on function public.promotion_subject_matches(public.promotion_campaigns,uuid) from public;
revoke all on function public.apply_promotion_campaign(uuid,text,uuid,uuid) from public;
revoke all on function public.redeem_my_promotion(text) from public;
revoke all on function public.control_create_promotion(text,text,text,text,integer,integer,timestamptz,timestamptz) from public;
revoke all on function public.control_set_promotion_active(uuid,boolean) from public;
revoke all on function public.control_grant_campaign(uuid,text,uuid) from public;
revoke all on function public.control_set_member_access(uuid,text,integer,text) from public;
revoke all on function public.control_manage_account(uuid,text,integer,text) from public;
revoke all on function public.resume_my_expired_suspension() from public;
revoke all on function public.control_accounts() from public;

grant execute on function public.member_access_snapshot() to authenticated;
grant execute on function public.consume_my_profile_ai() to authenticated;
grant execute on function public.set_my_profile_favorite(uuid,boolean) to authenticated;
grant execute on function public.redeem_my_promotion(text) to authenticated;
grant execute on function public.control_create_promotion(text,text,text,text,integer,integer,timestamptz,timestamptz) to authenticated;
grant execute on function public.control_set_promotion_active(uuid,boolean) to authenticated;
grant execute on function public.control_grant_campaign(uuid,text,uuid) to authenticated;
grant execute on function public.control_set_member_access(uuid,text,integer,text) to authenticated;
grant execute on function public.control_manage_account(uuid,text,integer,text) to authenticated;
grant execute on function public.resume_my_expired_suspension() to authenticated;
grant execute on function public.control_accounts() to authenticated;
grant execute on function public.control_set_establishment_subscription(uuid,text) to authenticated;
