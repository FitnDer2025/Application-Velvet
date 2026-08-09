import { json } from '../auth/_shared.js';
import { memberSession, restJson, withSession } from '../members/_shared.js';
import {
  onRequestGet as studioGet,
  onRequestPost as studioPost
} from './studio-ai.js';

const PRIVILEGED_ROLES = new Set(['admin', 'direction']);
const PRO_ROLES = new Set(['pro_owner', 'pro_staff', 'admin', 'direction']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requestedVenueId(request) {
  if (request.method === 'GET') return new URL(request.url).searchParams.get('venueId') || '';
  const clone = request.clone();
  const type = clone.headers.get('content-type') || '';
  if (type.includes('multipart/form-data')) {
    const form = await clone.formData();
    return String(form.get('venueId') || '');
  }
  const body = await clone.json().catch(() => ({}));
  return String(body.venueId || '');
}

async function authorize(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return access;
  if (!access.account.roles.some((role) => PRO_ROLES.has(role))) {
    return { ...access, response: withSession({ error: 'pro_access_required' }, access.session, 403) };
  }
  const venueId = await requestedVenueId(request);
  if (!UUID.test(venueId)) {
    return { ...access, response: withSession({ error: 'pro_studio_venue_required' }, access.session, 400) };
  }
  if (access.account.roles.some((role) => PRIVILEGED_ROLES.has(role))) return access;
  const staff = await restJson(
    env,
    `/rest/v1/establishment_staff?select=establishment_id,staff_role,status&establishment_id=eq.${encodeURIComponent(venueId)}&user_id=eq.${encodeURIComponent(access.account.userId)}&status=eq.active&limit=1`,
    access.session
  );
  if (!staff.length) {
    return { ...access, response: withSession({ error: 'pro_studio_venue_forbidden' }, access.session, 403) };
  }
  return access;
}

export async function onRequestGet(context) {
  try {
    const access = await authorize(context.request, context.env);
    if (access.response) return access.response;
    return studioGet(context);
  } catch (error) {
    return json({ error: error.message || 'pro_studio_authorization_failed' }, 400);
  }
}

export async function onRequestPost(context) {
  try {
    const access = await authorize(context.request, context.env);
    if (access.response) return access.response;
    return studioPost(context);
  } catch (error) {
    return json({ error: error.message || 'pro_studio_authorization_failed' }, 400);
  }
}
