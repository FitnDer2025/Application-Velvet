import { json, readJson } from '../auth/_shared.js';
import { memberSession, requireAdmittedMember, restJson, withSession } from './_shared.js';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const rows = await restJson(
      env,
      `/rest/v1/member_recommendation_feedback?select=entity_type,entity_id,signal,updated_at&user_id=eq.${encodeURIComponent(access.account.userId)}&order=updated_at.desc&limit=200`,
      access.session
    ).catch(() => []);
    return withSession({ feedback: rows }, access.session);
  } catch (error) {
    return json({ error: error.message || 'recommendation_feedback_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const entityType = ['profile', 'event', 'venue'].includes(body.entityType) ? body.entityType : '';
    const entityId = String(body.entityId || '');
    const signal = ['more_like_this', 'dismiss'].includes(body.signal) ? body.signal : '';
    if (!entityType || !validUuid(entityId) || !signal) {
      return withSession({ error: 'invalid_recommendation_feedback' }, access.session, 400);
    }
    const rows = await restJson(env, '/rest/v1/rpc/set_my_recommendation_feedback', access.session, {
      method: 'POST',
      body: JSON.stringify({
        target_entity_type: entityType,
        target_entity_id: entityId,
        target_signal: signal
      })
    });
    return withSession({ ok: true, feedback: rows?.[0] || null }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'recommendation_feedback_failed' }, 400);
  }
}
