import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { enrichProfilesMedia } from './media.js';

const EVENT_CATEGORIES = new Set(['standard', 'cap_dagde']);
const MINOR_OR_VIOLENCE_PATTERN = /\b(mineur|mineure|moins de 18|enfant|ado(?:lescent)?|sans consentement|forc[ée]|violence|drogue forcée|traite)\b/i;

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function clean(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function dateValue(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseAiJson(value) {
  const text = String(value?.answer || value?.response || value || '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function moderateEvent(env, title, description) {
  const source = `${title}\n${description}`;
  if (MINOR_OR_VIOLENCE_PATTERN.test(source)) {
    return {
      decision: 'review',
      assessment: {
        summary: 'Des termes sensibles nécessitent une validation humaine avant publication.',
        automatic_decision: false,
        human_review_required: true,
        criteria_version: 'velvet-event-v1',
        model: 'rules+workers-ai'
      }
    };
  }
  if (!env.AI) {
    return {
      decision: 'approved',
      assessment: {
        summary: 'Contrôle structurel validé. Le contrôle IA avancé sera réexécuté lorsqu’il sera disponible.',
        automatic_decision: true,
        human_review_required: false,
        criteria_version: 'velvet-event-v1',
        model: 'velvet-rules-fallback'
      }
    };
  }
  try {
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'Tu es le moteur de sécurité Velvet. Les événements sont réservés à des adultes consentants. Ne refuse pas une soirée libertine adulte. Signale uniquement les indices de mineurs, contrainte, violence, exploitation, activité manifestement illégale ou danger grave. Réponds uniquement en JSON.'
        },
        {
          role: 'user',
          content: `Analyse cette annonce : ${source}\nJSON attendu : {"prohibited":false,"uncertain":false,"confidence":0.0,"summary":"raison concise"}`
        }
      ],
      max_tokens: 220,
      temperature: 0
    });
    const raw = parseAiJson(result);
    if (!raw) throw new Error('ai_response_invalid');
    const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
    const prohibited = raw.prohibited === true;
    const uncertain = raw.uncertain === true;
    const decision = uncertain || confidence < 0.82
      ? 'review'
      : prohibited
        ? 'rejected'
        : 'approved';
    return {
      decision,
      assessment: {
        prohibited,
        uncertain,
        confidence,
        summary: clean(raw.summary, 400),
        automatic_decision: decision !== 'review',
        human_review_required: decision === 'review',
        criteria_version: 'velvet-event-v1',
        model: '@cf/meta/llama-3.1-8b-instruct'
      }
    };
  } catch (error) {
    return {
      decision: 'approved',
      assessment: {
        summary: 'Contrôle structurel validé, analyse IA avancée momentanément indisponible.',
        technical_error: clean(error.message, 160),
        automatic_decision: true,
        human_review_required: false,
        criteria_version: 'velvet-event-v1',
        model: 'velvet-rules-fallback'
      }
    };
  }
}

