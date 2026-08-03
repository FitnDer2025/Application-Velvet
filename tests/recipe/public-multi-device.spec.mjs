import { expect, test } from '@playwright/test';

async function mockMemberApis(page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let payload = {};
    if (path === '/api/members/profile') {
      payload = {
        account: { userId: '11111111-1111-4111-8111-111111111111' },
        profile: {
          id: '22222222-2222-4222-8222-222222222222',
          profile_type: 'individual',
          display_name: 'Profil de recette',
          admission_status: 'approved',
          individual_profiles: [],
          media_assets: [],
          albums: []
        },
        membership: { member_slot: 'individual' },
        personalProfileComplete: true,
        access: { tier: 'beta_full', features: {} }
      };
    } else if (path === '/api/members/verification') {
      payload = { accessBlockedByVerification: false, verification: { status: 'verified' } };
    } else if (path === '/api/members/directory') {
      payload = { profiles: [], establishments: [], venueDirectory: [], venueRelationships: [], events: [], conversations: [], recommendations: [] };
    } else if (path === '/api/members/engagement') {
      payload = { views: [], reactions: [], streaks: [] };
    } else if (path === '/api/members/photo-reactions') {
      payload = { reactions: [] };
    } else if (path === '/api/members/notifications') {
      payload = { notifications: [], unreadCount: 0 };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

test('la connexion publique reste premium, locale et sans débordement', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) failures.push(`Ressource tierce: ${url.hostname}`);
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/Velvet/);
  await expect(page.locator('text=Les rencontres commencent par la confiance.')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(failures).toEqual([]);
});

test('le shell membre se rend réellement et ne déborde sur aucun appareil', async ({ page }) => {
  await mockMemberApis(page);
  await page.goto('/membres/');
  await expect(page.locator('.brand').first()).toContainText('Velvet');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('le menu tactile mobile s’ouvre au-dessus du voile et se referme', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-chromium', 'Parcours tactile réservé aux projets mobile.');
  await mockMemberApis(page);
  await page.goto('/membres/');
  const button = page.locator('#mobileMenuButton');
  await expect(button).toBeVisible();
  await button.tap();
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toHaveClass(/open/);
  await expect(sidebar).toBeVisible();
  const sidebarLayer = await sidebar.evaluate((node) => Number.parseInt(getComputedStyle(node).zIndex, 10));
  const scrimLayer = await page.locator('.nav-scrim').evaluate((node) => Number.parseInt(getComputedStyle(node).zIndex, 10));
  expect(sidebarLayer).toBeGreaterThan(scrimLayer);
  const scrimBox = await page.locator('.nav-scrim').boundingBox();
  await page.touchscreen.tap(scrimBox.x + scrimBox.width - 4, scrimBox.y + 100);
  await expect(sidebar).not.toHaveClass(/open/);
});
