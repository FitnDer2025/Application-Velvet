(() => {
  if (!location.pathname.startsWith('/membres')) return;

  const content = document.querySelector('#content');
  if (!content) return;

  let currentEventId = '';
  let loading = false;
  let renderQueued = false;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
    node.classList.add('visible');
    window.setTimeout(() => node.classList.remove('visible'), 3600);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  }

  function eventIdFromPage() {
    return document.querySelector('#eventRegistrationForm')?.dataset.eventId
      || document.querySelector('[data-cancel-event]')?.getAttribute('data-cancel-event')
      || '';
  }

  function statusCopy(status) {
    if (status === 'confirmed') return { title: 'Réservation confirmée', detail: 'Ta place est enregistrée pour cette sortie.' };
    if (status === 'pending') return { title: 'Demande envoyée', detail: 'L’organisateur doit encore valider ta participation.' };
    if (status === 'waitlisted') return { title: 'Liste d’attente', detail: 'La sortie est complète. Zwit te fera remonter automatiquement lorsqu’une place se libère.' };
    if (status === 'checked_in') return { title: 'Présence confirmée', detail: 'Ton arrivée a été validée sur place.' };
    return { title: 'Envie de participer ?', detail: 'Réserve directement depuis Zwit.' };
  }

  function capacityMarkup(booking) {
    const capacity = booking?.capacity;
    const finiteCapacity = capacity !== null && capacity !== undefined && Number.isFinite(Number(capacity));
    if (!finiteCapacity) {
      return '<div class="zwit-booking-capacity"><span>Disponibilité</span><strong>Places ouvertes</strong><small>Pas de limite annoncée par l’organisateur.</small></div>';
    }
    const reserved = number(booking.occupied_places) + number(booking.pending_places);
    const remaining = Math.max(0, number(booking.places_remaining));
    const ratio = Math.min(100, Math.round((reserved / Math.max(1, number(capacity))) * 100));
    return `<div class="zwit-booking-capacity">
      <span>Disponibilité</span>
      <strong>${remaining > 0 ? `${remaining} place${remaining > 1 ? 's' : ''} encore disponible${remaining > 1 ? 's' : ''}` : 'Complet · liste d’attente ouverte'}</strong>
      <div class="zwit-booking-meter" aria-label="${ratio}% des places réservées"><i style="width:${ratio}%"></i></div>
      <small>${reserved} / ${number(capacity)} place${number(capacity) > 1 ? 's' : ''} engagée${reserved > 1 ? 's' : ''}${number(booking.waitlisted_places) ? ` · ${number(booking.waitlisted_places)} en attente` : ''}</small>
    </div>`;
  }

  function placesOptions(maxPlaces, selected = 1) {
    const max = Math.max(1, Math.min(12, number(maxPlaces) || 4));
    return Array.from({ length: max }, (_, index) => index + 1)
      .map((value) => `<option value="${value}"${value === selected ? ' selected' : ''}>${value} place${value > 1 ? 's' : ''}</option>`)
      .join('');
  }

  function bookingForm(eventId, payload) {
    const booking = payload.booking || {};
    const event = payload.event || {};
    const registrationsOpen = event.registration_open !== false
      && booking.registration_open !== false
      && booking.registration_mode !== 'closed'
      && (!booking.registration_closes_at || new Date(booking.registration_closes_at).getTime() > Date.now());

    if (!registrationsOpen) {
      return '<div class="zwit-booking-closed"><strong>Inscriptions closes</strong><span>La guest-list reste consultable lorsqu’elle est activée par l’organisateur.</span></div>';
    }

    const approval = booking.registration_mode === 'approval';
    return `<form class="zwit-booking-form" data-zwit-booking-form data-event-id="${escapeHtml(eventId)}">
      <div class="zwit-booking-form-grid">
        <label><span>Nombre de places</span><select name="places">${placesOptions(booking.max_places_per_registration)}</select></label>
        <div class="zwit-booking-mode"><span>Confirmation</span><strong>${approval ? 'Après validation' : 'Immédiate si disponible'}</strong></div>
      </div>
      <label class="zwit-booking-visibility"><input type="checkbox" name="visible" checked><span><strong>Apparaître aux participants</strong><small>Ton profil sera visible dans la guest-list uniquement après confirmation.</small></span></label>
      <button class="primary zwit-booking-primary" type="submit">${number(booking.places_remaining) === 0 && booking.capacity !== null ? 'Rejoindre la liste d’attente' : approval ? 'Demander à participer' : 'Réserver'}</button>
    </form>`;
  }

  function myBookingMarkup(eventId, registration) {
    const copy = statusCopy(registration.status);
    const cancellable = ['pending', 'confirmed', 'waitlisted'].includes(registration.status);
    return `<div class="zwit-booking-current" data-status="${escapeHtml(registration.status)}">
      <div class="zwit-booking-status-icon" aria-hidden="true">${registration.status === 'waitlisted' ? '◷' : registration.status === 'checked_in' ? '✓' : '◇'}</div>
      <div><strong>${escapeHtml(copy.title)}</strong><p>${escapeHtml(copy.detail)}</p><small>${number(registration.places)} place${number(registration.places) > 1 ? 's' : ''}${registration.visibleToParticipants ? ' · profil visible aux participants' : ' · profil discret'}</small></div>
      ${cancellable ? `<button type="button" class="secondary" data-zwit-booking-cancel="${escapeHtml(eventId)}">Annuler</button>` : ''}
    </div>`;
  }

  function participationMarkup(eventId, payload) {
    const mine = payload.myRegistration;
    return `<article class="card section zwit-booking-card" data-zwit-booking-card>
      <div class="zwit-booking-heading"><div><p class="eyebrow">RÉSERVATION ZWIT</p><h2>${escapeHtml(statusCopy(mine?.status).title)}</h2><p>${escapeHtml(statusCopy(mine?.status).detail)}</p></div><span class="zwit-booking-seal" aria-hidden="true">Z</span></div>
      ${capacityMarkup(payload.booking)}
      ${mine ? myBookingMarkup(eventId, mine) : bookingForm(eventId, payload)}
      <p class="zwit-booking-privacy">Réservation privée : Zwit ne montre jamais ton identité de compte aux autres participants.</p>
    </article>`;
  }

  function participantCard(profile) {
    return `<button type="button" class="zwit-booking-person" data-open-profile="${escapeHtml(profile.profileId)}">
      <span class="zwit-booking-person-media">${profile.photoUrl
        ? `<img src="${escapeHtml(profile.photoUrl)}" alt="" loading="lazy" decoding="async">`
        : '<span aria-hidden="true">Z</span>'}</span>
      <span><strong>${escapeHtml(profile.displayName || 'Membre Zwit')}</strong><small>${escapeHtml([profile.profileType === 'couple' ? 'Couple' : 'Membre', profile.locationZone].filter(Boolean).join(' · '))}</small></span>
    </button>`;
  }

  function participantsMarkup(payload) {
    const participants = Array.isArray(payload.participants) ? payload.participants : [];
    if (payload.participantProfilesVisible === false) {
      return `<section class="zwit-booking-guests" data-zwit-booking-guests><div class="zwit-booking-guests-head"><p class="eyebrow">GUEST-LIST</p><h2>Participants discrets</h2><p>L’organisateur a choisi de ne pas afficher la liste des profils.</p></div></section>`;
    }
    return `<section class="zwit-booking-guests" data-zwit-booking-guests>
      <div class="zwit-booking-guests-head"><div><p class="eyebrow">GUEST-LIST</p><h2>Ils ont choisi d’être visibles</h2><p>Uniquement les réservations confirmées avec accord explicite.</p></div><strong>${participants.length}</strong></div>
      ${participants.length ? `<div class="zwit-booking-people">${participants.map(participantCard).join('')}</div>` : '<div class="zwit-booking-empty">Les premiers profils apparaîtront ici après confirmation de leur réservation.</div>'}
    </section>`;
  }

  function hideLegacyParticipantSection() {
    [...content.querySelectorAll('section')].forEach((section) => {
      if (section.hasAttribute('data-zwit-booking-guests')) return;
      const copy = section.textContent || '';
      if (copy.includes('Participants visibles') || copy.includes('Aucun participant visible') || copy.includes('Communauté de la sortie')) {
        section.hidden = true;
        section.dataset.zwitLegacyParticipants = 'hidden';
      }
    });
  }

  function renderPayload(eventId, payload) {
    const legacyForm = content.querySelector('#eventRegistrationForm');
    const legacyCancel = content.querySelector('[data-cancel-event]');
    const host = legacyForm?.closest('article') || legacyCancel?.closest('article') || content.querySelector('.grid.two article:nth-child(2)');
    if (!host) return;
    host.outerHTML = participationMarkup(eventId, payload);
    hideLegacyParticipantSection();
    const grid = content.querySelector('.grid.two');
    const oldGuests = content.querySelector('[data-zwit-booking-guests]');
    if (oldGuests) oldGuests.remove();
    grid?.insertAdjacentHTML('afterend', participantsMarkup(payload));
  }

  async function load(eventId, { force = false } = {}) {
    if (!eventId || loading) return;
    if (!force && currentEventId === eventId && content.querySelector('[data-zwit-booking-card]')) return;
    loading = true;
    currentEventId = eventId;
    try {
      const payload = await api(`/api/members/event-registrations?eventId=${encodeURIComponent(eventId)}`);
      renderPayload(eventId, payload);
    } catch (error) {
      // La fiche historique reste utilisable si la migration v1.5 n'est pas encore appliquée.
      console.warn('Zwit booking v1.5 unavailable', error.message);
    } finally {
      loading = false;
    }
  }

  async function submitBooking(form) {
    const eventId = form.dataset.eventId;
    const data = new FormData(form);
    const button = form.querySelector('[type=submit]');
    if (button) button.disabled = true;
    try {
      const result = await api('/api/members/event-registrations', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          places: number(data.get('places')) || 1,
          visibleToParticipants: data.has('visible')
        })
      });
      const status = result.registration?.status;
      toast(status === 'waitlisted'
        ? 'Sortie complète : ta place est conservée dans la liste d’attente.'
        : status === 'pending'
          ? 'Demande envoyée à l’organisateur.'
          : 'Réservation confirmée.');
      currentEventId = '';
      await load(eventId, { force: true });
    } catch (error) {
      toast(error.message === 'registrations_closed' ? 'Les inscriptions sont closes.' : 'La réservation n’a pas pu être enregistrée.', true);
      if (button) button.disabled = false;
    }
  }

  async function cancelBooking(eventId, button) {
    if (button) button.disabled = true;
    try {
      await api('/api/members/event-registrations', {
        method: 'POST',
        body: JSON.stringify({ eventId, action: 'cancel' })
      });
      toast('Ta réservation est annulée. Une place peut maintenant être proposée à la liste d’attente.');
      currentEventId = '';
      await load(eventId, { force: true });
    } catch {
      toast('La réservation n’a pas pu être annulée.', true);
      if (button) button.disabled = false;
    }
  }

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-zwit-booking-form], #eventRegistrationForm');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submitBooking(form);
  }, true);

  document.addEventListener('click', (event) => {
    const cancel = event.target.closest('[data-zwit-booking-cancel], [data-cancel-event]');
    if (!cancel) return;
    const eventId = cancel.getAttribute('data-zwit-booking-cancel') || cancel.getAttribute('data-cancel-event');
    if (!eventId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelBooking(eventId, cancel);
  }, true);

  const observer = new MutationObserver(() => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const eventId = eventIdFromPage();
      if (eventId) load(eventId);
      else currentEventId = '';
    });
  });
  observer.observe(content, { childList: true, subtree: true });
  const initialEventId = eventIdFromPage();
  if (initialEventId) load(initialEventId);
})();
