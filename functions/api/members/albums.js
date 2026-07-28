import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  restJson,
  withSession
} from './_shared.js';

const LEVELS = ['request','trusted_circle','private_circle','favorites','temporary'];

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const name = cleanText(body.name, 120);
    const confidentiality = LEVELS.includes(body.confidentiality)
      ? body.confidentiality
      : 'request';
    if (!name) return json({ error: 'album_name_required' }, 400);
    const profiles = await restJson(
      env,
      `/rest/v1/member_profiles?select=id&created_by=eq.${encodeURIComponent(access.account.userId)}&limit=1`,
      access.session
    );
    if (!profiles?.[0]) return json({ error: 'profile_required' }, 409);
    const created = await restJson(
      env,
      '/rest/v1/albums?select=id,name,confidentiality,expires_at,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          profile_id: profiles[0].id,
          name,
          confidentiality,
          created_by: access.account.userId
        })
      }
    );
    return withSession({ ok: true, album: created?.[0] }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'album_creation_failed' }, 400);
  }
}
