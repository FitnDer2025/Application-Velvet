import { json } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { enrichProfilesMedia, signedMediaUrl } from './media.js';
import { geocodeVenueAddress } from './venue-geocoding.js';

const PROFILE_SELECT = [
  'id', 'profile_type', 'display_name', 'location_zone', 'description', 'search_text',
  'practices', 'values_list', 'created_at', 'updated_at', 'profile_photo_ready',
  'individual_profiles(id,first_name,gender_identity,birth_year,attracted_to,desired_practices)',
  'media_assets(id,media_role,is_primary,storage_path,moderation_status,created_at)'
].join(',');
const geocodeCache = new Map();

function number(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanZone(value) {
  return String(value || '')
    .replace(/\bet\s+(ses\s+)?alentours\b/gi, '')
    .replace(/\bsecteur\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

async function geocodeZone(value) {
  const zone = cleanZone(value);
  if (zone.length < 2) return null;
  if (geocodeCache.has(zone)) return geocodeCache.get(zone);
  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(zone)}&fields=nom,centre&boost=population&limit=1`,
        { headers: { accept: 'application/json' }, signal: controller.signal }
      );
      if (!response.ok) return null;
      const rows = await response.json();
      const coordinates = rows?.[0]?.centre?.coordinates;
      if (!Array.isArray(coordinates)) return null;
      return { longitude: number(coordinates[0]), latitude: number(coordinates[1]) };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  geocodeCache.set(zone, task);
  return task;
}

function haversine(left, right) {
  if (!left || !right || left.latitude === null || left.longitude === null
    || right.latitude === null || right.longitude === null) return null;
  const radius = 6371;
  const lat1 = left.latitude * Math.PI / 180;
  const lat2 = right.latitude * Math.PI / 180;
  const dLat = (right.latitude - left.latitude) * Math.PI / 180;
  const dLon = (right.longitude - left.longitude) * Math.PI / 180;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function profileAudience(profile) {
  if (profile.profile_type === 'couple') return 'couple';
  const gender = String(profile.individual_profiles?.[0]?.gender_identity || '').toLocaleLowerCase('fr');
  if (gender.includes('femme') && !gender.includes('trans')) return 'woman';
  if (gender.includes('homme') && !gender.includes('trans')) return 'man';
  if (gender.includes('trans') || gender.includes('non binaire')) return 'trans_nonbinary';
  return 'other';
}

function ageLabel(profile) {
  const year = new Date().getUTCFullYear();
  const ages = (profile.individual_profiles || [])
    .map((person) => number(person.birth_year))
    .filter(Boolean)
    .map((birthYear) => Math.max(18, year - birthYear));
  if (!ages.length) return null;
  return ages.map((age) => `${age} ans`).join(' · ');
}

function demographicLabel(profile) {
  if (profile.profile_type === 'couple') return 'Couple';
  return {
    woman: 'Femme seule',
    man: 'Homme seul',
    trans_nonbinary: 'Profil trans / non-binaire',
    other: 'Profil individuel'
  }[profileAudience(profile)];
}

function primaryPhoto(profile) {
  const candidates = (profile.media_assets || [])
    .filter((media) => media.moderation_status === 'approved' && media.previewUrl)
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary)));
  return candidates[0]?.previewUrl || null;
}

function setOf(values) {
  return new Set((values || []).map((value) => String(value).toLocaleLowerCase('fr')));
}

function intersectionCount(left, right) {
  let count = 0;
  left.forEach((value) => { if (right.has(value)) count += 1; });
  return count;
}

function compatibilityScore(current, candidate, reaction, recommendationCount, distanceKm) {
  const currentPractices = setOf([
    ...(current.practices || []),
    ...(current.individual_profiles || []).flatMap((person) => person.desired_practices || [])
  ]);
  const candidatePractices = setOf([
    ...(candidate.practices || []),
    ...(candidate.individual_profiles || []).flatMap((person) => person.desired_practices || [])
  ]);
  const currentValues = setOf(current.values_list);
  const candidateValues = setOf(candidate.values_list);
  const attractions = setOf((current.individual_profiles || []).flatMap((person) => person.attracted_to || []));
  const audienceLabels = {
    couple: ['couple', 'couples'], woman: ['femme', 'femmes'], man: ['homme', 'hommes'],
    trans_nonbinary: ['trans', 'non-binaire', 'non binaires'], other: ['selon le feeling']
  }[profileAudience(candidate)] || [];

  let score = 28;
  score += Math.min(24, intersectionCount(currentPractices, candidatePractices) * 6);
  score += Math.min(16, intersectionCount(currentValues, candidateValues) * 4);
  if (audienceLabels.some((label) => attractions.has(label))) score += 18;
  score += Math.min(12, recommendationCount * 4);
  if (reaction > 0) score += reaction * 8;
  if (reaction < 0) score -= 80;
  if (distanceKm !== null) score += Math.max(-12, 14 - distanceKm / 8);
  const createdAgeDays = (Date.now() - new Date(candidate.created_at || 0).getTime()) / 86400000;
  if (createdAgeDays <= 14) score += 8;
  else if (createdAgeDays <= 45) score += 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function eventLocation(event, establishmentsById, venuesById) {
  const establishment = establishmentsById.get(event.establishment_id);
  const venue = venuesById.get(establishment?.directory_venue_id);
  if (venue?.latitude !== undefined && venue?.longitude !== undefined) {
    return { latitude: number(venue.latitude), longitude: number(venue.longitude) };
  }
  return null;
}

function sortProfiles(rows, sort) {
  return [...rows].sort((left, right) => {
    if (sort === 'compatibility') return right.compatibilityScore - left.compatibilityScore;
    if (sort === 'recent') return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    if (sort === 'affinity') return right.reaction - left.reaction || right.compatibilityScore - left.compatibilityScore;
    const leftDistance = left.distanceKm ?? Number.MAX_SAFE_INTEGER;
    const rightDistance = right.distanceKm ?? Number.MAX_SAFE_INTEGER;
    return leftDistance - rightDistance || right.compatibilityScore - left.compatibilityScore;
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const token = access.session;

    const [profileRows, rawCandidates, preferenceRows, locationRows, favorites, reactions, recommendations,
      venueCatalog, venueRelationships, establishments, events] = await Promise.all([
      restJson(env, `/rest/v1/member_profiles?select=${encodeURIComponent(PROFILE_SELECT)}&id=eq.${encodeURIComponent(admission.admission.id)}&limit=1`, token),
      restJson(env, `/rest/v1/member_profiles?select=${encodeURIComponent(PROFILE_SELECT)}&id=neq.${encodeURIComponent(admission.admission.id)}&visibility=in.(beta_members,published)&profile_photo_ready=eq.true&order=updated_at.desc&limit=300`, token),
      restJson(env, `/rest/v1/member_experience_preferences?select=discovery_radius_km,profile_sort,ai_personalization_enabled&user_id=eq.${encodeURIComponent(access.account.userId)}&limit=1`, token).catch(() => []),
      restJson(env, `/rest/v1/member_location_settings?select=enabled,latitude_bucket,longitude_bucket&user_id=eq.${encodeURIComponent(access.account.userId)}&limit=1`, token),
      restJson(env, `/rest/v1/favorites?select=profile_id,created_at&owner_user_id=eq.${encodeURIComponent(access.account.userId)}&order=created_at.desc`, token),
      restJson(env, `/rest/v1/profile_reactions?select=target_profile_id,reaction,updated_at&reactor_profile_id=eq.${encodeURIComponent(admission.admission.id)}`, token),
      restJson(env, '/rest/v1/recommendations?select=id,author_profile_id,target_type,target_id,body,rating,created_at&status=eq.published&order=created_at.desc&limit=800', token),
      restJson(env, '/rest/v1/rpc/member_venue_catalog', token, { method: 'POST', body: '{}' }),
      restJson(env, `/rest/v1/profile_venue_relationships?select=venue_id,relation_type,occurred_on,updated_at&profile_id=eq.${encodeURIComponent(admission.admission.id)}`, token),
      restJson(env, '/rest/v1/establishments?select=id,directory_venue_id,name,kind,description,city,verified_at&visibility=eq.published&order=name.asc&limit=500', token),
      restJson(env, '/rest/v1/events?select=id,owner_type,establishment_id,organizer_profile_id,title,description,starts_at,ends_at,capacity,location_public,audience,price_cents,currency,registration_open,dress_code,event_category,cap_zone,cap_venue,created_at,updated_at&visibility=eq.published&moderation_status=eq.approved&starts_at=gte.now()&order=starts_at.asc&limit=300', token)
    ]);

    const current = (await enrichProfilesMedia(env, token, profileRows || []))?.[0];
    if (!current) return withSession({ error: 'profile_required' }, token, 409);
    const candidates = await enrichProfilesMedia(env, token, rawCandidates || []);
    const preferences = preferenceRows?.[0] || {};
    const radiusKm = Math.max(10, Math.min(200, number(preferences.discovery_radius_km, 50)));
    const profileSort = String(preferences.profile_sort || 'distance');
    const location = locationRows?.[0];
    const center = location?.enabled
      ? { latitude: number(location.latitude_bucket), longitude: number(location.longitude_bucket) }
      : null;
    const reactionByProfile = new Map((reactions || []).map((row) => [row.target_profile_id, number(row.reaction, 0)]));
    const recommendationsByTarget = new Map();
    (recommendations || []).forEach((row) => {
      if (row.target_type !== 'profile' || !row.target_id) return;
      recommendationsByTarget.set(row.target_id, (recommendationsByTarget.get(row.target_id) || 0) + 1);
    });

    const rankedProfiles = await Promise.all(candidates.map(async (candidate) => {
      const coordinates = await geocodeZone(candidate.location_zone);
      const distanceKm = haversine(center, coordinates);
      const reaction = reactionByProfile.get(candidate.id) || 0;
      const recommendationCount = recommendationsByTarget.get(candidate.id) || 0;
      return {
        id: candidate.id,
        displayName: candidate.display_name,
        profileType: candidate.profile_type,
        audience: profileAudience(candidate),
        demographicLabel: demographicLabel(candidate),
        ageLabel: ageLabel(candidate),
        locationZone: candidate.location_zone,
        photoUrl: primaryPhoto(candidate),
        createdAt: candidate.created_at,
        updatedAt: candidate.updated_at,
        practices: candidate.practices || [],
        values: candidate.values_list || [],
        distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
        reaction,
        recommendationCount,
        compatibilityScore: compatibilityScore(
          current,
          candidate,
          reaction,
          recommendationCount,
          distanceKm
        )
      };
    }));
    const sortedProfiles = sortProfiles(rankedProfiles, profileSort);
    const curatedProfiles = sortedProfiles
      .filter((profile) => profile.reaction >= 0)
      .filter((profile) => profile.compatibilityScore >= 52 || profile.recommendationCount > 0)
      .filter((profile) => profile.distanceKm === null || profile.distanceKm <= radiusKm * 1.5)
      .slice(0, 12);

    const venuesById = new Map((venueCatalog || []).map((venue) => [venue.id, venue]));
    const establishmentsById = new Map((establishments || []).map((row) => [row.id, row]));
    const frequentedVenueIds = new Set((venueRelationships || [])
      .filter((row) => ['visited', 'favorite', 'regular'].includes(row.relation_type))
      .map((row) => row.venue_id));
    const clubKinds = /club|spa|bar/i;
    const nearbyClubs = (venueCatalog || [])
      .filter((venue) => clubKinds.test(`${venue.kind || ''} ${venue.category_primary || ''}`))
      .map((venue) => ({
        ...venue,
        distanceKm: number(venue.distance_km),
        frequented: frequentedVenueIds.has(venue.id)
      }))
      .filter((venue) => venue.frequented || venue.distanceKm === null || venue.distanceKm <= radiusKm)
      .sort((left, right) => Number(right.frequented) - Number(left.frequented)
        || (left.distanceKm ?? 9999) - (right.distanceKm ?? 9999))
      .slice(0, 30);

    const nearbyEvents = [];
    for (const event of events || []) {
      let coordinates = eventLocation(event, establishmentsById, venuesById);
      if (!coordinates) {
        coordinates = await geocodeVenueAddress({
          address_public: event.location_public,
          city: event.location_public,
          country_code: /belg/i.test(event.location_public || '') ? 'BE' : 'FR'
        }).catch(() => null);
      }
      const distanceKm = haversine(center, coordinates);
      const establishment = establishmentsById.get(event.establishment_id);
      const frequented = frequentedVenueIds.has(establishment?.directory_venue_id);
      if (!frequented && distanceKm !== null && distanceKm > radiusKm) continue;
      nearbyEvents.push({
        ...event,
        distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
        frequentedClub: frequented
      });
    }

    const followedIds = new Set((favorites || []).map((row) => row.profile_id));
    const followedProfiles = new Map(candidates.filter((profile) => followedIds.has(profile.id)).map((profile) => [profile.id, profile]));
    const followedActivities = [];
    for (const profile of followedProfiles.values()) {
      const latestMedia = (profile.media_assets || [])
        .filter((media) => media.moderation_status === 'approved')
        .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))[0];
      if (latestMedia) {
        followedActivities.push({
          id: `media-${latestMedia.id}`,
          type: 'photo',
          profileId: profile.id,
          profileName: profile.display_name,
          title: `${profile.display_name} a publié une nouvelle photo`,
          createdAt: latestMedia.created_at,
          previewUrl: latestMedia.previewUrl || null
        });
      }
    }
    (events || []).filter((event) => followedIds.has(event.organizer_profile_id)).forEach((event) => {
      const profile = followedProfiles.get(event.organizer_profile_id);
      followedActivities.push({
        id: `event-${event.id}`,
        type: 'event',
        profileId: event.organizer_profile_id,
        eventId: event.id,
        profileName: profile?.display_name || 'Profil suivi',
        title: `${profile?.display_name || 'Un profil suivi'} a publié une sortie`,
        detail: event.title,
        createdAt: event.created_at
      });
    });
    (recommendations || []).filter((row) => followedIds.has(row.author_profile_id)).forEach((row) => {
      const profile = followedProfiles.get(row.author_profile_id);
      followedActivities.push({
        id: `recommendation-${row.id}`,
        type: 'recommendation',
        profileId: row.author_profile_id,
        profileName: profile?.display_name || 'Profil suivi',
        title: `${profile?.display_name || 'Un profil suivi'} a publié une recommandation`,
        detail: row.body,
        createdAt: row.created_at
      });
    });
    followedActivities.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

    return withSession({
      generatedAt: new Date().toISOString(),
      preferences: {
        radiusKm,
        profileSort,
        aiPersonalizationEnabled: preferences.ai_personalization_enabled !== false,
        locationEnabled: Boolean(location?.enabled)
      },
      curatedProfiles,
      nearbyClubs,
      nearbyEvents: nearbyEvents.slice(0, 40),
      followedActivities: followedActivities.slice(0, 30),
      allProfiles: sortedProfiles,
      explanation: 'Velvet Intelligence combine proximité, compatibilité déclarée, pratiques communes, recommandations, nouveauté et glaçon/flammes. Les coordonnées exactes ne sont jamais exposées.'
    }, token);
  } catch (error) {
    return json({ error: error.message || 'home_intelligence_failed' }, 400);
  }
}
