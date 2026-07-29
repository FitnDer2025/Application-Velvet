import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAP_ZONES = new Set([
  'Ensemble du village',
  'Entrée · Natureva · René Oltra',
  'Port Soleil',
  'Port Ambonne',
  'Port Nature',
  'Héliopolis',
  'Plage naturiste',
  'Marina'
]);

function isoDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('invalid_plan_date');
  const date = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error('invalid_plan_date');
  }
  return text;
}

function nullableCoordinate(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error('invalid_plan_coordinates');
  }
  return number;
}

async function planState(env, access) {
  const [venueVisits, travelPlans, eventPlans] = await Promise.all([
    restJson(
      env,
      '/rest/v1/profile_venue_visits?select=id,profile_id,venue_id,visit_date,created_at,updated_at,venue_directory(id,name,kind,city,address_public,latitude,longitude)&order=visit_date.asc&limit=1000',
      access.session
    ),
    restJson(
      env,
      '/rest/v1/profile_travel_plans?select=id,profile_id,title,location_label,starts_on,ends_on,latitude,longitude,precise_location_consent,destination_type,cap_zone,cap_venue,notes,created_at,updated_at&order=starts_on.asc&limit=500',
      access.session
    ),
    restJson(
      env,
      '/rest/v1/rpc/member_visible_event_plans',
      access.session,
      { method: 'POST', body: '{}' }
    )
  ]);
  return { venueVisits, travelPlans, eventPlans };
}

async function admittedAccess(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return access;
  const admission = await requireAdmittedMember(env, access);
  if (admission.response) return { response: admission.response };
  return { ...access, profileId: admission.admission.id };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await admittedAccess(request, env);
    if (access.response) return access.response;
    return withSession(await planState(env, access), access.session);
  } catch (error) {
    return json({ error: error.message || 'plans_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await admittedAccess(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);

    if (body.action === 'venue_visit') {
      if (!UUID.test(body.venueId || '')) return json({ error: 'invalid_venue' }, 400);
      const visitDate = isoDate(body.visitDate);
      await restJson(
        env,
        '/rest/v1/profile_venue_visits?on_conflict=profile_id,venue_id,visit_date',
        access.session,
        {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            profile_id: access.profileId,
            venue_id: body.venueId,
            visit_date: visitDate,
            created_by: access.account.userId,
            updated_at: new Date().toISOString()
          })
        }
      );
    } else if (body.action === 'travel_plan') {
      const startsOn = isoDate(body.startsOn);
      const endsOn = isoDate(body.endsOn);
      if (endsOn < startsOn) return json({ error: 'invalid_plan_dates' }, 400);
      const destinationType = body.destinationType === 'cap_dagde_village'
        ? 'cap_dagde_village'
        : 'general';
      const capZone = destinationType === 'cap_dagde_village'
        ? cleanText(body.capZone, 120)
        : null;
      if (destinationType === 'cap_dagde_village' && !CAP_ZONES.has(capZone)) {
        return json({ error: 'invalid_cap_dagde_zone' }, 400);
      }
      const preciseConsent = body.preciseLocationConsent === true;
      const latitude = preciseConsent ? nullableCoordinate(body.latitude, -90, 90) : null;
      const longitude = preciseConsent ? nullableCoordinate(body.longitude, -180, 180) : null;
      if ((latitude === null) !== (longitude === null)) {
        return json({ error: 'invalid_plan_coordinates' }, 400);
      }
      const title = cleanText(body.title, 160);
      const locationLabel = cleanText(body.locationLabel, 240);
      if (title.length < 2 || locationLabel.length < 2) {
        return json({ error: 'travel_plan_identity_required' }, 400);
      }
      await restJson(
        env,
        '/rest/v1/profile_travel_plans',
        access.session,
        {
          method: 'POST',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({
            profile_id: access.profileId,
            title,
            location_label: locationLabel,
            starts_on: startsOn,
            ends_on: endsOn,
            latitude,
            longitude,
            precise_location_consent: preciseConsent,
            destination_type: destinationType,
            cap_zone: capZone,
            cap_venue: destinationType === 'cap_dagde_village'
              ? cleanText(body.capVenue, 160) || null
              : null,
            notes: cleanText(body.notes, 2000) || null,
            created_by: access.account.userId
          })
        }
      );
    } else {
      return json({ error: 'invalid_plan_action' }, 400);
    }

    return withSession({ ok: true, ...(await planState(env, access)) }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'plan_write_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await admittedAccess(request, env);
    if (access.response) return access.response;
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const id = url.searchParams.get('id') || '';
    if (!UUID.test(id) || !['venue_visit','travel_plan'].includes(type)) {
      return json({ error: 'invalid_plan' }, 400);
    }
    const table = type === 'venue_visit' ? 'profile_venue_visits' : 'profile_travel_plans';
    await restJson(
      env,
      `/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&profile_id=eq.${encodeURIComponent(access.profileId)}`,
      access.session,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
    return withSession({ ok: true, ...(await planState(env, access)) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'plan_delete_failed' }, 400);
  }
}
