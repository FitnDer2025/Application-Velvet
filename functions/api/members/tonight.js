import { json, readJson } from '../auth/_shared.js';
import {
  cleanList,
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { enrichProfilesMedia } from './media.js';

const INTENTS = new Set(['go_out', 'meet', 'chat', 'spontaneous']);
const VENUE_MODES = new Set(['club', 'spa', 'bar', 'private', 'open']);
const PROFILE_TYPES = new Set(['couple', 'woman', 'man']);

function allowedList(value, allowed, max = 6) {
  return cleanList(value, max, 40).filter((item) => allowed.has(item));
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

async function admittedAccess(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return access;
  const admission = await requireAdmittedMember(env, access);
  if (admission.response) return { response: admission.response };
  return { ...access, profileId: admission.admission.id };
}

function profileMap(profiles = []) {
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

async function readTonight(env, access) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 60 * 60 * 1000);
  const rows = await restJson(
    env,
    `/rest/v1/member_tonight_statuses?select=profile_id,created_by_user_id,intent,venue_mode,wanted_profile_types,radius_km,location_label,note,starts_at,expires_at,updated_at,member_profiles(id,profile_type,display_name,location_zone,verification_status,media_assets(id,individual_profile_id,owner_user_id,media_role,is_primary,storage_path,moderation_status,created_at))&expires_at=gt.${encodeURIComponent(now.toISOString())}&order=updated_at.desc&limit=200`,
    access.session
  );

  const rawProfiles = (rows || []).map((row) => row.member_profiles).filter(Boolean);
  const profiles = await enrichProfilesMedia(env, access.session, rawProfiles);
  const byId = profileMap(profiles);
  const statuses = (rows || []).map(({ member_profiles: _profile, created_by_user_id: _owner, ...status }) => ({
    ...status,
    profile: byId.get(status.profile_id) || null
  }));

  const own = statuses.find((status) => status.profile_id === access.profileId) || null;
  const nearby = statuses.filter((status) => status.profile_id !== access.profileId && status.profile);

  const events = await restJson(
    env,
    `/rest/v1/events?select=id,owner_type,establishment_id,organizer_profile_id,title,description,starts_at,ends_at,capacity,location_public,audience,price_cents,currency,registration_open,dress_code&visibility=eq.published&starts_at=gte.${encodeURIComponent(now.toISOString())}&starts_at=lte.${encodeURIComponent(horizon.toISOString())}&order=starts_at.asc&limit=100`,
    access.session
  ).catch(() => []);

  return {
    generatedAt: now.toISOString(),
    expiresPolicyHours: 12,
    privacy: 'Zwit Tonight ne publie jamais la position GPS exacte d’un membre. Seule la zone choisie est partagée.',
    own,
    people: nearby,
    events: events || []
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await admittedAccess(request, env);
    if (access.response) return access.response;
    return withSession({ tonight: await readTonight(env, access) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'tonight_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await admittedAccess(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const intent = INTENTS.has(body.intent) ? body.intent : 'meet';
    const venueMode = allowedList(body.venueMode, VENUE_MODES);
    const wantedProfileTypes = allowedList(body.wantedProfileTypes, PROFILE_TYPES);
    const radiusKm = Math.round(clamp(body.radiusKm, 10, 200, 50));
    const durationHours = clamp(body.durationHours, 1, 12, 6);
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);
    const locationLabel = cleanText(body.locationLabel, 120) || null;
    const note = cleanText(body.note, 280) || null;

    await restJson(
      env,
      '/rest/v1/member_tonight_statuses?on_conflict=profile_id',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          profile_id: access.profileId,
          created_by_user_id: access.account.userId,
          intent,
          venue_mode: venueMode,
          wanted_profile_types: wantedProfileTypes,
          radius_km: radiusKm,
          location_label: locationLabel,
          note,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: startsAt.toISOString()
        })
      }
    );

    return withSession({ ok: true, tonight: await readTonight(env, access) }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'tonight_write_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await admittedAccess(request, env);
    if (access.response) return access.response;
    await restJson(
      env,
      `/rest/v1/member_tonight_statuses?profile_id=eq.${encodeURIComponent(access.profileId)}`,
      access.session,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
    return withSession({ ok: true, tonight: await readTonight(env, access) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'tonight_delete_failed' }, 400);
  }
}
