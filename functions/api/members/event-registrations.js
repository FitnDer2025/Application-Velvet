import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const eventId = new URL(request.url).searchParams.get('eventId') || '';
    if (!validUuid(eventId)) return withSession({ error: 'invalid_event' }, access.session, 400);
    const registrations = await restJson(
      env,
      `/rest/v1/event_registrations?select=id,event_id,user_id,places,status,visible_to_participants,created_at,updated_at&event_id=eq.${encodeURIComponent(eventId)}&status=in.(pending,confirmed,waitlisted,checked_in)&order=created_at.asc`,
      access.session
    );
    return withSession({
      registrations,
      currentUserId: access.account.userId
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'event_registrations_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const eventId = String(body.eventId || '');
    if (!validUuid(eventId)) return withSession({ error: 'invalid_event' }, access.session, 400);

    if (body.action === 'cancel') {
      await restJson(env, '/rest/v1/rpc/cancel_my_event_registration', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_event_id: eventId })
      });
      return withSession({ ok: true, status: 'cancelled' }, access.session);
    }

    const result = await restJson(env, '/rest/v1/rpc/register_for_event', access.session, {
      method: 'POST',
      body: JSON.stringify({
        target_event_id: eventId,
        requested_places: Number(body.places || 1),
        show_to_participants: body.visibleToParticipants !== false
      })
    });
    return withSession({
      ok: true,
      registration: result?.[0] || null
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'event_registration_failed' }, 400);
  }
}

