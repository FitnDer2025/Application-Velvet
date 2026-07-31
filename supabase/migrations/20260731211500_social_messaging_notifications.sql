begin;

alter table public.conversation_members
  add column if not exists last_delivered_at timestamptz;

alter table public.member_notifications
  add column if not exists archived_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_identity text,
  reaction text not null check (reaction in ('like', 'love', 'laugh', 'wow', 'sad', 'fire')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.conversation_typing (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_identity text,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_delivery_idx
  on public.conversation_members (conversation_id, last_delivered_at desc);
create index if not exists message_reactions_conversation_idx
  on public.message_reactions (conversation_id, message_id, updated_at desc);
create index if not exists conversation_typing_recent_idx
  on public.conversation_typing (conversation_id, updated_at desc);
create index if not exists member_notifications_active_idx
  on public.member_notifications (user_id, archived_at, read_at, created_at desc);
create index if not exists member_notifications_entity_idx
  on public.member_notifications (user_id, entity_type, entity_id, archived_at);

alter table public.message_reactions enable row level security;
alter table public.conversation_typing enable row level security;

drop policy if exists message_reactions_member_select on public.message_reactions;
create policy message_reactions_member_select
  on public.message_reactions
  for select
  using (
    exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = message_reactions.conversation_id
        and cm.user_id = auth.uid()
        and cm.left_at is null
    )
  );

drop policy if exists message_reactions_member_insert on public.message_reactions;
create policy message_reactions_member_insert
  on public.message_reactions
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = message_reactions.conversation_id
        and cm.user_id = auth.uid()
        and cm.left_at is null
    )
    and exists (
      select 1
      from public.messages m
      where m.id = message_reactions.message_id
        and m.conversation_id = message_reactions.conversation_id
        and m.deleted_at is null
    )
  );

drop policy if exists message_reactions_member_update on public.message_reactions;
create policy message_reactions_member_update
  on public.message_reactions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists message_reactions_member_delete on public.message_reactions;
create policy message_reactions_member_delete
  on public.message_reactions
  for delete
  using (user_id = auth.uid());

drop policy if exists conversation_typing_member_select on public.conversation_typing;
create policy conversation_typing_member_select
  on public.conversation_typing
  for select
  using (
    exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = conversation_typing.conversation_id
        and cm.user_id = auth.uid()
        and cm.left_at is null
    )
  );

drop policy if exists conversation_typing_member_insert on public.conversation_typing;
create policy conversation_typing_member_insert
  on public.conversation_typing
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = conversation_typing.conversation_id
        and cm.user_id = auth.uid()
        and cm.left_at is null
    )
  );

drop policy if exists conversation_typing_member_update on public.conversation_typing;
create policy conversation_typing_member_update
  on public.conversation_typing
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists conversation_typing_member_delete on public.conversation_typing;
create policy conversation_typing_member_delete
  on public.conversation_typing
  for delete
  using (user_id = auth.uid());

commit;
