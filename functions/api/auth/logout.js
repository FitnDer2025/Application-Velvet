import { clearRefreshCookie, json, refreshSession, supabase } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const session = await refreshSession(request, env).catch(() => null);
  if (session?.access_token) {
    await supabase(
      env,
      '/auth/v1/logout',
      { method: 'POST' },
      session.access_token
    ).catch(() => null);
  }
  return json({ ok: true }, 200, { 'set-cookie': clearRefreshCookie() });
}
