import {
  accountContext,
  appendClearedSessionCookies,
  appendSessionCookies,
  refreshSession
} from './api/auth/_shared.js';

const ACCESS = {
  '/membres': [],
  '/pro': ['organizer', 'pro_owner', 'pro_staff', 'direction', 'admin'],
  '/control': ['moderator', 'support', 'auditor', 'direction', 'admin']
};

function expectedRoles(pathname) {
  return Object.entries(ACCESS).find(([prefix]) => pathname.startsWith(prefix))?.[1];
}

function redirectTo(request, pathname, reason, session = null) {
  const headers = new Headers({
    location: new URL(`${pathname}?reason=${encodeURIComponent(reason)}`, request.url).toString(),
    'cache-control': 'no-store'
  });
  if (session) appendSessionCookies(headers, session);
  else appendClearedSessionCookies(headers);
  return new Response(null, { status: 302, headers });
}

export async function onRequest(context) {
  const roles = expectedRoles(new URL(context.request.url).pathname);
  if (!roles) return context.next();

  const session = await refreshSession(context.request, context.env);
  if (!session) return redirectTo(context.request, '/', 'session');

  const account = await accountContext(context.env, session);
  if (!account || account.status !== 'active') {
    return redirectTo(context.request, '/', 'consent', session);
  }
  if (roles.length && !roles.some((role) => account.roles.includes(role))) {
    const headers = new Headers({
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    });
    appendSessionCookies(headers, session);
    return new Response('Accès non autorisé pour ce rôle Velvet.', { status: 403, headers });
  }

  const upstream = await context.next();
  const response = new Response(upstream.body, upstream);
  appendSessionCookies(response.headers, session);
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
