import { json, supabase } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function publicPhotoState(env, access, profileId) {
  const rows = await restJson(
    env,
    `/rest/v1/media_assets?select=id&profile_id=eq.${encodeURIComponent(profileId)}&album_id=is.null&media_type=eq.image&media_role=in.(couple_gallery,individual_gallery)&moderation_status=eq.approved`,
    access.session
  );
  const count = rows?.length || 0;
  const ready = count >= 3;
  await restJson(
    env,
    '/rest/v1/rpc/sync_profile_photo_ready',
    access.session,
    {
      method: 'POST',
      body: JSON.stringify({ target_profile_id: profileId })
    }
  ).catch(() => null);
  return { count, ready };
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const mediaId = new URL(request.url).searchParams.get('id') || '';
    if (!validUuid(mediaId)) {
      return withSession({ error: 'invalid_photo' }, access.session, 400);
    }

    const profileId = admission.admission.id;
    const rows = await restJson(
      env,
      `/rest/v1/media_assets?select=id,profile_id,album_id,individual_profile_id,owner_user_id,storage_path,media_role,media_type&profile_id=eq.${encodeURIComponent(profileId)}&id=eq.${encodeURIComponent(mediaId)}&limit=1`,
      access.session
    );
    const media = rows?.[0];
    if (!media) return withSession({ error: 'photo_not_found' }, access.session, 404);

    // Un profil Couple est partagé : chaque compte actif lié au profil peut gérer
    // les médias de ce profil, même lorsque l'autre partenaire les a importés.
    const storageResponse = await supabase(
      env,
      `/storage/v1/object/velvet-media/${media.storage_path}`,
      { method: 'DELETE' },
      access.session.access_token
    );
    if (!storageResponse.ok && storageResponse.status !== 404) {
      return withSession({ error: 'photo_storage_delete_failed' }, access.session, 400);
    }

    await restJson(
      env,
      `/rest/v1/media_assets?id=eq.${encodeURIComponent(mediaId)}&profile_id=eq.${encodeURIComponent(profileId)}`,
      access.session,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );

    const state = await publicPhotoState(env, access, profileId);
    return withSession({
      ok: true,
      deletedMediaId: mediaId,
      mediaScope: media.album_id ? 'album' : 'profile',
      remainingPublicProfilePhotos: state.count,
      profileVisible: state.ready,
      warning: state.ready
        ? null
        : 'Votre profil est masqué des autres membres jusqu’à la validation de trois photos publiques de profil.'
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'photo_delete_failed' }, 400);
  }
}
