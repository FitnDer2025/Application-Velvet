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

async function ownProfile(env, session, userId) {
  const rows = await restJson(
    env,
    `/rest/v1/member_profiles?select=id,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(userId)}&profile_members.status=eq.active&limit=1`,
    session
  );
  return rows?.[0] || null;
}

async function readSettings(env, session, userId, profileId) {
  const [privacyRows, notificationRows] = await Promise.all([
    restJson(
      env,
      `/rest/v1/profile_privacy_settings?select=profile_id,discoverable_by,contactable_by,updated_at&profile_id=eq.${encodeURIComponent(profileId)}&limit=1`,
      session
    ),
    restJson(
      env,
      `/rest/v1/member_notification_settings?select=user_id,notify_from,event_types,in_app_enabled,browser_enabled,email_enabled,quiet_hours_start,quiet_hours_end,updated_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      session
    )
  ]);

  return {
    privacy: privacyRows?.[0] || {
      profile_id: profileId,
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
    }
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const profile = await ownProfile(env, access.session, access.account.userId);
    if (!profile) return withSession({ error: 'profile_required' }, access.session, 409);
    return withSession(
      await readSettings(env, access.session, access.account.userId, profile.id),
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
      )
    ]);

    return withSession({
      ok: true,
      ...(await readSettings(env, access.session, access.account.userId, profile.id))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'settings_write_failed' }, 400);
  }
}
