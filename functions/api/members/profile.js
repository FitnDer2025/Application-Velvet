import { json, readJson } from '../auth/_shared.js';
import {
  cleanList,
  cleanText,
  memberSession,
  restJson,
  withSession
} from './_shared.js';

const PROFILE_SELECT = [
  'id',
  'profile_type',
  'display_name',
  'city',
  'location_zone',
  'story',
  'description',
  'search_text',
  'practices',
  'values_list',
  'visibility',
  'relationship_since',
  'journey',
  'favorite_places',
  'availability_text',
  'created_at',
  'updated_at',
  'individual_profiles(*)',
  'albums(id,name,confidentiality,expires_at,created_at)',
  'profile_members!inner(user_id,member_slot,status)'
].join(',');

async function myProfile(env, session) {
  const rows = await restJson(
    env,
    `/rest/v1/member_profiles?select=${encodeURIComponent(PROFILE_SELECT)}&profile_members.user_id=eq.${encodeURIComponent(session.user.id)}&profile_members.status=in.(active,pending)&limit=1`,
    session
  );
  return rows?.[0] || null;
}

function nullableNumber(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

function normalizePerson(person = {}) {
  const currentYear = new Date().getUTCFullYear();
  const genderIdentities = [
    'Homme',
    'Femme',
    'Homme trans',
    'Femme trans',
    'Personne non binaire',
    'Autre identité',
    'Information privée'
  ];
  const genderIdentity = cleanText(person.gender_identity, 80);
  if (!genderIdentities.includes(genderIdentity)) {
    throw new Error('gender_identity_required');
  }
  return {
    first_name: cleanText(person.first_name, 80),
    gender_identity: genderIdentity,
    birth_year: nullableNumber(person.birth_year, 1900, currentYear - 18),
    height_cm: nullableNumber(person.height_cm, 100, 250),
    weight_kg: nullableNumber(person.weight_kg, 30, 350),
    morphology: cleanText(person.morphology, 80),
    hair_color: cleanText(person.hair_color, 80),
    eye_color: cleanText(person.eye_color, 80),
    children_status: ['yes', 'no', 'private'].includes(person.children_status)
      ? person.children_status
      : 'private',
    profession: cleanText(person.profession, 120),
    profession_private: person.profession_private !== false,
    orientation: cleanText(person.orientation, 120),
    frequency: cleanText(person.frequency, 120),
    biography: cleanText(person.biography, 4000),
    attracted_to: cleanList(person.attracted_to),
    desired_practices: cleanList(person.desired_practices),
    partner_permissions: cleanList(person.partner_permissions),
    visibility: {
      ...(typeof person.visibility === 'object' && person.visibility ? person.visibility : {}),
      gender_identity: genderIdentity
    }
  };
}

function normalizeProfile(body) {
  const profileType = body.profile_type === 'individual' ? 'individual' : 'couple';
  const person = normalizePerson(body.person || body.people?.[0] || {});
  if (person.first_name.length < 2) throw new Error('first_names_required');

  const payload = {
    profile_type: profileType,
    display_name: cleanText(body.display_name, 120),
    city: cleanText(body.city, 120),
    location_zone: cleanText(body.location_zone, 160),
    description: cleanText(body.description, 4000),
    story: cleanText(body.story, 8000),
    search_text: cleanText(body.search_text, 4000),
    journey: cleanText(body.journey, 4000),
    relationship_since: nullableNumber(body.relationship_since, 1900, new Date().getUTCFullYear()),
    availability_text: cleanText(body.availability_text, 1000),
    practices: cleanList(body.practices),
    values_list: cleanList(body.values_list),
    favorite_places: cleanList(body.favorite_places),
    person
  };

  if (payload.display_name.length < 2 || payload.description.length < 20) {
    throw new Error('profile_identity_required');
  }
  return payload;
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const profile = await myProfile(env, access.session);
    const membership = profile?.profile_members?.[0] || null;
    const personalProfileComplete = Boolean(
      profile?.individual_profiles?.some((person) => person.linked_user_id === access.account.userId)
    );
    return withSession({
      profile,
      membership,
      personalProfileComplete,
      account: access.account
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'profile_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const raw = await readJson(request);
    if (JSON.stringify(raw).length > 40000) {
      return json({ error: 'profile_payload_too_large' }, 413);
    }
    const profilePayload = normalizeProfile(raw);
    await restJson(
      env,
      '/rest/v1/rpc/upsert_my_beta_profile',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({ profile_payload: profilePayload })
      }
    );
    return withSession({
      ok: true,
      profile: await myProfile(env, access.session)
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'profile_write_failed' }, 400);
  }
}
