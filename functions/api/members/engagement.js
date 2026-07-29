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

export async function onRequestPost({ request, env }) {
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
