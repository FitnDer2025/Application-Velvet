import { clearAccessCookie, clearRefreshCookie, refreshSession, supabase } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const session = await refreshSession(request, env).catch(() => null);
  if (session?.access_token) {
    await supabase(env, '/auth/v1/logout', { method: 'POST' }, session.access_token).catch(() => null);
  }

  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  headers.append('set-cookie', clearRefreshCookie());
  headers.append('set-cookie', clearAccessCookie());
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
