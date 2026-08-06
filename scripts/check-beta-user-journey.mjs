import { readFile } from 'node:fs/promises';

const paths = [
  'apps/beta/static/assets/members-onboarding-v2.js',
  'apps/beta/static/assets/members-live.js',
  'apps/beta/static/assets/members-live.css',
  'apps/beta/static/assets/real-auth-gate.js',
  'apps/beta/static/assets/location-verification.js',
  'apps/beta/static/assets/pro-live.js',
  'apps/beta/static/assets/control-live.js',
  'apps/beta/worker/index.js',
  'functions/api/members/profile.js',
  'functions/api/members/profile-copy.js',
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
  'functions/api/members/social-actions.js',
  'functions/api/members/plans.js',
  'functions/api/members/account-actions.js',
  'functions/api/members/event-registrations.js',
  'functions/api/members/discovery.js',
  'functions/api/members/directory.js',
  'functions/api/members/map.js',
  'functions/api/members/venue-address-coordinates.js',
  'functions/api/members/venue-geocoding.js',
  'functions/api/members/venue-relationships.js',
  'functions/api/members/settings.js',
  'functions/api/members/verification.js',
  'functions/api/admin/invites.js',
  'functions/api/control/workspace.js',
  'functions/api/pro/workspace.js',
  'functions/api/reference/communes.js'
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
    name: 'Plume Zwit IA',
    valid: has('functions/api/members/profile-copy.js', 'memberSession', 'hasSufficientSource', 'messages', 'Tu n’inventes jamais', 'uniquement du contenu à reformuler')
      && has('apps/beta/static/assets/members-onboarding-v2.js', '/api/members/profile-copy', 'data-ai-writer', 'sufficientAiSource')
      && has('apps/beta/static/assets/members-live.js', '/api/members/profile-copy', 'data-ai-writer', 'sufficientAiSource')
      && worker.includes("'POST /api/members/profile-copy'")
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
      && has('functions/api/members/media.js', '/storage/v1/', "replace(/^\\/+/, '')", 'expiresIn: ttl', "signedPath.startsWith('/storage/v1/')")
      && has('apps/beta/static/assets/members-live.js', '/api/members/photos', 'photo-upload-status')
      && has('apps/beta/static/assets/members-live.js', 'Album système public', 'Photos de profil', 'profilePhotos.length || albums.length', 'data-album-folder', 'Ouvrir le dossier')
      && has('apps/beta/static/assets/members-onboarding-v2.js', "profile.profile_type === 'individual' && galleryCount < 3", 'data-add-gallery')
      && has('functions/api/control/workspace.js', 'decide_media', 'control_decide_media')
      && has('apps/beta/static/assets/control-live.js', 'data-media-decision', 'File de contrôle média', 'control-media-viewer')
  },
  {
    name: 'Albums publics et privés',
    valid: has('functions/api/members/albums.js', 'album_persistence_failed')
      && has('functions/api/members/album-media.js', 'photo_persistence_failed')
      && has('functions/api/members/album-access.js', 'grant_private_album_to_profile', 'revoke_private_album_from_profile')
      && has('apps/beta/static/assets/members-live.js', 'album-folder-cover', 'Contenu privé', 'Aucun aperçu avant autorisation')
      && has('apps/beta/static/assets/members-live.js', 'openAlbumLightbox', 'data-album-lightbox', 'touchstart', 'ArrowRight')
      && has('apps/beta/static/assets/members-live.js', 'album-folder-meta')
      && has('apps/beta/static/assets/members-live.css', '.album-folder[open] .album-cover-media{display:none}', '.album-lightbox', '.lightbox-stage', '.album-photo-button')
      && has('apps/beta/static/assets/members-live.css', '.album-folder:before{display:none}', '.album-folder[open]:before{display:none}', '.album-folder[open] .album-detail>header{display:none}')
  },
  {
    name: 'Présentation singulier et genre',
    valid: has('apps/beta/static/assets/members-live.js', 'function profileVoice', 'Qui suis-je ?', 'Mon histoire', 'Ce que je recherche')
      && has('apps/beta/static/assets/members-live.js', 'Profil femme', 'Profil homme', 'Profil non binaire', 'Membre BETA réelle')
  },
  {
    name: 'Réactions aux photos',
    valid: has('functions/api/members/photo-reactions.js', 'set_photo_reaction', 'result?.[0]')
      && has('apps/beta/static/assets/members-live.js', '/api/members/photo-reactions', 'photo_reaction_persistence_failed', 'data-profile-carousel', 'data-carousel-next', 'data-carousel-to')
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
    name: 'Accueil et recherche filtrée',
    valid: has('apps/beta/static/assets/members-live.js', 'homeDiscoveryProfiles', 'Les profils qui comptent', 'Ce qui se passe maintenant', 'homeFeedItems')
      && has('apps/beta/static/assets/members-live.js', 'maleAgeMin', 'femaleAgeMin', 'discoverChoices', 'filteredDiscoverProfiles', 'data-save-search', 'presenceBadge')
      && has('functions/api/members/discovery.js', 'member_saved_searches', 'member_presence_snapshot')
  },
  {
    name: 'Catalogue établissements géographique',
    valid: has('apps/beta/static/assets/members-live.js', 'venueCatalogCountry', 'venueCatalogRegion', 'venueCatalogLocation', 'venueCatalogRadius', 'mapDistanceKm')
      && has('apps/beta/static/assets/members-live.js', "pageHead('Recherche sur mesure', 'Recherche'")
      && has('functions/api/members/directory.js', 'seededVenueCoordinates', 'enrichVenueCoordinates')
      && has('functions/api/reference/communes.js', 'FRENCH_REGIONS', 'belgianLocations', 'latitude', 'longitude')
      && !files['apps/beta/static/assets/location-verification.js'].includes('Les lieux les plus proches')
      && !files['apps/beta/static/assets/location-verification.js'].includes('refreshNearbyVenues')
  },
  {
    name: 'Thème clair Zwit',
    valid: has('apps/beta/static/assets/members-live.js', 'velvet-member-theme-v1', 'Mode clair', 'applyTheme')
      && has('apps/beta/static/assets/members-live.css', 'html[data-theme="light"]', '#f4f4f2', '#641b36', '#c6a96a')
  },
  {
    name: 'Maps pilotable et privée',
    valid: has('apps/beta/static/assets/members-live.js', 'mapZoom: 10', 'data-map-zoom', 'data-map-layer', 'Rayon d’environ', 'Hôtels')
      && has('apps/beta/static/assets/members-live.js', 'mapVisibleVenues', 'data-dynamic-map', 'pointermove', 'panMapByPixels', 'defaultMapZoom', 'mapWorkspace')
      && has('apps/beta/static/assets/members-live.css', '.map-visible-results', '.map-workspace', 'cursor:grab', 'touch-action:none')
      && has('functions/api/members/map.js', 'radiusKm: 50', 'private_approximate_location', 'category_primary', 'categoryTags', 'geocodeVenueAddress', 'public_address_geocoding')
      && !files['functions/api/members/map.js'].includes('address_public,latitude,longitude')
      && has('functions/api/members/venue-address-coordinates.js', '9 rue chemin vert lens france', '"precision": "address"')
      && has('functions/api/members/venue-geocoding.js', 'venueAddressQuery', 'VENUE_ADDRESS_COORDINATES', 'data.geopf.fr/geocodage/search')
      && has('apps/beta/static/assets/members-live.js', '/api/members/location', 'exacte n’est jamais enregistrée')
  },
  {
    name: 'Agenda réservé aux lieux concernés',
    valid: has('apps/beta/static/assets/members-live.js', "['club', 'spa', 'bar']", 'supportsAgenda', 'Prochaines soirées')
  },
  {
    name: 'Routage direct des membres',
    valid: has('apps/beta/static/assets/real-auth-gate.js', 'canChooseDestination', "roles.includes('admin')", "roles.includes('moderator')", "window.location.replace(destination)", "'/membres/'")
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
      && has('apps/beta/static/assets/pro-live.js', "'trial', 'active'", 'Abonnement Zwit Pro requis')
  },
  {
    name: 'Messagerie avec pièces jointes',
    valid: has('functions/api/members/messages.js', 'message_attachments', 'ATTACHMENT_TYPES', 'message_attachment_persistence_failed')
      && has('apps/beta/static/assets/members-live.js', 'messageAttachments', 'name="attachments"', 'Photo, vidéo ou PDF')
  },
  {
    name: 'Sorties et séjours publics',
    valid: has('functions/api/members/plans.js', 'profile_venue_visits', 'profile_travel_plans', 'cap_dagde_village')
      && has('apps/beta/static/assets/members-live.js', 'profilePlansView', 'classic-travel-form', 'cap-travel-form', 'capDagdePlan')
      && has('apps/beta/static/assets/members-live.js', 'venue-visit-form', "profilePreviewCard(member, { variant: 'compact' })", 'Village naturiste du Cap d’Agde')
  },
  {
    name: 'Aperçus profils cohérents',
    valid: has('apps/beta/static/assets/members-live.js', 'profilePreviewCard', "variant: 'grid'", "variant: 'horizontal'", "variant: 'notification'", "variant: 'compact'")
      && has('apps/beta/static/assets/members-live.js', 'profileAges(profile)', 'location_zone', 'profilePreviewIdentity')
      && has('apps/beta/static/assets/members-live.css', 'profile-preview-card', 'profile-preview-media', 'profile-preview-details')
  },
  {
    name: 'Suivi, sécurité et cycle du compte',
    valid: has('functions/api/members/social-actions.js', "body.action === 'report'", '/rest/v1/blocks')
      && has('functions/api/members/account-actions.js', 'request_profile_lifecycle_action', 'confirm_profile_lifecycle_action', '30 jours')
      && has('apps/beta/static/assets/members-live.js', 'Suivre ce membre', 'vient de se connecter', 'data-lifecycle-action')
  }
];

const failures = journeys.filter((journey) => !journey.valid);
if (failures.length) {
  throw new Error(`Recette contractuelle incomplète : ${failures.map((journey) => journey.name).join(', ')}`);
}

console.log(`Zwit user journey checks passed: ${journeys.length} parcours bout en bout couverts`);
