(() => {
  'use strict';

  const state = {
    directory: null,
    reactions: new Map(),
    initializedNotifications: false,
    knownNotificationIds: new Set(),
    patchScheduled: false,
    polling: null
  };

  const list = (value) => Array.isArray(value) ? value : [];
  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      cache: 'no-store',
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
    node.style.borderColor = error ? 'rgba(255,142,167,.45)' : '';
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 4200);
  }

  function dispatchProfileOpen(profileId) {
    if (!profileId) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.hidden = true;
    trigger.dataset.openProfile = profileId;
    document.body.appendChild(trigger);
    trigger.click();
    trigger.remove();
  }

  function profileIdForFeedCard(card) {
    return card?.querySelector('[data-open-profile]')?.dataset.openProfile || '';
  }

  function patchFeedProfileLinks() {
    document.querySelectorAll('.home-feed-card').forEach((card) => {
      const profileId = profileIdForFeedCard(card);
      if (!profileId) return;
      card.querySelectorAll(':scope > header strong, :scope > header .feed-avatar').forEach((node) => {
        node.dataset.socialProfileId = profileId;
        node.setAttribute('role', 'button');
        node.setAttribute('tabindex', '0');
        node.setAttribute('aria-label', 'Voir la fiche de ce membre');
      });
    });
  }

  function normalizedPath(value) {
    try {
      return new URL(value, location.href).pathname;
    } catch {
      return String(value || '').split('?')[0];
    }
  }

  async function ensureDirectory() {
    if (state.directory) return state.directory;
    state.directory = await api('/api/members/directory');
    return state.directory;
  }

  async function ensureReactions() {
    const payload = await api('/api/members/photo-reactions');
    list(payload.reactions).forEach((summary) => state.reactions.set(String(summary.media_id), summary));
    return state.reactions;
  }

  function allProfileMedia(directory) {
    return list(directory?.profiles).flatMap((profile) => list(profile.media_assets).map((asset) => ({
      ...asset,
      profileId: profile.id,
      profileName: profile.display_name
    })));
  }

  async function mediaForLightbox(lightbox) {
    const image = lightbox.querySelector('.velvet-photo-lightbox-media img');
    if (!image?.src) return null;
    const directory = await ensureDirectory();
    const targetPath = normalizedPath(image.currentSrc || image.src);
    return allProfileMedia(directory).find((asset) =>
      asset?.id && asset?.previewUrl && normalizedPath(asset.previewUrl) === targetPath
    ) || null;
  }

  const reactionDefinitions = [
    ['like', '👍', 'J’aime', 'like_count'],
    ['love', '❤️', 'J’adore', 'love_count'],
    ['adore', '😍', 'Coup de cœur', 'adore_count']
  ];

  function emptySummary(mediaId) {
    return {
      media_id: mediaId,
      like_count: 0,
      love_count: 0,
      adore_count: 0,
      total_count: 0,
      my_reaction: null
    };
  }

  function reactionMarkup(mediaId) {
    const summary = state.reactions.get(String(mediaId)) || emptySummary(mediaId);
    return `<div class="velvet-lightbox-reactions" data-social-photo-reactions="${e(mediaId)}" aria-label="Réagir à cette photo">
      ${reactionDefinitions.map(([value, icon, label, countKey]) => `<button type="button" class="${summary.my_reaction === value ? 'active' : ''}" data-photo-reaction="${value}" data-photo-id="${e(mediaId)}" aria-label="${label}"><b>${icon}</b><small>${Number(summary[countKey] || 0)}</small></button>`).join('')}
      <span>${Number(summary.total_count || 0)} réaction${Number(summary.total_count || 0) === 1 ? '' : 's'}</span>
    </div>`;
  }

  function updateReactionBars(mediaId, summary) {
    state.reactions.set(String(mediaId), summary);
    document.querySelectorAll(`[data-photo-reaction-bar="${CSS.escape(String(mediaId))}"], [data-social-photo-reactions="${CSS.escape(String(mediaId))}"]`).forEach((bar) => {
      reactionDefinitions.forEach(([value, , , countKey]) => {
        const button = bar.querySelector(`[data-photo-reaction="${value}"]`);
        if (!button) return;
        button.classList.toggle('active', summary.my_reaction === value);
        const count = button.querySelector('small');
        if (count) count.textContent = String(Number(summary[countKey] || 0));
        button.disabled = false;
      });
      const total = bar.querySelector(':scope > em, :scope > span:last-child');
      if (total) {
        const count = Number(summary.total_count || 0);
        total.textContent = `${count} réaction${count === 1 ? '' : 's'}`;
      }
    });
  }

  async function react(button) {
    const mediaId = button.dataset.photoId;
    const requested = button.dataset.photoReaction;
    if (!mediaId || !requested) return;
    const current = state.reactions.get(String(mediaId)) || emptySummary(mediaId);
    const reaction = current.my_reaction === requested ? null : requested;
    document.querySelectorAll(`[data-photo-id="${CSS.escape(String(mediaId))}"]`).forEach((node) => { node.disabled = true; });
    try {
      const result = await api('/api/members/photo-reactions', {
        method: 'POST',
        body: JSON.stringify({ mediaId, reaction })
      });
      if (!result.summary) throw new Error('photo_reaction_persistence_failed');
      updateReactionBars(mediaId, result.summary);
      toast(reaction ? 'Ta réaction a été envoyée.' : 'Ta réaction a été retirée.');
    } catch (error) {
      document.querySelectorAll(`[data-photo-id="${CSS.escape(String(mediaId))}"]`).forEach((node) => { node.disabled = false; });
      const messages = {
        cannot_react_to_own_photo: 'Tu ne peux pas réagir à ta propre photo.',
        photo_access_denied: 'Cette photo n’est plus accessible.'
      };
      toast(messages[error.message] || 'La réaction n’a pas pu être enregistrée.', true);
    }
  }

  async function patchLightbox(lightbox) {
    if (lightbox.dataset.socialReactions === 'loading' || lightbox.dataset.socialReactions === '1') return;
    lightbox.dataset.socialReactions = 'loading';
    try {
      await Promise.all([ensureDirectory(), ensureReactions()]);
      if (!lightbox.isConnected) return;
      const media = await mediaForLightbox(lightbox);
      if (!media?.id) {
        lightbox.dataset.socialReactions = 'unavailable';
        return;
      }
      const footer = lightbox.querySelector('.velvet-photo-lightbox-actions');
      if (!footer) return;
      footer.insertAdjacentHTML('afterbegin', reactionMarkup(media.id));
      lightbox.dataset.socialReactions = '1';
      lightbox.dataset.mediaId = media.id;
    } catch {
      lightbox.dataset.socialReactions = 'unavailable';
    }
  }

  function patch() {
    state.patchScheduled = false;
    patchFeedProfileLinks();
    document.querySelectorAll('.velvet-photo-lightbox').forEach(patchLightbox);
  }

  function schedulePatch() {
    if (state.patchScheduled) return;
    state.patchScheduled = true;
    requestAnimationFrame(patch);
  }

  async function notifyLocally(notification) {
    const text = notification?.body || notification?.title || 'Une nouvelle réaction vous attend.';
    toast(text);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker?.ready.catch(() => null);
      registration?.showNotification(notification.title || 'Zwit', {
        body: text,
        icon: '/assets/velvet-icon-192.png',
        badge: '/assets/velvet-icon-192.png',
        tag: `velvet-reaction-${notification.id}`,
        data: { url: '/membres/?route=notifications' }
      }).catch(() => null);
    }
  }

  async function pollNotifications() {
    try {
      const payload = await api('/api/members/notifications');
      const notifications = list(payload.notifications);
      if (!state.initializedNotifications) {
        notifications.forEach((row) => state.knownNotificationIds.add(String(row.id)));
        state.initializedNotifications = true;
        return;
      }
      const fresh = notifications.filter((row) => !state.knownNotificationIds.has(String(row.id)));
      notifications.forEach((row) => state.knownNotificationIds.add(String(row.id)));
      fresh.filter((row) => row.event_type === 'reactions').reverse().forEach(notifyLocally);
    } catch {
      // La consultation normale des notifications reste disponible si le polling échoue.
    }
  }

  document.addEventListener('click', (event) => {
    const profileLink = event.target.closest('[data-social-profile-id]');
    if (profileLink) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      dispatchProfileOpen(profileLink.dataset.socialProfileId);
      return;
    }

    const reactionButton = event.target.closest('[data-photo-reaction]');
    if (reactionButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      react(reactionButton);
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    const profileLink = event.target.closest?.('[data-social-profile-id]');
    if (!profileLink || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    dispatchProfileOpen(profileLink.dataset.socialProfileId);
  });

  new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      schedulePatch();
      pollNotifications();
    }
  });

  schedulePatch();
  pollNotifications();
  state.polling = window.setInterval(pollNotifications, 5000);
})();
