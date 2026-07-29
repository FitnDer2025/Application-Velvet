import { json, readJson } from '../auth/_shared.js';
import { cleanList, cleanText, memberSession, restJson, withSession } from '../members/_shared.js';

const PRO_ROLES = new Set(['pro_owner', 'pro_staff', 'admin']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function proAccess(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return access;
  if (!access.account.roles.some((role) => PRO_ROLES.has(role))) {
    return { response: json({ error: 'pro_access_required' }, 403) };
  }
  return access;
}

async function workspace(env, access) {
  const venues = await restJson(
    env,
    '/rest/v1/establishments?select=id,slug,name,kind,description,city,address_public,phone_public,email_public,opening_hours,amenities,visibility,verified_at,updated_at,establishment_staff(user_id,staff_role,status)&order=name.asc',
    access.session
  );
  const ids = venues.map((venue) => venue.id);
  if (!ids.length) return { venues: [], events: [], registrations: [], drafts: [] };
  const filter = ids.map(encodeURIComponent).join(',');
  const [events, drafts, registrationGroups] = await Promise.all([
    restJson(
      env,
      `/rest/v1/events?select=id,owner_type,establishment_id,title,description,starts_at,ends_at,capacity,location_public,audience,visibility,price_cents,currency,registration_open,dress_code,created_at,updated_at&establishment_id=in.(${filter})&order=starts_at.asc`,
      access.session
    ),
    restJson(
      env,
      `/rest/v1/establishment_drafts?select=establishment_id,payload,updated_at&establishment_id=in.(${filter})`,
      access.session
    ),
    Promise.all(ids.map(async (id) => restJson(
      env,
      '/rest/v1/rpc/pro_workspace_participants',
      access.session,
      { method: 'POST', body: JSON.stringify({ target_establishment: id }) }
    )))
  ]);
  return { venues, events, drafts, registrations: registrationGroups.flat() };
}

function venuePayload(body) {
  return {
    name: cleanText(body.name, 180),
    kind: cleanText(body.kind, 30),
    description: cleanText(body.description, 5000),
    city: cleanText(body.city, 180),
    address_public: cleanText(body.address_public, 500),
    phone_public: cleanText(body.phone_public, 80) || null,
    email_public: cleanText(body.email_public, 320) || null,
    opening_hours: typeof body.opening_hours === 'object' && body.opening_hours
      ? body.opening_hours
      : { public: cleanText(body.opening_hours, 500) },
    amenities: cleanList(body.amenities, 50, 100)
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await proAccess(request, env);
    if (access.response) return access.response;
    return withSession({ ...(await workspace(env, access)), account: access.account }, access.session);
  } catch (error) {
    return json({ error: error.message || 'pro_workspace_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await proAccess(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const action = cleanText(body.action, 40);
    if (action === 'save_venue_draft' || action === 'publish_venue') {
      if (!UUID.test(body.venueId || '')) return withSession({ error: 'invalid_venue' }, access.session, 400);
      const payload = venuePayload(body.venue || {});
      if (!payload.name || !['club', 'spa', 'bar', 'love_room', 'other'].includes(payload.kind)) {
        return withSession({ error: 'invalid_venue_payload' }, access.session, 400);
      }
      if (action === 'save_venue_draft') {
        await restJson(env, '/rest/v1/establishment_drafts?on_conflict=establishment_id', access.session, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ establishment_id: body.venueId, payload, updated_by: access.account.userId })
        });
      } else {
        await restJson(env, `/rest/v1/establishments?id=eq.${encodeURIComponent(body.venueId)}`, access.session, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ ...payload, visibility: 'published' })
        });
        await restJson(env, `/rest/v1/establishment_drafts?establishment_id=eq.${encodeURIComponent(body.venueId)}`, access.session, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        });
      }
    } else if (action === 'create_event') {
      if (!UUID.test(body.venueId || '')) return withSession({ error: 'invalid_venue' }, access.session, 400);
      const event = body.event || {};
      const title = cleanText(event.title, 180);
      const capacity = Number(event.capacity);
      const startsAt = new Date(event.starts_at);
      if (title.length < 2 || !Number.isInteger(capacity) || capacity < 2 || Number.isNaN(startsAt.getTime())) {
        return withSession({ error: 'invalid_event_payload' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/events', access.session, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          owner_type: 'establishment',
          establishment_id: body.venueId,
          title,
          description: cleanText(event.description, 5000),
          starts_at: startsAt.toISOString(),
          capacity,
          location_public: cleanText(event.location_public, 500),
          audience: cleanText(event.audience, 500),
          visibility: event.visibility === 'published' ? 'published' : 'draft',
          price_cents: Math.max(0, Math.round(Number(event.price || 0) * 100)),
          dress_code: cleanText(event.dress_code, 300) || null,
          created_by: access.account.userId
        })
      });
    } else if (action === 'registration_status') {
      if (!UUID.test(body.registrationId || '') || !['confirmed', 'waitlisted', 'checked_in', 'declined'].includes(body.status)) {
        return withSession({ error: 'invalid_registration_status' }, access.session, 400);
      }
      await restJson(env, `/rest/v1/event_registrations?id=eq.${encodeURIComponent(body.registrationId)}`, access.session, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: body.status })
      });
    } else {
      return withSession({ error: 'invalid_pro_action' }, access.session, 400);
    }
    return withSession({ ok: true, ...(await workspace(env, access)) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'pro_workspace_write_failed' }, 400);
  }
}
