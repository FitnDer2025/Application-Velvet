(() => {
  if (!location.pathname.startsWith('/pro')) return;

  const host = document.querySelector('.content') || document.querySelector('#content');
  if (!host) return;

  let loading = false;
  let cache = null;
  let lastLoadedAt = 0;
  let selectedEventId = '';
  let renderQueued = false;
  let qrRefreshTimer = null;
  let qrCountdownTimer = null;

  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const rows = (value) => Array.isArray(value) ? value : [];
  const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  async function api(options = {}) {
    const response = await fetch('/api/pro/workspace', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: options.body ? { 'content-type': 'application/json' } : {},
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'pro_workspace_failed');
    return payload;
  }

  async function checkinApi(options = {}) {
    const response = await fetch('/api/pro/check-in', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: options.body ? { 'content-type': 'application/json' } : {},
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'checkin_session_failed');
    return payload;
  }

  function toast(message, error = false) {
    const node = document.querySelector('#toast') || document.querySelector('.toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
    node.classList.add('show');
    window.setTimeout(() => node.classList.remove('show'), 3200);
  }

  function ensureQrRuntime() {
    if (window.ZwitQRV4) return Promise.resolve(window.ZwitQRV4);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-zwit-qr-v4]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.ZwitQRV4), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = '/assets/zwit-qr-v4.js?v=20260807-1';
      script.dataset.zwitQrV4 = '1';
      script.onload = () => resolve(window.ZwitQRV4);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function activeVenueId(data) {
    const select = document.querySelector('#venueSelect, .venue-switch select');
    const selected = select?.value;
    if (selected && rows(data.venues).some((venue) => venue.id === selected)) return selected;
    return rows(data.venues)[0]?.id || '';
  }

  function eventRows(data) {
    const venueId = activeVenueId(data);
    return rows(data.events).filter((event) => event.establishment_id === venueId);
  }

  function eventRegistrations(data, eventId) {
    return rows(data.registrations).filter((registration) => registration.event_id === eventId);
  }

  function status(row) {
    return row.registration_status || row.status || 'pending';
  }

  function statusLabel(value) {
    return ({ pending: 'À valider', confirmed: 'Confirmé', waitlisted: 'Attente', checked_in: 'Présent', declined: 'Refusé' })[value] || value;
  }

  function statusTone(value) {
    return ({ pending: 'pending', confirmed: 'confirmed', waitlisted: 'waitlisted', checked_in: 'checkedin', declined: 'declined' })[value] || 'neutral';
  }

  function capacity(event, registrations) {
    const engaged = registrations
      .filter((row) => ['pending', 'confirmed', 'checked_in'].includes(status(row)))
      .reduce((sum, row) => sum + n(row.places), 0);
    const confirmed = registrations
      .filter((row) => ['confirmed', 'checked_in'].includes(status(row)))
      .reduce((sum, row) => sum + n(row.places), 0);
    const waiting = registrations
      .filter((row) => status(row) === 'waitlisted')
      .reduce((sum, row) => sum + n(row.places), 0);
    const total = n(event.capacity);
    return { engaged, confirmed, waiting, total, remaining: Math.max(0, total - engaged) };
  }

  function eventOption(event) {
    const date = new Date(event.starts_at);
    return `<option value="${e(event.id)}"${selectedEventId === event.id ? ' selected' : ''}>${e(event.title)} · ${date.toLocaleDateString('fr-FR')}</option>`;
  }

  function registrationActions(row) {
    const value = status(row);
    if (value === 'pending') return `<button data-v15-reg-action="confirmed" data-registration-id="${e(row.registration_id)}">Confirmer</button><button class="secondary" data-v15-reg-action="declined" data-registration-id="${e(row.registration_id)}">Refuser</button>`;
    if (value === 'waitlisted') return `<button data-v15-reg-action="confirmed" data-registration-id="${e(row.registration_id)}">Confirmer si place</button><button class="secondary" data-v15-reg-action="declined" data-registration-id="${e(row.registration_id)}">Retirer</button>`;
    if (value === 'confirmed') return `<button data-v15-reg-action="checked_in" data-registration-id="${e(row.registration_id)}">Valider l’arrivée</button><button class="secondary" data-v15-reg-action="waitlisted" data-registration-id="${e(row.registration_id)}">Mettre en attente</button>`;
    if (value === 'checked_in') return '<span class="zpg-arrived">✓ Arrivée validée</span>';
    return '';
  }

  function guestRow(row) {
    const name = row.display_name || 'Membre Zwit';
    const meta = [row.profile_type === 'couple' ? 'Couple' : 'Membre', row.location_zone].filter(Boolean).join(' · ');
    return `<div class="zpg-person" data-status="${e(status(row))}">
      <div class="zpg-person-avatar" aria-hidden="true">${e(name.split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase() || 'Z')}</div>
      <div class="zpg-person-copy"><strong>${e(name)}</strong><small>${e(meta)} · ${n(row.places)} place${n(row.places) > 1 ? 's' : ''}</small></div>
      <span class="zpg-status ${e(statusTone(status(row)))}">${e(statusLabel(status(row)))}</span>
      <div class="zpg-actions">${registrationActions(row)}</div>
    </div>`;
  }

  function settingsMarkup(event) {
    const closure = event.registration_closes_at
      ? new Date(event.registration_closes_at).toISOString().slice(0, 16)
      : '';
    return `<details class="zpg-settings">
      <summary>Réglages de réservation</summary>
      <form data-zpg-settings-form data-event-id="${e(event.id)}" data-venue-id="${e(event.establishment_id)}">
        <label><span>Validation</span><select name="registration_mode"><option value="instant"${event.registration_mode !== 'approval' && event.registration_mode !== 'closed' ? ' selected' : ''}>Instantanée</option><option value="approval"${event.registration_mode === 'approval' ? ' selected' : ''}>Validation manuelle</option><option value="closed"${event.registration_mode === 'closed' ? ' selected' : ''}>Inscriptions fermées</option></select></label>
        <label><span>Clôture</span><input type="datetime-local" name="registration_closes_at" value="${e(closure)}"></label>
        <label><span>Places max / réservation</span><input type="number" min="1" max="12" name="max_places_per_registration" value="${Math.max(1, n(event.max_places_per_registration) || 4)}"></label>
        <label class="zpg-check"><input type="checkbox" name="guest_list_enabled"${event.guest_list_enabled !== false ? ' checked' : ''}><span>Afficher la guest-list aux participants volontaires</span></label>
        <label class="zpg-check"><input type="checkbox" name="registration_open"${event.registration_open !== false && event.registration_mode !== 'closed' ? ' checked' : ''}><span>Accepter de nouvelles inscriptions</span></label>
        <button type="submit">Enregistrer</button>
      </form>
    </details>`;
  }

  function cockpit(data) {
    const events = eventRows(data);
    if (!events.length) {
      return `<section class="zpg-cockpit" data-zpg-cockpit><div class="zpg-head"><div><span>GUEST-LIST V1.5</span><h2>Aucune soirée à piloter</h2><p>Crée une soirée pour ouvrir son parcours de réservation.</p></div></div></section>`;
    }
    if (!events.some((event) => event.id === selectedEventId)) selectedEventId = events[0].id;
    const event = events.find((item) => item.id === selectedEventId) || events[0];
    const registrations = eventRegistrations(data, event.id);
    const stats = capacity(event, registrations);
    const pending = registrations.filter((row) => status(row) === 'pending').length;
    const confirmed = registrations.filter((row) => status(row) === 'confirmed').length;
    const waiting = registrations.filter((row) => status(row) === 'waitlisted').length;
    const checkedIn = registrations.filter((row) => status(row) === 'checked_in').length;

    return `<section class="zpg-cockpit" data-zpg-cockpit>
      <div class="zpg-head"><div><span>PILOTAGE RÉEL · V1.5</span><h2>Guest-list & accueil</h2><p>Une seule file, de la demande au check-in. La capacité est verrouillée côté serveur.</p></div><div class="zpg-head-actions"><select data-zpg-event>${events.map(eventOption).join('')}</select><button type="button" data-zpg-open-qr="${e(event.id)}">QR d’entrée</button></div></div>
      <div class="zpg-kpis"><article><small>Engagées</small><strong>${stats.engaged}<i> / ${stats.total}</i></strong></article><article><small>À valider</small><strong>${pending}</strong></article><article><small>Confirmés</small><strong>${confirmed}</strong></article><article><small>Attente</small><strong>${waiting}</strong></article><article><small>Présents</small><strong>${checkedIn}</strong></article></div>
      <div class="zpg-capacity"><div><strong>${stats.remaining} place${stats.remaining > 1 ? 's' : ''} disponible${stats.remaining > 1 ? 's' : ''}</strong><small>${stats.waiting ? `${stats.waiting} place${stats.waiting > 1 ? 's' : ''} en attente` : 'Aucune attente'}</small></div><div class="zpg-meter"><i style="width:${Math.min(100, Math.round((stats.engaged / Math.max(1, stats.total)) * 100))}%"></i></div></div>
      ${settingsMarkup(event)}
      <div class="zpg-list">${registrations.length ? registrations.map(guestRow).join('') : '<div class="zpg-empty">Aucune réservation enregistrée pour cette soirée.</div>'}</div>
    </section>`;
  }

  async function load({ force = false } = {}) {
    if (loading) return;
    if (!force && cache && Date.now() - lastLoadedAt < 10000) return cache;
    loading = true;
    try {
      cache = await api();
      lastLoadedAt = Date.now();
      return cache;
    } finally {
      loading = false;
    }
  }

  function bookingPageVisible() {
    return [...host.querySelectorAll('h1')].some((title) => title.textContent.trim() === 'Réservations');
  }

  async function render(force = false) {
    if (!bookingPageVisible()) return;
    try {
      const data = await load({ force });
      const old = host.querySelector('[data-zpg-cockpit]');
      if (old) old.outerHTML = cockpit(data);
      else host.insertAdjacentHTML('beforeend', cockpit(data));
    } catch (error) {
      console.warn('Zwit Pro guest-list unavailable', error.message);
    }
  }

  async function setRegistrationStatus(registrationId, nextStatus, button) {
    button.disabled = true;
    try {
      await api({
        method: 'POST',
        body: JSON.stringify({ action: 'registration_status', registrationId, status: nextStatus })
      });
      cache = null;
      toast(nextStatus === 'checked_in' ? 'Arrivée validée.' : nextStatus === 'confirmed' ? 'Réservation confirmée.' : nextStatus === 'declined' ? 'Demande refusée.' : 'Réservation placée en attente.');
      await render(true);
    } catch (error) {
      toast(error.message === 'event_capacity_reached' ? 'Capacité atteinte : cette réservation reste en attente.' : 'La décision n’a pas pu être enregistrée.', true);
      button.disabled = false;
    }
  }

  async function saveSettings(form) {
    const data = new FormData(form);
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      await api({
        method: 'POST',
        body: JSON.stringify({
          action: 'update_event_booking',
          venueId: form.dataset.venueId,
          eventId: form.dataset.eventId,
          settings: {
            registration_mode: data.get('registration_mode'),
            registration_closes_at: data.get('registration_closes_at') || null,
            max_places_per_registration: n(data.get('max_places_per_registration')) || 4,
            guest_list_enabled: data.has('guest_list_enabled'),
            registration_open: data.has('registration_open')
          }
        })
      });
      cache = null;
      toast('Réglages de réservation enregistrés.');
      await render(true);
    } catch (error) {
      toast(error.message === 'invalid_registration_closure' ? 'La clôture doit être antérieure au début de la soirée.' : 'Les réglages n’ont pas pu être enregistrés.', true);
      button.disabled = false;
    }
  }

  function clearQrTimers() {
    if (qrRefreshTimer) window.clearTimeout(qrRefreshTimer);
    if (qrCountdownTimer) window.clearInterval(qrCountdownTimer);
    qrRefreshTimer = null;
    qrCountdownTimer = null;
  }

  function closeQr() {
    clearQrTimers();
    document.querySelector('[data-zpg-qr-modal]')?.remove();
  }

  function updateCountdown(modal, expiresAt) {
    const target = modal.querySelector('[data-zpg-qr-countdown]');
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      if (target) target.textContent = `Renouvellement sécurisé dans ${seconds}s`;
    };
    tick();
    qrCountdownTimer = window.setInterval(tick, 1000);
  }

  async function refreshQr(eventId, modal) {
    const qr = await ensureQrRuntime();
    const payload = await checkinApi({
      method: 'POST',
      body: JSON.stringify({ eventId, ttlSeconds: 120 })
    });
    const checkin = payload.checkin;
    if (!checkin?.qrPayload || !qr) throw new Error('qr_payload_missing');
    const image = modal.querySelector('[data-zpg-qr-image]');
    const title = modal.querySelector('[data-zpg-qr-title]');
    if (image) image.src = qr.dataUrl(checkin.qrPayload);
    if (title) title.textContent = checkin.eventTitle || 'Entrée Zwit';
    modal.dataset.browserLink = checkin.checkinUrl || '';
    clearQrTimers();
    updateCountdown(modal, checkin.expiresAt);
    const delay = Math.max(30000, new Date(checkin.expiresAt).getTime() - Date.now() - 25000);
    qrRefreshTimer = window.setTimeout(() => refreshQr(eventId, modal).catch(() => closeQr()), delay);
  }

  async function openQr(eventId) {
    closeQr();
    const modal = document.createElement('div');
    modal.className = 'zpg-qr-modal';
    modal.dataset.zpgQrModal = '1';
    modal.innerHTML = `<div class="zpg-qr-panel"><button type="button" class="zpg-qr-close" data-zpg-close-qr aria-label="Fermer">×</button><span>ACCUEIL ZWIT · QR TOURNANT</span><h2 data-zpg-qr-title>Préparation du QR…</h2><p>Le membre ouvre Zwit et scanne ce code. Seules les réservations confirmées peuvent valider leur présence.</p><div class="zpg-qr-frame"><img data-zpg-qr-image alt="QR de check-in Zwit"><div class="zpg-qr-loading">Génération sécurisée…</div></div><strong data-zpg-qr-countdown>Connexion…</strong><small>Le code change automatiquement. Le précédent devient inutilisable.</small><button type="button" class="zpg-qr-browser" data-zpg-copy-checkin>Copier le lien navigateur</button></div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('visible'));
    try {
      await refreshQr(eventId, modal);
      modal.querySelector('.zpg-qr-loading')?.remove();
    } catch (error) {
      modal.querySelector('.zpg-qr-loading').textContent = error.message === 'checkin_too_early' ? 'Le QR ouvrira à l’approche de la soirée.' : 'QR momentanément indisponible.';
    }
  }

  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-zpg-event]');
    if (!select) return;
    selectedEventId = select.value;
    const data = cache;
    if (data) {
      const old = host.querySelector('[data-zpg-cockpit]');
      if (old) old.outerHTML = cockpit(data);
    }
  });

  document.addEventListener('click', (event) => {
    const registrationButton = event.target.closest('[data-v15-reg-action]');
    if (registrationButton) {
      setRegistrationStatus(registrationButton.dataset.registrationId, registrationButton.dataset.v15RegAction, registrationButton);
      return;
    }
    const qrButton = event.target.closest('[data-zpg-open-qr]');
    if (qrButton) {
      openQr(qrButton.dataset.zpgOpenQr);
      return;
    }
    if (event.target.closest('[data-zpg-close-qr]') || (event.target.matches('[data-zpg-qr-modal]'))) {
      closeQr();
      return;
    }
    const copy = event.target.closest('[data-zpg-copy-checkin]');
    if (copy) {
      const link = copy.closest('[data-zpg-qr-modal]')?.dataset.browserLink;
      if (!link) return;
      navigator.clipboard?.writeText(link).then(() => toast('Lien de check-in copié.')).catch(() => toast('Impossible de copier le lien.', true));
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-zpg-settings-form]');
    if (!form) return;
    event.preventDefault();
    saveSettings(form);
  });

  const observer = new MutationObserver(() => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      if (bookingPageVisible() && !host.querySelector('[data-zpg-cockpit]')) render();
    });
  });
  observer.observe(host, { childList: true, subtree: true });
  render();
})();
