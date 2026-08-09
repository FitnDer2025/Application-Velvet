(() => {
  if (!location.pathname.startsWith('/membres')) return;

  const PANEL_ID = 'zwitContextualRecommendations';
  const content = document.querySelector('#content');
  if (!content) return;

  let route = 'home';
  let loading = false;
  let loadedAt = 0;
  let lastModel = null;
  let scheduled = false;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const array = (value) => Array.isArray(value) ? value : [];
  const firstArray = (...values) => values.find(Array.isArray) || [];
  const idOf = (item) => item?.profileId || item?.profile_id || item?.eventId || item?.event_id || item?.venueId || item?.venue_id || item?.establishment_id || item?.id || '';
  const nameOf = (item) => item?.displayName || item?.display_name || item?.title || item?.name || 'Suggestion Zwit';
  const cityOf = (item) => item?.locationZone || item?.location_zone || item?.city || item?.location_public || '';
  const photoOf = (item) => item?.photoUrl || item?.photo_url || item?.previewUrl || item?.preview_url || item?.coverUrl || item?.cover_url || '';

  async function get(path) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'recommendation_source_failed');
    return payload;
  }

  function feedbackMap(payload) {
    return new Map(array(payload?.feedback).map((row) => [`${row.entity_type}:${row.entity_id}`, row.signal]));
  }

  function unique(items) {
    const seen = new Set();
    return items.filter((item) => {
      const id = idOf(item);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function profileCandidates(home, tonight) {
    return unique([
      ...firstArray(tonight?.members, tonight?.profiles, tonight?.availableMembers),
      ...firstArray(home?.recommendations, home?.profiles, home?.nearbyProfiles, home?.suggestedProfiles),
      ...firstArray(home?.people, home?.members)
    ]);
  }

  function eventCandidates(events, tonight, home) {
    return unique([
      ...firstArray(tonight?.events, tonight?.nearbyEvents),
      ...firstArray(events?.events, events?.items, events?.upcoming),
      ...firstArray(home?.events, home?.recommendedEvents)
    ]);
  }

  function venueCandidates(directory, home) {
    return unique([
      ...firstArray(directory?.venues, directory?.items, directory?.catalog),
      ...firstArray(home?.venues, home?.recommendedVenues)
    ]);
  }

  function inTonight(item, tonight) {
    const ids = new Set(firstArray(tonight?.members, tonight?.profiles, tonight?.availableMembers).map(idOf));
    return ids.has(idOf(item));
  }

  function soon(event) {
    const raw = event?.starts_at || event?.startsAt || event?.date;
    const time = new Date(raw || 0).getTime();
    if (!time || Number.isNaN(time)) return null;
    const hours = (time - Date.now()) / 3_600_000;
    return hours >= -1 && hours <= 18 ? hours : null;
  }

  function scoreProfile(item, context) {
    let score = 0;
    const reasons = [];
    if (inTonight(item, context.tonight)) {
      score += 45;
      reasons.push('disponible maintenant');
    }
    if (item?.followed || item?.is_followed || item?.relationship === 'followed') {
      score += 12;
      reasons.push('profil déjà suivi');
    }
    if (item?.distance_km != null || item?.distanceKm != null) {
      const distance = Number(item.distance_km ?? item.distanceKm);
      if (Number.isFinite(distance) && distance <= 50) {
        score += Math.max(5, 22 - Math.round(distance / 4));
        reasons.push(distance <= 15 ? 'tout près de vous' : 'dans votre rayon');
      }
    } else if (cityOf(item)) {
      score += 8;
      reasons.push('zone compatible avec votre recherche');
    }
    if (item?.shared_practices?.length || item?.sharedPractices?.length || item?.reasons?.length) {
      score += 18;
      reasons.push('plusieurs envies semblent se recouper');
    }
    if (item?.last_seen_at || item?.lastSeenAt || item?.active_now) {
      score += 8;
      reasons.push('activité récente');
    }
    return { score, reasons: reasons.slice(0, 3) };
  }

  function scoreEvent(item) {
    let score = 10;
    const reasons = [];
    const hours = soon(item);
    if (hours != null) {
      score += hours <= 6 ? 45 : 30;
      reasons.push(hours <= 6 ? 'ça se passe dans les prochaines heures' : 'prévu très prochainement');
    }
    const registrations = Number(item?.participants_count ?? item?.participantCount ?? item?.registrations_count ?? 0);
    if (registrations > 0) {
      score += Math.min(18, registrations);
      reasons.push('des membres Zwit ont déjà prévu d’y aller');
    }
    if (item?.establishment_id || item?.venue_id || item?.venueId) {
      score += 8;
      reasons.push('lié à un lieu référencé');
    }
    return { score, reasons: reasons.slice(0, 3) };
  }

  function scoreVenue(item, events) {
    let score = 8;
    const reasons = [];
    const venueId = idOf(item);
    const related = events.filter((event) => String(event?.establishment_id || event?.venue_id || event?.venueId || '') === String(venueId));
    const upcoming = related.filter((event) => soon(event) != null);
    if (upcoming.length) {
      score += 38;
      reasons.push(`${upcoming.length} sortie${upcoming.length > 1 ? 's' : ''} bientôt`);
    }
    if (item?.relationship === 'favorite' || item?.favorite || item?.is_favorite) {
      score += 20;
      reasons.push('lieu que vous avez enregistré');
    }
    if (item?.subscription_status === 'active' || item?.verified || item?.is_verified) {
      score += 8;
      reasons.push('établissement Zwit actif');
    }
    if (cityOf(item)) reasons.push(cityOf(item));
    return { score, reasons: reasons.slice(0, 3) };
  }

  function pick(items, type, scorer, feedback) {
    return items
      .filter((item) => feedback.get(`${type}:${idOf(item)}`) !== 'dismiss')
      .map((item) => {
        const scored = scorer(item);
        if (feedback.get(`${type}:${idOf(item)}`) === 'more_like_this') scored.score += 14;
        return { type, item, ...scored };
      })
      .sort((a, b) => b.score - a.score)[0] || null;
  }

  function reasonText(candidate) {
    const reasons = candidate?.reasons?.filter(Boolean) || [];
    return reasons.length ? reasons.join(' · ') : 'Cette suggestion s’inscrit dans votre contexte actuel.';
  }

  function card(candidate) {
    if (!candidate) return '';
    const { item, type } = candidate;
    const id = idOf(item);
    const title = nameOf(item);
    const location = cityOf(item);
    const image = photoOf(item);
    const label = type === 'profile' ? 'UNE PERSONNE' : type === 'event' ? 'UNE SORTIE' : 'UN LIEU';
    const openAttr = type === 'profile' ? `data-open-profile="${esc(id)}"` : type === 'event' ? `data-open-event="${esc(id)}"` : `data-open-venue="${esc(id)}"`;
    return `<article class="zcr-card" data-zcr-card data-entity-type="${type}" data-entity-id="${esc(id)}">
      <button class="zcr-open" type="button" ${openAttr}>
        <div class="zcr-media">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : `<span>${esc(title.slice(0, 1).toUpperCase())}</span>`}</div>
        <div class="zcr-copy"><small>${label}</small><strong>${esc(title)}</strong>${location ? `<em>${esc(location)}</em>` : ''}<p>${esc(reasonText(candidate))}</p></div>
      </button>
      <details class="zcr-why"><summary>Pourquoi maintenant ?</summary><p>${esc(reasonText(candidate))}</p></details>
      <div class="zcr-feedback"><button type="button" data-zcr-feedback="more_like_this">Plus comme ça</button><button type="button" data-zcr-feedback="dismiss">Masquer</button></div>
    </article>`;
  }

  function markup(model) {
    const cards = [model.profile, model.event, model.venue].filter(Boolean);
    if (!cards.length) return '';
    return `<section class="zcr-panel" id="${PANEL_ID}" aria-labelledby="zcr-title">
      <header><div><span>ZWIT INTELLIGENCE · CONTEXTE</span><h2 id="zcr-title">Pour vous maintenant</h2><p>Pas de pourcentage magique : seulement des suggestions expliquées par ce qui se passe réellement autour de vous.</p></div><i aria-hidden="true">✦</i></header>
      <div class="zcr-grid">${cards.map(card).join('')}</div>
      <footer>Vos choix “Plus comme ça” et “Masquer” restent privés et servent uniquement à personnaliser vos prochaines suggestions.</footer>
    </section>`;
  }

  async function model() {
    const settled = await Promise.allSettled([
      get('/api/members/home-intelligence'),
      get('/api/members/tonight'),
      get('/api/members/events'),
      get('/api/members/directory'),
      get('/api/members/recommendation-feedback')
    ]);
    const [home, tonight, events, directory, feedbackPayload] = settled.map((result) => result.status === 'fulfilled' ? result.value : {});
    const feedback = feedbackMap(feedbackPayload);
    const eventItems = eventCandidates(events, tonight, home);
    return {
      profile: pick(profileCandidates(home, tonight), 'profile', (item) => scoreProfile(item, { home, tonight }), feedback),
      event: pick(eventItems, 'event', scoreEvent, feedback),
      venue: pick(venueCandidates(directory, home), 'venue', (item) => scoreVenue(item, eventItems), feedback)
    };
  }

  function insert(html) {
    const old = document.getElementById(PANEL_ID);
    if (!html) return old?.remove();
    if (old) old.outerHTML = html;
    else {
      const first = content.firstElementChild;
      if (first) first.insertAdjacentHTML('afterend', html);
      else content.insertAdjacentHTML('afterbegin', html);
    }
  }

  async function render({ force = false } = {}) {
    if (route !== 'home' || loading) return;
    if (!force && lastModel && Date.now() - loadedAt < 30_000) return insert(markup(lastModel));
    loading = true;
    try {
      lastModel = await model();
      loadedAt = Date.now();
      if (route === 'home') insert(markup(lastModel));
    } finally {
      loading = false;
    }
  }

  async function feedback(button) {
    const cardNode = button.closest('[data-zcr-card]');
    if (!cardNode) return;
    button.disabled = true;
    try {
      await fetch('/api/members/recommendation-feedback', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entityType: cardNode.dataset.entityType,
          entityId: cardNode.dataset.entityId,
          signal: button.dataset.zcrFeedback
        })
      }).then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'feedback_failed');
      });
      lastModel = null;
      await render({ force: true });
    } catch {
      button.disabled = false;
    }
  }

  function schedule() {
    if (scheduled || route !== 'home') return;
    scheduled = true;
    window.setTimeout(() => { scheduled = false; render(); }, 80);
  }

  document.addEventListener('click', (event) => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton?.dataset.route) {
      route = routeButton.dataset.route;
      if (route === 'home') schedule();
      else document.getElementById(PANEL_ID)?.remove();
      return;
    }
    const fb = event.target.closest('[data-zcr-feedback]');
    if (fb) {
      event.preventDefault();
      event.stopPropagation();
      feedback(fb);
    }
  }, true);

  new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
  schedule();
})();
