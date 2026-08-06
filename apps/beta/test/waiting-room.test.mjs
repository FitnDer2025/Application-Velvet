import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Script } from 'node:vm';

const publicPage = await readFile('apps/beta/static/acces-prive/index.html', 'utf8');
const publicScript = await readFile('apps/beta/static/assets/velvet-waitlist.js', 'utf8');
const controlPage = await readFile('apps/beta/static/control/acces-prive/index.html', 'utf8');
const controlScript = await readFile('apps/beta/static/assets/velvet-waitlist-control.js', 'utf8');
const marketingPage = await readFile('apps/beta/static/marketing/acces-prive/index.html', 'utf8');
const marketingScript = await readFile('apps/beta/static/assets/velvet-waitlist-marketing.js', 'utf8');
const publicApi = await readFile('functions/api/waitlist.js', 'utf8');
const controlApi = await readFile('functions/api/control/waitlist.js', 'utf8');
const worker = await readFile('apps/beta/worker/index.js', 'utf8');
const migration = await readFile('infra/supabase/migrations/0040_velvet_waiting_room.sql', 'utf8');
const accountMenu = await readFile('apps/beta/static/assets/account-access-menu.js', 'utf8');

function contract(name, run) {
  test(name, () => {
    try {
      run();
    } catch (error) {
      const message = String(error?.stack || error?.message || error).replaceAll('\r', '').replaceAll('\n', '%0A');
      console.error(`::error title=Zwit waiting room · ${name}::${message}`);
      throw error;
    }
  });
}

contract('waiting room JavaScript modules are syntactically valid', () => {
  for (const source of [publicScript, controlScript, marketingScript]) {
    assert.doesNotThrow(() => new Script(source));
  }
  for (const file of [
    'functions/api/waitlist.js',
    'functions/api/control/waitlist.js',
    'apps/beta/worker/index.js'
  ]) {
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr || `${file} is invalid`);
  }
});

contract('public pre-registration separates members and professionals with explicit consent', () => {
  assert.match(publicPage, /data-audience="member"/);
  assert.match(publicPage, /data-audience="pro"/);
  assert.match(publicPage, /name="adultAttestation"[^>]*required/);
  assert.match(publicPage, /name="launchConsent"[^>]*required/);
  assert.doesNotMatch(publicPage, /name="(?:sexual|practice|orientation|photo|identityDocument|exactLocation)/i);
  assert.doesNotMatch(publicPage, /name="(?:adultAttestation|launchConsent)"[^>]*checked/i);
  assert.match(publicScript, /\/api\/waitlist/);
  assert.match(publicScript, /utm_source/);
  assert.match(publicScript, /turnstile/);
});

contract('public API minimizes and validates the request', () => {
  assert.match(publicApi, /adult_attestation_required/);
  assert.match(publicApi, /launch_consent_required/);
  assert.match(publicApi, /verifyTurnstile/);
  assert.match(publicApi, /register_velvet_waitlist/);
  assert.doesNotMatch(publicApi, /console\.(?:log|info|error).*email/i);
});

contract('Control cockpit exposes metrics, filters, CSV and role-bound updates', () => {
  assert.match(controlPage, /salle d’attente Velvet/i);
  assert.match(controlPage, /Professionnels/);
  assert.match(controlPage, /Exporter CSV/);
  assert.match(controlScript, /topTerritories/);
  assert.match(controlScript, /topSources/);
  assert.match(controlScript, /method: 'PATCH'/);
  assert.match(controlApi, /READ_ROLES/);
  assert.match(controlApi, /WRITE_ROLES/);
  assert.match(accountMenu, /Salle d’attente · Préinscriptions/);
  assert.match(accountMenu, /data-control-waitlist-entry/);
});

contract('Marketing kit contains traceable member and professional campaigns', () => {
  assert.match(marketingPage, /PUBLICATION PRINCIPALE/);
  assert.match(marketingPage, /APPEL À TESTEURS/);
  assert.match(marketingPage, /VELVET PRO/);
  assert.match(marketingPage, /RELANCE/);
  assert.match(marketingPage, /STORY · 3 ÉCRANS/);
  assert.match(marketingScript, /utm_source/);
  assert.match(marketingScript, /replaceAll\('\{\{LIEN\}\}'/);
});

contract('worker routes are public for registration and protected for internal dashboards', () => {
  assert.match(worker, /POST \/api\/waitlist/);
  assert.match(worker, /GET \/api\/control\/waitlist/);
  assert.match(worker, /PATCH \/api\/control\/waitlist/);
  assert.match(worker, /PROTECTED_PREFIXES = \[[^\]]*'\/marketing'[^\]]*'\/control'/s);
  assert.doesNotMatch(worker, /PROTECTED_PREFIXES = \[[^\]]*'\/acces-prive'/s);
});

contract('database keeps direct access closed and uses explicit RPC permissions', () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.velvet_waitlist_entries from anon, authenticated/);
  assert.match(migration, /grant execute on function public\.register_velvet_waitlist[\s\S]*to anon, authenticated/);
  assert.match(migration, /role_code in \('admin', 'direction'/);
  assert.doesNotMatch(migration, /sexual_preferences|intimate_practices|sexual_orientation|profile_photo|identity_document|exact_geolocation/i);
});
