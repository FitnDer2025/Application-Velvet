import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  monetizationMigrationMissing,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function targetUsers(env, access, profileId) {
  const rows = await restJson(
    env,
    `/rest/v1/profile_members?select=user_id&profile_id=eq.${encodeURIComponent(profileId)}&status=eq.active`,
    access.session
  );
  return (rows || []).map((row) => row.user_id).filter(Boolean);
}

async function actionState(env, access, profileId) {
  const users = await targetUsers(env, access, profileId);
  const [favoriteRows, blockRows] = await Promise.all([
    restJson(
      env,
      `/rest/v1/favorites?select=profile_id&owner_user_id=eq.${encodeURIComponent(access.account.userId)}&profile_id=eq.${encodeURIComponent(profileId)}&limit=1`,
      access.session
    ),
    users.length
      ? restJson(
          env,
          `/rest/v1/blocks?select=blocked_user_id&blocker_user_id=eq.${encodeURIComponent(access.account.userId)}&blocked_user_id=in.(${users.map(encodeURIComponent).join(',')})`,
          access.session
        )
      : []
  ]);
  return {
    favorite: Boolean(favoriteRows?.length),
    blocked: users.length > 0 && blockRows.length === users.length
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const profileId = new URL(request.url).searchParams.get('profileId') || '';
    if (!validUuid(profileId) || profileId === admission.admission.id) {
      return withSession({ error: 'invalid_target_profile' }, access.session, 400);
    }
    return withSession(await actionState(env, access, profileId), access.session);
  } catch (error) {
    return json({ error: error.message || 'social_actions_read_failed' }, 400);
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

    if (body.action === 'favorite') {
      try {
        await restJson(env, '/rest/v1/rpc/set_my_profile_favorite', access.session, {
          method: 'POST',
          body: JSON.stringify({
            target_profile_id: profileId,
            target_enabled: Boolean(body.enabled)
          })
        });
      } catch (error) {
        if (!monetizationMigrationMissing(error)) throw error;
        if (body.enabled) {
          await restJson(env, '/rest/v1/favorites?on_conflict=owner_user_id,profile_id', access.session, {
            method: 'POST',
            headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ owner_user_id: access.account.userId, profile_id: profileId })
          });
        } else {
          await restJson(
            env,
            `/rest/v1/favorites?owner_user_id=eq.${encodeURIComponent(access.account.userId)}&profile_id=eq.${encodeURIComponent(profileId)}`,
            access.session,
            { method: 'DELETE', headers: { prefer: 'return=minimal' } }
          );
        }
      }
    } else if (body.action === 'block') {
      const users = await targetUsers(env, access, profileId);
      if (!users.length) return withSession({ error: 'target_profile_unavailable' }, access.session, 404);
      if (body.enabled) {
        await restJson(env, '/rest/v1/blocks?on_conflict=blocker_user_id,blocked_user_id', access.session, {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(users.map((userId) => ({
            blocker_user_id: access.account.userId,
            blocked_user_id: userId
          })))
        });
      } else {
        await restJson(
          env,
          `/rest/v1/blocks?blocker_user_id=eq.${encodeURIComponent(access.account.userId)}&blocked_user_id=in.(${users.map(encodeURIComponent).join(',')})`,
          access.session,
          { method: 'DELETE', headers: { prefer: 'return=minimal' } }
        );
      }
    } else if (body.action === 'report') {
      const category = cleanText(body.category, 80);
      const description = cleanText(body.description, 2000);
      if (!category) return withSession({ error: 'report_category_required' }, access.session, 400);

      await restJson(env, '/rest/v1/rpc/submit_member_profile_report', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_profile: profileId,
          target_category: category,
          target_description: description || null
        })
      });

      const users = await targetUsers(env, access, profileId);
      if (users.length) {
        await restJson(env, '/rest/v1/blocks?on_conflict=blocker_user_id,blocked_user_id', access.session, {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(users.map((userId) => ({
            blocker_user_id: access.account.userId,
            blocked_user_id: userId
          })))
        });
      }
    } else {
      return withSession({ error: 'invalid_social_action' }, access.session, 400);
    }

    return withSession({
      ok: true,
      ...(await actionState(env, access, profileId))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'social_action_failed' }, 400);
  }
}
