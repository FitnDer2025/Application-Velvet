import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = (path) => readFile(path, 'utf8');

test('le menu mobile V1.1 a un contrôleur unique et reste au-dessus du voile', async () => {
  const [html, shell, core, messaging, premium, feed, recovery, styles, messagingStyles] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-web-ios-parity.js'),
    read('apps/beta/static/assets/members-live.js'),
    read('apps/beta/static/assets/velvet-messaging-upgrade.js'),
    read('apps/beta/static/assets/velvet-premium-ui.js'),
    read('apps/beta/static/assets/velvet-mobile-feed-hotfix.js'),
    read('apps/beta/static/assets/velvet-interaction-recovery.js'),
    read('apps/beta/static/assets/velvet-web-ios-parity.css'),
    read('apps/beta/static/assets/velvet-messaging-upgrade.css')
  ]);
  assert.match(shell, /function toggleMenu/);
  assert.match(shell, /function bindMenuButton/);
  assert.match(shell, /menuButton\.addEventListener\('click'/);
  assert.match(shell, /sidebar\.inert = !open/);
  assert.match(shell, /velvetV11Bound/);
  assert.match(styles, /\.sidebar\.open[\s\S]*display: flex !important/);
  assert.match(styles, /\.sidebar\.open[\s\S]*visibility: visible !important/);
  assert.match(styles, /body\.velvet-v11 \.nav-scrim[\s\S]*z-index: 69/);
  assert.match(styles, /body\.velvet-v11 \.sidebar[\s\S]*z-index: 70/);
  assert.doesNotMatch(messagingStyles, /velvet-mobile-menu-open\s*::?after/);

  for (const legacy of [core, messaging, premium, feed, recovery]) {
    assert.doesNotMatch(legacy, /sidebar[^\n]*classList\.toggle\('open'/);
    assert.doesNotMatch(legacy, /mobileMenuButton[^\n]*addEventListener\('click'/);
  }

  const scriptSources = [...html.matchAll(/<script[^>]+src="\/assets\/([^"?]+)(?:\?[^" ]*)?"/g)]
    .map((match) => match[1]);
  const loadedScripts = await Promise.all(scriptSources.map(async (source) => ({
    source,
    value: await read(`apps/beta/static/assets/${source}`)
  })));
  assert.deepEqual(
    loadedScripts
      .filter(({ value }) => /sidebar[^\n]*classList\.toggle\('open'/.test(value))
      .map(({ source }) => source),
    ['velvet-web-ios-parity.js']
  );

  const styleSources = [...html.matchAll(/<link[^>]+href="\/assets\/([^"?]+\.css)(?:\?[^" ]*)?"/g)]
    .map((match) => match[1]);
  const loadedStyles = await Promise.all(styleSources.map((source) => read(`apps/beta/static/assets/${source}`)));
  for (const value of loadedStyles) {
    assert.doesNotMatch(value, /velvet-mobile-menu-open\s*::?after/);
  }
});

test('le contrôleur mobile ouvre et referme réellement la feuille et ses états accessibles', async () => {
  const source = await read('apps/beta/static/assets/velvet-web-ios-parity.js');
  const classes = () => {
    const values = new Set();
    return {
      add: (...names) => names.forEach((name) => values.add(name)),
      remove: (...names) => names.forEach((name) => values.delete(name)),
      contains: (name) => values.has(name),
      toggle: (name, force) => {
        const enabled = force === undefined ? !values.has(name) : Boolean(force);
        if (enabled) values.add(name); else values.delete(name);
        return enabled;
      }
    };
  };
  const node = () => ({
    classList: classes(),
    dataset: {},
    attributes: new Map(),
    listeners: new Map(),
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) { this.attributes.delete(name); },
    addEventListener(name, listener) { this.listeners.set(name, listener); },
    focus() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  });
  const sidebar = node();
  const menuButton = node();
  const content = node();
  content.classList = classes();
  let scrim = null;
  const body = node();
  body.append = (value) => { scrim = value; };
  const documentElement = node();
  const document = {
    body,
    documentElement,
    createElement: () => node(),
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.sidebar') return sidebar;
      if (selector === '#mobileMenuButton') return menuButton;
      if (selector === '#content') return content;
      if (selector === '.nav-scrim') return scrim;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const window = {
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    requestAnimationFrame: (callback) => { callback(); return 1; },
    setTimeout: (callback) => callback(),
    addEventListener() {}
  };
  vm.runInNewContext(source, {
    document,
    window,
    MutationObserver: class { observe() {} }
  });

  const clickMenu = menuButton.listeners.get('click');
  assert.equal(typeof clickMenu, 'function');
  clickMenu({ preventDefault() {}, stopPropagation() {} });
  assert.equal(sidebar.classList.contains('open'), true);
  assert.equal(body.classList.contains('nav-open'), true);
  assert.equal(sidebar.inert, false);
  assert.equal(sidebar.attributes.get('aria-hidden'), 'false');
  assert.equal(scrim.attributes.get('aria-hidden'), 'false');

  scrim.listeners.get('click')();
  assert.equal(sidebar.classList.contains('open'), false);
  assert.equal(body.classList.contains('nav-open'), false);
  assert.equal(sidebar.inert, true);
  assert.equal(sidebar.attributes.get('aria-hidden'), 'true');
});

test('le fil conserve seulement le badge Déjà vu natif sans bandeau absolu concurrent', async () => {
  const [core, realtime] = await Promise.all([
    read('apps/beta/static/assets/members-live.js'),
    read('apps/beta/static/assets/velvet-social-realtime.js')
  ]);
  assert.match(core, /Déjà vu/);
  assert.match(realtime, /querySelectorAll\('\.velvet-profile-viewed-v2'\)/);
  const decorator = realtime.match(/function decorateProfileViews\(\)[\s\S]*?function ensureViewHistory/)?.[0] || '';
  assert.doesNotMatch(decorator, /appendChild\(badge\)/);
});

test('les notifications utilisent le même parcours depuis le commutateur et le test', async () => {
  const [core, pwa, messaging, endpoint] = await Promise.all([
    read('apps/beta/static/assets/members-live.js'),
    read('apps/beta/static/assets/pwa-ios.js'),
    read('apps/beta/static/assets/velvet-messaging-upgrade.js'),
    read('functions/api/members/push-subscriptions.js')
  ]);
  assert.match(core, /synchronizeBrowserNotifications/);
  assert.match(core, /VelvetPWA\.enableNotifications/);
  assert.match(core, /VelvetPWA\.disableNotifications/);
  assert.match(pwa, /return \{ mode: 'push', subscribed: true \}/);
  assert.match(pwa, /return \{ mode: 'local', subscribed: false \}/);
  assert.doesNotMatch(messaging, /data-test-notification/);
  assert.match(endpoint, /browser_enabled: true/);
});

test('le cache V26 force le chargement de l’inscription guidée sur les PWA existantes', async () => {
  const [html, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/sw.js')
  ]);
  for (const asset of [
    'members-live.js?v=20260803-4',
    'velvet-premium-ui.js?v=20260803-3',
    'velvet-messaging-upgrade.css?v=20260803-3',
    'velvet-messaging-upgrade.js?v=20260803-3',
    'velvet-mobile-feed-hotfix.css?v=20260803-3',
    'velvet-mobile-feed-hotfix.js?v=20260803-3',
    'velvet-interaction-recovery.css?v=20260803-3',
    'velvet-interaction-recovery.js?v=20260803-3',
    'velvet-web-ios-parity.css?v=20260803-3',
    'velvet-web-ios-parity.js?v=20260803-3',
    'location-verification.js?v=20260803-1'
  ]) {
    assert.match(html, new RegExp(asset.replace(/[.?]/g, '\\$&')));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, '\\$&')));
  }
  assert.match(worker, /velvet-beta-shell-v26/);
});