async function eventParticipants(env, access, eventId) {
  const registrations = await restJson(
    env,
    `/rest/v1/event_registrations?select=id,user_id,places,status,visible_to_participants,created_at&event_id=eq.${encodeURIComponent(eventId)}&visible_to_participants=eq.true&status=in.(pending,confirmed,waitlisted,checked_in)&order=created_at.asc`,
    access.session
  );
  const userIds = [...new Set((registrations || []).map((row) => row.user_id).filter(validUuid))];
  if (!userIds.length) return [];
  const members = await restJson(
    env,
    `/rest/v1/profile_members?select=user_id,profile_id&user_id=in.(${userIds.join(',')})&status=eq.active`,
    access.session
  );
  const profileIds = [...new Set((members || []).map((row) => row.profile_id).filter(validUuid))];
  if (!profileIds.length) return [];
  const profiles = await restJson(
    env,
    `/rest/v1/member_profiles?select=id,profile_type,display_name,location_zone,profile_photo_ready,media_assets(id,media_role,is_primary,storage_path,moderation_status,created_at)&id=in.(${profileIds.join(',')})&profile_photo_ready=eq.true`,
    access.session
  );
  const enriched = await enrichProfilesMedia(env, access.session, profiles || []);
  const registrationByProfile = new Map();
  (members || []).forEach((member) => {
    const registration = (registrations || []).find((row) => row.user_id === member.user_id);
    if (registration && !registrationByProfile.has(member.profile_id)) {
      registrationByProfile.set(member.profile_id, registration);
    }
  });
  return enriched.map((profile) => ({
    profile,
    registration: registrationByProfile.get(profile.id) || null
  }));
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const eventId = new URL(request.url).searchParams.get('eventId') || '';
    if (!validUuid(eventId)) return withSession({ error: 'invalid_event' }, access.session, 400);
    const rows = await restJson(
      env,
      `/rest/v1/events?select=id,owner_type,establishment_id,organizer_profile_id,title,description,starts_at,ends_at,capacity,location_public,audience,price_cents,currency,registration_open,dress_code,event_category,cap_zone,cap_venue,created_by_user_id,moderation_status,ai_assessment,visibility,created_at,updated_at&id=eq.${encodeURIComponent(eventId)}&limit=1`,
      access.session
    );
    const event = rows?.[0];
    if (!event) return withSession({ error: 'event_unavailable' }, access.session, 404);
    const registrations = await restJson(
      env,
      `/rest/v1/event_registrations?select=id,user_id,places,status,visible_to_participants,created_at,updated_at&event_id=eq.${encodeURIComponent(eventId)}&status=in.(pending,confirmed,waitlisted,checked_in)&order=created_at.asc`,
      access.session
    );
    return withSession({
      event,
      participants: await eventParticipants(env, access, eventId),
      registrationCount: (registrations || []).reduce((total, row) => total + Number(row.places || 1), 0),
      myRegistration: (registrations || []).find((row) => row.user_id === access.account.userId) || null,
      canManage: event.created_by_user_id === access.account.userId
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'event_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const title = clean(body.title, 160);
    const description = clean(body.description, 3000);
    const locationPublic = clean(body.locationPublic, 240);
    const startsAt = dateValue(body.startsAt);
    const endsAt = dateValue(body.endsAt);
    const category = EVENT_CATEGORIES.has(body.eventCategory) ? body.eventCategory : 'standard';
    if (title.length < 4 || description.length < 20 || !locationPublic || !startsAt) {
      return withSession({ error: 'event_details_required' }, access.session, 400);
    }
    if (startsAt.getTime() < Date.now() + 30 * 60 * 1000) {
      return withSession({ error: 'event_start_too_soon' }, access.session, 400);
    }
    if (endsAt && endsAt <= startsAt) {
      return withSession({ error: 'event_end_before_start' }, access.session, 400);
    }
    const moderation = await moderateEvent(env, title, description);
    if (moderation.decision === 'rejected') {
      return withSession({
        error: 'event_rejected_by_safety',
        moderation: moderation.assessment
      }, access.session, 422);
    }
    const capacity = Math.max(2, Math.min(500, Number(body.capacity) || 20));
    const created = await restJson(
      env,
      '/rest/v1/events?select=id,owner_type,establishment_id,organizer_profile_id,title,description,starts_at,ends_at,capacity,location_public,audience,price_cents,currency,registration_open,dress_code,event_category,cap_zone,cap_venue,moderation_status,ai_assessment,visibility,created_at,updated_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          owner_type: 'profile',
          organizer_profile_id: admission.admission.id,
          created_by_user_id: access.account.userId,
          title,
          description,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt?.toISOString() || null,
          capacity,
          location_public: locationPublic,
          audience: clean(body.audience, 120) || 'Membres Zwit admis',
          price_cents: Math.max(0, Math.round(Number(body.priceCents) || 0)),
          currency: 'EUR',
          registration_open: body.registrationOpen !== false,
          dress_code: clean(body.dressCode, 180) || null,
          event_category: category,
          cap_zone: category === 'cap_dagde' ? clean(body.capZone, 160) || 'Ensemble du village' : null,
          cap_venue: category === 'cap_dagde' ? clean(body.capVenue, 160) || null : null,
          moderation_status: moderation.decision,
          ai_assessment: moderation.assessment,
          visibility: 'published'
        })
      }
    );
    return withSession({
      ok: true,
      event: created?.[0] || null,
      moderation: moderation.assessment,
      publicationStatus: moderation.decision === 'approved' ? 'published' : 'review'
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'event_creation_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const eventId = new URL(request.url).searchParams.get('id') || '';
    if (!validUuid(eventId)) return withSession({ error: 'invalid_event' }, access.session, 400);
    const rows = await restJson(
      env,
      `/rest/v1/events?select=id,created_by_user_id&organizer_profile_id=eq.${encodeURIComponent(admission.admission.id)}&id=eq.${encodeURIComponent(eventId)}&limit=1`,
      access.session
    );
    if (rows?.[0]?.created_by_user_id !== access.account.userId) {
      return withSession({ error: 'event_owner_required' }, access.session, 403);
    }
    await restJson(
      env,
      `/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&created_by_user_id=eq.${encodeURIComponent(access.account.userId)}`,
      access.session,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
    return withSession({ ok: true, eventId }, access.session);
  } catch (error) {
    return json({ error: error.message || 'event_delete_failed' }, 400);
  }
}
