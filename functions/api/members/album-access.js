import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

const DURATIONS = new Set([1,2,4,8,12,24]);

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const duration = body.duration === 'permanent' ? null : Number(body.duration);
    if (duration !== null && !DURATIONS.has(duration)) {
      return json({ error: 'invalid_album_access_duration' }, 400);
    }
    const result = await restJson(
      env,
      '/rest/v1/rpc/grant_private_album_to_profile',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          target_album_id: body.albumId,
          target_profile_id: body.profileId,
          duration_hours: duration
        })
      }
    );
    return withSession({ ok: true, grantedAccounts: result }, access.session);
  } catch (error) {
    return json({ error: error.message || 'album_access_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const url = new URL(request.url);
    const result = await restJson(
      env,
      '/rest/v1/rpc/revoke_private_album_from_profile',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          target_album_id: url.searchParams.get('albumId'),
          target_profile_id: url.searchParams.get('profileId')
        })
      }
    );
    return withSession({ ok: true, revokedAccounts: result }, access.session);
  } catch (error) {
    return json({ error: error.message || 'album_access_revoke_failed' }, 400);
  }
}
