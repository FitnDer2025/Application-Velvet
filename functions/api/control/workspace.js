import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction', 'moderator', 'support', 'auditor']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function controlAccess(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return access;
  if (!access.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return { response: json({ error: 'control_access_required' }, 403) };
  }
  return access;
}

async function workspace(env, access) {
  const [accounts, profiles, establishments, staff, events, registrations, organizers, reports, audits, releaseChecks] = await Promise.all([
    restJson(env, '/rest/v1/rpc/control_accounts', access.session, { method: 'POST', body: '{}' }),
    restJson(env, '/rest/v1/member_profiles?select=id,profile_type,display_name,admission_status,verification_status,visibility,created_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/establishments?select=id,slug,name,kind,city,visibility,verified_at,created_at,updated_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/establishment_staff?select=establishment_id,user_id,staff_role,status,created_at&limit=1000', access.session),
    restJson(env, '/rest/v1/events?select=id,establishment_id,organizer_profile_id,owner_type,title,starts_at,capacity,visibility,created_at&order=starts_at.desc&limit=1000', access.session),
    restJson(env, '/rest/v1/event_registrations?select=id,event_id,user_id,places,status,created_at&order=created_at.desc&limit=2000', access.session),
    restJson(env, '/rest/v1/organizer_requests?select=id,user_id,member_profile_id,message,status,reviewed_by,reviewed_at,created_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/reports?select=id,reporter_user_id,subject_type,subject_id,category,status,created_at&order=created_at.desc&limit=500', access.session),
    restJson(env, '/rest/v1/audit_events?select=sequence_number,actor_user_id,action,entity_type,entity_id,occurred_at&order=sequence_number.desc&limit=100', access.session),
    restJson(env, '/rest/v1/rpc/control_beta_release_checks', access.session, { method: 'POST', body: '{}' })
  ]);
  return { accounts, profiles, establishments, staff, events, registrations, organizers, reports, audits, releaseChecks };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await controlAccess(request, env);
    if (access.response) return access.response;
    return withSession({ ...(await workspace(env, access)), account: access.account }, access.session);
  } catch (error) {
    return json({ error: error.message || 'control_workspace_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await controlAccess(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    if (body.action === 'create_establishment') {
      if (!UUID.test(body.ownerUserId || '')) return withSession({ error: 'invalid_owner' }, access.session, 400);
      await restJson(env, '/rest/v1/rpc/control_create_establishment', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_name: cleanText(body.name, 180),
          target_slug: cleanText(body.slug, 100),
          target_kind: cleanText(body.kind, 30),
          target_owner: body.ownerUserId
        })
      });
    } else if (body.action === 'decide_organizer') {
      if (!UUID.test(body.requestId || '') || !['approved', 'declined'].includes(body.decision)) {
        return withSession({ error: 'invalid_organizer_decision' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_decide_organizer', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_request: body.requestId, target_decision: body.decision })
      });
    } else if (body.action === 'venue_visibility') {
      if (!UUID.test(body.venueId || '') || !['draft', 'review', 'published', 'suspended'].includes(body.visibility)) {
        return withSession({ error: 'invalid_venue_visibility' }, access.session, 400);
      }
      await restJson(env, `/rest/v1/establishments?id=eq.${encodeURIComponent(body.venueId)}`, access.session, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ visibility: body.visibility })
      });
    } else {
      return withSession({ error: 'invalid_control_action' }, access.session, 400);
    }
    return withSession({ ok: true, ...(await workspace(env, access)) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'control_workspace_write_failed' }, 400);
  }
}
