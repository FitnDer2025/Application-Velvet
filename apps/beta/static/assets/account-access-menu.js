(() => {
  'use strict';

  if (!document.querySelector('script[data-velvet-production-surface]')) {
    const productionSurface = document.createElement('script');
    productionSurface.src = '/assets/velvet-production-surface.js?v=20260805-1';
    productionSurface.defer = true;
    productionSurface.dataset.velvetProductionSurface = 'true';
    (document.head || document.documentElement).appendChild(productionSurface);
  }

  const currentPath = window.location.pathname;

  function loadScript(src, marker, callback) {
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      if (callback) {
        if (existing.dataset.loaded === 'true') callback();
        else existing.addEventListener('load', callback, { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(marker, 'true');
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      callback?.();
    }, { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function loadProMarketing() {
    if (!currentPath.startsWith('/pro/') && !currentPath.startsWith('/marketing-pro/')) return;
    const loadCockpit = () => loadScript('/assets/velvet-pro-marketing.js?v=20260805-1', 'data-velvet-pro-marketing');
    const loadRuntime = () => loadScript('/assets/velvet-pro-marketing-runtime.js?v=20260805-1', 'data-velvet-pro-marketing-runtime', loadCockpit);
    if (currentPath.startsWith('/marketing-pro/')) {
      loadScript('/assets/velvet-marketing-pro-campaign-bridge.js?v=20260805-1', 'data-velvet-marketing-campaign-bridge', loadRuntime);
    } else {
      loadRuntime();
    }
  }

  loadProMarketing();

  const spaces = [
    { href: '/membres/', label: 'Membres', path: '/membres/' },
    { href: '/pro/', label: 'Zwit Pro', path: '/pro/' },
    { href: '/control/', label: 'Zwit Contrôle', accessibleLabel: 'Zwit Control', path: '/control/' }
  ];

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  async function account() {
    const response = await fetch('/api/auth/status', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.account) throw new Error('session_unavailable');
    return payload.account;
  }

  async function changeAccount(button) {
    button.disabled = true;
    button.textContent = 'Fermeture de la session…';
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    }).catch(() => null);
    window.location.replace('/?mode=login');
  }

  function mount(currentAccount) {
    const roles = Array.isArray(currentAccount.roles) ? currentAccount.roles : [];
    const isAdmin = roles.includes('admin');
    const host = currentPath.startsWith('/pro/')
      ? document.querySelector('.topbar .top-actions')
      : document.querySelector('.sidebar-foot') || document.querySelector('header.top');
    if (!host) return;

    document.querySelector('#logoutButton')?.remove();
    const root = document.createElement('section');
    root.className = `velvet-account-access${host.closest('header') ? ' is-header' : ''}`;
    root.setAttribute('aria-label', 'Compte et espaces Zwit');
    const waitlistLink = isAdmin && currentPath.startsWith('/control/')
      ? `<a class="velvet-waitlist-link" href="/control/acces-prive/"${currentPath.startsWith('/control/acces-prive/') ? ' aria-current="page"' : ''}>Salle d’attente · Préinscriptions</a>`
      : '';
    root.innerHTML = `${isAdmin ? `
      <p class="velvet-account-kicker">ACCÈS ADMINISTRATEUR</p>
      <nav aria-label="Changer d’interface">
        ${spaces.map((space) => `<a href="${space.href}"${space.accessibleLabel ? ` aria-label="${escape(space.accessibleLabel)}"` : ''}${currentPath.startsWith(space.path) ? ' aria-current="page"' : ''}>${escape(space.label)}</a>`).join('')}
      </nav>${waitlistLink}` : ''}
      <button class="velvet-change-account" type="button">Changer de compte</button>`;

    root.querySelector('.velvet-change-account').addEventListener('click', (event) => changeAccount(event.currentTarget));
    if (host.matches('header.top')) host.insertBefore(root, host.querySelector('.spacer'));
    else host.prepend(root);
  }

  function mountControlWaitlistEntry(currentAccount) {
    if (!currentPath.startsWith('/control/') || currentPath.startsWith('/control/acces-prive/')) return;
    const allowed = new Set(['admin', 'direction', 'moderator', 'support', 'auditor']);
    const roles = Array.isArray(currentAccount.roles) ? currentAccount.roles : [];
    if (!roles.some((role) => allowed.has(role))) return;

    const install = () => {
      const page = document.querySelector('[data-page="communications"]');
      if (!page || page.querySelector('[data-control-waitlist-entry]')) return;
      const entry = document.createElement('section');
      entry.className = 'control-card velvet-control-waitlist-entry';
      entry.dataset.controlWaitlistEntry = 'true';
      entry.innerHTML = `
        <div>
          <p class="control-eyebrow">ACCÈS PRIVÉ · PRÉ-OUVERTURE</p>
          <h2>Salle d’attente Zwit</h2>
          <p>Suivre les préinscriptions membres et professionnelles, les territoires, les sources de campagne et l’état des invitations.</p>
        </div>
        <div class="velvet-control-waitlist-actions">
          <a class="control-btn secondary" href="/marketing/acces-prive/">Préparer les publications</a>
          <a class="control-btn" href="/control/acces-prive/">Ouvrir le dashboard</a>
        </div>`;
      page.querySelector('.control-head')?.insertAdjacentElement('afterend', entry);
    };

    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const style = document.createElement('style');
  style.textContent = `
    .velvet-account-access{display:grid;gap:8px;margin-bottom:10px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:15px;background:rgba(255,255,255,.035);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .velvet-account-kicker{margin:0!important;color:#c6a96a!important;font-size:9px!important;letter-spacing:.15em!important}
    .velvet-account-access nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
    .velvet-account-access nav a,.velvet-waitlist-link{padding:7px 5px;border:1px solid rgba(255,255,255,.09);border-radius:9px;color:#bdb4b7;text-align:center;text-decoration:none;font-size:9px;line-height:1.25}
    .velvet-account-access nav a:hover,.velvet-account-access nav a:focus-visible,.velvet-account-access nav a[aria-current=page],.velvet-waitlist-link:hover,.velvet-waitlist-link:focus-visible,.velvet-waitlist-link[aria-current=page]{border-color:rgba(198,169,106,.5);background:rgba(198,169,106,.09);color:#f4f4f2;outline:none}
    .velvet-waitlist-link{display:block;border-color:rgba(181,58,97,.3);background:rgba(100,27,54,.1);color:#d9a9b9;font-weight:700}
    .velvet-change-account{width:100%;padding:9px 10px;border:1px solid rgba(181,58,97,.38);border-radius:10px;background:rgba(100,27,54,.12);color:#d9a9b9;font:600 11px/1.2 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
    .velvet-change-account:hover,.velvet-change-account:focus-visible{border-color:#b53a61;background:rgba(100,27,54,.24);color:#f4f4f2;outline:2px solid rgba(181,58,97,.25);outline-offset:2px}
    .velvet-change-account:disabled{cursor:wait;opacity:.65}
    header .velvet-account-access.is-header{position:relative;display:flex;align-items:center;gap:7px;margin:0 6px;padding:5px 7px}
    header .velvet-account-access.is-header .velvet-account-kicker{display:none}
    header .velvet-account-access.is-header nav{display:flex}
    header .velvet-account-access.is-header nav a{min-width:70px}
    header .velvet-account-access.is-header .velvet-waitlist-link{white-space:nowrap}
    header .velvet-account-access.is-header .velvet-change-account{width:auto;white-space:nowrap}
    .velvet-control-waitlist-entry{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:0 0 18px;padding:22px 24px;border-color:rgba(217,182,107,.24)!important;background:radial-gradient(circle at 92% 8%,rgba(140,18,63,.22),transparent 38%),linear-gradient(135deg,rgba(217,182,107,.055),rgba(255,255,255,.018))!important}
    .velvet-control-waitlist-entry h2{margin:5px 0 7px;font-size:24px}
    .velvet-control-waitlist-entry p:not(.control-eyebrow){max-width:690px;margin:0;color:#948d89;line-height:1.55}
    .velvet-control-waitlist-actions{display:flex;flex-shrink:0;gap:8px}
    @media(max-width:900px){header .velvet-account-access.is-header{margin-left:auto}header .velvet-account-access.is-header nav,header .velvet-account-access.is-header .velvet-waitlist-link{display:none}.velvet-control-waitlist-entry{align-items:flex-start;flex-direction:column}.velvet-control-waitlist-actions{width:100%;flex-wrap:wrap}}
  `;
  document.head.appendChild(style);
  account().then((currentAccount) => {
    mount(currentAccount);
    mountControlWaitlistEntry(currentAccount);
  }).catch(() => {});
})();