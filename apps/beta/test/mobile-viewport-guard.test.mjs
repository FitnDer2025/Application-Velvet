import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('le clavier iOS conserve la conversation et la saisie dans le viewport visible', async () => {
  const [script, css, html, worker] = await Promise.all([
    read('apps/beta/static/assets/velvet-mobile-viewport-guard.js'),
    read('apps/beta/static/assets/velvet-mobile-viewport-guard.css'),
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/sw.js')
  ]);

  assert.match(script, /window\.visualViewport/);
  assert.match(script, /--velvet-chat-height/);
  assert.match(script, /--velvet-chat-offset-top/);
  assert.match(script, /--velvet-chat-offset-left/);
  assert.match(script, /scrollLatestMessage/);
  assert.match(script, /keepInputVisible/);
  assert.match(script, /ResizeObserver/);
  assert.match(script, /velvet-keyboard-open/);

  assert.match(css, /body\.velvet-whatsapp-chat \.app-shell/);
  assert.match(css, /min-height:\s*0\s*!important/);
  assert.match(css, /grid-template-rows:\s*minmax\(0, 1fr\) max-content/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /translate3d/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /body\.velvet-keyboard-open \.composer/);

  assert.match(html, /maximum-scale=1/);
  assert.match(html, /user-scalable=no/);
  assert.match(html, /velvet-mobile-viewport-guard\.css\?v=20260731-2/);
  assert.match(html, /velvet-mobile-viewport-guard\.js\?v=20260731-2/);
  assert.match(worker, /velvet-beta-shell-v18/);
  assert.match(worker, /velvet-mobile-viewport-guard\.css\?v=20260731-2/);
  assert.match(worker, /velvet-mobile-viewport-guard\.js\?v=20260731-2/);
});

test('les pages mobiles restent bornées à la largeur de l’écran', async () => {
  const css = await read('apps/beta/static/assets/velvet-mobile-viewport-guard.css');

  assert.match(css, /html,[\s\S]*body[\s\S]*max-width:\s*100%/);
  assert.match(css, /overscroll-behavior-x:\s*none/);
  assert.match(css, /max-width:\s*100vw/);
  assert.match(css, /img,[\s\S]*video,[\s\S]*canvas/);
});
