import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  restJson,
  withSession
} from '../members/_shared.js';

const ROLES = new Set([
  'member',
  'organizer',
  'pro_owner',
  'pro_staff',
  'moderator',
  'support',
  'auditor',
  'direction',
  'admin'
]);

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    if (!access.account.roles.includes('admin')) {
      return json({ error: 'admin_required' }, 403);
    }
    const invitations = await restJson(
      env,
      '/rest/v1/rpc/admin_list_beta_invites',
      access.session,
      { method: 'POST', body: '{}' }
    );
    return withSession({ invitations: invitations || [] }, access.session);
  } catch (error) {
    return json({ error: error.message || 'invite_list_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    if (!access.account.roles.includes('admin')) {
      return json({ error: 'admin_required' }, 403);
    }
    const body = await readJson(request);
    const email = cleanText(body.email, 320).toLowerCase();
    const role = cleanText(body.role || 'member', 30);
    const validityDays = Math.max(1, Math.min(30, Number(body.validityDays) || 7));
    if (!email.includes('@')) return json({ error: 'invalid_email' }, 400);
    if (!ROLES.has(role)) return json({ error: 'invalid_role' }, 400);

    const result = await restJson(
      env,
      '/rest/v1/rpc/admin_create_beta_invite',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          invited_email: email,
          invited_role: role,
          validity_days: validityDays
        })
      }
    );
    const invitation = result?.[0] || null;
    if (!invitation?.invite_id || !invitation?.invite_code) {
      throw new Error('invite_persistence_failed');
    }
    const registration = new URL('/', request.url);
    registration.searchParams.set('mode', 'register');
    registration.searchParams.set('invite', invitation.invite_code);
    registration.searchParams.set('email', email);
    return withSession({
      ok: true,
      invitation,
      invitedEmail: email,
      intendedRole: role,
      registrationUrl: registration.toString()
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'invite_creation_failed' }, 400);
  }
}
