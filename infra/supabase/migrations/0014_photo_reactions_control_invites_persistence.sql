-- Velvet BETA — réactions sur les photos, invitations Control et durcissement
-- de la persistance. Cette migration dépend de 0013.

create table if not exists public.photo_reactions (
  media_id uuid not null references public.media_assets(id) on delete cascade,
  reactor_user_id uuid not null references public.accounts(user_id) on delete cascade,
  reactor_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','adore')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (media_id,reactor_user_id)
);
create index if not exists photo_reactions_media_counts_idx
  on public.photo_reactions (media_id,reaction);

alter table public.photo_reactions enable row level security;

-- Les lignes nominatives ne sont jamais exposées aux membres. Ils reçoivent
-- uniquement les agrégats via photo_reaction_summaries().
drop policy if exists photo_reactions_control_audit on public.photo_reactions;
create policy photo_reactions_control_audit on public.photo_reactions
for select to authenticated
using (public.is_control_user());

revoke all on public.photo_reactions from anon, authenticated;
grant select on public.photo_reactions to authenticated;

create or replace function public.can_access_media(target_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_assets ma
    left join public.albums a on a.id=ma.album_id
    where ma.id=target_media_id
      and (
        ma.owner_user_id=auth.uid()
        or public.is_profile_member(ma.profile_id)
        or public.is_control_user()
        or (
          public.is_admitted_member()
          and ma.moderation_status='approved'
          and (
            (
              ma.album_id is null
              and ma.visibility='profile'
              and public.can_view_profile(ma.profile_id)
            )
            or (
              ma.album_id is not null
              and a.confidentiality='public'
              and ma.visibility='profile'
              and public.can_view_profile(ma.profile_id)
            )
            or exists (
              select 1
              from public.album_access_grants g
              where g.album_id=ma.album_id
                and g.revoked_at is null
                and (g.expires_at is null or g.expires_at>now())
                and (
                  g.grantee_user_id=auth.uid()
                  or g.grantee_profile_id=public.current_member_profile_id()
                )
            )
          )
        )
      )
  );
$$;

create or replace function public.photo_reaction_summaries(target_media_ids uuid[])
returns table (
  media_id uuid,
  like_count integer,
  love_count integer,
  adore_count integer,
  total_count integer,
  my_reaction text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ma.id,
    count(pr.media_id) filter (where pr.reaction='like')::integer,
    count(pr.media_id) filter (where pr.reaction='love')::integer,
    count(pr.media_id) filter (where pr.reaction='adore')::integer,
    count(pr.media_id)::integer,
    max(pr.reaction) filter (where pr.reactor_user_id=auth.uid())
  from public.media_assets ma
  left join public.photo_reactions pr on pr.media_id=ma.id
  where auth.uid() is not null
    and ma.id=any(coalesce(target_media_ids,array[]::uuid[]))
    and public.can_access_media(ma.id)
  group by ma.id;
$$;

create or replace function public.set_photo_reaction(
  target_media_id uuid,
  reaction_value text
)
returns table (
  media_id uuid,
  like_count integer,
  love_count integer,
  adore_count integer,
  total_count integer,
  my_reaction text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid;
  owner_profile uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  current_profile := public.current_member_profile_id();
  if current_profile is null then raise exception 'photo_admission_required'; end if;
  if not public.can_access_media(target_media_id) then
    raise exception 'photo_access_denied';
  end if;

  select ma.profile_id into owner_profile
  from public.media_assets ma
  where ma.id=target_media_id;
  if owner_profile is null then raise exception 'photo_not_found'; end if;
  if owner_profile=current_profile then raise exception 'cannot_react_to_own_photo'; end if;

  if reaction_value is null then
    delete from public.photo_reactions pr
    where pr.media_id=target_media_id
      and pr.reactor_user_id=auth.uid();
  else
    if reaction_value not in ('like','love','adore') then
      raise exception 'invalid_photo_reaction';
    end if;
    insert into public.photo_reactions (
      media_id,reactor_user_id,reactor_profile_id,reaction,created_at,updated_at
    ) values (
      target_media_id,auth.uid(),current_profile,reaction_value,now(),now()
    )
    on conflict on constraint photo_reactions_pkey do update set
      reactor_profile_id=excluded.reactor_profile_id,
      reaction=excluded.reaction,
      updated_at=now();
  end if;

  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'user','photo_reaction_changed','media_asset',target_media_id,
    jsonb_build_object('reaction',reaction_value)
  );

  return query
  select *
  from public.photo_reaction_summaries(array[target_media_id]);
end;
$$;

create or replace function public.admin_list_beta_invites()
returns table (
  invite_id uuid,
  email text,
  intended_role text,
  created_at timestamptz,
  expires_at timestamptz,
  use_count integer,
  max_uses integer,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'admin_required';
  end if;
  return query
  select
    bi.id,
    bi.email::text,
    bi.intended_role,
    bi.created_at,
    bi.expires_at,
    bi.use_count,
    bi.max_uses,
    case
      when bi.revoked_at is not null then 'revoked'
      when bi.use_count>=bi.max_uses then 'used'
      when bi.expires_at<=now() then 'expired'
      else 'active'
    end
  from public.beta_invites bi
  order by bi.created_at desc
  limit 100;
end;
$$;

revoke all on function public.can_access_media(uuid) from public;
revoke all on function public.photo_reaction_summaries(uuid[]) from public;
revoke all on function public.set_photo_reaction(uuid,text) from public;
revoke all on function public.admin_list_beta_invites() from public;
grant execute on function public.photo_reaction_summaries(uuid[]) to authenticated;
grant execute on function public.set_photo_reaction(uuid,text) to authenticated;
grant execute on function public.admin_list_beta_invites() to authenticated;
