import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
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
    const conversationId = new URL(request.url).searchParams.get('conversationId');
    if (!validUuid(conversationId)) return json({ error: 'invalid_conversation' }, 400);
    const messages = await restJson(
      env,
      `/rest/v1/messages?select=id,conversation_id,sender_user_id,sender_identity,body,created_at,edited_at&conversation_id=eq.${conversationId}&deleted_at=is.null&order=created_at.asc&limit=500`,
      access.session
    );
    return withSession({ messages, currentUserId: access.account.userId }, access.session);
  } catch (error) {
    return json({ error: error.message || 'messages_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const conversationId = String(body.conversationId || '');
    const message = cleanText(body.body, 10000);
    if (!validUuid(conversationId) || !message) {
      return json({ error: 'message_required' }, 400);
    }
    const created = await restJson(
      env,
      '/rest/v1/messages?select=id,conversation_id,sender_user_id,sender_identity,body,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          conversation_id: conversationId,
          sender_user_id: access.account.userId,
          body: message
        })
      }
    );
    return withSession({ ok: true, message: created?.[0] }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'message_send_failed' }, 400);
  }
}
