import {
  accountContext,
  json,
  refreshSession,
  sessionResponse,
  supabase
} from '../auth/_shared.js';

export async function memberSession(request, env) {
  const session = await refreshSession(request, env);
  if (!session) return { response: json({ error: 'authentication_required' }, 401) };
  const account = await accountContext(env, session);
  if (!account || account.status !== 'active' || !account.roles.includes('member')) {
    return { response: json({ error: 'member_access_required' }, 403) };
  }
  return { session, account };
}

export async function restJson(env, path, session, init = {}) {
  const response = await supabase(env, path, init, session.access_token);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message || payload?.hint || payload?.code || 'supabase_request_failed';
    throw new Error(detail);
  }
  return payload;
}

export function withSession(payload, session, status = 200) {
  return sessionResponse(payload, session, status);
}

export function cleanText(value, max = 2000) {
  const result = String(value ?? '').trim();
  return result.slice(0, max);
}

export function cleanList(value, maxItems = 30, maxLength = 80) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(source
    .map((item) => String(item).trim().slice(0, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

