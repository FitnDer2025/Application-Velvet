import { readFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'functions/api/members/profile.js',
  'functions/api/members/couple-profile.js',
  'functions/api/members/couple-invite.js',
  'functions/api/members/photos.js',
  'functions/api/members/album-media.js',
  'functions/api/members/albums.js',
  'functions/api/members/messages.js',
  'functions/api/members/plans.js',
  'functions/api/members/account-actions.js',
  'functions/api/members/conversations.js',
  'functions/api/members/social-actions.js',
  'functions/api/members/event-registrations.js',
  'functions/api/members/organizer-request.js',
  'functions/api/members/settings.js',
  'functions/api/members/engagement.js',
  'functions/api/members/photo-reactions.js',
  'functions/api/members/notifications.js',
  'functions/api/members/discovery.js',
  'functions/api/members/map.js',
  'functions/api/members/venue-relationships.js',
  'functions/api/members/directory.js',
  'functions/api/pro/workspace.js',
  'functions/api/control/workspace.js',
  'functions/api/billing/_shared.js',
  'functions/api/billing/catalog.js',
  'functions/api/billing/checkout.js',
  'functions/api/billing/promotion.js',
  'functions/api/admin/invites.js',
  'apps/beta/static/assets/members-live.js',
  'apps/beta/static/assets/pro-live.js',
  'apps/beta/static/assets/control-live.js',
  'apps/web/velvet-control-intelligence-beta-final.html'
].map(async (path) => [path, await readFile(path, 'utf8')])));

