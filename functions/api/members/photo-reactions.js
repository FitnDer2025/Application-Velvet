import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { deliverBrowserActivity } from './_browser-push.js';

const REACTIONS = new Set(['like', 'love', 'adore']);

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

async function serviceRest(env, path, init = {}) {
  const url = clean(env.SUPABASE_URL, 1000).replace(/\/$/, '');
  const key = clean(env.SUPABASE_SERVICE_ROLE_KEY, 4000);
  if (!url || !key) throw new Error('service_role_not_configured');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || payload?.code || 'service_request_failed');
  }
  return payload;
}

async function visibleSummaries(env, access) {
  const media = await restJson(
    env,
    '/rest/v1/media_assets?select=id&media_type=eq.image&order=created_at.desc&limit=1000',
    access.session
  );
  const ids = (media || []).map((row) => row.id).filter(validUuid);
  if (!ids.length) return [];
  return restJson(
    env,
    '/rest/v1/rpc/photo_reaction_summaries',
    access.session,
    {
      method: 'POST',
      body: JSON.stringify({ target_media_ids: ids })
    }
  );
}

async function notifyPhotoOwner(env, access, admission, mediaId, reaction) {
  if (!reaction || !env.SUPABASE_SERVICE_ROLE_KEY) return { notified: 0 };

  const [mediaRows, actorRows] = await Promise.all([
    serviceRest(
      env,
      `/rest/v1/media_assets?select=id,profile_id,owner_user_id,media_role&id=eq.${encodeURIComponent(mediaId)}&limit=1`
    ).catch(() => []),
    serviceRest(
      env,
      `/rest/v1/member_profiles?select=id,display_name&id=eq.${encodeURIComponent(admission.id)}&limit=1`
    ).catch(() => [])
  ]);
  const media = mediaRows?.[0];
  if (!media?.profile_id) return { notified: 0 };

  const profileMembers = await serviceRest(
    env,
    `/rest/v1/profile_members?select=user_id&profile_id=eq.${encodeURIComponent(media.profile_id)}&status=eq.active`
  ).catch(() => []);
  const ownerUserIds = [...new Set([
    media.owner_user_id,
    ...(profileMembers || []).map((row) => row.user_id)
  ].filter((userId) => userId && userId !== access.account.userId))];
  if (!ownerUserIds.length) return { notified: 0 };

  const actor = actorRows?.[0];
  const actorName = clean(actor?.display_name, 120) || 'Un membre Zwit';
  const wording = {
    like: { title: `${actorName} aime votre photo`, body: `${actorName} a ajouté un J’aime à cette photo.` },
    love: { title: `${actorName} adore votre photo`, body: `${actorName} a réagi avec un cœur à cette photo.` },
    adore: { title: `${actorName} a eu un coup de cœur`, body: `${actorName} a ajouté un coup de cœur à cette photo.` }
  }[reaction];
  if (!wording) return { notified: 0 };

  await serviceRest(env, '/rest/v1/member_notifications', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(ownerUserIds.map((userId) => ({
      user_id: userId,
      actor_profile_id: admission.id,
      event_type: 'reactions',
      entity_type: 'photo',
      entity_id: mediaId,
      title: wording.title,
      body: wording.body,
      metadata: {
        reaction,
        mediaId,
        targetProfileId: media.profile_id,
        mediaRole: media.media_role || null,
        actorName
      }
    })))
  });

  const push = await deliverBrowserActivity(env, {
    userIds: ownerUserIds,
    eventType: 'reactions',
    title: wording.title,
    body: wording.body,
    tag: `velvet-photo-reaction-${mediaId}`,
    navigate: '/membres/?route=notifications',
    profileId: admission.id
  }).catch(() => ({ sent: 0 }));

  return { notified: ownerUserIds.length, browserPush: push.sent || 0 };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    return withSession({
      reactions: await visibleSummaries(env, access)
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'photo_reactions_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const mediaId = String(body.mediaId || '');
    const reaction = body.reaction === null ? null : String(body.reaction || '');
    if (!validUuid(mediaId)) return json({ error: 'invalid_photo' }, 400);
    if (reaction !== null && !REACTIONS.has(reaction)) {
      return json({ error: 'invalid_photo_reaction' }, 400);
    }
    const result = await restJson(
      env,
      '/rest/v1/rpc/set_photo_reaction',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          target_media_id: mediaId,
          reaction_value: reaction
        })
      }
    );

    const notificationTask = notifyPhotoOwner(
      env,
      access,
      admission.admission,
      mediaId,
      reaction
    ).catch(() => ({ notified: 0 }));
    if (typeof waitUntil === 'function') waitUntil(notificationTask);
    else await notificationTask;

    return withSession({
      ok: true,
      summary: result?.[0] || null
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'photo_reaction_write_failed' }, 400);
  }
}
