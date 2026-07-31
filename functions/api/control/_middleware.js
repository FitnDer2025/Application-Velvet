import { requireControlSession } from './_security.js';

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  const isMfaRoute = pathname.endsWith('/api/control/mfa') || pathname.endsWith('/api/control/mfa/');
  const access = await requireControlSession(context.request, context.env, {
    allowAal1: isMfaRoute
  });
  if (access.response) return access.response;
  return context.next();
}
