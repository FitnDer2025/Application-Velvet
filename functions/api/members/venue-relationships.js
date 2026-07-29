import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RELATIONS = new Set(['favorite', 'visited', 'planning']);

async function relationships(env, access, profileId) {
  return restJson(
    env,
    `/rest/v1/profile_venue_relationships?select=profile_id,venue_id,relation_type,occurred_on,created_at,updated_at&profile_id=eq.${encodeURIComponent(profileId)}&order=updated_at.desc`,
    access.session
  );
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    return withSession({
      relationships: await relationships(env, access, admission.admission.id)
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'venue_relationships_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const venueId = String(body.venueId || '');
    const relation = String(body.relation || '');
    if (!UUID.test(venueId) || !RELATIONS.has(relation)) {
      return withSession({ error: 'invalid_venue_relationship' }, access.session, 400);
    }
    await restJson(env, '/rest/v1/rpc/set_my_venue_relationship', access.session, {
      method: 'POST',
      body: JSON.stringify({
        target_profile: admission.admission.id,
        target_venue: venueId,
        target_relation: relation,
        enabled: body.enabled !== false,
        visit_date: relation === 'visited' && body.visitDate ? body.visitDate : null
      })
    });
    return withSession({
      ok: true,
      relationships: await relationships(env, access, admission.admission.id)
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'venue_relationship_write_failed' }, 400);
  }
}
