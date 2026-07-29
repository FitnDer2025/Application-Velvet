import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

const LEVELS = ['public','request','trusted_circle','private_circle','favorites','temporary'];

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const name = cleanText(body.name, 120);
    const confidentiality = LEVELS.includes(body.confidentiality)
      ? body.confidentiality
      : 'request';
    if (!name) return json({ error: 'album_name_required' }, 400);
    const created = await restJson(
      env,
      '/rest/v1/albums?select=id,name,confidentiality,expires_at,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          profile_id: admission.admission.id,
          name,
          confidentiality,
          created_by: access.account.userId
        })
      }
    );
    const album = created?.[0];
    if (!album?.id || album.name !== name || album.confidentiality !== confidentiality) {
      throw new Error('album_persistence_failed');
    }
    return withSession({ ok: true, album }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'album_creation_failed' }, 400);
  }
}
