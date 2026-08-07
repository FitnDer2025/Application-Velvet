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

test('le runtime API de réservation passe le parseur JavaScript de Node', async () => {
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/event-registrations.js']);
});
