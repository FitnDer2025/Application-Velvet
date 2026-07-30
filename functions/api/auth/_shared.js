const COOKIE_NAME = 'velvet_beta_refresh';

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        return [
          decodeURIComponent(part.slice(0, separator)),
          decodeURIComponent(part.slice(separator + 1))
        ];
      })
  );
}

export function refreshCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearRefreshCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function configuration(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || '');
  if (!url || !key) throw new Error('supabase_not_configured');
  return { url, key };
}

export async function supabase(env, path, init = {}, accessToken) {
  const { url, key } = configuration(env);
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return fetch(`${url}${path}`, { ...init, headers });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('invalid_json');
  }
}

export function validateBetaPassword(password) {
  const value = String(password || '');
  if (value.length < 12) return { valid: false, error: 'password_too_short' };
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return { valid: false, error: 'password_too_weak' };
  }
  return { valid: true };
}

export async function verifyTurnstile(request, env, token, expectedAction) {
  const secret = String(env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return { ok: true, configured: false };
  if (!token) return { ok: false, configured: true, error: 'human_verification_required' };

  const form = new FormData();
  form.set('secret', secret);
  form.set('response', String(token));
  const remoteIp = request.headers.get('cf-connecting-ip');
  if (remoteIp) form.set('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    return { ok: false, configured: true, error: 'human_verification_failed' };
  }
  if (expectedAction && result.action && result.action !== expectedAction) {
    return { ok: false, configured: true, error: 'human_verification_failed' };
  }
  return { ok: true, configured: true };
}

export async function refreshSession(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return null;

  const response = await supabase(env, '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: token })
  });
  const session = await response.json();
  if (!response.ok || !session.access_token || !session.refresh_token) return null;
  return session;
}

export async function accountContext(env, session) {
  const userId = session.user?.id;
  if (!userId) return null;

  await supabase(
    env,
    '/rest/v1/rpc/resume_my_expired_suspension',
    { method: 'POST', body: '{}' },
    session.access_token
  ).catch(() => null);

  const [accountResponse, rolesResponse] = await Promise.all([
    supabase(
      env,
      `/rest/v1/accounts?select=user_id,status,invited_role&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      {},
      session.access_token
    ),
    supabase(
      env,
      `/rest/v1/account_roles?select=role_code&user_id=eq.${encodeURIComponent(userId)}`,
      {},
      session.access_token
    )
  ]);
  if (!accountResponse.ok || !rolesResponse.ok) return null;

  const accounts = await accountResponse.json();
  const roleRows = await rolesResponse.json();
  if (!accounts[0]) return null;
  return {
    userId,
    email: session.user?.email || '',
    status: accounts[0].status,
    roles: roleRows.map((row) => row.role_code)
  };
}

export function sessionResponse(payload, session, status = 200) {
  return json(payload, status, {
    'set-cookie': refreshCookie(session.refresh_token)
  });
}
