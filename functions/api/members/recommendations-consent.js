import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

const SELECT = [
  'id',
  'author_profile_id',
  'target_type',
  'target_id',
  'body',
  'rating',
  'status',
  'decided_at',
  'created_at',
  'updated_at'
].join(',');

async function currentProfileId(env, access) {
  const rows = await restJson(
    env,
    `/rest/v1/profile_members?select=profile_id&user_id=eq.${encodeURIComponent(access.account.userId)}&status=eq.active&order=accepted_at.asc.nullslast&limit=1`,
    access.session
  );
  return rows?.[0]?.profile_id || null;
}

function normalizeTargetType(value) {
  return value === 'profile' || value === 'venue' ? value : null;
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const profileId = await currentProfileId(env, access);
    if (!profileId) return json({ error: 'member_profile_required' }, 409);

    const url = new URL(request.url);
    const targetType = normalizeTargetType(url.searchParams.get('targetType'));
    const targetId = url.searchParams.get('targetId');

    const rows = await restJson(
      env,
      `/rest/v1/recommendation_requests?select=${encodeURIComponent(SELECT)}&order=created_at.desc&limit=500`,
      access.session
    );

    const all = rows || [];
    const published = all.filter((row) =>
      row.status === 'published'
      && (!targetType || row.target_type === targetType)
      && (!targetId || row.target_id === targetId)
    );
    const sent = all.filter((row) => row.author_profile_id === profileId);
    const received = all.filter((row) =>
      row.status === 'pending' && row.author_profile_id !== profileId
    );

    return withSession({
      published,
      sent,
      received,
      currentProfileId: profileId
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'recommendations_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const body = await readJson(request);
    const targetType = normalizeTargetType(body.targetType);
    const targetId = String(body.targetId || '');
    const recommendationBody = cleanText(body.body, 1200);
    const rating = body.rating == null ? null : Number(body.rating);

    if (!targetType) return json({ error: 'invalid_recommendation_target_type' }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      return json({ error: 'invalid_recommendation_target' }, 400);
    }
    if (!recommendationBody || recommendationBody.length < 10) {
      return json({ error: 'invalid_recommendation_body' }, 400);
    }
    if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return json({ error: 'invalid_recommendation_rating' }, 400);
    }

    const result = await restJson(
      env,
      '/rest/v1/rpc/create_recommendation_request',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          requested_target_type: targetType,
          requested_target_id: targetId,
          requested_body: recommendationBody,
          requested_rating: rating
        })
      }
    );
    const id = typeof result === 'string' ? result : result?.[0] || result;
    const rows = await restJson(
      env,
      `/rest/v1/recommendation_requests?select=${encodeURIComponent(SELECT)}&id=eq.${encodeURIComponent(id)}&limit=1`,
      access.session
    );

    return withSession({ ok: true, recommendation: rows?.[0] || null }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'recommendation_create_failed' }, 400);
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const body = await readJson(request);
    const recommendationId = String(body.recommendationId || '');
    const decision = body.decision === 'accept' || body.decision === 'decline'
      ? body.decision
      : null;
    if (!/^[0-9a-f-]{36}$/i.test(recommendationId) || !decision) {
      return json({ error: 'invalid_recommendation_decision' }, 400);
    }

    await restJson(
      env,
      '/rest/v1/rpc/decide_recommendation_request',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          requested_recommendation_id: recommendationId,
          requested_decision: decision
        })
      }
    );

    const rows = await restJson(
      env,
      `/rest/v1/recommendation_requests?select=${encodeURIComponent(SELECT)}&id=eq.${encodeURIComponent(recommendationId)}&limit=1`,
      access.session
    );
    return withSession({ ok: true, recommendation: rows?.[0] || null }, access.session);
  } catch (error) {
    return json({ error: error.message || 'recommendation_decision_failed' }, 400);
  }
}
