import { json, readJson } from '../auth/_shared.js';
import { memberSession, restJson, withSession } from './_shared.js';

const AUDIENCES = ['couple', 'woman', 'man', 'trans_nonbinary', 'other'];
const EVENT_TYPES = [
  'messages',
  'likes',
  'album_access',
  'profile_views',
  'events',
  'recommendations',
  'security'
];
const PROFILE_SORTS = new Set(['distance', 'compatibility', 'recent', 'affinity']);

const DEFAULT_EVENTS = Object.fromEntries(EVENT_TYPES.map((name) => [name, true]));

function allowedList(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.filter((item) => AUDIENCES.includes(item)))];
}

function allowedEvents(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(EVENT_TYPES.map((name) => [name, source[name] !== false]));
}

function safeTime(value) {
  const text = String(value || '');
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : null;
}

function safeRadius(value) {
  const radius = Number(value);
  if (!Number.isFinite(radius)) return 50;
  return Math.max(10, Math.min(200, Math.round(radius / 5) * 5));
}

function safeProfileSort(value) {
  const sort = String(value || '');
  return PROFILE_SORTS.has(sort) ? sort : 'distance';
}

async function ownProfile(env, session, userId) {
  const rows = await restJson(
    env,
    `/rest/v1/member_profiles?select=id,verification_status,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(userId)}&profile_members.status=eq.active&limit=1`,
    session
  );
  return rows?.[0] || null;
}

async function readSettings(env, session, userId, profile) {
  const [privacyRows, notificationRows, locationRows, verificationRows, experienceRows] = await Promise.all([
    restJson(
      env,
      `/rest/v1/profile_privacy_settings?select=profile_id,discoverable_by,contactable_by,updated_at&profile_id=eq.${encodeURIComponent(profile.id)}&limit=1`,
      session
    ),
    restJson(
      env,
      `/rest/v1/member_notification_settings?select=user_id,notify_from,event_types,in_app_enabled,browser_enabled,email_enabled,quiet_hours_start,quiet_hours_end,updated_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      session
    ),
    restJson(
      env,
      `/rest/v1/member_location_settings?select=user_id,enabled,precision_km,consented_at,last_used_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      session
    ),
    restJson(
      env,
      `/rest/v1/account_identity_age_verifications?select=user_id,provider,status,identity_verified,majority_verified,verified_at,expires_at,last_checked_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      session
    ),
    restJson(
      env,
      `/rest/v1/member_experience_preferences?select=user_id,discovery_radius_km,profile_sort,ai_personalization_enabled,updated_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      session
    ).catch(() => [])
  ]);

  return {
    privacy: privacyRows?.[0] || {
      profile_id: profile.id,
      discoverable_by: [...AUDIENCES],
      contactable_by: [...AUDIENCES]
    },
    notifications: notificationRows?.[0] || {
      user_id: userId,
      notify_from: [...AUDIENCES],
      event_types: DEFAULT_EVENTS,
      in_app_enabled: true,
      browser_enabled: false,
      email_enabled: true,
      quiet_hours_start: null,
      quiet_hours_end: null
    },
    location: locationRows?.[0] || {
      user_id: userId,
      enabled: false,
      precision_km: 10,
      consented_at: null,
      last_used_at: null,
      updated_at: null
    },
    experience: experienceRows?.[0] || {
      user_id: userId,
      discovery_radius_km: 50,
      profile_sort: 'distance',
      ai_personalization_enabled: true,
      updated_at: null
    },
    verification: verificationRows?.[0] || {
      user_id: userId,
      provider: null,
      status: 'not_started',
      identity_verified: false,
      majority_verified: false,
      verified_at: null,
      expires_at: null,
      last_checked_at: null,
      updated_at: null
    },
    profileVerificationStatus: profile.verification_status || 'not_started',
    verificationProviderConfigured: Boolean(env.IDENTITY_AGE_VERIFICATION_START_URL),
    exactLocationStored: false,
    identityDocumentsStoredByVelvet: false,
    verificationBlocksAccess: false
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const profile = await ownProfile(env, access.session, access.account.userId);
    if (!profile) return withSession({ error: 'profile_required' }, access.session, 409);
    return withSession(
      await readSettings(env, access.session, access.account.userId, profile),
      access.session
    );
  } catch (error) {
    return json({ error: error.message || 'settings_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const profile = await ownProfile(env, access.session, access.account.userId);
    if (!profile) return withSession({ error: 'profile_required' }, access.session, 409);
    const body = await readJson(request);
    const discoverableBy = allowedList(body.discoverable_by);
    const contactableBy = allowedList(body.contactable_by);
    const notifyFrom = allowedList(body.notify_from);

    await Promise.all([
      restJson(
        env,
        '/rest/v1/profile_privacy_settings?on_conflict=profile_id',
        access.session,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            profile_id: profile.id,
            discoverable_by: discoverableBy,
            contactable_by: contactableBy,
            updated_by: access.account.userId
          })
        }
      ),
      restJson(
        env,
        '/rest/v1/member_notification_settings?on_conflict=user_id',
        access.session,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            user_id: access.account.userId,
            notify_from: notifyFrom,
            event_types: allowedEvents(body.event_types),
            in_app_enabled: body.in_app_enabled !== false,
            browser_enabled: body.browser_enabled === true,
            email_enabled: body.email_enabled !== false,
            quiet_hours_start: safeTime(body.quiet_hours_start),
            quiet_hours_end: safeTime(body.quiet_hours_end)
          })
        }
      ),
      restJson(
        env,
        '/rest/v1/member_experience_preferences?on_conflict=user_id',
        access.session,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            user_id: access.account.userId,
            discovery_radius_km: safeRadius(body.discovery_radius_km),
            profile_sort: safeProfileSort(body.profile_sort),
            ai_personalization_enabled: body.ai_personalization_enabled !== false,
            updated_at: new Date().toISOString()
          })
        }
      )
    ]);

    return withSession({
      ok: true,
      ...(await readSettings(env, access.session, access.account.userId, profile))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'settings_write_failed' }, 400);
  }
}
