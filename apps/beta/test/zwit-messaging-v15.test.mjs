import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, 'utf8');

test('une nouvelle conversation directe crée une demande sans modifier les conversations historiques', async () => {
  const [sql, api] = await Promise.all([
    read('supabase/migrations/20260807173000_zwit_v15_conversation_requests.sql'),
    read('functions/api/members/conversations.js')
  ]);
  assert.match(sql, /Les conversations historiques sans ligne ici restent ouvertes/);
  assert.match(sql, /zwit_v15_ensure_conversation_request/);
  assert.match(api, /start_direct_profile_conversation/);
  assert.match(api, /zwit_v15_ensure_conversation_request/);
});

test('le garde SQL limite à une approche puis une seule relance après 24 heures', async () => {
  const sql = await read('supabase/migrations/20260807173000_zwit_v15_conversation_requests.sql');
  assert.match(sql, /if v_sent = 0 then/);
  assert.match(sql, /if v_sent = 1/);
  assert.match(sql, /interval '24 hours'/);
  assert.match(sql, /follow_up_sent_at is null/);
  assert.match(sql, /raise exception 'conversation_request_waiting'/);
  assert.match(sql, /before insert on public\.messages/);
});

test('une réponse du destinataire accepte naturellement la conversation', async () => {
  const sql = await read('supabase/migrations/20260807173000_zwit_v15_conversation_requests.sql');
  assert.match(sql, /new\.sender_user_id = v_request\.recipient_user_id/);
  assert.match(sql, /set status = 'accepted'/);
});

test('le destinataire est le seul à pouvoir accepter ou décliner explicitement', async () => {
  const [sql, api] = await Promise.all([
    read('supabase/migrations/20260807173000_zwit_v15_conversation_requests.sql'),
    read('functions/api/members/conversation-request.js')
  ]);
  assert.match(sql, /conversation_request_recipient_required/);
  assert.match(sql, /decision not in \('accepted', 'declined'\)/);
  assert.match(api, /decision === 'accept'/);
  assert.match(api, /decision === 'decline'/);
  assert.doesNotMatch(api, /requester_user_id|recipient_user_id/);
});

test('Web affiche le choix du destinataire et verrouille les relances excédentaires', async () => {
  const [html, runtime, css] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-conversation-respect.js'),
    read('apps/beta/static/assets/zwit-conversation-respect.css')
  ]);
  assert.match(html, /zwit-conversation-respect\.css/);
  assert.match(html, /zwit-conversation-respect\.js/);
  assert.match(runtime, /Accepter/);
  assert.match(runtime, /Décliner/);
  assert.match(runtime, /RELANCE UNIQUE/);
  assert.match(runtime, /data-zwit-request-locked/);
  assert.match(runtime, /stopImmediatePropagation/);
  assert.match(css, /zwit-request-banner/);
});

test('les runtimes de demande de conversation passent le parseur JavaScript de Node', async () => {
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/conversations.js']);
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/conversation-request.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-conversation-respect.js']);
});
