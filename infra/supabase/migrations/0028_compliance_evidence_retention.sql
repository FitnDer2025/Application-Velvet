-- Velvet — conservation pseudonymisée des preuves de conformité.
-- Sépare les preuves de consentement et de réponse RGPD du compte opérationnel.

alter table public.consent_records
  add column if not exists subject_reference uuid;
update public.consent_records
set subject_reference = user_id
where subject_reference is null and user_id is not null;

create or replace function public.set_consent_subject_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.subject_reference := coalesce(new.subject_reference, new.user_id);
  return new;
end;
$$;

drop trigger if exists consent_records_subject_reference on public.consent_records;
create trigger consent_records_subject_reference
before insert or update of user_id, subject_reference on public.consent_records
for each row execute function public.set_consent_subject_reference();

alter table public.consent_records
  drop constraint if exists consent_records_user_id_fkey;
alter table public.consent_records
  alter column user_id drop not null;
alter table public.consent_records
  add constraint consent_records_user_id_fkey
  foreign key (user_id) references public.accounts(user_id) on delete set null;
create index if not exists consent_records_subject_reference_idx
  on public.consent_records(subject_reference, purpose, occurred_at desc);

alter table public.data_subject_requests
  add column if not exists subject_reference uuid;
update public.data_subject_requests
set subject_reference = user_id
where subject_reference is null and user_id is not null;

create or replace function public.set_dsr_subject_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.subject_reference := coalesce(new.subject_reference, new.user_id);
  return new;
end;
$$;

drop trigger if exists data_subject_requests_subject_reference on public.data_subject_requests;
create trigger data_subject_requests_subject_reference
before insert or update of user_id, subject_reference on public.data_subject_requests
for each row execute function public.set_dsr_subject_reference();

alter table public.data_subject_requests
  drop constraint if exists data_subject_requests_user_id_fkey;
alter table public.data_subject_requests
  alter column user_id drop not null;
alter table public.data_subject_requests
  add constraint data_subject_requests_user_id_fkey
  foreign key (user_id) references public.accounts(user_id) on delete set null;
create index if not exists data_subject_requests_subject_reference_idx
  on public.data_subject_requests(subject_reference, requested_at desc);

-- Les politiques existantes continuent d'autoriser le propriétaire tant que le compte existe.
-- Après suppression, seuls les utilisateurs Control sous MFA peuvent lire les preuves pseudonymisées.

create or replace function public.purge_expired_compliance_evidence()
returns table(consents_deleted integer, dsrs_deleted integer, moderation_evidence_deleted integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_consents integer := 0;
  deleted_dsrs integer := 0;
  deleted_evidence integer := 0;
begin
  delete from public.consent_records c
  where c.user_id is null
    and c.occurred_at < now() - interval '5 years';
  get diagnostics deleted_consents = row_count;

  delete from public.data_subject_requests d
  where d.user_id is null
    and d.completed_at is not null
    and d.completed_at < now() - interval '5 years';
  get diagnostics deleted_dsrs = row_count;

  -- Le trigger append-only interdit une suppression directe. Une purge de preuve doit
  -- passer par une opération exceptionnelle documentée après levée explicite du trigger.
  select 0 into deleted_evidence;

  return query select deleted_consents, deleted_dsrs, deleted_evidence;
end;
$$;

revoke all on function public.purge_expired_compliance_evidence() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (
      select 1 from cron.job where jobname = 'velvet-purge-expired-compliance-evidence'
    ) then
      perform cron.schedule(
        'velvet-purge-expired-compliance-evidence',
        '43 3 * * *',
        'select public.purge_expired_compliance_evidence();'
      );
    end if;
  end if;
end
$$;
