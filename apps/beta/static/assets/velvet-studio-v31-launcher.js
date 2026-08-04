(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

  function notify(message, tone = 'ok') {
    let node = document.querySelector('#vs31Toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vs31Toast';
      document.body.appendChild(node);
    }
    node.className = `vs31-toast ${tone}`;
    node.textContent = message;
    requestAnimationFrame(() => node.classList.add('show'));
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 3500);
  }

  async function waitFor(selector, timeout = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const node = document.querySelector(selector);
      if (node) return node;
      await sleep(120);
    }
    return null;
  }

  async function openMediaStudio(button) {
    if (button.disabled) return;
    button.disabled = true;
    const original = button.innerHTML;
    button.innerHTML = '<span>✦</span> Ouverture…';

    try {
      let modal = document.querySelector('[data-velvet-studio-v3]');
      if (!modal) {
        const v3Button = root.querySelector('[data-open-v3]');
        if (!v3Button) throw new Error('Ouvre d’abord un projet Velvet Studio.');
        v3Button.click();
        modal = await waitFor('[data-velvet-studio-v3]', 8000);
      }
      if (!modal) throw new Error('Campagne V3 ne s’est pas ouverte.');

      let mediaTab = modal.querySelector('[data-v31-media-tab]');
      if (!mediaTab) {
        const generate = modal.querySelector('[data-v3-generate]');
        if (generate && !modal.querySelector('.vs3-tabs')) {
          notify('Préparation automatique de la campagne…');
          generate.click();
        }
        mediaTab = await waitFor('[data-v31-media-tab]', 30000);
      }

      if (!mediaTab) throw new Error('Le module Médias IA n’est pas chargé sur cette version.');
      mediaTab.click();
      notify('Studio photo & vidéo ouvert');
    } catch (error) {
      notify(error.message || 'Impossible d’ouvrir Médias IA.', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  function installLauncher() {
    const shell = root.querySelector('.vs1-shell');
    if (!shell) return;
    const target = shell.querySelector('.vs1-top-actions,.vs1-editor-actions');
    if (!target || target.querySelector('[data-open-v31-media]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vs1-btn primary vs31-direct-launch';
    button.dataset.openV31Media = 'true';
    button.innerHTML = '<span>✦</span> Médias IA';
    button.addEventListener('click', () => openMediaStudio(button));
    target.prepend(button);

    const brand = shell.querySelector('.vs1-brand');
    if (brand && !brand.querySelector('[data-v31-live-badge]')) {
      const badge = document.createElement('span');
      badge.className = 'vs3-ready-badge';
      badge.dataset.v31LiveBadge = 'true';
      badge.textContent = 'V3.1 MEDIA';
      brand.appendChild(badge);
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(installLauncher));
  observer.observe(root, { childList: true, subtree: true });
  installLauncher();
})();
