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

async function engagementState(env, access, profileId) {
  const [views, reactions, people, streaks] = await Promise.all([
    restJson(
      env,
      `/rest/v1/profile_view_history?select=viewed_profile_id,first_viewed_at,last_viewed_at,view_count&viewer_user_id=eq.${encodeURIComponent(access.account.userId)}&order=last_viewed_at.desc&limit=500`,
      access.session
    ),
    restJson(
      env,
      `/rest/v1/profile_reactions?select=reactor_user_id,reactor_profile_id,target_profile_id,reaction,created_at,updated_at&reactor_profile_id=eq.${encodeURIComponent(profileId)}&order=updated_at.desc&limit=500`,
      access.session
    ),
    restJson(
      env,
      `/rest/v1/individual_profiles?select=linked_user_id,first_name,member_slot&profile_id=eq.${encodeURIComponent(profileId)}&order=member_slot.asc`,
      access.session
    ),
    restJson(
      env,
      '/rest/v1/conversation_engagement?select=conversation_id,current_streak,longest_streak,qualified_days,last_qualified_date,last_message_at,updated_at&order=updated_at.desc&limit=200',
      access.session
    )
  ]);
  const names = new Map((people || []).map((person) => [person.linked_user_id, person.first_name]));
  return {
    views: views || [],
    reactions: (reactions || []).map((reaction) => ({
      ...reaction,
      reactor_name: names.get(reaction.reactor_user_id)
        || (reaction.reactor_user_id === access.account.userId ? 'Moi' : 'Ma moitié')
    })),
    streaks: streaks || [],
    currentUserId: access.account.userId,
    currentProfileId: profileId
  };
}

async function notifyProfileView(env, access, actorProfileId, targetProfileId) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { notified: 0, configured: false };

  const [owners, actorRows] = await Promise.all([
    serviceRest(
      env,
      `/rest/v1/profile_members?select=user_id&profile_id=eq.${encodeURIComponent(targetProfileId)}&status=eq.active`
    ).catch(() => []),
    serviceRest(
      env,
      `/rest/v1/member_profiles?select=id,display_name&id=eq.${encodeURIComponent(actorProfileId)}&limit=1`
    ).catch(() => [])
  ]);

  const ownerUserIds = [...new Set((owners || [])
    .map((row) => row.user_id)
    .filter((userId) => userId && userId !== access.account.userId))];
  if (!ownerUserIds.length) return { notified: 0 };

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const existing = await serviceRest(
    env,
    `/rest/v1/member_notifications?select=id&user_id=in.(${ownerUserIds.join(',')})&actor_profile_id=eq.${encodeURIComponent(actorProfileId)}&event_type=eq.profile_views&created_at=gte.${encodeURIComponent(since)}&limit=1`
  ).catch(() => []);
  if (existing?.length) return { notified: 0, deduplicated: true };

  const actorName = clean(actorRows?.[0]?.display_name, 120) || 'Un membre Velvet';
  await serviceRest(env, '/rest/v1/member_notifications', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(ownerUserIds.map((userId) => ({
      user_id: userId,
      actor_profile_id: actorProfileId,
      event_type: 'profile_views',
      entity_type: 'profile',
      entity_id: actorProfileId,
      title: `${actorName} a consulté votre profil`,
      body: `${actorName} vient de découvrir votre univers Velvet.`
    })))
  });

  return { notified: ownerUserIds.length };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    return withSession(
      await engagementState(env, access, admission.admission.id),
      access.session
    );
  } catch (error) {
    return json({ error: error.message || 'engagement_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const profileId = String(body.profileId || '');
    if (!validUuid(profileId) || profileId === admission.admission.id) {
      return withSession({ error: 'invalid_target_profile' }, access.session, 400);
    }

    if (body.action === 'view') {
      await restJson(
        env,
        '/rest/v1/rpc/record_profile_view',
        access.session,
        {
          method: 'POST',
          body: JSON.stringify({ target_profile_id: profileId })
        }
      );
      const notificationTask = notifyProfileView(
        env,
        access,
        admission.admission.id,
        profileId
      ).catch(() => ({ notified: 0 }));
      if (typeof waitUntil === 'function') waitUntil(notificationTask);
      else await notificationTask;
    } else if (body.action === 'reaction') {
      const reaction = body.reaction === null ? null : Number(body.reaction);
      if (reaction !== null && ![-1, 1, 2, 3].includes(reaction)) {
        return withSession({ error: 'invalid_profile_reaction' }, access.session, 400);
      }
      await restJson(
        env,
        '/rest/v1/rpc/set_profile_reaction',
        access.session,
        {
          method: 'POST',
          body: JSON.stringify({
            target_profile_id: profileId,
            reaction_value: reaction
          })
        }
      );
    } else {
      return withSession({ error: 'invalid_engagement_action' }, access.session, 400);
    }

    return withSession({
      ok: true,
      ...(await engagementState(env, access, admission.admission.id))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'engagement_write_failed' }, 400);
  }
}
