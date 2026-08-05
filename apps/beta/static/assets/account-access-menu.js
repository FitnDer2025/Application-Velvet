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
  const spaces = [
    { href: '/membres/', label: 'Membres', path: '/membres/' },
    { href: '/pro/', label: 'Velvet Pro', path: '/pro/' },
    { href: '/control/', label: 'Velvet Contrôle', accessibleLabel: 'Velvet Control', path: '/control/' }
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
    root.setAttribute('aria-label', 'Compte et espaces Velvet');
    root.innerHTML = `${isAdmin ? `
      <p class="velvet-account-kicker">ACCÈS ADMINISTRATEUR</p>
      <nav aria-label="Changer d’interface">
        ${spaces.map((space) => `<a href="${space.href}"${space.accessibleLabel ? ` aria-label="${escape(space.accessibleLabel)}"` : ''}${currentPath.startsWith(space.path) ? ' aria-current="page"' : ''}>${escape(space.label)}</a>`).join('')}
      </nav>` : ''}
      <button class="velvet-change-account" type="button">Changer de compte</button>`;

    root.querySelector('.velvet-change-account').addEventListener('click', (event) => changeAccount(event.currentTarget));
    if (host.matches('header.top')) host.insertBefore(root, host.querySelector('.spacer'));
    else host.prepend(root);
  }

  const style = document.createElement('style');
  style.textContent = `
    .velvet-account-access{display:grid;gap:8px;margin-bottom:10px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:15px;background:rgba(255,255,255,.035);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .velvet-account-kicker{margin:0!important;color:#c6a96a!important;font-size:9px!important;letter-spacing:.15em!important}
    .velvet-account-access nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
    .velvet-account-access nav a{padding:7px 5px;border:1px solid rgba(255,255,255,.09);border-radius:9px;color:#bdb4b7;text-align:center;text-decoration:none;font-size:9px;line-height:1.25}
    .velvet-account-access nav a:hover,.velvet-account-access nav a:focus-visible,.velvet-account-access nav a[aria-current=page]{border-color:rgba(198,169,106,.5);background:rgba(198,169,106,.09);color:#f4f4f2;outline:none}
    .velvet-change-account{width:100%;padding:9px 10px;border:1px solid rgba(181,58,97,.38);border-radius:10px;background:rgba(100,27,54,.12);color:#d9a9b9;font:600 11px/1.2 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
    .velvet-change-account:hover,.velvet-change-account:focus-visible{border-color:#b53a61;background:rgba(100,27,54,.24);color:#f4f4f2;outline:2px solid rgba(181,58,97,.25);outline-offset:2px}
    .velvet-change-account:disabled{cursor:wait;opacity:.65}
    header .velvet-account-access.is-header{position:relative;display:flex;align-items:center;gap:7px;margin:0 6px;padding:5px 7px}
    header .velvet-account-access.is-header .velvet-account-kicker{display:none}
    header .velvet-account-access.is-header nav{display:flex}
    header .velvet-account-access.is-header nav a{min-width:70px}
    header .velvet-account-access.is-header .velvet-change-account{width:auto;white-space:nowrap}
    @media(max-width:900px){header .velvet-account-access.is-header{margin-left:auto}header .velvet-account-access.is-header nav{display:none}}
  `;
  document.head.appendChild(style);
  account().then(mount).catch(() => {});
})();
