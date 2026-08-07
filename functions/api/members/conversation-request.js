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

function publicState(row) {
  if (!row) return null;
  return {
    status: row.status || 'accepted',
    role: row.role || 'legacy',
    canSend: row.can_send !== false,
    introMessagesSent: Number(row.intro_messages_sent || 0),
    followUpAt: row.follow_up_at || null
  };
}

async function state(env, access, conversationId) {
  const rows = await restJson(env, '/rest/v1/rpc/zwit_v15_conversation_request_state', access.session, {
    method: 'POST',
    body: JSON.stringify({ target_conversation_id: conversationId })
  });
  return publicState(rows?.[0]);
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const conversationId = new URL(request.url).searchParams.get('conversationId') || '';
    if (!validUuid(conversationId)) return withSession({ error: 'invalid_conversation' }, access.session, 400);
    return withSession({ request: await state(env, access, conversationId) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'conversation_request_read_failed' }, 400);
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const conversationId = String(body.conversationId || '');
    const decision = body.decision === 'accept' ? 'accepted' : body.decision === 'decline' ? 'declined' : '';
    if (!validUuid(conversationId) || !decision) {
      return withSession({ error: 'invalid_request_decision' }, access.session, 400);
    }
    const rows = await restJson(env, '/rest/v1/rpc/zwit_v15_decide_conversation_request', access.session, {
      method: 'POST',
      body: JSON.stringify({ target_conversation_id: conversationId, decision })
    });
    return withSession({ ok: true, request: publicState(rows?.[0]) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'conversation_request_decision_failed' }, 400);
  }
}
