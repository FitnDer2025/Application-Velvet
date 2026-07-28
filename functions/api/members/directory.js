import { json } from '../auth/_shared.js';
import { memberSession, restJson, withSession } from './_shared.js';

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
  'relationship_since',
  'journey',
  'favorite_places',
  'availability_text',
  'created_at',
  'updated_at',
  'individual_profiles(*)',
  'albums(id,name,confidentiality,expires_at,created_at)'
].join(',');

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const token = access.session;
    const [profiles, establishments, events, conversations, recommendations] = await Promise.all([
      restJson(env, `/rest/v1/member_profiles?select=${encodeURIComponent(PROFILE_SELECT)}&visibility=in.(beta_members,published)&order=updated_at.desc&limit=100`, token),
      restJson(env, '/rest/v1/establishments?select=id,slug,name,kind,description,city,address_public,opening_hours,amenities,verified_at&visibility=eq.published&order=name.asc&limit=100', token),
      restJson(env, '/rest/v1/events?select=id,owner_type,establishment_id,organizer_profile_id,title,description,starts_at,ends_at,capacity,location_public,audience&visibility=eq.published&order=starts_at.asc&limit=100', token),
      restJson(env, '/rest/v1/conversations?select=id,kind,event_id,subject,created_at,updated_at,conversation_members(display_identity,user_id,last_read_at)&order=updated_at.desc&limit=100', token),
      restJson(env, '/rest/v1/recommendations?select=id,author_profile_id,target_type,target_id,body,rating,created_at&status=eq.published&order=created_at.desc&limit=200', token)
    ]);
    return withSession({
      profiles,
      establishments,
      events,
      conversations,
      recommendations,
      currentUserId: access.account.userId
    }, token);
  } catch (error) {
    return json({ error: error.message || 'directory_read_failed' }, 400);
  }
}

