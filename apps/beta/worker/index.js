import { onRequest as protectApplication } from '../../../functions/_middleware.js';
import { onRequestPost as signup } from '../../../functions/api/auth/signup.js';
import { onRequestPost as login } from '../../../functions/api/auth/login.js';
import { onRequestGet as status } from '../../../functions/api/auth/status.js';
import { onRequestPost as consent } from '../../../functions/api/auth/consent.js';
import { onRequestPost as logout } from '../../../functions/api/auth/logout.js';
import { onRequestGet as authConfig } from '../../../functions/api/auth/config.js';
import { onRequestPost as recoveryRequest } from '../../../functions/api/auth/recovery-request.js';
import { onRequestPost as passwordUpdate } from '../../../functions/api/auth/password-update.js';
import {
  onRequestGet as memberProfileGet,
  onRequestPost as memberProfilePost
} from '../../../functions/api/members/profile.js';
import { onRequestPost as coupleProfilePost } from '../../../functions/api/members/couple-profile.js';
import { onRequestGet as memberDirectory } from '../../../functions/api/members/directory.js';
import {
  onRequestGet as organizerRequestGet,
  onRequestPost as organizerRequestPost
} from '../../../functions/api/members/organizer-request.js';
import {
  onRequestGet as messagesGet,
  onRequestPost as messagesPost
} from '../../../functions/api/members/messages.js';
import { onRequestPost as conversationsPost } from '../../../functions/api/members/conversations.js';
import {
  onRequestGet as socialActionsGet,
  onRequestPost as socialActionsPost
} from '../../../functions/api/members/social-actions.js';
import {
  onRequestGet as eventRegistrationsGet,
  onRequestPost as eventRegistrationsPost
} from '../../../functions/api/members/event-registrations.js';
import { onRequestPost as albumsPost } from '../../../functions/api/members/albums.js';
import {
  onRequestDelete as albumMediaDelete,
  onRequestPost as albumMediaPost
} from '../../../functions/api/members/album-media.js';
import {
  onRequestDelete as albumAccessDelete,
  onRequestPost as albumAccessPost
} from '../../../functions/api/members/album-access.js';
import {
  onRequestGet as coupleInviteGet,
  onRequestPost as coupleInvitePost
} from '../../../functions/api/members/couple-invite.js';
import {
  onRequestDelete as memberPhotosDelete,
  onRequestGet as memberPhotosGet,
  onRequestPost as memberPhotosPost
} from '../../../functions/api/members/photos.js';
import {
  onRequestGet as adminInviteGet,
  onRequestPost as adminInvitePost
} from '../../../functions/api/admin/invites.js';
import { onRequestPost as adminVenueImportPost } from '../../../functions/api/admin/venue-import.js';
import { onRequestGet as communeReferenceGet } from '../../../functions/api/reference/communes.js';
import { onRequestGet as venueReferenceGet } from '../../../functions/api/reference/venues.js';
import {
  onRequestGet as memberSettingsGet,
  onRequestPost as memberSettingsPost
} from '../../../functions/api/members/settings.js';
import {
  onRequestDelete as pushSubscriptionsDelete,
  onRequestGet as pushSubscriptionsGet,
  onRequestPost as pushSubscriptionsPost
} from '../../../functions/api/members/push-subscriptions.js';
import {
  onRequestDelete as memberLocationDelete,
  onRequestGet as memberLocationGet,
  onRequestPost as memberLocationPost
} from '../../../functions/api/members/location.js';
import {
  onRequestCallback as memberVerificationCallback,
  onRequestGet as memberVerificationGet,
  onRequestPost as memberVerificationPost
} from '../../../functions/api/members/verification.js';
import {
  onRequestGet as memberEngagementGet,
  onRequestPost as memberEngagementPost
} from '../../../functions/api/members/engagement.js';
import {
  onRequestGet as photoReactionsGet,
  onRequestPost as photoReactionsPost
} from '../../../functions/api/members/photo-reactions.js';
import {
  onRequestGet as memberNotificationsGet,
  onRequestPost as memberNotificationsPost
} from '../../../functions/api/members/notifications.js';
import { onRequestGet as memberMapGet } from '../../../functions/api/members/map.js';
import { velvetIconResponse } from './velvet-icons.js';

