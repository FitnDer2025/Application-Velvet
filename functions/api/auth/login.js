import {
  accountContext,
  json,
  readJson,
  sessionResponse,
  supabase,
  verifyTurnstile
} from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const { email, password, turnstileToken } = await readJson(request);
    if (!email || !password) return json({ error: 'credentials_required' }, 400);
    const humanCheck = await verifyTurnstile(request, env, turnstileToken, 'login');
    if (!humanCheck.ok) return json({ error: humanCheck.error }, 403);

    const response = await supabase(env, '/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({
        email: String(email).trim().toLowerCase(),
        password: String(password)
      })
    });
    const session = await response.json();
    if (!response.ok) {
      return json({ error: 'invalid_credentials_or_unconfirmed_email' }, 401);
    }

    const account = await accountContext(env, session);
    if (!account) return json({ error: 'beta_account_unavailable' }, 403);
    return sessionResponse({ ok: true, account }, session);
  } catch (error) {
    return json({ error: error.message || 'login_failed' }, 400);
  }
}
