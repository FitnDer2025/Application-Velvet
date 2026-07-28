-- Supabase installs pgcrypto in the `extensions` schema.
-- The signup trigger runs with an empty search_path, so crypt() must be
-- explicitly schema-qualified.

create or replace function public.accept_invited_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.beta_invites%rowtype;
  supplied_code text;
begin
  supplied_code := new.raw_user_meta_data ->> 'invite_code';
  if supplied_code is null or new.email is null then
    raise exception 'beta_invitation_required';
  end if;

  select *
    into invite
    from public.beta_invites
   where lower(email::text) = lower(new.email)
     and revoked_at is null
     and expires_at > now()
     and use_count < max_uses
     and code_hash = extensions.crypt(supplied_code,code_hash)
   order by created_at desc
   limit 1
   for update;

  if invite.id is null then
    raise exception 'beta_invitation_invalid';
  end if;

  update public.beta_invites
     set use_count = use_count + 1,
         consumed_at = case when use_count + 1 >= max_uses then now() else consumed_at end
   where id = invite.id;

  insert into public.accounts (user_id,email,status,invited_role,invitation_id)
  values (new.id,new.email,'pending_consent',invite.intended_role,invite.id);

  insert into public.account_roles (user_id,role_code)
  values (new.id,'member')
  on conflict do nothing;

  if invite.intended_role <> 'member' then
    insert into public.account_roles (user_id,role_code)
    values (new.id,invite.intended_role)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
