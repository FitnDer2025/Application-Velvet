import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  restJson,
  withSession
} from './_shared.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVACY_MODES = new Set(['public', 'private', 'invisible']);
const WITHDRAWABLE_CONSENTS = new Set([
  'sensitive_profile',
  'precise_location',
  'marketing_velvet',
  'marketing_partners'
]);
const RIGHTS = new Set([
  'access',
  'portability',
  'rectification',
  'erasure',
  'restriction',
  'objection',
  'withdraw_consent'
]);

async function privacyState(env, access) {
  const [profiles, consentState, requests, grants] = await Promise.all([
    restJson(
      env,
      `/rest/v1/member_profiles?select=id,display_name,privacy_mode,visibility,lifecycle_state,updated_at,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
      access.session
    ),
    restJson(env, '/rest/v1/rpc/my_consent_state', access.session, {
      method: 'POST',
      body: '{}'
    }),
    restJson(
      env,
      `/rest/v1/data_subject_requests?select=id,request_type,status,requested_at,due_at,deadline_extended_to,completed_at,decision_reason&user_id=eq.${encodeURIComponent(access.account.userId)}&order=requested_at.desc&limit=20`,
      access.session
    ),
    restJson(
      env,
      '/rest/v1/profile_visibility_grants?select=owner_profile_id,viewer_profile_id,granted_at,expires_at,revoked_at&order=granted_at.desc&limit=100',
      access.session
    ).catch(() => [])
  ]);
  return {
    profile: profiles?.[0] || null,
    consents: consentState || {},
    requests: requests || [],
    visibilityGrants: grants || []
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    return withSession(await privacyState(env, access), access.session);
  } catch (error) {
    return json({ error: error.message || 'privacy_state_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);

    if (body.action === 'set_profile_mode') {
      const mode = String(body.mode || '');
      if (!PRIVACY_MODES.has(mode)) {
        return withSession({ error: 'invalid_privacy_mode' }, access.session, 400);
      }
      const consents = await restJson(env, '/rest/v1/rpc/my_consent_state', access.session, {
        method: 'POST',
        body: '{}'
      });
      if (mode !== 'invisible' && consents?.sensitive_profile !== true) {
        return withSession({ error: 'sensitive_profile_consent_required' }, access.session, 409);
      }
      await restJson(env, '/rest/v1/rpc/set_my_profile_privacy_mode', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_mode: mode })
      });
    } else if (body.action === 'withdraw_consent') {
      const purpose = String(body.purpose || '');
      if (!WITHDRAWABLE_CONSENTS.has(purpose) || body.confirm !== true) {
        return withSession({ error: 'explicit_withdrawal_confirmation_required' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/withdraw_my_consent', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_purpose: purpose })
      });
    } else if (body.action === 'grant_sensitive_consent') {
      if (body.confirm !== true) {
        return withSession({ error: 'explicit_sensitive_consent_required' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/grant_my_sensitive_profile_consent', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_document_version: 'velvet-sensitive-profile-v2-2026-07-31',
          target_evidence: {
            interface: 'privacy_center',
            statementDisplayed: true
          }
        })
      });
    } else if (body.action === 'request_right') {
      const requestType = String(body.requestType || '');
      if (!RIGHTS.has(requestType)) {
        return withSession({ error: 'invalid_data_subject_request' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/create_my_data_subject_request', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_type: requestType,
          target_details: cleanText(body.details, 4000) || null
        })
      });
    } else if (body.action === 'grant_private_profile') {
      const viewerProfileId = String(body.viewerProfileId || '');
      const durationHours = body.durationHours === null || body.durationHours === undefined
        ? null
        : Number(body.durationHours);
      if (!UUID.test(viewerProfileId)
        || (durationHours !== null && (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 720))) {
        return withSession({ error: 'invalid_visibility_grant' }, access.session, 400);
      }
      const profiles = await restJson(
        env,
        `/rest/v1/member_profiles?select=id,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
        access.session
      );
      const ownerProfileId = profiles?.[0]?.id;
      if (!ownerProfileId || ownerProfileId === viewerProfileId) {
        return withSession({ error: 'invalid_visibility_grant' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/profile_visibility_grants?on_conflict=owner_profile_id,viewer_profile_id', access.session, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          owner_profile_id: ownerProfileId,
          viewer_profile_id: viewerProfileId,
          granted_by: access.account.userId,
          granted_at: new Date().toISOString(),
          expires_at: durationHours === null
            ? null
            : new Date(Date.now() + durationHours * 3600_000).toISOString(),
          revoked_at: null
        })
      });
    } else if (body.action === 'revoke_private_profile') {
      const viewerProfileId = String(body.viewerProfileId || '');
      if (!UUID.test(viewerProfileId)) {
        return withSession({ error: 'invalid_visibility_grant' }, access.session, 400);
      }
      const profiles = await restJson(
        env,
        `/rest/v1/member_profiles?select=id,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
        access.session
      );
      const ownerProfileId = profiles?.[0]?.id;
      await restJson(
        env,
        `/rest/v1/profile_visibility_grants?owner_profile_id=eq.${encodeURIComponent(ownerProfileId)}&viewer_profile_id=eq.${encodeURIComponent(viewerProfileId)}`,
        access.session,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ revoked_at: new Date().toISOString() })
        }
      );
    } else {
      return withSession({ error: 'invalid_privacy_action' }, access.session, 400);
    }

    return withSession({ ok: true, ...(await privacyState(env, access)) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'privacy_action_failed' }, 400);
  }
}
