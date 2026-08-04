import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = await readFile('apps/beta/static/assets/velvet-studio-v2.js', 'utf8');
const styles = await readFile('apps/beta/static/assets/velvet-studio-v2.css', 'utf8');
const api = await readFile('functions/api/control/studio-v2.js', 'utf8');
const migration = await readFile('infra/supabase/migrations/0041_velvet_studio_v2.sql', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');

test('Velvet Studio V2 renders a real audiovisual stream', () => {
  assert.match(renderer, /canvas\.captureStream\(FPS\)/);
  assert.match(renderer, /new MediaRecorder/);
  assert.match(renderer, /createMediaStreamDestination/);
  assert.match(renderer, /drawFrame\(canvas, project, seconds\)/);
  assert.match(renderer, /speechSynthesis/);
  assert.match(renderer, /AudioContext/);
  assert.match(renderer, /video\/webm/);
});

test('Velvet Studio V2 remains provider agnostic and cost controlled', () => {
  assert.match(api, /VELVET_STUDIO_MEDIA_GATEWAY/);
  assert.match(api, /VELVET_STUDIO_GENERATIVE_MEDIA/);
  assert.match(api, /local_fallback/);
  assert.match(api, /studio_access_required/);
  assert.doesNotMatch(api, /api\.openai\.com|elevenlabs|runwayml/);
});

test('V2 render manifests enforce duration, formats and brand guard', () => {
  assert.match(api, /const MAX_DURATION = 90/);
  assert.match(api, /'9:16', '1:1', '16:9'/);
  assert.match(api, /adult_only/);
  assert.match(api, /no_real_member_data/);
  assert.match(api, /integrity = await sha256/);
});

test('V2 persistence is protected by RLS and audited', () => {
  for (const table of ['studio_projects', 'studio_project_versions', 'studio_assets', 'studio_render_jobs']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /public\.has_role\('admin'\) or public\.has_role\('direction'\)/);
  assert.match(migration, /studio_project_saved/);
  assert.match(migration, /studio_render_requested/);
  assert.match(migration, /duration_seconds between 0 and 90/);
});

test('Control charge le Studio léger après le socle et conserve la récupération du scroll', () => {
  const sprint1 = build.indexOf('velvet-studio-sprint1.js');
  const lite = build.indexOf('velvet-studio-lite.js');
  const recovery = build.indexOf('velvet-control-scroll-recovery.js');
  assert.ok(sprint1 >= 0 && lite > sprint1 && recovery > lite);
  assert.doesNotMatch(build, /velvet-studio-v2\.js/);
  assert.doesNotMatch(build, /velvet-studio-v2\.css/);
  assert.match(styles, /body\.vs2-open/);
  assert.match(styles, /@media\(max-width:600px\)/);
});
