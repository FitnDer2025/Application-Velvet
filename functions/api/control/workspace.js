import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from '../members/_shared.js';
import { signedMediaUrl } from '../members/media.js';

const CONTROL_ROLES = new Set(['admin', 'direction', 'moderator', 'support', 'auditor']);
const MEDIA_REVIEW_ROLES = new Set(['admin', 'direction', 'moderator']);
const CONFIGURATION_ROLES = new Set(['admin', 'direction']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_TEMPLATE_KEYS = new Set([
  'couple_invitation',
  'account_pause_confirmation',
  'account_deletion_confirmation',
  'marketing_launch'
]);

function randomPromotionCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const token = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  return `VELVET-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function controlAccess(request, env) {
  const access = await memberSession(request, env, { allowUnverified: true });
  if (access.response) return access;
  if (!access.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return { response: json({ error: 'control_access_required' }, 403) };
  }
  return access;
}

function hasAnyRole(access, roles) {
  return access.account.roles.some((role) => roles.has(role));
}

function optionalResult(result, fallback = []) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function policyFromResult(result) {
  const row = optionalResult(result, null);
  const value = Array.isArray(row) ? row[0] : row;
  if (!value) {
    return {
      automation_mode: 'active',
      public_auto_confidence: 0.86,
      private_auto_confidence: 0.86,
      updated_at: null,
      migration_pending: true
    };
  }
  return { ...value, migration_pending: false };
}

function actionPriority(kind) {
  return { critical: 0, high: 1, normal: 2, low: 3 }[kind] ?? 4;
}

function buildHumanActions({ releaseChecks, reports, organizers, pendingMedia, verifications, dataRequests }) {
  const actions = [];
  for (const check of releaseChecks || []) {
    if (!['failed', 'warning'].includes(check.status)) continue;
    actions.push({
      id: `release-${check.check_code}`,
      type: 'release',
      priority: check.status === 'failed' ? 'critical' : 'high',
      title: check.status === 'failed' ? 'Blocage de publication' : 'Point à surveiller',
      detail: check.detail,
      count: Number(check.affected_count || 0),
      targetView: 'actions',
      createdAt: null
    });
  }
  for (const report of reports || []) {
    if (!['open', 'assigned', 'appealed'].includes(report.status)) continue;
    actions.push({
      id: report.id,
      type: 'report',
      priority: report.status === 'appealed' ? 'critical' : 'high',
      title: report.status === 'appealed' ? 'Recours à examiner' : 'Signalement à traiter',
      detail: `${report.subject_type} · ${report.category}`,
      count: 1,
      targetView: 'actions',
      createdAt: report.created_at
    });
  }
  for (const media of pendingMedia || []) {
    actions.push({
      id: media.id,
      type: 'media',
      priority: media.ai_assessment?.technical_error ? 'high' : 'normal',
      title: media.media_type === 'video' ? 'Vidéo à vérifier' : 'Décision média attendue',
      detail: media.ai_assessment?.summary || 'L’analyse automatique demande une validation humaine.',
      count: 1,
      targetView: 'intelligence',
      createdAt: media.created_at
    });
  }
  for (const organizer of organizers || []) {
    if (organizer.status !== 'pending') continue;
    actions.push({
      id: organizer.id,
      type: 'organizer',
      priority: 'normal',
      title: 'Demande Organisateur',
      detail: organizer.message || 'Une demande attend une décision.',
      count: 1,
      targetView: 'actions',
      createdAt: organizer.created_at
    });
  }
  for (const verification of verifications || []) {
    if (!['pending', 'failed', 'expired', 'revoked'].includes(verification.status)) continue;
    actions.push({
      id: verification.user_id,
      type: 'verification',
      priority: ['failed', 'revoked'].includes(verification.status) ? 'high' : 'normal',
      title: 'Vérification identité / majorité',
      detail: `État : ${verification.status}`,
      count: 1,
      targetView: 'actions',
      createdAt: verification.updated_at
    });
  }
  for (const request of dataRequests || []) {
    if (['completed', 'rejected'].includes(request.status)) continue;
    const overdue = request.due_at && new Date(request.due_at).getTime() < Date.now();
    actions.push({
      id: request.id,
      type: 'data_request',
      priority: overdue ? 'critical' : 'normal',
      title: overdue ? 'Demande RGPD hors délai' : 'Demande RGPD à suivre',
      detail: `${request.request_type} · ${request.status}`,
      count: 1,
      targetView: 'actions',
      createdAt: request.requested_at
    });
  }
  return actions.sort((left, right) => {
    const priority = actionPriority(left.priority) - actionPriority(right.priority);
    if (priority) return priority;
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });
}

function decisionFromStatus(status) {
  return status === 'pending' ? 'review' : status;
}

function buildAiHistory(mediaRows, events) {
  const media = (mediaRows || []).map((row) => ({
    id: row.id,
    kind: 'media',
    agent: 'IA de modération média',
    subject: `${row.media_type === 'video' ? 'Vidéo' : 'Photo'} · ${row.member_profiles?.display_name || 'Profil membre'}`,
    decision: decisionFromStatus(row.moderation_status),
    confidence: Number(row.ai_assessment?.confidence || 0),
    automatic: row.ai_assessment?.automatic_decision === true,
    humanReviewRequired: row.ai_assessment?.human_review_required === true || row.moderation_status === 'pending',
    summary: row.ai_assessment?.summary || 'Décision enregistrée.',
    scope: row.ai_assessment?.moderation_scope || 'media',
    model: row.ai_assessment?.model || null,
    technicalError: Boolean(row.ai_assessment?.technical_error),
    occurredAt: row.ai_reviewed_at || row.created_at
  }));
  const eventHistory = (events || [])
    .filter((event) => event.ai_assessment && Object.keys(event.ai_assessment).length)
    .map((event) => ({
      id: event.id,
      kind: 'event',
      agent: 'IA de contrôle des événements',
      subject: event.title,
      decision: decisionFromStatus(event.moderation_status),
      confidence: Number(event.ai_assessment?.confidence || 0),
      automatic: event.ai_assessment?.automatic_decision !== false && event.moderation_status !== 'pending',
      humanReviewRequired: event.moderation_status === 'pending' || event.ai_assessment?.uncertain === true,
      summary: event.ai_assessment?.summary || 'Annonce contrôlée.',
      scope: 'event',
      model: event.ai_assessment?.model || null,
      technicalError: Boolean(event.ai_assessment?.technical_error),
      occurredAt: event.updated_at || event.created_at
    }));
  return [...media, ...eventHistory]
    .sort((left, right) => new Date(right.occurredAt || 0) - new Date(left.occurredAt || 0))
    .slice(0, 150);
}

function aiSummary(history) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const day = history.filter((item) => new Date(item.occurredAt).getTime() >= dayAgo);
  const week = history.filter((item) => new Date(item.occurredAt).getTime() >= weekAgo);
  const automatic = day.filter((item) => item.automatic).length;
  return {
    last24Hours: day.length,
    last7Days: week.length,
    automaticLast24Hours: automatic,
    humanReviewLast24Hours: day.filter((item) => item.humanReviewRequired).length,
    approvedLast24Hours: day.filter((item) => item.decision === 'approved').length,
    rejectedLast24Hours: day.filter((item) => item.decision === 'rejected').length,
    technicalErrorsLast24Hours: day.filter((item) => item.technicalError).length,
    autonomyRate: day.length ? Math.round((automatic / day.length) * 100) : 0
  };
}

async function workspace(env, access) {
  const canReviewMedia = hasAnyRole(access, MEDIA_REVIEW_ROLES);
  const canConfigure = hasAnyRole(access, CONFIGURATION_ROLES);
  const [
    accounts,
    profiles,
    establishments,
    venueDirectory,
    staff,
    events,
    registrations,
    organizers,
    reports,
    audits,
    releaseChecks,
    pendingMediaRows,
    aiMediaRows,
    verifications,
    dataRequests
  ] = await Promise.all([
    restJson(env, '/rest/v1/rpc/control_accounts', access.session, { method: 'POST', body: '{}' }),
    restJson(env, '/rest/v1/member_profiles?select=id,profile_type,display_name,admission_status,verification_status,visibility,created_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/establishments?select=id,directory_venue_id,slug,name,kind,city,visibility,subscription_status,verified_at,created_at,updated_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/venue_directory?select=id,slug,name,kind,city,country_code,claim_status,claimed_establishment_id,manual_review_required&public_visibility=eq.listed&verification_status=neq.closed&order=name.asc&limit=500', access.session),
    restJson(env, '/rest/v1/establishment_staff?select=establishment_id,user_id,staff_role,status,created_at&limit=1000', access.session),
    restJson(env, '/rest/v1/events?select=id,establishment_id,organizer_profile_id,owner_type,title,starts_at,capacity,visibility,moderation_status,ai_assessment,created_at,updated_at&order=starts_at.desc&limit=1000', access.session),
    restJson(env, '/rest/v1/event_registrations?select=id,event_id,user_id,places,status,created_at&order=created_at.desc&limit=2000', access.session),
    restJson(env, '/rest/v1/organizer_requests?select=id,user_id,member_profile_id,message,status,reviewed_by,reviewed_at,created_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/reports?select=id,reporter_user_id,subject_type,subject_id,category,description,status,created_at,resolved_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/audit_events?select=sequence_number,actor_user_id,actor_type,action,entity_type,entity_id,metadata,occurred_at&order=sequence_number.desc&limit=150', access.session),
    restJson(env, '/rest/v1/rpc/control_beta_release_checks', access.session, { method: 'POST', body: '{}' }),
    canReviewMedia
      ? restJson(env, '/rest/v1/media_assets?select=id,profile_id,album_id,individual_profile_id,owner_user_id,media_role,media_type,visibility,storage_path,moderation_status,ai_assessment,rejection_reason,ai_reviewed_at,created_at,member_profiles(display_name,profile_type),albums(name,confidentiality)&moderation_status=eq.pending&order=created_at.asc&limit=250', access.session)
      : Promise.resolve([]),
    canReviewMedia
      ? restJson(env, '/rest/v1/media_assets?select=id,profile_id,media_role,media_type,visibility,moderation_status,ai_assessment,ai_reviewed_at,created_at,member_profiles(display_name,profile_type)&ai_reviewed_at=not.is.null&order=ai_reviewed_at.desc&limit=150', access.session)
      : Promise.resolve([]),
    restJson(env, '/rest/v1/account_identity_age_verifications?select=user_id,provider,status,identity_verified,majority_verified,verified_at,expires_at,updated_at&status=neq.verified&order=updated_at.desc&limit=250', access.session).catch(() => []),
    restJson(env, '/rest/v1/data_subject_requests?select=id,user_id,request_type,status,requested_at,due_at,completed_at&status=not.in.(completed,rejected)&order=due_at.asc&limit=250', access.session).catch(() => [])
  ]);

  const pendingMedia = await Promise.all((pendingMediaRows || []).map(async (media) => ({
    ...media,
    previewUrl: await signedMediaUrl(env, access.session, media.storage_path, 300).catch(() => null)
  })));

  const configurationResults = await Promise.allSettled([
    restJson(env, '/rest/v1/rpc/current_media_moderation_policy', access.session, { method: 'POST', body: '{}' }),
    restJson(env, '/rest/v1/control_email_templates?select=template_key,category,label,status,subject,preheader,heading,body_text,cta_label,footer_text,updated_at&order=category.asc,label.asc', access.session)
  ]);
  const monetizationResults = await Promise.allSettled([
    restJson(env, '/rest/v1/promotion_campaigns?select=id,name,distribution_mode,subject_type,entitlement_code,target_audience,duration_days,starts_at,ends_at,max_redemptions,redemption_count,per_subject_limit,active,created_at&order=created_at.desc&limit=250', access.session),
    restJson(env, '/rest/v1/billing_plans?select=code,label,audience,features,active&order=code.asc', access.session),
    restJson(env, '/rest/v1/billing_prices?select=id,plan_code,price_code,currency,amount_cents,interval_unit,interval_count,active&order=amount_cents.asc', access.session)
  ]);

  const aiHistory = buildAiHistory(aiMediaRows, events);
  const humanActions = buildHumanActions({
    releaseChecks,
    reports,
    organizers,
    pendingMedia,
    verifications,
    dataRequests
  });
  return {
    accounts,
    profiles,
    establishments,
    venueDirectory,
    staff,
    events,
    registrations,
    organizers,
    reports,
    audits,
    releaseChecks,
    pendingMedia,
    verifications,
    dataRequests,
    humanActions,
    aiHistory,
    aiSummary: aiSummary(aiHistory),
    mediaPolicy: policyFromResult(configurationResults[0]),
    emailTemplates: optionalResult(configurationResults[1], []),
    configurationAvailable: configurationResults.every((result) => result.status === 'fulfilled'),
    permissions: {
      canReviewMedia,
      canConfigure,
      canManageReports: hasAnyRole(access, MEDIA_REVIEW_ROLES),
      canManageInvitations: access.account.roles.includes('admin')
    },
    systems: [
      {
        key: 'media_ai',
        label: 'Analyse IA des photos',
        status: env.AI && env.PHOTO_MODERATION_HMAC_KEY ? 'active' : 'unavailable',
        detail: env.AI && env.PHOTO_MODERATION_HMAC_KEY
          ? 'Photos publiques et privées analysées avant publication.'
          : 'Binding IA ou signature de décision non configuré.'
      },
      {
        key: 'video_review',
        label: 'Contrôle des vidéos',
        status: 'human',
        detail: 'Les vidéos sont volontairement routées vers la revue humaine.'
      },
      {
        key: 'event_ai',
        label: 'Analyse des événements',
        status: env.AI ? 'active' : 'fallback',
        detail: env.AI ? 'Analyse IA et contrôle structurel actifs.' : 'Contrôle structurel actif, IA indisponible.'
      },
      {
        key: 'email',
        label: 'E-mails transactionnels',
        status: env.RESEND_API_KEY && env.VELVET_FROM_EMAIL ? 'active' : 'unavailable',
        detail: env.RESEND_API_KEY && env.VELVET_FROM_EMAIL
          ? 'Prestataire d’envoi configuré.'
          : 'Modèles éditables, mais prestataire d’envoi non configuré.'
      },
      {
        key: 'identity',
        label: 'Vérification identité / majorité',
        status: env.IDENTITY_AGE_VERIFICATION_START_URL ? 'active' : 'locked',
        detail: env.IDENTITY_AGE_VERIFICATION_START_URL
          ? 'Connecteur de vérification configuré.'
          : 'Accès externe fermé tant qu’aucun prestataire n’est choisi.'
      }
    ],
    mediaReviewAllowed: canReviewMedia,
    promotions: optionalResult(monetizationResults[0], []),
    billingPlans: optionalResult(monetizationResults[1], []),
    billingPrices: optionalResult(monetizationResults[2], []),
    monetizationAvailable: monetizationResults.every((result) => result.status === 'fulfilled')
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await controlAccess(request, env);
    if (access.response) return access.response;
    return withSession({ ...(await workspace(env, access)), account: access.account }, access.session);
  } catch (error) {
    return json({ error: error.message || 'control_workspace_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await controlAccess(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    let generatedPromotionCode = null;
    if (body.action === 'update_media_policy') {
      if (!hasAnyRole(access, CONFIGURATION_ROLES)) {
        return withSession({ error: 'control_admin_required' }, access.session, 403);
      }
      const publicConfidence = Number(body.publicAutoConfidence);
      const privateConfidence = Number(body.privateAutoConfidence);
      if (!['active', 'observation'].includes(body.automationMode)
        || !Number.isFinite(publicConfidence) || publicConfidence < 0.8 || publicConfidence > 0.98
        || !Number.isFinite(privateConfidence) || privateConfidence < 0.8 || privateConfidence > 0.98) {
        return withSession({ error: 'invalid_media_moderation_policy' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_update_media_moderation_policy', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_automation_mode: body.automationMode,
          target_public_auto_confidence: publicConfidence,
          target_private_auto_confidence: privateConfidence
        })
      });
    } else if (body.action === 'update_email_template') {
      if (!hasAnyRole(access, CONFIGURATION_ROLES)) {
        return withSession({ error: 'control_admin_required' }, access.session, 403);
      }
      if (!EMAIL_TEMPLATE_KEYS.has(body.templateKey) || !['draft', 'active'].includes(body.status)) {
        return withSession({ error: 'invalid_email_template' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_update_email_template', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_template_key: body.templateKey,
          target_status: body.status,
          target_subject: cleanText(body.subject, 180),
          target_preheader: cleanText(body.preheader, 240),
          target_heading: cleanText(body.heading, 180),
          target_body_text: cleanText(body.bodyText, 4000),
          target_cta_label: cleanText(body.ctaLabel, 80),
          target_footer_text: cleanText(body.footerText, 500)
        })
      });
    } else if (body.action === 'report_status') {
      if (!hasAnyRole(access, MEDIA_REVIEW_ROLES)
        || !UUID.test(body.reportId || '')
        || !['assigned', 'resolved', 'dismissed'].includes(body.status)) {
        return withSession({ error: 'invalid_report_status' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_update_report', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_report: body.reportId, target_status: body.status })
      });
    } else if (body.action === 'create_establishment') {
      if (!UUID.test(body.ownerUserId || '')) return withSession({ error: 'invalid_owner' }, access.session, 400);
      await restJson(env, '/rest/v1/rpc/control_create_establishment', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_name: cleanText(body.name, 180),
          target_slug: cleanText(body.slug, 100),
          target_kind: cleanText(body.kind, 30),
          target_owner: body.ownerUserId
        })
      });
    } else if (body.action === 'decide_organizer') {
      if (!UUID.test(body.requestId || '') || !['approved', 'declined'].includes(body.decision)) {
        return withSession({ error: 'invalid_organizer_decision' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_decide_organizer', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_request: body.requestId, target_decision: body.decision })
      });
    } else if (body.action === 'venue_visibility') {
      if (!UUID.test(body.venueId || '') || !['draft', 'review', 'published', 'suspended'].includes(body.visibility)) {
        return withSession({ error: 'invalid_venue_visibility' }, access.session, 400);
      }
      await restJson(env, `/rest/v1/establishments?id=eq.${encodeURIComponent(body.venueId)}`, access.session, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ visibility: body.visibility })
      });
    } else if (body.action === 'claim_directory_venue') {
      if (!UUID.test(body.venueId || '') || !UUID.test(body.ownerUserId || '')) {
        return withSession({ error: 'invalid_venue_claim' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_claim_directory_venue', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_venue: body.venueId, target_owner: body.ownerUserId })
      });
    } else if (body.action === 'subscription_status') {
      if (!UUID.test(body.venueId || '') || !['inactive', 'trial', 'active', 'past_due', 'cancelled'].includes(body.status)) {
        return withSession({ error: 'invalid_subscription_status' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_set_establishment_subscription', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_establishment: body.venueId, target_status: body.status })
      });
    } else if (body.action === 'decide_media' || body.action === 'decide_profile_photo') {
      if (!UUID.test(body.mediaId || '') || !['approved', 'rejected'].includes(body.decision)) {
        return withSession({ error: 'invalid_media_moderation_decision' }, access.session, 400);
      }
      const reason = cleanText(body.reason, 500);
      if (body.decision === 'rejected' && !reason) {
        return withSession({ error: 'media_rejection_reason_required' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_decide_media', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_media: body.mediaId,
          target_decision: body.decision,
          target_reason: reason || null
        })
      });
    } else if (body.action === 'create_promotion') {
      const subjectType = body.subjectType === 'establishment' ? 'establishment' : 'profile';
      const allowedAudiences = subjectType === 'establishment'
        ? ['pro']
        : ['couple', 'solo_man', 'paid_member', 'any_member'];
      if (!allowedAudiences.includes(body.audience)) {
        return withSession({ error: 'invalid_promotion_audience' }, access.session, 400);
      }
      const durationDays = Number(body.durationDays);
      const maxRedemptions = Number(body.maxRedemptions);
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650
        || !Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1000000) {
        return withSession({ error: 'invalid_promotion_limits' }, access.session, 400);
      }
      generatedPromotionCode = randomPromotionCode();
      await restJson(env, '/rest/v1/rpc/control_create_promotion', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_name: cleanText(body.name, 120),
          target_code_hash: await sha256(generatedPromotionCode),
          target_subject_type: subjectType,
          target_audience: body.audience,
          target_duration_days: durationDays,
          target_max_redemptions: maxRedemptions,
          target_starts_at: body.startsAt || null,
          target_ends_at: body.endsAt || null
        })
      });
    } else if (body.action === 'promotion_status') {
      if (!UUID.test(body.campaignId || '')) return withSession({ error: 'invalid_promotion' }, access.session, 400);
      await restJson(env, '/rest/v1/rpc/control_set_promotion_active', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_campaign: body.campaignId, target_active: Boolean(body.active) })
      });
    } else if (body.action === 'grant_campaign') {
      if (!UUID.test(body.campaignId || '') || !UUID.test(body.subjectId || '')
        || !['profile', 'establishment'].includes(body.subjectType)) {
        return withSession({ error: 'invalid_campaign_grant' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_grant_campaign', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_campaign: body.campaignId,
          target_subject_type: body.subjectType,
          target_subject: body.subjectId
        })
      });
    } else if (body.action === 'member_access') {
      if (!UUID.test(body.profileId || '') || !['discovery', 'signature'].includes(body.mode)) {
        return withSession({ error: 'invalid_member_access' }, access.session, 400);
      }
      const durationDays = body.mode === 'signature' && body.durationDays ? Number(body.durationDays) : null;
      await restJson(env, '/rest/v1/rpc/control_set_member_access', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_profile: body.profileId,
          target_mode: body.mode,
          target_duration_days: durationDays,
          target_reason: cleanText(body.reason, 500) || null
        })
      });
    } else if (body.action === 'account_state') {
      if (!UUID.test(body.userId || '') || !['activate', 'suspend', 'block', 'delete'].includes(body.accountAction)) {
        return withSession({ error: 'invalid_account_action' }, access.session, 400);
      }
      const durationHours = body.accountAction === 'suspend' ? Number(body.durationHours) : null;
      await restJson(env, '/rest/v1/rpc/control_manage_account', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_user: body.userId,
          target_action: body.accountAction,
          target_duration_hours: durationHours,
          target_reason: cleanText(body.reason, 500) || null
        })
      });
    } else {
      return withSession({ error: 'invalid_control_action' }, access.session, 400);
    }
    return withSession({
      ok: true,
      ...(await workspace(env, access)),
      generatedPromotionCode
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'control_workspace_write_failed' }, 400);
  }
}
