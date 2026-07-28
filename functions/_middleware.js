import {
  accountContext,
  clearRefreshCookie,
  refreshCookie,
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

export async function onRequest(context) {
  const roles = expectedRoles(new URL(context.request.url).pathname);
  if (!roles) return context.next();

  const session = await refreshSession(context.request, context.env);
  if (!session) {
    return new Response(null, {
      status: 302,
      headers: {
        location: new URL('/?reason=session', context.request.url).toString(),
        'set-cookie': clearRefreshCookie(),
        'cache-control': 'no-store'
      }
    });
  }
  const account = await accountContext(context.env, session);
  if (!account || account.status !== 'active') {
    return new Response(null, {
      status: 302,
      headers: {
        location: new URL('/?reason=consent', context.request.url).toString(),
        'set-cookie': session.refresh_token
          ? refreshCookie(session.refresh_token)
          : clearRefreshCookie(),
        'cache-control': 'no-store'
      }
    });
  }
  if (roles.length && !roles.some((role) => account.roles.includes(role))) {
    return new Response('Accès non autorisé pour ce rôle Velvet.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const upstream = await context.next();
  const response = new Response(upstream.body, upstream);
  response.headers.append('set-cookie', refreshCookie(session.refresh_token));
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
