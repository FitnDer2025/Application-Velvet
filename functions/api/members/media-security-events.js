import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  withSession
} from './_shared.js';

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function serviceRest(env, path, init = {}) {
  const url = clean(env.SUPABASE_URL, 1000).replace(/\/$/, '');
  const key = clean(env.SUPABASE_SERVICE_ROLE_KEY, 4000);
  if (!url || !key) throw new Error('service_role_not_configured');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || payload?.code || 'service_request_failed');
  }
  return payload;
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const body = await readJson(request);
    const ownerProfileId = clean(body.ownerProfileId, 80);
    const mediaId = validUuid(body.mediaId) ? body.mediaId : ownerProfileId;
    const eventType = body.eventType === 'screen_recording' ? 'screen_recording' : 'screenshot';

    if (!validUuid(ownerProfileId)) {
      return withSession({ error: 'owner_profile_required' }, access.session, 400);
    }
    if (ownerProfileId === admission.admission.id) {
      return withSession({ ok: true, ignored: 'own_media' }, access.session);
    }

    const [ownerMembers, viewerProfiles] = await Promise.all([
      serviceRest(
        env,
        `/rest/v1/profile_members?select=user_id&profile_id=eq.${encodeURIComponent(ownerProfileId)}&status=eq.active`
      ),
      serviceRest(
        env,
        `/rest/v1/member_profiles?select=id,display_name&id=eq.${encodeURIComponent(admission.admission.id)}&limit=1`
      )
    ]);

    const viewerName = clean(viewerProfiles?.[0]?.display_name, 120) || 'Un membre Velvet';
    const ownerUserIds = [...new Set((ownerMembers || [])
      .map((row) => row.user_id)
      .filter((userId) => userId && userId !== access.account.userId))];

    if (!ownerUserIds.length) {
      return withSession({ error: 'media_owner_unavailable' }, access.session, 404);
    }

    const entityId = validUuid(mediaId) ? mediaId : ownerProfileId;
    const ownerBody = eventType === 'screen_recording'
      ? `${viewerName} a tenté d’enregistrer l’écran pendant l’affichage d’une de vos photos.`
      : `${viewerName} a effectué une capture d’écran pendant l’affichage d’une de vos photos.`;

    const rows = [
      ...ownerUserIds.map((userId) => ({
        user_id: userId,
        actor_profile_id: admission.admission.id,
        event_type: 'security',
        entity_type: 'media_capture',
        entity_id: entityId,
        title: eventType === 'screen_recording' ? 'Enregistrement d’écran détecté' : 'Capture d’écran détectée',
        body: ownerBody
      })),
      {
        user_id: access.account.userId,
        actor_profile_id: ownerProfileId,
        event_type: 'security',
        entity_type: 'media_capture',
        entity_id: entityId,
        title: 'Capture signalée',
        body: 'Le propriétaire de la photo a été prévenu par Velvet. Toute diffusion sans consentement peut entraîner la suspension du compte.'
      }
    ];

    await serviceRest(env, '/rest/v1/member_notifications', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(rows)
    });

    return withSession({
      ok: true,
      ownerNotified: true,
      warning: 'Le propriétaire de la photo a été prévenu.'
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'media_security_event_failed' }, 400);
  }
}