const includes = (path, ...tokens) => tokens.every((token) => files[path].includes(token));
const requirements = [
  [includes('functions/api/members/profile.js', 'profile_persistence_failed', 'await myProfile'), 'Le profil doit être relu après sauvegarde'],
  [includes('functions/api/members/couple-profile.js', 'couple_profile_persistence_failed', 'persisted?.[0]?.id'), 'La fiche couple doit être relue après création'],
  [includes('functions/api/members/couple-invite.js', 'couple_invitation_persistence_failed', 'partner_invitation_id'), 'L’invitation partenaire doit être confirmée par Supabase'],
  [includes('functions/api/members/photos.js', 'photo_persistence_failed', '/storage/v1/object/velvet-media/', "method: 'DELETE'"), 'Une photo de profil échouée doit être vérifiée et nettoyée'],
  [includes('functions/api/members/album-media.js', 'photo_persistence_failed', '/storage/v1/object/velvet-media/', "method: 'DELETE'"), 'Une photo d’album échouée doit être vérifiée et nettoyée'],
  [includes('functions/api/members/albums.js', 'album_persistence_failed'), 'La création d’un album doit être confirmée par Supabase'],
  [includes('functions/api/members/messages.js', 'message_persistence_failed'), 'Un message doit être confirmé avant affichage'],
  [includes('functions/api/members/messages.js', 'message_attachments', '/storage/v1/object/velvet-media/', 'message_attachment_persistence_failed'), 'Les pièces jointes doivent être stockées, reliées au message et relues'],
  [includes('functions/api/members/plans.js', 'profile_venue_visits', 'profile_travel_plans', 'await planState'), 'Les sorties et séjours doivent être sauvegardés puis relus'],
  [includes('functions/api/members/account-actions.js', 'request_profile_lifecycle_action', 'confirm_profile_lifecycle_action', 'RESEND_API_KEY'), 'Les actions sensibles doivent utiliser les confirmations persistantes et l’e-mail'],
  [includes('functions/api/members/conversations.js', 'conversation_persistence_failed', 'start_direct_profile_conversation'), 'Une conversation directe doit être confirmée par Supabase'],
  [includes('functions/api/members/social-actions.js', '/rest/v1/favorites', '/rest/v1/blocks', '/rest/v1/reports'), 'Favoris, blocages et signalements doivent utiliser Supabase'],
  [includes('functions/api/members/event-registrations.js', 'zwit_v15_register_for_event', 'zwit_v15_cancel_event_registration'), 'Les inscriptions aux sorties doivent utiliser le moteur transactionnel Supabase v1.5'],
  [includes('functions/api/pro/workspace.js', 'zwit_v15_manage_event_registration', 'event_capacity_reached'), 'Les décisions Pro sur la guest-list doivent conserver le verrou anti-surbooking v1.5'],
  [includes('functions/api/members/organizer-request.js', 'organizer_request_persistence_failed'), 'Une demande Organisateur doit être confirmée'],
  [includes('functions/api/members/settings.js', 'await readSettings'), 'Les paramètres doivent être relus après écriture'],
  [includes('functions/api/members/engagement.js', 'engagementState'), 'La mémoire de consultation doit être relue après écriture'],
  [includes('functions/api/members/photo-reactions.js', 'result?.[0]', 'set_photo_reaction'), 'Une réaction photo doit retourner son agrégat persistant'],
  [includes('functions/api/members/notifications.js', '/rest/v1/member_notifications', 'read_all', 'notificationFeed'), 'Les notifications doivent être lues et acquittées dans Supabase'],
  [includes('functions/api/members/discovery.js', 'member_presence_snapshot', 'member_saved_searches', 'user_id=eq.', 'resolution=merge-duplicates'), 'La présence approximative et les recherches nommées doivent être relues depuis Supabase'],
  [includes('functions/api/members/map.js', 'location_zone', 'exactMemberCoordinatesExposed: false', 'venue_directory', 'geocodeVenueAddress', 'address_public=not.is.null'), 'Maps doit utiliser les zones publiques des membres et les adresses publiques des lieux'],
  [includes('functions/api/members/map.js', 'eventMarkers', 'location_public', 'public_address_geocoding'), 'Les événements doivent être positionnés depuis leur adresse publique'],
  [includes('functions/api/members/venue-relationships.js', 'set_my_venue_relationship', 'relationships: await relationships'), 'Favoris, visites et projets de sortie doivent être sauvegardés puis relus'],
  [includes('functions/api/members/directory.js', 'member_venue_catalog', 'venueRelationships', 'subscription_status'), 'L’annuaire doit charger le catalogue riche et son état Pro réel'],
  [!files['functions/api/members/directory.js'].includes("'city',"), 'L’annuaire membre ne doit pas exposer la commune privée'],
  [includes('functions/api/pro/workspace.js', 'save_venue_draft', 'publish_venue', 'create_event', 'registration_status', 'pro_subscription_required'), 'Zwit Pro doit enregistrer ses actions métier et bloquer les comptes non abonnés'],
  [includes('functions/api/control/workspace.js', 'create_establishment', 'decide_organizer', 'venue_visibility', 'control_beta_release_checks', 'claim_directory_venue', 'subscription_status'), 'Zwit Control doit piloter sa recette, l’attribution du catalogue et les abonnements Pro'],
  [includes('functions/api/control/workspace.js', 'create_promotion', 'member_access', 'account_state', 'grant_campaign'), 'Zwit Control doit piloter les accès commerciaux et campagnes'],
  [includes('functions/api/billing/_shared.js', 'signature_monthly_eur', 'pro_annual_eur', 'configured: false'), 'Le catalogue de paiement doit rester utilisable sans prétendre qu’un prestataire est actif'],
  [includes('functions/api/billing/checkout.js', 'billing_provider_not_configured', 'priceCode'), 'Le raccordement paiement doit refuser honnêtement un prestataire absent'],
  [includes('functions/api/billing/promotion.js', 'redeem_my_promotion', 'SHA-256'), 'Les codes promotionnels doivent être hachés avant interrogation de Supabase'],
  [includes('functions/api/admin/invites.js', 'invite_persistence_failed', 'registrationUrl'), 'Une invitation doit être confirmée et fournir son lien'],
  [includes('apps/beta/static/assets/members-live.js', '/api/members/photo-reactions', 'photo_reaction_persistence_failed'), 'L’interface membre doit refuser une réaction non confirmée'],
  [includes('apps/beta/static/assets/members-live.js', '/api/members/notifications', '/api/members/map', '/api/members/discovery', '/api/members/venue-relationships', 'data-open-venue'), 'L’interface doit exploiter notifications, Maps, découverte, catalogue et préférences établissements'],
  [includes('apps/beta/static/assets/members-live.js', 'Zwit Découverte', 'Zwit Signature', '/api/billing/promotion', '/api/billing/checkout'), 'L’espace membre doit afficher les offres et exploiter le raccordement commercial'],
  [includes('apps/beta/static/assets/pro-live.js', '/api/pro/workspace', 'S.threads = []', "localStorage.removeItem('velvetProCrmV1')", 'Cette vue ne contient plus aucune donnée de démonstration', "'trial', 'active'"), 'Zwit Pro doit neutraliser les données fictives et respecter l’abonnement serveur'],
  [includes('apps/beta/static/assets/control-live.js', '/api/control/workspace', 'Pilotage', 'data-organizer-decision', 'data-subscription-status', 'controlClaimVenueForm', 'data-management-section', 'setView'), 'Zwit Control doit réunir le pilotage réel, le catalogue Pro et les invitations'],
  [includes('apps/beta/static/assets/control-live.js', '/api/admin/invites', 'Générer le code sécurisé'), 'Zwit Control doit utiliser l’API réelle des invitations']
];

for (const [valid, message] of requirements) {
  if (!valid) throw new Error(message);
}

console.log(`Zwit persistence checks passed: ${requirements.length} parcours contrôlés`);