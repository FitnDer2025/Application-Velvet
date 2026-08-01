-- Velvet internal-only AI test agents.
-- These records are strictly isolated from external beta testers and production.
-- The runtime also requires explicit non-production environment flags.

alter table public.member_profiles
  add column if not exists is_internal_test_agent boolean not null default false;

create index if not exists member_profiles_internal_test_agent_idx
  on public.member_profiles (is_internal_test_agent, visibility, updated_at desc)
  where is_internal_test_agent;

create table if not exists public.internal_test_agent_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  environment_label text not null default 'internal',
  updated_by uuid references public.accounts(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.internal_test_agent_settings (singleton, enabled, environment_label)
values (true, false, 'internal')
on conflict (singleton) do nothing;

create table if not exists public.internal_test_agent_viewers (
  user_id uuid primary key references public.accounts(user_id) on delete cascade,
  enabled boolean not null default true,
  added_by uuid references public.accounts(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_test_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.accounts(user_id) on delete cascade,
  profile_id uuid not null unique references public.member_profiles(id) on delete cascade,
  slug citext not null unique,
  display_name text not null check (char_length(display_name) between 2 and 120),
  persona jsonb not null default '{}'::jsonb,
  behavior jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active','paused','retired')),
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_error_code text,
  created_by uuid references public.accounts(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_test_agents_due_idx
  on public.internal_test_agents (status, next_run_at)
  where status='active';

create table if not exists public.internal_test_agent_conversation_state (
  agent_id uuid not null references public.internal_test_agents(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  last_processed_message_id uuid references public.messages(id) on delete set null,
  memory_summary text,
  updated_at timestamptz not null default now(),
  primary key (agent_id, conversation_id)
);

create table if not exists public.internal_test_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.internal_test_agents(id) on delete cascade,
  run_type text not null
    check (run_type in ('seed','conversation_reply','profile_view','favorite','profile_reaction','photo_reaction','conversation_open','pause','resume','cleanup','error')),
  status text not null check (status in ('started','completed','failed','skipped')),
  entity_type text,
  entity_id uuid,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists internal_test_agent_runs_recent_idx
  on public.internal_test_agent_runs (agent_id, started_at desc);

alter table public.internal_test_agent_settings enable row level security;
alter table public.internal_test_agent_viewers enable row level security;
alter table public.internal_test_agents enable row level security;
alter table public.internal_test_agent_conversation_state enable row level security;
alter table public.internal_test_agent_runs enable row level security;

create or replace function public.can_access_internal_test_agents()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.is_control_user()
    or exists (
      select 1
      from public.internal_test_agent_viewers v
      where v.user_id=auth.uid() and v.enabled
    )
    or exists (
      select 1
      from public.internal_test_agents a
      where a.user_id=auth.uid()
    )
  );
$$;

create or replace function public.is_internal_test_agent_user(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1
    from public.internal_test_agents a
    where a.user_id=target_user_id
  );
$$;

create or replace function public.is_internal_test_cohort_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_profiles p
    where p.id=target_profile_id
      and (
        p.is_internal_test_agent
        or exists (
          select 1
          from public.profile_members pm
          join public.internal_test_agent_viewers v
            on v.user_id=pm.user_id and v.enabled
          where pm.profile_id=p.id and pm.status='active'
        )
      )
  );
$$;

-- Preserve the canonical profile visibility rules while adding a hard isolation
-- boundary for internal agents.
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
        and exists (
          select 1 from public.member_profiles p
           where p.id = target_profile
             and p.visibility in ('beta_members','published')
             and (
               (
                 public.is_internal_test_agent_user()
                 and public.is_internal_test_cohort_profile(p.id)
               )
               or (
                 not public.is_internal_test_agent_user()
                 and (not p.is_internal_test_agent or public.can_access_internal_test_agents())
               )
             )
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

create or replace function public.guard_internal_test_agent_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(),'')='service_role' or session_user in ('postgres','supabase_admin') then
    return new;
  end if;

  if exists (
    select 1
    from public.member_profiles p
    where p.id in (new.profile_a_id,new.profile_b_id)
      and p.is_internal_test_agent
  ) then
    if not public.can_access_internal_test_agents() then
      raise exception 'internal_test_agent_access_denied';
    end if;
    if public.is_internal_test_agent_user()
       and not public.is_internal_test_cohort_profile(new.profile_a_id) then
      raise exception 'internal_test_agent_cohort_required';
    end if;
    if public.is_internal_test_agent_user()
       and not public.is_internal_test_cohort_profile(new.profile_b_id) then
      raise exception 'internal_test_agent_cohort_required';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists direct_conversations_internal_agent_guard
  on public.direct_conversation_profiles;
create trigger direct_conversations_internal_agent_guard
before insert or update on public.direct_conversation_profiles
for each row execute function public.guard_internal_test_agent_conversation();
