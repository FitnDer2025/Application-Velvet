import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  restJson,
  withSession
} from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const email = cleanText(body.email, 320).toLowerCase();
    if (!email.includes('@')) return json({ error: 'invalid_partner_email' }, 400);
    if (email === access.account.email.toLowerCase()) {
      return json({ error: 'partner_email_must_be_different' }, 400);
    }

    const result = await restJson(
      env,
      '/rest/v1/rpc/invite_my_couple_partner',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          partner_email: email,
          validity_days: 7
        })
      }
    );
    return withSession({
      ok: true,
      invitation: result?.[0] || null,
      registrationUrl: new URL('/', request.url).toString()
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'couple_invitation_failed' }, 400);
  }
}
