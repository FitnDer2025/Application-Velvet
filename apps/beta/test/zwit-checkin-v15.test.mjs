import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, 'utf8');

function tableDefinition(sql, tableName) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(new RegExp(`create table if not exists public\\.${escaped} \\(([\\s\\S]*?)\\n\\);`, 'i'));
  assert.ok(match, `table ${tableName} should exist`);
  return match[1];
}

test('le QR tournant ne persiste jamais son secret brut et expire rapidement', async () => {
  const sql = await read('supabase/migrations/20260807170000_zwit_v15_rotating_checkin.sql');
  const persistedColumns = tableDefinition(sql, 'event_checkin_sessions');
  assert.match(persistedColumns, /token_hash text not null unique/);
  assert.doesNotMatch(persistedColumns, /(^|\n)\s*token\s+text\b/i);
  assert.match(sql, /digest\(v_token, 'sha256'\)/);
  assert.match(sql, /greatest\(60, least\(coalesce\(ttl_seconds, 120\), 300\)\)/);
  assert.match(sql, /set revoked_at = now\(\)/);
  // Le RPC est autorisé à retourner une fois le secret éphémère au professionnel ;
  // l'invariant de sécurité est qu'il n'existe jamais comme colonne persistée.
  assert.match(sql, /v_token := encode\(extensions\.gen_random_bytes\(24\), 'hex'\)/);
});

test('un scan exige une réservation confirmée et devient un check-in réel', async () => {
  const sql = await read('supabase/migrations/20260807170000_zwit_v15_rotating_checkin.sql');
  assert.match(sql, /status in \('confirmed', 'checked_in'\)/);
  assert.match(sql, /confirmed_registration_required/);
  assert.match(sql, /set status = 'checked_in'/);
  assert.match(sql, /scan_count = scan_count \+ 1/);
});

test('la table de sessions QR reste fermée et seuls les RPC sont exécutables', async () => {
  const sql = await read('supabase/migrations/20260807170000_zwit_v15_rotating_checkin.sql');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.event_checkin_sessions from anon, authenticated/);
  assert.match(sql, /grant execute on function public\.zwit_v15_open_checkin_session/);
  assert.match(sql, /grant execute on function public\.zwit_v15_redeem_checkin_session/);
});

test('Zwit Pro génère un QR compact local sans transmettre le token à un service tiers', async () => {
  const [api, qr, pro] = await Promise.all([
    read('functions/api/pro/check-in.js'),
    read('apps/beta/static/assets/zwit-qr-v4.js'),
    read('apps/beta/static/assets/zwit-pro-guestlist.js')
  ]);
  assert.match(api, /velvet:\/\/checkin\?token=/);
  assert.match(api, /Seule son empreinte cryptographique/);
  assert.match(qr, /window\.ZwitQRV4/);
  assert.match(qr, /DATA_CODEWORDS = 80/);
  assert.match(qr, /ECC_CODEWORDS = 20/);
  assert.match(qr, /data:image\/svg\+xml/);
  assert.doesNotMatch(qr, /\bfetch\s*\(/);
  assert.doesNotMatch(qr, /XMLHttpRequest|quickchart|chart\.googleapis|api\.qrserver/i);
  assert.match(pro, /QR d’entrée/);
  assert.match(pro, /ttlSeconds: 120/);
  assert.match(pro, /Renouvellement sécurisé/);
});

test('le membre conserve le check-in pendant une authentification Web et met le Passeport à jour', async () => {
  const [html, member, passport] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-member-checkin.js'),
    read('apps/beta/static/assets/zwit-passport.js')
  ]);
  assert.match(html, /zwit-member-checkin\.js/);
  assert.match(member, /sessionStorage\.setItem\(STORAGE_KEY, queryToken\)/);
  assert.match(member, /response\.status === 401/);
  assert.match(member, /\/api\/members\/check-in/);
  assert.match(member, /zwit:passport-refresh/);
  assert.match(passport, /addEventListener\('zwit:passport-refresh'/);
});

test('les API de check-in n’exposent pas une validation sans rôle Pro ou admission membre', async () => {
  const [proApi, memberApi] = await Promise.all([
    read('functions/api/pro/check-in.js'),
    read('functions/api/members/check-in.js')
  ]);
  assert.match(proApi, /PRO_ROLES/);
  assert.match(proApi, /pro_access_required/);
  assert.match(memberApi, /requireAdmittedMember/);
  assert.match(memberApi, /passportUpdated: true/);
});

test('la caméra iPhone ouvre le schéma technique historique puis reprend le check-in après connexion', async () => {
  const [model, service, state, root, plist] = await Promise.all([
    read('ios/Velvet/Core/Models/CheckinV15.swift'),
    read('ios/Velvet/Core/Session/SessionService+CheckinV15.swift'),
    read('ios/Velvet/App/AppState.swift'),
    read('ios/Velvet/App/ZwitRootContainer.swift'),
    read('ios/Velvet/Resources/Info.plist')
  ]);
  assert.match(model, /url\.scheme\?\.lowercased\(\) == "velvet"/);
  assert.match(model, /url\.host\?\.lowercased\(\) == "checkin"/);
  assert.match(service, /\/api\/members\/check-in/);
  assert.match(state, /pendingCheckinToken/);
  assert.match(state, /redeemPendingCheckinIfPossible/);
  assert.match(state, /Ton Passeport Zwit vient d’être mis à jour/);
  assert.match(root, /onOpenURL\(perform: appState\.handle\)/);
  assert.match(plist, /<string>velvet<\/string>/);
});

test('les runtimes QR v1.5 passent le parseur JavaScript de Node', async () => {
  await execFileAsync(process.execPath, ['--check', 'functions/api/pro/check-in.js']);
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/check-in.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-qr-v4.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-pro-guestlist.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-member-checkin.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-passport.js']);
});
