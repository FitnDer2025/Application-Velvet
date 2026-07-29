import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

const REACTIONS = new Set(['like', 'love', 'adore']);

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
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

export async function onRequestPost({ request, env }) {
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
    return withSession({
      ok: true,
      summary: result?.[0] || null
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'photo_reaction_write_failed' }, 400);
  }
}
