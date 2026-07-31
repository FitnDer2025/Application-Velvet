import {
  accountContext,
  json,
  refreshSession
} from '../auth/_shared.js';

export const CONTROL_ROLES = new Set([
  'admin',
  'direction',
  'moderator',
  'support',
  'auditor'
]);

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    return atob(padded);
  } catch {
    return '';
  }
}

export function accessTokenClaims(accessToken) {
  const payload = String(accessToken || '').split('.')[1];
  if (!payload) return {};
  try {
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    return {};
  }
}

export function authenticationAssuranceLevel(session) {
  return String(accessTokenClaims(session?.access_token).aal || 'aal1');
}

export function hasControlRole(account) {
  return Boolean(account?.roles?.some((role) => CONTROL_ROLES.has(role)));
}

export async function requireControlSession(request, env, { allowAal1 = false } = {}) {
  const session = await refreshSession(request, env);
  if (!session) {
    return { response: json({ error: 'authentication_required' }, 401) };
  }
  const account = await accountContext(env, session);
  if (!account || account.status !== 'active' || !hasControlRole(account)) {
    return { response: json({ error: 'control_access_required' }, 403) };
  }
  const aal = authenticationAssuranceLevel(session);
  if (!allowAal1 && aal !== 'aal2') {
    return {
      response: json({
        error: 'mfa_required',
        aal,
        requiredAal: 'aal2'
      }, 403),
      session,
      account,
      aal
    };
  }
  return { session, account, aal };
}
