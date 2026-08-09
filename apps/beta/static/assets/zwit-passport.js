(() => {
  if (!location.pathname.startsWith('/membres')) return;

  const PASSPORT_ID = 'zwitPassport';
  const content = document.querySelector('#content');
  if (!content) return;

  let activeRoute = 'home';
  let cachedPassport = null;
  let cachedAt = 0;
  let renderScheduled = false;
  let loading = false;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const icons = {
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.8-2.9 8.2-7 10-4.1-1.8-7-5.2-7-10V6l7-3Z"/><path d="m9.2 12 1.8 1.8 3.9-4.1"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4L18.5 8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.8 1.8"/></svg>',
    dot: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></svg>'
  };

  function statusIcon(status) {
    if (status === 'verified') return icons.check;
    if (status === 'pending') return icons.clock;
    return icons.dot;
  }

  function proofAction(item) {
    if (item.key !== 'identity_age') return '';
    if (item.status === 'verified') return '';
    if (item.status === 'pending') {
      return '<button class="zwit-passport__action" type="button" data-passport-refresh>Actualiser le statut</button>';
    }
    return '<button class="zwit-passport__action" type="button" data-passport-verify>Vérifier maintenant</button>';
  }

  function proofCard(item) {
    return `<article class="zwit-passport__proof" data-status="${escapeHtml(item.status || 'not_started')}">
      <div class="zwit-passport__proof-top">
        <span class="zwit-passport__status">${statusIcon(item.status)}</span>
        <strong>${escapeHtml(item.label)}</strong>
      </div>
      <p>${escapeHtml(item.detail)}</p>
      ${proofAction(item)}
    </article>`;
  }

  function passportMarkup(passport) {
    const proofs = Array.isArray(passport?.proofs) ? passport.proofs : [];
    return `<section class="zwit-passport" id="${PASSPORT_ID}" aria-labelledby="zwit-passport-title">
      <header class="zwit-passport__head">
        <div>
          <p class="zwit-passport__eyebrow">Confiance Zwit</p>
          <h2 id="zwit-passport-title">Passeport Zwit</h2>
          <p class="zwit-passport__intro">Des preuves simples et vérifiables pour savoir à qui l’on parle, sans transformer les membres en notes ou en classements.</p>
        </div>
        <span class="zwit-passport__seal" aria-hidden="true">${icons.shield}</span>
      </header>
      <div class="zwit-passport__proofs">${proofs.map(proofCard).join('')}</div>
      <p class="zwit-passport__privacy">${icons.lock}<span>${escapeHtml(passport?.privacy || 'Les données d’identité restent privées et ne sont jamais affichées aux autres membres.')}</span></p>
    </section>`;
  }

  function loadingMarkup() {
    return `<section class="zwit-passport zwit-passport--loading" id="${PASSPORT_ID}" aria-busy="true">
      <header class="zwit-passport__head"><div><p class="zwit-passport__eyebrow">Confiance Zwit</p><h2>Passeport Zwit</h2></div><span class="zwit-passport__seal">${icons.shield}</span></header>
      <div class="zwit-passport__proofs">${Array.from({ length: 4 }, () => '<div class="zwit-passport__proof"></div>').join('')}</div>
    </section>`;
  }

  function errorMarkup() {
    return `<section class="zwit-passport" id="${PASSPORT_ID}">
      <header class="zwit-passport__head"><div><p class="zwit-passport__eyebrow">Confiance Zwit</p><h2>Passeport Zwit</h2><p class="zwit-passport__intro">Le passeport n’a pas pu être actualisé pour le moment. Ton profil reste pleinement accessible.</p></div><span class="zwit-passport__seal">${icons.shield}</span></header>
      <button class="zwit-passport__action" type="button" data-passport-refresh>Réessayer</button>
    </section>`;
  }

  function insert(markup) {
    const current = document.getElementById(PASSPORT_ID);
    if (current) current.outerHTML = markup;
    else content.insertAdjacentHTML('afterbegin', markup);
  }

  async function loadPassport({ force = false } = {}) {
    if (loading || activeRoute !== 'me') return;
    if (!force && cachedPassport && Date.now() - cachedAt < 30000) {
      insert(passportMarkup(cachedPassport));
      return;
    }
    loading = true;
    insert(loadingMarkup());
    try {
      const response = await fetch('/api/members/passport', { headers: { accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.passport) throw new Error(payload.error || 'passport_read_failed');
      cachedPassport = payload.passport;
      cachedAt = Date.now();
      if (activeRoute === 'me') insert(passportMarkup(cachedPassport));
    } catch {
      if (activeRoute === 'me') insert(errorMarkup());
    } finally {
      loading = false;
    }
  }

  async function startVerification(button) {
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = 'Ouverture sécurisée…';
    try {
      const response = await fetch('/api/members/verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ returnPath: '/membres/' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.startUrl) throw new Error(payload.error || 'verification_start_failed');
      location.assign(payload.startUrl);
    } catch {
      button.disabled = false;
      button.textContent = 'Réessayer la vérification';
      window.setTimeout(() => { if (button.isConnected) button.textContent = previous; }, 2500);
    }
  }

  function schedulePassport() {
    if (renderScheduled || activeRoute !== 'me') return;
    renderScheduled = true;
    window.setTimeout(() => {
      renderScheduled = false;
      if (activeRoute !== 'me') return;
      if (!document.getElementById(PASSPORT_ID)) loadPassport();
    }, 40);
  }

  function invalidatePassport({ refreshVisible = false } = {}) {
    cachedPassport = null;
    cachedAt = 0;
    if (refreshVisible && activeRoute === 'me') loadPassport({ force: true });
  }

  document.addEventListener('click', (event) => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton?.dataset.route) {
      activeRoute = routeButton.dataset.route;
      if (activeRoute === 'me') schedulePassport();
      return;
    }
    const verify = event.target.closest('[data-passport-verify]');
    if (verify) {
      event.preventDefault();
      startVerification(verify);
      return;
    }
    const refresh = event.target.closest('[data-passport-refresh]');
    if (refresh) {
      event.preventDefault();
      invalidatePassport({ refreshVisible: true });
    }
  });

  document.addEventListener('zwit:passport-refresh', () => {
    // Un check-in réel doit apparaître sans attendre l'expiration du cache 30 s.
    invalidatePassport({ refreshVisible: true });
  });

  new MutationObserver(() => schedulePassport()).observe(content, { childList: true });

  if (new URL(location.href).searchParams.get('verification') === 'success') {
    invalidatePassport();
  }
})();
