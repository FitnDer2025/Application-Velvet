import {
  accountContext,
  json,
  readJson,
  refreshSession,
  sessionResponse,
  supabase
} from './_shared.js';

const DOCUMENT_VERSION = 'beta-2026-07-28';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    if (!body.terms || !body.privacy || !body.adult || !body.sensitiveProfile) {
      return json({ error: 'required_consents_missing' }, 400);
    }

    const session = await refreshSession(request, env);
    if (!session) return json({ error: 'authentication_required' }, 401);

    const purposes = ['terms', 'privacy', 'adult_declaration', 'sensitive_profile'];
    const response = await supabase(
      env,
      '/rest/v1/consent_records',
      {
        method: 'POST',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify(
          purposes.map((purpose) => ({
            user_id: session.user.id,
            purpose,
            document_version: DOCUMENT_VERSION,
            granted: true,
            source: 'cloudflare_beta',
            evidence: { method: 'explicit_checkbox' }
          }))
        )
      },
      session.access_token
    );
    if (!response.ok) return json({ error: 'consent_recording_failed' }, 400);

    const activation = await supabase(
      env,
      '/rest/v1/rpc/complete_beta_activation',
      { method: 'POST', body: '{}' },
      session.access_token
    );
    if (!activation.ok) return json({ error: 'activation_failed' }, 400);

    const account = await accountContext(env, session);
    return sessionResponse({ ok: true, account }, session);
  } catch (error) {
    return json({ error: error.message || 'consent_failed' }, 400);
  }
}
