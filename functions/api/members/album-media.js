import { json, supabase } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import {
  analyzePrivateAlbumPhoto,
  analyzePublicAlbumPhoto,
  mediaModerationPolicy,
  recordAiDecision,
  recordTechnicalReview
} from './photos.js';

const ALLOWED_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', mediaType: 'image', max: 4 * 1024 * 1024 }],
  ['image/png', { extension: 'png', mediaType: 'image', max: 4 * 1024 * 1024 }],
  ['image/webp', { extension: 'webp', mediaType: 'image', max: 4 * 1024 * 1024 }],
  ['video/mp4', { extension: 'mp4', mediaType: 'video', max: 50 * 1024 * 1024 }],
  ['video/webm', { extension: 'webm', mediaType: 'video', max: 50 * 1024 * 1024 }],
  ['video/quicktime', { extension: 'mov', mediaType: 'video', max: 50 * 1024 * 1024 }]
]);

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
  let cleanupSession = null;
  let createdMediaId = null;
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    cleanupSession = access.session;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const form = await request.formData();
    const file = form.get('photo');
    const albumId = String(form.get('albumId') || '');
    if (!(file instanceof File) || !albumId) {
      return json({ error: 'photo_and_album_required' }, 400);
    }
    const fileRule = ALLOWED_TYPES.get(file.type);
    if (!fileRule || file.size < 20_000 || file.size > fileRule.max) {
      return json({ error: 'invalid_album_media_file' }, 400);
    }
    const album = await ownedAlbum(env, access, albumId, admission.admission.id);
    if (!album) return json({ error: 'album_owner_required' }, 403);

    const bytes = new Uint8Array(await file.arrayBuffer());
    uploadedPath = `${album.profile_id}/${access.account.userId}/${crypto.randomUUID()}.${fileRule.extension}`;
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
      '/rest/v1/media_assets?select=id,profile_id,album_id,owner_user_id,media_role,media_type,storage_path,visibility,moderation_status,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          profile_id: album.profile_id,
          album_id: album.id,
          owner_user_id: access.account.userId,
          storage_path: uploadedPath,
          media_type: fileRule.mediaType,
          visibility: album.confidentiality === 'public' ? 'profile' : 'private',
          moderation_status: 'pending',
          media_role: 'album',
          is_primary: false
        })
      }
    );
    const photo = created?.[0];
    createdMediaId = photo?.id || null;
    if (!photo?.id || photo.storage_path !== uploadedPath) {
      throw new Error('photo_persistence_failed');
    }

    let moderationStatus = 'pending';
    let aiAssessment = null;
    try {
      const policy = await mediaModerationPolicy(env, access.session);
      const analyzed = fileRule.mediaType === 'video'
        ? null
        : album.confidentiality === 'public'
          ? await analyzePublicAlbumPhoto(env, bytes, policy)
          : await analyzePrivateAlbumPhoto(env, bytes, policy);
      if (!analyzed) throw new Error('video_visual_review_required');
      await recordAiDecision(env, access.session, photo.id, analyzed);
      moderationStatus = analyzed.decision === 'review' ? 'pending' : analyzed.decision;
      aiAssessment = analyzed.assessment;
    } catch (error) {
      aiAssessment = await recordTechnicalReview(
        env,
        access.session,
        photo.id,
        error,
        album.confidentiality === 'public' ? 'public_album' : 'private_album'
      ).catch(() => null);
    }

    return withSession({
      ok: true,
      photo: {
        ...photo,
        moderation_status: moderationStatus,
        ai_assessment: aiAssessment
      }
    }, access.session, 201);
  } catch (error) {
    if (createdMediaId && cleanupSession) {
      await restJson(
        env,
        `/rest/v1/media_assets?id=eq.${encodeURIComponent(createdMediaId)}`,
        cleanupSession,
        { method: 'DELETE', headers: { prefer: 'return=minimal' } }
      ).catch(() => null);
    }
    if (uploadedPath && cleanupSession) {
      await supabase(
        env,
        `/storage/v1/object/velvet-media/${uploadedPath}`,
        { method: 'DELETE' },
        cleanupSession.access_token
      ).catch(() => null);
    }
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
