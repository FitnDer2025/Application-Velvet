(() => {
  const content = document.querySelector('#content');
  if (!content) return;

  const PARITY_VERSION = '20260801-1';
  const ROUTE_QUERY = 'route';
  const runtime = {
    rendering: false,
    route: null,
    bundle: null,
    lastLoadedAt: 0,
    refreshTimer: null,
    clubQuery: '',
    selectedVenueId: '',
    outingDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)
  };

  const pick = (value, ...keys) => {
    for (const key of keys) {
      if (value && value[key] !== undefined && value[key] !== null) return value[key];
    }
    return null;
  };

  const array = (value) => Array.isArray(value) ? value : [];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function text(value) {
    return String(value ?? '').trim();
  }

  function dateValue(value) {
    const parsed = new Date(value || 0);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  function formatDate(value, options = { day: 'numeric', month: 'long' }) {
    const date = dateValue(value);
    if (!date.getTime()) return '';
    return new Intl.DateTimeFormat('fr-FR', options).format(date);
  }

  function relativeDate(value) {
    const date = dateValue(value);
    if (!date.getTime()) return '';
    const delta = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return 'À l’instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Il y a ${days} j`;
    return formatDate(date, { day: 'numeric', month: 'short' });
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

  function toast(message, isError = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', isError);
    node.classList.add('visible');
    window.setTimeout(() => node.classList.remove('visible'), 3600);
  }

  function profileType(profile) {
    return text(pick(profile, 'profileType', 'profile_type')).toLowerCase() === 'couple'
      ? 'couple'
      : 'individual';
  }

  function profileId(profile) {
    return text(pick(profile, 'id', 'profileId', 'profile_id'));
  }

  function displayName(profile) {
    return text(pick(profile, 'displayName', 'display_name', 'name')) || 'Membre Zwit';
  }

  function profilePhotos(profile) {
    return array(pick(profile, 'profileGalleryPhotos', 'profile_gallery_photos', 'photos'));
  }

  function photoUrl(photo) {
    return text(pick(photo, 'previewUrl', 'preview_url', 'signedUrl', 'signed_url', 'url'));
  }

  function primaryPhoto(profile) {
    const photos = profilePhotos(profile);
    const primary = photos.find((photo) => pick(photo, 'isPrimary', 'is_primary') === true) || photos[0];
    return photoUrl(primary);
  }

  function memberLocation(profile) {
    return text(pick(profile, 'locationZone', 'location_zone', 'city')) || 'Zone privée';
  }

  function demographic(profile) {
    const type = profileType(profile);
    if (type === 'couple') return 'Couple';
    const people = array(pick(profile, 'individualProfiles', 'individual_profiles'));
    const identities = people.map((person) => text(pick(person, 'genderIdentity', 'gender_identity')).toLowerCase());
    if (identities.some((value) => /femme|woman|female/.test(value))) return 'Femme seule';
    if (identities.some((value) => /homme|\bman\b|male/.test(value) && !/female/.test(value))) return 'Homme seul';
    if (identities.some((value) => /non.?binaire|non.?binary|queer|genderfluid/.test(value))) return 'Non-binaire';
    return text(pick(profile, 'velvetDemographicLabel', 'demographicLabel', 'demographic_label')) || 'Membre';
  }

  function ageLabel(profile) {
    const direct = text(pick(profile, 'velvetAgeLabel', 'ageLabel', 'age_label'));
    if (direct) return direct;
    const people = array(pick(profile, 'individualProfiles', 'individual_profiles'));
    const years = people.map((person) => Number(pick(person, 'birthYear', 'birth_year'))).filter(Number.isFinite);
    if (!years.length) return '';
    const ages = years.map((year) => new Date().getFullYear() - year).filter((age) => age >= 18 && age < 100);
    return ages.length ? `${ages.join(' & ')} ans` : '';
  }

  function firstName(profile) {
    const people = array(pick(profile, 'individualProfiles', 'individual_profiles'));
    const name = text(pick(people[0], 'firstName', 'first_name'));
    return profileType(profile) === 'individual' && name ? name : displayName(profile);
  }

  function currentProfile(bundle) {
    return bundle.profile?.profile || bundle.profile || null;
  }

  function directoryProfiles(bundle) {
    return array(pick(bundle.directory, 'profiles'));
  }

  function venues(bundle) {
    const rows = array(pick(bundle.directory, 'venueDirectory', 'venue_directory'));
    return rows.length ? rows : array(pick(bundle.directory, 'establishments'));
  }

  function venueId(venue) {
    return text(pick(venue, 'id', 'venueId', 'venue_id'));
  }

  function venueName(venue) {
    return text(pick(venue, 'name', 'displayName', 'display_name')) || 'Établissement Zwit';
  }

  function venueCity(venue) {
    return text(pick(venue, 'city'));
  }

  function venueCategory(venue) {
    return text(pick(venue, 'categoryPrimary', 'category_primary', 'kind')) || 'Établissement';
  }

  function venueDistance(venue) {
    const value = Number(pick(venue, 'distanceKm', 'distance_km'));
    return Number.isFinite(value) ? `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : '';
  }

  function venueSearchText(venue) {
    const tags = array(pick(venue, 'tags')).join(' ');
    return [
      venueName(venue), venueCity(venue), venueCategory(venue),
      pick(venue, 'kind'), pick(venue, 'addressPublic', 'address_public'), tags,
      pick(venue, 'region'), pick(venue, 'countryCode', 'country_code')
    ].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR');
  }

  function image(url, alt, className = '') {
    return url
      ? `<img class="${escapeHtml(className)}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`
      : `<span class="velvet-parity-image-placeholder ${escapeHtml(className)}" aria-hidden="true">V</span>`;
  }

  async function loadBundle(force = false) {
    if (runtime.bundle && !force && Date.now() - runtime.lastLoadedAt < 30000) return runtime.bundle;
    const requests = await Promise.allSettled([
      api('/api/members/profile'),
      api('/api/members/home-intelligence'),
      api('/api/members/directory'),
      api('/api/members/plans'),
      api('/api/members/notifications')
    ]);
    const value = (index, fallback) => requests[index].status === 'fulfilled' ? requests[index].value : fallback;
    runtime.bundle = {
      profile: value(0, runtime.bundle?.profile || {}),
      intelligence: value(1, runtime.bundle?.intelligence || {}),
      directory: value(2, runtime.bundle?.directory || {}),
      plans: value(3, runtime.bundle?.plans || { venueVisits: [], travelPlans: [], eventPlans: [] }),
      notifications: value(4, runtime.bundle?.notifications || { notifications: [] })
    };
    runtime.lastLoadedAt = Date.now();
    return runtime.bundle;
  }

  function eligibleProfileIds(bundle) {
    const intelligence = bundle.intelligence || {};
    const radius = Number(pick(intelligence.preferences, 'radiusKm', 'radius_km')) || 50;
    return new Set(array(intelligence.allProfiles).filter((candidate) => {
      const reaction = Number(candidate.reaction ?? 0);
      const distance = Number(candidate.distanceKm);
      return reaction >= 0 && (!Number.isFinite(distance) || distance <= radius * 1.5);
    }).map((candidate) => text(candidate.id)));
  }

  function recommendationProfiles(bundle) {
    const intelligence = bundle.intelligence || {};
    const curated = array(intelligence.curatedProfiles);
    const latest = [...array(intelligence.allProfiles)].sort((left, right) =>
      dateValue(pick(right, 'createdAt', 'created_at')) - dateValue(pick(left, 'createdAt', 'created_at'))
    );
    const seen = new Set();
    return [...curated, ...latest].filter((profile) => {
      const id = text(profile.id);
      return id && !seen.has(id) && seen.add(id);
    }).slice(0, 10);
  }

  function intelligenceProfileCard(candidate) {
    const score = Number(candidate.compatibilityScore || 0);
    const meta = [candidate.demographicLabel, candidate.ageLabel, candidate.locationZone].filter(Boolean).join(' · ');
    return `<button class="velvet-parity-recommendation" type="button" data-parity-profile="${escapeHtml(candidate.id)}">
      <span class="velvet-parity-recommendation-media">
        ${image(candidate.photoUrl, candidate.displayName)}
        <span class="velvet-parity-score">${Number.isFinite(score) ? `${score}%` : 'Zwit IA'}</span>
      </span>
      <span class="velvet-parity-recommendation-copy">
        <strong>${escapeHtml(candidate.displayName || 'Membre Zwit')}</strong>
        <small>${escapeHtml(meta)}</small>
      </span>
    </button>`;
  }

  function profileById(bundle, id) {
    return directoryProfiles(bundle).find((profile) => profileId(profile) === id) || null;
  }

  function feedItems(bundle) {
    const current = currentProfile(bundle);
    const currentId = profileId(current);
    const eligible = eligibleProfileIds(bundle);
    const candidates = new Map(array(bundle.intelligence?.allProfiles).map((candidate) => [text(candidate.id), candidate]));
    const items = [];

    for (const member of directoryProfiles(bundle)) {
      const id = profileId(member);
      if (!id || id === currentId || (eligible.size && !eligible.has(id))) continue;
      const candidate = candidates.get(id) || {};
      const createdAt = dateValue(pick(member, 'createdAt', 'created_at', candidate.createdAt));
      const updatedAt = dateValue(pick(member, 'updatedAt', 'updated_at', candidate.updatedAt));
      const photos = profilePhotos(member);
      const latestPhoto = [...photos].sort((left, right) =>
        dateValue(pick(right, 'createdAt', 'created_at')) - dateValue(pick(left, 'createdAt', 'created_at'))
      )[0];
      const photoDate = dateValue(pick(latestPhoto, 'createdAt', 'created_at'));
      const common = {
        member,
        actorName: displayName(member),
        actorImage: primaryPhoto(member)
      };
      if (latestPhoto && photoDate > new Date(createdAt.getTime() + 3600000)) {
        items.push({
          id: `photo-${pick(latestPhoto, 'id')}`,
          kind: 'photo',
          title: 'a publié une nouvelle photo',
          detail: memberLocation(member),
          media: photoUrl(latestPhoto),
          createdAt: photoDate,
          ...common
        });
      } else if (updatedAt > new Date(createdAt.getTime() + 12 * 3600000)) {
        const details = [
          array(pick(member, 'practices'))[0], array(pick(member, 'valuesList', 'values_list'))[0], memberLocation(member)
        ].filter(Boolean).join(' · ');
        items.push({
          id: `profile-update-${id}-${updatedAt.toISOString()}`,
          kind: 'profileUpdate',
          title: 'a enrichi son profil',
          detail: details || 'De nouvelles informations sont disponibles sur sa fiche.',
          media: '',
          createdAt: updatedAt,
          ...common
        });
      } else {
        items.push({
          id: `profile-created-${id}`,
          kind: 'newProfile',
          title: profileType(member) === 'couple' ? 'vient de rejoindre la communauté' : 'vient de rejoindre Zwit',
          detail: [demographic(member), ageLabel(member), memberLocation(member)].filter(Boolean).join(' · '),
          media: primaryPhoto(member),
          createdAt,
          ...common
        });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const visit of array(pick(bundle.plans, 'venueVisits', 'venue_visits'))) {
      const memberId = text(pick(visit, 'profileId', 'profile_id'));
      const visitDate = dateValue(`${pick(visit, 'visitDate', 'visit_date')}T12:00:00`);
      if (!memberId || memberId === currentId || visitDate < today || (eligible.size && !eligible.has(memberId))) continue;
      const member = profileById(bundle, memberId);
      if (!member) continue;
      const venue = pick(visit, 'venueDirectory', 'venue_directory') || {};
      items.push({
        id: `outing-${pick(visit, 'id')}`,
        kind: 'outing',
        member,
        actorName: displayName(member),
        actorImage: primaryPhoto(member),
        title: profileType(member) === 'couple' ? 'seront présents' : 'sera présent·e',
        detail: `${venueName(venue)} · ${formatDate(visitDate, { weekday: 'long', day: 'numeric', month: 'long' })}`,
        media: '',
        createdAt: dateValue(pick(visit, 'updatedAt', 'updated_at', 'createdAt', 'created_at')),
        venueId: venueId(venue),
        visitDate: text(pick(visit, 'visitDate', 'visit_date'))
      });
    }

    for (const notification of array(bundle.notifications?.notifications)) {
      if (text(pick(notification, 'eventType', 'event_type')) !== 'reactions'
          || text(pick(notification, 'entityType', 'entity_type')) !== 'photo') continue;
      const actorId = text(pick(notification, 'actorProfileId', 'actor_profile_id'));
      const member = profileById(bundle, actorId);
      const reaction = text(notification.metadata?.reaction);
      const title = reaction === 'love'
        ? 'a adoré votre photo'
        : reaction === 'adore'
          ? 'a eu un coup de cœur pour votre photo'
          : 'a aimé votre photo';
      items.push({
        id: `reaction-${notification.id}`,
        kind: 'photoReaction',
        member,
        actorName: text(notification.metadata?.actorName) || displayName(member),
        actorImage: text(pick(notification, 'actorPreviewUrl', 'actor_preview_url')) || primaryPhoto(member),
        title,
        detail: text(notification.body),
        media: text(pick(notification, 'entityPreviewUrl', 'entity_preview_url')),
        createdAt: dateValue(pick(notification, 'createdAt', 'created_at'))
      });
    }

    for (const activity of array(bundle.intelligence?.followedActivities)) {
      const member = profileById(bundle, text(activity.profileId));
      items.push({
        id: `followed-${activity.id}`,
        kind: activity.type === 'recommendation' ? 'recommendation' : 'community',
        member,
        actorName: activity.profileName || displayName(member) || 'La communauté Zwit',
        actorImage: activity.previewUrl || primaryPhoto(member),
        title: activity.type === 'photo'
          ? 'a publié une nouvelle photo'
          : activity.type === 'event'
            ? 'a publié une nouvelle sortie'
            : activity.type === 'recommendation'
              ? 'a partagé une recommandation'
              : activity.title,
        detail: activity.detail,
        media: activity.type === 'photo' ? activity.previewUrl : '',
        createdAt: dateValue(activity.createdAt),
        eventId: activity.eventId
      });
    }

    const seen = new Set();
    return items
      .sort((left, right) => right.createdAt - left.createdAt)
      .filter((item) => item.id && !seen.has(item.id) && seen.add(item.id))
      .slice(0, 40);
  }

  function activityCard(item) {
    const memberId = profileId(item.member);
    const target = item.kind === 'outing'
      ? `data-parity-attendance="${escapeHtml(`${item.venueId || ''}|${item.visitDate || ''}`)}"`
      : memberId
        ? `data-parity-profile="${escapeHtml(memberId)}"`
        : '';
    return `<article class="velvet-parity-activity" ${target} tabindex="0">
      <header>
        ${image(item.actorImage, item.actorName, 'velvet-parity-avatar')}
        <span>
          <strong>${escapeHtml(item.actorName)}</strong>
          <span>${escapeHtml(item.title)}</span>
          <small>${escapeHtml(relativeDate(item.createdAt))}</small>
        </span>
      </header>
      ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}
      ${item.media ? `<div class="velvet-parity-activity-media">${image(item.media, item.title)}</div>` : ''}
      <footer>
        <span>${item.kind === 'outing' ? 'Voir qui sera présent' : 'Voir le profil'}</span>
        <span aria-hidden="true">→</span>
      </footer>
    </article>`;
  }

  function hiddenOwnershipMarker() {
    return '<i class="velvet-parity-ownership" data-velvet-intelligent-home hidden></i>';
  }

  async function renderHome({ force = false } = {}) {
    if (runtime.rendering) return;
    runtime.rendering = true;
    runtime.route = 'home';
    setActiveNavigation('home');
    try {
      const bundle = await loadBundle(force);
      const profile = currentProfile(bundle);
      const greeting = firstName(profile);
      const preferences = bundle.intelligence?.preferences || {};
      const radius = Number(pick(preferences, 'radiusKm', 'radius_km')) || 50;
      const locationEnabled = pick(preferences, 'locationEnabled', 'location_enabled') === true;
      const recommendations = recommendationProfiles(bundle);
      const feed = feedItems(bundle);
      content.innerHTML = `<section class="velvet-parity-page velvet-parity-home" data-velvet-community-parity="${PARITY_VERSION}">
        ${hiddenOwnershipMarker()}
        <header class="velvet-parity-community-header">
          <span class="velvet-parity-eyebrow">BONJOUR ${escapeHtml(greeting.toLocaleUpperCase('fr-FR'))}</span>
          <h1>Votre communauté</h1>
          <p>Les profils qui vous correspondent et ce qui se passe réellement autour de vous.</p>
          <span class="velvet-parity-context-pill">${locationEnabled ? `Actualité personnalisée dans un rayon de ${radius} km` : 'Actualité personnalisée selon vos affinités'}</span>
        </header>

        <section class="velvet-parity-section">
          <div class="velvet-parity-section-head"><div><h2>À découvrir</h2><p>Derniers profils et sélection Zwit Intelligence</p></div><button type="button" data-parity-open-navigation="profiles">Recherche avancée</button></div>
          <div class="velvet-parity-recommendations">${recommendations.length ? recommendations.map(intelligenceProfileCard).join('') : '<div class="velvet-parity-empty">La sélection personnalisée se prépare.</div>'}</div>
        </section>

        <section class="velvet-parity-section">
          <div class="velvet-parity-section-head"><div><h2>Actualité</h2><p>Autour de vous et selon vos critères</p></div><button type="button" data-parity-refresh>Actualiser</button></div>
          <div class="velvet-parity-feed">${feed.length ? feed.map(activityCard).join('') : '<div class="velvet-parity-empty">Nouvelles photos, sorties, mises à jour de profils et réactions apparaîtront ici.</div>'}</div>
        </section>
      </section>`;
      bindParityActions(content);
    } catch (error) {
      content.innerHTML = `<section class="velvet-parity-page"><div class="velvet-parity-empty"><strong>Votre communauté reste disponible.</strong><p>${escapeHtml(error.message)}</p><button type="button" data-parity-refresh>Réessayer</button></div></section>`;
      bindParityActions(content);
    } finally {
      runtime.rendering = false;
    }
  }

  function futureVenueVisits(bundle) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return array(pick(bundle.plans, 'venueVisits', 'venue_visits')).filter((visit) => {
      const value = text(pick(visit, 'visitDate', 'visit_date'));
      return value && dateValue(`${value}T12:00:00`) >= today;
    });
  }

  function attendanceGroups(bundle) {
    const groups = new Map();
    for (const visit of futureVenueVisits(bundle)) {
      const venue = pick(visit, 'venueDirectory', 'venue_directory') || {};
      const id = text(pick(visit, 'venueId', 'venue_id')) || venueId(venue);
      const date = text(pick(visit, 'visitDate', 'visit_date'));
      if (!id || !date) continue;
      const key = `${id}|${date}`;
      if (!groups.has(key)) groups.set(key, { key, venueId: id, venue, date, visits: [] });
      groups.get(key).visits.push(visit);
    }
    return [...groups.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  function participantProfiles(bundle, group) {
    const seen = new Set();
    return group.visits.map((visit) => profileById(bundle, text(pick(visit, 'profileId', 'profile_id'))))
      .filter((profile) => profile && !seen.has(profileId(profile)) && seen.add(profileId(profile)));
  }

  function attendanceCard(bundle, group) {
    const participants = participantProfiles(bundle, group);
    return `<article class="velvet-parity-attendance-card" data-attendance-key="${escapeHtml(group.key)}">
      <header>
        <span class="velvet-parity-date-block"><strong>${escapeHtml(formatDate(`${group.date}T12:00:00`, { day: '2-digit' }))}</strong><small>${escapeHtml(formatDate(`${group.date}T12:00:00`, { month: 'short' }))}</small></span>
        <span><strong>${escapeHtml(venueName(group.venue))}</strong><small>${escapeHtml([venueCategory(group.venue), venueCity(group.venue)].filter(Boolean).join(' · '))}</small></span>
      </header>
      <div class="velvet-parity-participants">
        ${participants.slice(0, 8).map((profile) => `<button type="button" data-parity-profile="${escapeHtml(profileId(profile))}" title="${escapeHtml(displayName(profile))}">${image(primaryPhoto(profile), displayName(profile))}</button>`).join('')}
        <span>${participants.length} profil${participants.length > 1 ? 's' : ''} présent${participants.length > 1 ? 's' : ''}</span>
      </div>
      <button type="button" data-parity-attendance="${escapeHtml(group.key)}">Voir les participants</button>
    </article>`;
  }

  function venueCard(venue, profile) {
    const label = profileType(profile) === 'couple' ? 'Nous y serons' : 'J’y serai';
    return `<article class="velvet-parity-venue-card" data-parity-venue-card="${escapeHtml(venueId(venue))}">
      <header>
        <span class="velvet-parity-venue-icon">⌂</span>
        <span><strong>${escapeHtml(venueName(venue))}</strong><small>${escapeHtml([venueCategory(venue), venueCity(venue), venueDistance(venue)].filter(Boolean).join(' · '))}</small></span>
      </header>
      <p>${escapeHtml(text(pick(venue, 'addressPublic', 'address_public')) || 'Adresse communiquée aux membres admis.')}</p>
      <footer>
        <button type="button" data-parity-select-venue="${escapeHtml(venueId(venue))}">${escapeHtml(label)}</button>
        <button type="button" data-parity-venue-attendance="${escapeHtml(venueId(venue))}">Qui y sera ?</button>
      </footer>
    </article>`;
  }

  function filteredVenues(bundle) {
    const query = runtime.clubQuery.toLocaleLowerCase('fr-FR').trim();
    return venues(bundle)
      .filter((venue) => !query || venueSearchText(venue).includes(query))
      .sort((left, right) => {
        const leftDistance = Number(pick(left, 'distanceKm', 'distance_km'));
        const rightDistance = Number(pick(right, 'distanceKm', 'distance_km'));
        if (Number.isFinite(leftDistance) || Number.isFinite(rightDistance)) {
          return (Number.isFinite(leftDistance) ? leftDistance : 999999) - (Number.isFinite(rightDistance) ? rightDistance : 999999);
        }
        return venueName(left).localeCompare(venueName(right), 'fr');
      });
  }

  function navigationActionCard(icon, title, detail, action, variant = '') {
    return `<button class="velvet-parity-action-card ${escapeHtml(variant)}" type="button" data-parity-nav-action="${escapeHtml(action)}">
      <span class="velvet-parity-action-icon">${escapeHtml(icon)}</span>
      <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span>
      <span aria-hidden="true">→</span>
    </button>`;
  }

  async function renderNavigation({ focus = '', force = false } = {}) {
    if (runtime.rendering) return;
    runtime.rendering = true;
    runtime.route = 'navigation';
    setActiveNavigation('navigation');
    updateHistory('navigation');
    try {
      const bundle = await loadBundle(force);
      const profile = currentProfile(bundle);
      const rows = filteredVenues(bundle).slice(0, 60);
      const selected = venues(bundle).find((venue) => venueId(venue) === runtime.selectedVenueId) || null;
      const groups = attendanceGroups(bundle);
      const label = profileType(profile) === 'couple' ? 'Nous y serons' : 'J’y serai';
      content.innerHTML = `<section class="velvet-parity-page velvet-parity-navigation" data-velvet-community-parity="${PARITY_VERSION}">
        <header class="velvet-parity-community-header compact">
          <span class="velvet-parity-eyebrow">NAVIGATION</span>
          <h1>Tout Zwit, au bon endroit</h1>
          <p>Trouver un profil, choisir un club, annoncer une sortie et voir qui sera présent — sans détour.</p>
        </header>

        <section class="velvet-parity-action-grid" data-parity-action-grid>
          ${navigationActionCard('◇', 'Trouver un profil', 'Recherche avancée, proximité et affinités', 'profiles', 'primary')}
          ${navigationActionCard('⌂', 'Clubs autour de moi', 'Annuaire complet France & Belgique', 'clubs')}
          ${navigationActionCard('✦', label, 'Choisir un club et une date', 'outing')}
          ${navigationActionCard('◎', 'Qui sera présent ?', 'Participants par lieu et par date', 'attendance')}
        </section>

        <section class="velvet-parity-secondary-actions">
          <button type="button" data-parity-route="maps">⌖ Carte Zwit</button>
          <button type="button" data-parity-route="events">☀ Cap d’Agde</button>
          <button type="button" data-parity-route="events">▣ Agenda complet</button>
        </section>

        <section class="velvet-parity-section" id="velvet-club-finder" data-parity-panel="clubs">
          <div class="velvet-parity-section-head"><div><h2>Clubs & établissements</h2><p>Recherche par nom, ville, catégorie, adresse ou univers</p></div><span>${venues(bundle).length} lieux</span></div>
          <label class="velvet-parity-search"><span>⌕</span><input type="search" value="${escapeHtml(runtime.clubQuery)}" placeholder="Nom du club, ville, région…" data-parity-club-query></label>
          <div class="velvet-parity-venue-grid" data-parity-venue-results>${rows.length ? rows.map((venue) => venueCard(venue, profile)).join('') : '<div class="velvet-parity-empty">Aucun établissement ne correspond à cette recherche.</div>'}</div>
        </section>

        <section class="velvet-parity-section" id="velvet-outing-composer" data-parity-panel="outing">
          <div class="velvet-parity-section-head"><div><h2>${escapeHtml(label)}</h2><p>Cette sortie apparaîtra sur votre profil et dans l’actualité</p></div></div>
          <form class="velvet-parity-outing-form" data-parity-outing-form>
            <label>Établissement
              <select name="venueId" required data-parity-venue-select>
                <option value="">Choisir un établissement</option>
                ${filteredVenues(bundle).map((venue) => `<option value="${escapeHtml(venueId(venue))}" ${venueId(venue) === runtime.selectedVenueId ? 'selected' : ''}>${escapeHtml(`${venueName(venue)} — ${venueCity(venue) || venueCategory(venue)}`)}</option>`).join('')}
              </select>
            </label>
            <label>Date
              <input type="date" name="visitDate" min="${new Date().toISOString().slice(0, 10)}" value="${escapeHtml(runtime.outingDate)}" required>
            </label>
            <button type="submit">${escapeHtml(label)}</button>
          </form>
          ${selected ? `<div class="velvet-parity-selected-venue"><strong>${escapeHtml(venueName(selected))}</strong><span>${escapeHtml([venueCategory(selected), venueCity(selected)].filter(Boolean).join(' · '))}</span></div>` : ''}
        </section>

        <section class="velvet-parity-section" id="velvet-attendance-directory" data-parity-panel="attendance">
          <div class="velvet-parity-section-head"><div><h2>Qui sera présent ?</h2><p>Sorties annoncées par la communauté</p></div><span>${groups.length} rendez-vous</span></div>
          <div class="velvet-parity-attendance-grid">${groups.length ? groups.map((group) => attendanceCard(bundle, group)).join('') : '<div class="velvet-parity-empty">Aucune présence annoncée pour le moment.</div>'}</div>
        </section>
      </section>`;
      bindParityActions(content);
      if (focus) window.requestAnimationFrame(() => focusNavigationPanel(focus));
    } catch (error) {
      content.innerHTML = `<section class="velvet-parity-page"><div class="velvet-parity-empty"><strong>Navigation indisponible.</strong><p>${escapeHtml(error.message)}</p><button type="button" data-parity-refresh-navigation>Réessayer</button></div></section>`;
      bindParityActions(content);
    } finally {
      runtime.rendering = false;
    }
  }

  function focusNavigationPanel(name) {
    if (name === 'profiles') return openExistingRoute('discover');
    const target = name === 'clubs'
      ? document.querySelector('#velvet-club-finder')
      : name === 'outing'
        ? document.querySelector('#velvet-outing-composer')
        : document.querySelector('#velvet-attendance-directory');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.classList.add('is-highlighted');
    window.setTimeout(() => target?.classList.remove('is-highlighted'), 1200);
  }

  function openExistingRoute(route) {
    const button = [...document.querySelectorAll(`[data-route="${CSS.escape(route)}"]`)].find((node) => node.offsetParent !== null)
      || document.querySelector(`[data-route="${CSS.escape(route)}"]`);
    if (button) {
      button.click();
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set(ROUTE_QUERY, route);
    location.assign(url);
  }

  function openProfile(id) {
    if (!id) return;
    const existing = document.querySelector(`[data-open-profile="${CSS.escape(id)}"], [data-velvet-profile="${CSS.escape(id)}"]`);
    if (existing) return existing.click();
    const url = new URL(location.href);
    url.searchParams.set('route', 'discover');
    url.searchParams.set('profile', id);
    location.assign(url);
  }

  function showAttendance(key) {
    if (runtime.route !== 'navigation') {
      renderNavigation({ focus: 'attendance' }).then(() => showAttendance(key));
      return;
    }
    const [venueIdValue, visitDate] = String(key || '').split('|');
    const bundle = runtime.bundle;
    const group = attendanceGroups(bundle).find((value) => value.venueId === venueIdValue && value.date === visitDate);
    if (!group) return focusNavigationPanel('attendance');
    const participants = participantProfiles(bundle, group);
    const dialog = document.createElement('dialog');
    dialog.className = 'velvet-parity-dialog';
    dialog.innerHTML = `<div class="velvet-parity-dialog-inner">
      <header><div><span class="velvet-parity-eyebrow">${escapeHtml(formatDate(`${group.date}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('fr-FR'))}</span><h2>${escapeHtml(venueName(group.venue))}</h2><p>${participants.length} profil${participants.length > 1 ? 's' : ''} a${participants.length > 1 ? 'ont' : ''} annoncé sa présence.</p></div><button type="button" data-parity-close>Fermer</button></header>
      <div class="velvet-parity-participant-list">${participants.length ? participants.map((profile) => `<button type="button" data-parity-profile="${escapeHtml(profileId(profile))}">${image(primaryPhoto(profile), displayName(profile))}<span><strong>${escapeHtml(displayName(profile))}</strong><small>${escapeHtml([demographic(profile), ageLabel(profile), memberLocation(profile)].filter(Boolean).join(' · '))}</small></span><span>→</span></button>`).join('') : '<div class="velvet-parity-empty">Les participants ne sont pas encore visibles.</div>'}</div>
    </div>`;
    document.body.append(dialog);
    bindParityActions(dialog);
    dialog.querySelector('[data-parity-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  function showVenueAttendance(venueIdValue) {
    const group = attendanceGroups(runtime.bundle).find((value) => value.venueId === venueIdValue);
    if (group) return showAttendance(group.key);
    toast('Aucune présence annoncée pour cet établissement pour le moment.');
  }

  async function saveOuting(form) {
    const fields = new FormData(form);
    const venueIdValue = text(fields.get('venueId'));
    const visitDate = text(fields.get('visitDate'));
    if (!venueIdValue || !visitDate) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await api('/api/members/plans', {
        method: 'POST',
        body: JSON.stringify({ action: 'venue_visit', venueId: venueIdValue, visitDate })
      });
      runtime.bundle.plans = result;
      runtime.selectedVenueId = venueIdValue;
      runtime.outingDate = visitDate;
      toast('Votre sortie est publiée.');
      await renderNavigation({ focus: 'attendance', force: true });
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  }

  function setActiveNavigation(route) {
    document.querySelectorAll('[data-route], [data-unified-route]').forEach((button) => {
      const active = route === 'navigation'
        ? button.dataset.unifiedRoute === 'navigation'
        : button.dataset.route === route;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function updateHistory(route) {
    const url = new URL(location.href);
    if (url.searchParams.get(ROUTE_QUERY) === route) return;
    url.searchParams.set(ROUTE_QUERY, route);
    url.searchParams.delete('profile');
    url.searchParams.delete('event');
    history.replaceState({ velvetRoute: route }, '', url);
  }

  function closeMobileMenu() {
    const menu = document.querySelector('#mainNav');
    const trigger = document.querySelector('#mobileMenuButton');
    menu?.classList.remove('open', 'is-open', 'visible');
    trigger?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open', 'menu-open');
  }

  function bindParityActions(root) {
    root.querySelectorAll('[data-parity-profile]').forEach((node) => {
      if (node.dataset.parityBound) return;
      node.dataset.parityBound = '1';
      node.addEventListener('click', () => openProfile(node.dataset.parityProfile));
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') openProfile(node.dataset.parityProfile);
      });
    });
    root.querySelectorAll('[data-parity-attendance]').forEach((node) => {
      if (node.dataset.parityBound) return;
      node.dataset.parityBound = '1';
      node.addEventListener('click', (event) => {
        event.stopPropagation();
        showAttendance(node.dataset.parityAttendance);
      });
    });
    root.querySelectorAll('[data-parity-venue-attendance]').forEach((node) => {
      if (node.dataset.parityBound) return;
      node.dataset.parityBound = '1';
      node.addEventListener('click', () => showVenueAttendance(node.dataset.parityVenueAttendance));
    });
    root.querySelectorAll('[data-parity-select-venue]').forEach((node) => {
      if (node.dataset.parityBound) return;
      node.dataset.parityBound = '1';
      node.addEventListener('click', () => {
        runtime.selectedVenueId = node.dataset.paritySelectVenue;
        const select = document.querySelector('[data-parity-venue-select]');
        if (select) select.value = runtime.selectedVenueId;
        focusNavigationPanel('outing');
      });
    });
    root.querySelectorAll('[data-parity-nav-action]').forEach((node) => {
      if (node.dataset.parityBound) return;
      node.dataset.parityBound = '1';
      node.addEventListener('click', () => focusNavigationPanel(node.dataset.parityNavAction));
    });
    root.querySelectorAll('[data-parity-route]').forEach((node) => {
      if (node.dataset.parityBound) return;
      node.dataset.parityBound = '1';
      node.addEventListener('click', () => openExistingRoute(node.dataset.parityRoute));
    });
    root.querySelector('[data-parity-club-query]')?.addEventListener('input', (event) => {
      runtime.clubQuery = event.target.value;
      const profile = currentProfile(runtime.bundle);
      const rows = filteredVenues(runtime.bundle).slice(0, 60);
      const grid = root.querySelector('[data-parity-venue-results]');
      if (grid) {
        grid.innerHTML = rows.length ? rows.map((venue) => venueCard(venue, profile)).join('') : '<div class="velvet-parity-empty">Aucun établissement ne correspond à cette recherche.</div>';
        bindParityActions(grid);
      }
    });
    root.querySelector('[data-parity-venue-select]')?.addEventListener('change', (event) => {
      runtime.selectedVenueId = event.target.value;
    });
    root.querySelector('[data-parity-outing-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      saveOuting(event.currentTarget);
    });
    root.querySelectorAll('[data-parity-refresh]').forEach((node) => node.addEventListener('click', () => renderHome({ force: true })));
    root.querySelectorAll('[data-parity-refresh-navigation]').forEach((node) => node.addEventListener('click', () => renderNavigation({ force: true })));
    root.querySelectorAll('[data-parity-open-navigation]').forEach((node) => node.addEventListener('click', () => renderNavigation({ focus: node.dataset.parityOpenNavigation })));
  }

  function routeFromPage() {
    const urlRoute = new URL(location.href).searchParams.get(ROUTE_QUERY);
    if (urlRoute === 'navigation') return 'navigation';
    const active = document.querySelector('[data-route].active, [data-route][aria-current="page"]');
    return active?.dataset.route || null;
  }

  function installNavigationInterceptors() {
    document.querySelectorAll('[data-unified-route="navigation"]').forEach((button) => {
      if (button.dataset.parityBound) return;
      button.dataset.parityBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeMobileMenu();
        renderNavigation();
      }, true);
    });
  }

  function reconcile() {
    installNavigationInterceptors();
    const route = routeFromPage();
    if (route === 'navigation') {
      if (!content.querySelector('[data-velvet-community-parity].velvet-parity-navigation')) renderNavigation();
      return;
    }
    if (route !== 'home') return;
    content.querySelectorAll('[data-velvet-intelligent-home]:not(.velvet-parity-ownership)').forEach((node) => node.remove());
    if (!content.querySelector('[data-velvet-community-parity].velvet-parity-home')) renderHome();
    else if (!content.querySelector('.velvet-parity-ownership')) content.querySelector('[data-velvet-community-parity]')?.insertAdjacentHTML('afterbegin', hiddenOwnershipMarker());
  }

  document.addEventListener('click', (event) => {
    const routeButton = event.target.closest('[data-route]');
    if (!routeButton) return;
    runtime.route = routeButton.dataset.route;
    if (runtime.route !== 'navigation') {
      const url = new URL(location.href);
      url.searchParams.set(ROUTE_QUERY, runtime.route);
      history.replaceState({ velvetRoute: runtime.route }, '', url);
    }
    window.setTimeout(reconcile, 40);
  }, true);

  window.addEventListener('popstate', () => {
    const route = new URL(location.href).searchParams.get(ROUTE_QUERY);
    if (route === 'navigation') renderNavigation();
    else if (route === 'home') openExistingRoute('home');
  });

  const observer = new MutationObserver(() => window.requestAnimationFrame(reconcile));
  observer.observe(content, { childList: true, subtree: true });

  runtime.refreshTimer = window.setInterval(() => {
    if (routeFromPage() !== 'home') return;
    loadBundle(true).then(() => renderHome({ force: false })).catch(() => null);
  }, 45000);

  installNavigationInterceptors();
  window.setTimeout(reconcile, 120);
})();