import { json } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { enrichProfilesMedia } from './media.js';

const DEFAULT_CENTER = { latitude: 46.603354, longitude: 1.888334, zoom: 5 };
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
    '/rest/v1/member_profiles?select=id,profile_type,display_name,location_zone,media_assets(id,is_primary,storage_path,moderation_status,media_role)&visibility=in.(beta_members,published)&location_zone=not.is.null&order=updated_at.desc&limit=100',
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
    '/rest/v1/venue_directory?select=id,name,kind,category_primary,category_tags,city,country_code,address_public,latitude,longitude,website,verification_status&latitude=not.is.null&longitude=not.is.null&verification_status=neq.closed&order=name.asc&limit=500',
    token
  );
  return (rows || []).map((venue) => ({
    id: venue.id,
    type: 'venue',
    name: venue.name,
    kind: venue.kind,
    categoryPrimary: venue.category_primary,
    categoryTags: venue.category_tags || [],
    city: venue.city,
    countryCode: venue.country_code,
    address: venue.address_public,
    latitude: finite(venue.latitude),
    longitude: finite(venue.longitude),
    website: venue.website,
    verificationStatus: venue.verification_status
  })).filter((venue) => venue.latitude !== null && venue.longitude !== null);
}

async function mapCenter(env, access, markers) {
  const rows = await restJson(
    env,
    `/rest/v1/member_location_settings?select=enabled,latitude_bucket,longitude_bucket&user_id=eq.${encodeURIComponent(access.account.userId)}&limit=1`,
    access.session
  );
  const location = rows?.[0];
  if (location?.enabled) {
    const latitude = finite(location.latitude_bucket);
    const longitude = finite(location.longitude_bucket);
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude, zoom: 10, radiusKm: 50, source: 'private_approximate_location' };
    }
  }
  if (markers.length) {
    return {
      latitude: markers.reduce((sum, marker) => sum + marker.latitude, 0) / markers.length,
      longitude: markers.reduce((sum, marker) => sum + marker.longitude, 0) / markers.length,
      zoom: markers.length > 8 ? 6 : 7,
      source: 'visible_markers'
    };
  }
  return { ...DEFAULT_CENTER, source: 'france' };
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
    const markers = [...members, ...venues];
    return withSession({
      center: await mapCenter(env, access, markers),
      members,
      venues,
      privacy: {
        exactMemberCoordinatesExposed: false,
        memberMarkerMeaning: 'Centre approximatif de la zone publique déclarée',
        venueMarkerMeaning: 'Coordonnées publiques de l’établissement'
      }
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'member_map_failed' }, 400);
  }
}
