import { appendSessionCookies, json } from '../auth/_shared.js';
import { memberSession, restJson } from './_shared.js';
import { signedMediaUrl } from './media.js';

const EXPORT_VERSION = 'velvet-portability-v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function queryPath(table, select, filter, limit = 5000) {
  return `/rest/v1/${table}?select=${encodeURIComponent(select)}&${filter}&limit=${limit}`;
}

async function optionalQuery(env, access, name, path, unavailable) {
  try {
    return await restJson(env, path, access.session);
  } catch (error) {
    unavailable.push({ section: name, reason: String(error.message || error).slice(0, 180) });
    return [];
  }
}

async function recordRequest(env, access) {
  const rows = await restJson(env, '/rest/v1/data_subject_requests', access.session, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: access.account.userId,
      request_type: 'portability',
      status: 'received'
    })
  });
  return rows?.[0] || null;
}

async function completeRequest(env, requestId) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!key || !base || !requestId) return false;
  const response = await fetch(
    `${base}/rest/v1/data_subject_requests?id=eq.${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() })
    }
  );
  return response.ok;
}

async function auditDelivery(env, access, requestId, unavailableCount) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!key || !base || !requestId) return false;
  const response = await fetch(`${base}/rest/v1/audit_events`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      actor_user_id: access.account.userId,
      actor_type: 'user',
      action: 'data_export_delivered',
      entity_type: 'data_subject_request',
      entity_id: requestId,
      metadata: { format: EXPORT_VERSION, unavailable_sections: unavailableCount }
    })
  });
  return response.ok;
}

function portableMedia(rows) {
  return rows.map(({ storage_path: ignoredStoragePath, ...row }) => ({
    ...row,
    download_url: `/api/members/data-export?media=${encodeURIComponent(row.id)}`
  }));
}

function portableAttachments(rows) {
  return rows.map(({ storage_path: ignoredStoragePath, ...row }) => ({
    ...row,
    download_url: `/api/members/data-export?attachment=${encodeURIComponent(row.id)}`
  }));
}

async function buildExport(env, access, requestRecord) {
  const userId = encodeURIComponent(access.account.userId);
  const unavailable = [];
  const own = (name, table, select = '*', field = 'user_id') => optionalQuery(
    env,
    access,
    name,
    queryPath(table, select, `${field}=eq.${userId}`),
    unavailable
  );

  const [
    account,
    roles,
    consents,
    memberships,
    notifications,
    location,
    experience,
    verification,
    savedSearches,
    favorites,
    circles,
    views,
    reactions,
    photoReactions,
    conversationMemberships,
    messages,
    registrations,
    reports,
    blocks,
    media,
    attachments,
    lifecycleRequests,
    dataSubjectRequests
  ] = await Promise.all([
    own('account', 'accounts', 'user_id,email,status,invited_role,email_verified_at,last_seen_at,created_at,updated_at'),
    own('roles', 'account_roles', 'user_id,role_code,granted_at,expires_at'),
    own('consents', 'consent_records', 'id,user_id,purpose,document_version,granted,source,occurred_at,withdrawn_at'),
    own('profile_memberships', 'profile_members'),
    own('notification_preferences', 'member_notification_settings'),
    own('approximate_location', 'member_location_settings', 'user_id,enabled,precision_km,consented_at,last_used_at,created_at,updated_at'),
    own('experience_preferences', 'member_experience_preferences'),
    own('identity_age_verification', 'account_identity_age_verifications', 'user_id,provider,status,identity_verified,majority_verified,verified_at,expires_at,last_checked_at,created_at,updated_at'),
    own('saved_searches', 'member_saved_searches'),
    own('favorites', 'favorites', '*', 'owner_user_id'),
    own('circles', 'circles', '*', 'owner_user_id'),
    own('profile_views', 'profile_view_history', '*', 'viewer_user_id'),
    own('profile_reactions', 'profile_reactions', '*', 'reactor_user_id'),
    own('photo_reactions', 'photo_reactions', '*', 'reactor_user_id'),
    own('conversation_memberships', 'conversation_members'),
    own('messages_authored', 'messages', '*', 'sender_user_id'),
    own('event_registrations', 'event_registrations'),
    own('reports_authored', 'reports', '*', 'reporter_user_id'),
    own('blocks_created', 'blocks', '*', 'blocker_user_id'),
    own('media_owned', 'media_assets', '*', 'owner_user_id'),
    own('message_attachments_uploaded', 'message_attachments', '*', 'uploader_user_id'),
    own('lifecycle_requests', 'profile_lifecycle_actions', '*', 'requested_by'),
    own('data_subject_requests', 'data_subject_requests')
  ]);

  const profileIds = memberships.map((row) => row.profile_id).filter(UUID_PATTERN.test.bind(UUID_PATTERN));
  const profileFilter = profileIds.length
    ? `id=in.(${profileIds.map(encodeURIComponent).join(',')})`
    : 'id=eq.00000000-0000-0000-0000-000000000000';
  const childProfileFilter = profileIds.length
    ? `profile_id=in.(${profileIds.map(encodeURIComponent).join(',')})`
    : 'profile_id=eq.00000000-0000-0000-0000-000000000000';
  const [profiles, individualProfiles, privacy, albums, visits, travelPlans] = await Promise.all([
    optionalQuery(env, access, 'member_profiles', queryPath('member_profiles', '*', profileFilter), unavailable),
    optionalQuery(env, access, 'individual_profiles', queryPath('individual_profiles', '*', childProfileFilter), unavailable),
    optionalQuery(env, access, 'privacy_preferences', queryPath('profile_privacy_settings', '*', childProfileFilter), unavailable),
    optionalQuery(env, access, 'albums', queryPath('albums', '*', childProfileFilter), unavailable),
    optionalQuery(env, access, 'venue_visits', queryPath('profile_venue_visits', '*', childProfileFilter), unavailable),
    optionalQuery(env, access, 'travel_plans', queryPath('profile_travel_plans', '*', childProfileFilter), unavailable)
  ]);

  return {
    format: EXPORT_VERSION,
    generated_at: new Date().toISOString(),
    request: requestRecord ? {
      id: requestRecord.id,
      type: requestRecord.request_type,
      requested_at: requestRecord.requested_at
    } : null,
    scope: {
      description: 'Données fournies ou générées par la personne connectée, sous les mêmes règles RLS que son compte.',
      identity_documents_included: false,
      provider_reference_included: false,
      other_members_private_data_included: false
    },
    account: account[0] || null,
    roles,
    consents,
    verification: verification[0] || null,
    preferences: {
      notifications: notifications[0] || null,
      approximate_location: location[0] || null,
      experience: experience[0] || null,
      saved_searches: savedSearches,
      privacy
    },
    profiles: { memberships, profiles, individual_profiles: individualProfiles },
    social: { favorites, circles, profile_views: views, profile_reactions: reactions, photo_reactions: photoReactions },
    conversations: { memberships: conversationMemberships, messages_authored: messages, attachments_uploaded: portableAttachments(attachments) },
    media_owned: portableMedia(media),
    activities: { event_registrations: registrations, venue_visits: visits, travel_plans: travelPlans, albums },
    safety: { reports_authored: reports, blocks_created: blocks },
    account_lifecycle: lifecycleRequests,
    data_subject_requests: dataSubjectRequests,
    unavailable_sections: unavailable
  };
}

async function downloadableMedia(env, access, request) {
  const url = new URL(request.url);
  const mediaId = url.searchParams.get('media');
  const attachmentId = url.searchParams.get('attachment');
  if (!UUID_PATTERN.test(mediaId || attachmentId || '')) return null;
  const table = mediaId ? 'media_assets' : 'message_attachments';
  const ownerField = mediaId ? 'owner_user_id' : 'uploader_user_id';
  const id = mediaId || attachmentId;
  const rows = await restJson(
    env,
    queryPath(table, 'id,storage_path', `id=eq.${encodeURIComponent(id)}&${ownerField}=eq.${encodeURIComponent(access.account.userId)}`, 1),
    access.session
  );
  if (!rows?.[0]?.storage_path) return json({ error: 'export_media_not_found' }, 404);
  const urlToMedia = await signedMediaUrl(env, access.session, rows[0].storage_path, 300);
  if (!urlToMedia) return json({ error: 'export_media_unavailable' }, 503);
  return Response.redirect(urlToMedia, 303);
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env, { allowUnverified: true });
    if (access.response) return access.response;
    return await downloadableMedia(env, access, request)
      || json({ error: 'export_download_required' }, 400);
  } catch (error) {
    return json({ error: error.message || 'export_media_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env, { allowUnverified: true });
    if (access.response) return access.response;
    const requestRecord = await recordRequest(env, access);
    const payload = await buildExport(env, access, requestRecord);
    const completed = await completeRequest(env, requestRecord?.id);
    payload.request.status = completed ? 'completed' : 'delivered_pending_registry_update';
    payload.request.audited = await auditDelivery(
      env,
      access,
      requestRecord?.id,
      payload.unavailable_sections.length
    );

    const date = new Date().toISOString().slice(0, 10);
    const headers = appendSessionCookies(new Headers({
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="velvet-export-${date}.json"`,
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff'
    }), access.session);
    return new Response(JSON.stringify(payload, null, 2), { status: 200, headers });
  } catch (error) {
    return json({ error: error.message || 'data_export_failed' }, 400);
  }
}
