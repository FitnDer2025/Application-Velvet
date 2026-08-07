import { json, readJson } from '../auth/_shared.js';
import {
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { enrichProfilesMedia } from './media.js';

// Migration contract: legacy register_for_event / cancel_my_event_registration
// are intentionally replaced by the transactional v1.5 RPCs below.
function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function profileUsers(profile) {
  return new Set((profile?.individual_profiles || [])
    .map((person) => person.linked_user_id)
    .filter(Boolean));
}

function profilePhoto(profile) {
  return (profile?.media_assets || [])
    .filter((media) => media.moderation_status === 'approved' && media.previewUrl)
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary)))[0]?.previewUrl || null;
}

async function visibleParticipantProfiles(env, access, registrations) {
  const visibleUserIds = new Set((registrations || [])
    .filter((row) => row.visible_to_participants === true)
    .filter((row) => ['confirmed', 'checked_in'].includes(row.status))
    .map((row) => row.user_id)
    .filter(Boolean));
  if (!visibleUserIds.size) return [];

  // individual_profiles.linked_user_id already belongs to the admitted-member
  // directory contract. We intentionally resolve users server-side and never
  // expose registration user IDs to other members.
  const select = [
    'id',
    'display_name',
    'profile_type',
    'location_zone',
    'individual_profiles(linked_user_id)',
    'media_assets(id,owner_user_id,media_role,is_primary,storage_path,moderation_status,created_at)'
  ].join(',');
  const rawProfiles = await restJson(
    env,
    `/rest/v1/member_profiles?select=${encodeURIComponent(select)}&visibility=in.(beta_members,published)&limit=200`,
    access.session
  ).catch(() => []);
  const profiles = await enrichProfilesMedia(env, access.session, rawProfiles || []).catch(() => rawProfiles || []);

  return profiles
    .filter((profile) => [...profileUsers(profile)].some((userId) => visibleUserIds.has(userId)))
    .map((profile) => ({
      profileId: profile.id,
      displayName: profile.display_name || 'Membre Zwit',
      profileType: profile.profile_type || 'individual',
      locationZone: profile.location_zone || null,
      photoUrl: profilePhoto(profile)
    }));
}

async function bookingState(env, access, eventId) {
  const rows = await restJson(env, '/rest/v1/rpc/zwit_v15_event_booking_state', access.session, {
    method: 'POST',
    body: JSON.stringify({ target_event_id: eventId })
  });
  return rows?.[0] || null;
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const eventId = new URL(request.url).searchParams.get('eventId') || '';
    if (!validUuid(eventId)) return withSession({ error: 'invalid_event' }, access.session, 400);

    const [registrations, state, events] = await Promise.all([
      restJson(
        env,
        `/rest/v1/event_registrations?select=id,event_id,user_id,places,status,visible_to_participants,created_at,updated_at&event_id=eq.${encodeURIComponent(eventId)}&status=in.(pending,confirmed,waitlisted,checked_in)&order=created_at.asc`,
        access.session
      ),
      bookingState(env, access, eventId),
      restJson(
        env,
        `/rest/v1/events?select=id,title,starts_at,ends_at,capacity,registration_open,registration_mode,registration_closes_at,max_places_per_registration,guest_list_enabled&id=eq.${encodeURIComponent(eventId)}&limit=1`,
        access.session
      )
    ]);

    const myRegistration = (registrations || []).find((row) => row.user_id === access.account.userId) || null;
    const participants = state?.guest_list_enabled === false
      ? []
      : await visibleParticipantProfiles(env, access, registrations);

    return withSession({
      event: events?.[0] || null,
      booking: state,
      myRegistration: myRegistration ? {
        id: myRegistration.id,
        places: myRegistration.places,
        status: myRegistration.status,
        visibleToParticipants: myRegistration.visible_to_participants,
        createdAt: myRegistration.created_at,
        updatedAt: myRegistration.updated_at
      } : null,
      participants,
      participantProfilesVisible: state?.guest_list_enabled !== false,
      privacy: 'La guest-list affiche uniquement les membres confirmés qui ont choisi d’être visibles. Les identifiants de compte ne sont jamais exposés.'
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'event_registrations_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const eventId = String(body.eventId || '');
    if (!validUuid(eventId)) return withSession({ error: 'invalid_event' }, access.session, 400);

    if (body.action === 'cancel') {
      const result = await restJson(env, '/rest/v1/rpc/zwit_v15_cancel_event_registration', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_event_id: eventId })
      });
      return withSession({
        ok: true,
        status: result?.[0]?.cancelled ? 'cancelled' : 'not_registered',
        promotedCount: Number(result?.[0]?.promoted_count || 0)
      }, access.session);
    }

    const places = Number(body.places || 1);
    if (!Number.isInteger(places) || places < 1 || places > 12) {
      return withSession({ error: 'invalid_places' }, access.session, 400);
    }

    const result = await restJson(env, '/rest/v1/rpc/zwit_v15_register_for_event', access.session, {
      method: 'POST',
      body: JSON.stringify({
        target_event_id: eventId,
        requested_places: places,
        show_to_participants: body.visibleToParticipants !== false
      })
    });
    const registration = result?.[0] || null;
    return withSession({
      ok: true,
      registration: registration ? {
        id: registration.id,
        places: registration.places,
        status: registration.status,
        visibleToParticipants: registration.visible_to_participants,
        createdAt: registration.created_at,
        updatedAt: registration.updated_at
      } : null
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'event_registration_failed' }, 400);
  }
}
