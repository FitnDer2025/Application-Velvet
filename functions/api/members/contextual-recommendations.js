import { json } from '../auth/_shared.js';
import { memberSession, requireAdmittedMember, withSession } from './_shared.js';

const arr = (v) => Array.isArray(v) ? v : [];
const firstArray = (...values) => values.find(Array.isArray) || [];
const idOf = (item) => item?.profileId || item?.profile_id || item?.eventId || item?.event_id || item?.venueId || item?.venue_id || item?.establishment_id || item?.id || '';
const titleOf = (item) => item?.displayName || item?.display_name || item?.title || item?.name || 'Suggestion Zwit';
const subtitleOf = (item) => item?.locationZone || item?.location_zone || item?.city || item?.location_public || '';
const imageOf = (item) => item?.photoUrl || item?.photo_url || item?.previewUrl || item?.preview_url || item?.coverUrl || item?.cover_url || null;

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = idOf(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function feedbackMap(payload) {
  return new Map(arr(payload?.feedback).map((row) => [`${row.entity_type}:${row.entity_id}`, row.signal]));
}

function soon(event) {
  const raw = event?.starts_at || event?.startsAt || event?.date;
  const time = new Date(raw || 0).getTime();
  if (!time || Number.isNaN(time)) return null;
  const hours = (time - Date.now()) / 3_600_000;
  return hours >= -1 && hours <= 18 ? hours : null;
}

function profileScore(item, tonight) {
  let score = 0;
  const reasons = [];
  const tonightIds = new Set(firstArray(tonight?.members, tonight?.profiles, tonight?.availableMembers).map(idOf));
  if (tonightIds.has(idOf(item))) { score += 45; reasons.push('Disponible maintenant'); }
  const distance = Number(item?.distance_km ?? item?.distanceKm);
  if (Number.isFinite(distance) && distance >= 0 && distance <= 50) {
    score += Math.max(5, 22 - Math.round(distance / 4));
    reasons.push(distance <= 15 ? 'Tout près de vous' : 'Dans votre rayon');
  } else if (subtitleOf(item)) { score += 8; reasons.push('Zone compatible avec votre recherche'); }
  if (item?.shared_practices?.length || item?.sharedPractices?.length || item?.reasons?.length) { score += 18; reasons.push('Plusieurs envies semblent se recouper'); }
  if (item?.last_seen_at || item?.lastSeenAt || item?.active_now) { score += 8; reasons.push('Activité récente'); }
  return { score, reasons: reasons.slice(0, 3) };
}

function eventScore(item) {
  let score = 10;
  const reasons = [];
  const hours = soon(item);
  if (hours != null) { score += hours <= 6 ? 45 : 30; reasons.push(hours <= 6 ? 'Dans les prochaines heures' : 'Prévu très prochainement'); }
  const registrations = Number(item?.participants_count ?? item?.participantCount ?? item?.registrations_count ?? 0);
  if (registrations > 0) { score += Math.min(18, registrations); reasons.push('Des membres Zwit ont déjà prévu d’y aller'); }
  if (item?.establishment_id || item?.venue_id || item?.venueId) { score += 8; reasons.push('Lié à un lieu référencé'); }
  return { score, reasons: reasons.slice(0, 3) };
}

function venueScore(item, events) {
  let score = 8;
  const reasons = [];
  const id = idOf(item);
  const upcoming = events.filter((event) => String(event?.establishment_id || event?.venue_id || event?.venueId || '') === String(id) && soon(event) != null);
  if (upcoming.length) { score += 38; reasons.push(`${upcoming.length} sortie${upcoming.length > 1 ? 's' : ''} bientôt`); }
  if (item?.relationship === 'favorite' || item?.favorite || item?.is_favorite) { score += 20; reasons.push('Lieu que vous avez enregistré'); }
  if (item?.subscription_status === 'active' || item?.verified || item?.is_verified) { score += 8; reasons.push('Établissement Zwit actif'); }
  if (subtitleOf(item)) reasons.push(subtitleOf(item));
  return { score, reasons: reasons.slice(0, 3) };
}

function pick(items, type, scorer, feedback) {
  const candidate = unique(items)
    .filter((item) => feedback.get(`${type}:${idOf(item)}`) !== 'dismiss')
    .map((item) => {
      const result = scorer(item);
      if (feedback.get(`${type}:${idOf(item)}`) === 'more_like_this') result.score += 14;
      return { item, ...result };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (!candidate) return null;
  return {
    type,
    id: idOf(candidate.item),
    title: titleOf(candidate.item),
    subtitle: subtitleOf(candidate.item),
    imageUrl: imageOf(candidate.item),
    reasons: candidate.reasons,
    explanation: candidate.reasons.length ? candidate.reasons.join(' · ') : 'Cette suggestion correspond à votre contexte actuel.'
  };
}

async function internalJson(request, path) {
  const url = new URL(path, request.url);
  const headers = new Headers();
  for (const name of ['cookie', 'authorization', 'x-velvet-client']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('accept', 'application/json');
  const response = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  if (!response.ok) return {};
  return response.json().catch(() => ({}));
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const results = await Promise.allSettled([
      internalJson(request, '/api/members/home-intelligence'),
      internalJson(request, '/api/members/tonight'),
      internalJson(request, '/api/members/events'),
      internalJson(request, '/api/members/directory'),
      internalJson(request, '/api/members/recommendation-feedback')
    ]);
    const [home, tonight, eventsPayload, directory, feedbackPayload] = results.map((r) => r.status === 'fulfilled' ? r.value : {});
    const feedback = feedbackMap(feedbackPayload);
    const eventItems = unique([
      ...firstArray(tonight?.events, tonight?.nearbyEvents),
      ...firstArray(eventsPayload?.events, eventsPayload?.items, eventsPayload?.upcoming),
      ...firstArray(home?.events, home?.recommendedEvents)
    ]);
    const profileItems = unique([
      ...firstArray(tonight?.members, tonight?.profiles, tonight?.availableMembers),
      ...firstArray(home?.recommendations, home?.profiles, home?.nearbyProfiles, home?.suggestedProfiles),
      ...firstArray(home?.people, home?.members)
    ]);
    const venueItems = unique([
      ...firstArray(directory?.venues, directory?.items, directory?.catalog),
      ...firstArray(home?.venues, home?.recommendedVenues)
    ]);

    return withSession({
      generatedAt: new Date().toISOString(),
      philosophy: 'explainable_context_not_compatibility_percentage',
      recommendations: [
        pick(profileItems, 'profile', (item) => profileScore(item, tonight), feedback),
        pick(eventItems, 'event', eventScore, feedback),
        pick(venueItems, 'venue', (item) => venueScore(item, eventItems), feedback)
      ].filter(Boolean)
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'contextual_recommendations_failed' }, 400);
  }
}
