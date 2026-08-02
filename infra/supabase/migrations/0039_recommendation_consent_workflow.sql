-- Velvet recommendations — private by default, public only after target consent.

begin;

create table if not exists public.recommendation_requests (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','venue')),
  target_id uuid not null,
  body text not null check (char_length(btrim(body)) between 10 and 1200),
  rating smallint check (rating between 1 and 5),
  status text not null default 'pending'
    check (status in ('pending','published','declined')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_profile_id,target_type,target_id)
);

create index if not exists recommendation_requests_target_idx
  on public.recommendation_requests (target_type,target_id,status,created_at desc);

create index if not exists recommendation_requests_author_idx
  on public.recommendation_requests (author_profile_id,status,created_at desc);

create or replace function public.can_manage_recommendation_target(
  requested_target_type text,
  requested_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.is_control_user()
    or (
      requested_target_type='profile'
      and public.is_profile_member(requested_target_id)
    )
    or (
      requested_target_type='venue'
      and exists (
        select 1
        from public.profile_venue_relationships relationship
        join public.profile_members membership
          on membership.profile_id=relationship.profile_id
         and membership.status='active'
        where relationship.venue_id=requested_target_id
          and membership.user_id=auth.uid()
          and relationship.relation_type in (
            'owner','manager','organizer','claimed','professional'
          )
      )
    )
  );
$$;

create or replace function public.validate_recommendation_request_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_type='profile' then
    if not exists (
      select 1 from public.member_profiles profile
      where profile.id=new.target_id
        and profile.admission_status='approved'
    ) then
      raise exception 'recommendation_profile_target_missing';
    end if;
    if new.author_profile_id=new.target_id then
      raise exception 'self_recommendation_forbidden';
    end if;
  elsif new.target_type='venue' then
    if not exists (
      select 1 from public.venue_directory venue
      where venue.id=new.target_id
    ) then
      raise exception 'recommendation_venue_target_missing';
    end if;
  else
    raise exception 'invalid_recommendation_target_type';
  end if;

  new.body:=btrim(new.body);
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists recommendation_requests_validate_target
on public.recommendation_requests;

create trigger recommendation_requests_validate_target
before insert or update of target_type,target_id,author_profile_id,body,rating
on public.recommendation_requests
for each row
execute function public.validate_recommendation_request_target();

create or replace function public.current_recommendation_author_profile()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.profile_id
  from public.profile_members membership
  join public.member_profiles profile on profile.id=membership.profile_id
  where membership.user_id=auth.uid()
    and membership.status='active'
    and profile.admission_status='approved'
  order by membership.accepted_at nulls last, membership.created_at
  limit 1;
$$;

create or replace function public.create_recommendation_request(
  requested_target_type text,
  requested_target_id uuid,
  requested_body text,
  requested_rating smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_profile uuid:=public.current_recommendation_author_profile();
  existing_row public.recommendation_requests%rowtype;
  result_id uuid;
begin
  if author_profile is null then raise exception 'member_profile_required'; end if;
  if requested_target_type not in ('profile','venue') then
    raise exception 'invalid_recommendation_target_type';
  end if;
  if requested_body is null or char_length(btrim(requested_body)) not between 10 and 1200 then
    raise exception 'invalid_recommendation_body';
  end if;
  if requested_rating is not null and requested_rating not between 1 and 5 then
    raise exception 'invalid_recommendation_rating';
  end if;

  select * into existing_row
  from public.recommendation_requests request
  where request.author_profile_id=author_profile
    and request.target_type=requested_target_type
    and request.target_id=requested_target_id
  for update;

  if existing_row.id is not null and existing_row.status='published' then
    raise exception 'recommendation_already_published';
  end if;

  insert into public.recommendation_requests (
    author_profile_id,target_type,target_id,body,rating,status,decided_at
  ) values (
    author_profile,requested_target_type,requested_target_id,
    btrim(requested_body),requested_rating,'pending',null
  )
  on conflict (author_profile_id,target_type,target_id)
  do update set
    body=excluded.body,
    rating=excluded.rating,
    status='pending',
    decided_at=null,
    updated_at=now()
  returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.decide_recommendation_request(
  requested_recommendation_id uuid,
  requested_decision text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation public.recommendation_requests%rowtype;
begin
  if requested_decision not in ('accept','decline') then
    raise exception 'invalid_recommendation_decision';
  end if;

  select * into recommendation
  from public.recommendation_requests request
  where request.id=requested_recommendation_id
  for update;

  if recommendation.id is null then raise exception 'recommendation_missing'; end if;
  if not public.can_manage_recommendation_target(
    recommendation.target_type,
    recommendation.target_id
  ) then
    raise exception 'recommendation_target_access_denied';
  end if;

  update public.recommendation_requests
  set
    status=case when requested_decision='accept' then 'published' else 'declined' end,
    decided_at=now(),
    updated_at=now()
  where id=recommendation.id;

  return recommendation.id;
end;
$$;

alter table public.recommendation_requests enable row level security;

drop policy if exists recommendation_requests_select on public.recommendation_requests;
create policy recommendation_requests_select
on public.recommendation_requests
for select
to authenticated
using (
  status='published'
  or public.is_profile_member(author_profile_id)
  or public.can_manage_recommendation_target(target_type,target_id)
);

-- Mutations go through the two security-definer RPCs above.
drop policy if exists recommendation_requests_no_direct_insert on public.recommendation_requests;
create policy recommendation_requests_no_direct_insert
on public.recommendation_requests
for insert
to authenticated
with check (false);

drop policy if exists recommendation_requests_no_direct_update on public.recommendation_requests;
create policy recommendation_requests_no_direct_update
on public.recommendation_requests
for update
to authenticated
using (false)
with check (false);

drop policy if exists recommendation_requests_no_direct_delete on public.recommendation_requests;
create policy recommendation_requests_no_direct_delete
on public.recommendation_requests
for delete
to authenticated
using (false);

grant select on public.recommendation_requests to authenticated;
revoke insert,update,delete on public.recommendation_requests from authenticated,anon;

grant execute on function public.create_recommendation_request(text,uuid,text,smallint)
to authenticated;
grant execute on function public.decide_recommendation_request(uuid,text)
to authenticated;
grant execute on function public.can_manage_recommendation_target(text,uuid)
to authenticated,service_role;

commit;
