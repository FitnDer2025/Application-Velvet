import { json, readJson, supabase, verifyTurnstile } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const { email, turnstileToken } = await readJson(request);
    if (!email) return json({ error: 'email_required' }, 400);
    const humanCheck = await verifyTurnstile(request, env, turnstileToken, 'recovery');
    if (!humanCheck.ok) return json({ error: humanCheck.error }, 403);

    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('recovery', '1');
    await supabase(
      env,
      `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectUrl.toString())}`,
      {
        method: 'POST',
        body: JSON.stringify({
          email: String(email).trim().toLowerCase()
        })
      }
    );

    return json({
      ok: true,
      message: 'recovery_email_if_account_exists'
    }, 202);
  } catch {
    // La réponse reste volontairement neutre pour ne jamais confirmer
    // l'existence d'une adresse dans Velvet.
    return json({
      ok: true,
      message: 'recovery_email_if_account_exists'
    }, 202);
  }
}
