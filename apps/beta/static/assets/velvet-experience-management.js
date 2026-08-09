(() => {
  const content = document.querySelector('#content');
  if (!content) return;

  const runtime = {
    intelligence: null,
    profile: null,
    photos: null,
    routeKey: '',
    enhancing: false,
    profileFilters: {
      query: '', audience: 'all', minimumAge: 18, maximumAge: 99,
      affinity: 'all', sort: 'distance'
    },
    clubKind: 'all'
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  async function api(path, options = {}) {
    const response = await fetch(path, {
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

  function toast(message, isError = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', isError);
    node.classList.add('visible');
    window.setTimeout(() => node.classList.remove('visible'), 3600);
  }

  function currentRoute() {
    const active = document.querySelector('[data-route].active, [data-route][aria-current="page"]');
    if (active?.dataset.route) return active.dataset.route;
    const heading = content.querySelector('h1,h2')?.textContent?.toLocaleLowerCase('fr') || '';
    if (/conversation|message/.test(heading)) return 'conversations';
    if (/mon profil|profil de/.test(heading)) return 'me';
    if (/sortie|événement/.test(heading)) return 'events';
    if (/établissement|club|lieu/.test(heading)) return 'venues';
    if (/paramètre|confidentialité/.test(heading)) return 'settings';
    if (/recherche/.test(heading)) return 'discover';
    return 'home';
  }

  function navigateProfile(id) {
    if (!id) return;
    const existing = document.querySelector(`[data-open-profile="${CSS.escape(id)}"]`);
    if (existing) return existing.click();
    location.assign(`/membres/?route=discover&profile=${encodeURIComponent(id)}`);
  }

  function navigateEvent(id) {
    if (!id) return;
    const existing = document.querySelector(`[data-open-event="${CSS.escape(id)}"]`);
    if (existing) return existing.click();
    location.assign(`/membres/?route=events&event=${encodeURIComponent(id)}`);
  }

  function navigateVenue(id) {
    const existing = document.querySelector(`[data-open-venue="${CSS.escape(id)}"],[data-venue-id="${CSS.escape(id)}"]`);
    if (existing) existing.click();
    else document.querySelector('[data-route="venues"]')?.click();
  }

  function image(url, alt) {
    return url
      ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">`
      : `<span class="velvet-image-placeholder" aria-hidden="true">V</span>`;
  }

  function distanceLabel(value, fallback = '') {
    const distance = Number(value);
    return Number.isFinite(distance) ? `${distance.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : fallback;
  }

  function affinityLabel(reaction) {
    if (reaction < 0) return '❄️';
    if (reaction === 1) return '🔥';
    if (reaction === 2) return '🔥🔥';
    if (reaction >= 3) return '🔥🔥🔥';
    return '';
  }

  function firstAge(label) {
    const match = String(label || '').match(/\d{2}/);
    return match ? Number(match[0]) : null;
  }

  function profileCard(profile) {
    return `<button class="velvet-intel-card" type="button" data-velvet-profile="${escapeHtml(profile.id)}">
      ${image(profile.photoUrl, profile.displayName)}
      <span class="velvet-intel-badge">${escapeHtml(`${affinityLabel(profile.reaction)} ${profile.compatibilityScore}%`.trim())}</span>
      <span class="content">
        <strong>${escapeHtml(profile.displayName)}</strong>
        <small class="meta">${escapeHtml([profile.demographicLabel, profile.ageLabel].filter(Boolean).join(' · '))}</small>
        <small>${escapeHtml([distanceLabel(profile.distanceKm), profile.locationZone].filter(Boolean).join(' · '))}</small>
      </span>
    </button>`;
  }

  function clubCard(club) {
    return `<button class="velvet-intel-card" type="button" data-velvet-venue="${escapeHtml(club.id)}">
      <span class="content" style="padding-top:28px">
        <span style="font-size:32px;color:var(--gold,#d8b77b)">⌂</span>
        <strong style="margin-top:18px">${escapeHtml(club.name)}</strong>
        <small class="meta">${escapeHtml([club.categoryPrimary || club.kind, club.city].filter(Boolean).join(' · '))}</small>
        <small>${escapeHtml(club.frequented ? 'Établissement fréquenté' : distanceLabel(club.distanceKm, 'Distance à confirmer'))}</small>
      </span>
    </button>`;
  }

  function eventRow(event) {
    return `<button class="velvet-nearby-row" type="button" data-velvet-event="${escapeHtml(event.id)}">
      <span style="width:52px;height:52px;border-radius:14px;display:grid;place-items:center;background:rgba(218,183,120,.08);color:var(--gold,#d8b77b);font-size:22px">${event.event_category === 'cap_dagde' || event.eventCategory === 'cap_dagde' ? '☀' : '✦'}</span>
      <span><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(new Date(event.starts_at || event.startsAt).toLocaleString('fr-FR'))} · ${escapeHtml(event.location_public || event.locationPublic || 'Lieu privé')}</small></span>
      <small>${escapeHtml(distanceLabel(event.distanceKm, event.frequentedClub ? 'Club fréquenté' : ''))}</small>
    </button>`;
  }

  function activityRow(activity) {
    return `<button class="velvet-activity-row" type="button" data-activity-profile="${escapeHtml(activity.profileId || '')}" data-activity-event="${escapeHtml(activity.eventId || '')}">
      ${image(activity.previewUrl, activity.profileName || 'Activité')}
      <span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.detail || '')}</small></span>
      <small>${escapeHtml(activity.createdAt ? new Date(activity.createdAt).toLocaleDateString('fr-FR') : '')}</small>
    </button>`;
  }

  function filteredProfiles() {
    const filters = runtime.profileFilters;
    const rows = [...(runtime.intelligence?.allProfiles || [])].filter((profile) => {
      const query = filters.query.toLocaleLowerCase('fr');
      const matchesQuery = !query
        || String(profile.displayName || '').toLocaleLowerCase('fr').includes(query)
        || String(profile.locationZone || '').toLocaleLowerCase('fr').includes(query);
      const matchesAudience = filters.audience === 'all' || profile.audience === filters.audience;
      const age = firstAge(profile.ageLabel);
      const matchesAge = age === null || (age >= filters.minimumAge && age <= filters.maximumAge);
      const matchesAffinity = filters.affinity === 'all'
        || (filters.affinity === 'ice' && profile.reaction < 0)
        || (filters.affinity === 'liked' && profile.reaction > 0)
        || (filters.affinity === 'new' && profile.reaction === 0);
      return matchesQuery && matchesAudience && matchesAge && matchesAffinity;
    });
    return rows.sort((left, right) => {
      if (filters.sort === 'compatibility') return right.compatibilityScore - left.compatibilityScore;
      if (filters.sort === 'recent') return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
      if (filters.sort === 'affinity') return right.reaction - left.reaction || right.compatibilityScore - left.compatibilityScore;
      return (left.distanceKm ?? 999999) - (right.distanceKm ?? 999999);
    });
  }

  function renderAllProfiles() {
    const grid = document.querySelector('[data-velvet-all-profile-grid]');
    if (!grid) return;
    const rows = filteredProfiles();
    grid.innerHTML = rows.length
      ? rows.map(profileCard).join('')
      : '<p class="status-box">Aucun profil ne correspond à ces critères.</p>';
    bindNavigation(grid);
  }

  function profileControls() {
    const filters = runtime.profileFilters;
    return `<div class="velvet-profile-controls">
      <input type="search" placeholder="Nom, ville ou zone…" value="${escapeHtml(filters.query)}" data-intel-query>
      <select data-intel-audience>
        <option value="all">Tous les profils</option><option value="couple">Couples</option><option value="woman">Femmes</option><option value="man">Hommes</option><option value="trans_nonbinary">Trans & non-binaires</option>
      </select>
      <select data-intel-age>
        <option value="18-99">Tous les âges</option><option value="18-29">18–29 ans</option><option value="30-39">30–39 ans</option><option value="40-49">40–49 ans</option><option value="50-59">50–59 ans</option><option value="60-99">60 ans et +</option>
      </select>
      <select data-intel-affinity>
        <option value="all">Tous les ressentis</option><option value="ice">❄️ Pas pour moi</option><option value="liked">🔥 Profils aimés</option><option value="new">Sans avis</option>
      </select>
      <select data-intel-sort>
        <option value="distance">Proximité</option><option value="compatibility">Compatibilité</option><option value="recent">Plus récents</option><option value="affinity">Glaçon & flammes</option>
      </select>
    </div>`;
  }

  async function ensureIntelligence(force = false) {
    if (runtime.intelligence && !force) return runtime.intelligence;
    runtime.intelligence = await api('/api/members/home-intelligence');
    runtime.profileFilters.sort = runtime.intelligence.preferences?.profileSort || 'distance';
    return runtime.intelligence;
  }

  async function enhanceHome() {
    if (content.querySelector('[data-velvet-intelligent-home]')) return;
    const data = await ensureIntelligence();
    const anchor = content.querySelector('.page-head') || content.firstElementChild;
    const container = document.createElement('section');
    container.dataset.velvetIntelligentHome = 'true';
    container.innerHTML = `
      <section class="velvet-experience-panel">
        <header class="velvet-experience-head"><div><span class="velvet-experience-eyebrow">Zwit Intelligence</span><h2>Pour toi</h2><p>Nouveaux profils compatibles, recommandations et clubs proches.</p></div><button class="velvet-radius-pill" type="button" data-open-experience-settings>${escapeHtml(`${data.preferences.radiusKm} km · régler`)}</button></header>
        <div class="velvet-horizontal-cards">${[...(data.curatedProfiles || []).slice(0, 8).map(profileCard), ...(data.nearbyClubs || []).slice(0, 5).map(clubCard)].join('') || '<p class="status-box">La sélection se prépare.</p>'}</div>
      </section>
      <section class="velvet-experience-panel">
        <header class="velvet-experience-head"><div><span class="velvet-experience-eyebrow">Dans votre rayon</span><h2>À portée de main</h2><p>Agendas ouverts autour de vous ou dans un club fréquenté.</p></div><span class="velvet-radius-pill">${escapeHtml(`${data.preferences.radiusKm} km`)}</span></header>
        <div class="velvet-nearby-list">${(data.nearbyEvents || []).slice(0, 8).map(eventRow).join('') || '<p class="status-box">Aucune sortie proche actuellement.</p>'}</div>
      </section>
      ${(data.followedActivities || []).length ? `<section class="velvet-experience-panel"><header class="velvet-experience-head"><div><span class="velvet-experience-eyebrow">Profils suivis</span><h2>Leurs nouveautés</h2><p>Nouvelles photos, sorties et recommandations.</p></div></header><div class="velvet-activity-list">${data.followedActivities.slice(0, 10).map(activityRow).join('')}</div></section>` : ''}
      <section class="velvet-experience-panel">
        <header class="velvet-experience-head"><div><span class="velvet-experience-eyebrow">Annuaire complet</span><h2>Tous les profils</h2><p>Classés par proximité par défaut, avec les filtres Zwit et votre mémoire glaçon/flammes.</p></div></header>
        ${profileControls()}
        <div class="velvet-profile-grid" data-velvet-all-profile-grid></div>
      </section>`;
    if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', container);
    else content.prepend(container);
    renderAllProfiles();
    bindHomeControls(container);
    bindNavigation(container);
  }

  function bindHomeControls(root) {
    root.querySelector('[data-intel-query]')?.addEventListener('input', (event) => {
      runtime.profileFilters.query = event.target.value;
      renderAllProfiles();
    });
    root.querySelector('[data-intel-audience]')?.addEventListener('change', (event) => {
      runtime.profileFilters.audience = event.target.value;
      renderAllProfiles();
    });
    root.querySelector('[data-intel-age]')?.addEventListener('change', (event) => {
      const [minimum, maximum] = event.target.value.split('-').map(Number);
      runtime.profileFilters.minimumAge = minimum;
      runtime.profileFilters.maximumAge = maximum;
      renderAllProfiles();
    });
    root.querySelector('[data-intel-affinity]')?.addEventListener('change', (event) => {
      runtime.profileFilters.affinity = event.target.value;
      renderAllProfiles();
    });
    const sort = root.querySelector('[data-intel-sort]');
    if (sort) {
      sort.value = runtime.profileFilters.sort;
      sort.addEventListener('change', (event) => {
        runtime.profileFilters.sort = event.target.value;
        renderAllProfiles();
      });
    }
    root.querySelector('[data-open-experience-settings]')?.addEventListener('click', showExperienceDialog);
  }

  function bindNavigation(root = document) {
    root.querySelectorAll('[data-velvet-profile]').forEach((node) => {
      if (node.dataset.bound) return;
      node.dataset.bound = 'true';
      node.addEventListener('click', () => navigateProfile(node.dataset.velvetProfile));
    });
    root.querySelectorAll('[data-velvet-event]').forEach((node) => {
      if (node.dataset.bound) return;
      node.dataset.bound = 'true';
      node.addEventListener('click', () => navigateEvent(node.dataset.velvetEvent));
    });
    root.querySelectorAll('[data-velvet-venue]').forEach((node) => {
      if (node.dataset.bound) return;
      node.dataset.bound = 'true';
      node.addEventListener('click', () => navigateVenue(node.dataset.velvetVenue));
    });
    root.querySelectorAll('[data-activity-profile],[data-activity-event]').forEach((node) => {
      if (node.dataset.bound) return;
      node.dataset.bound = 'true';
      node.addEventListener('click', () => {
        if (node.dataset.activityEvent) navigateEvent(node.dataset.activityEvent);
        else navigateProfile(node.dataset.activityProfile);
      });
    });
  }

  function enhanceConversations() {
    content.querySelectorAll('[data-open-conversation]').forEach((conversation) => {
      if (conversation.querySelector('[data-delete-conversation]')) return;
      const remove = document.createElement('span');
      remove.className = 'velvet-conversation-delete';
      remove.dataset.deleteConversation = conversation.dataset.openConversation;
      remove.setAttribute('role', 'button');
      remove.setAttribute('aria-label', 'Supprimer cette conversation');
      remove.textContent = '⌫';
      remove.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const accepted = confirm('Supprimer cette conversation de votre messagerie ? Elle restera disponible pour l’autre membre.');
        if (!accepted) return;
        try {
          await api(`/api/members/conversations?id=${encodeURIComponent(remove.dataset.deleteConversation)}`, { method: 'DELETE' });
          conversation.remove();
          toast('Conversation supprimée de votre messagerie.');
        } catch (error) {
          toast(error.message, true);
        }
      });
      conversation.append(remove);
    });
  }

  async function loadOwnedMedia(force = false) {
    if (!force && runtime.profile && runtime.photos) return;
    const [profileResponse, photosResponse] = await Promise.all([
      api('/api/members/profile'), api('/api/members/photos')
    ]);
    runtime.profile = profileResponse.profile;
    runtime.photos = photosResponse.photos || [];
  }

  function mediaItems() {
    const profilePhotos = (runtime.photos || []).map((photo) => ({
      id: photo.id,
      title: photo.media_role === 'individual_portrait' ? 'Portrait individuel' : 'Photo du profil',
      subtitle: photo.moderation_status === 'approved' ? 'Profil public' : `Validation : ${photo.moderation_status}`,
      previewUrl: photo.previewUrl,
      required: ['couple_gallery', 'individual_gallery'].includes(photo.media_role)
    }));
    const albums = (runtime.profile?.albums || []).flatMap((album) => (album.media_assets || []).map((media) => ({
      id: media.id,
      title: album.name,
      subtitle: album.confidentiality === 'public' ? 'Album public' : 'Album privé',
      previewUrl: media.previewUrl,
      required: false
    })));
    return [...profilePhotos, ...albums];
  }

  async function enhanceOwnProfile() {
    if (content.querySelector('[data-velvet-media-manager]')) return;
    await loadOwnedMedia();
    const section = document.createElement('section');
    section.className = 'velvet-experience-panel';
    section.dataset.velvetMediaManager = 'true';
    const items = mediaItems();
    const approved = (runtime.photos || []).filter((photo) => ['couple_gallery', 'individual_gallery'].includes(photo.media_role) && photo.moderation_status === 'approved').length;
    section.innerHTML = `<header class="velvet-experience-head"><div><span class="velvet-experience-eyebrow">Gestion personnelle</span><h2>Mes photos & albums</h2><p>Supprimez un média public ou privé. Trois photos de profil validées restent obligatoires.</p></div></header>
      <div class="velvet-readiness"><strong>${approved >= 3 ? 'Profil visible' : 'Profil masqué'}</strong> · ${approved} photo${approved > 1 ? 's' : ''} de profil validée${approved > 1 ? 's' : ''} sur 3.</div>
      <div class="velvet-media-manager-grid">${items.map((item) => `<article class="velvet-managed-media" data-managed-media="${escapeHtml(item.id)}">${image(item.previewUrl, item.title)}<button class="velvet-media-delete" type="button" data-delete-media="${escapeHtml(item.id)}" data-required="${item.required ? '1' : '0'}" aria-label="Supprimer">×</button><footer><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle)}</small></footer></article>`).join('') || '<p class="status-box">Aucun média à gérer.</p>'}</div>`;
    content.append(section);
    section.querySelectorAll('[data-delete-media]').forEach((button) => {
      button.addEventListener('click', async () => {
        const warning = button.dataset.required === '1'
          ? 'Si moins de trois photos validées restent disponibles, votre profil sera masqué. Continuer ?'
          : 'Supprimer définitivement ce média ?';
        if (!confirm(warning)) return;
        button.disabled = true;
        try {
          const result = await api(`/api/members/photo-management?id=${encodeURIComponent(button.dataset.deleteMedia)}`, { method: 'DELETE' });
          section.querySelector(`[data-managed-media="${CSS.escape(button.dataset.deleteMedia)}"]`)?.remove();
          const readiness = section.querySelector('.velvet-readiness');
          if (readiness) readiness.innerHTML = `<strong>${result.profileVisible ? 'Profil visible' : 'Profil masqué'}</strong> · ${result.remainingPublicProfilePhotos} photo${result.remainingPublicProfilePhotos > 1 ? 's' : ''} de profil validée${result.remainingPublicProfilePhotos > 1 ? 's' : ''} sur 3.${result.warning ? ` ${escapeHtml(result.warning)}` : ''}`;
          runtime.profile = null;
          runtime.photos = null;
          toast(result.warning || 'Photo supprimée.');
        } catch (error) {
          button.disabled = false;
          toast(error.message, true);
        }
      });
    });
  }

  async function enhanceEvents() {
    if (content.querySelector('[data-create-velvet-event]')) return;
    const head = content.querySelector('.page-head') || content.querySelector('h1,h2')?.parentElement;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'velvet-experience-button primary';
    button.dataset.createVelvetEvent = 'true';
    button.textContent = '+ Créer une sortie';
    button.addEventListener('click', () => showEventDialog('standard'));
    head?.append(button);

    const capButton = document.createElement('button');
    capButton.type = 'button';
    capButton.className = 'velvet-experience-button';
    capButton.textContent = '☀ Séjour au Cap d’Agde';
    capButton.addEventListener('click', () => showEventDialog('cap_dagde'));
    head?.append(capButton);
  }

  async function enhanceVenues() {
    if (content.querySelector('[data-velvet-clubs-only]')) return;
    const data = await ensureIntelligence();
    const section = document.createElement('section');
    section.className = 'velvet-experience-panel';
    section.dataset.velvetClubsOnly = 'true';
    section.innerHTML = `<header class="velvet-experience-head"><div><span class="velvet-experience-eyebrow">Clubs & professionnels</span><h2>Clubs uniquement</h2><p>Clubs, spas et bars libertins, filtrés selon les critères déjà définis.</p></div><span class="velvet-radius-pill">${escapeHtml(`${data.preferences.radiusKm} km`)}</span></header>
      <div class="velvet-club-filters"><button class="active" data-club-kind="all">Tous</button><button data-club-kind="club">Clubs</button><button data-club-kind="spa">Spas</button><button data-club-kind="bar">Bars</button><button data-club-kind="frequented">Fréquentés</button></div>
      <div class="velvet-horizontal-cards" data-club-grid>${(data.nearbyClubs || []).map(clubCard).join('') || '<p class="status-box">Aucun club dans ce rayon.</p>'}</div>`;
    const anchor = content.querySelector('.page-head') || content.firstElementChild;
    anchor?.insertAdjacentElement('afterend', section);
    bindNavigation(section);
    section.querySelectorAll('[data-club-kind]').forEach((button) => {
      button.addEventListener('click', () => {
        section.querySelectorAll('[data-club-kind]').forEach((node) => node.classList.remove('active'));
        button.classList.add('active');
        runtime.clubKind = button.dataset.clubKind;
        const clubs = (data.nearbyClubs || []).filter((club) => {
          if (runtime.clubKind === 'all') return true;
          if (runtime.clubKind === 'frequented') return club.frequented;
          return `${club.kind || ''} ${club.categoryPrimary || ''}`.toLocaleLowerCase('fr').includes(runtime.clubKind);
        });
        const grid = section.querySelector('[data-club-grid]');
        grid.innerHTML = clubs.map(clubCard).join('') || '<p class="status-box">Aucun club correspondant.</p>';
        bindNavigation(grid);
      });
    });
  }

  function dialogShell(title, subtitle, body) {
    const dialog = document.createElement('dialog');
    dialog.className = 'velvet-experience-dialog';
    dialog.innerHTML = `<div class="velvet-experience-dialog-inner"><header class="velvet-experience-head"><div><span class="velvet-experience-eyebrow">Zwit</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="velvet-experience-button" type="button" data-close-dialog>Fermer</button></header>${body}</div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
    return dialog;
  }

  function showEventDialog(category = 'standard') {
    const cap = category === 'cap_dagde';
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
    const later = new Date(Date.now() + 28 * 3600 * 1000).toISOString().slice(0, 16);
    const dialog = dialogShell(
      cap ? 'Séjour au Cap d’Agde' : 'Créer une sortie',
      'Zwit Intelligence contrôle la cohérence et la sécurité avant publication.',
      `<form class="velvet-event-form" data-event-creator>
        <input type="hidden" name="eventCategory" value="${category}">
        <label>Titre<input name="title" maxlength="160" required></label>
        <label>Lieu public<input name="locationPublic" maxlength="240" placeholder="Ville, club ou zone générale" required></label>
        <label>Début<input type="datetime-local" name="startsAt" value="${tomorrow}" required></label>
        <label>Fin<input type="datetime-local" name="endsAt" value="${later}"></label>
        <label>Capacité<input type="number" name="capacity" min="2" max="500" value="20"></label>
        <label>Public<input name="audience" value="Membres Zwit admis"></label>
        <label class="wide">Présentation<textarea name="description" minlength="20" maxlength="3000" required></textarea></label>
        <label>Dress code<input name="dressCode" maxlength="180"></label>
        ${cap ? `<label>Zone du village<select name="capZone"><option>Ensemble du village</option><option>Port Nature</option><option>Héliopolis</option><option>Port Ambonne</option><option>Port Soleil</option><option>Le Môle</option><option>Plage naturiste</option></select></label><label>Résidence / établissement<input name="capVenue" maxlength="160"></label>` : ''}
        <div class="wide velvet-dialog-actions"><button type="button" class="velvet-experience-button" data-cancel>Annuler</button><button type="submit" class="velvet-experience-button primary">Publier</button></div>
      </form>`
    );
    dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-event-creator]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const result = await api('/api/members/events', {
          method: 'POST',
          body: JSON.stringify({
            eventCategory: data.get('eventCategory'), title: data.get('title'),
            description: data.get('description'), locationPublic: data.get('locationPublic'),
            startsAt: new Date(data.get('startsAt')).toISOString(),
            endsAt: data.get('endsAt') ? new Date(data.get('endsAt')).toISOString() : null,
            capacity: Number(data.get('capacity')), audience: data.get('audience'),
            dressCode: data.get('dressCode'), capZone: data.get('capZone'), capVenue: data.get('capVenue')
          })
        });
        dialog.close();
        toast(result.publicationStatus === 'review' ? 'Sortie enregistrée, validation humaine en cours.' : 'Sortie publiée.');
        document.querySelector('[data-route="events"]')?.click();
      } catch (error) {
        submit.disabled = false;
        toast(error.message, true);
      }
    });
  }

  async function showExperienceDialog() {
    const data = await ensureIntelligence();
    const dialog = dialogShell(
      'Proximité & Intelligence',
      'Ce rayon unique pilote l’accueil, les profils, les clubs, les sorties et la carte.',
      `<form class="velvet-settings-grid" data-experience-form>
        <label>Rayon<select name="radius">${[10,20,30,50,75,100,150,200].map((value) => `<option value="${value}"${value === data.preferences.radiusKm ? ' selected' : ''}>${value} km</option>`).join('')}</select></label>
        <label>Classement<select name="sort"><option value="distance">Proximité</option><option value="compatibility">Compatibilité</option><option value="recent">Plus récents</option><option value="affinity">Glaçon & flammes</option></select></label>
        <label class="wide"><span><input type="checkbox" name="ai"${data.preferences.aiPersonalizationEnabled ? ' checked' : ''}> Adapter les recommandations avec Zwit Intelligence</span></label>
        <p class="wide">La position reste approximative. Zwit ne publie jamais vos coordonnées exactes.</p>
        <div class="wide velvet-dialog-actions"><button type="button" class="velvet-experience-button" data-cancel>Annuler</button><button type="submit" class="velvet-experience-button primary">Enregistrer</button></div>
      </form>`
    );
    const form = dialog.querySelector('[data-experience-form]');
    form.elements.sort.value = data.preferences.profileSort;
    dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fields = new FormData(form);
      try {
        await api('/api/members/experience-preferences', {
          method: 'POST',
          body: JSON.stringify({
            discoveryRadiusKm: Number(fields.get('radius')),
            profileSort: fields.get('sort'),
            aiPersonalizationEnabled: fields.has('ai')
          })
        });
        runtime.intelligence = null;
        dialog.close();
        toast('Préférences de proximité enregistrées.');
        location.reload();
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  async function enhanceSettings() {
    if (content.querySelector('[data-web-experience-settings]')) return;
    const data = await ensureIntelligence();
    const panel = document.createElement('section');
    panel.className = 'velvet-experience-panel';
    panel.dataset.webExperienceSettings = 'true';
    panel.innerHTML = `<header class="velvet-experience-head"><div><span class="velvet-experience-eyebrow">Expérience personnelle</span><h2>Proximité & Zwit Intelligence</h2><p>Rayon actuel : ${escapeHtml(`${data.preferences.radiusKm} km`)} · classement ${escapeHtml(data.preferences.profileSort)}</p></div><button class="velvet-experience-button" type="button">Modifier</button></header>`;
    content.append(panel);
    panel.querySelector('button').addEventListener('click', showExperienceDialog);
  }

  async function enhance() {
    if (runtime.enhancing) return;
    runtime.enhancing = true;
    try {
      const route = currentRoute();
      const key = `${route}:${content.querySelector('h1,h2')?.textContent || ''}`;
      runtime.routeKey = key;
      if (route === 'home') await enhanceHome();
      if (route === 'conversations') enhanceConversations();
      if (route === 'me') await enhanceOwnProfile();
      if (route === 'events') await enhanceEvents();
      if (route === 'venues') await enhanceVenues();
      if (route === 'settings') await enhanceSettings();
      bindNavigation(content);
    } catch (error) {
      console.warn('[Zwit Experience]', error);
    } finally {
      runtime.enhancing = false;
    }
  }

  const observer = new MutationObserver(() => window.requestAnimationFrame(enhance));
  observer.observe(content, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-route]')) window.setTimeout(enhance, 80);
  }, true);
  window.setInterval(() => {
    if (currentRoute() === 'home') {
      ensureIntelligence(true).then(() => {
        content.querySelector('[data-velvet-intelligent-home]')?.remove();
        enhance();
      }).catch(() => null);
    }
  }, 60000);
  enhance();
})();
