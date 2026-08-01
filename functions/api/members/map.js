import { json } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { enrichProfilesMedia } from './media.js';
import { geocodeVenueAddress } from './venue-geocoding.js';

const DEFAULT_CENTER = { latitude: 46.603354, longitude: 1.888334, zoom: 5 };
const DEFAULT_EXPERIENCE = { radiusKm: 50 };
const geocodeCache = new Map();

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function publicZoneQuery(value) {
  return String(value || '')
    .replace(/\bet\s+(ses\s+)?alentours\b/gi, '')
    .replace(/\bsecteur\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function profileOffset(id, axis) {
  const source = String(id || '');
  let hash = axis === 'latitude' ? 17 : 31;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33 + source.charCodeAt(index)) >>> 0;
  }
  return ((hash % 1000) / 1000 - 0.5) * 0.025;
}

async function geocodePublicZone(zone) {
  const query = publicZoneQuery(zone);
  if (query.length < 2) return null;
  if (geocodeCache.has(query)) return geocodeCache.get(query);
  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,centre&boost=population&limit=1`,
        {
          headers: { accept: 'application/json' },
          signal: controller.signal
        }
      );
      if (!response.ok) return null;
      const rows = await response.json();
      const coordinates = rows?.[0]?.centre?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
      const longitude = finite(coordinates[0]);
      const latitude = finite(coordinates[1]);
      return latitude === null || longitude === null ? null : { latitude, longitude };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  geocodeCache.set(query, task);
  return task;
}

function primaryPhoto(profile) {
  return (profile.media_assets || []).find((media) =>
    media.moderation_status === 'approved' && media.is_primary && media.previewUrl
  ) || (profile.media_assets || []).find((media) =>
    media.moderation_status === 'approved' && media.previewUrl
  );
}

async function memberMarkers(env, token, currentProfileId) {
  const rows = await restJson(
    env,
    '/rest/v1/member_profiles?select=id,profile_type,display_name,location_zone,profile_photo_ready,media_assets(id,is_primary,storage_path,moderation_status,media_role)&visibility=in.(beta_members,published)&profile_photo_ready=eq.true&location_zone=not.is.null&order=updated_at.desc&limit=200',
    token
  );
  const profiles = await enrichProfilesMedia(env, token, rows || []);
  const markers = await Promise.all(profiles.map(async (profile) => {
    if (profile.id === currentProfileId) return null;
    const coordinates = await geocodePublicZone(profile.location_zone);
    if (!coordinates) return null;
    const photo = primaryPhoto(profile);
    return {
      id: profile.id,
      type: 'member',
      profileType: profile.profile_type,
      name: profile.display_name,
      zone: profile.location_zone,
      latitude: coordinates.latitude + profileOffset(profile.id, 'latitude'),
      longitude: coordinates.longitude + profileOffset(profile.id, 'longitude'),
      photoUrl: photo?.previewUrl || null
    };
  }));
  return markers.filter(Boolean);
}

async function venueMarkers(env, token) {
  const rows = await restJson(
    env,
    '/rest/v1/venue_directory?select=id,name,kind,category_primary,category_tags,city,country_code,postal_code,address_public,website,verification_status&address_public=not.is.null&verification_status=neq.closed&order=name.asc&limit=500',
    token
  );
  const markers = await Promise.all((rows || []).map(async (venue) => {
    const coordinates = await geocodeVenueAddress(venue);
    if (!coordinates) return null;
    return {
      id: venue.id,
      type: 'venue',
      name: venue.name,
      kind: venue.kind,
      categoryPrimary: venue.category_primary,
      categoryTags: venue.category_tags || [],
      city: venue.city,
      countryCode: venue.country_code,
      address: venue.address_public,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      locationPrecision: coordinates.precision,
      positionSource: 'public_address_geocoding',
      website: venue.website,
      verificationStatus: venue.verification_status
    };
  }));
  return markers.filter(Boolean);
}

function eventCountryCode(value) {
  const text = String(value || '').toLocaleLowerCase('fr');
  return /\bbelg(?:ique|ium)\b/.test(text) ? 'BE' : 'FR';
}

async function eventMarkers(env, token, venues) {
  const [events, establishments] = await Promise.all([
    restJson(
      env,
      '/rest/v1/events?select=id,owner_type,establishment_id,organizer_profile_id,title,starts_at,location_public,audience,event_category,cap_zone,cap_venue,created_at,updated_at&visibility=eq.published&moderation_status=eq.approved&order=starts_at.asc&limit=200',
      token
    ),
    restJson(
      env,
      '/rest/v1/establishments?select=id,directory_venue_id,address_public,city&visibility=eq.published&limit=500',
      token
    )
  ]);
  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));
  const establishmentsById = new Map((establishments || []).map((row) => [row.id, row]));
  const markers = await Promise.all((events || []).map(async (event) => {
    if (new Date(event.starts_at) < new Date()) return null;
    const establishment = establishmentsById.get(event.establishment_id);
    const venue = venuesById.get(establishment?.directory_venue_id);
    const coordinates = venue || await geocodeVenueAddress({
      address_public: event.location_public || establishment?.address_public,
      city: establishment?.city,
      country_code: eventCountryCode(event.location_public || establishment?.address_public)
    });
    if (!coordinates) return null;
    return {
      id: event.id,
      type: 'event',
      ownerType: event.owner_type,
      organizerProfileId: event.organizer_profile_id,
      title: event.title,
      startsAt: event.starts_at,
      locationPublic: event.location_public,
      audience: event.audience,
      eventCategory: event.event_category,
      capZone: event.cap_zone,
      capVenue: event.cap_venue,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      locationPrecision: coordinates.locationPrecision || coordinates.precision || 'address',
      positionSource: 'public_address_geocoding'
    };
  }));
  return markers.filter(Boolean);
}

async function mapCenter(env, access, markers) {
  const [locationRows, preferenceRows] = await Promise.all([
    restJson(
      env,
      `/rest/v1/member_location_settings?select=enabled,latitude_bucket,longitude_bucket&user_id=eq.${encodeURIComponent(access.account.userId)}&limit=1`,
      access.session
    ),
    restJson(
      env,
      `/rest/v1/member_experience_preferences?select=discovery_radius_km&user_id=eq.${encodeURIComponent(access.account.userId)}&limit=1`,
      access.session
    ).catch(() => [])
  ]);
  const location = locationRows?.[0];
  const radiusKm = Math.max(
    10,
    Math.min(200, Number(preferenceRows?.[0]?.discovery_radius_km) || DEFAULT_EXPERIENCE.radiusKm)
  );
  if (location?.enabled) {
    const latitude = finite(location.latitude_bucket);
    const longitude = finite(location.longitude_bucket);
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude, zoom: radiusKm <= 25 ? 11 : radiusKm <= 75 ? 9 : 7, radiusKm, source: 'private_approximate_location' };
    }
  }
  if (markers.length) {
    return {
      latitude: markers.reduce((sum, marker) => sum + marker.latitude, 0) / markers.length,
      longitude: markers.reduce((sum, marker) => sum + marker.longitude, 0) / markers.length,
      zoom: markers.length > 8 ? 6 : 7,
      radiusKm,
      source: 'visible_markers'
    };
  }
  return { ...DEFAULT_CENTER, radiusKm, source: 'france' };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const [members, venues] = await Promise.all([
      memberMarkers(env, access.session, admission.admission.id),
      venueMarkers(env, access.session)
    ]);
    const events = await eventMarkers(env, access.session, venues);
    const markers = [...members, ...venues];
    return withSession({
      center: await mapCenter(env, access, markers),
      members,
      venues,
      events,
      privacy: {
        exactMemberCoordinatesExposed: false,
        memberMarkerMeaning: 'Centre approximatif de la zone publique déclarée',
        venueMarkerMeaning: 'Position calculée depuis l’adresse publique de l’établissement'
      }
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'member_map_failed' }, 400);
  }
}
