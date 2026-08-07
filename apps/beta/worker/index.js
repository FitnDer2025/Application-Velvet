import { onRequest as protectApplication } from '../../../functions/_middleware.js';
import { onRequestPost as signup } from '../../../functions/api/auth/signup.js';
import { onRequestPost as login } from '../../../functions/api/auth/login.js';
import { onRequestGet as status } from '../../../functions/api/auth/status.js';
import { onRequestPost as consent } from '../../../functions/api/auth/consent.js';
import { onRequestPost as logout } from '../../../functions/api/auth/logout.js';
import { onRequestGet as authConfig } from '../../../functions/api/auth/config.js';
import { onRequestPost as recoveryRequest } from '../../../functions/api/auth/recovery-request.js';
import { onRequestPost as passwordUpdate } from '../../../functions/api/auth/password-update.js';
import { onRequestPost as waitlistPost } from '../../../functions/api/waitlist.js';
import {
  onRequestGet as memberProfileGet,
  onRequestPost as memberProfilePost
} from '../../../functions/api/members/profile.js';
import { onRequestPost as memberProfileCopyPost } from '../../../functions/api/members/profile-copy.js';
import { onRequestPost as coupleProfilePost } from '../../../functions/api/members/couple-profile.js';
import { onRequestGet as memberDirectory } from '../../../functions/api/members/directory.js';
import { onRequestGet as homeIntelligenceGet } from '../../../functions/api/members/home-intelligence.js';
import {
  onRequestGet as experiencePreferencesGet,
  onRequestPost as experiencePreferencesPost
} from '../../../functions/api/members/experience-preferences.js';
import { onRequestDelete as photoManagementDelete } from '../../../functions/api/members/photo-management.js';
import {
  onRequestDelete as memberEventsDelete,
  onRequestGet as memberEventsGet,
  onRequestPost as memberEventsPost
} from '../../../functions/api/members/events.js';
import {
  onRequestGet as organizerRequestGet,
  onRequestPost as organizerRequestPost
} from '../../../functions/api/members/organizer-request.js';
import {
  onRequestGet as messagesGet,
  onRequestPost as messagesPost
} from '../../../functions/api/members/messages.js';
import {
  onRequestDelete as memberPlansDelete,
  onRequestGet as memberPlansGet,
  onRequestPost as memberPlansPost
} from '../../../functions/api/members/plans.js';
import {
  onRequestGet as accountActionsGet,
  onRequestPost as accountActionsPost
} from '../../../functions/api/members/account-actions.js';
import { onRequestPost as accountDeletionPost } from '../../../functions/api/members/account-deletion.js';
import {
  onRequestDelete as conversationsDelete,
  onRequestPost as conversationsPost
} from '../../../functions/api/members/conversations.js';
import {
  onRequestGet as socialActionsGet,
  onRequestPost as socialActionsPost
} from '../../../functions/api/members/social-actions.js';
import {
  onRequestGet as eventRegistrationsGet,
  onRequestPost as eventRegistrationsPost
} from '../../../functions/api/members/event-registrations.js';
import {
  onRequestGet as albumsGet,
  onRequestPost as albumsPost
} from '../../../functions/api/members/albums.js';
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
  onRequestPatch as memberPhotosPatch,
  onRequestPost as memberPhotosPost
} from '../../../functions/api/members/photos.js';
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
  onRequestDelete as pushDevicesDelete,
  onRequestGet as pushDevicesGet,
  onRequestPost as pushDevicesPost
} from '../../../functions/api/members/push-devices.js';
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
  onRequestGet as memberDataExportGet,
  onRequestPost as memberDataExportPost
} from '../../../functions/api/members/data-export.js';
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
import { onRequestPost as mediaSecurityEventsPost } from '../../../functions/api/members/media-security-events.js';
import { onRequestGet as memberMapGet } from '../../../functions/api/members/map.js';
import {
  onRequestDelete as memberDiscoveryDelete,
  onRequestGet as memberDiscoveryGet,
  onRequestPost as memberDiscoveryPost
} from '../../../functions/api/members/discovery.js';
import {
  onRequestGet as venueRelationshipsGet,
  onRequestPost as venueRelationshipsPost
} from '../../../functions/api/members/venue-relationships.js';
import {
  onRequestDelete as tonightDelete,
  onRequestGet as tonightGet,
  onRequestPost as tonightPost
} from '../../../functions/api/members/tonight.js';
import { onRequestGet as passportGet } from '../../../functions/api/members/passport.js';
import { onRequestPost as checkInPost } from '../../../functions/api/members/check-in.js';
import {
  onRequestGet as conversationRequestGet,
  onRequestPatch as conversationRequestPatch
} from '../../../functions/api/members/conversation-request.js';
import { onRequestPost as voiceMessagePost } from '../../../functions/api/members/voice-message.js';
import {
  onRequestPatch as ephemeralMessagePatch,
  onRequestPost as ephemeralMessagePost
} from '../../../functions/api/members/ephemeral-message.js';
import {
  onRequestGet as videoCallGet,
  onRequestPost as videoCallPost
} from '../../../functions/api/members/video-call.js';
import {
  onRequestGet as spacesGet,
  onRequestPost as spacesPost
} from '../../../functions/api/members/spaces.js';
import { onRequestGet as contextualRecommendationsGet } from '../../../functions/api/members/contextual-recommendations.js';
import {
  onRequestGet as recommendationFeedbackGet,
  onRequestPost as recommendationFeedbackPost
} from '../../../functions/api/members/recommendation-feedback.js';
import {
  onRequestGet as adminInviteGet,
  onRequestPost as adminInvitePost
} from '../../../functions/api/admin/invites.js';
import { onRequestPost as adminVenueImportPost } from '../../../functions/api/admin/venue-import.js';
import { onRequestGet as communeReferenceGet } from '../../../functions/api/reference/communes.js';
import { onRequestGet as venueReferenceGet } from '../../../functions/api/reference/venues.js';
import {
  onRequestGet as proWorkspaceGet,
  onRequestPost as proWorkspacePost
} from '../../../functions/api/pro/workspace.js';
import {
  onRequestGet as proStudioGet,
  onRequestPost as proStudioPost
} from '../../../functions/api/pro/studio-ai-secure.js';
import {
  onMetaCallback as proMarketingMetaCallback,
  onMetaStart as proMarketingMetaStart,
  onRequestGet as proMarketingGet,
  onRequestMedia as proMarketingMediaGet,
  onRequestPost as proMarketingPost,
  onTikTokCallback as proMarketingTikTokCallback,
  onTikTokStart as proMarketingTikTokStart,
  processDuePublications
} from '../../../functions/api/pro/marketing.js';
import {
  onRequestGet as controlWorkspaceGet,
  onRequestPost as controlWorkspacePost
} from '../../../functions/api/control/workspace.js';
import {
  onRequestGet as controlWaitlistGet,
  onRequestPatch as controlWaitlistPatch
} from '../../../functions/api/control/waitlist.js';
import {
  onRequestGet as testAgentsGet,
  onRequestPost as testAgentsPost
} from '../../../functions/api/control/test-agents.js';
import { onRequestPost as studioMediaPost } from '../../../functions/api/control/studio-media-safe.js';
import { onRequestGet as marketingPortraitGet } from '../../../functions/api/control/marketing-portrait.js';
import { onRequestGet as billingCatalogGet } from '../../../functions/api/billing/catalog.js';
import { onRequestPost as billingCheckoutPost } from '../../../functions/api/billing/checkout.js';
import { onRequestPost as billingPromotionPost } from '../../../functions/api/billing/promotion.js';

