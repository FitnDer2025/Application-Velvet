(() => {
  const api = async (options = {}) => {
    const response = await fetch('/api/pro/workspace', {
      credentials: 'same-origin',
      headers: options.body ? { 'content-type': 'application/json' } : {},
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'pro_workspace_failed');
    return payload;
  };
  const kindLabel = { club: 'Club privé', spa: 'Spa privé', bar: 'Bar libertin', love_room: 'Love room', other: 'Autre lieu' };
  const kindValue = { 'Club privé': 'club', 'Spa privé': 'spa', 'Bar libertin': 'bar', 'Love room': 'love_room' };
  const avatar = (name) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="100%" height="100%" fill="#471629"/><text x="50%" y="55%" text-anchor="middle" fill="#d5b477" font-size="42" font-family="serif">${String(name || 'V').split(/\s+/).map((x) => x[0]).join('').slice(0, 2)}</text></svg>`)}`;
  let workspace = null;
  menu.splice(0, menu.length, ...menu.filter((item) => ['dashboard', 'venue', 'events', 'bookings'].includes(item[0])));
  localStorage.removeItem('velvetProCrmV1');

  function venueInput() {
    return {
      name: veName.value.trim(),
      kind: kindValue[veType.value] || 'other',
      description: veDesc.value.trim(),
      city: veCity.value.trim(),
      address_public: veAddress.value.trim(),
      phone_public: vePhone.value.trim(),
      email_public: veEmail.value.trim(),
      opening_hours: { public: veHours.value.trim() },
      amenities: veEquipment.value.split(',').map((item) => item.trim()).filter(Boolean)
    };
  }

  function hydrate(data) {
    workspace = data;
    const registrationByEvent = new Map();
    data.registrations.forEach((row) => {
      const group = registrationByEvent.get(row.event_id) || [];
      group.push(row);
      registrationByEvent.set(row.event_id, group);
    });
    S.venues = data.venues.map((row) => ({
      id: row.id, name: row.name, type: kindLabel[row.kind] || row.kind, city: row.city || '',
      hero: row.kind === 'spa' ? IMG.spa : row.kind === 'love_room' ? IMG.room : IMG.club,
      status: row.visibility, description: row.description || '', address: row.address_public || '',
      phone: row.phone_public || '', email: row.email_public || '',
      hours: row.opening_hours?.public || Object.values(row.opening_hours || {}).join(' · '),
      equipment: row.amenities || [],
      views: 0,
      subscription: row.subscription_status || 'inactive'
    }));
    S.events = data.events.map((row) => {
      const registrations = registrationByEvent.get(row.id) || [];
      const date = new Date(row.starts_at);
      return {
        id: row.id, venue: row.establishment_id, name: row.title, date: row.starts_at,
        day: String(date.getDate()).padStart(2, '0'),
        month: date.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase(),
        audience: row.audience || 'Membres Zwit', capacity: row.capacity,
        booked: registrations.filter((item) => !['cancelled', 'declined'].includes(item.registration_status)).reduce((sum, item) => sum + item.places, 0),
        price: Number(row.price_cents || 0) / 100, revenue: 0, status: row.visibility,
        description: row.description || ''
      };
    });
    const uniqueProfiles = [...new Map(data.registrations.filter((row) => row.profile_id).map((row) => [row.profile_id, row])).values()];
    MEMBERS.splice(0, MEMBERS.length, ...uniqueProfiles.map((row) => ({
      id: row.profile_id, name: row.display_name || 'Membre Zwit',
      type: row.profile_type === 'couple' ? 'Couple' : 'Individuel',
      city: row.location_zone || 'Zone privée', img: avatar(row.display_name),
      trust: '—', visits: 0, spend: 0, last: 'Inscription récente', tags: ['Participant'], note: ''
    })));
    S.bookings = data.registrations.map((row) => ({
      id: row.registration_id, event: row.event_id, member: row.profile_id,
      people: row.places, total: 0,
      payment: row.registration_status === 'declined' ? 'refunded' : 'pending',
      checkin: row.registration_status === 'checked_in',
      date: new Date(row.registered_at).toLocaleDateString('fr-FR')
    })).filter((row) => row.member);
    S.threads = [];
    S.drafts = Object.fromEntries(data.drafts.map((draft) => [draft.establishment_id, {
      ...S.venues.find((venue) => venue.id === draft.establishment_id),
      name: draft.payload.name,
      type: kindLabel[draft.payload.kind] || 'Autre lieu',
      description: draft.payload.description || '',
      city: draft.payload.city || '',
      address: draft.payload.address_public || '',
      phone: draft.payload.phone_public || '',
      email: draft.payload.email_public || '',
      hours: draft.payload.opening_hours?.public || '',
      equipment: draft.payload.amenities || [],
      status: 'draft'
    }]));
    S.activeVenue = S.venues.some((venue) => venue.id === S.activeVenue) ? S.activeVenue : S.venues[0]?.id;
  }

  function neutral(title, text) {
    return `<section class="card" style="max-width:760px;margin:8vh auto"><div class="ey">Zwit Pro connecté</div><h1>${esc(title)}</h1><p class="lead">${esc(text)}</p></section>`;
  }

  function proPaywall() {
    const prices = workspace?.billingPrices || [];
    return `<section class="card" style="max-width:820px;margin:8vh auto;background:radial-gradient(circle at 92% 0,rgba(213,180,119,.16),transparent 38%),var(--panel)">
      <div class="ey">Zwit Pro · un établissement</div><h1>Activez votre espace professionnel</h1>
      <p class="lead">La fiche factuelle reste visible gratuitement. La gestion de la page, les événements et le CRM sont inclus dans Zwit Pro, sans commission sur les soirées au lancement.</p>
      <div class="grid g2" style="margin:24px 0">${prices.map((price) => `<button class="btn secondary" data-pro-checkout="${esc(price.price_code)}" style="display:grid;gap:5px;padding:18px"><b style="font-size:22px">${esc((Number(price.amount_cents) / 100).toLocaleString('fr-FR', { style: 'currency', currency: price.currency }))}</b><small>${price.interval_unit === 'year' ? 'par an' : 'par mois'}</small></button>`).join('')}</div>
      <small>Le module est prêt. Le paiement s’ouvrira après validation écrite du partenaire bancaire spécialisé.</small>
    </section>`;
  }

  async function startProCheckout(priceCode, button) {
    button.disabled = true;
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priceCode, establishmentId: venue()?.id })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'billing_checkout_failed');
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
    } catch (error) {
      toastMsg(error.message === 'billing_provider_not_configured'
        ? 'Le paiement sera ouvert après validation du partenaire bancaire.'
        : 'Le paiement est momentanément indisponible.');
      button.disabled = false;
    }
  }

  async function reload() {
    workspace = await api();
    hydrate(workspace);
    document.body.classList.remove('pro-live-pending');
    if (!S.venues.length) {
      content.innerHTML = neutral('Aucun établissement attribué', 'Votre compte Pro est actif, mais aucun établissement ne lui est encore rattaché. Zwit Control doit valider le lieu et vous attribuer un rôle avant l’ouverture du CRM.');
      venueSelect.innerHTML = '<option>Aucun établissement</option>';
      return;
    }
    if (!['trial', 'active'].includes(venue().subscription)) {
      content.innerHTML = proPaywall();
      content.querySelectorAll('[data-pro-checkout]').forEach((button) => button.addEventListener('click', () =>
        startProCheckout(button.dataset.proCheckout, button)
      ));
      return;
    }
    render();
  }

  dashboard = () => {
    const events = venueEvents();
    const registrations = S.bookings.filter((booking) => events.some((event) => event.id === booking.event));
    return `<div class="ey">Pilotage réel · Supabase</div><h1>${esc(venue().name)}</h1><p class="lead">Cette vue ne contient plus aucune donnée de démonstration.</p>
      <div class="kpis"><div class="kpi"><small>Soirées</small><b>${events.length}</b></div><div class="kpi"><small>À venir</small><b>${events.filter((item) => new Date(item.date) >= new Date()).length}</b></div><div class="kpi"><small>Inscriptions</small><b>${registrations.length}</b></div><div class="kpi"><small>Places réservées</small><b>${registrations.reduce((sum, item) => sum + item.people, 0)}</b></div><div class="kpi"><small>Fiche publique</small><b>${venue().status === 'published' ? 'Active' : 'Brouillon'}</b></div></div>
      <div class="section-head"><div><h2>Agenda</h2><p>Événements enregistrés dans la mémoire Velvet.</p></div><button class="btn" onclick="openEventModal()">Créer une soirée</button></div>${eventCards(events)}`;
  };
  membersPage = () => neutral('CRM membres en construction', 'Seuls les membres réellement inscrits à vos soirées seront visibles ici. Les segments et notes serveur arrivent dans le lot suivant.');
  messagesPage = () => neutral('Messagerie Pro en construction', 'Le raccordement aux conversations réelles sera activé sans conserver les anciens échanges fictifs.');
  financePage = () => neutral('Paiements non raccordés', 'Aucun chiffre financier artificiel n’est présenté. Ce module sera ouvert avec le futur prestataire de paiement.');
  const prototypeGo = go;
  go = (next) => {
    if (venue() && !['trial', 'active'].includes(venue().subscription)) {
      content.innerHTML = neutral('Abonnement Zwit Pro requis', 'La fiche référencée reste consultable par les membres, mais seules les entreprises abonnées peuvent publier des soirées, des photos ou modifier leur mini-site.');
      return;
    }
    prototypeGo(next);
  };
  changeVenue = async (id) => {
    S.activeVenue = id;
    await reload();
  };

  saveVenueDraft = async () => {
    await api({ method: 'POST', body: JSON.stringify({ action: 'save_venue_draft', venueId: S.activeVenue, venue: venueInput() }) });
    await reload(); toastMsg('Brouillon enregistré dans Supabase');
  };
  previewVenueDraft = async () => { await saveVenueDraft(); openPublicPreview(true); };
  publishVenue = async () => {
    await api({ method: 'POST', body: JSON.stringify({ action: 'publish_venue', venueId: S.activeVenue, venue: venueInput() }) });
    await reload(); toastMsg('Fiche publiée sur Zwit Membres');
  };
  createEvent = async (status) => {
    if (!evName.value.trim() || !evDate.value || Number(evCapacity.value) < 2) return toastMsg('Complétez le nom, la date et la capacité');
    await api({ method: 'POST', body: JSON.stringify({
      action: 'create_event', venueId: S.activeVenue,
      event: { title: evName.value, starts_at: evDate.value, capacity: Number(evCapacity.value), price: Number(evPrice.value), audience: evAudience.value, visibility: status, description: evDesc.value, location_public: venue().address }
    }) });
    closeEventModal(); await reload(); go('events'); toastMsg(status === 'published' ? 'Soirée publiée sur Zwit' : 'Brouillon enregistré');
  };
  toggleCheckin = async (id) => {
    const booking = S.bookings.find((item) => item.id === id);
    await api({ method: 'POST', body: JSON.stringify({ action: 'registration_status', registrationId: id, status: booking.checkin ? 'confirmed' : 'checked_in' }) });
    await reload(); go('bookings'); toastMsg(booking.checkin ? 'Check-in annulé' : 'Arrivée validée');
  };

  reload().catch((error) => {
    document.body.classList.remove('pro-live-pending');
    content.innerHTML = neutral(error.message === 'pro_access_required' ? 'Accès Pro nécessaire' : 'Connexion impossible', error.message === 'pro_access_required' ? 'Ce compte ne possède pas encore de rôle Zwit Pro.' : 'La mémoire Zwit Pro est momentanément indisponible.');
  });
})();
