import {
  accountContext,
  json,
  refreshSession,
  sessionResponse,
  supabase
} from '../auth/_shared.js';

export async function memberSession(request, env) {
  const session = await refreshSession(request, env);
  if (!session) return { response: json({ error: 'authentication_required' }, 401) };
  const account = await accountContext(env, session);
  if (!account || account.status !== 'active') {
    return { response: json({ error: 'member_access_required' }, 403) };
  }
  return { session, account };
}

export async function memberAdmission(env, access) {
  const rows = await restJson(
    env,
    `/rest/v1/member_profiles?select=id,profile_type,admission_status,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
    access.session
  );
  return rows?.[0] || null;
}

export async function requireAdmittedMember(env, access) {
  const admission = await memberAdmission(env, access);
  if (!admission || admission.admission_status !== 'approved') {
    return {
      admission,
      response: withSession({
        error: 'photo_admission_required',
        admission
      }, access.session, 403)
    };
  }
  return { admission };
}

export function monetizationMigrationMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('member_access_snapshot')
    || message.includes('consume_my_profile_ai')
    || message.includes('set_my_profile_favorite')
    || message.includes('redeem_my_promotion')
    || message.includes('pgrst202')
    || message.includes('schema cache');
}

export function betaFullAccess(profileId = null) {
  return {
    profileId,
    tier: 'beta_full',
    planCode: 'member_signature',
    source: 'migration_pending',
    validUntil: null,
    migrationPending: true,
    features: {
      advancedSearch: true,
      savedSearches: true,
      newConversationsPerWeek: null,
      newConversationsUsed: 0,
      followLimit: null,
      followingUsed: 0,
      profileAiLimit: null,
      profileAiUsed: 0,
      profileAiPeriod: 'beta',
      followConnectionAlerts: true,
      personalizedAlerts: true
    }
  };
}

export async function memberAccessState(env, access) {
  try {
    const result = await restJson(
      env,
      '/rest/v1/rpc/member_access_snapshot',
      access.session,
      { method: 'POST', body: '{}' }
    );
    return result || betaFullAccess();
  } catch (error) {
    if (monetizationMigrationMissing(error)) return betaFullAccess();
    throw error;
  }
}

export async function restJson(env, path, session, init = {}) {
  const response = await supabase(env, path, init, session.access_token);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message || payload?.hint || payload?.code || 'supabase_request_failed';
    throw new Error(detail);
  }
  return payload;
}

export function withSession(payload, session, status = 200) {
  return sessionResponse(payload, session, status);
}

export function cleanText(value, max = 2000) {
  const result = String(value ?? '').trim();
  return result.slice(0, max);
}

export function cleanList(value, maxItems = 30, maxLength = 80) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(source
    .map((item) => String(item).trim().slice(0, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}
