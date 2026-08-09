begin;

create or replace function public.zwit_v15_rollback_own_message(
  target_message_id uuid,
  target_conversation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authentication_required';
  end if;

  delete from public.messages m
  where m.id = target_message_id
    and m.conversation_id = target_conversation_id
    and m.sender_user_id = caller;

  return found;
end;
$$;

revoke all on function public.zwit_v15_rollback_own_message(uuid, uuid) from public;
revoke all on function public.zwit_v15_rollback_own_message(uuid, uuid) from anon;
grant execute on function public.zwit_v15_rollback_own_message(uuid, uuid) to authenticated;

commit;
