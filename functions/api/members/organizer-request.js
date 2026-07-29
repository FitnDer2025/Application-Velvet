import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const rows = await restJson(
      env,
      `/rest/v1/organizer_requests?select=id,status,message,created_at,reviewed_at&user_id=eq.${encodeURIComponent(access.account.userId)}&order=created_at.desc&limit=1`,
      access.session
    );
    return withSession({ request: rows?.[0] || null }, access.session);
  } catch (error) {
    return json({ error: error.message || 'organizer_request_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const profiles = await restJson(
      env,
      `/rest/v1/member_profiles?select=id&created_by=eq.${encodeURIComponent(access.account.userId)}&limit=1`,
      access.session
    );
    if (!profiles?.[0]) return json({ error: 'profile_required' }, 409);

    const existing = await restJson(
      env,
      `/rest/v1/organizer_requests?select=id,status&user_id=eq.${encodeURIComponent(access.account.userId)}&status=eq.pending&limit=1`,
      access.session
    );
    if (existing?.[0]) return json({ error: 'organizer_request_already_pending' }, 409);

    const created = await restJson(
      env,
      '/rest/v1/organizer_requests?select=id,status,message,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: access.account.userId,
          member_profile_id: profiles[0].id,
          message: cleanText(body.message, 2000),
          status: 'pending'
        })
      }
    );
    const savedRequest = created?.[0];
    if (!savedRequest?.id || savedRequest.status !== 'pending') {
      throw new Error('organizer_request_persistence_failed');
    }
    return withSession({ ok: true, request: savedRequest }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'organizer_request_failed' }, 400);
  }
}
