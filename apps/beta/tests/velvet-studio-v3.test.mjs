import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const ui = await readFile('apps/beta/static/assets/velvet-studio-v3.js', 'utf8');
const css = await readFile('apps/beta/static/assets/velvet-studio-v3.css', 'utf8');
const api = await readFile('functions/api/control/studio-v3.js', 'utf8');
const sql = await readFile('infra/supabase/migrations/0042_velvet_studio_v3_campaign_engine.sql', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');

assert.ok(ui.includes('data-open-v3'), 'Le bouton Campagne V3 doit être installé');
assert.ok(ui.includes('5 vidéos') && ui.includes('12 visuels') && ui.includes('10 publications'), 'Le pack V3 doit exposer ses livrables');
assert.ok(ui.includes('makeVideoProject') && ui.includes('Réalisation V2'), 'Une variante V3 doit pouvoir devenir un projet V2');
assert.ok(ui.includes('exportCalendarCsv') && ui.includes('exportPack'), 'Les exports campagne doivent être disponibles');
assert.ok(ui.includes('Aucun contenu n’est publié sans validation humaine'), 'La publication automatique doit rester interdite');
assert.ok(css.includes('.vs3-desk') && css.includes('body.vs3-open'), 'La V3 doit rester isolée dans son espace plein écran');
assert.ok(api.includes('VELVET_STUDIO_CAMPAIGN_AI') && api.includes('velvet-local-campaign-engine-v3'), 'Le fournisseur externe doit rester opt-in avec repli gratuit');
assert.ok(api.includes('automaticPublication: false') && api.includes('human_validation_required'), 'L’API doit imposer la validation humaine');
assert.ok(sql.includes('studio_campaign_packs') && sql.includes('studio_campaign_items') && sql.includes('studio_campaign_exports'), 'La persistance V3 doit être complète');
assert.ok(sql.includes('enable row level security') && sql.includes('studio_campaign_pack_saved'), 'RLS et audit V3 sont obligatoires');
assert.ok(build.indexOf('velvet-studio-v2.js') < build.indexOf('velvet-studio-v3.js'), 'La V3 doit être chargée après la V2');
assert.ok(build.indexOf('velvet-studio-v3.js') < build.indexOf('velvet-control-scroll-recovery.js'), 'Le garde-fou de scroll doit rester chargé en dernier');

console.log('Velvet Studio V3: 12 contrôles validés.');