const API_ROUTES = new Map([
  ['POST /api/auth/signup', signup],
  ['POST /api/auth/login', login],
  ['GET /api/auth/status', status],
  ['POST /api/auth/consent', consent],
  ['POST /api/auth/logout', logout],
  ['GET /api/auth/config', authConfig],
  ['POST /api/auth/recovery-request', recoveryRequest],
  ['POST /api/auth/password-update', passwordUpdate],
  ['GET /api/members/profile', memberProfileGet],
  ['POST /api/members/profile', memberProfilePost],
  ['POST /api/members/couple-profile', coupleProfilePost],
  ['GET /api/members/directory', memberDirectory],
  ['GET /api/members/organizer-request', organizerRequestGet],
  ['POST /api/members/organizer-request', organizerRequestPost],
  ['GET /api/members/messages', messagesGet],
  ['POST /api/members/messages', messagesPost],
  ['POST /api/members/conversations', conversationsPost],
  ['GET /api/members/social-actions', socialActionsGet],
  ['POST /api/members/social-actions', socialActionsPost],
  ['GET /api/members/event-registrations', eventRegistrationsGet],
  ['POST /api/members/event-registrations', eventRegistrationsPost],
  ['POST /api/members/albums', albumsPost],
  ['POST /api/members/album-media', albumMediaPost],
  ['DELETE /api/members/album-media', albumMediaDelete],
  ['POST /api/members/album-access', albumAccessPost],
  ['DELETE /api/members/album-access', albumAccessDelete],
  ['GET /api/members/couple-invite', coupleInviteGet],
  ['POST /api/members/couple-invite', coupleInvitePost],
  ['GET /api/members/photos', memberPhotosGet],
  ['POST /api/members/photos', memberPhotosPost],
  ['DELETE /api/members/photos', memberPhotosDelete],
  ['GET /api/admin/invites', adminInviteGet],
  ['POST /api/admin/invites', adminInvitePost],
  ['POST /api/admin/venue-import', adminVenueImportPost],
  ['GET /api/reference/communes', communeReferenceGet],
  ['GET /api/reference/venues', venueReferenceGet],
  ['GET /api/members/settings', memberSettingsGet],
  ['POST /api/members/settings', memberSettingsPost],
  ['GET /api/members/push-subscriptions', pushSubscriptionsGet],
  ['POST /api/members/push-subscriptions', pushSubscriptionsPost],
  ['DELETE /api/members/push-subscriptions', pushSubscriptionsDelete],
  ['GET /api/members/location', memberLocationGet],
  ['POST /api/members/location', memberLocationPost],
  ['DELETE /api/members/location', memberLocationDelete],
  ['GET /api/members/verification', memberVerificationGet],
  ['POST /api/members/verification', memberVerificationPost],
  ['GET /api/members/verification/callback', memberVerificationCallback],
  ['GET /api/members/engagement', memberEngagementGet],
  ['POST /api/members/engagement', memberEngagementPost],
  ['GET /api/members/photo-reactions', photoReactionsGet],
  ['POST /api/members/photo-reactions', photoReactionsPost],
  ['GET /api/members/notifications', memberNotificationsGet],
  ['POST /api/members/notifications', memberNotificationsPost],
  ['GET /api/members/map', memberMapGet]
]);

const PROTECTED_PREFIXES = ['/membres', '/pro', '/control'];

function securityHeaders(response) {
  const secured = new Response(response.body, response);
  secured.headers.set('x-content-type-options', 'nosniff');
  secured.headers.set('x-frame-options', 'SAMEORIGIN');
  secured.headers.set('referrer-policy', 'no-referrer');
  secured.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()');
  secured.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  secured.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  secured.headers.set('cross-origin-opener-policy', 'same-origin');
  secured.headers.set('cross-origin-resource-policy', 'same-origin');
  secured.headers.set(
    'content-security-policy',
    "default-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com https://tile.openstreetmap.org; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; upgrade-insecure-requests"
  );
  return secured;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const iconResponse = velvetIconResponse(url.pathname);
    if (iconResponse) return securityHeaders(iconResponse);

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
