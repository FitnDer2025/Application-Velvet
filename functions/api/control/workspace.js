import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from '../members/_shared.js';
import { signedMediaUrl } from '../members/media.js';

const CONTROL_ROLES = new Set(['admin', 'direction', 'moderator', 'support', 'auditor']);
const MEDIA_REVIEW_ROLES = new Set(['admin', 'direction', 'moderator']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const access = await memberSession(request, env);
  if (access.response) return access;
  if (!access.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return { response: json({ error: 'control_access_required' }, 403) };
  }
  return access;
}

async function workspace(env, access) {
  const canReviewMedia = access.account.roles.some((role) => MEDIA_REVIEW_ROLES.has(role));
  const [accounts, profiles, establishments, venueDirectory, staff, events, registrations, organizers, reports, audits, releaseChecks, pendingMediaRows] = await Promise.all([
    restJson(env, '/rest/v1/rpc/control_accounts', access.session, { method: 'POST', body: '{}' }),
    restJson(env, '/rest/v1/member_profiles?select=id,profile_type,display_name,admission_status,verification_status,visibility,created_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/establishments?select=id,directory_venue_id,slug,name,kind,city,visibility,subscription_status,verified_at,created_at,updated_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/venue_directory?select=id,slug,name,kind,city,country_code,claim_status,claimed_establishment_id,manual_review_required&public_visibility=eq.listed&verification_status=neq.closed&order=name.asc&limit=500', access.session),
    restJson(env, '/rest/v1/establishment_staff?select=establishment_id,user_id,staff_role,status,created_at&limit=1000', access.session),
    restJson(env, '/rest/v1/events?select=id,establishment_id,organizer_profile_id,owner_type,title,starts_at,capacity,visibility,created_at&order=starts_at.desc&limit=1000', access.session),
    restJson(env, '/rest/v1/event_registrations?select=id,event_id,user_id,places,status,created_at&order=created_at.desc&limit=2000', access.session),
    restJson(env, '/rest/v1/organizer_requests?select=id,user_id,member_profile_id,message,status,reviewed_by,reviewed_at,created_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/reports?select=id,reporter_user_id,subject_type,subject_id,category,description,status,created_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/audit_events?select=sequence_number,actor_user_id,action,entity_type,entity_id,occurred_at&order=sequence_number.desc&limit=100', access.session),
    restJson(env, '/rest/v1/rpc/control_beta_release_checks', access.session, { method: 'POST', body: '{}' }),
    canReviewMedia
      ? restJson(env, '/rest/v1/media_assets?select=id,profile_id,album_id,individual_profile_id,owner_user_id,media_role,media_type,visibility,storage_path,moderation_status,ai_assessment,rejection_reason,ai_reviewed_at,created_at,member_profiles(display_name,profile_type),albums(name,confidentiality)&moderation_status=eq.pending&order=created_at.asc&limit=250', access.session)
      : Promise.resolve([])
  ]);
  const pendingMedia = await Promise.all((pendingMediaRows || []).map(async (media) => ({
    ...media,
    previewUrl: await signedMediaUrl(env, access.session, media.storage_path, 300)
  })));
  const monetizationResults = await Promise.allSettled([
    restJson(env, '/rest/v1/promotion_campaigns?select=id,name,distribution_mode,subject_type,entitlement_code,target_audience,duration_days,starts_at,ends_at,max_redemptions,redemption_count,per_subject_limit,active,created_at&order=created_at.desc&limit=250', access.session),
    restJson(env, '/rest/v1/billing_plans?select=code,label,audience,features,active&order=code.asc', access.session),
    restJson(env, '/rest/v1/billing_prices?select=id,plan_code,price_code,currency,amount_cents,interval_unit,interval_count,active&order=amount_cents.asc', access.session)
  ]);
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
    mediaReviewAllowed: canReviewMedia,
    promotions: monetizationResults[0].status === 'fulfilled' ? monetizationResults[0].value : [],
    billingPlans: monetizationResults[1].status === 'fulfilled' ? monetizationResults[1].value : [],
    billingPrices: monetizationResults[2].status === 'fulfilled' ? monetizationResults[2].value : [],
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
    if (body.action === 'create_establishment') {
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
      if (!UUID.test(body.venueId || '') || !['inactive','trial','active','past_due','cancelled'].includes(body.status)) {
        return withSession({ error: 'invalid_subscription_status' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_set_establishment_subscription', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_establishment: body.venueId, target_status: body.status })
      });
    } else if (body.action === 'decide_media' || body.action === 'decide_profile_photo') {
      if (!UUID.test(body.mediaId || '') || !['approved','rejected'].includes(body.decision)) {
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
      if (!UUID.test(body.campaignId || '')) {
        return withSession({ error: 'invalid_promotion' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_set_promotion_active', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_campaign: body.campaignId,
          target_active: Boolean(body.active)
        })
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
      const durationDays = body.mode === 'signature' && body.durationDays
        ? Number(body.durationDays)
        : null;
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
      const durationHours = body.accountAction === 'suspend'
        ? Number(body.durationHours)
        : null;
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
