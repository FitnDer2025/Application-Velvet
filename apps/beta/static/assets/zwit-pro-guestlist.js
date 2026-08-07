(() => {
  if (!location.pathname.startsWith('/pro')) return;

  const host = document.querySelector('.content') || document.querySelector('#content');
  if (!host) return;

  let loading = false;
  let cache = null;
  let lastLoadedAt = 0;
  let selectedEventId = '';
  let renderQueued = false;

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

  function toast(message, error = false) {
    const node = document.querySelector('#toast') || document.querySelector('.toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
    node.classList.add('show');
    window.setTimeout(() => node.classList.remove('show'), 3200);
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
      <div class="zpg-head"><div><span>PILOTAGE RÉEL · V1.5</span><h2>Guest-list & accueil</h2><p>Une seule file, de la demande au check-in. La capacité est verrouillée côté serveur.</p></div><select data-zpg-event>${events.map(eventOption).join('')}</select></div>
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
    const button = event.target.closest('[data-v15-reg-action]');
    if (!button) return;
    setRegistrationStatus(button.dataset.registrationId, button.dataset.v15RegAction, button);
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
