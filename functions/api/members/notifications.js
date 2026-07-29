import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function notificationFeed(env, access) {
  const notifications = await restJson(
    env,
    `/rest/v1/member_notifications?select=id,actor_profile_id,event_type,entity_type,entity_id,title,body,read_at,created_at&user_id=eq.${encodeURIComponent(access.account.userId)}&order=created_at.desc&limit=100`,
    access.session
  );
  return {
    notifications,
    unreadCount: notifications.filter((row) => !row.read_at).length
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    return withSession(await notificationFeed(env, access), access.session);
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
    if (body.action === 'read_all') {
      await restJson(
        env,
        `/rest/v1/member_notifications?user_id=eq.${encodeURIComponent(access.account.userId)}&read_at=is.null`,
        access.session,
        {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ read_at: now })
        }
      );
    } else if (body.action === 'read' && validUuid(body.notificationId)) {
      await restJson(
        env,
        `/rest/v1/member_notifications?id=eq.${encodeURIComponent(body.notificationId)}&user_id=eq.${encodeURIComponent(access.account.userId)}`,
        access.session,
        {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ read_at: now })
        }
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

