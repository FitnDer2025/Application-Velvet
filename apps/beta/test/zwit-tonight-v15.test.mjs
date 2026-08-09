import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, 'utf8');

test('Tonight stocke un statut temporaire et plafonne sa durée à douze heures', async () => {
  const migration = await read('supabase/migrations/20260807154500_zwit_v15_tonight.sql');
  assert.match(migration, /member_tonight_statuses/);
  assert.match(migration, /expires_at <= starts_at \+ interval '12 hours'/);
  assert.match(migration, /expires_at > now\(\)/);
});

test('Tonight ne stocke aucune coordonnée GPS précise', async () => {
  const [migration, api] = await Promise.all([
    read('supabase/migrations/20260807154500_zwit_v15_tonight.sql'),
    read('functions/api/members/tonight.js')
  ]);
  assert.doesNotMatch(migration, /\blatitude\b/i);
  assert.doesNotMatch(migration, /\blongitude\b/i);
  assert.doesNotMatch(api, /\blatitude\b/i);
  assert.doesNotMatch(api, /\blongitude\b/i);
  assert.match(api, /ne publie jamais la position GPS exacte/);
});

test('Tonight est réservé aux profils admis et les écritures restent liées au profil actif', async () => {
  const api = await read('functions/api/members/tonight.js');
  const migration = await read('supabase/migrations/20260807154500_zwit_v15_tonight.sql');
  assert.match(api, /requireAdmittedMember/);
  assert.match(api, /profile_id: access\.profileId/);
  assert.match(migration, /profile_members pm/);
  assert.match(migration, /pm\.status = 'active'/);
});

test('l’interface Tonight expose le retrait immédiat et les prochaines sorties', async () => {
  const [html, runtime] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-tonight.js')
  ]);
  assert.match(html, /data-zwit-route="tonight"/);
  assert.match(runtime, /data-tonight-end/);
  assert.match(runtime, /method: 'DELETE'/);
  assert.match(runtime, /Sorties dans les prochaines heures/);
  assert.match(runtime, /\/api\/members\/tonight/);
});

test('les runtimes Tonight passent le parseur JavaScript de Node', async () => {
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/tonight.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-tonight.js']);
});
