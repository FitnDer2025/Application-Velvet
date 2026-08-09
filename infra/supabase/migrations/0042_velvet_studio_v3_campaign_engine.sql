-- Velvet Studio V3 — campagne multicanale, contenus et calendrier éditorial.
-- À exécuter manuellement dans Supabase après la migration 0041.

create table if not exists public.studio_campaign_packs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.studio_projects(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  brief text not null default '',
  objective text not null default '',
  audience text not null default '',
  region text not null default '',
  tone text not null default '',
  provider text not null default 'velvet-local-campaign-engine-v3',
  status text not null default 'draft' check (status in ('draft','review','approved','scheduled','archived')),
  brand_guard_score smallint not null default 100 check (brand_guard_score between 0 and 100),
  pack_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_campaign_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.studio_campaign_packs(id) on delete cascade,
  external_item_id text,
  item_kind text not null check (item_kind in ('video','visual','post','newsletter','banner','calendar_slot')),
  channel text not null default '',
  title text not null default '',
  status text not null default 'draft' check (status in ('draft','approved','scheduled','published','archived')),
  scheduled_at timestamptz,
  item_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_campaign_exports (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.studio_campaign_packs(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  export_kind text not null check (export_kind in ('json','csv','publication_manifest','social_pack')),
  status text not null default 'ready' check (status in ('queued','ready','failed','expired')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists studio_campaign_packs_project_updated_idx
on public.studio_campaign_packs(project_id,updated_at desc);
create index if not exists studio_campaign_packs_creator_updated_idx
on public.studio_campaign_packs(created_by,updated_at desc);
create index if not exists studio_campaign_items_pack_kind_idx
on public.studio_campaign_items(pack_id,item_kind,status);
create index if not exists studio_campaign_items_schedule_idx
on public.studio_campaign_items(scheduled_at)
where scheduled_at is not null;
create index if not exists studio_campaign_exports_pack_created_idx
on public.studio_campaign_exports(pack_id,created_at desc);

alter table public.studio_campaign_packs enable row level security;
alter table public.studio_campaign_items enable row level security;
alter table public.studio_campaign_exports enable row level security;

create policy studio_campaign_packs_control_read
on public.studio_campaign_packs
for select to authenticated
using (public.has_role('admin') or public.has_role('direction'));

create policy studio_campaign_packs_control_create
on public.studio_campaign_packs
for insert to authenticated
with check (
  created_by=auth.uid()
  and (public.has_role('admin') or public.has_role('direction'))
);

create policy studio_campaign_packs_control_update
on public.studio_campaign_packs
for update to authenticated
using (public.has_role('admin') or public.has_role('direction'))
with check (public.has_role('admin') or public.has_role('direction'));

create policy studio_campaign_packs_control_delete
on public.studio_campaign_packs
for delete to authenticated
using (
  created_by=auth.uid()
  and (public.has_role('admin') or public.has_role('direction'))
);

create policy studio_campaign_items_control_all
on public.studio_campaign_items
for all to authenticated
using (public.has_role('admin') or public.has_role('direction'))
with check (public.has_role('admin') or public.has_role('direction'));

create policy studio_campaign_exports_control_all
on public.studio_campaign_exports
for all to authenticated
using (public.has_role('admin') or public.has_role('direction'))
with check (
  requested_by=auth.uid()
  and (public.has_role('admin') or public.has_role('direction'))
);

create or replace function public.control_save_studio_campaign_pack(
  target_id uuid,
  target_project uuid,
  target_title text,
  target_brief text,
  target_objective text,
  target_audience text,
  target_region text,
  target_tone text,
  target_provider text,
  target_status text,
  target_brand_guard_score integer,
  target_pack_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  result_id uuid;
  item jsonb;
  item_kind text;
  item_external_id text;
  item_channel text;
  item_title text;
  item_status text;
  item_scheduled_at timestamptz;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'studio_control_required';
  end if;
  if target_status not in ('draft','review','approved','scheduled','archived') then
    raise exception 'studio_campaign_pack_status_invalid';
  end if;
  if target_brand_guard_score < 0 or target_brand_guard_score > 100 then
    raise exception 'studio_brand_guard_score_invalid';
  end if;
  if target_project is not null and not exists (
    select 1 from public.studio_projects where id=target_project
  ) then
    raise exception 'studio_project_not_found';
  end if;

  if target_id is null then
    insert into public.studio_campaign_packs(
      project_id,created_by,title,brief,objective,audience,region,tone,provider,status,brand_guard_score,pack_data
    ) values (
      target_project,auth.uid(),btrim(target_title),coalesce(target_brief,''),coalesce(target_objective,''),
      coalesce(target_audience,''),coalesce(target_region,''),coalesce(target_tone,''),
      coalesce(nullif(btrim(target_provider),''),'velvet-local-campaign-engine-v3'),target_status,
      target_brand_guard_score,coalesce(target_pack_data,'{}'::jsonb)
    ) returning id into result_id;
  else
    update public.studio_campaign_packs
    set project_id=target_project,title=btrim(target_title),brief=coalesce(target_brief,''),
        objective=coalesce(target_objective,''),audience=coalesce(target_audience,''),
        region=coalesce(target_region,''),tone=coalesce(target_tone,''),
        provider=coalesce(nullif(btrim(target_provider),''),'velvet-local-campaign-engine-v3'),
        status=target_status,brand_guard_score=target_brand_guard_score,
        pack_data=coalesce(target_pack_data,'{}'::jsonb),updated_at=now()
    where id=target_id and (created_by=auth.uid() or public.has_role('admin'))
    returning id into result_id;
    if result_id is null then raise exception 'studio_campaign_pack_not_found'; end if;
  end if;

  delete from public.studio_campaign_items where pack_id=result_id;

  for item in
    select value from jsonb_array_elements(coalesce(target_pack_data->'videos','[]'::jsonb))
    union all select value from jsonb_array_elements(coalesce(target_pack_data->'visuals','[]'::jsonb))
    union all select value from jsonb_array_elements(coalesce(target_pack_data->'posts','[]'::jsonb))
    union all select target_pack_data->'newsletter' where jsonb_typeof(target_pack_data->'newsletter')='object'
    union all select target_pack_data->'banner' where jsonb_typeof(target_pack_data->'banner')='object'
    union all select value from jsonb_array_elements(coalesce(target_pack_data->'calendar','[]'::jsonb))
  loop
    item_kind := case
      when item ? 'itemKind' then coalesce(item->>'itemKind','calendar_slot')
      else coalesce(item->>'kind','post')
    end;
    if item_kind not in ('video','visual','post','newsletter','banner','calendar_slot') then
      item_kind := 'post';
    end if;
    item_external_id := coalesce(item->>'id',item->>'itemId');
    item_channel := coalesce(item->>'channel',item->>'platform','');
    item_title := coalesce(item->>'title',item->>'headline',item->>'theme',item->>'subject','');
    item_status := coalesce(item->>'status','draft');
    if item_status not in ('draft','approved','scheduled','published','archived','planned') then
      item_status := 'draft';
    elsif item_status='planned' then
      item_status := 'scheduled';
    end if;
    begin
      item_scheduled_at := nullif(item->>'scheduledAt','')::timestamptz;
    exception when others then
      item_scheduled_at := null;
    end;

    insert into public.studio_campaign_items(
      pack_id,external_item_id,item_kind,channel,title,status,scheduled_at,item_data
    ) values (
      result_id,item_external_id,item_kind,item_channel,left(item_title,220),item_status,item_scheduled_at,item
    );
  end loop;

  insert into public.audit_events(actor_user_id,actor_type,action,entity_type,entity_id,metadata)
  values(
    auth.uid(),'control','studio_campaign_pack_saved','studio_campaign_pack',result_id,
    jsonb_build_object(
      'status',target_status,
      'provider',coalesce(target_provider,'velvet-local-campaign-engine-v3'),
      'brand_guard_score',target_brand_guard_score,
      'items',jsonb_array_length(coalesce(target_pack_data->'videos','[]'::jsonb))
        + jsonb_array_length(coalesce(target_pack_data->'visuals','[]'::jsonb))
        + jsonb_array_length(coalesce(target_pack_data->'posts','[]'::jsonb))
    )
  );
  return result_id;
end;
$$;

create or replace function public.control_set_studio_campaign_item_status(
  target_item uuid,
  target_status text,
  target_scheduled_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  target_pack uuid;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'studio_control_required';
  end if;
  if target_status not in ('draft','approved','scheduled','published','archived') then
    raise exception 'studio_campaign_item_status_invalid';
  end if;
  update public.studio_campaign_items
  set status=target_status,
      scheduled_at=case when target_status='scheduled' then target_scheduled_at else scheduled_at end,
      updated_at=now()
  where id=target_item
  returning pack_id into target_pack;
  if target_pack is null then raise exception 'studio_campaign_item_not_found'; end if;

  insert into public.audit_events(actor_user_id,actor_type,action,entity_type,entity_id,metadata)
  values(
    auth.uid(),'control','studio_campaign_item_status_changed','studio_campaign_item',target_item,
    jsonb_build_object('pack_id',target_pack,'status',target_status,'scheduled_at',target_scheduled_at)
  );
end;
$$;

create or replace function public.control_create_studio_campaign_export(
  target_pack uuid,
  target_kind text,
  target_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare result_id uuid;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'studio_control_required';
  end if;
  if target_kind not in ('json','csv','publication_manifest','social_pack') then
    raise exception 'studio_campaign_export_kind_invalid';
  end if;
  if not exists(select 1 from public.studio_campaign_packs where id=target_pack) then
    raise exception 'studio_campaign_pack_not_found';
  end if;
  insert into public.studio_campaign_exports(pack_id,requested_by,export_kind,payload,expires_at)
  values(target_pack,auth.uid(),target_kind,coalesce(target_payload,'{}'::jsonb),now()+interval '30 days')
  returning id into result_id;
  insert into public.audit_events(actor_user_id,actor_type,action,entity_type,entity_id,metadata)
  values(auth.uid(),'control','studio_campaign_export_created','studio_campaign_export',result_id,
         jsonb_build_object('pack_id',target_pack,'kind',target_kind));
  return result_id;
end;
$$;

revoke all on function public.control_save_studio_campaign_pack(uuid,uuid,text,text,text,text,text,text,text,text,integer,jsonb) from public;
revoke all on function public.control_set_studio_campaign_item_status(uuid,text,timestamptz) from public;
revoke all on function public.control_create_studio_campaign_export(uuid,text,jsonb) from public;

grant execute on function public.control_save_studio_campaign_pack(uuid,uuid,text,text,text,text,text,text,text,text,integer,jsonb) to authenticated;
grant execute on function public.control_set_studio_campaign_item_status(uuid,text,timestamptz) to authenticated;
grant execute on function public.control_create_studio_campaign_export(uuid,text,jsonb) to authenticated;