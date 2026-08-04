import { expect, test } from '@playwright/test';

const now = '2026-08-04T10:30:00.000Z';

function controlWorkspace() {
  return {
    account: { email: 'direction-recette@velvet.test', roles: ['admin'] },
    permissions: { canReviewMedia: true, canConfigure: true, canManageReports: true },
    configurationAvailable: true,
    humanActions: [
      { id: 'report-1', type: 'report', priority: 'high', title: 'Signalement à traiter', detail: 'profil · sécurité', targetView: 'actions', createdAt: now },
      { id: 'media-1', type: 'media', priority: 'normal', title: 'Décision média attendue', detail: 'Confiance sous le seuil configuré.', targetView: 'intelligence', createdAt: now }
    ],
    aiSummary: { last24Hours: 12, last7Days: 51, automaticLast24Hours: 9, humanReviewLast24Hours: 3, approvedLast24Hours: 8, rejectedLast24Hours: 1, technicalErrorsLast24Hours: 0, autonomyRate: 75 },
    aiHistory: [
      { id: 'ai-1', kind: 'media', agent: 'IA de modération média', subject: 'Photo · Couple de recette', decision: 'approved', confidence: 0.94, automatic: true, humanReviewRequired: false, summary: 'Deux adultes visibles, cadrage conforme et contenu public adapté.', scope: 'public_profile', model: 'workers-ai', technicalError: false, occurredAt: now },
      { id: 'ai-2', kind: 'media', agent: 'IA de modération média', subject: 'Photo · Profil de recette', decision: 'review', confidence: 0.83, automatic: false, humanReviewRequired: true, summary: 'Confiance sous le seuil configuré.', scope: 'private_album', model: 'workers-ai', technicalError: false, occurredAt: now }
    ],
    systems: [
      { key: 'media_ai', label: 'IA photo', status: 'active', detail: 'Décisions automatiques actives pour les cas certains.' },
      { key: 'video_review', label: 'Contrôle vidéo', status: 'human', detail: 'Les vidéos restent validées par une personne.' },
      { key: 'event_ai', label: 'Contrôle événements', status: 'active', detail: 'Analyse automatique active.' },
      { key: 'email', label: 'E-mails transactionnels', status: 'active', detail: 'Connecteur configuré.' },
      { key: 'identity', label: 'Identité & majorité', status: 'locked', detail: 'Connecteur externe volontairement non configuré.' }
    ],
    mediaPolicy: { automation_mode: 'active', public_auto_confidence: 0.86, private_auto_confidence: 0.91, updated_at: now, migration_pending: false },
    emailTemplates: [
      { template_key: 'couple_invitation', category: 'transactional', label: 'Invitation de la moitié', status: 'active', subject: 'Votre moitié vous attend dans Velvet', preheader: 'Votre histoire vous attend.', heading: 'Votre histoire vous attend.', body_text: '{{profile_name}} a entrouvert la porte de votre espace Velvet.', cta_label: 'Poursuivre notre histoire', footer_text: 'Lien personnel valable 7 jours.', updated_at: now },
      { template_key: 'marketing_launch', category: 'marketing', label: 'Annonce du lancement Velvet', status: 'draft', subject: 'Velvet ouvre bientôt ses portes', preheader: 'Une nouvelle expérience commence.', heading: 'Une nouvelle expérience commence.', body_text: 'Velvet réunit les membres et les professionnels.', cta_label: 'Découvrir Velvet', footer_text: 'Retirez votre consentement marketing à tout moment.', updated_at: now }
    ],
    accounts: [{ user_id: '11111111-1111-4111-8111-111111111111', email: 'membre@velvet.test', status: 'active', roles: ['member'], profile_id: '22222222-2222-4222-8222-222222222222', display_name: 'Couple de recette', profile_type: 'couple', verification_status: 'verified', access_tier: 'signature' }],
    profiles: [{ id: '22222222-2222-4222-8222-222222222222', display_name: 'Couple de recette', profile_type: 'couple', admission_status: 'approved', verification_status: 'verified', visibility: 'visible', created_at: now }],
    establishments: [], venueDirectory: [], staff: [], events: [], registrations: [], organizers: [],
    reports: [{ id: 'report-1', subject_type: 'profile', category: 'sécurité', description: 'Vérification humaine demandée.', status: 'open', created_at: now }],
    releaseChecks: [{ check_code: 'open_reports', status: 'warning', detail: 'Un signalement reste à traiter.', affected_count: 1 }],
    pendingMedia: [], verifications: [], dataRequests: [], audits: [], billingPrices: [], promotions: [],
    generatedPromotionCode: null
  };
}

async function mockControlApis(page) {
  const workspace = controlWorkspace();
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let payload = {};
    if (path === '/api/auth/status') payload = { authenticated: true, account: workspace.account };
    else if (path === '/api/control/workspace') payload = workspace;
    else if (path === '/api/admin/invites') payload = { invitations: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

test('Velvet Contrôle rend le briefing, les décisions IA et les actions sur tous les appareils', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await mockControlApis(page);
  await page.goto('/control/');

  await expect(page.getByRole('heading', { name: 'Pilotage Velvet' })).toBeVisible();
  await expect(page.getByText('12', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Signalement à traiter').first()).toBeVisible();
  await expect(page.getByText('Aucun service simulé.')).toBeVisible();
  await expect(page.locator('.velvet-account-access')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const geometry = await page.evaluate(() => {
    const header = document.querySelector('.control-top')?.getBoundingClientRect();
    const app = document.querySelector('#controlApp')?.getBoundingClientRect();
    const title = document.querySelector('.control-head h1')?.getBoundingClientRect();
    const headerChildren = [...document.querySelectorAll('.control-top > *')]
      .filter((node) => getComputedStyle(node).display !== 'none')
      .map((node) => node.getBoundingClientRect());
    return {
      header: header && { top: header.top, bottom: header.bottom, height: header.height },
      app: app && { top: app.top },
      title: title && { top: title.top },
      childOverflow: header && headerChildren.some((rect) => rect.top < header.top - 1 || rect.bottom > header.bottom + 1)
    };
  });
  expect(geometry.header?.height).toBeGreaterThanOrEqual(63);
  expect(geometry.app?.top).toBeGreaterThanOrEqual((geometry.header?.bottom || 0) - 1);
  expect(geometry.title?.top).toBeGreaterThan((geometry.header?.bottom || 0) + 8);
  expect(geometry.childOverflow).toBe(false);

  const navigation = await page.locator('.control-mobile-nav').isVisible()
    ? page.locator('.control-mobile-nav')
    : page.locator('.top .tabs');
  await navigation.getByRole('button', { name: /IA & modération/ }).click();
  await expect(page.getByRole('heading', { name: 'IA & modération' })).toBeVisible();
  await expect(page.locator('#mediaPolicyForm')).toBeVisible();
  await expect(page.getByText('Deux adultes visibles, cadrage conforme')).toBeVisible();

  await navigation.getByRole('button', { name: /Communications/ }).click();
  await expect(page.getByRole('heading', { name: 'Communications' })).toBeVisible();
  await expect(page.locator('#emailTemplateForm')).toBeVisible();
  await expect(page.getByText('Aperçu Velvet')).toBeVisible();

  await navigation.getByRole('button', { name: /À traiter/ }).click();
  await expect(page.getByRole('heading', { name: 'À traiter' })).toBeVisible();
  await expect(page.getByText('Vérification humaine demandée.')).toBeVisible();
  expect(failures).toEqual([]);
});
