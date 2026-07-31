import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { signedMediaUrl } from './media.js';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function validEntityType(value) {
  return ['conversation', 'profile', 'photo', 'event', 'venue', 'security'].includes(String(value || ''));
}

async function enrichNotifications(env, access, notifications = []) {
  const photoIds = [...new Set(notifications
    .filter((row) => row.entity_type === 'photo' && validUuid(row.entity_id))
    .map((row) => row.entity_id))];
  const actorIds = [...new Set(notifications.map((row) => row.actor_profile_id).filter(validUuid))];
  const [photoRows, actorMediaRows] = await Promise.all([
    photoIds.length
      ? restJson(
        env,
        `/rest/v1/media_assets?select=id,profile_id,storage_path,media_role,is_primary,moderation_status&id=in.(${photoIds.join(',')})`,
        access.session
      ).catch(() => [])
      : [],
    actorIds.length
      ? restJson(
        env,
        `/rest/v1/media_assets?select=id,profile_id,storage_path,media_role,is_primary,moderation_status&profile_id=in.(${actorIds.join(',')})&media_type=eq.image&moderation_status=eq.approved&order=is_primary.desc,created_at.asc`,
        access.session
      ).catch(() => [])
      : []
  ]);
  const photoById = new Map((photoRows || []).map((row) => [row.id, row]));
  const actorMediaByProfile = new Map();
  (actorMediaRows || []).forEach((row) => {
    if (!actorMediaByProfile.has(row.profile_id)) actorMediaByProfile.set(row.profile_id, row);
  });

  return Promise.all(notifications.map(async (notification) => {
    const entityMedia = photoById.get(notification.entity_id);
    const actorMedia = actorMediaByProfile.get(notification.actor_profile_id);
    return {
      ...notification,
      entityPreviewUrl: entityMedia?.storage_path
        ? await signedMediaUrl(env, access.session, entityMedia.storage_path)
        : null,
      actorPreviewUrl: actorMedia?.storage_path
        ? await signedMediaUrl(env, access.session, actorMedia.storage_path)
        : null
    };
  }));
}

async function notificationFeed(env, access, { archived = false } = {}) {
  const archiveFilter = archived ? 'archived_at=not.is.null' : 'archived_at=is.null';
  const [notifications, archiveRows] = await Promise.all([
    restJson(
      env,
      `/rest/v1/member_notifications?select=id,actor_profile_id,event_type,entity_type,entity_id,title,body,metadata,read_at,archived_at,created_at&user_id=eq.${encodeURIComponent(access.account.userId)}&${archiveFilter}&order=created_at.desc&limit=150`,
      access.session
    ),
    restJson(
      env,
      `/rest/v1/member_notifications?select=id&user_id=eq.${encodeURIComponent(access.account.userId)}&archived_at=not.is.null&limit=1000`,
      access.session
    ).catch(() => [])
  ]);
  const enriched = await enrichNotifications(env, access, notifications || []);
  return {
    notifications: enriched,
    unreadCount: archived ? 0 : enriched.filter((row) => !row.read_at).length,
    archiveCount: archiveRows?.length || 0,
    archived
  };
}

async function patchNotifications(env, access, filter, patch) {
  await restJson(
    env,
    `/rest/v1/member_notifications?user_id=eq.${encodeURIComponent(access.account.userId)}&${filter}`,
    access.session,
    {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    }
  );
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const archived = new URL(request.url).searchParams.get('archived') === '1';
    return withSession(await notificationFeed(env, access, { archived }), access.session);
  } catch (error) {
    return json({ error: error.message || 'notifications_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const now = new Date().toISOString();

    if (body.action === 'read_all' || body.action === 'archive_all_read') {
      await patchNotifications(
        env,
        access,
        'archived_at=is.null',
        { read_at: now, archived_at: now }
      );
    } else if ((body.action === 'read' || body.action === 'archive') && validUuid(body.notificationId)) {
      await patchNotifications(
        env,
        access,
        `id=eq.${encodeURIComponent(body.notificationId)}`,
        { read_at: now, archived_at: now }
      );
    } else if (body.action === 'consume_entity' && validEntityType(body.entityType) && validUuid(body.entityId)) {
      await patchNotifications(
        env,
        access,
        `entity_type=eq.${encodeURIComponent(body.entityType)}&entity_id=eq.${encodeURIComponent(body.entityId)}&archived_at=is.null`,
        { read_at: now, archived_at: now }
      );
    } else if (body.action === 'archive_all') {
      await patchNotifications(
        env,
        access,
        'archived_at=is.null',
        { read_at: now, archived_at: now }
      );
    } else if (body.action === 'restore' && validUuid(body.notificationId)) {
      await patchNotifications(
        env,
        access,
        `id=eq.${encodeURIComponent(body.notificationId)}`,
        { archived_at: null }
      );
    } else {
      return withSession({ error: 'invalid_notification_action' }, access.session, 400);
    }

    return withSession({
      ok: true,
      ...(await notificationFeed(env, access))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'notification_update_failed' }, 400);
  }
}
