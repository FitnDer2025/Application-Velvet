import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const media = await readFile(new URL('../functions/api/members/media.js', import.meta.url), 'utf8');
const mobileCss = await readFile(new URL('../apps/beta/static/assets/zwit-mobile-polish.css', import.meta.url), 'utf8');

test('profile media signing is chunked instead of one unbounded Storage request', () => {
  assert.match(media, /SIGNED_URL_BATCH_SIZE\s*=\s*10/);
  assert.match(media, /slice\(offset, offset \+ SIGNED_URL_BATCH_SIZE\)/);
  assert.doesNotMatch(media, /JSON\.stringify\(\{ expiresIn: ttl, paths: uniquePaths \}\)/);
});

test('media fallback remains strictly bounded to protect the Cloudflare subrequest budget', () => {
  assert.match(media, /SIGNED_URL_FALLBACK_LIMIT\s*=\s*18/);
  assert.match(media, /slice\(0, SIGNED_URL_FALLBACK_LIMIT\)/);
});

test('mobile conversation hides the global Halo Dock', () => {
  assert.match(mobileCss, /body\.zwit-ios-source-of-truth\.velvet-whatsapp-chat \.bottom-nav\s*\{[\s\S]*?display:\s*none\s*!important/);
});

test('mobile conversation composer is not offset by the hidden Halo Dock', () => {
  assert.match(mobileCss, /body\.zwit-ios-source-of-truth\.velvet-whatsapp-chat #messageForm\.zwit-ios-composer\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?bottom:\s*auto\s*!important/);
});

test('mobile conversation owns the full viewport height', () => {
  assert.match(mobileCss, /body\.zwit-ios-source-of-truth\.velvet-whatsapp-chat main\s*\{[\s\S]*?height:\s*var\(--velvet-chat-height,100dvh\)\s*!important/);
});
