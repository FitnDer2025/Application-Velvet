import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, 'utf8');

test('les quatre tables d’espaces privés sont fermées en accès direct', async () => {
  const sql = await read('supabase/migrations/20260807203000_zwit_v15_private_spaces.sql');
  for (const table of ['community_spaces','community_space_members','community_space_messages','community_space_reports']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon,authenticated`));
  }
});

test('un chat de soirée exige une inscription confirmée et a une fenêtre de vie bornée', async () => {
  const sql = await read('supabase/migrations/20260807203000_zwit_v15_private_spaces.sql');
  assert.match(sql, /status in \('confirmed','checked_in'\)/);
  assert.match(sql, /confirmed_registration_required/);
  assert.match(sql, /interval '48 hours'/);
  assert.match(sql, /event_chat_not_open_yet/);
  assert.match(sql, /event_chat_closed/);
});

test('un cercle est privé et l’invitation part d’un profil actif, pas d’un identifiant saisi', async () => {
  const sql = await read('supabase/migrations/20260807203000_zwit_v15_private_spaces.sql');
  assert.match(sql, /zwit_v15_create_circle/);
  assert.match(sql, /zwit_v15_invite_circle_profile/);
  assert.match(sql, /profile_members pm/);
  assert.match(sql, /pm\.profile_id=target_profile_id/);
  assert.match(sql, /pm\.status='active'/);
});

test('les lectures de groupe sont assainies et ne renvoient jamais les user_id des autres membres', async () => {
  const [sql, api] = await Promise.all([
    read('supabase/migrations/20260807204500_zwit_v15_private_space_views.sql'),
    read('functions/api/members/spaces.js')
  ]);
  assert.match(sql, /zwit_v15_my_spaces/);
  assert.match(sql, /zwit_v15_space_messages/);
  assert.match(sql, /sender_profile_id uuid/);
  assert.match(sql, /sender_display_name text/);
  assert.match(api, /zwit_v15_space_messages/);
  assert.doesNotMatch(api, /sender_user_id|user_id:/);
});

test('seuls les membres actifs écrivent et tout message peut être signalé', async () => {
  const sql = await read('supabase/migrations/20260807203000_zwit_v15_private_spaces.sql');
  assert.match(sql, /space_membership_required/);
  assert.match(sql, /zwit_v15_send_space_message/);
  assert.match(sql, /zwit_v15_report_space_message/);
  assert.match(sql, /community_space_reports/);
});

test('Web expose création invitations chat de soirée et signalement sans créer un sixième onglet principal', async () => {
  const [html, runtime, css] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-private-spaces.js'),
    read('apps/beta/static/assets/zwit-private-spaces.css')
  ]);
  assert.match(html, /zwit-private-spaces\.css/);
  assert.match(html, /zwit-private-spaces\.js/);
  assert.match(runtime, /Cercles & chats/);
  assert.match(runtime, /Nouveau cercle/);
  assert.match(runtime, /Chat de la soirée/);
  assert.match(runtime, /Inviter dans un cercle/);
  assert.match(runtime, /Signalement transmis à Zwit Contrôle/);
  assert.match(css, /zps-layer/);
  assert.doesNotMatch(html, /data-route="spaces"/);
});

test('le runtime des espaces privés passe le parseur JavaScript de Node', async () => {
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/spaces.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-private-spaces.js']);
});
