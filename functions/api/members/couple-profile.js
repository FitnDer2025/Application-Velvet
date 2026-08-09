import { json, readJson } from '../auth/_shared.js';
import {
  cleanList,
  cleanText,
  memberSession,
  restJson,
  withSession
} from './_shared.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nullableYear(value) {
  if (value === '' || value === null || value === undefined) return null;
  const year = Number(value);
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < 1900 || year > currentYear) return null;
  return year;
}

function normalizeSharedProfile(body = {}) {
  const payload = {
    display_name: cleanText(body.display_name, 120),
    city: cleanText(body.city, 120),
    location_zone: cleanText(body.location_zone, 160),
    description: cleanText(body.description, 4000),
    story: cleanText(body.story, 8000),
    journey: cleanText(body.journey, 4000),
    search_text: cleanText(body.search_text, 4000),
    relationship_since: nullableYear(body.relationship_since),
    availability_text: cleanText(body.availability_text, 1000),
    practices: cleanList(body.practices),
    values_list: cleanList(body.values_list),
    favorite_places: cleanList(body.favorite_places)
  };
  if (payload.display_name.length < 2 || payload.description.length < 20) {
    throw new Error('profile_identity_required');
  }
  return payload;
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const raw = await readJson(request);
    if (JSON.stringify(raw).length > 30000) {
      return json({ error: 'profile_payload_too_large' }, 413);
    }
    const profilePayload = normalizeSharedProfile(raw);
    const result = await restJson(
      env,
      '/rest/v1/rpc/create_my_couple_profile',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({ profile_payload: profilePayload })
      }
    );
    const profileId = String(result || '');
    if (!UUID.test(profileId)) throw new Error('couple_profile_persistence_failed');
    const persisted = await restJson(
      env,
      `/rest/v1/member_profiles?select=id,profile_type,profile_members!inner(user_id,status)&id=eq.${encodeURIComponent(profileId)}&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
      access.session
    );
    if (persisted?.[0]?.id !== profileId || persisted?.[0]?.profile_type !== 'couple') {
      throw new Error('couple_profile_persistence_failed');
    }
    return withSession({ ok: true, profileId }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'couple_profile_write_failed' }, 400);
  }
}
