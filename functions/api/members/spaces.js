import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, requireAdmittedMember, restJson, withSession } from './_shared.js';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function rpc(env, access, name, body = {}) {
  return restJson(env, `/rest/v1/rpc/${name}`, access.session, {
    method: 'POST', body: JSON.stringify(body)
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const url = new URL(request.url);
    const spaceId = url.searchParams.get('spaceId') || '';
    const afterMessageId = Math.max(0, Number(url.searchParams.get('afterMessageId') || 0));
    if (!spaceId) {
      const spaces = await rpc(env, access, 'zwit_v15_my_spaces');
      return withSession({ spaces }, access.session);
    }
    if (!validUuid(spaceId)) return withSession({ error: 'invalid_space' }, access.session, 400);
    const [messages, members] = await Promise.all([
      rpc(env, access, 'zwit_v15_space_messages', { target_space_id: spaceId, after_message_id: afterMessageId }),
      rpc(env, access, 'zwit_v15_space_members', { target_space_id: spaceId })
    ]);
    return withSession({ spaceId, messages, members }, access.session);
  } catch (error) {
    return json({ error: cleanText(error.message, 120) || 'space_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const action = cleanText(body.action, 30);

    if (action === 'create_circle') {
      const title = cleanText(body.title, 80);
      const description = cleanText(body.description, 500);
      if (!title) return withSession({ error: 'invalid_circle_title' }, access.session, 400);
      const id = await rpc(env, access, 'zwit_v15_create_circle', { target_title: title, target_description: description || null });
      return withSession({ ok: true, spaceId: Array.isArray(id) ? id[0] : id }, access.session, 201);
    }

    if (action === 'invite_profile') {
      const spaceId = String(body.spaceId || '');
      const profileId = String(body.profileId || '');
      if (!validUuid(spaceId) || !validUuid(profileId)) return withSession({ error: 'invalid_circle_invite' }, access.session, 400);
      const invited = await rpc(env, access, 'zwit_v15_invite_circle_profile', { target_space_id: spaceId, target_profile_id: profileId });
      return withSession({ ok: true, invitedAccounts: Number(Array.isArray(invited) ? invited[0] : invited || 0) }, access.session, 201);
    }

    if (action === 'accept_invite') {
      const spaceId = String(body.spaceId || '');
      if (!validUuid(spaceId)) return withSession({ error: 'invalid_space' }, access.session, 400);
      await rpc(env, access, 'zwit_v15_accept_space_invite', { target_space_id: spaceId });
      return withSession({ ok: true }, access.session);
    }

    if (action === 'event_chat') {
      const eventId = String(body.eventId || '');
      if (!validUuid(eventId)) return withSession({ error: 'invalid_event' }, access.session, 400);
      const id = await rpc(env, access, 'zwit_v15_event_chat', { target_event_id: eventId });
      return withSession({ ok: true, spaceId: Array.isArray(id) ? id[0] : id }, access.session, 201);
    }

    if (action === 'send') {
      const spaceId = String(body.spaceId || '');
      const message = cleanText(body.message, 4000);
      if (!validUuid(spaceId) || !message) return withSession({ error: 'invalid_space_message' }, access.session, 400);
      const id = await rpc(env, access, 'zwit_v15_send_space_message', { target_space_id: spaceId, target_body: message });
      return withSession({ ok: true, messageId: Number(Array.isArray(id) ? id[0] : id || 0) }, access.session, 201);
    }

    if (action === 'leave') {
      const spaceId = String(body.spaceId || '');
      if (!validUuid(spaceId)) return withSession({ error: 'invalid_space' }, access.session, 400);
      await rpc(env, access, 'zwit_v15_leave_space', { target_space_id: spaceId });
      return withSession({ ok: true }, access.session);
    }

    if (action === 'report') {
      const spaceId = String(body.spaceId || '');
      const messageId = Number(body.messageId || 0);
      const reason = cleanText(body.reason, 500);
      if (!validUuid(spaceId) || !Number.isSafeInteger(messageId) || messageId <= 0 || reason.length < 2) {
        return withSession({ error: 'invalid_space_report' }, access.session, 400);
      }
      const report = await rpc(env, access, 'zwit_v15_report_space_message', {
        target_space_id: spaceId, target_message_id: messageId, target_reason: reason
      });
      return withSession({ ok: true, reportId: Array.isArray(report) ? report[0] : report }, access.session, 201);
    }

    return withSession({ error: 'invalid_space_action' }, access.session, 400);
  } catch (error) {
    return json({ error: cleanText(error.message, 120) || 'space_action_failed' }, 400);
  }
}
