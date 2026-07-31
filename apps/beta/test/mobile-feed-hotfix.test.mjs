import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scriptPath = new URL('../static/assets/velvet-mobile-feed-hotfix.js', import.meta.url);
const stylePath = new URL('../static/assets/velvet-mobile-feed-hotfix.css', import.meta.url);
const pagePath = new URL('../../web/velvet-members-beta-live.html', import.meta.url);

test('le correctif mobile reste syntaxiquement valide et raccordé à la page membres', async () => {
  const [script, style, page] = await Promise.all([
    readFile(scriptPath, 'utf8'),
    readFile(stylePath, 'utf8'),
    readFile(pagePath, 'utf8')
  ]);

  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /individual_portrait/);
  assert.match(script, /bottom-nav \[data-route="conversations"\]/);
  assert.match(script, /canonicalButton\.click\(\)/);
  assert.match(style, /grid-template-columns: repeat\(5/);
  assert.match(style, /\.feed-avatar\.is-profile-portrait img/);
  assert.match(page, /velvet-mobile-feed-hotfix\.css/);
  assert.match(page, /velvet-mobile-feed-hotfix\.js/);
});
