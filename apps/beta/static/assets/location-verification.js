(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const cache = {
    location: null,
    verification: null,
    profileStatuses: new Map(),
    ownProfileId: null,
    visibleProfileId: null,
    loadingBadges: null
  };
  let scanQueued = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.style.borderColor = error ? 'rgba(255,142,167,.45)' : '';
    node.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove('show'), 4300);
  }

  async function api(path, options = {}) {
    const response = await nativeFetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || 'request_failed');
    return payload;
  }

  function formatDate(value) {
    if (!value) return 'Jamais utilisée';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date indisponible';
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function geolocationError(error) {
    if (error?.code === 1) return 'L’autorisation de localisation a été refusée dans les réglages du téléphone.';
    if (error?.code === 2) return 'Le téléphone ne parvient pas à déterminer la position.';
    if (error?.code === 3) return 'La localisation a pris trop de temps. Réessaie dans un endroit mieux couvert.';
    return error?.message || 'La localisation est momentanément indisponible.';
  }

  function requestPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Ce navigateur ne prend pas en charge la géolocalisation.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 5 * 60 * 1000
      });
    });
  }

  function locationCard(payload) {
    const location = payload?.location || {};
    const nearbyCount = Array.isArray(payload?.nearbyVenues) ? payload.nearbyVenues.length : 0;
    return `<section class="card settings-card velvet-location-card" data-velvet-location-card>
      <p class="eyebrow">Autour de toi</p>
      <h2>Utiliser ma position approximative</h2>
      <p>Zwit demande ta position uniquement lorsque tu appuies sur le bouton. Le serveur la ramène immédiatement à une zone d’environ ${escapeHtml(location.precision_km || 10)} km. Les coordonnées GPS exactes ne sont pas enregistrées et ta position n’est jamais affichée sur ton profil.</p>
      <div class="velvet-feature-status ${location.enabled ? 'active' : ''}">
        <span aria-hidden="true">${location.enabled ? '✓' : '○'}</span>
        <div><strong>${location.enabled ? 'Position approximative active' : 'Localisation désactivée'}</strong><small>${location.enabled ? `Dernière utilisation : ${escapeHtml(formatDate(location.last_used_at))} · ${nearbyCount} lieu${nearbyCount > 1 ? 'x' : ''} proche${nearbyCount > 1 ? 's' : ''} trouvé${nearbyCount > 1 ? 's' : ''}` : 'Aucune donnée de position conservée.'}</small></div>
      </div>
      <div class="velvet-inline-actions">
        <button class="secondary" type="button" data-use-velvet-location>${location.enabled ? 'Actualiser ma zone' : 'Utiliser ma position'}</button>
        ${location.enabled ? '<button class="text-button" type="button" data-clear-velvet-location>Désactiver et effacer</button>' : ''}
      </div>
    </section>`;
  }

  function verificationStatusLabel(status) {
    return ({
      not_started: 'Non démarrée',
      pending: 'Contrôle en cours',
      verified: 'Identité et majorité vérifiées',
      failed: 'Contrôle non abouti',
      expired: 'Vérification à renouveler',
      revoked: 'Vérification retirée'
    })[status] || 'Non démarrée';
  }

  function verificationCard(payload) {
    const verification = payload?.verification || {};
    const verified = verification.status === 'verified'
      && verification.identity_verified === true
      && verification.majority_verified === true;
    return `<section class="card settings-card velvet-verification-card" data-velvet-verification-card>
      <p class="eyebrow">Confiance Zwit</p>
      <h2>Identité et majorité</h2>
      <p>Le contrôle est réalisé par un prestataire tiers. Zwit reçoit seulement le résultat nécessaire pour attribuer le badge ; aucune pièce d’identité, identité civile ou date de naissance n’est conservée par Zwit.</p>
      <div class="velvet-feature-status ${verified ? 'verified' : ''}">
        <span aria-hidden="true">${verified ? '✓' : '◇'}</span>
        <div><strong>${escapeHtml(verificationStatusLabel(verification.status))}</strong><small>${verified ? `Vérifiée le ${escapeHtml(formatDate(verification.verified_at))}` : payload?.accessBlockedByVerification ? 'L’accès communautaire reste fermé jusqu’à la confirmation.' : payload?.bypassedForInternalRecipe ? 'Compte autorisé uniquement pour la recette interne.' : 'Le verrou sera activé avant toute ouverture externe.'}</small></div>
      </div>
      ${payload?.providerConfigured
        ? '<button class="secondary" type="button" data-start-velvet-verification>Commencer la vérification</button>'
        : '<button class="secondary" type="button" disabled>Prestataire volontairement non raccordé</button>'}
      <small class="velvet-foundation-note">Le badge « Profil vérifié Zwit » apparaîtra uniquement après confirmation simultanée de l’identité et de la majorité. Pour un couple, les deux partenaires devront être vérifiés.</small>
    </section>`;
  }

  function exportCard() {
    return `<section class="card settings-card velvet-export-card" data-velvet-export-card>
      <p class="eyebrow">Portabilité</p>
      <h2>Télécharger mes données</h2>
      <p>Zwit prépare un fichier JSON lisible et réutilisable contenant les données liées à ton compte. Les pièces d’identité et les informations privées d’autres membres n’y figurent jamais.</p>
      <button class="secondary" type="button" data-export-velvet>Préparer mon export JSON</button>
      <small class="velvet-foundation-note">Le téléchargement est généré à la demande, n’est pas mis en cache et ses médias restent protégés par ta session.</small>
    </section>`;
  }

  async function loadLocation() {
    cache.location = await api('/api/members/location');
    return cache.location;
  }

  async function loadVerification() {
    cache.verification = await api('/api/members/verification');
    return cache.verification;
  }

  async function injectSettingsCards(form) {
    if (!form || form.dataset.velvetFoundation === '1') return;
    const footer = form.querySelector('.settings-save');
    if (!footer) return;
    form.dataset.velvetFoundation = '1';

    const holder = document.createElement('div');
    holder.className = 'velvet-foundation-holder';
    holder.innerHTML = '<section class="card settings-card"><p>Préparation de la localisation et de la confiance Zwit…</p></section>';
    footer.before(holder);

    try {
      const [location, verification] = await Promise.all([loadLocation(), loadVerification()]);
      holder.innerHTML = `${locationCard(location)}${verificationCard(verification)}${exportCard()}`;
    } catch (error) {
      holder.innerHTML = `<section class="card settings-card"><p class="eyebrow">Services mobiles</p><h2>Chargement impossible</h2><p>${escapeHtml(error.message)}</p></section>`;
    }
  }

  async function activateLocation(button) {
    button.disabled = true;
    button.textContent = 'Demande au téléphone…';
    try {
      const position = await requestPosition();
      cache.location = await api('/api/members/location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          consent: true
        })
      });
      toast('Ta zone approximative est active. Les coordonnées exactes n’ont pas été conservées.');
      refreshLocationCard();
    } catch (error) {
      toast(error?.code ? geolocationError(error) : (error.message || geolocationError(error)), true);
      button.disabled = false;
      button.textContent = 'Utiliser ma position';
    }
  }

  async function clearLocation(button) {
    button.disabled = true;
    try {
      cache.location = await api('/api/members/location', { method: 'DELETE' });
      toast('La localisation Zwit est désactivée et la zone enregistrée a été effacée.');
      refreshLocationCard();
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  }

  function refreshLocationCard() {
    const current = document.querySelector('[data-velvet-location-card]');
    if (!current || !cache.location) return;
    const replacement = document.createElement('div');
    replacement.innerHTML = locationCard(cache.location);
    current.replaceWith(replacement.firstElementChild);
  }

  async function startVerification(button) {
    button.disabled = true;
    try {
      const result = await api('/api/members/verification', {
        method: 'POST',
        body: JSON.stringify({ returnPath: '/membres/' })
      });
      window.location.assign(result.startUrl);
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  }

  function exportFilename(response) {
    const header = response.headers.get('content-disposition') || '';
    return header.match(/filename="([^"]+)"/i)?.[1]
      || `velvet-export-${new Date().toISOString().slice(0, 10)}.json`;
  }

  async function exportData(button) {
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = 'Préparation sécurisée…';
    try {
      const response = await nativeFetch('/api/members/data-export', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { accept: 'application/json' }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'data_export_failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFilename(response);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Ton export Zwit a été téléchargé sur cet appareil.');
    } catch (error) {
      toast(error.message === 'data_export_failed'
        ? 'Ton export n’a pas pu être préparé. Réessaie dans quelques instants.'
        : error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = previous;
    }
  }

  async function loadBadgeStatuses() {
    if (cache.loadingBadges) return cache.loadingBadges;
    cache.loadingBadges = Promise.all([
      api('/api/members/profile'),
      api('/api/members/directory').catch(() => ({ profiles: [] }))
    ]).then(([own, directory]) => {
      cache.ownProfileId = own.profile?.id || null;
      if (own.profile?.id) cache.profileStatuses.set(own.profile.id, own.profile.verification_status || 'not_started');
      (directory.profiles || []).forEach((profile) => cache.profileStatuses.set(profile.id, profile.verification_status || 'not_started'));
      return cache.profileStatuses;
    }).catch(() => cache.profileStatuses);
    return cache.loadingBadges;
  }

  function verifiedPill() {
    const pill = document.createElement('span');
    pill.className = 'pill velvet-verified-pill';
    pill.textContent = '✓ Profil vérifié Zwit';
    return pill;
  }

  async function decorateVerificationBadges() {
    await loadBadgeStatuses();
    document.querySelectorAll('[data-open-profile]').forEach((tile) => {
      const profileId = tile.dataset.openProfile;
      if (cache.profileStatuses.get(profileId) !== 'verified' || tile.querySelector('.velvet-verified-pill')) return;
      const body = tile.querySelector('.member-body');
      body?.querySelector('.member-meta')?.after(verifiedPill());
    });

    const heroBadges = document.querySelector('.hero .badges');
    if (!heroBadges || heroBadges.querySelector('.velvet-verified-pill')) return;
    const activeMe = document.querySelector('[data-route="me"].active');
    const profileId = activeMe ? cache.ownProfileId : cache.visibleProfileId;
    if (profileId && cache.profileStatuses.get(profileId) === 'verified') {
      heroBadges.prepend(verifiedPill());
    }
  }

  function injectStyles() {
    if (document.querySelector('#velvetLocationVerificationStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetLocationVerificationStyles';
    style.textContent = `.velvet-foundation-holder{display:contents}.velvet-feature-status{display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:center;margin:16px 0;padding:15px;border:1px solid rgba(255,255,255,.09);border-radius:17px;background:rgba(255,255,255,.025)}.velvet-feature-status>span{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:#21151a;color:#bdaeb4;font:500 20px Georgia}.velvet-feature-status.active,.velvet-feature-status.verified{border-color:rgba(217,184,121,.34);background:linear-gradient(125deg,rgba(126,32,69,.22),rgba(217,184,121,.045))}.velvet-feature-status.active>span,.velvet-feature-status.verified>span{background:linear-gradient(145deg,#8f274e,#431323);color:#f0d39b}.velvet-feature-status strong,.velvet-feature-status small{display:block}.velvet-feature-status small{margin-top:4px;color:#9f9297;line-height:1.45}.velvet-inline-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px}.velvet-foundation-note{display:block;margin-top:14px;color:#95888e;line-height:1.55}.velvet-verified-pill{display:inline-flex!important;width:max-content;margin:8px 0;border-color:rgba(217,184,121,.45)!important;background:linear-gradient(120deg,rgba(126,32,69,.36),rgba(217,184,121,.12))!important;color:#f0d39b!important}@media(max-width:720px){.velvet-inline-actions>*{width:100%}}`;
    document.head.appendChild(style);
  }

  document.addEventListener('click', (event) => {
    const profileButton = event.target.closest('[data-open-profile]');
    if (profileButton) cache.visibleProfileId = profileButton.dataset.openProfile;
    if (event.target.closest('[data-route="me"]')) cache.visibleProfileId = cache.ownProfileId;

    const useLocation = event.target.closest('[data-use-velvet-location]');
    if (useLocation) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activateLocation(useLocation);
      return;
    }
    const clear = event.target.closest('[data-clear-velvet-location]');
    if (clear) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearLocation(clear);
      return;
    }
    const verification = event.target.closest('[data-start-velvet-verification]');
    if (verification) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startVerification(verification);
      return;
    }
    const exportButton = event.target.closest('[data-export-velvet]');
    if (exportButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportData(exportButton);
    }
  }, true);

  function scan() {
    injectSettingsCards(document.querySelector('#settingsForm'));
    decorateVerificationBadges();
  }

  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    window.requestAnimationFrame(() => {
      scanQueued = false;
      scan();
    });
  }

  injectStyles();
  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
  scheduleScan();
})();
