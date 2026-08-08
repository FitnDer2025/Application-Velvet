import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { enrichProfileMedia } from './media.js';

const LEVELS = ['public','request','trusted_circle','private_circle','favorites','temporary'];
const ALBUM_SELECT = [
  'id',
  'name',
  'confidentiality',
  'expires_at',
  'created_at',
  'media_assets(id,owner_user_id,media_type,media_role,storage_path,moderation_status,created_at)',
  'album_access_grants(grantee_user_id,grantee_profile_id,granted_at,expires_at,revoked_at)'
].join(',');

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const rows = await restJson(
      env,
      `/rest/v1/albums?select=${encodeURIComponent(ALBUM_SELECT)}&profile_id=eq.${encodeURIComponent(admission.admission.id)}&order=created_at.desc`,
      access.session
    );
    const enriched = await enrichProfileMedia(env, access.session, { albums: rows || [] });
    return withSession({ albums: enriched.albums || [] }, access.session);
  } catch (error) {
    return json({ error: error.message || 'album_read_failed' }, 400);
  }
}

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
