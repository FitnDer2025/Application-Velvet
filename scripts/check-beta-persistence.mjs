import { readFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'functions/api/members/profile.js',
  'functions/api/members/photos.js',
  'functions/api/members/album-media.js',
  'functions/api/members/albums.js',
  'functions/api/members/messages.js',
  'functions/api/members/conversations.js',
  'functions/api/members/social-actions.js',
  'functions/api/members/event-registrations.js',
  'functions/api/members/organizer-request.js',
  'functions/api/members/settings.js',
  'functions/api/members/engagement.js',
  'functions/api/members/photo-reactions.js',
  'functions/api/members/notifications.js',
  'functions/api/members/map.js',
  'functions/api/members/directory.js',
  'functions/api/admin/invites.js',
  'apps/beta/static/assets/members-live.js',
  'apps/web/velvet-control-intelligence-beta-final.html'
].map(async (path) => [path, await readFile(path, 'utf8')])));

const includes = (path, ...tokens) => tokens.every((token) => files[path].includes(token));
const requirements = [
  [includes('functions/api/members/profile.js', 'profile_persistence_failed', 'await myProfile'), 'Le profil doit être relu après sauvegarde'],
  [includes('functions/api/members/photos.js', 'photo_persistence_failed', '/storage/v1/object/velvet-media/', "method: 'DELETE'"), 'Une photo de profil échouée doit être vérifiée et nettoyée'],
  [includes('functions/api/members/album-media.js', 'photo_persistence_failed', '/storage/v1/object/velvet-media/', "method: 'DELETE'"), 'Une photo d’album échouée doit être vérifiée et nettoyée'],
  [includes('functions/api/members/albums.js', 'album_persistence_failed'), 'La création d’un album doit être confirmée par Supabase'],
  [includes('functions/api/members/messages.js', 'message_persistence_failed'), 'Un message doit être confirmé avant affichage'],
  [includes('functions/api/members/conversations.js', 'conversation_persistence_failed', 'start_direct_profile_conversation'), 'Une conversation directe doit être confirmée par Supabase'],
  [includes('functions/api/members/social-actions.js', '/rest/v1/favorites', '/rest/v1/blocks', '/rest/v1/reports'), 'Favoris, blocages et signalements doivent utiliser Supabase'],
  [includes('functions/api/members/event-registrations.js', 'register_for_event', 'cancel_my_event_registration'), 'Les inscriptions aux sorties doivent utiliser les fonctions transactionnelles Supabase'],
  [includes('functions/api/members/organizer-request.js', 'organizer_request_persistence_failed'), 'Une demande Organisateur doit être confirmée'],
  [includes('functions/api/members/settings.js', 'await readSettings'), 'Les paramètres doivent être relus après écriture'],
  [includes('functions/api/members/engagement.js', 'engagementState'), 'La mémoire de consultation doit être relue après écriture'],
  [includes('functions/api/members/photo-reactions.js', 'result?.[0]', 'set_photo_reaction'), 'Une réaction photo doit retourner son agrégat persistant'],
  [includes('functions/api/members/notifications.js', '/rest/v1/member_notifications', 'read_all', 'notificationFeed'), 'Les notifications doivent être lues et acquittées dans Supabase'],
  [includes('functions/api/members/map.js', 'location_zone', 'exactMemberCoordinatesExposed: false', 'venue_directory'), 'Maps doit utiliser les zones publiques et les coordonnées publiques des lieux'],
  [!files['functions/api/members/directory.js'].includes("'city',"), 'L’annuaire membre ne doit pas exposer la commune privée'],
  [includes('functions/api/admin/invites.js', 'invite_persistence_failed', 'registrationUrl'), 'Une invitation doit être confirmée et fournir son lien'],
  [includes('apps/beta/static/assets/members-live.js', '/api/members/photo-reactions', 'photo_reaction_persistence_failed'), 'L’interface membre doit refuser une réaction non confirmée'],
  [includes('apps/beta/static/assets/members-live.js', '/api/members/notifications', '/api/members/map', 'data-open-venue'), 'L’interface doit exploiter notifications, Maps et mini-sites établissements'],
  [includes('apps/web/velvet-control-intelligence-beta-final.html', '/api/admin/invites', 'Générer le code sécurisé'), 'Velvet Control doit utiliser l’API réelle des invitations']
];

for (const [valid, message] of requirements) {
  if (!valid) throw new Error(message);
}

console.log(`Velvet persistence checks passed: ${requirements.length} parcours contrôlés`);
