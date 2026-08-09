-- Velvet BETA — l'inscription membre provisionne ses droits et son identité.
-- Cette migration n'envoie aucune invitation partenaire automatiquement.

alter table public.individual_profiles
  add column if not exists gender_identity text;

alter table public.individual_profiles
  drop constraint if exists individual_profiles_gender_identity_check;

alter table public.individual_profiles
  add constraint individual_profiles_gender_identity_check
  check (
    gender_identity is null
    or gender_identity in (
      'Homme',
      'Femme',
      'Homme trans',
      'Femme trans',
      'Personne non binaire',
      'Autre identité',
      'Information privée'
    )
  );

-- Le RPC historique transmet les préférences de visibilité sous forme JSON.
-- Ce trigger extrait l'identité dans sa colonne dédiée sans remplacer la
-- fonction critique qui protège la propriété individuelle des partenaires.
create or replace function public.extract_gender_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.visibility ? 'gender_identity' then
    new.gender_identity := nullif(btrim(new.visibility ->> 'gender_identity'),'');
    new.visibility := new.visibility - 'gender_identity';
  end if;
  return new;
end;
$$;

drop trigger if exists individual_profiles_extract_gender_identity
  on public.individual_profiles;
create trigger individual_profiles_extract_gender_identity
before insert or update of visibility on public.individual_profiles
for each row execute function public.extract_gender_identity();

-- Un compte admis dans la BETA possède toujours le socle Membre. Les rôles
-- Pro, Organisateur ou Control sont des droits supplémentaires.
insert into public.account_roles (user_id,role_code)
select user_id,'member'
  from public.accounts
where status in ('pending_consent','active')
on conflict do nothing;

create or replace function public.complete_beta_activation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='terms' and granted and withdrawn_at is null
  ) then raise exception 'terms_consent_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='privacy' and granted and withdrawn_at is null
  ) then raise exception 'privacy_acknowledgement_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='adult_declaration' and granted and withdrawn_at is null
  ) then raise exception 'adult_declaration_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='sensitive_profile' and granted and withdrawn_at is null
  ) then raise exception 'explicit_sensitive_data_consent_required'; end if;

  insert into public.account_roles (user_id,role_code)
  values (auth.uid(),'member')
  on conflict do nothing;

  update public.accounts
     set status='active'
   where user_id=auth.uid()
     and status='pending_consent';

  update public.profile_members
     set status='active',
         accepted_at=coalesce(accepted_at,now())
   where user_id=auth.uid()
     and status='pending';
end;
$$;

revoke all on function public.complete_beta_activation() from public;
grant execute on function public.complete_beta_activation() to authenticated;
