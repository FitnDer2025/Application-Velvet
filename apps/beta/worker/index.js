import { onRequest as protectApplication } from '../../../functions/_middleware.js';
import { onRequestPost as signup } from '../../../functions/api/auth/signup.js';
import { onRequestPost as login } from '../../../functions/api/auth/login.js';
import { onRequestGet as status } from '../../../functions/api/auth/status.js';
import { onRequestPost as consent } from '../../../functions/api/auth/consent.js';
import { onRequestPost as logout } from '../../../functions/api/auth/logout.js';
import {
  onRequestGet as memberProfileGet,
  onRequestPost as memberProfilePost
} from '../../../functions/api/members/profile.js';
import { onRequestGet as memberDirectory } from '../../../functions/api/members/directory.js';
import {
  onRequestGet as organizerRequestGet,
  onRequestPost as organizerRequestPost
} from '../../../functions/api/members/organizer-request.js';
import {
  onRequestGet as messagesGet,
  onRequestPost as messagesPost
} from '../../../functions/api/members/messages.js';
import { onRequestPost as albumsPost } from '../../../functions/api/members/albums.js';
import { onRequestPost as coupleInvitePost } from '../../../functions/api/members/couple-invite.js';
import { onRequestPost as adminInvitePost } from '../../../functions/api/admin/invites.js';

const API_ROUTES = new Map([
  ['POST /api/auth/signup', signup],
  ['POST /api/auth/login', login],
  ['GET /api/auth/status', status],
  ['POST /api/auth/consent', consent],
  ['POST /api/auth/logout', logout],
  ['GET /api/members/profile', memberProfileGet],
  ['POST /api/members/profile', memberProfilePost],
  ['GET /api/members/directory', memberDirectory],
  ['GET /api/members/organizer-request', organizerRequestGet],
  ['POST /api/members/organizer-request', organizerRequestPost],
  ['GET /api/members/messages', messagesGet],
  ['POST /api/members/messages', messagesPost],
  ['POST /api/members/albums', albumsPost],
  ['POST /api/members/couple-invite', coupleInvitePost],
  ['POST /api/admin/invites', adminInvitePost]
]);

const PROTECTED_PREFIXES = ['/membres', '/pro', '/control'];

function securityHeaders(response) {
  const secured = new Response(response.body, response);
  secured.headers.set('x-content-type-options', 'nosniff');
  secured.headers.set('x-frame-options', 'SAMEORIGIN');
  secured.headers.set('referrer-policy', 'no-referrer');
  secured.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()');
  secured.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  return secured;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const apiHandler = API_ROUTES.get(`${request.method} ${url.pathname}`);

    if (apiHandler) {
      return securityHeaders(await apiHandler({ request, env }));
    }
    if (url.pathname.startsWith('/api/')) {
      return securityHeaders(new Response('API Velvet inconnue.', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store'
        }
      }));
    }

    const isProtected = PROTECTED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
    const response = isProtected
      ? await protectApplication({
          request,
          env,
          next: () => env.ASSETS.fetch(request)
        })
      : await env.ASSETS.fetch(request);

    return securityHeaders(response);
  }
};
