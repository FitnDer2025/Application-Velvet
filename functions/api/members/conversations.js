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

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const profileId = String(body.profileId || '');
    if (!validUuid(profileId)) return withSession({ error: 'invalid_target_profile' }, access.session, 400);
    const result = await restJson(
      env,
      '/rest/v1/rpc/start_direct_profile_conversation',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({ target_profile_id: profileId })
      }
    );
    const conversationId = Array.isArray(result) ? result[0] : result;
    if (!validUuid(conversationId)) throw new Error('conversation_persistence_failed');
    return withSession({ ok: true, conversationId }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'conversation_start_failed' }, 400);
  }
}

