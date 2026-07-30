import { json, readJson } from '../auth/_shared.js';
import {
  memberAccessState,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';

function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function cleanFilters(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid_saved_search_filters');
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > 18000) throw new Error('saved_search_too_large');
  return JSON.parse(serialized);
}

async function discoveryState(env, access) {
  const [presenceResult, searchesResult, followingResult, accessResult] = await Promise.allSettled([
    restJson(
      env,
      '/rest/v1/rpc/member_presence_snapshot',
      access.session,
      { method: 'POST', body: '{}' }
    ),
    restJson(
      env,
      `/rest/v1/member_saved_searches?select=id,name,filters,created_at,updated_at&user_id=eq.${encodeURIComponent(access.account.userId)}&order=updated_at.desc&limit=50`,
      access.session
    ),
    restJson(
      env,
      `/rest/v1/favorites?select=profile_id,created_at&owner_user_id=eq.${encodeURIComponent(access.account.userId)}&order=created_at.desc`,
      access.session
    ),
    memberAccessState(env, access)
  ]);

  const memberAccess = accessResult.status === 'fulfilled' ? accessResult.value : null;
  const savedSearchesAllowed = memberAccess?.migrationPending
    || memberAccess?.features?.savedSearches;
  return {
    presence: presenceResult.status === 'fulfilled' ? presenceResult.value : [],
    savedSearches: searchesResult.status === 'fulfilled' && savedSearchesAllowed
      ? searchesResult.value
      : [],
    following: followingResult.status === 'fulfilled'
      ? followingResult.value.map((row) => row.profile_id)
      : [],
    access: memberAccess,
    persistenceAvailable: searchesResult.status === 'fulfilled',
    presenceAvailable: presenceResult.status === 'fulfilled'
  };
}

async function admittedAccess(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return { response: access.response };
  const admission = await requireAdmittedMember(env, access);
  if (admission.response) return { response: admission.response };
  return { access };
}

export async function onRequestGet({ request, env }) {
  try {
    const result = await admittedAccess(request, env);
    if (result.response) return result.response;
    return withSession(await discoveryState(env, result.access), result.access.session);
  } catch (error) {
    return json({ error: error.message || 'discovery_preferences_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const result = await admittedAccess(request, env);
    if (result.response) return result.response;
    const body = await readJson(request);
    const memberAccess = await memberAccessState(env, result.access);
    if (!memberAccess.migrationPending && !memberAccess.features?.savedSearches) {
      return withSession({
        error: 'signature_required_saved_search',
        access: memberAccess
      }, result.access.session, 403);
    }
    const name = cleanName(body.name);
    if (!name) return withSession({ error: 'saved_search_name_required' }, result.access.session, 400);
    const filters = cleanFilters(body.filters);

    await restJson(
      env,
      '/rest/v1/member_saved_searches?on_conflict=user_id,name',
      result.access.session,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: result.access.account.userId,
          name,
          filters
        })
      }
    );
    return withSession({
      ok: true,
      ...(await discoveryState(env, result.access))
    }, result.access.session);
  } catch (error) {
    return json({ error: error.message || 'saved_search_write_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const result = await admittedAccess(request, env);
    if (result.response) return result.response;
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return withSession({ error: 'saved_search_id_required' }, result.access.session, 400);
    await restJson(
      env,
      `/rest/v1/member_saved_searches?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(result.access.account.userId)}`,
      result.access.session,
      {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      }
    );
    return withSession({
      ok: true,
      ...(await discoveryState(env, result.access))
    }, result.access.session);
  } catch (error) {
    return json({ error: error.message || 'saved_search_delete_failed' }, 400);
  }
}
