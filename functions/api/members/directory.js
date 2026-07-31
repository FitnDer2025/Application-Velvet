import { json } from '../auth/_shared.js';
import { memberAdmission, memberSession, restJson, withSession } from './_shared.js';
import { enrichProfilesMedia } from './media.js';
import { seededVenueCoordinates } from './venue-geocoding.js';

const PROFILE_SELECT = [
  'id',
  'profile_type',
  'display_name',
  'location_zone',
  'story',
  'description',
  'search_text',
  'practices',
  'values_list',
  'verification_status',
  'relationship_since',
  'journey',
  'favorite_places',
  'availability_text',
  'created_at',
  'updated_at',
  'profile_members(user_id,status)',
  'individual_profiles(*)',
  'media_assets(id,individual_profile_id,owner_user_id,media_role,is_primary,storage_path,moderation_status,created_at)',
  'albums(id,name,confidentiality,expires_at,created_at,media_assets(id,owner_user_id,media_type,storage_path,moderation_status,created_at))'
].join(',');

export function enrichVenueCoordinates(venue) {
  const latitude = Number(venue.latitude);
  const longitude = Number(venue.longitude);
  if (venue.latitude !== null && venue.latitude !== ''
    && venue.longitude !== null && venue.longitude !== ''
    && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { ...venue, latitude, longitude, coordinate_source: 'directory' };
  }
  const seeded = seededVenueCoordinates(venue);
  return seeded
    ? { ...venue, latitude: seeded.latitude, longitude: seeded.longitude, coordinate_source: seeded.source }
    : venue;
}

function profileUsers(profile) {
  return new Set([
    ...(profile.profile_members || [])
      .filter((membership) => membership.status === 'active')
      .map((membership) => membership.user_id),
    ...(profile.individual_profiles || [])
      .map((person) => person.linked_user_id)
      .filter(Boolean)
  ]);
}

function profilePhoto(profile) {
  const photos = (profile.media_assets || [])
    .filter((media) => media.moderation_status === 'approved' && media.previewUrl)
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary)));
  return photos[0]?.previewUrl || null;
}

function publicProfile(profile) {
  const { profile_members: _members, ...safeProfile } = profile;
  return safeProfile;
}

function conversationSummaries(conversations, messages, profiles, currentUserId) {
  const profileByUser = new Map();
  profiles.forEach((profile) => {
    profileUsers(profile).forEach((userId) => profileByUser.set(userId, profile));
  });

  const messagesByConversation = new Map();
  messages.forEach((message) => {
    const rows = messagesByConversation.get(message.conversation_id) || [];
    rows.push(message);
    messagesByConversation.set(message.conversation_id, rows);
  });

  return conversations.map((conversation) => {
    const members = conversation.conversation_members || [];
    const ownMembership = members.find((member) => member.user_id === currentUserId);
    const otherMembers = members.filter((member) => member.user_id !== currentUserId);
    const participantProfiles = [...new Map(
      otherMembers
        .map((member) => profileByUser.get(member.user_id))
        .filter(Boolean)
        .map((profile) => [profile.id, profile])
    ).values()];
    const participant = participantProfiles[0] || null;
    const rows = (messagesByConversation.get(conversation.id) || [])
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
    const latest = rows[0] || null;
    const lastReadAt = ownMembership?.last_read_at
      ? new Date(ownMembership.last_read_at).getTime()
      : 0;
    const unreadCount = rows.filter((message) =>
      message.sender_user_id !== currentUserId
      && new Date(message.created_at).getTime() > lastReadAt
    ).length;
    const participantDisplayName = conversation.kind === 'event'
      ? conversation.subject || 'Salon Velvet'
      : participant?.display_name
        || otherMembers.map((member) => member.display_identity).filter(Boolean).join(' & ')
        || conversation.subject
        || 'Membre Velvet';

    return {
      ...conversation,
      participant_profile_id: participant?.id || null,
      participant_display_name: participantDisplayName,
      participant_photo_url: participant ? profilePhoto(participant) : null,
      last_message_body: latest?.body || (latest ? 'Pièce jointe' : null),
      last_message_at: latest?.created_at || conversation.updated_at,
      unread_count: unreadCount
    };
  }).sort((left, right) =>
    new Date(right.last_message_at || right.updated_at || 0)
      - new Date(left.last_message_at || left.updated_at || 0)
  );
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await memberAdmission(env, access);
    if (!admission || admission.admission_status !== 'approved') {
      return withSession({
        locked: true,
        admission,
        profiles: [],
        establishments: [],
        venueDirectory: [],
        venueRelationships: [],
        events: [],
        conversations: [],
        recommendations: [],
        messageUnreadCount: 0,
        currentUserId: access.account.userId
      }, access.session);
    }

    const token = access.session;
    const [rawProfiles, establishments, venueDirectory, venueRelationships, events, conversations, recommendations] = await Promise.all([
      restJson(env, `/rest/v1/member_profiles?select=${encodeURIComponent(PROFILE_SELECT)}&visibility=in.(beta_members,published)&order=updated_at.desc&limit=100`, token),
      restJson(env, '/rest/v1/establishments?select=id,directory_venue_id,slug,name,kind,description,city,address_public,phone_public,email_public,opening_hours,amenities,verified_at,subscription_status&visibility=eq.published&order=name.asc&limit=500', token),
      restJson(env, '/rest/v1/rpc/member_venue_catalog', token, { method: 'POST', body: '{}' }),
      restJson(env, `/rest/v1/profile_venue_relationships?select=profile_id,venue_id,relation_type,occurred_on,updated_at&profile_id=eq.${encodeURIComponent(admission.id)}`, token),
      restJson(env, '/rest/v1/events?select=id,owner_type,establishment_id,organizer_profile_id,title,description,starts_at,ends_at,capacity,location_public,audience,price_cents,currency,registration_open,dress_code,created_at,updated_at&visibility=eq.published&order=starts_at.asc&limit=100', token),
      restJson(env, '/rest/v1/conversations?select=id,kind,event_id,subject,created_at,updated_at,conversation_members(display_identity,user_id,last_read_at)&order=updated_at.desc&limit=100', token),
      restJson(env, '/rest/v1/recommendations?select=id,author_profile_id,target_type,target_id,body,rating,created_at&status=eq.published&order=created_at.desc&limit=200', token)
    ]);

    const profiles = await enrichProfilesMedia(env, token, rawProfiles);
    const conversationIds = (conversations || []).map((conversation) => conversation.id);
    const recentMessages = conversationIds.length
      ? await restJson(
        env,
        `/rest/v1/messages?select=id,conversation_id,sender_user_id,sender_identity,body,created_at&conversation_id=in.(${conversationIds.join(',')})&deleted_at=is.null&order=created_at.desc&limit=2000`,
        token
      ).catch(() => [])
      : [];
    const enrichedConversations = conversationSummaries(
      conversations || [],
      recentMessages || [],
      profiles || [],
      access.account.userId
    );

    return withSession({
      profiles: profiles.map(publicProfile),
      establishments,
      venueDirectory: (venueDirectory || []).map(enrichVenueCoordinates),
      venueRelationships,
      events,
      conversations: enrichedConversations,
      recommendations,
      messageUnreadCount: enrichedConversations.reduce(
        (total, conversation) => total + Number(conversation.unread_count || 0),
        0
      ),
      currentUserId: access.account.userId
    }, token);
  } catch (error) {
    return json({ error: error.message || 'directory_read_failed' }, 400);
  }
}
