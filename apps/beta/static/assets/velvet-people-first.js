(() => {
  const content = document.querySelector('#content');
  if (!content) return;

  const VERSION = '20260802-1';
  const ownedRoutes = new Set(['home', 'venues', 'profile']);
  const state = {
    route: null,
    bundle: null,
    loadedAt: 0,
    loading: false,
    feedVisible: 12,
    venueQuery: '',
    venueKind: 'all',
    profileTab: 'overview',
    selectedVenueId: '',
    selectedOutingType: 'venue',
    refreshTimer: null,
    observer: null,
    guarding: false
  };

  const arr = (value) => Array.isArray(value) ? value : [];
  const str = (value) => String(value ?? '').trim();
  const pick = (value, ...keys) => {
    for (const key of keys) {
      if (value && value[key] !== undefined && value[key] !== null) return value[key];
    }
    return null;
  };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const cssEscape = (value) => window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');

  function asDate(value) {
    if (!value) return new Date(0);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function dateFromDay(value) {
    return asDate(`${value || '1970-01-01'}T12:00:00`);
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
    const minutes = Math.floor(seconds / 60);
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

  function profileId(profile) {
    return str(pick(profile, 'id', 'profileId', 'profile_id'));
  }

  function profileType(profile) {
    return str(pick(profile, 'profileType', 'profile_type')).toLowerCase() === 'couple' ? 'couple' : 'individual';
  }

  function displayName(profile) {
    return str(pick(profile, 'displayName', 'display_name', 'name')) || 'Membre Zwit';
  }

  function profiles(bundle = state.bundle) {
    return arr(pick(bundle?.directory, 'profiles'));
  }

  function currentProfile(bundle = state.bundle) {
    return bundle?.profile?.profile || bundle?.profile || null;
  }

  function profileById(id, bundle = state.bundle) {
    return profiles(bundle).find((profile) => profileId(profile) === str(id)) || null;
  }

  function people(profile) {
    return arr(pick(profile, 'individualProfiles', 'individual_profiles'));
  }

  function demographic(profile) {
    const direct = str(pick(profile, 'velvetDemographicLabel', 'demographicLabel', 'demographic_label'));
    if (direct) return direct;
    if (profileType(profile) === 'couple') return 'Couple';
    const identities = people(profile).map((person) => str(pick(person, 'genderIdentity', 'gender_identity')).toLowerCase());
    if (identities.some((value) => /femme|woman|female/.test(value))) return 'Femme seule';
    if (identities.some((value) => /homme|\bman\b|male/.test(value) && !/female/.test(value))) return 'Homme seul';
    if (identities.some((value) => /non.?binaire|non.?binary|queer/.test(value))) return 'Personne non-binaire';
    return 'Membre';
  }

  function ageLabel(profile) {
    const direct = str(pick(profile, 'velvetAgeLabel', 'ageLabel', 'age_label'));
    if (direct) return direct;
    const ages = people(profile).map((person) => Number(pick(person, 'birthYear', 'birth_year')))
      .filter(Number.isFinite)
      .map((year) => new Date().getFullYear() - year)
      .filter((age) => age >= 18 && age < 100);
    return ages.length ? `${ages.join(' & ')} ans` : '';
  }

  function profileLocation(profile) {
    return str(pick(profile, 'locationZone', 'location_zone', 'city')) || 'Zone privée';
  }

  function profileMeta(profile) {
    return [demographic(profile), ageLabel(profile), profileLocation(profile)].filter(Boolean).join(' · ');
  }

  function profilePhotos(profile) {
    return arr(pick(profile, 'profileGalleryPhotos', 'profile_gallery_photos', 'photos'));
  }

  function photoUrl(photo) {
    return str(pick(photo, 'previewUrl', 'preview_url', 'signedUrl', 'signed_url', 'url'));
  }

  function primaryPhoto(profile) {
    const photos = profilePhotos(profile);
    return photoUrl(photos.find((photo) => pick(photo, 'isPrimary', 'is_primary') === true) || photos[0]);
  }

  function image(url, alt, className = '') {
    return url
      ? `<img class="${esc(className)}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async">`
      : `<span class="people-first-placeholder ${esc(className)}" aria-hidden="true">V</span>`;
  }

  function venues(bundle = state.bundle) {
    return arr(pick(bundle?.directory, 'venueDirectory', 'venue_directory'));
  }

  function venueId(venue) {
    return str(pick(venue, 'id', 'venueId', 'venue_id'));
  }

  function venueName(venue) {
    return str(pick(venue, 'name', 'displayName', 'display_name')) || 'Établissement Zwit';
  }

  function venueCity(venue) {
    return str(pick(venue, 'city'));
  }

  function venueKind(venue) {
    return str(pick(venue, 'categoryPrimary', 'category_primary', 'kind')) || 'Établissement';
  }

  function venueById(id, bundle = state.bundle) {
    return venues(bundle).find((venue) => venueId(venue) === str(id)) || null;
  }

  function visits(bundle = state.bundle) {
    return arr(pick(bundle?.plans, 'venueVisits', 'venue_visits'));
  }

  function travelPlans(bundle = state.bundle) {
    return arr(pick(bundle?.plans, 'travelPlans', 'travel_plans'));
  }

  function establishments(bundle = state.bundle) {
    return arr(pick(bundle?.directory, 'establishments'));
  }

  function directoryEvents(bundle = state.bundle) {
    return arr(pick(bundle?.directory, 'events'));
  }

  function visitVenue(visit, bundle = state.bundle) {
    return pick(visit, 'venueDirectory', 'venue_directory') || venueById(pick(visit, 'venueId', 'venue_id'), bundle) || {};
  }

  function participantProfilesFor(venueIdValue, day, bundle = state.bundle) {
    const seen = new Set();
    return visits(bundle)
      .filter((visit) => str(pick(visit, 'venueId', 'venue_id')) === str(venueIdValue)
        && str(pick(visit, 'visitDate', 'visit_date')) === str(day))
      .map((visit) => profileById(pick(visit, 'profileId', 'profile_id'), bundle))
      .filter((profile) => profile && !seen.has(profileId(profile)) && seen.add(profileId(profile)));
  }

  function establishmentForVenue(venue, bundle = state.bundle) {
    const id = venueId(venue);
    return establishments(bundle).find((item) => str(pick(item, 'directoryVenueId', 'directory_venue_id')) === id) || null;
  }

  function eventsForVenue(venue, bundle = state.bundle) {
    const establishment = establishmentForVenue(venue, bundle);
    if (!establishment) return [];
    return directoryEvents(bundle)
      .filter((event) => str(pick(event, 'establishmentId', 'establishment_id')) === str(establishment.id))
      .sort((left, right) => asDate(pick(left, 'startsAt', 'starts_at')) - asDate(pick(right, 'startsAt', 'starts_at')));
  }

  async function loadBundle(force = false) {
    if (state.bundle && !force && Date.now() - state.loadedAt < 30000) return state.bundle;
    if (state.loading) {
      while (state.loading) await new Promise((resolve) => setTimeout(resolve, 80));
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
        plans: value(2, state.bundle?.plans || { venueVisits: [], travelPlans: [], eventPlans: [] }),
        intelligence: value(3, state.bundle?.intelligence || {}),
        notifications: value(4, state.bundle?.notifications || { notifications: [] })
      };
      state.loadedAt = Date.now();
      return state.bundle;
    } finally {
      state.loading = false;
    }
  }

  function setActive(route) {
    document.querySelectorAll('[data-people-route], [data-route]').forEach((node) => {
      const value = node.dataset.peopleRoute || node.dataset.route;
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
    history.replaceState({ peopleFirstRoute: route }, '', url);
  }

  function openLegacyRoute(route) {
    state.route = route;
    setActive(route);
    const button = [...document.querySelectorAll(`[data-route="${cssEscape(route)}"]`)]
      .find((node) => node.offsetParent !== null) || document.querySelector(`[data-route="${cssEscape(route)}"]`);
    if (button) {
      button.click();
    } else {
      const url = new URL(location.href);
      url.searchParams.set('route', route);
      location.assign(url);
    }
  }

  function recommendedProfiles(bundle) {
    const curated = arr(bundle.intelligence?.curatedProfiles);
    const latest = [...arr(bundle.intelligence?.allProfiles)].sort((left, right) =>
      asDate(pick(right, 'createdAt', 'created_at')) - asDate(pick(left, 'createdAt', 'created_at'))
    );
    const seen = new Set();
    return [...curated, ...latest].filter((profile) => {
      const id = str(profile.id);
      return id && !seen.has(id) && seen.add(id);
    }).slice(0, 12);
  }

  function recommendationCard(candidate) {
    const profile = profileById(candidate.id);
    const meta = profile ? profileMeta(profile) : [candidate.demographicLabel, candidate.ageLabel, candidate.locationZone].filter(Boolean).join(' · ');
    return `<button type="button" class="people-first-recommendation" data-open-profile="${esc(candidate.id)}">
      <span class="people-first-recommendation-media">
        ${image(candidate.photoUrl || primaryPhoto(profile), candidate.displayName || displayName(profile))}
        <span class="people-first-score">${Number(candidate.compatibilityScore) ? `${candidate.compatibilityScore}%` : 'Zwit IA'}</span>
      </span>
      <span class="people-first-recommendation-copy"><strong>${esc(candidate.displayName || displayName(profile))}</strong><small>${esc(meta)}</small></span>
    </button>`;
  }

  function outingGroupKey(visit) {
    return `${str(pick(visit, 'venueId', 'venue_id'))}|${str(pick(visit, 'visitDate', 'visit_date'))}`;
  }

  function buildFeed(bundle) {
    const currentId = profileId(currentProfile(bundle));
    const items = [];
    for (const member of profiles(bundle)) {
      if (!profileId(member) || profileId(member) === currentId) continue;
      const createdAt = asDate(pick(member, 'createdAt', 'created_at'));
      const updatedAt = asDate(pick(member, 'updatedAt', 'updated_at'));
      const photos = [...profilePhotos(member)].sort((a, b) => asDate(pick(b, 'createdAt', 'created_at')) - asDate(pick(a, 'createdAt', 'created_at')));
      const latest = photos[0];
      const latestDate = asDate(pick(latest, 'createdAt', 'created_at'));
      if (latest && latestDate > new Date(createdAt.getTime() + 3600000)) {
        items.push({ id: `photo-${latest.id}`, kind: 'photo', member, title: 'a publié une nouvelle photo', detail: profileLocation(member), media: photoUrl(latest), createdAt: latestDate });
      } else if (updatedAt > new Date(createdAt.getTime() + 12 * 3600000)) {
        items.push({ id: `profile-${profileId(member)}-${updatedAt.toISOString()}`, kind: 'profile', member, title: 'a enrichi son profil', detail: [arr(member.practices)[0], arr(pick(member, 'valuesList', 'values_list'))[0], profileLocation(member)].filter(Boolean).join(' · '), media: primaryPhoto(member), createdAt: updatedAt });
      } else {
        items.push({ id: `joined-${profileId(member)}`, kind: 'joined', member, title: profileType(member) === 'couple' ? 'vient de rejoindre la communauté' : 'vient de rejoindre Zwit', detail: profileMeta(member), media: primaryPhoto(member), createdAt });
      }
    }

    const groupedVisits = new Map();
    for (const visit of visits(bundle)) {
      const memberId = str(pick(visit, 'profileId', 'profile_id'));
      if (!memberId || memberId === currentId) continue;
      const member = profileById(memberId, bundle);
      if (!member) continue;
      const key = outingGroupKey(visit);
      if (!groupedVisits.has(key)) groupedVisits.set(key, []);
      groupedVisits.get(key).push(visit);
    }
    for (const [key, rows] of groupedVisits) {
      const visit = rows[0];
      const member = profileById(pick(visit, 'profileId', 'profile_id'), bundle);
      const venue = visitVenue(visit, bundle);
      const day = str(pick(visit, 'visitDate', 'visit_date'));
      const attendees = participantProfilesFor(venueId(venue), day, bundle);
      items.push({
        id: `outing-${key}`,
        kind: 'outing',
        member,
        title: profileType(member) === 'couple' ? 'seront présents' : 'sera présent·e',
        detail: `${venueName(venue)} · ${formatDate(dateFromDay(day))}`,
        createdAt: Math.max(...rows.map((row) => asDate(pick(row, 'updatedAt', 'updated_at', 'createdAt', 'created_at')).getTime()).filter(Boolean), dateFromDay(day).getTime()),
        venue,
        day,
        attendees
      });
    }

    for (const plan of travelPlans(bundle)) {
      const memberId = str(pick(plan, 'profileId', 'profile_id'));
      if (!memberId || memberId === currentId) continue;
      const member = profileById(memberId, bundle);
      if (!member) continue;
      items.push({
        id: `travel-${plan.id}`,
        kind: 'travel',
        member,
        title: 'a annoncé une sortie',
        detail: [pick(plan, 'title'), pick(plan, 'locationLabel', 'location_label')].filter(Boolean).join(' · '),
        createdAt: asDate(pick(plan, 'updatedAt', 'updated_at', 'createdAt', 'created_at')),
        startsOn: str(pick(plan, 'startsOn', 'starts_on')),
        endsOn: str(pick(plan, 'endsOn', 'ends_on')),
        destinationType: str(pick(plan, 'destinationType', 'destination_type'))
      });
    }

    for (const notification of arr(bundle.notifications?.notifications)) {
      if (str(pick(notification, 'eventType', 'event_type')) !== 'reactions') continue;
      const member = profileById(pick(notification, 'actorProfileId', 'actor_profile_id'), bundle);
      const reaction = str(notification.metadata?.reaction);
      items.push({
        id: `reaction-${notification.id}`,
        kind: 'reaction',
        member,
        title: reaction === 'adore' ? 'a eu un coup de cœur pour votre photo' : reaction === 'love' ? 'a adoré votre photo' : 'a aimé votre photo',
        detail: str(notification.body),
        media: str(pick(notification, 'entityPreviewUrl', 'entity_preview_url')),
        actorImage: str(pick(notification, 'actorPreviewUrl', 'actor_preview_url')),
        createdAt: asDate(pick(notification, 'createdAt', 'created_at'))
      });
    }

    return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, 120);
  }

  function attendeeMini(profile) {
    return `<button type="button" class="people-first-attendee" data-open-profile="${esc(profileId(profile))}">
      ${image(primaryPhoto(profile), displayName(profile))}
      <span><strong>${esc(displayName(profile))}</strong><small>${esc([demographic(profile), ageLabel(profile)].filter(Boolean).join(' · '))}</small></span>
    </button>`;
  }

  function feedCard(item) {
    const member = item.member;
    const id = profileId(member);
    const actorName = member ? displayName(member) : 'La communauté Zwit';
    const actorImage = item.actorImage || primaryPhoto(member);
    const meta = member ? profileMeta(member) : '';
    const profileAction = id ? `data-open-profile="${esc(id)}"` : '';
    let body = '';
    if (item.kind === 'outing') {
      body = `<section class="people-first-outing-block">
        <button type="button" class="people-first-place-row" data-open-venue="${esc(venueId(item.venue))}">
          <span class="people-first-place-icon">⌂</span><span><strong>${esc(venueName(item.venue))}</strong><small>${esc([venueKind(item.venue), venueCity(item.venue)].filter(Boolean).join(' · '))}</small></span><span>→</span>
        </button>
        <div class="people-first-date-row"><strong>${esc(formatDate(dateFromDay(item.day)))}</strong><span>${item.attendees.length} profil${item.attendees.length > 1 ? 's' : ''} annoncé${item.attendees.length > 1 ? 's' : ''}</span></div>
        <div class="people-first-attendee-list">${item.attendees.slice(0, 8).map(attendeeMini).join('')}</div>
      </section>`;
    } else if (item.kind === 'travel') {
      body = `<section class="people-first-outing-block people-first-travel-block">
        <div class="people-first-travel-title"><span>${item.destinationType === 'cap_dagde_village' ? '☀' : '✦'}</span><div><strong>${esc(item.detail)}</strong><small>${esc([formatDate(dateFromDay(item.startsOn)), item.endsOn && item.endsOn !== item.startsOn ? `au ${formatDate(dateFromDay(item.endsOn))}` : ''].filter(Boolean).join(' '))}</small></div></div>
      </section>`;
    } else if (item.media) {
      body = `<button type="button" class="people-first-feed-media" ${profileAction}>${image(item.media, item.title)}</button>`;
    }
    return `<article class="people-first-feed-card" data-feed-kind="${esc(item.kind)}">
      <header class="people-first-actor-row">
        <button type="button" class="people-first-avatar-button" ${profileAction}>${image(actorImage, actorName, 'people-first-avatar')}</button>
        <button type="button" class="people-first-actor-copy" ${profileAction}><strong>${esc(actorName)}</strong><small>${esc(meta)}</small><span>${esc(item.title)}</span></button>
        <time>${esc(relativeDate(item.createdAt))}</time>
      </header>
      ${item.detail && !['outing', 'travel'].includes(item.kind) ? `<p class="people-first-feed-text">${esc(item.detail)}</p>` : ''}
      ${body}
      <footer class="people-first-feed-actions">
        ${id ? `<button type="button" data-open-profile="${esc(id)}">Voir le profil</button>` : '<span></span>'}
        ${item.venue ? `<button type="button" data-open-venue="${esc(venueId(item.venue))}">Voir le lieu</button>` : ''}
      </footer>
    </article>`;
  }

  async function renderHome(force = false) {
    state.route = 'home';
    state.feedVisible = force ? 12 : state.feedVisible;
    setActive('home');
    updateUrl('home');
    const bundle = await loadBundle(force);
    const profile = currentProfile(bundle);
    const greeting = profileType(profile) === 'individual' && people(profile)[0]?.firstName ? people(profile)[0].firstName : displayName(profile);
    const feed = buildFeed(bundle);
    const visible = feed.slice(0, state.feedVisible);
    content.innerHTML = `<section class="people-first-page people-first-home" data-people-first="${VERSION}">
      <header class="people-first-page-header"><span>Bonjour ${esc(greeting)}</span><h1>Actualité</h1><p>Les personnes, leurs nouvelles photos et les sorties qui prennent vie autour de vous.</p></header>
      <section class="people-first-discovery"><div class="people-first-section-title"><div><span>À DÉCOUVRIR</span><h2>Les profils qui comptent</h2></div><button type="button" data-open-legacy="discover">Tout voir</button></div><div class="people-first-recommendations">${recommendedProfiles(bundle).map(recommendationCard).join('')}</div></section>
      <section class="people-first-timeline"><div class="people-first-section-title"><div><span>FIL COMMUNAUTAIRE</span><h2>Ce qui se passe maintenant</h2></div><button type="button" data-refresh-home>Actualiser</button></div><div class="people-first-feed">${visible.map(feedCard).join('')}</div>${visible.length < feed.length ? '<div class="people-first-sentinel" data-feed-sentinel><span></span></div>' : ''}</section>
    </section>`;
    bindOwnedContent(content);
    observeFeed(feed);
  }

  function venueSearchText(venue) {
    return [venueName(venue), venueCity(venue), venueKind(venue), pick(venue, 'kind'), pick(venue, 'addressPublic', 'address_public'), ...arr(pick(venue, 'categoryTags', 'category_tags'))].filter(Boolean).join(' ').toLowerCase();
  }

  function filteredVenues(bundle) {
    const query = state.venueQuery.toLowerCase().trim();
    return venues(bundle).filter((venue) => {
      const category = venueSearchText(venue);
      const matchesKind = state.venueKind === 'all' || category.includes(state.venueKind);
      return matchesKind && (!query || category.includes(query));
    }).sort((a, b) => {
      const ad = Number(pick(a, 'distanceKm', 'distance_km'));
      const bd = Number(pick(b, 'distanceKm', 'distance_km'));
      if (Number.isFinite(ad) || Number.isFinite(bd)) return (Number.isFinite(ad) ? ad : 999999) - (Number.isFinite(bd) ? bd : 999999);
      return venueName(a).localeCompare(venueName(b), 'fr');
    });
  }

  function upcomingAttendanceForVenue(venue, bundle) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const groups = new Map();
    for (const visit of visits(bundle)) {
      if (str(pick(visit, 'venueId', 'venue_id')) !== venueId(venue)) continue;
      const day = str(pick(visit, 'visitDate', 'visit_date'));
      if (dateFromDay(day) < today) continue;
      if (!groups.has(day)) groups.set(day, participantProfilesFor(venueId(venue), day, bundle));
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  function venueCard(venue, bundle) {
    const events = eventsForVenue(venue, bundle).filter((event) => asDate(pick(event, 'startsAt', 'starts_at')) >= new Date());
    const attendance = upcomingAttendanceForVenue(venue, bundle);
    const preview = attendance.flatMap(([, people]) => people).filter((profile, index, all) => all.findIndex((candidate) => profileId(candidate) === profileId(profile)) === index).slice(0, 5);
    return `<article class="people-first-venue-card">
      <button type="button" class="people-first-venue-main" data-open-venue="${esc(venueId(venue))}"><span class="people-first-venue-symbol">⌂</span><span><strong>${esc(venueName(venue))}</strong><small>${esc([venueKind(venue), venueCity(venue)].filter(Boolean).join(' · '))}</small><em>${events.length} soirée${events.length > 1 ? 's' : ''} · ${attendance.length} date${attendance.length > 1 ? 's' : ''} annoncée${attendance.length > 1 ? 's' : ''}</em></span><span>→</span></button>
      ${preview.length ? `<div class="people-first-venue-people"><div>${preview.map((profile) => image(primaryPhoto(profile), displayName(profile))).join('')}</div><span>${preview.map(displayName).slice(0, 3).join(', ')}${preview.length > 3 ? '…' : ''}</span></div>` : '<div class="people-first-venue-people empty"><span>Aucun membre déclaré pour le moment</span></div>'}
    </article>`;
  }

  async function renderVenues(force = false) {
    state.route = 'venues';
    setActive('venues');
    updateUrl('venues');
    const bundle = await loadBundle(force);
    const rows = filteredVenues(bundle);
    content.innerHTML = `<section class="people-first-page people-first-venues" data-people-first="${VERSION}">
      <header class="people-first-page-header"><span>LIEUX & SORTIES</span><h1>Clubs et établissements</h1><p>Une recherche distincte des profils, avec les soirées organisées et les membres qui ont annoncé leur présence.</p></header>
      <section class="people-first-venue-tools"><label><span>⌕</span><input type="search" data-venue-query value="${esc(state.venueQuery)}" placeholder="Nom, ville, club, spa…"></label><div class="people-first-filter-row">${[['all','Tous'],['club','Clubs'],['spa','Spas'],['bar','Bars'],['love','Love rooms']].map(([value,label]) => `<button type="button" data-venue-kind="${value}" class="${state.venueKind === value ? 'selected' : ''}">${label}</button>`).join('')}</div></section>
      <div class="people-first-venue-count">${rows.length} établissement${rows.length > 1 ? 's' : ''}</div>
      <section class="people-first-venue-grid" data-venue-results>${rows.map((venue) => venueCard(venue, bundle)).join('') || '<div class="people-first-empty">Aucun établissement ne correspond à cette recherche.</div>'}</section>
    </section>`;
    bindOwnedContent(content);
  }

  function profileVisits(profile, bundle = state.bundle) {
    return visits(bundle).filter((visit) => str(pick(visit, 'profileId', 'profile_id')) === profileId(profile));
  }

  function profileTravels(profile, bundle = state.bundle) {
    return travelPlans(bundle).filter((plan) => str(pick(plan, 'profileId', 'profile_id')) === profileId(profile));
  }

  function outingCard(profile, visit, bundle) {
    const venue = visitVenue(visit, bundle);
    const day = str(pick(visit, 'visitDate', 'visit_date'));
    const attendees = participantProfilesFor(venueId(venue), day, bundle).filter((person) => profileId(person) !== profileId(profile));
    return `<article class="people-first-profile-outing"><button type="button" class="people-first-profile-outing-main" data-open-venue="${esc(venueId(venue))}"><span class="people-first-date-tile"><strong>${esc(formatDate(dateFromDay(day), { day: '2-digit' }))}</strong><small>${esc(formatDate(dateFromDay(day), { month: 'short' }))}</small></span><span><strong>${esc(venueName(venue))}</strong><small>${esc([venueKind(venue), venueCity(venue)].filter(Boolean).join(' · '))}</small></span><span>→</span></button>${attendees.length ? `<div class="people-first-outing-companions"><span>Également présents</span><div>${attendees.slice(0, 5).map(attendeeMini).join('')}</div></div>` : ''}</article>`;
  }

  function travelCard(plan) {
    return `<article class="people-first-profile-outing"><div class="people-first-profile-outing-main"><span class="people-first-date-tile"><strong>${esc(formatDate(dateFromDay(pick(plan, 'startsOn', 'starts_on')), { day: '2-digit' }))}</strong><small>${esc(formatDate(dateFromDay(pick(plan, 'startsOn', 'starts_on')), { month: 'short' }))}</small></span><span><strong>${esc(pick(plan, 'title') || 'Sortie')}</strong><small>${esc(pick(plan, 'locationLabel', 'location_label') || 'Lieu à confirmer')}</small></span><span>${str(pick(plan, 'destinationType', 'destination_type')) === 'cap_dagde_village' ? '☀' : '✦'}</span></div></article>`;
  }

  function profileOutingsContent(profile, bundle, own = false) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const all = profileVisits(profile, bundle);
    const future = all.filter((visit) => dateFromDay(pick(visit, 'visitDate', 'visit_date')) >= today).sort((a, b) => dateFromDay(pick(a, 'visitDate', 'visit_date')) - dateFromDay(pick(b, 'visitDate', 'visit_date')));
    const past = all.filter((visit) => dateFromDay(pick(visit, 'visitDate', 'visit_date')) < today).sort((a, b) => dateFromDay(pick(b, 'visitDate', 'visit_date')) - dateFromDay(pick(a, 'visitDate', 'visit_date')));
    const travels = profileTravels(profile, bundle);
    const futureTitle = profileType(profile) === 'couple' ? 'On y sera' : 'J’y serai';
    const pastTitle = profileType(profile) === 'couple' ? 'On y était' : 'J’y étais';
    return `<section class="people-first-outing-history">
      <div class="people-first-outing-group"><div class="people-first-section-title compact"><div><span>À VENIR</span><h2>${futureTitle}</h2></div><strong>${future.length + travels.length}</strong></div>${future.map((visit) => outingCard(profile, visit, bundle)).join('')}${travels.map(travelCard).join('') || (!future.length ? '<div class="people-first-empty compact">Aucune sortie annoncée à venir.</div>' : '')}</div>
      <div class="people-first-outing-group"><div class="people-first-section-title compact"><div><span>SOUVENIRS</span><h2>${pastTitle}</h2></div><strong>${past.length}</strong></div>${past.map((visit) => outingCard(profile, visit, bundle)).join('') || '<div class="people-first-empty compact">Aucune sortie passée visible.</div>'}</div>
      ${own ? '<button type="button" class="people-first-primary-action" data-own-tab="publish">Déclarer une sortie</button>' : ''}
    </section>`;
  }

  function profileOverview(profile) {
    const description = str(pick(profile, 'description'));
    const story = str(pick(profile, 'story'));
    const practices = arr(pick(profile, 'practices'));
    const values = arr(pick(profile, 'valuesList', 'values_list'));
    return `<div class="people-first-profile-overview">
      <section><span>PRÉSENTATION</span><h2>${esc(profileType(profile) === 'couple' ? 'Le couple' : 'À propos')}</h2><p>${esc(description || story || 'Ce profil prépare encore sa présentation.')}</p></section>
      ${practices.length ? `<section><span>ENVIES & PRATIQUES</span><div class="people-first-tags">${practices.map((value) => `<em>${esc(value)}</em>`).join('')}</div></section>` : ''}
      ${values.length ? `<section><span>VALEURS</span><div class="people-first-tags">${values.map((value) => `<em>${esc(value)}</em>`).join('')}</div></section>` : ''}
    </div>`;
  }

  function profilePhotosContent(profile) {
    const photos = profilePhotos(profile);
    return `<div class="people-first-profile-gallery">${photos.map((photo) => `<button type="button" data-lightbox-src="${esc(photoUrl(photo))}">${image(photoUrl(photo), displayName(profile))}</button>`).join('') || '<div class="people-first-empty">Aucune photo visible.</div>'}</div>`;
  }

  function profileHero(profile, own = false) {
    return `<header class="people-first-profile-hero">
      <div class="people-first-profile-hero-media">${image(primaryPhoto(profile), displayName(profile))}</div>
      <div class="people-first-profile-hero-copy"><span>${own ? 'MON PROFIL' : 'PROFIL ZWIT'}</span><h1>${esc(displayName(profile))}</h1><p>${esc(profileMeta(profile))}</p><div>${pick(profile, 'verificationStatus', 'verification_status') === 'verified' ? '<em>Profil vérifié</em>' : ''}<em>${profilePhotos(profile).length} photos</em></div></div>
    </header>`;
  }

  function profileTabs(active, own = false) {
    const tabs = own ? [['overview','Profil'],['photos','Photos'],['outings','Sorties'],['publish','Déclarer une sortie']] : [['overview','Profil'],['photos','Photos'],['outings','Soirées']];
    return `<nav class="people-first-profile-tabs">${tabs.map(([value,label]) => `<button type="button" data-${own ? 'own' : 'profile'}-tab="${value}" class="${active === value ? 'selected' : ''}">${label}</button>`).join('')}</nav>`;
  }

  function publishForm(profile, bundle) {
    const label = profileType(profile) === 'couple' ? 'Nous y serons' : 'J’y serai';
    return `<section class="people-first-publish-panel">
      <div class="people-first-section-title compact"><div><span>NOUVELLE SORTIE</span><h2>Déclarer une sortie</h2></div></div>
      <div class="people-first-publish-types">${[['venue','Club, spa ou lieu'],['cap','Cap d’Agde'],['travel','Voyage ou autre sortie']].map(([value,text]) => `<button type="button" data-outing-type="${value}" class="${state.selectedOutingType === value ? 'selected' : ''}">${text}</button>`).join('')}</div>
      ${state.selectedOutingType === 'venue' ? `<form data-publish-venue class="people-first-form"><label>Établissement<select name="venueId" required><option value="">Choisir un établissement</option>${venues(bundle).map((venue) => `<option value="${esc(venueId(venue))}">${esc(`${venueName(venue)} — ${venueCity(venue) || venueKind(venue)}`)}</option>`).join('')}</select></label><label>Date<input type="date" name="visitDate" min="${new Date().toISOString().slice(0,10)}" required></label><button type="submit">${label}</button></form>` : `<form data-publish-travel class="people-first-form"><input type="hidden" name="destinationType" value="${state.selectedOutingType === 'cap' ? 'cap_dagde_village' : 'general'}"><label>Titre<input name="title" required maxlength="160" placeholder="Week-end, soirée privée, séjour…"></label><label>Lieu<input name="locationLabel" required maxlength="240" placeholder="Ville, zone ou établissement"></label><div class="people-first-form-row"><label>Début<input type="date" name="startsOn" min="${new Date().toISOString().slice(0,10)}" required></label><label>Fin<input type="date" name="endsOn" min="${new Date().toISOString().slice(0,10)}" required></label></div>${state.selectedOutingType === 'cap' ? '<label>Zone<select name="capZone"><option>Ensemble du village</option><option>Port Nature</option><option>Port Ambonne</option><option>Port Soleil</option><option>Héliopolis</option><option>Plage naturiste</option><option>Marina</option></select></label>' : ''}<label>Précisions<textarea name="notes" maxlength="2000" placeholder="Informations utiles pour la communauté"></textarea></label><button type="submit">Publier la sortie</button></form>`}
    </section>`;
  }

  async function renderOwnProfile(force = false) {
    state.route = 'profile';
    setActive('profile');
    updateUrl('profile');
    const bundle = await loadBundle(force);
    const profile = currentProfile(bundle);
    const active = state.profileTab;
    const contentHtml = active === 'photos' ? profilePhotosContent(profile) : active === 'outings' ? profileOutingsContent(profile, bundle, true) : active === 'publish' ? publishForm(profile, bundle) : profileOverview(profile);
    content.innerHTML = `<section class="people-first-page people-first-own-profile" data-people-first="${VERSION}">${profileHero(profile, true)}${profileTabs(active, true)}<div class="people-first-profile-content">${contentHtml}</div></section>`;
    bindOwnedContent(content);
  }

  function openProfileDialog(profile) {
    if (!profile) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'people-first-dialog people-first-profile-dialog';
    dialog.dataset.profileId = profileId(profile);
    const render = (active = 'overview') => {
      dialog.innerHTML = `<div class="people-first-dialog-shell"><button type="button" class="people-first-close" data-close-dialog aria-label="Fermer">×</button>${profileHero(profile)}${profileTabs(active)}<div class="people-first-profile-content">${active === 'photos' ? profilePhotosContent(profile) : active === 'outings' ? profileOutingsContent(profile, state.bundle) : profileOverview(profile)}</div></div>`;
      bindOwnedContent(dialog);
      dialog.querySelectorAll('[data-profile-tab]').forEach((button) => button.addEventListener('click', () => render(button.dataset.profileTab)));
    };
    render();
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  function openVenueDialog(venue) {
    if (!venue) return;
    const upcomingEvents = eventsForVenue(venue).filter((event) => asDate(pick(event, 'startsAt', 'starts_at')) >= new Date());
    const attendance = upcomingAttendanceForVenue(venue, state.bundle);
    const dialog = document.createElement('dialog');
    dialog.className = 'people-first-dialog people-first-venue-dialog';
    dialog.innerHTML = `<div class="people-first-dialog-shell"><button type="button" class="people-first-close" data-close-dialog aria-label="Fermer">×</button><header class="people-first-venue-hero"><span class="people-first-venue-symbol large">⌂</span><div><span>ÉTABLISSEMENT</span><h1>${esc(venueName(venue))}</h1><p>${esc([venueKind(venue), venueCity(venue), pick(venue, 'addressPublic', 'address_public')].filter(Boolean).join(' · '))}</p></div></header><section class="people-first-dialog-section"><div class="people-first-section-title compact"><div><span>PROGRAMMATION</span><h2>Soirées organisées</h2></div><strong>${upcomingEvents.length}</strong></div>${upcomingEvents.map((event) => `<article class="people-first-event-card"><span class="people-first-date-tile"><strong>${esc(formatDate(pick(event, 'startsAt', 'starts_at'), { day: '2-digit' }))}</strong><small>${esc(formatDate(pick(event, 'startsAt', 'starts_at'), { month: 'short' }))}</small></span><div><strong>${esc(event.title)}</strong><small>${esc([pick(event, 'locationPublic', 'location_public'), pick(event, 'dressCode', 'dress_code')].filter(Boolean).join(' · '))}</small></div></article>`).join('') || '<div class="people-first-empty compact">Aucune soirée publiée pour le moment.</div>'}</section><section class="people-first-dialog-section"><div class="people-first-section-title compact"><div><span>COMMUNAUTÉ</span><h2>Qui a prévu d’y aller ?</h2></div><strong>${attendance.reduce((sum,[, people]) => sum + people.length, 0)}</strong></div>${attendance.map(([day, people]) => `<article class="people-first-attendance-day"><h3>${esc(formatDate(dateFromDay(day)))}</h3><div>${people.map(attendeeMini).join('')}</div></article>`).join('') || '<div class="people-first-empty compact">Aucun membre déclaré pour le moment.</div>'}</section><button type="button" class="people-first-primary-action" data-declare-at-venue="${esc(venueId(venue))}">Déclarer une sortie ici</button></div>`;
    document.body.append(dialog);
    bindOwnedContent(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  function observeFeed(feed) {
    state.observer?.disconnect();
    const sentinel = content.querySelector('[data-feed-sentinel]');
    if (!sentinel) return;
    state.observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      state.feedVisible = Math.min(feed.length, state.feedVisible + 10);
      const list = content.querySelector('.people-first-feed');
      if (list) list.innerHTML = feed.slice(0, state.feedVisible).map(feedCard).join('');
      bindOwnedContent(list || content);
      if (state.feedVisible >= feed.length) sentinel.remove();
    }, { rootMargin: '240px' });
    state.observer.observe(sentinel);
  }

  async function saveVenueOuting(form) {
    const data = new FormData(form);
    const venueIdValue = str(data.get('venueId'));
    const visitDate = str(data.get('visitDate'));
    const button = form.querySelector('button[type="submit"]');
    if (!venueIdValue || !visitDate) return;
    button.disabled = true;
    try {
      await api('/api/members/plans', { method: 'POST', body: JSON.stringify({ action: 'venue_visit', venueId: venueIdValue, visitDate }) });
      state.loadedAt = 0;
      toast('La sortie est publiée dans votre profil et le fil d’actualité.');
      state.profileTab = 'outings';
      await renderOwnProfile(true);
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  }

  async function saveTravel(form) {
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    payload.action = 'travel_plan';
    payload.preciseLocationConsent = false;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/members/plans', { method: 'POST', body: JSON.stringify(payload) });
      state.loadedAt = 0;
      toast('La sortie est publiée dans votre profil et le fil d’actualité.');
      state.profileTab = 'outings';
      await renderOwnProfile(true);
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  }

  function bindOwnedContent(root) {
    root.querySelectorAll('[data-open-profile]').forEach((node) => {
      if (node.dataset.peopleBound) return;
      node.dataset.peopleBound = '1';
      node.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        openProfileDialog(profileById(node.dataset.openProfile));
      });
    });
    root.querySelectorAll('[data-open-venue]').forEach((node) => {
      if (node.dataset.peopleBound) return;
      node.dataset.peopleBound = '1';
      node.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        openVenueDialog(venueById(node.dataset.openVenue));
      });
    });
    root.querySelectorAll('[data-close-dialog]').forEach((node) => node.addEventListener('click', () => node.closest('dialog')?.close()));
    root.querySelectorAll('[data-open-legacy]').forEach((node) => node.addEventListener('click', () => openLegacyRoute(node.dataset.openLegacy)));
    root.querySelectorAll('[data-refresh-home]').forEach((node) => node.addEventListener('click', () => renderHome(true)));
    root.querySelectorAll('[data-own-tab]').forEach((node) => node.addEventListener('click', () => { state.profileTab = node.dataset.ownTab; renderOwnProfile(); }));
    root.querySelectorAll('[data-outing-type]').forEach((node) => node.addEventListener('click', () => { state.selectedOutingType = node.dataset.outingType; state.profileTab = 'publish'; renderOwnProfile(); }));
    root.querySelector('[data-publish-venue]')?.addEventListener('submit', (event) => { event.preventDefault(); saveVenueOuting(event.currentTarget); });
    root.querySelector('[data-publish-travel]')?.addEventListener('submit', (event) => { event.preventDefault(); saveTravel(event.currentTarget); });
    root.querySelectorAll('[data-declare-at-venue]').forEach((node) => node.addEventListener('click', () => {
      node.closest('dialog')?.close();
      state.selectedVenueId = node.dataset.declareAtVenue;
      state.selectedOutingType = 'venue';
      state.profileTab = 'publish';
      renderOwnProfile().then(() => {
        const select = content.querySelector('[data-publish-venue] select[name="venueId"]');
        if (select) select.value = state.selectedVenueId;
      });
    }));
    root.querySelector('[data-venue-query]')?.addEventListener('input', (event) => {
      state.venueQuery = event.target.value;
      const grid = root.querySelector('[data-venue-results]');
      if (grid) {
        grid.innerHTML = filteredVenues(state.bundle).map((venue) => venueCard(venue, state.bundle)).join('') || '<div class="people-first-empty">Aucun établissement ne correspond à cette recherche.</div>';
        bindOwnedContent(grid);
      }
    });
    root.querySelectorAll('[data-venue-kind]').forEach((node) => node.addEventListener('click', () => { state.venueKind = node.dataset.venueKind; renderVenues(); }));
    root.querySelectorAll('[data-lightbox-src]').forEach((node) => node.addEventListener('click', () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'people-first-lightbox';
      dialog.innerHTML = `<button type="button" data-close-dialog aria-label="Fermer">×</button>${image(node.dataset.lightboxSrc, 'Photo Zwit')}`;
      document.body.append(dialog); bindOwnedContent(dialog); dialog.addEventListener('close', () => dialog.remove()); dialog.showModal();
    }));
  }

  async function navigate(route, force = false) {
    try {
      if (route === 'home') return await renderHome(force);
      if (route === 'venues') return await renderVenues(force);
      if (route === 'profile') return await renderOwnProfile(force);
      openLegacyRoute(route);
    } catch (error) {
      content.innerHTML = `<section class="people-first-page"><div class="people-first-empty"><strong>Zwit n’a pas pu actualiser cette vue.</strong><p>${esc(error.message)}</p><button type="button" data-retry-route="${esc(route)}">Réessayer</button></div></section>`;
      content.querySelector('[data-retry-route]')?.addEventListener('click', () => navigate(route, true));
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-people-route]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(button.dataset.peopleRoute);
  }, true);

  const guard = new MutationObserver(() => {
    if (state.guarding || !ownedRoutes.has(state.route)) return;
    if (content.querySelector('[data-people-first]')) return;
    state.guarding = true;
    queueMicrotask(() => navigate(state.route).finally(() => { state.guarding = false; }));
  });
  guard.observe(content, { childList: true });

  window.addEventListener('popstate', () => {
    const route = new URL(location.href).searchParams.get('route') || 'home';
    if (ownedRoutes.has(route)) navigate(route);
  });

  const initial = new URL(location.href).searchParams.get('route') || 'home';
  if (ownedRoutes.has(initial)) navigate(initial);

  state.refreshTimer = window.setInterval(() => {
    if (state.route === 'home' && document.visibilityState === 'visible') renderHome(true);
  }, 45000);
})();