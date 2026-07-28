import { json, readJson } from '../auth/_shared.js';
import { memberSession, restJson, withSession } from './_shared.js';

const EARTH_RADIUS_KM = 6371;
const MAX_NEARBY_DISTANCE_KM = 150;
const LOCATION_CONSENT_VERSION = 'velvet-location-v1';

function radians(value) {
  return value * Math.PI / 180;
}

function distanceKm(fromLat, fromLng, toLat, toLng) {
  const latDistance = radians(toLat - fromLat);
  const lngDistance = radians(toLng - fromLng);
  const a = Math.sin(latDistance / 2) ** 2
    + Math.cos(radians(fromLat)) * Math.cos(radians(toLat))
    * Math.sin(lngDistance / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function finiteCoordinate(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

function coarseCoordinate(value) {
  return Math.round(value * 10) / 10;
}

async function recordLocationConsent(env, access, granted, occurredAt) {
  await restJson(
    env,
    '/rest/v1/consent_records',
    access.session,
    {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: access.account.userId,
        purpose: 'precise_location',
        document_version: LOCATION_CONSENT_VERSION,
        granted,
        source: 'web_beta',
        occurred_at: occurredAt,
        withdrawn_at: granted ? null : occurredAt,
        evidence: {
          requested_by_user_action: true,
          stored_precision_km: 10,
          exact_coordinates_stored: false,
          public_profile_location_changed: false
        }
      })
    }
  );
}

async function readLocation(env, access) {
  const rows = await restJson(
    env,
    `/rest/v1/member_location_settings?select=user_id,enabled,precision_km,latitude_bucket,longitude_bucket,consented_at,last_used_at,updated_at&user_id=eq.${encodeURIComponent(access.account.userId)}&limit=1`,
    access.session
  );
  const row = rows?.[0] || null;
  const active = Boolean(row?.enabled && row.latitude_bucket !== null && row.longitude_bucket !== null);
  let nearbyVenues = [];

  if (active) {
    const venues = await restJson(
      env,
      '/rest/v1/venue_directory?select=id,name,kind,city,country_code,address_public,website,verification_status,latitude,longitude&latitude=not.is.null&longitude=not.is.null&verification_status=neq.closed&limit=1000',
      access.session
    );
    nearbyVenues = (venues || [])
      .map((venue) => ({
        id: venue.id,
        name: venue.name,
        kind: venue.kind,
        city: venue.city,
        country_code: venue.country_code,
        address_public: venue.address_public,
        website: venue.website,
        verification_status: venue.verification_status,
        distance_km: distanceKm(
          Number(row.latitude_bucket),
          Number(row.longitude_bucket),
          Number(venue.latitude),
          Number(venue.longitude)
        )
      }))
      .filter((venue) => Number.isFinite(venue.distance_km) && venue.distance_km <= MAX_NEARBY_DISTANCE_KM)
      .sort((left, right) => left.distance_km - right.distance_km)
      .slice(0, 20)
      .map((venue) => ({ ...venue, distance_km: Math.round(venue.distance_km) }));
  }

  return {
    location: row ? {
      enabled: active,
      precision_km: row.precision_km || 10,
      consented_at: row.consented_at,
      last_used_at: row.last_used_at,
      updated_at: row.updated_at,
      exact_coordinates_stored: false
    } : {
      enabled: false,
      precision_km: 10,
      consented_at: null,
      last_used_at: null,
      updated_at: null,
      exact_coordinates_stored: false
    },
    nearbyVenues
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    return withSession(await readLocation(env, access), access.session);
  } catch (error) {
    return json({ error: error.message || 'location_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const latitude = finiteCoordinate(body.latitude, -90, 90);
    const longitude = finiteCoordinate(body.longitude, -180, 180);
    if (latitude === null || longitude === null || body.consent !== true) {
      return withSession({ error: 'location_consent_and_coordinates_required' }, access.session, 400);
    }

    const now = new Date().toISOString();
    await Promise.all([
      restJson(
        env,
        '/rest/v1/member_location_settings?on_conflict=user_id',
        access.session,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            user_id: access.account.userId,
            enabled: true,
            precision_km: 10,
            latitude_bucket: coarseCoordinate(latitude),
            longitude_bucket: coarseCoordinate(longitude),
            consented_at: now,
            last_used_at: now
          })
        }
      ),
      recordLocationConsent(env, access, true, now)
    ]);

    return withSession({ ok: true, ...(await readLocation(env, access)) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'location_write_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const now = new Date().toISOString();
    await Promise.all([
      restJson(
        env,
        '/rest/v1/member_location_settings?on_conflict=user_id',
        access.session,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            user_id: access.account.userId,
            enabled: false,
            precision_km: 10,
            latitude_bucket: null,
            longitude_bucket: null,
            last_used_at: null
          })
        }
      ),
      recordLocationConsent(env, access, false, now)
    ]);
    return withSession({ ok: true, ...(await readLocation(env, access)) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'location_delete_failed' }, 400);
  }
}
