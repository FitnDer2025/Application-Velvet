import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, 'utf8');

test('le Passeport Zwit reste accessible avant vérification et ne retourne aucune donnée d’identité sensible', async () => {
  const source = await read('functions/api/members/passport.js');
  assert.match(source, /allowUnverified:\s*true/);
  assert.match(source, /memberVerificationState/);
  assert.match(source, /publicBadges/);
  assert.match(source, /jamais les données d’identité/);
  assert.doesNotMatch(source, /provider_reference_hash/);
  assert.doesNotMatch(source, /document_number/);
  assert.doesNotMatch(source, /document_image/);
});

test('la présence réelle exige un check-in sur un événement rattaché à un établissement', async () => {
  const source = await read('functions/api/members/passport.js');
  assert.match(source, /status=eq\.checked_in/);
  assert.match(source, /establishment_id/);
  assert.match(source, /venueEventIds/);
  assert.doesNotMatch(source, /relation_type=eq\.visited/);
});

test('la liaison couple repose sur les membres actifs du profil et non sur une déclaration libre', async () => {
  const source = await read('functions/api/members/passport.js');
  assert.match(source, /profile_members\?select=user_id,status,created_at/);
  assert.match(source, /status=eq\.active/);
  assert.match(source, /profileType === 'couple'/);
  assert.match(source, /members\.length >= 2/);
});

test('le Passeport premium est chargé uniquement dans l’espace membres et lance le parcours de vérification officiel', async () => {
  const [html, runtime, styles] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-passport.js'),
    read('apps/beta/static/assets/zwit-passport.css')
  ]);
  assert.match(html, /zwit-passport\.css/);
  assert.match(html, /zwit-passport\.js/);
  assert.match(runtime, /location\.pathname\.startsWith\('\/membres'\)/);
  assert.match(runtime, /\/api\/members\/passport/);
  assert.match(runtime, /\/api\/members\/verification/);
  assert.match(runtime, /returnPath:\s*'\/membres\/'/);
  assert.match(styles, /backdrop-filter/);
  assert.match(styles, /@media\(max-width:620px\)/);
});

test('les nouveaux runtimes v1.5 passent le parseur JavaScript de Node', async () => {
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/passport.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-passport.js']);
});
