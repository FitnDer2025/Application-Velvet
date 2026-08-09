import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

const DURATIONS = new Set([1,4,12,24]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const albumIds = [...new Set(
      (Array.isArray(body.albumIds) ? body.albumIds : [body.albumId]).filter((id) => UUID.test(id))
    )].slice(0, 30);
    if (!UUID.test(body.profileId) || !albumIds.length) {
      return json({ error: 'target_profile_and_albums_required' }, 400);
    }
    const results = await Promise.all(albumIds.map((albumId) => restJson(
      env,
      '/rest/v1/rpc/grant_private_album_to_profile',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          target_album_id: albumId,
          target_profile_id: body.profileId,
          duration_hours: duration
        })
      }
    )));
    return withSession({
      ok: true,
      albumIds,
      grantedAccounts: [...new Set(results.flat())]
    }, access.session);
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
