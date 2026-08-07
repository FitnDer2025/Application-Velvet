import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const read = (path) => readFile(path, 'utf8');

test('la mémoire de recommandation reste explicite minimale et privée', async () => {
  const sql = await read('supabase/migrations/20260807194500_zwit_v15_recommendation_feedback.sql');
  assert.match(sql, /more_like_this/);
  assert.match(sql, /dismiss/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /set_my_recommendation_feedback/);
  assert.doesNotMatch(sql, /sexual_orientation|political|religion|ethnicity|psychological/);
});

test('l’API de feedback ne permet que les trois familles de recommandations v1.5', async () => {
  const api = await read('functions/api/members/recommendation-feedback.js');
  assert.match(api, /\['profile', 'event', 'venue'\]/);
  assert.match(api, /\['more_like_this', 'dismiss'\]/);
  assert.match(api, /requireAdmittedMember/);
  assert.match(api, /set_my_recommendation_feedback/);
});

test('le moteur combine personnes Tonight sorties et lieux sans score magique affiché', async () => {
  const runtime = await read('apps/beta/static/assets/zwit-contextual-recommendations.js');
  assert.match(runtime, /\/api\/members\/home-intelligence/);
  assert.match(runtime, /\/api\/members\/tonight/);
  assert.match(runtime, /\/api\/members\/events/);
  assert.match(runtime, /\/api\/members\/directory/);
  assert.match(runtime, /Pourquoi maintenant \?/);
  assert.match(runtime, /Pas de pourcentage magique/);
  assert.doesNotMatch(runtime, />\s*\$\{[^}]*score[^}]*\}%/);
});

test('les suggestions masquées sont réellement retirées et les positives renforcent la sélection', async () => {
  const runtime = await read('apps/beta/static/assets/zwit-contextual-recommendations.js');
  assert.match(runtime, /!== 'dismiss'/);
  assert.match(runtime, /=== 'more_like_this'/);
  assert.match(runtime, /scored\.score \+= 14/);
});

test('l’accueil charge le panneau premium de recommandations contextuelles', async () => {
  const [html, css] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-contextual-recommendations.css')
  ]);
  assert.match(html, /zwit-contextual-recommendations\.css/);
  assert.match(html, /zwit-contextual-recommendations\.js/);
  assert.match(css, /zcr-panel/);
  assert.match(css, /zcr-grid/);
});

test('les runtimes recommandations v1.5 passent le parseur JavaScript de Node', async () => {
  await execFileAsync(process.execPath, ['--check', 'functions/api/members/recommendation-feedback.js']);
  await execFileAsync(process.execPath, ['--check', 'apps/beta/static/assets/zwit-contextual-recommendations.js']);
});