const API_ROUTES = new Map([
  ['POST /api/auth/signup', signup],
  ['POST /api/auth/login', login],
  ['GET /api/auth/status', status],
  ['POST /api/auth/consent', consent],
  ['POST /api/auth/logout', logout],
  ['GET /api/auth/config', authConfig],
  ['POST /api/auth/recovery-request', recoveryRequest],
  ['POST /api/auth/password-update', passwordUpdate],
  ['POST /api/waitlist', waitlistPost],
  ['GET /api/members/profile', memberProfileGet],
  ['POST /api/members/profile', memberProfilePost],
  ['POST /api/members/profile-copy', memberProfileCopyPost],
  ['POST /api/members/couple-profile', coupleProfilePost],
  ['GET /api/members/directory', memberDirectory],
  ['GET /api/members/home-intelligence', homeIntelligenceGet],
  ['GET /api/members/experience-preferences', experiencePreferencesGet],
  ['POST /api/members/experience-preferences', experiencePreferencesPost],
  ['DELETE /api/members/photo-management', photoManagementDelete],
  ['GET /api/members/events', memberEventsGet],
  ['POST /api/members/events', memberEventsPost],
  ['DELETE /api/members/events', memberEventsDelete],
  ['GET /api/members/organizer-request', organizerRequestGet],
  ['POST /api/members/organizer-request', organizerRequestPost],
  ['GET /api/members/messages', messagesGet],
  ['POST /api/members/messages', messagesPost],
  ['GET /api/members/plans', memberPlansGet],
  ['POST /api/members/plans', memberPlansPost],
  ['DELETE /api/members/plans', memberPlansDelete],
  ['GET /api/members/account-actions', accountActionsGet],
  ['POST /api/members/account-actions', accountActionsPost],
  ['POST /api/members/account-deletion', accountDeletionPost],
  ['POST /api/members/conversations', conversationsPost],
  ['DELETE /api/members/conversations', conversationsDelete],
  ['GET /api/members/social-actions', socialActionsGet],
  ['POST /api/members/social-actions', socialActionsPost],
  ['GET /api/members/event-registrations', eventRegistrationsGet],
  ['POST /api/members/event-registrations', eventRegistrationsPost],
  ['GET /api/members/albums', albumsGet],
  ['POST /api/members/albums', albumsPost],
  ['POST /api/members/album-media', albumMediaPost],
  ['DELETE /api/members/album-media', albumMediaDelete],
  ['POST /api/members/album-access', albumAccessPost],
  ['DELETE /api/members/album-access', albumAccessDelete],
  ['GET /api/members/couple-invite', coupleInviteGet],
  ['POST /api/members/couple-invite', coupleInvitePost],
  ['GET /api/members/photos', memberPhotosGet],
  ['POST /api/members/photos', memberPhotosPost],
  ['PATCH /api/members/photos', memberPhotosPatch],
  ['DELETE /api/members/photos', memberPhotosDelete],
  ['GET /api/members/settings', memberSettingsGet],
  ['POST /api/members/settings', memberSettingsPost],
  ['GET /api/members/push-subscriptions', pushSubscriptionsGet],
  ['POST /api/members/push-subscriptions', pushSubscriptionsPost],
  ['DELETE /api/members/push-subscriptions', pushSubscriptionsDelete],
  ['GET /api/members/push-devices', pushDevicesGet],
  ['POST /api/members/push-devices', pushDevicesPost],
  ['DELETE /api/members/push-devices', pushDevicesDelete],
  ['GET /api/members/location', memberLocationGet],
  ['POST /api/members/location', memberLocationPost],
  ['DELETE /api/members/location', memberLocationDelete],
  ['GET /api/members/verification', memberVerificationGet],
  ['POST /api/members/verification', memberVerificationPost],
  ['GET /api/members/verification/callback', memberVerificationCallback],
  ['GET /api/members/data-export', memberDataExportGet],
  ['POST /api/members/data-export', memberDataExportPost],
  ['GET /api/members/engagement', memberEngagementGet],
  ['POST /api/members/engagement', memberEngagementPost],
  ['GET /api/members/photo-reactions', photoReactionsGet],
  ['POST /api/members/photo-reactions', photoReactionsPost],
  ['GET /api/members/notifications', memberNotificationsGet],
  ['POST /api/members/notifications', memberNotificationsPost],
  ['POST /api/members/media-security-events', mediaSecurityEventsPost],
  ['GET /api/members/map', memberMapGet],
  ['GET /api/members/discovery', memberDiscoveryGet],
  ['POST /api/members/discovery', memberDiscoveryPost],
  ['DELETE /api/members/discovery', memberDiscoveryDelete],
  ['GET /api/members/venue-relationships', venueRelationshipsGet],
  ['POST /api/members/venue-relationships', venueRelationshipsPost],
  ['GET /api/members/tonight', tonightGet],
  ['POST /api/members/tonight', tonightPost],
  ['DELETE /api/members/tonight', tonightDelete],
  ['GET /api/members/passport', passportGet],
  ['POST /api/members/check-in', checkInPost],
  ['GET /api/members/conversation-request', conversationRequestGet],
  ['PATCH /api/members/conversation-request', conversationRequestPatch],
  ['POST /api/members/voice-message', voiceMessagePost],
  ['POST /api/members/ephemeral-message', ephemeralMessagePost],
  ['PATCH /api/members/ephemeral-message', ephemeralMessagePatch],
  ['GET /api/members/video-call', videoCallGet],
  ['POST /api/members/video-call', videoCallPost],
  ['GET /api/members/spaces', spacesGet],
  ['POST /api/members/spaces', spacesPost],
  ['GET /api/members/contextual-recommendations', contextualRecommendationsGet],
  ['GET /api/members/recommendation-feedback', recommendationFeedbackGet],
  ['POST /api/members/recommendation-feedback', recommendationFeedbackPost],
  ['GET /api/admin/invites', adminInviteGet],
  ['POST /api/admin/invites', adminInvitePost],
  ['POST /api/admin/venue-import', adminVenueImportPost],
  ['GET /api/reference/communes', communeReferenceGet],
  ['GET /api/reference/venues', venueReferenceGet],
  ['GET /api/pro/workspace', proWorkspaceGet],
  ['POST /api/pro/workspace', proWorkspacePost],
  ['GET /api/pro/studio-ai', proStudioGet],
  ['POST /api/pro/studio-ai', proStudioPost],
  ['GET /api/pro/marketing', proMarketingGet],
  ['POST /api/pro/marketing', proMarketingPost],
  ['GET /api/pro/marketing/oauth/meta/start', proMarketingMetaStart],
  ['GET /api/pro/marketing/oauth/meta/callback', proMarketingMetaCallback],
  ['GET /api/pro/marketing/oauth/tiktok/start', proMarketingTikTokStart],
  ['GET /api/pro/marketing/oauth/tiktok/callback', proMarketingTikTokCallback],
  ['GET /api/pro/marketing/media', proMarketingMediaGet],
  ['GET /api/control/workspace', controlWorkspaceGet],
  ['POST /api/control/workspace', controlWorkspacePost],
  ['GET /api/control/waitlist', controlWaitlistGet],
  ['PATCH /api/control/waitlist', controlWaitlistPatch],
  ['GET /api/control/test-agents', testAgentsGet],
  ['POST /api/control/test-agents', testAgentsPost],
  ['POST /api/control/studio-media', studioMediaPost],
  ['GET /api/control/marketing-portrait', marketingPortraitGet],
  ['GET /api/billing/catalog', billingCatalogGet],
  ['POST /api/billing/checkout', billingCheckoutPost],
  ['POST /api/billing/promotion', billingPromotionPost]
]);

const PROTECTED_PREFIXES = ['/membres', '/marketing', '/marketing-pro', '/studio-capture', '/pro', '/control'];

function securityHeaders(response) {
  const secured = new Response(response.body, response);
  secured.headers.set('x-content-type-options', 'nosniff');
  secured.headers.set('x-frame-options', 'SAMEORIGIN');
  secured.headers.set('referrer-policy', 'no-referrer');
  secured.headers.set('permissions-policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=(self), payment=(), usb=()');
  secured.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  secured.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  secured.headers.set('cross-origin-opener-policy', 'same-origin');
  secured.headers.set('cross-origin-resource-policy', 'same-origin');
  secured.headers.set(
    'content-security-policy',
    "default-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://tile.openstreetmap.org; media-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; upgrade-insecure-requests"
  );
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
      return securityHeaders(new Response('API Zwit inconnue.', {
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
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(processDuePublications(env).catch((error) => {
      console.error('Zwit Marketing scheduler failed', error?.message || error);
    }));
  }
};