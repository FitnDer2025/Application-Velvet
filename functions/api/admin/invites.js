import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  restJson,
  withSession
} from '../members/_shared.js';

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
    return withSession({ ok: true, invitation: result?.[0] || null }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'invite_creation_failed' }, 400);
  }
}
