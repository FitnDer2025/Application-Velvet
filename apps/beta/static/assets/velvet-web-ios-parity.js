(() => {
  'use strict';

  const content = document.querySelector('#content');
  if (!content) return;

  const VERSION = '20260802-2';
  const OWNED_ROUTES = new Set(['home', 'discover', 'venues', 'profile']);
  const state = {
    route: null,
    bundle: null,
    loadedAt: 0,
    loading: false,
    feedLimit: 12,
    discoverQuery: '',
    discoverType: 'all',
    venueQuery: '',
    venueKind: 'all',
    ownTab: 'overview',
    outingType: 'venue',
    observer: null,
    guard: false,
    timer: null
  };

  const arr = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? '').trim();
  const number = (value) => Number(value);
  const pick = (value, ...keys) => {
    for (const key of keys) {
      if (value && value[key] !== undefined && value[key] !== null) return value[key];
    }
    return null;
  };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const safeId = (value) => String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '');

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  }

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
    node.classList.add('visible');
    window.setTimeout(() => node.classList.remove('visible'), 3400);
  }

  function asDate(value) {
    if (!value) return new Date(0);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function dayDate(value) {
    return asDate(`${text(value) || '1970-01-01'}T12:00:00`);
  }

  function formatDate(value, options = { weekday: 'long', day: 'numeric', month: 'long' }) {
    const date = value instanceof Date ? value : asDate(value);
    return date.getTime() ? new Intl.DateTimeFormat('fr-FR', options).format(date) : '';
  }

  function relativeDate(value) {
    const date = value instanceof Date ? value : asDate(value);
    if (!date.getTime()) return 'Récemment';
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'À l’instant';
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
    if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)} j`;
    return formatDate(date, { day: 'numeric', month: 'short' });
  }

  function ageFromYear(year) {
    const parsed = number(year);
    if (!Number.isInteger(parsed)) return null;
    const age = new Date().getFullYear() - parsed;
    return age >= 18 && age <= 99 ? age : null;
  }

  function profileId(profile) {
    return text(pick(profile, 'id', 'profileId', 'profile_id'));
  }

  function profileType(profile) {
    return text(pick(profile, 'profileType', 'profile_type')).toLowerCase() === 'couple' ? 'couple' : 'individual';
  }

  function displayName(profile) {
    return text(pick(profile, 'displayName', 'display_name', 'name')) || 'Membre Velvet';
  }

  function people(profile) {
    return arr(pick(profile, 'individualProfiles', 'individual_profiles'));
  }

  function personId(person) {
    return text(pick(person, 'id', 'individualProfileId', 'individual_profile_id'));
  }

  function personName(person) {
    return text(pick(person, 'firstName', 'first_name')) || 'Personne';
  }

  function demographic(profile) {
    const direct = text(pick(profile, 'velvetDemographicLabel', 'demographicLabel', 'demographic_label'));
    if (direct) return direct;
    if (profileType(profile) === 'couple') return 'Couple';
    const genders = people(profile).map((person) => text(pick(person, 'genderIdentity', 'gender_identity')).toLowerCase());
    if (genders.some((value) => value.includes('femme'))) return 'Femme seule';
    if (genders.some((value) => value.includes('homme'))) return 'Homme seul';
    if (genders.some((value) => /non.?binaire|queer/.test(value))) return 'Personne non-binaire';
    return 'Membre';
  }

  function ageLabel(profile) {
    const direct = text(pick(profile, 'velvetAgeLabel', 'ageLabel', 'age_label'));
    if (direct) return direct;
    const ages = people(profile).map((person) => ageFromYear(pick(person, 'birthYear', 'birth_year'))).filter(Boolean);
    return ages.length ? `${ages.join(' & ')} ans` : '';
  }

  function locationLabel(profile) {
    return text(pick(profile, 'locationZone', 'location_zone', 'city')) || 'Zone privée';
  }

  function profileMeta(profile) {
    return [demographic(profile), ageLabel(profile), locationLabel(profile)].filter(Boolean).join(' · ');
  }

  function rawProfileMedia(profile) {
    return [
      ...arr(pick(profile, 'profileGalleryPhotos', 'profile_gallery_photos')),
      ...arr(pick(profile, 'mediaAssets', 'media_assets')),
      ...arr(pick(profile, 'photos'))
    ];
  }

  function mediaUrl(media) {
    return text(pick(media, 'previewUrl', 'preview_url', 'signedUrl', 'signed_url', 'url'));
  }

  function profilePhotos(profile) {
    const seen = new Set();
    return rawProfileMedia(profile)
      .filter((media) => {
        const moderation = text(pick(media, 'moderationStatus', 'moderation_status')).toLowerCase();
        const role = text(pick(media, 'mediaRole', 'media_role')).toLowerCase();
        const url = mediaUrl(media);
        if (!url || seen.has(url)) return false;
        if (moderation && moderation !== 'approved') return false;
        if (role && !['couple_gallery', 'individual_gallery', 'profile', 'avatar'].includes(role)) return false;
        seen.add(url);
        return true;
      })
      .sort((left, right) => Number(Boolean(pick(right, 'isPrimary', 'is_primary'))) - Number(Boolean(pick(left, 'isPrimary', 'is_primary'))));
  }

  function primaryPhoto(profile) {
    const photos = profilePhotos(profile);
    return mediaUrl(photos.find((photo) => pick(photo, 'isPrimary', 'is_primary') === true) || photos[0]);
  }

  function personPhotos(profile, person) {
    return profilePhotos(profile).filter((media) => text(pick(media, 'individualProfileId', 'individual_profile_id')) === personId(person));
  }

  function image(url, alt, className = '', eager = false) {
    return url
      ? `<img class="${esc(className)}" src="${esc(url)}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`
      : `<span class="web-parity-placeholder ${esc(className)}" aria-hidden="true">V</span>`;
  }

  function profiles(bundle = state.bundle) {
    return arr(pick(bundle?.directory, 'profiles'));
  }

  function currentProfile(bundle = state.bundle) {
    return bundle?.profile?.profile || bundle?.profile || null;
  }

  function profileById(id, bundle = state.bundle) {
    return profiles(bundle).find((profile) => profileId(profile) === text(id)) || null;
  }

  function venues(bundle = state.bundle) {
    return arr(pick(bundle?.directory, 'venueDirectory', 'venue_directory'));
  }

  function venueId(venue) {
    return text(pick(venue, 'id', 'venueId', 'venue_id'));
  }

  function venueName(venue) {
    return text(pick(venue, 'name', 'displayName', 'display_name')) || 'Établissement Velvet';
  }

  function venueCity(venue) {
    return text(pick(venue, 'city'));
  }

  function venueKind(venue) {
    return text(pick(venue, 'categoryPrimary', 'category_primary', 'kind')) || 'Établissement';
  }

  function venueById(id, bundle = state.bundle) {
    return venues(bundle).find((venue) => venueId(venue) === text(id)) || null;
  }

  function visits(bundle = state.bundle) {
    return arr(pick(bundle?.plans, 'venueVisits', 'venue_visits'));
  }

  function travelPlans(bundle = state.bundle) {
    return arr(pick(bundle?.plans, 'travelPlans', 'travel_plans'));
  }

  function directoryEvents(bundle = state.bundle) {
    return arr(pick(bundle?.directory, 'events'));
  }

  function establishments(bundle = state.bundle) {
    return arr(pick(bundle?.directory, 'establishments'));
  }

  function visitVenue(visit, bundle = state.bundle) {
    return pick(visit, 'venueDirectory', 'venue_directory') || venueById(pick(visit, 'venueId', 'venue_id'), bundle) || {};
  }

  function participantsFor(venueIdValue, day, bundle = state.bundle) {
    const seen = new Set();
    return visits(bundle)
      .filter((visit) => text(pick(visit, 'venueId', 'venue_id')) === text(venueIdValue)
        && text(pick(visit, 'visitDate', 'visit_date')) === text(day))
      .map((visit) => profileById(pick(visit, 'profileId', 'profile_id'), bundle))
      .filter((profile) => profile && !seen.has(profileId(profile)) && seen.add(profileId(profile)));
  }

  function establishmentForVenue(venue, bundle = state.bundle) {
    return establishments(bundle).find((item) => text(pick(item, 'directoryVenueId', 'directory_venue_id')) === venueId(venue)) || null;
  }

  function eventsForVenue(venue, bundle = state.bundle) {
    const establishment = establishmentForVenue(venue, bundle);
    const name = venueName(venue).toLocaleLowerCase('fr');
    const city = venueCity(venue).toLocaleLowerCase('fr');
    return directoryEvents(bundle)
      .filter((event) => {
        const establishmentMatch = establishment
          && text(pick(event, 'establishmentId', 'establishment_id')) === text(establishment.id);
        const location = text(pick(event, 'locationPublic', 'location_public')).toLocaleLowerCase('fr');
        return establishmentMatch || location.includes(name) || (city && location.includes(city));
      })
      .sort((left, right) => asDate(pick(left, 'startsAt', 'starts_at')) - asDate(pick(right, 'startsAt', 'starts_at')));
  }

  async function loadBundle(force = false) {
    if (state.bundle && !force && Date.now() - state.loadedAt < 30000) return state.bundle;
    if (state.loading) {
      while (state.loading) await new Promise((resolve) => setTimeout(resolve, 60));
      return state.bundle;
    }
    state.loading = true;
    try {
      const results = await Promise.allSettled([
        api('/api/members/profile'),
        api('/api/members/directory'),
        api('/api/members/plans'),
        api('/api/members/home-intelligence'),
        api('/api/members/notifications')
      ]);
      const value = (index, fallback) => results[index].status === 'fulfilled' ? results[index].value : fallback;
      state.bundle = {
        profile: value(0, state.bundle?.profile || {}),
        directory: value(1, state.bundle?.directory || {}),
        plans: value(2, state.bundle?.plans || { venueVisits: [], travelPlans: [] }),
        intelligence: value(3, state.bundle?.intelligence || {}),
        notifications: value(4, state.bundle?.notifications || { notifications: [] })
      };
      state.loadedAt = Date.now();
      updateBadges();
      return state.bundle;
    } finally {
      state.loading = false;
    }
  }

  function updateBadges() {
    const unreadMessages = Number(pick(state.bundle?.directory, 'messageUnreadCount', 'message_unread_count') || 0);
    const unreadNotifications = Number(pick(state.bundle?.notifications, 'unreadCount', 'unread_count') || 0);
    document.querySelectorAll('[data-message-badge]').forEach((node) => {
      node.hidden = unreadMessages < 1;
      node.textContent = unreadMessages > 99 ? '99+' : String(unreadMessages);
    });
    document.querySelectorAll('[data-notification-badge]').forEach((node) => {
      node.hidden = unreadNotifications < 1;
      node.textContent = unreadNotifications > 99 ? '99+' : String(unreadNotifications);
    });
  }

  function setActive(route) {
    document.querySelectorAll('[data-web-route], [data-route]').forEach((node) => {
      const value = node.dataset.webRoute || node.dataset.route;
      const active = value === route;
      node.classList.toggle('active', active);
      if (active) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    });
  }

  function updateUrl(route) {
    const url = new URL(location.href);
    url.searchParams.set('route', route);
    url.searchParams.delete('profile');
    url.searchParams.delete('venue');
    history.replaceState({ velvetWebRoute: route }, '', url);
  }

  function pageHeader(eyebrow, title, subtitle, action = '') {
    return `<header class="web-parity-page-header"><div><span>${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${action}</header>`;
  }

  function profileIdentity(profile, compact = false) {
    return `<button type="button" class="web-parity-identity${compact ? ' compact' : ''}" data-open-profile="${esc(profileId(profile))}">
      ${image(primaryPhoto(profile), displayName(profile), 'web-parity-avatar', true)}
      <span><strong>${esc(displayName(profile))}</strong><small>${esc(profileMeta(profile))}</small></span>
    </button>`;
  }

  function recommendedProfiles(bundle) {
    const curated = arr(pick(bundle.intelligence, 'curatedProfiles', 'curated_profiles'));
    const fallback = profiles(bundle).map((profile) => ({
      id: profileId(profile),
      displayName: displayName(profile),
      photoUrl: primaryPhoto(profile),
      demographicLabel: demographic(profile),
      ageLabel: ageLabel(profile),
      locationZone: locationLabel(profile),
      compatibilityScore: 0
    }));
    const seen = new Set();
    return [...curated, ...fallback].filter((item) => {
      const id = text(item.id);
      return id && id !== profileId(currentProfile(bundle)) && !seen.has(id) && seen.add(id);
    }).slice(0, 12);
  }

  function recommendationCard(item) {
    const profile = profileById(item.id);
    const meta = profile ? profileMeta(profile) : [item.demographicLabel, item.ageLabel, item.locationZone].filter(Boolean).join(' · ');
    const photo = item.photoUrl || primaryPhoto(profile);
    return `<button type="button" class="web-parity-recommendation" data-open-profile="${esc(item.id)}">
      <span class="web-parity-recommendation-photo">${image(photo, item.displayName || displayName(profile), '', true)}<em>${Number(item.compatibilityScore) ? `${item.compatibilityScore}%` : 'Velvet'}</em></span>
      <span><strong>${esc(item.displayName || displayName(profile))}</strong><small>${esc(meta)}</small></span>
    </button>`;
  }

  function buildFeed(bundle) {
    const ownId = profileId(currentProfile(bundle));
    const items = [];

    profiles(bundle).forEach((profile) => {
      if (!profileId(profile) || profileId(profile) === ownId) return;
      const photos = profilePhotos(profile);
      const latestPhoto = [...photos].sort((a, b) => asDate(pick(b, 'createdAt', 'created_at')) - asDate(pick(a, 'createdAt', 'created_at')))[0];
      const createdAt = asDate(pick(profile, 'createdAt', 'created_at'));
      const updatedAt = asDate(pick(profile, 'updatedAt', 'updated_at'));
      const photoCreatedAt = asDate(pick(latestPhoto, 'createdAt', 'created_at'));
      let title = profileType(profile) === 'couple' ? 'vient de rejoindre la communauté' : 'vient de rejoindre Velvet';
      let date = createdAt;
      if (latestPhoto && photoCreatedAt > new Date(createdAt.getTime() + 3600000)) {
        title = 'a publié une nouvelle photo';
        date = photoCreatedAt;
      } else if (updatedAt > new Date(createdAt.getTime() + 12 * 3600000)) {
        title = 'a enrichi son profil';
        date = updatedAt;
      }
      items.push({
        id: `profile-${profileId(profile)}-${date.getTime()}`,
        kind: 'profile',
        profile,
        title,
        detail: text(pick(profile, 'description')) || profileMeta(profile),
        photo: latestPhoto ? mediaUrl(latestPhoto) : primaryPhoto(profile),
        createdAt: date
      });
    });

    const visitGroups = new Map();
    visits(bundle).forEach((visit) => {
      const memberId = text(pick(visit, 'profileId', 'profile_id'));
      if (!memberId || memberId === ownId || !profileById(memberId, bundle)) return;
      const key = `${text(pick(visit, 'venueId', 'venue_id'))}|${text(pick(visit, 'visitDate', 'visit_date'))}`;
      if (!visitGroups.has(key)) visitGroups.set(key, []);
      visitGroups.get(key).push(visit);
    });
    visitGroups.forEach((rows, key) => {
      const visit = rows[0];
      const profile = profileById(pick(visit, 'profileId', 'profile_id'), bundle);
      const venue = visitVenue(visit, bundle);
      const day = text(pick(visit, 'visitDate', 'visit_date'));
      items.push({
        id: `outing-${key}`,
        kind: 'outing',
        profile,
        title: profileType(profile) === 'couple' ? 'seront présents' : 'sera présent·e',
        detail: `${venueName(venue)} · ${formatDate(dayDate(day))}`,
        venue,
        day,
        attendees: participantsFor(venueId(venue), day, bundle),
        createdAt: new Date(Math.max(dayDate(day).getTime(), ...rows.map((row) => asDate(pick(row, 'updatedAt', 'updated_at', 'createdAt', 'created_at')).getTime())))
      });
    });

    travelPlans(bundle).forEach((plan) => {
      const profile = profileById(pick(plan, 'profileId', 'profile_id'), bundle);
      if (!profile || profileId(profile) === ownId) return;
      items.push({
        id: `travel-${text(plan.id)}`,
        kind: 'travel',
        profile,
        title: 'a annoncé une sortie',
        detail: [pick(plan, 'title'), pick(plan, 'locationLabel', 'location_label')].filter(Boolean).join(' · '),
        startsOn: text(pick(plan, 'startsOn', 'starts_on')),
        endsOn: text(pick(plan, 'endsOn', 'ends_on')),
        destinationType: text(pick(plan, 'destinationType', 'destination_type')),
        createdAt: asDate(pick(plan, 'updatedAt', 'updated_at', 'createdAt', 'created_at'))
      });
    });

    return items.sort((left, right) => right.createdAt - left.createdAt).slice(0, 160);
  }

  function attendeeChip(profile) {
    return `<button type="button" class="web-parity-attendee" data-open-profile="${esc(profileId(profile))}">
      ${image(primaryPhoto(profile), displayName(profile), '', true)}
      <span><strong>${esc(displayName(profile))}</strong><small>${esc([demographic(profile), ageLabel(profile)].filter(Boolean).join(' · '))}</small></span>
    </button>`;
  }

  function feedCard(item) {
    const profile = item.profile;
    const profileAction = profile ? `data-open-profile="${esc(profileId(profile))}"` : '';
    let body = '';
    if (item.kind === 'outing') {
      body = `<section class="web-parity-outing">
        <button type="button" class="web-parity-place" data-open-venue="${esc(venueId(item.venue))}"><span>⌂</span><span><strong>${esc(venueName(item.venue))}</strong><small>${esc([venueKind(item.venue), venueCity(item.venue)].filter(Boolean).join(' · '))}</small></span><b>›</b></button>
        <div class="web-parity-outing-date"><strong>${esc(formatDate(dayDate(item.day)))}</strong><span>${item.attendees.length} profil${item.attendees.length > 1 ? 's' : ''} annoncé${item.attendees.length > 1 ? 's' : ''}</span></div>
        <div class="web-parity-attendees">${item.attendees.slice(0, 8).map(attendeeChip).join('')}</div>
      </section>`;
    } else if (item.kind === 'travel') {
      body = `<section class="web-parity-travel"><span>${item.destinationType === 'cap_dagde_village' ? '☀' : '✦'}</span><div><strong>${esc(item.detail)}</strong><small>${esc([formatDate(dayDate(item.startsOn)), item.endsOn && item.endsOn !== item.startsOn ? `au ${formatDate(dayDate(item.endsOn))}` : ''].filter(Boolean).join(' '))}</small></div></section>`;
    } else {
      body = `<button type="button" class="web-parity-feed-photo" ${profileAction}>${image(item.photo, item.title, '', true)}</button>`;
    }

    return `<article class="web-parity-feed-card">
      <header>${profileIdentity(profile, true)}<time>${esc(relativeDate(item.createdAt))}</time></header>
      <p class="web-parity-feed-title"><strong>${esc(displayName(profile))}</strong> ${esc(item.title)}</p>
      ${body}
      <footer><button type="button" ${profileAction}>Voir le profil</button>${item.venue ? `<button type="button" data-open-venue="${esc(venueId(item.venue))}">Voir le lieu</button>` : ''}</footer>
    </article>`;
  }

  function observeFeed(feed) {
    state.observer?.disconnect();
    const sentinel = content.querySelector('[data-feed-sentinel]');
    if (!sentinel) return;
    state.observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      state.feedLimit += 10;
      renderHome(false, feed);
    }, { rootMargin: '260px' });
    state.observer.observe(sentinel);
  }

  async function renderHome(force = false, preparedFeed = null) {
    state.route = 'home';
    setActive('home');
    updateUrl('home');
    const bundle = await loadBundle(force);
    const profile = currentProfile(bundle);
    const feed = preparedFeed || buildFeed(bundle);
    const visible = feed.slice(0, state.feedLimit);
    content.innerHTML = `<section class="web-parity-page web-parity-home" data-people-first="${VERSION}" data-web-parity>
      ${pageHeader(`Bonjour ${displayName(profile)}`, 'Actualité', 'Les personnes, leurs photos et les sorties qui prennent vie autour de vous.', '<button class="web-parity-refresh" type="button" data-refresh-home>Actualiser</button>')}
      <section class="web-parity-discovery-strip"><div class="web-parity-section-title"><div><span>À DÉCOUVRIR</span><h2>Les profils qui comptent</h2></div><button type="button" data-web-route="discover">Tout voir</button></div><div class="web-parity-recommendations">${recommendedProfiles(bundle).map(recommendationCard).join('')}</div></section>
      <section class="web-parity-timeline"><div class="web-parity-section-title"><div><span>FIL COMMUNAUTAIRE</span><h2>Ce qui se passe maintenant</h2></div></div><div class="web-parity-feed">${visible.map(feedCard).join('') || '<div class="web-parity-empty">Le fil se remplira avec l’activité des membres et des sorties.</div>'}</div>${visible.length < feed.length ? '<div class="web-parity-sentinel" data-feed-sentinel><span></span></div>' : ''}</section>
    </section>`;
    bind(content);
    observeFeed(feed);
  }

  function discoverRows(bundle) {
    const ownId = profileId(currentProfile(bundle));
    const query = state.discoverQuery.toLocaleLowerCase('fr').trim();
    return profiles(bundle).filter((profile) => {
      if (profileId(profile) === ownId) return false;
      const type = profileType(profile);
      const demo = demographic(profile).toLowerCase();
      const matchesType = state.discoverType === 'all'
        || state.discoverType === type
        || (state.discoverType === 'woman' && demo.includes('femme'))
        || (state.discoverType === 'man' && demo.includes('homme'));
      const haystack = [displayName(profile), profileMeta(profile), pick(profile, 'description'), pick(profile, 'story'), ...arr(pick(profile, 'practices')), ...arr(pick(profile, 'valuesList', 'values_list'))].filter(Boolean).join(' ').toLocaleLowerCase('fr');
      return matchesType && (!query || haystack.includes(query));
    });
  }

  function discoveryCard(profile) {
    return `<button type="button" class="web-parity-member-card" data-open-profile="${esc(profileId(profile))}">
      <span class="web-parity-member-photo">${image(primaryPhoto(profile), displayName(profile), '', true)}${pick(profile, 'verificationStatus', 'verification_status') === 'verified' ? '<em>✓</em>' : ''}</span>
      <span class="web-parity-member-copy"><strong>${esc(displayName(profile))}</strong><small>${esc(profileMeta(profile))}</small><p>${esc(text(pick(profile, 'description')) || 'Profil Velvet')}</p></span>
    </button>`;
  }

  async function renderDiscover(force = false) {
    state.route = 'discover';
    setActive('discover');
    updateUrl('discover');
    const bundle = await loadBundle(force);
    const rows = discoverRows(bundle);
    content.innerHTML = `<section class="web-parity-page" data-web-parity>
      ${pageHeader('MEMBRES', 'Découvrir', 'La recherche des personnes est séparée des lieux. Chaque vignette montre immédiatement la photo et les informations essentielles.')}
      <section class="web-parity-filters"><label><span>⌕</span><input data-discover-query type="search" value="${esc(state.discoverQuery)}" placeholder="Nom, ville, pratique, envie…"></label><div>${[['all','Tous'],['couple','Couples'],['woman','Femmes'],['man','Hommes'],['individual','Personnes seules']].map(([value,label]) => `<button type="button" data-discover-type="${value}" class="${state.discoverType === value ? 'selected' : ''}">${label}</button>`).join('')}</div></section>
      <div class="web-parity-result-count"><strong>${rows.length}</strong> profil${rows.length > 1 ? 's' : ''}</div>
      <section class="web-parity-member-grid" data-discover-results>${rows.map(discoveryCard).join('') || '<div class="web-parity-empty">Aucun profil ne correspond à cette recherche.</div>'}</section>
    </section>`;
    bind(content);
  }

  function filteredVenues(bundle) {
    const query = state.venueQuery.toLowerCase().trim();
    return venues(bundle).filter((venue) => {
      const source = [venueName(venue), venueCity(venue), venueKind(venue), pick(venue, 'kind'), pick(venue, 'addressPublic', 'address_public'), ...arr(pick(venue, 'categoryTags', 'category_tags'))].filter(Boolean).join(' ').toLowerCase();
      const typeMatches = state.venueKind === 'all' || source.includes(state.venueKind);
      return typeMatches && (!query || source.includes(query));
    }).sort((left, right) => {
      const leftDistance = number(pick(left, 'distanceKm', 'distance_km'));
      const rightDistance = number(pick(right, 'distanceKm', 'distance_km'));
      if (Number.isFinite(leftDistance) || Number.isFinite(rightDistance)) return (Number.isFinite(leftDistance) ? leftDistance : 99999) - (Number.isFinite(rightDistance) ? rightDistance : 99999);
      return venueName(left).localeCompare(venueName(right), 'fr');
    });
  }

  function upcomingAttendance(venue, bundle) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const groups = new Map();
    visits(bundle).forEach((visit) => {
      if (text(pick(visit, 'venueId', 'venue_id')) !== venueId(venue)) return;
      const day = text(pick(visit, 'visitDate', 'visit_date'));
      if (dayDate(day) < today) return;
      if (!groups.has(day)) groups.set(day, participantsFor(venueId(venue), day, bundle));
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }

  function venueCard(venue, bundle) {
    const attendance = upcomingAttendance(venue, bundle);
    const profilesPreview = attendance.flatMap(([, rows]) => rows).filter((profile, index, all) => all.findIndex((item) => profileId(item) === profileId(profile)) === index).slice(0, 6);
    const events = eventsForVenue(venue, bundle).filter((event) => asDate(pick(event, 'startsAt', 'starts_at')) >= new Date());
    return `<article class="web-parity-venue-card">
      <button type="button" class="web-parity-venue-main" data-open-venue="${esc(venueId(venue))}"><span>⌂</span><span><strong>${esc(venueName(venue))}</strong><small>${esc([venueKind(venue), venueCity(venue)].filter(Boolean).join(' · '))}</small><em>${events.length} soirée${events.length > 1 ? 's' : ''} · ${attendance.length} date${attendance.length > 1 ? 's' : ''}</em></span><b>›</b></button>
      <div class="web-parity-venue-people">${profilesPreview.length ? `<div>${profilesPreview.map((profile) => image(primaryPhoto(profile), displayName(profile), '', true)).join('')}</div><span>${profilesPreview.map(displayName).slice(0, 3).join(', ')}${profilesPreview.length > 3 ? '…' : ''}</span>` : '<span>Aucun membre déclaré pour le moment</span>'}</div>
    </article>`;
  }

  async function renderVenues(force = false) {
    state.route = 'venues';
    setActive('venues');
    updateUrl('venues');
    const bundle = await loadBundle(force);
    const rows = filteredVenues(bundle);
    content.innerHTML = `<section class="web-parity-page" data-people-first="${VERSION}" data-web-parity>
      ${pageHeader('LIEUX & SORTIES', 'Clubs et établissements', 'Les établissements disposent de leur propre recherche, de leur programmation et des membres qui ont annoncé leur présence.')}
      <section class="web-parity-filters"><label><span>⌕</span><input data-venue-query type="search" value="${esc(state.venueQuery)}" placeholder="Nom, ville, club, spa…"></label><div>${[['all','Tous'],['club','Clubs'],['spa','Spas'],['bar','Bars'],['love','Love rooms']].map(([value,label]) => `<button type="button" data-venue-kind="${value}" class="${state.venueKind === value ? 'selected' : ''}">${label}</button>`).join('')}</div></section>
      <div class="web-parity-result-count"><strong>${rows.length}</strong> établissement${rows.length > 1 ? 's' : ''}</div>
      <section class="web-parity-venue-grid" data-venue-results>${rows.map((venue) => venueCard(venue, bundle)).join('') || '<div class="web-parity-empty">Aucun établissement ne correspond à cette recherche.</div>'}</section>
    </section>`;
    bind(content);
  }

  function tags(values, empty = '') {
    const rows = arr(values).filter(Boolean);
    return rows.length ? `<div class="web-parity-tags">${rows.map((value) => `<em>${esc(value)}</em>`).join('')}</div>` : (empty ? `<p class="web-parity-muted">${esc(empty)}</p>` : '');
  }

  function infoSection(eyebrow, title, body) {
    return `<section class="web-parity-info-section"><span>${esc(eyebrow)}</span><h2>${esc(title)}</h2>${body}</section>`;
  }

  function profileRecommendations(profile, bundle) {
    const rows = arr(pick(bundle?.directory, 'recommendations')).filter((recommendation) => text(pick(recommendation, 'targetType', 'target_type')) === 'profile' && text(pick(recommendation, 'targetId', 'target_id')) === profileId(profile));
    if (!rows.length) return '<p class="web-parity-muted">Aucune recommandation reçue pour le moment.</p>';
    return `<div class="web-parity-recommendations-list">${rows.map((recommendation) => {
      const author = profileById(pick(recommendation, 'authorProfileId', 'author_profile_id'), bundle);
      return `<article><strong>${esc(author ? displayName(author) : 'Membre Velvet')}</strong>${pick(recommendation, 'rating') ? `<em>${esc(pick(recommendation, 'rating'))}/5</em>` : ''}<p>${esc(pick(recommendation, 'body'))}</p></article>`;
    }).join('')}</div>`;
  }

  function profileOverview(profile, bundle) {
    return `<div class="web-parity-profile-sections">
      ${infoSection('EN QUELQUES MOTS', profileType(profile) === 'couple' ? 'Notre univers' : 'Mon univers', `<p class="web-parity-quote">${esc(text(pick(profile, 'description')) || 'Ce profil n’a pas encore publié sa présentation.')}</p>${tags(pick(profile, 'valuesList', 'values_list'), 'Valeurs non renseignées')}`)}
      ${infoSection('LE RÉCIT', profileType(profile) === 'couple' ? 'Notre histoire' : 'Mon histoire', `<p>${esc(text(pick(profile, 'story')) || 'Histoire non renseignée.')}</p>`)}
      ${infoSection('LE CHEMIN PARCOURU', profileType(profile) === 'couple' ? 'Notre parcours' : 'Mon parcours', `<p>${esc(text(pick(profile, 'journey')) || 'Parcours non renseigné.')}</p>`)}
      ${infoSection('LES RENCONTRES SOUHAITÉES', profileType(profile) === 'couple' ? 'Ce que nous recherchons' : 'Ce que je recherche', `<p>${esc(text(pick(profile, 'searchText', 'search_text')) || 'Recherche non renseignée.')}</p>`)}
      ${infoSection('ENVIES', 'Pratiques & expériences', tags(pick(profile, 'practices'), 'Pratiques non renseignées'))}
      ${people(profile).length ? infoSection(profileType(profile) === 'couple' ? 'LES PERSONNES' : 'LA PERSONNE', profileType(profile) === 'couple' ? 'Derrière ce profil' : 'À propos de ce membre', `<div class="web-parity-person-list">${people(profile).map((person) => `<button type="button" data-profile-section="person-${esc(personId(person))}"><strong>${esc(personName(person))}</strong><small>${esc([pick(person, 'genderIdentity', 'gender_identity'), ageFromYear(pick(person, 'birthYear', 'birth_year')) ? `${ageFromYear(pick(person, 'birthYear', 'birth_year'))} ans` : ''].filter(Boolean).join(' · '))}</small><span>›</span></button>`).join('')}</div>`) : ''}
      ${infoSection('LOCALISATION PUBLIQUE', locationLabel(profile), '<p class="web-parity-muted">Seule la zone choisie par ce membre est affichée.</p>')}
      ${infoSection('LIEUX PRÉFÉRÉS', profileType(profile) === 'couple' ? 'Nos endroits' : 'Mes endroits', tags(pick(profile, 'favoritePlaces', 'favorite_places'), 'Aucun lieu renseigné'))}
      ${infoSection('DISPONIBILITÉS', profileType(profile) === 'couple' ? 'Nos moments' : 'Mes moments', `<p>${esc(text(pick(profile, 'availabilityText', 'availability_text')) || 'Disponibilités non renseignées.')}</p>`)}
      ${infoSection('LA COMMUNAUTÉ', 'Recommandations', profileRecommendations(profile, bundle))}
    </div>`;
  }

  function personFacts(person) {
    const rows = [
      ['Identité', pick(person, 'genderIdentity', 'gender_identity')],
      ['Âge', ageFromYear(pick(person, 'birthYear', 'birth_year')) ? `${ageFromYear(pick(person, 'birthYear', 'birth_year'))} ans` : ''],
      ['Morphologie', pick(person, 'morphology')],
      ['Taille', pick(person, 'heightCm', 'height_cm') ? `${pick(person, 'heightCm', 'height_cm')} cm` : ''],
      ['Poids', pick(person, 'weightKg', 'weight_kg') ? `${pick(person, 'weightKg', 'weight_kg')} kg` : ''],
      ['Cheveux', pick(person, 'hairColor', 'hair_color')],
      ['Yeux', pick(person, 'eyeColor', 'eye_color')],
      ['Fréquence', pick(person, 'frequency')]
    ].filter(([, value]) => text(value));
    return `<dl class="web-parity-facts">${rows.map(([label,value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
  }

  function personContent(profile, person) {
    const photos = personPhotos(profile, person);
    return `<div class="web-parity-profile-sections">
      ${infoSection('PORTRAIT PERSONNEL', personName(person), `<p class="web-parity-quote">${esc(text(pick(person, 'biography')) || 'Présentation personnelle non renseignée.')}</p>${personFacts(person)}`)}
      ${infoSection('ORIENTATION ET ATTIRANCES', text(pick(person, 'orientation')) || 'Attirances', tags(pick(person, 'attractedTo', 'attracted_to'), 'Attirances non renseignées'))}
      ${infoSection('ENVIES PERSONNELLES', `Ce que ${personName(person)} souhaite vivre`, tags(pick(person, 'desiredPractices', 'desired_practices'), 'Envies non renseignées'))}
      ${profileType(profile) === 'couple' ? infoSection('ACCORDS DU COUPLE', 'Permissions du ou de la partenaire', tags(pick(person, 'partnerPermissions', 'partner_permissions'), 'Accords non renseignés')) : ''}
      ${infoSection('PHOTOS INDIVIDUELLES', `Galerie de ${personName(person)}`, photos.length ? `<div class="web-parity-photo-grid">${photos.map((media) => `<button type="button" data-lightbox="${esc(mediaUrl(media))}">${image(mediaUrl(media), personName(person), '', true)}</button>`).join('')}</div>` : '<p class="web-parity-muted">Aucune photo individuelle publique.</p>')}
    </div>`;
  }

  function profileAlbums(profile) {
    return arr(pick(profile, 'albums'));
  }

  function albumMedia(album) {
    return arr(pick(album, 'mediaAssets', 'media_assets')).filter((media) => mediaUrl(media));
  }

  function profileMediaContent(profile) {
    const photos = profilePhotos(profile);
    const albums = profileAlbums(profile);
    return `<div class="web-parity-profile-sections">
      ${infoSection('PHOTOS PUBLIQUES', `${photos.length} photo${photos.length > 1 ? 's' : ''}`, photos.length ? `<div class="web-parity-photo-grid">${photos.map((media) => `<button type="button" data-lightbox="${esc(mediaUrl(media))}">${image(mediaUrl(media), displayName(profile), '', true)}</button>`).join('')}</div>` : '<p class="web-parity-muted">Aucune photo visible.</p>')}
      ${infoSection('COLLECTIONS PUBLIQUES ET AUTORISÉES', 'Albums du profil', albums.length ? `<div class="web-parity-album-list">${albums.map((album) => `<article><header><strong>${esc(pick(album, 'name') || 'Album')}</strong><small>${text(pick(album, 'confidentiality')) === 'public' ? 'Album public' : 'Album privé autorisé'}</small></header><div>${albumMedia(album).slice(0, 4).map((media) => `<button type="button" data-lightbox="${esc(mediaUrl(media))}">${image(mediaUrl(media), pick(album, 'name') || 'Album', '', true)}</button>`).join('') || '<span class="web-parity-muted">Album vide</span>'}</div></article>`).join('')}</div>` : '<p class="web-parity-muted">Aucun album accessible.</p>')}
    </div>`;
  }

  function profileVisits(profile, bundle) {
    return visits(bundle).filter((visit) => text(pick(visit, 'profileId', 'profile_id')) === profileId(profile));
  }

  function profileTravels(profile, bundle) {
    return travelPlans(bundle).filter((plan) => text(pick(plan, 'profileId', 'profile_id')) === profileId(profile));
  }

  function profileOutingCard(profile, visit, bundle) {
    const venue = visitVenue(visit, bundle);
    const day = text(pick(visit, 'visitDate', 'visit_date'));
    const companions = participantsFor(venueId(venue), day, bundle).filter((member) => profileId(member) !== profileId(profile));
    return `<article class="web-parity-profile-outing"><button type="button" data-open-venue="${esc(venueId(venue))}"><span><strong>${esc(formatDate(dayDate(day), { day: '2-digit' }))}</strong><small>${esc(formatDate(dayDate(day), { month: 'short' }))}</small></span><span><strong>${esc(venueName(venue))}</strong><small>${esc([venueKind(venue), venueCity(venue)].filter(Boolean).join(' · '))}</small></span><b>›</b></button>${companions.length ? `<div><span>Également présents</span>${companions.slice(0, 6).map(attendeeChip).join('')}</div>` : ''}</article>`;
  }

  function profileOutings(profile, bundle, own = false) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const all = profileVisits(profile, bundle);
    const upcoming = all.filter((visit) => dayDate(pick(visit, 'visitDate', 'visit_date')) >= today).sort((a,b) => dayDate(pick(a, 'visitDate', 'visit_date')) - dayDate(pick(b, 'visitDate', 'visit_date')));
    const history = all.filter((visit) => dayDate(pick(visit, 'visitDate', 'visit_date')) < today).sort((a,b) => dayDate(pick(b, 'visitDate', 'visit_date')) - dayDate(pick(a, 'visitDate', 'visit_date')));
    const travels = profileTravels(profile, bundle);
    const futureTitle = profileType(profile) === 'couple' ? 'On y sera' : 'J’y serai';
    const historyTitle = profileType(profile) === 'couple' ? 'On y était' : 'J’y étais';
    return `<div class="web-parity-outing-history">
      <section><div class="web-parity-section-title"><div><span>À VENIR</span><h2>${futureTitle}</h2></div><strong>${upcoming.length + travels.length}</strong></div>${upcoming.map((visit) => profileOutingCard(profile, visit, bundle)).join('')}${travels.map((plan) => `<article class="web-parity-travel"><span>${text(pick(plan, 'destinationType', 'destination_type')) === 'cap_dagde_village' ? '☀' : '✦'}</span><div><strong>${esc(pick(plan, 'title') || 'Sortie')}</strong><small>${esc(pick(plan, 'locationLabel', 'location_label') || 'Lieu à confirmer')}</small></div></article>`).join('') || (!upcoming.length ? '<div class="web-parity-empty compact">Aucune sortie annoncée à venir.</div>' : '')}</section>
      <section><div class="web-parity-section-title"><div><span>SOUVENIRS</span><h2>${historyTitle}</h2></div><strong>${history.length}</strong></div>${history.map((visit) => profileOutingCard(profile, visit, bundle)).join('') || '<div class="web-parity-empty compact">Aucune sortie passée visible.</div>'}</section>
      ${own ? '<button type="button" class="web-parity-primary" data-own-tab="publish">Déclarer une sortie</button>' : ''}
    </div>`;
  }

  function profileHero(profile) {
    const photos = profilePhotos(profile);
    const main = photos[0];
    return `<header class="web-parity-profile-hero">
      <div class="web-parity-profile-gallery-hero"><button type="button" data-lightbox="${esc(mediaUrl(main))}">${image(mediaUrl(main), displayName(profile), '', true)}</button>${photos.slice(1, 4).map((media) => `<button type="button" data-lightbox="${esc(mediaUrl(media))}">${image(mediaUrl(media), displayName(profile), '', true)}</button>`).join('')}</div>
      <div class="web-parity-profile-identity"><span>PROFIL VELVET</span><h1>${esc(displayName(profile))}</h1><p>${esc(profileMeta(profile))}</p><div><em>${esc(demographic(profile))}</em>${ageLabel(profile) ? `<em>${esc(ageLabel(profile))}</em>` : ''}${pick(profile, 'verificationStatus', 'verification_status') === 'verified' ? '<em>Profil vérifié</em>' : ''}<em>${photos.length} photo${photos.length > 1 ? 's' : ''}</em><em>${profileAlbums(profile).length} album${profileAlbums(profile).length > 1 ? 's' : ''}</em></div></div>
    </header>`;
  }

  function profileTabs(profile, active, own = false) {
    const rows = [['overview', profileType(profile) === 'couple' ? 'Le couple' : 'Présentation'], ...people(profile).map((person) => [`person-${personId(person)}`, personName(person)]), ['media', `Photos & albums · ${profileAlbums(profile).length}`], ['outings', own ? 'Sorties' : 'Soirées']];
    if (own) rows.push(['publish', 'Déclarer une sortie']);
    return `<nav class="web-parity-profile-tabs">${rows.map(([value,label]) => `<button type="button" data-${own ? 'own' : 'dialog'}-tab="${esc(value)}" class="${active === value ? 'selected' : ''}">${esc(label)}</button>`).join('')}</nav>`;
  }

  function profileContent(profile, bundle, active, own = false) {
    if (active === 'media') return profileMediaContent(profile);
    if (active === 'outings') return profileOutings(profile, bundle, own);
    if (active === 'publish' && own) return publishPanel(profile, bundle);
    if (active.startsWith('person-')) {
      const person = people(profile).find((item) => `person-${personId(item)}` === active);
      return person ? personContent(profile, person) : profileOverview(profile, bundle);
    }
    return profileOverview(profile, bundle);
  }

  function publishPanel(profile, bundle) {
    const attendanceLabel = profileType(profile) === 'couple' ? 'Nous y serons' : 'J’y serai';
    return `<section class="web-parity-publish">
      <div class="web-parity-section-title"><div><span>NOUVELLE SORTIE</span><h2>Déclarer une sortie</h2></div></div>
      <div class="web-parity-publish-types">${[['venue','Club, spa ou lieu'],['cap','Cap d’Agde'],['travel','Voyage ou autre sortie']].map(([value,label]) => `<button type="button" data-outing-type="${value}" class="${state.outingType === value ? 'selected' : ''}">${label}</button>`).join('')}</div>
      ${state.outingType === 'venue' ? `<form data-publish-venue class="web-parity-form"><label>Établissement<select name="venueId" required><option value="">Choisir un établissement</option>${venues(bundle).map((venue) => `<option value="${esc(venueId(venue))}">${esc(`${venueName(venue)} — ${venueCity(venue) || venueKind(venue)}`)}</option>`).join('')}</select></label><label>Date<input name="visitDate" type="date" min="${new Date().toISOString().slice(0,10)}" required></label><button type="submit">${attendanceLabel}</button></form>` : `<form data-publish-travel class="web-parity-form"><input type="hidden" name="destinationType" value="${state.outingType === 'cap' ? 'cap_dagde_village' : 'general'}"><label>Titre<input name="title" maxlength="160" required placeholder="Week-end, soirée privée, séjour…"></label><label>Lieu<input name="locationLabel" maxlength="240" required placeholder="Ville, zone ou établissement"></label><div><label>Début<input name="startsOn" type="date" min="${new Date().toISOString().slice(0,10)}" required></label><label>Fin<input name="endsOn" type="date" min="${new Date().toISOString().slice(0,10)}" required></label></div><label>Précisions<textarea name="notes" maxlength="2000" placeholder="Informations utiles pour la communauté"></textarea></label><button type="submit">Publier la sortie</button></form>`}
    </section>`;
  }

  async function renderOwnProfile(force = false) {
    state.route = 'profile';
    setActive('profile');
    updateUrl('profile');
    const bundle = await loadBundle(force);
    const profile = currentProfile(bundle);
    if (!profile) throw new Error('profile_required');
    content.innerHTML = `<section class="web-parity-page web-parity-own-profile" data-people-first="${VERSION}" data-web-parity>${profileHero(profile)}${profileTabs(profile, state.ownTab, true)}<div class="web-parity-profile-content">${profileContent(profile, bundle, state.ownTab, true)}</div><section class="web-parity-own-actions"><button type="button" data-edit-profile>Modifier mon profil</button><button type="button" data-route="settings">Paramètres & confidentialité</button></section></section>`;
    bind(content);
  }

  function profileDialog(profile) {
    if (!profile) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'web-parity-dialog';
    let active = 'overview';
    const draw = () => {
      dialog.innerHTML = `<div class="web-parity-dialog-shell"><button type="button" class="web-parity-close" data-close-dialog aria-label="Fermer">×</button>${profileHero(profile)}${profileTabs(profile, active)}<div class="web-parity-profile-content">${profileContent(profile, state.bundle, active)}</div><footer class="web-parity-profile-actions"><button type="button" class="web-parity-primary" data-start-conversation="${esc(profileId(profile))}">Écrire un message</button><button type="button" data-favorite-profile="${esc(profileId(profile))}">Suivre ce membre</button><button type="button" data-block-profile="${esc(profileId(profile))}" data-enabled="true">Sécurité, blocage et signalement</button></footer></div>`;
      bind(dialog);
      dialog.querySelectorAll('[data-dialog-tab]').forEach((button) => button.addEventListener('click', () => { active = button.dataset.dialogTab; draw(); }));
    };
    draw();
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  function venueDialog(venue) {
    if (!venue) return;
    const events = eventsForVenue(venue).filter((event) => asDate(pick(event, 'startsAt', 'starts_at')) >= new Date());
    const attendance = upcomingAttendance(venue, state.bundle);
    const dialog = document.createElement('dialog');
    dialog.className = 'web-parity-dialog web-parity-venue-dialog';
    dialog.innerHTML = `<div class="web-parity-dialog-shell"><button type="button" class="web-parity-close" data-close-dialog aria-label="Fermer">×</button><header class="web-parity-venue-hero"><span>⌂</span><div><small>ÉTABLISSEMENT</small><h1>${esc(venueName(venue))}</h1><p>${esc([venueKind(venue), venueCity(venue), pick(venue, 'addressPublic', 'address_public')].filter(Boolean).join(' · '))}</p></div></header><section class="web-parity-dialog-section"><div class="web-parity-section-title"><div><span>PROGRAMMATION</span><h2>Soirées organisées</h2></div><strong>${events.length}</strong></div>${events.map((event) => `<article class="web-parity-event"><time><strong>${esc(formatDate(pick(event, 'startsAt', 'starts_at'), { day: '2-digit' }))}</strong><small>${esc(formatDate(pick(event, 'startsAt', 'starts_at'), { month: 'short' }))}</small></time><div><strong>${esc(pick(event, 'title') || 'Soirée')}</strong><small>${esc([pick(event, 'audience'), pick(event, 'dressCode', 'dress_code')].filter(Boolean).join(' · '))}</small><p>${esc(pick(event, 'description') || '')}</p></div></article>`).join('') || '<div class="web-parity-empty compact">Aucune soirée publiée actuellement.</div>'}</section><section class="web-parity-dialog-section"><div class="web-parity-section-title"><div><span>COMMUNAUTÉ</span><h2>Qui a prévu d’y aller</h2></div><strong>${attendance.reduce((sum,[,rows]) => sum + rows.length,0)}</strong></div>${attendance.map(([day,rows]) => `<article class="web-parity-attendance-day"><header><strong>${esc(formatDate(dayDate(day)))}</strong><span>${rows.length} profil${rows.length > 1 ? 's' : ''}</span></header><div>${rows.map(attendeeChip).join('')}</div></article>`).join('') || '<div class="web-parity-empty compact">Aucune présence annoncée.</div>'}<button type="button" class="web-parity-primary" data-declare-venue="${esc(venueId(venue))}">Déclarer une sortie ici</button></section></div>`;
    document.body.append(dialog);
    bind(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  function lightbox(url) {
    if (!url) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'web-parity-lightbox';
    dialog.innerHTML = `<button type="button" data-close-dialog aria-label="Fermer">×</button>${image(url, 'Photo Velvet', '', true)}`;
    document.body.append(dialog);
    bind(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  async function startConversation(profileIdValue, button) {
    button.disabled = true;
    try {
      const result = await api('/api/members/conversations', { method: 'POST', body: JSON.stringify({ profileId: profileIdValue }) });
      const url = new URL(location.href);
      url.searchParams.set('route', 'conversations');
      url.searchParams.set('conversation', result.conversationId);
      location.assign(url);
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  }

  async function saveVenueOuting(form) {
    const data = new FormData(form);
    const venueIdValue = text(data.get('venueId'));
    const visitDate = text(data.get('visitDate'));
    const button = form.querySelector('button[type="submit"]');
    if (!venueIdValue || !visitDate) return;
    button.disabled = true;
    try {
      await api('/api/members/plans', { method: 'POST', body: JSON.stringify({ action: 'venue_visit', venueId: venueIdValue, visitDate }) });
      state.loadedAt = 0;
      state.ownTab = 'outings';
      toast('La sortie apparaît maintenant dans ton profil et le fil.');
      await renderOwnProfile(true);
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  }

  async function saveTravel(form) {
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.action = 'travel_plan';
    payload.preciseLocationConsent = false;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/members/plans', { method: 'POST', body: JSON.stringify(payload) });
      state.loadedAt = 0;
      state.ownTab = 'outings';
      toast('La sortie apparaît maintenant dans ton profil et le fil.');
      await renderOwnProfile(true);
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  }

  function rerenderDiscoverGrid(root) {
    const grid = root.querySelector('[data-discover-results]');
    if (!grid) return;
    const rows = discoverRows(state.bundle);
    grid.innerHTML = rows.map(discoveryCard).join('') || '<div class="web-parity-empty">Aucun profil ne correspond à cette recherche.</div>';
    const count = root.querySelector('.web-parity-result-count strong');
    if (count) count.textContent = String(rows.length);
    bind(grid);
  }

  function rerenderVenueGrid(root) {
    const grid = root.querySelector('[data-venue-results]');
    if (!grid) return;
    const rows = filteredVenues(state.bundle);
    grid.innerHTML = rows.map((venue) => venueCard(venue, state.bundle)).join('') || '<div class="web-parity-empty">Aucun établissement ne correspond à cette recherche.</div>';
    const count = root.querySelector('.web-parity-result-count strong');
    if (count) count.textContent = String(rows.length);
    bind(grid);
  }

  function bind(root) {
    root.querySelectorAll('[data-open-profile]').forEach((node) => {
      if (node.dataset.webBound) return;
      node.dataset.webBound = '1';
      node.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        profileDialog(profileById(node.dataset.openProfile));
      });
    });
    root.querySelectorAll('[data-open-venue]').forEach((node) => {
      if (node.dataset.webBound) return;
      node.dataset.webBound = '1';
      node.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        venueDialog(venueById(node.dataset.openVenue));
      });
    });
    root.querySelectorAll('[data-close-dialog]').forEach((node) => node.addEventListener('click', () => node.closest('dialog')?.close()));
    root.querySelectorAll('[data-lightbox]').forEach((node) => node.addEventListener('click', () => lightbox(node.dataset.lightbox)));
    root.querySelectorAll('[data-refresh-home]').forEach((node) => node.addEventListener('click', () => { state.feedLimit = 12; renderHome(true); }));
    root.querySelectorAll('[data-own-tab]').forEach((node) => node.addEventListener('click', () => { state.ownTab = node.dataset.ownTab; renderOwnProfile(); }));
    root.querySelectorAll('[data-outing-type]').forEach((node) => node.addEventListener('click', () => { state.outingType = node.dataset.outingType; state.ownTab = 'publish'; renderOwnProfile(); }));
    root.querySelectorAll('[data-profile-section]').forEach((node) => node.addEventListener('click', () => {
      const dialog = node.closest('dialog');
      if (dialog) dialog.querySelector(`[data-dialog-tab="${safeId(node.dataset.profileSection)}"]`)?.click();
      else { state.ownTab = node.dataset.profileSection; renderOwnProfile(); }
    }));
    root.querySelectorAll('[data-start-conversation]').forEach((node) => node.addEventListener('click', () => startConversation(node.dataset.startConversation, node)));
    root.querySelectorAll('[data-declare-venue]').forEach((node) => node.addEventListener('click', () => {
      node.closest('dialog')?.close();
      state.ownTab = 'publish';
      state.outingType = 'venue';
      renderOwnProfile().then(() => {
        const select = content.querySelector('[data-publish-venue] select[name="venueId"]');
        if (select) select.value = node.dataset.declareVenue;
      });
    }));
    root.querySelector('[data-publish-venue]')?.addEventListener('submit', (event) => { event.preventDefault(); saveVenueOuting(event.currentTarget); });
    root.querySelector('[data-publish-travel]')?.addEventListener('submit', (event) => { event.preventDefault(); saveTravel(event.currentTarget); });
    root.querySelector('[data-discover-query]')?.addEventListener('input', (event) => { state.discoverQuery = event.target.value; rerenderDiscoverGrid(root); });
    root.querySelectorAll('[data-discover-type]').forEach((node) => node.addEventListener('click', () => { state.discoverType = node.dataset.discoverType; renderDiscover(); }));
    root.querySelector('[data-venue-query]')?.addEventListener('input', (event) => { state.venueQuery = event.target.value; rerenderVenueGrid(root); });
    root.querySelectorAll('[data-venue-kind]').forEach((node) => node.addEventListener('click', () => { state.venueKind = node.dataset.venueKind; renderVenues(); }));
  }

  async function navigate(route, force = false) {
    try {
      if (route === 'home') return await renderHome(force);
      if (route === 'discover') return await renderDiscover(force);
      if (route === 'venues') return await renderVenues(force);
      if (route === 'profile') return await renderOwnProfile(force);
    } catch (error) {
      content.innerHTML = `<section class="web-parity-page" data-web-parity><div class="web-parity-empty"><strong>Velvet n’a pas pu actualiser cette vue.</strong><p>${esc(error.message)}</p><button type="button" data-retry="${esc(route)}">Réessayer</button></div></section>`;
      content.querySelector('[data-retry]')?.addEventListener('click', () => navigate(route, true));
    }
  }

  function openUtilityMenu() {
    const dialog = document.querySelector('#webUtilityMenu');
    if (dialog && !dialog.open) dialog.showModal();
  }

  document.addEventListener('click', (event) => {
    const routeButton = event.target.closest('[data-web-route]');
    if (routeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(routeButton.dataset.webRoute);
      return;
    }
    if (event.target.closest('#mobileMenuButton')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openUtilityMenu();
      return;
    }
    if (event.target.closest('[data-close-utility]')) {
      event.preventDefault();
      event.target.closest('dialog')?.close();
      return;
    }
    const utilityRoute = event.target.closest('#webUtilityMenu [data-route]');
    if (utilityRoute) window.setTimeout(() => utilityRoute.closest('dialog')?.close(), 0);
  }, true);

  document.addEventListener('error', (event) => {
    const imageNode = event.target;
    if (!(imageNode instanceof HTMLImageElement) || !imageNode.closest('[data-web-parity], .web-parity-dialog')) return;
    const replacement = document.createElement('span');
    replacement.className = `${imageNode.className} web-parity-placeholder`;
    replacement.textContent = 'V';
    imageNode.replaceWith(replacement);
  }, true);

  const guard = new MutationObserver(() => {
    if (state.guard || !OWNED_ROUTES.has(state.route)) return;
    if (content.querySelector('[data-web-parity]')) return;
    state.guard = true;
    queueMicrotask(() => navigate(state.route).finally(() => { state.guard = false; }));
  });
  guard.observe(content, { childList: true });

  window.addEventListener('popstate', () => {
    const route = new URL(location.href).searchParams.get('route') || 'home';
    if (OWNED_ROUTES.has(route)) navigate(route);
  });

  const initial = new URL(location.href).searchParams.get('route') || 'home';
  if (OWNED_ROUTES.has(initial)) navigate(initial);

  state.timer = window.setInterval(() => {
    if (state.route === 'home' && document.visibilityState === 'visible') renderHome(true);
  }, 60000);
})();