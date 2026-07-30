import { json } from '../auth/_shared.js';
import { memberAdmission, memberSession, restJson, withSession } from './_shared.js';
import { enrichProfilesMedia } from './media.js';

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
  'individual_profiles(*)',
  'media_assets(id,individual_profile_id,owner_user_id,media_role,is_primary,storage_path,moderation_status,created_at)',
  'albums(id,name,confidentiality,expires_at,created_at,media_assets(id,owner_user_id,media_type,storage_path,moderation_status,created_at))'
].join(',');

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
        currentUserId: access.account.userId
      }, access.session);
    }
    const token = access.session;
    const [profiles, establishments, venueDirectory, venueRelationships, events, conversations, recommendations] = await Promise.all([
      restJson(env, `/rest/v1/member_profiles?select=${encodeURIComponent(PROFILE_SELECT)}&visibility=in.(beta_members,published)&order=updated_at.desc&limit=100`, token),
      restJson(env, '/rest/v1/establishments?select=id,directory_venue_id,slug,name,kind,description,city,address_public,phone_public,email_public,opening_hours,amenities,verified_at,subscription_status&visibility=eq.published&order=name.asc&limit=500', token),
      restJson(env, '/rest/v1/rpc/member_venue_catalog', token, { method: 'POST', body: '{}' }),
      restJson(env, `/rest/v1/profile_venue_relationships?select=profile_id,venue_id,relation_type,occurred_on,updated_at&profile_id=eq.${encodeURIComponent(admission.id)}`, token),
      restJson(env, '/rest/v1/events?select=id,owner_type,establishment_id,organizer_profile_id,title,description,starts_at,ends_at,capacity,location_public,audience,price_cents,currency,registration_open,dress_code,created_at,updated_at&visibility=eq.published&order=starts_at.asc&limit=100', token),
      restJson(env, '/rest/v1/conversations?select=id,kind,event_id,subject,created_at,updated_at,conversation_members(display_identity,user_id,last_read_at)&order=updated_at.desc&limit=100', token),
      restJson(env, '/rest/v1/recommendations?select=id,author_profile_id,target_type,target_id,body,rating,created_at&status=eq.published&order=created_at.desc&limit=200', token)
    ]);
    return withSession({
      profiles: await enrichProfilesMedia(env, token, profiles),
      establishments,
      venueDirectory,
      venueRelationships,
      events,
      conversations,
      recommendations,
      currentUserId: access.account.userId
    }, token);
  } catch (error) {
    return json({ error: error.message || 'directory_read_failed' }, 400);
  }
}
