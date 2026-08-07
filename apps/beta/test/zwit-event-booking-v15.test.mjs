import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, 'utf8');

test('la réservation v1.5 réutilise la capacité historique sans créer un second contrat', async () => {
  const migration = await read('supabase/migrations/20260807161500_zwit_v15_event_booking.sql');
  assert.match(migration, /v_event\.capacity/);
  assert.match(migration, /registration_open/);
  assert.doesNotMatch(migration, /capacity_places/);
});

test('la capacité est calculée sous verrou et la file ne peut pas surbooker', async () => {
  const migration = await read('supabase/migrations/20260807161500_zwit_v15_event_booking.sql');
  assert.match(migration, /where public\.events\.id = target_event_id\s+for update/);
  assert.match(migration, /status in \('pending', 'confirmed', 'checked_in'\)/);
  assert.match(migration, /v_reserved \+ requested_places > v_event\.capacity/);
  assert.match(migration, /v_next_status := 'waitlisted'/);
  assert.match(migration, /order by r\.created_at asc/);
  assert.match(migration, /Préserve l'ordre de la file/);
});

test('annuler une réservation promeut automatiquement la file dans son ordre', async () => {
  const migration = await read('supabase/migrations/20260807161500_zwit_v15_event_booking.sql');
  assert.match(migration, /zwit_v15_cancel_event_registration/);
  assert.match(migration, /v_promoted := v_promoted \+ 1/);
  assert.match(migration, /promoted_count := v_promoted/);
});

test('la guest-list membre ne renvoie que les profils confirmés volontairement visibles', async () => {
  const api = await read('functions/api/members/event-registrations.js');
  assert.match(api, /row\.visible_to_participants === true/);
  assert.match(api, /\['confirmed', 'checked_in'\]\.includes\(row\.status\)/);
  assert.match(api, /participantProfilesVisible/);
  assert.match(api, /Les identifiants de compte ne sont jamais exposés/);
  assert.doesNotMatch(api, /return withSession\(\{\s*registrations,/);
});

test('les écritures de réservation v1.5 restent réservées aux membres admis', async () => {
  const [migration, api] = await Promise.all([
    read('supabase/migrations/20260807161500_zwit_v15_event_booking.sql'),
    read('functions/api/members/event-registrations.js')
  ]);
  assert.match(api, /requireAdmittedMember/);
  assert.match(migration, /profile_members pm/);
  assert.match(migration, /mp\.admission_status = 'approved'/);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
});

test('la fiche événement charge la réservation premium et distingue confirmation validation et attente', async () => {
  const [html, runtime, css] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-event-booking.js'),
    read('apps/beta/static/assets/zwit-event-booking.css')
  ]);
  assert.match(html, /zwit-event-booking\.css/);
  assert.match(html, /zwit-event-booking\.js/);
  assert.match(runtime, /Confirmation/);
  assert.match(runtime, /Après validation/);
  assert.match(runtime, /Rejoindre la liste d’attente/);
  assert.match(runtime, /data-zwit-booking-guests/);
  assert.match(runtime, /stopImmediatePropagation/);
  assert.match(css, /zwit-booking-meter/);
  assert.match(css, /zwit-booking-people/);
});

test('les décisions Pro passent par une transaction verrouillée et ne peuvent pas surbooker', async () => {
  const [migration, api] = await Promise.all([
    read('supabase/migrations/20260807164000_zwit_v15_event_guestlist_pro.sql'),
    read('functions/api/pro/workspace.js')
  ]);
  assert.match(migration, /zwit_v15_manage_event_registration/);
  assert.match(migration, /for update/);
  assert.match(migration, /event_capacity_reached/);
  assert.match(migration, /establishment_staff/);
  assert.match(migration, /registration_not_confirmed/);
  assert.match(api, /rpc\/zwit_v15_manage_event_registration/);
  assert.doesNotMatch(api, /event_registrations\?id=eq\.\$\{encodeURIComponent\(body\.registrationId\)\}/);
});

test('Zwit Pro expose le cockpit guest-list et les réglages de réservation réels', async () => {
  const [pro, runtime, css, api] = await Promise.all([
    read('apps/beta/static/assets/pro-live.js'),
    read('apps/beta/static/assets/zwit-pro-guestlist.js'),
    read('apps/beta/static/assets/zwit-pro-guestlist.css'),
    read('functions/api/pro/workspace.js')
  ]);
  assert.match(pro, /zwit-pro-guestlist\.js/);
  assert.match(pro, /zwit-pro-guestlist\.css/);
  assert.match(runtime, /Guest-list & accueil/);
  assert.match(runtime, /À valider/);
  assert.match(runtime, /Valider l’arrivée/);
  assert.match(runtime, /update_event_booking/);
  assert.match(css, /zpg-cockpit/);
  assert.match(api, /registration_mode/);
  assert.match(api, /registration_closes_at/);
  assert.match(api, /max_places_per_registration/);
  assert.match(api, /guest_list_enabled/);
});

test('les runtimes de réservation v1.5 passent le parseur JavaScript de Node', async () => {
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/event-registrations.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-event-booking.js']);
  await execFileAsync(process.execPath, ['--check', 'functions/api/pro/workspace.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-pro-guestlist.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/pro-live.js']);
});
