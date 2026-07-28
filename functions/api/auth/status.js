import {
  accountContext,
  clearRefreshCookie,
  json,
  refreshSession,
  sessionResponse
} from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const session = await refreshSession(request, env);
    if (!session) {
      return json({ authenticated: false }, 401, {
        'set-cookie': clearRefreshCookie()
      });
    }
    const account = await accountContext(env, session);
    if (!account) return json({ authenticated: false }, 403);
    return sessionResponse({ authenticated: true, account }, session);
  } catch (error) {
    return json({ authenticated: false, error: error.message }, 500);
  }
}
