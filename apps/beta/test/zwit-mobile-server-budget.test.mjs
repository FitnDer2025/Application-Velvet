import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('l accueil membre reste sous un budget explicite de sous-requetes externes', async () => {
  const home = await read('functions/api/members/home-intelligence.js');
  assert.match(home, /const MAX_EXTERNAL_GEOCODES = 8/);
  assert.match(home, /const HOME_PROFILE_LIMIT = 120/);
  assert.match(home, /externalGeocodeBudget = \{ remaining: MAX_EXTERNAL_GEOCODES \}/);
  assert.match(home, /budget\.remaining <= 0/);
  assert.match(home, /budget\.remaining -= 1/);
  assert.doesNotMatch(home, /order=updated_at\.desc&limit=300/);
});

test('les medias de profils sont signes par petits lots avec secours borne', async () => {
  const media = await read('functions/api/members/media.js');
  assert.match(media, /export async function signedMediaUrls/);
  assert.match(media, /\/storage\/v1\/object\/sign\/velvet-media/);
  assert.match(media, /const SIGNED_URL_BATCH_SIZE = 10/);
  assert.match(media, /const SIGNED_URL_FALLBACK_LIMIT = 18/);
  assert.match(media, /slice\(offset, offset \+ SIGNED_URL_BATCH_SIZE\)/);
  assert.match(media, /JSON\.stringify\(\{ expiresIn: ttl, paths \}\)/);
  assert.doesNotMatch(media, /JSON\.stringify\(\{ expiresIn: ttl, paths: uniquePaths \}\)/);
  assert.match(media, /collectMediaPaths\(rows\)/);
  assert.match(media, /const urls = await signedMediaUrls\(env, session, collectMediaPaths\(rows\)\)/);
  assert.match(media, /slice\(0, SIGNED_URL_FALLBACK_LIMIT\)/);
});

test('le Web mobile charge le Halo Dock sur six destinations sans retour a la grille deux lignes', async () => {
  const [shell, polish] = await Promise.all([
    read('apps/beta/static/assets/zwit-ios-source-of-truth.js'),
    read('apps/beta/static/assets/zwit-mobile-polish.css')
  ]);
  assert.doesNotThrow(() => new Function(shell));
  assert.match(shell, /MOBILE_POLISH_CSS/);
  assert.match(shell, /data-zwit-mobile-polish/);
  assert.match(polish, /grid-template-columns:\s*repeat\(6,minmax\(0,1fr\)\)\s*!important/);
  assert.match(polish, /flex-wrap:\s*nowrap\s*!important/);
  assert.match(polish, /width:\s*calc\(100vw - 20px\)\s*!important/);
  assert.match(polish, /\.bottom-nav button\.active::before/);
  assert.match(polish, /rgba\(126,32,69/);
});

test('le header mobile ne garde qu une cloche et retire Ce soir du chrome persistant', async () => {
  const shell = await read('apps/beta/static/assets/zwit-ios-source-of-truth.js');
  assert.match(shell, /notificationButtons\.slice\(1\)\.forEach\(\(node\) => node\.remove\(\)\)/);
  assert.match(shell, /actions\.querySelectorAll\('\[data-zwit-route="tonight"\]'\)\.forEach\(\(node\) => node\.remove\(\)\)/);
  assert.match(shell, /zwit-mobile-header-icon/);
});

test('une erreur Cloudflare brute ne reste jamais visible pour le membre', async () => {
  const shell = await read('apps/beta/static/assets/zwit-ios-source-of-truth.js');
  assert.match(shell, /INFRASTRUCTURE_ERROR/);
  assert.match(shell, /Too many subrequests/);
  assert.match(shell, /data-zwit-retry-service/);
  assert.match(shell, /La connexion aux données a été interrompue/);
});
