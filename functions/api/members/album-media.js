import { json, supabase } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import {
  analyzePublicAlbumPhoto,
  signDecision
} from './photos.js';

const ALLOWED_TYPES = new Map([
  ['image/jpeg','jpg'],
  ['image/png','png'],
  ['image/webp','webp']
]);
const MAX_BYTES = 4 * 1024 * 1024;

async function ownedAlbum(env, access, albumId, profileId) {
  const rows = await restJson(
    env,
    `/rest/v1/albums?select=id,profile_id,confidentiality&profile_id=eq.${encodeURIComponent(profileId)}&id=eq.${encodeURIComponent(albumId)}&limit=1`,
    access.session
  );
  return rows?.[0] || null;
}

export async function onRequestPost({ request, env }) {
  let uploadedPath = null;
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const form = await request.formData();
    const file = form.get('photo');
    const albumId = String(form.get('albumId') || '');
    if (!(file instanceof File) || !albumId) {
      return json({ error: 'photo_and_album_required' }, 400);
    }
    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension || file.size < 20_000 || file.size > MAX_BYTES) {
      return json({ error: 'invalid_photo_file' }, 400);
    }
    const album = await ownedAlbum(env, access, albumId, admission.admission.id);
    if (!album) return json({ error: 'album_owner_required' }, 403);

    const bytes = new Uint8Array(await file.arrayBuffer());
    uploadedPath = `${album.profile_id}/${access.account.userId}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase(
      env,
      `/storage/v1/object/velvet-media/${uploadedPath}`,
      {
        method: 'POST',
        headers: {
          'content-type': file.type,
          'x-upsert': 'false'
        },
        body: bytes
      },
      access.session.access_token
    );
    if (!upload.ok) throw new Error('photo_storage_failed');

    const created = await restJson(
      env,
      '/rest/v1/media_assets?select=id,profile_id,album_id,owner_user_id,media_role,storage_path,visibility,moderation_status,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          profile_id: album.profile_id,
          album_id: album.id,
          owner_user_id: access.account.userId,
          storage_path: uploadedPath,
          media_type: 'image',
          visibility: album.confidentiality === 'public' ? 'profile' : 'private',
          moderation_status: 'pending',
          media_role: 'album',
          is_primary: false
        })
      }
    );
    const photo = created?.[0];

    if (album.confidentiality === 'public') {
      try {
        const analyzed = await analyzePublicAlbumPhoto(env, bytes);
        const signedAt = Math.floor(Date.now() / 1000);
        const signature = await signDecision(
          String(env.PHOTO_MODERATION_HMAC_KEY || ''),
          photo.id,
          analyzed.decision,
          signedAt
        );
        await restJson(
          env,
          '/rest/v1/rpc/record_photo_ai_decision',
          access.session,
          {
            method: 'POST',
            body: JSON.stringify({
              target_media_id: photo.id,
              decision: analyzed.decision,
              assessment: analyzed.assessment,
              signed_at: signedAt,
              signature
            })
          }
        );
      } catch {
        // Le média reste privé et en attente si l'analyse n'aboutit pas.
      }
    }

    return withSession({ ok: true, photo }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'album_photo_upload_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const id = new URL(request.url).searchParams.get('id') || '';
    const rows = await restJson(
      env,
      `/rest/v1/media_assets?select=id,profile_id,storage_path&profile_id=eq.${encodeURIComponent(admission.admission.id)}&owner_user_id=eq.${access.account.userId}&id=eq.${encodeURIComponent(id)}&media_role=eq.album&limit=1`,
      access.session
    );
    const photo = rows?.[0];
    if (!photo) return json({ error: 'photo_not_found' }, 404);
    const storageResponse = await supabase(
      env,
      `/storage/v1/object/velvet-media/${photo.storage_path}`,
      { method: 'DELETE' },
      access.session.access_token
    );
    if (!storageResponse.ok && storageResponse.status !== 404) {
      return json({ error: 'photo_storage_delete_failed' }, 400);
    }
    await restJson(
      env,
      `/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}`,
      access.session,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
    return withSession({ ok: true }, access.session);
  } catch (error) {
    return json({ error: error.message || 'album_photo_delete_failed' }, 400);
  }
}
