import { readFile } from 'node:fs/promises';

const paths = [
  'apps/beta/static/assets/members-onboarding-v2.js',
  'apps/beta/static/assets/members-live.js',
  'apps/beta/static/assets/pro-live.js',
  'apps/beta/static/assets/control-live.js',
  'apps/beta/worker/index.js',
  'functions/api/members/profile.js',
  'functions/api/members/couple-profile.js',
  'functions/api/members/couple-invite.js',
  'functions/api/members/_shared.js',
  'functions/api/members/media.js',
  'functions/api/members/photos.js',
  'functions/api/members/albums.js',
  'functions/api/members/album-media.js',
  'functions/api/members/album-access.js',
  'functions/api/members/photo-reactions.js',
  'functions/api/members/conversations.js',
  'functions/api/members/messages.js',
  'functions/api/members/event-registrations.js',
  'functions/api/members/venue-relationships.js',
  'functions/api/members/settings.js',
  'functions/api/members/verification.js',
  'functions/api/admin/invites.js',
  'functions/api/control/workspace.js',
  'functions/api/pro/workspace.js'
];

const files = Object.fromEntries(await Promise.all(paths.map(async (path) => [
  path,
  await readFile(path, 'utf8')
])));
const has = (path, ...tokens) => tokens.every((token) => files[path].includes(token));
const worker = files['apps/beta/worker/index.js'];
const invalidProfileEmbeds = Object.entries(files)
  .filter(([path, content]) => path.startsWith('functions/api/members/') && content.includes('&profile_members!inner'));

if (invalidProfileEmbeds.length) {
  throw new Error(`Intégration PostgREST profile_members invalide : ${invalidProfileEmbeds.map(([path]) => path).join(', ')}`);
}

const journeys = [
  {
    name: 'Inscription individuelle',
    valid: has('functions/api/members/profile.js', 'upsert_my_beta_profile', 'profile_persistence_failed')
      && has('apps/beta/static/assets/members-onboarding-v2.js', 'individual', '/api/members/profile')
  },
  {
    name: 'Inscription couple',
    valid: has('functions/api/members/couple-profile.js', 'create_my_couple_profile', 'couple_profile_persistence_failed')
      && has('apps/beta/static/assets/members-onboarding-v2.js', '/api/members/couple-profile', 'startCoupleCommon')
  },
  {
    name: 'Invitation de la moitié',
    valid: has('functions/api/members/couple-invite.js', 'invite_my_couple_partner', 'couple_invitation_persistence_failed')
      && worker.includes("'POST /api/members/couple-invite'")
  },
  {
    name: 'Photos de profil et admission',
    valid: has('functions/api/members/photos.js', 'photo_persistence_failed', 'record_photo_ai_decision', 'admission', 'profile_members!inner(user_id,status),individual_profiles')
      && has('functions/api/members/photos.js', 'onRequestPatch', 'photo_ai_retry_failed', '/storage/v1/object/authenticated/')
      && has('functions/api/members/media.js', '/storage/v1/', "replace(/^\\/+/, '')", 'expiresIn: 600')
      && has('apps/beta/static/assets/members-live.js', '/api/members/photos', 'photo-upload-status')
      && has('apps/beta/static/assets/members-onboarding-v2.js', "profile.profile_type === 'individual' && galleryCount < 3", 'data-add-gallery')
      && has('functions/api/control/workspace.js', 'decide_profile_photo', 'control_decide_profile_photo')
      && has('apps/beta/static/assets/control-live.js', 'data-photo-decision', 'Photos de profil à contrôler')
  },
  {
    name: 'Albums publics et privés',
    valid: has('functions/api/members/albums.js', 'album_persistence_failed')
      && has('functions/api/members/album-media.js', 'photo_persistence_failed')
      && has('functions/api/members/album-access.js', 'grant_private_album_to_profile', 'revoke_private_album_from_profile')
  },
  {
    name: 'Réactions aux photos',
    valid: has('functions/api/members/photo-reactions.js', 'set_photo_reaction', 'result?.[0]')
      && has('apps/beta/static/assets/members-live.js', '/api/members/photo-reactions', 'photo_reaction_persistence_failed')
  },
  {
    name: 'Conversation et messages',
    valid: has('functions/api/members/conversations.js', 'start_direct_profile_conversation', 'conversation_persistence_failed')
      && has('functions/api/members/messages.js', 'message_persistence_failed')
  },
  {
    name: 'Inscription à une sortie',
    valid: has('functions/api/members/event-registrations.js', 'register_for_event', 'cancel_my_event_registration')
      && has('apps/beta/static/assets/members-live.js', '/api/members/event-registrations')
  },
  {
    name: 'Préférences établissements',
    valid: has('functions/api/members/venue-relationships.js', 'set_my_venue_relationship', 'relationships: await relationships')
      && has('apps/beta/static/assets/members-live.js', '/api/members/venue-relationships', 'data-venue-relation')
  },
  {
    name: 'Invitation depuis Control',
    valid: has('functions/api/admin/invites.js', 'invite_persistence_failed', 'registrationUrl')
      && worker.includes("'POST /api/admin/invites'")
  },
  {
    name: 'Attribution et abonnement Pro',
    valid: has('functions/api/control/workspace.js', 'claim_directory_venue', 'subscription_status')
      && has('functions/api/pro/workspace.js', 'pro_subscription_required', 'publish_venue', 'create_event')
      && has('apps/beta/static/assets/control-live.js', 'controlClaimVenueForm', 'data-subscription-status')
      && has('apps/beta/static/assets/pro-live.js', "'trial', 'active'", 'Abonnement Velvet Pro requis')
  }
];

const failures = journeys.filter((journey) => !journey.valid);
if (failures.length) {
  throw new Error(`Recette contractuelle incomplète : ${failures.map((journey) => journey.name).join(', ')}`);
}

console.log(`Velvet user journey checks passed: ${journeys.length} parcours bout en bout couverts`);
