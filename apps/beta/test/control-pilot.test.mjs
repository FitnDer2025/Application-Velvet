import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  decidePrivateMedia,
  decidePublicMedia,
  normalizeMediaModerationPolicy
} from '../../../functions/api/members/photos.js';
import { buildConfiguredVelvetEmail } from '../../../functions/api/members/couple-invitation-email.js';

const read = (path) => readFile(path, 'utf8');

test('la politique IA distingue observation, seuil public et seuil privé', () => {
  const policy = normalizeMediaModerationPolicy({
    automation_mode: 'active',
    public_auto_confidence: 0.86,
    private_auto_confidence: 0.91
  });

  assert.equal(decidePublicMedia({ confidence: 0.85, criteriaPassed: true }, policy), 'review');
  assert.equal(decidePublicMedia({ confidence: 0.90, criteriaPassed: true }, policy), 'approved');
  assert.equal(decidePublicMedia({ confidence: 0.90, criteriaPassed: false }, policy), 'rejected');
  assert.equal(decidePrivateMedia({ confidence: 0.90, prohibited: false, uncertain: false }, policy), 'review');
  assert.equal(decidePrivateMedia({ confidence: 0.95, prohibited: false, uncertain: true }, policy), 'review');
  assert.equal(decidePrivateMedia({ confidence: 0.95, prohibited: true, uncertain: false }, policy), 'rejected');
  assert.equal(decidePrivateMedia({ confidence: 0.95, prohibited: false, uncertain: false }, policy), 'approved');

  const observation = { ...policy, automationMode: 'observation' };
  assert.equal(decidePublicMedia({ confidence: 0.98, criteriaPassed: true }, observation), 'review');
  assert.equal(decidePrivateMedia({ confidence: 0.98, prohibited: false, uncertain: false }, observation), 'review');
});

test('les modèles e-mail utilisent le visuel Zwit sans accepter de HTML libre', () => {
  const rendered = buildConfiguredVelvetEmail({
    template: {
      subject: 'Bonjour {{profile_name}}',
      preheader: 'Votre message Zwit',
      heading: '<script>alert(1)</script>{{profile_name}}',
      body_text: 'Bienvenue {{profile_name}}.\n\nVotre espace est prêt.',
      cta_label: 'Ouvrir Zwit',
      footer_text: 'Vous gardez le contrôle.'
    },
    variables: { profile_name: 'Céline & Cyril' },
    ctaUrl: 'https://velvet.example/confirmation',
    logoUrl: 'https://velvet.example/assets/velvet-icon-192.png'
  });

  assert.equal(rendered.subject, 'Bonjour Céline & Cyril');
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;Céline &amp; Cyril/);
  for (const token of ['#0D0D0D', '#641B36', '#C6A96A', 'velvet-icon-192.png']) {
    assert.match(rendered.html, new RegExp(token, 'i'));
  }
});

test('Zwit Contrôle ouvre un cockpit réel à cinq destinations', async () => {
  const [html, css, script, api] = await Promise.all([
    read('apps/web/velvet-control-intelligence-beta-final.html'),
    read('apps/beta/static/assets/control-pilot.css'),
    read('apps/beta/static/assets/control-live.js'),
    read('functions/api/control/workspace.js')
  ]);
  const destinations = [...html.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(destinations, ['pilot', 'actions', 'intelligence', 'communications', 'management']);
  assert.match(html, /Pilotage/);
  assert.match(script, /humanActions/);
  assert.match(script, /aiHistory/);
  assert.match(script, /update_media_policy/);
  assert.match(script, /update_email_template/);
  assert.match(script, /data-member-search/);
  assert.match(script, /data-member-profile/);
  assert.match(script, /Fiche de contrôle/);
  assert.match(script, /Aucun contenu privé n’est affiché dans cette fiche/);
  assert.match(api, /buildHumanActions/);
  assert.match(api, /buildAiHistory/);
  assert.match(css, /body\.velvet-control-ui\{[^}]*margin:0[^}]*overflow:hidden/);
  assert.match(css, /\.control-top\{[^}]*display:flex[^}]*align-items:center[^}]*overflow:hidden/);
  assert.match(css, /\.control-mobile-nav\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(html, /localStorage|99,\d+%|Gateway IA|24\/24/);
  assert.doesNotMatch(script, /localStorage|Gateway IA|24\/24/);
});

test('le cockpit expose la file humaine et trace les décisions IA sans média intime', async () => {
  const [migration, api] = await Promise.all([
    read('infra/supabase/migrations/0039_control_piloting_cockpit.sql'),
    read('functions/api/control/workspace.js')
  ]);
  assert.match(migration, /actor_type,action,entity_type,metadata[\s\S]*'ai_agent'/);
  assert.match(migration, /control_update_media_moderation_policy/);
  assert.match(migration, /control_update_email_template/);
  assert.match(migration, /alter table public\.control_ai_policies enable row level security/);
  assert.match(migration, /alter table public\.control_email_templates enable row level security/);
  assert.doesNotMatch(migration, /media_url|storage_path|image_bytes|biometric_template/);
  assert.match(api, /humanActions/);
  assert.match(api, /pendingMedia/);
  assert.match(api, /account_identity_age_verifications/);
  assert.match(api, /data_request/);
});
