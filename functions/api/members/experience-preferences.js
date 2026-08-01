import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

const SORTS = new Set(['distance', 'compatibility', 'recent', 'affinity']);

function normalizeRadius(value) {
  const radius = Number(value);
  if (!Number.isFinite(radius)) return 50;
  return Math.max(10, Math.min(200, Math.round(radius / 5) * 5));
}

function normalizeSort(value) {
  const sort = String(value || '');
  return SORTS.has(sort) ? sort : 'distance';
}

async function readPreferences(env, access) {
  const rows = await restJson(
    env,
    `/rest/v1/member_experience_preferences?select=user_id,discovery_radius_km,profile_sort,ai_personalization_enabled,updated_at&user_id=eq.${encodeURIComponent(access.account.userId)}&limit=1`,
    access.session
  );
  return rows?.[0] || {
    user_id: access.account.userId,
    discovery_radius_km: 50,
    profile_sort: 'distance',
    ai_personalization_enabled: true,
    updated_at: null
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    return withSession({ preferences: await readPreferences(env, access) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'experience_preferences_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    await restJson(
      env,
      '/rest/v1/member_experience_preferences?on_conflict=user_id',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: access.account.userId,
          discovery_radius_km: normalizeRadius(body.discoveryRadiusKm ?? body.discovery_radius_km),
          profile_sort: normalizeSort(body.profileSort ?? body.profile_sort),
          ai_personalization_enabled: (body.aiPersonalizationEnabled ?? body.ai_personalization_enabled) !== false,
          updated_at: new Date().toISOString()
        })
      }
    );
    return withSession({ ok: true, preferences: await readPreferences(env, access) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'experience_preferences_write_failed' }, 400);
  }
}
