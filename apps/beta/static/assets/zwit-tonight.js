(() => {
  if (!location.pathname.startsWith('/membres')) return;
  const content = document.querySelector('#content');
  if (!content) return;

  let active = false;
  let state = null;
  let loading = false;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const intentLabels = {
    go_out: 'Sortir',
    meet: 'Rencontrer',
    chat: 'Discuter',
    spontaneous: 'Improviser'
  };
  const venueLabels = { club: 'Club', spa: 'Spa', bar: 'Bar', private: 'Privé', open: 'Ouvert à tout' };
  const profileLabels = { couple: 'Couples', woman: 'Femmes', man: 'Hommes' };

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function primaryPhoto(profile) {
    const media = Array.isArray(profile?.media_assets) ? profile.media_assets : [];
    return media
      .filter((item) => item.moderation_status === 'approved' && item.previewUrl)
      .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))[0]?.previewUrl || '';
  }

  function statusMarkup(own) {
    if (!own) return '';
    return `<div class="zwit-tonight__status">
      <span class="zwit-tonight__pulse" aria-hidden="true"></span>
      <span><strong>Tu es visible Ce soir · ${escapeHtml(intentLabels[own.intent] || 'Disponible')}</strong><small>Jusqu’à ${escapeHtml(formatTime(own.expires_at))}${own.location_label ? ` · ${escapeHtml(own.location_label)}` : ''}</small></span>
      <button type="button" class="zwit-tonight__quiet" data-tonight-end>Mettre fin</button>
    </div>`;
  }

  function choice(name, value, label, checked = false) {
    return `<label class="zwit-tonight__choice"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  }

  function chip(name, value, label, checked = false) {
    return `<label class="zwit-tonight__chip"><input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  }

  function personCard(item) {
    const profile = item.profile || {};
    const photo = primaryPhoto(profile);
    return `<article class="zwit-tonight__person">
      <div class="zwit-tonight__person-media">${photo ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy">` : ''}</div>
      <div class="zwit-tonight__person-body">
        <strong>${escapeHtml(profile.display_name || 'Membre Zwit')}</strong>
        <small>${escapeHtml(item.location_label || profile.location_zone || 'Zone privée')} · ${escapeHtml(item.radius_km || 50)} km</small>
        <span class="zwit-tonight__tag">${escapeHtml(intentLabels[item.intent] || 'Disponible')}</span>
        ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}
      </div>
    </article>`;
  }

  function eventCard(event) {
    const date = new Date(event.starts_at);
    const time = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
    return `<article class="zwit-tonight__event"><time>${escapeHtml(time)}</time><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.location_public || event.dress_code || 'Voir la fiche de la sortie')}</small></article>`;
  }

  function render() {
    if (!active || !state) return;
    const own = state.own;
    const selectedIntent = own?.intent || 'meet';
    const selectedVenues = new Set(own?.venue_mode || []);
    const selectedProfiles = new Set(own?.wanted_profile_types || []);
    const people = Array.isArray(state.people) ? state.people : [];
    const events = Array.isArray(state.events) ? state.events : [];

    content.innerHTML = `<section class="zwit-tonight">
      <div class="zwit-tonight__hero">
        <p class="zwit-tonight__eyebrow">Maintenant · autour de toi</p>
        <h1>Ce soir peut commencer ici.</h1>
        <p class="zwit-tonight__hero-copy">Dis ce dont tu as envie pendant quelques heures. Zwit rapproche les membres disponibles et les sorties qui peuvent réellement mener à une rencontre.</p>
        ${statusMarkup(own)}
      </div>

      <div class="zwit-tonight__layout">
        <form class="zwit-tonight__panel" id="zwitTonightForm">
          <div class="zwit-tonight__panel-head"><div><h2>${own ? 'Modifier mon envie' : 'Je suis disponible'}</h2><p>Ton statut disparaît automatiquement. Aucun historique public n’est créé.</p></div></div>
          <div class="zwit-tonight__intent-grid">
            ${choice('intent','go_out','Sortir',selectedIntent === 'go_out')}
            ${choice('intent','meet','Rencontrer',selectedIntent === 'meet')}
            ${choice('intent','chat','Discuter',selectedIntent === 'chat')}
            ${choice('intent','spontaneous','Improviser',selectedIntent === 'spontaneous')}
          </div>

          <div class="zwit-tonight__form-row">
            <label class="zwit-tonight__field"><span>Zone publique</span><input type="text" name="locationLabel" maxlength="120" value="${escapeHtml(own?.location_label || '')}" placeholder="Ex. Lille et alentours"></label>
            <label class="zwit-tonight__field"><span>Rayon</span><select name="radiusKm">${[20,30,50,80,120].map((km) => `<option value="${km}" ${Number(own?.radius_km || 50) === km ? 'selected' : ''}>${km} km</option>`).join('')}</select></label>
          </div>

          <p class="zwit-tonight__label" style="margin:16px 0 0">Où ça pourrait se passer ?</p>
          <div class="zwit-tonight__chips">${Object.entries(venueLabels).map(([value,label]) => chip('venueMode',value,label,selectedVenues.has(value))).join('')}</div>

          <p class="zwit-tonight__label" style="margin:16px 0 0">Je souhaite surtout croiser</p>
          <div class="zwit-tonight__chips">${Object.entries(profileLabels).map(([value,label]) => chip('wantedProfileTypes',value,label,selectedProfiles.has(value))).join('')}</div>

          <div class="zwit-tonight__form-row">
            <label class="zwit-tonight__field"><span>Jusqu’à</span><select name="durationHours">${[2,4,6,8,12].map((hours) => `<option value="${hours}" ${hours === 6 ? 'selected' : ''}>${hours} h</option>`).join('')}</select></label>
            <label class="zwit-tonight__field"><span>Petit mot</span><input type="text" name="note" maxlength="280" value="${escapeHtml(own?.note || '')}" placeholder="Une ambiance, une idée…"></label>
          </div>

          <div class="zwit-tonight__form-actions"><small class="zwit-tonight__label">Visible uniquement par les membres admis</small><button class="zwit-tonight__primary" type="submit">${own ? 'Actualiser' : 'Me rendre visible'}</button></div>
          <p class="zwit-tonight__privacy"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></svg><span>${escapeHtml(state.privacy || 'Ta position précise reste privée.')}</span></p>
        </form>

        <aside class="zwit-tonight__panel">
          <div class="zwit-tonight__panel-head"><div><h2>Disponibles maintenant</h2><p>${people.length} profil${people.length > 1 ? 's' : ''} visible${people.length > 1 ? 's' : ''}</p></div></div>
          ${people.length ? `<div class="zwit-tonight__people">${people.slice(0,12).map(personCard).join('')}</div>` : '<div class="zwit-tonight__empty">Personne n’a encore activé “Ce soir” dans ta zone. Les premiers membres visibles apparaîtront ici en temps réel à l’actualisation.</div>'}
        </aside>
      </div>

      <section class="zwit-tonight__panel" style="margin-top:18px">
        <div class="zwit-tonight__panel-head"><div><h2>Sorties dans les prochaines heures</h2><p>Les événements Zwit qui peuvent transformer l’envie en vraie soirée.</p></div><button class="zwit-tonight__secondary" type="button" data-tonight-events>Agenda complet</button></div>
        ${events.length ? `<div class="zwit-tonight__event-list">${events.slice(0,8).map(eventCard).join('')}</div>` : '<div class="zwit-tonight__empty">Aucune sortie publiée dans les prochaines heures.</div>'}
      </section>
    </section>`;
  }

  async function load() {
    if (loading) return;
    loading = true;
    content.innerHTML = '<div class="zwit-tonight__loading">Préparation de Ce soir…</div>';
    try {
      const response = await fetch('/api/members/tonight', { headers: { accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.tonight) throw new Error(payload.error || 'tonight_read_failed');
      state = payload.tonight;
      render();
    } catch (error) {
      content.innerHTML = `<div class="zwit-tonight__error"><h2>Ce soir n’est pas encore disponible</h2><p>${escapeHtml(error.message === 'relation "member_tonight_statuses" does not exist' ? 'La migration v1.5 doit être appliquée avant le test réel.' : 'Le module n’a pas pu être chargé. La navigation Zwit reste disponible.')}</p><button class="zwit-tonight__secondary" data-tonight-retry>Réessayer</button></div>`;
    } finally {
      loading = false;
    }
  }

  async function save(form) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const data = new FormData(form);
    const body = {
      intent: data.get('intent'),
      locationLabel: data.get('locationLabel'),
      radiusKm: Number(data.get('radiusKm')),
      venueMode: data.getAll('venueMode'),
      wantedProfileTypes: data.getAll('wantedProfileTypes'),
      durationHours: Number(data.get('durationHours')),
      note: data.get('note')
    };
    try {
      const response = await fetch('/api/members/tonight', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.tonight) throw new Error(payload.error || 'tonight_write_failed');
      state = payload.tonight;
      render();
    } catch {
      button.disabled = false;
      button.textContent = 'Réessayer';
    }
  }

  async function endTonight(button) {
    button.disabled = true;
    try {
      const response = await fetch('/api/members/tonight', { method: 'DELETE', headers: { accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.tonight) throw new Error('tonight_delete_failed');
      state = payload.tonight;
      render();
    } catch { button.disabled = false; }
  }

  document.addEventListener('click', (event) => {
    const open = event.target.closest('[data-zwit-route="tonight"]');
    if (open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      active = true;
      document.querySelectorAll('[data-route]').forEach((node) => node.classList.remove('active'));
      open.classList.add('active');
      load();
      return;
    }
    if (event.target.closest('[data-route]')) active = false;
    const end = event.target.closest('[data-tonight-end]');
    if (end) { event.preventDefault(); endTonight(end); return; }
    const retry = event.target.closest('[data-tonight-retry]');
    if (retry) { event.preventDefault(); load(); return; }
    const events = event.target.closest('[data-tonight-events]');
    if (events) {
      event.preventDefault();
      active = false;
      document.querySelector('[data-route="events"]')?.click();
    }
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('#zwitTonightForm');
    if (!form) return;
    event.preventDefault();
    save(form);
  });
})();
