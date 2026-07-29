import {
  json,
  readJson,
  sessionResponse,
  supabase,
  validateBetaPassword
} from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const { accessToken, refreshToken, password } = await readJson(request);
    if (!accessToken || !refreshToken) return json({ error: 'invalid_recovery_link' }, 401);
    const passwordCheck = validateBetaPassword(password);
    if (!passwordCheck.valid) return json({ error: passwordCheck.error }, 400);

    const response = await supabase(
      env,
      '/auth/v1/user',
      {
        method: 'PUT',
        body: JSON.stringify({ password: String(password) })
      },
      String(accessToken)
    );
    if (!response.ok) return json({ error: 'invalid_or_expired_recovery_link' }, 401);
    return sessionResponse({
      ok: true,
      message: 'password_updated'
    }, { refresh_token: String(refreshToken) });
  } catch (error) {
    return json({ error: error.message || 'password_update_failed' }, 400);
  }
}
