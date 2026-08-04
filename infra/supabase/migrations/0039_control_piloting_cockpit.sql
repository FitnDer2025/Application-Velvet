-- Velvet Contrôle — cockpit de pilotage réel, politique IA et modèles d'e-mail.
-- À exécuter manuellement dans Supabase après le déploiement du code applicatif.

create table if not exists public.control_ai_policies (
  policy_key text primary key check (policy_key in ('media_moderation')),
  automation_mode text not null default 'active'
    check (automation_mode in ('active','observation')),
  public_auto_confidence numeric(4,3) not null default 0.860
    check (public_auto_confidence between 0.800 and 0.980),
  private_auto_confidence numeric(4,3) not null default 0.860
    check (private_auto_confidence between 0.800 and 0.980),
  updated_by uuid references public.accounts(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.control_ai_policies (
  policy_key,automation_mode,public_auto_confidence,private_auto_confidence
) values ('media_moderation','active',0.860,0.860)
on conflict (policy_key) do nothing;

create table if not exists public.control_email_templates (
  template_key text primary key check (
    template_key in (
      'couple_invitation',
      'account_pause_confirmation',
      'account_deletion_confirmation',
      'marketing_launch'
    )
  ),
  category text not null check (category in ('transactional','marketing')),
  label text not null check (char_length(label) between 2 and 120),
  status text not null default 'draft' check (status in ('draft','active')),
  subject text not null check (char_length(subject) between 2 and 180),
  preheader text not null default '' check (char_length(preheader)<=240),
  heading text not null check (char_length(heading) between 2 and 180),
  body_text text not null check (char_length(body_text) between 2 and 4000),
  cta_label text not null default '' check (char_length(cta_label)<=80),
  footer_text text not null default '' check (char_length(footer_text)<=500),
  updated_by uuid references public.accounts(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint marketing_template_requires_footer check (
    category<>'marketing' or char_length(footer_text)>=10
  )
);

insert into public.control_email_templates (
  template_key,category,label,status,subject,preheader,heading,body_text,cta_label,footer_text
) values
  (
    'couple_invitation','transactional','Invitation de la moitié','active',
    'Votre moitié vous attend dans Velvet',
    'Une part de votre histoire a déjà été confiée. À vous de poursuivre.',
    'Votre histoire vous attend.',
    '{{profile_name}} a entrouvert la porte de votre espace Velvet. Une première part de votre histoire y a déjà été confiée. Il ne manque plus que votre voix.\n\nCe lien est personnel et vous conduit vers votre propre espace. Votre fiche personnelle vous appartient ; la partie commune du couple se construira à deux.',
    'Poursuivre notre histoire',
    'Lien personnel valable 7 jours. Si vous n’attendiez pas cette invitation, ignorez simplement cet e-mail.'
  ),
  (
    'account_pause_confirmation','transactional','Confirmation de mise en pause','active',
    'Confirmer la mise en pause de votre profil Velvet',
    'Une confirmation de sécurité est nécessaire.',
    'Confirmer la mise en pause',
    'Une demande de mise en pause a été créée pour le profil « {{profile_name}} ». Le profil deviendra invisible dès que chaque membre actif de la fiche aura confirmé.',
    'Vérifier et confirmer',
    'Lien personnel valable 48 heures. Ne le partagez pas.'
  ),
  (
    'account_deletion_confirmation','transactional','Confirmation de suppression','active',
    'Confirmer la suppression de votre profil Velvet',
    'Une confirmation de sécurité est nécessaire.',
    'Confirmer la suppression',
    'Une demande de suppression a été créée pour le profil « {{profile_name}} ». Le profil deviendra invisible après les confirmations, puis les données seront supprimées définitivement 30 jours plus tard.',
    'Vérifier et confirmer',
    'Lien personnel valable 48 heures. Ne le partagez pas.'
  ),
  (
    'marketing_launch','marketing','Annonce du lancement Velvet','draft',
    'Velvet ouvre bientôt ses portes',
    'Là où les plus belles rencontres commencent.',
    'Une nouvelle expérience commence.',
    'Velvet réunit les membres et les professionnels dans une expérience élégante, confidentielle et pensée autour du consentement. Vous recevez cet e-mail parce que vous avez accepté les actualités Velvet.',
    'Découvrir Velvet',
    'Vous pouvez retirer votre consentement marketing à tout moment depuis vos paramètres ou utiliser le lien de désinscription.'
  )
on conflict (template_key) do nothing;

alter table public.control_ai_policies enable row level security;
alter table public.control_email_templates enable row level security;

drop policy if exists control_ai_policies_control_read on public.control_ai_policies;
create policy control_ai_policies_control_read on public.control_ai_policies
for select to authenticated
using (public.is_control_user());

drop policy if exists control_email_templates_control_read on public.control_email_templates;
create policy control_email_templates_control_read on public.control_email_templates
for select to authenticated
using (public.is_control_user());

revoke all on public.control_ai_policies from anon, authenticated;
revoke all on public.control_email_templates from anon, authenticated;
grant select on public.control_ai_policies to authenticated;
grant select on public.control_email_templates to authenticated;

create or replace function public.current_media_moderation_policy()
returns table (
  automation_mode text,
  public_auto_confidence numeric,
  private_auto_confidence numeric,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.automation_mode,
    p.public_auto_confidence,
    p.private_auto_confidence,
    p.updated_at
  from public.control_ai_policies p
  where p.policy_key='media_moderation'
  limit 1;
$$;

create or replace function public.control_update_media_moderation_policy(
  target_automation_mode text,
  target_public_auto_confidence numeric,
  target_private_auto_confidence numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.has_role('admin') or public.has_role('direction')
  ) then raise exception 'control_admin_required'; end if;
  if target_automation_mode not in ('active','observation')
    or target_public_auto_confidence not between 0.800 and 0.980
    or target_private_auto_confidence not between 0.800 and 0.980
  then raise exception 'invalid_media_moderation_policy'; end if;

  insert into public.control_ai_policies (
    policy_key,automation_mode,public_auto_confidence,private_auto_confidence,updated_by,updated_at
  ) values (
    'media_moderation',target_automation_mode,target_public_auto_confidence,target_private_auto_confidence,auth.uid(),now()
  ) on conflict (policy_key) do update set
    automation_mode=excluded.automation_mode,
    public_auto_confidence=excluded.public_auto_confidence,
    private_auto_confidence=excluded.private_auto_confidence,
    updated_by=auth.uid(),
    updated_at=now();

  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,metadata
  ) values (
    auth.uid(),'control','media_moderation_policy_updated','control_policy',
    jsonb_build_object(
      'automation_mode',target_automation_mode,
      'public_auto_confidence',target_public_auto_confidence,
      'private_auto_confidence',target_private_auto_confidence
    )
  );
end;
$$;

create or replace function public.control_update_email_template(
  target_template_key text,
  target_status text,
  target_subject text,
  target_preheader text,
  target_heading text,
  target_body_text text,
  target_cta_label text,
  target_footer_text text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare template_category text;
begin
  if auth.uid() is null or not (
    public.has_role('admin') or public.has_role('direction')
  ) then raise exception 'control_admin_required'; end if;
  select category into template_category
  from public.control_email_templates
  where template_key=target_template_key
  for update;
  if template_category is null then raise exception 'email_template_not_found'; end if;
  if target_status not in ('draft','active')
    or char_length(btrim(coalesce(target_subject,''))) not between 2 and 180
    or char_length(coalesce(target_preheader,''))>240
    or char_length(btrim(coalesce(target_heading,''))) not between 2 and 180
    or char_length(btrim(coalesce(target_body_text,''))) not between 2 and 4000
    or char_length(coalesce(target_cta_label,''))>80
    or char_length(coalesce(target_footer_text,''))>500
    or (template_category='marketing' and char_length(btrim(coalesce(target_footer_text,'')))<10)
  then raise exception 'invalid_email_template'; end if;

  update public.control_email_templates set
    status=target_status,
    subject=btrim(target_subject),
    preheader=btrim(coalesce(target_preheader,'')),
    heading=btrim(target_heading),
    body_text=btrim(target_body_text),
    cta_label=btrim(coalesce(target_cta_label,'')),
    footer_text=btrim(coalesce(target_footer_text,'')),
    updated_by=auth.uid(),
    updated_at=now()
  where template_key=target_template_key;

  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,metadata
  ) values (
    auth.uid(),'control','email_template_updated','email_template',
    jsonb_build_object('template_key',target_template_key,'status',target_status,'category',template_category)
  );
end;
$$;

create or replace function public.active_email_template(target_template_key text)
returns table (
  template_key text,
  category text,
  subject text,
  preheader text,
  heading text,
  body_text text,
  cta_label text,
  footer_text text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.template_key,t.category,t.subject,t.preheader,t.heading,
    t.body_text,t.cta_label,t.footer_text
  from public.control_email_templates t
  where t.template_key=target_template_key and t.status='active'
  limit 1;
$$;

create or replace function public.control_update_report(
  target_report uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare previous_status text;
begin
  if auth.uid() is null or not (
    public.has_role('admin') or public.has_role('direction') or public.has_role('moderator')
  ) then raise exception 'control_moderation_required'; end if;
  if target_status not in ('assigned','resolved','dismissed') then
    raise exception 'invalid_report_status';
  end if;
  select status into previous_status from public.reports
  where id=target_report and status in ('open','assigned','appealed') for update;
  if previous_status is null then raise exception 'report_unavailable'; end if;
  update public.reports set
    status=target_status,
    resolved_at=case when target_status in ('resolved','dismissed') then now() else null end
  where id=target_report;
  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),'control','report_' || target_status,'report',target_report,
    jsonb_build_object('previous_status',previous_status,'status',target_status)
  );
end;
$$;

-- La décision IA devient visible dans l'historique sans journaliser le média,
-- son URL, son contenu ou une donnée biométrique.
create or replace function public.record_photo_ai_decision(
  target_media_id uuid,
  decision text,
  assessment jsonb,
  signed_at bigint,
  signature text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_value bytea;
  expected_signature text;
  owner_value uuid;
  profile_value uuid;
  normalized_decision text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if decision not in ('approved','rejected','review') then raise exception 'invalid_ai_decision'; end if;
  if abs(extract(epoch from now())::bigint - signed_at)>300 then raise exception 'expired_ai_signature'; end if;

  select owner_user_id,profile_id into owner_value,profile_value
  from public.media_assets where id=target_media_id for update;
  if owner_value is null or owner_value<>auth.uid() then raise exception 'media_owner_required'; end if;

  select ss.secret_value into secret_value
  from velvet_private.system_secrets ss
  where ss.secret_name='photo_moderation_hmac';
  expected_signature := encode(
    extensions.hmac(
      convert_to(target_media_id::text || '|' || decision || '|' || signed_at::text,'UTF8'),
      secret_value,'sha256'
    ),'hex'
  );
  if expected_signature<>lower(signature) then raise exception 'invalid_ai_signature'; end if;

  normalized_decision := case when decision='review' then 'pending' else decision end;
  update public.media_assets set
    moderation_status=normalized_decision,
    ai_assessment=coalesce(assessment,'{}'::jsonb),
    ai_reviewed_at=now(),
    rejection_reason=case
      when decision='rejected' then nullif(assessment ->> 'summary','')
      when decision='review' then 'Contrôle humain nécessaire'
      else null
    end
  where id=target_media_id;

  perform public.refresh_profile_admission(profile_value);

  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    null,'ai_agent','media_ai_' || decision,'media_asset',target_media_id,
    jsonb_build_object(
      'profile_id',profile_value,
      'decision',decision,
      'confidence',assessment -> 'confidence',
      'model',assessment -> 'model',
      'scope',assessment -> 'moderation_scope',
      'automatic_decision',assessment -> 'automatic_decision',
      'human_review_required',assessment -> 'human_review_required'
    )
  );
  return normalized_decision;
end;
$$;

revoke all on function public.current_media_moderation_policy() from public;
revoke all on function public.control_update_media_moderation_policy(text,numeric,numeric) from public;
revoke all on function public.control_update_email_template(text,text,text,text,text,text,text,text) from public;
revoke all on function public.active_email_template(text) from public;
revoke all on function public.control_update_report(uuid,text) from public;
revoke all on function public.record_photo_ai_decision(uuid,text,jsonb,bigint,text) from public;

grant execute on function public.current_media_moderation_policy() to authenticated;
grant execute on function public.control_update_media_moderation_policy(text,numeric,numeric) to authenticated;
grant execute on function public.control_update_email_template(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.active_email_template(text) to authenticated;
grant execute on function public.control_update_report(uuid,text) to authenticated;
grant execute on function public.record_photo_ai_decision(uuid,text,jsonb,bigint,text) to authenticated;
