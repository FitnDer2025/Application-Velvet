import { json, readJson, sessionResponse, supabase } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const { email, password, inviteCode } = await readJson(request);
    if (!email || !password || !inviteCode) {
      return json({ error: 'email_password_invitation_required' }, 400);
    }
    if (String(password).length < 12) {
      return json({ error: 'password_too_short' }, 400);
    }

    const response = await supabase(env, '/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: String(email).trim().toLowerCase(),
        password: String(password),
        data: { invite_code: String(inviteCode).trim() }
      })
    });
    const result = await response.json();
    if (!response.ok) {
      return json({ error: 'signup_refused', detail: result.msg || result.message }, response.status);
    }

    const payload = {
      ok: true,
      confirmationRequired: !result.access_token,
      message: result.access_token
        ? 'Compte créé. Les consentements doivent maintenant être validés.'
        : 'Vérifie ton e-mail avant de te connecter.'
    };
    return result.refresh_token
      ? sessionResponse(payload, result, 201)
      : json(payload, 201);
  } catch (error) {
    return json({ error: error.message || 'signup_failed' }, 400);
  }
}
