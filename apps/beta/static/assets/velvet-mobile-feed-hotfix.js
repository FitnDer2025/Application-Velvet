(() => {
  const MOBILE_QUERY = '(max-width: 900px)';
  const state = {
    profiles: [],
    directory: null,
    patchPending: false,
    patching: false,
    opening: false,
    lightbox: null
  };

  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const list = (value) => Array.isArray(value) ? value : [];

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.style.borderColor = error ? 'rgba(255,142,167,.45)' : '';
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 4200);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  }

  function initials(value) {
    return String(value || 'V').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase()).join('') || 'V';
  }

  function profileById(id) {
    return state.profiles.find((profile) => String(profile.id) === String(id));
  }

  function preferredAvatar(profile) {
    const expectedGallery = profile?.profile_type === 'couple' ? 'couple_gallery' : 'individual_gallery';
    return list(profile?.media_assets)
      .filter((asset) => asset?.moderation_status === 'approved' && asset?.previewUrl)
      .map((asset) => ({
        ...asset,
        avatarScore: (asset.media_role === 'individual_portrait' ? 100 : 0)
          + (asset.is_primary ? 30 : 0)
          + (asset.media_role === expectedGallery ? 10 : 0)
      }))
      .sort((left, right) => right.avatarScore - left.avatarScore
        || new Date(right.created_at || 0) - new Date(left.created_at || 0))[0] || null;
  }

  function patchFeedAvatars() {
    if (!state.profiles.length) return;
    document.querySelectorAll('.home-feed-card').forEach((card) => {
      const profileButton = card.querySelector('[data-open-profile]');
      const avatar = card.querySelector('.feed-avatar');
      if (!profileButton || !avatar) return;
      const profile = profileById(profileButton.dataset.openProfile);
      if (!profile) return;
      const asset = preferredAvatar(profile);
      const signature = `${profile.id}:${asset?.id || 'initials'}:${asset?.previewUrl || ''}`;
      if (avatar.dataset.velvetAvatarSignature === signature) return;
      avatar.dataset.velvetAvatarSignature = signature;
      avatar.setAttribute('aria-label', `Photo de ${profile.display_name || 'ce membre'}`);
      if (asset?.previewUrl) {
        const image = document.createElement('img');
        image.src = asset.previewUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        avatar.replaceChildren(image);
      } else {
        avatar.textContent = initials(profile.display_name);
      }
    });
  }

  function conversationAvatar(conversation) {
    const name = conversation?.participant_display_name || conversation?.subject || 'Membre Zwit';
    return `<span class="conversation-avatar-v2">${conversation?.participant_photo_url
      ? `<img src="${e(conversation.participant_photo_url)}" alt="Photo de ${e(name)}">`
      : e(initials(name))}</span>`;
  }

  function attachmentMarkup(attachment) {
    const url = attachment?.previewUrl;
    if (!url) return '';
    if (attachment.media_type === 'image') {
      return `<a href="${e(url)}" target="_blank" rel="noopener"><img src="${e(url)}" alt="Pièce jointe"></a>`;
    }
    if (attachment.media_type === 'video') {
      return `<video controls playsinline src="${e(url)}"></video>`;
    }
    return `<a class="message-document" href="${e(url)}" target="_blank" rel="noopener">Ouvrir la pièce jointe</a>`;
  }

  function messageMarkup(message, currentUserId) {
    const mine = String(message.sender_user_id || '') === String(currentUserId || '');
    return `<article class="message ${mine ? 'mine' : ''}">
      <small>${e(message.sender_identity || (mine ? 'Vous' : 'Membre'))}</small>
      ${message.body ? `<p>${e(message.body)}</p>` : ''}
      ${list(message.attachments).length ? `<div class="message-attachments">${list(message.attachments).map(attachmentMarkup).join('')}</div>` : ''}
    </article>`;
  }

  function setMessagesActive() {
    document.querySelectorAll('[data-route]').forEach((button) => {
      button.classList.toggle('active', button.dataset.route === 'conversations');
    });
  }

  function sidebar() {
    return document.querySelector('.sidebar');
  }

  function closeMobileMenu() {
    window.VelvetWebV11?.closeMenu();
  }

  function closeLightbox() {
    const lightbox = state.lightbox || document.querySelector('.velvet-photo-lightbox');
    if (!lightbox) return;
    lightbox.classList.remove('visible');
    document.body.classList.remove('velvet-lightbox-open');
    setTimeout(() => lightbox.remove(), 180);
    state.lightbox = null;
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

  function openFeedLightbox(button) {
    const image = button.querySelector('img');
    if (!image?.src) return;
    closeLightbox();
    closeMobileMenu();

    const profileId = button.dataset.openProfile || '';
    const profile = profileById(profileId);
    const title = profile?.display_name || image.alt || 'Photo Zwit';
    const lightbox = document.createElement('section');
    lightbox.className = 'velvet-photo-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', `Photo de ${title}`);
    lightbox.innerHTML = `
      <header class="velvet-photo-lightbox-head">
        <strong>${e(title)}</strong>
        <button type="button" class="velvet-photo-lightbox-close" data-close-feed-lightbox aria-label="Fermer">×</button>
      </header>
      <div class="velvet-photo-lightbox-media">
        <img src="${e(image.currentSrc || image.src)}" alt="${e(image.alt || `Photo de ${title}`)}">
      </div>
      <footer class="velvet-photo-lightbox-actions">
        ${profileId ? `<button type="button" class="primary" data-lightbox-open-profile="${e(profileId)}">Voir le profil</button>` : ''}
      </footer>`;
    document.body.appendChild(lightbox);
    document.body.classList.add('velvet-lightbox-open');
    state.lightbox = lightbox;
    requestAnimationFrame(() => {
      lightbox.classList.add('visible');
      lightbox.querySelector('[data-close-feed-lightbox]')?.focus();
    });
  }

  async function openConversationDirect(conversationId) {
    if (!conversationId || state.opening) return;
    state.opening = true;
    closeMobileMenu();
    const content = document.querySelector('#content');
    if (!content) {
      state.opening = false;
      return;
    }
    content.innerHTML = '<div class="page"><section class="loading-state"><span class="loader"></span><p>Chargement de la conversation…</p></section></div>';
    setMessagesActive();

    try {
      const [result, directory] = await Promise.all([
        api(`/api/members/messages?conversationId=${encodeURIComponent(conversationId)}`),
        state.directory ? Promise.resolve(state.directory) : api('/api/members/directory')
      ]);
      state.directory = directory;
      state.profiles = list(directory.profiles);
      const conversation = list(directory.conversations).find((row) => String(row.id) === String(conversationId));
      const name = conversation?.participant_display_name || conversation?.subject || 'Conversation privée';
      content.innerHTML = `<div class="page velvet-direct-conversation">
        <header class="page-head"><div><p class="eyebrow">Messagerie privée</p><h1>${e(name)}</h1><p>Conversation confidentielle Zwit.</p></div><button type="button" class="secondary" data-direct-conversation-back>Retour</button></header>
        <section class="conversation-peer-header">${conversationAvatar(conversation)}<span><strong>${e(name)}</strong><small>${conversation?.kind === 'event' ? 'Salon Zwit' : 'Échange privé'}</small></span></section>
        <section class="card">
          <div class="messages">${list(result.messages).length
            ? list(result.messages).map((message) => messageMarkup(message, result.currentUserId)).join('')
            : '<p>Aucun message dans cette conversation.</p>'}</div>
          <form id="messageForm" class="composer composer-v2">
            <input type="hidden" name="conversationId" value="${e(conversationId)}">
            <textarea name="body" maxlength="10000" rows="2" placeholder="Écrire un message…" aria-label="Message"></textarea>
            <label class="attachment-picker" title="Ajouter des pièces jointes"><input type="file" name="attachments" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf" multiple><span>＋ Photo, vidéo ou PDF</span></label>
            <small class="attachment-selection" role="status"></small>
            <button class="primary" type="submit" aria-label="Envoyer le message"><span class="send-symbol">➤</span><span class="send-label">Envoyer</span></button>
          </form>
        </section>
      </div>`;
      window.scrollTo({ top: 0, behavior: 'auto' });

      content.querySelector('[data-direct-conversation-back]')?.addEventListener('click', () => {
        const canonicalButton = document.querySelector('.sidebar [data-route="conversations"]');
        const menu = sidebar();
        if (menu) menu.inert = false;
        canonicalButton?.click();
        requestAnimationFrame(() => window.VelvetWebV11?.synchronize());
      });
      const fileInput = content.querySelector('#messageForm [name=attachments]');
      fileInput?.addEventListener('change', () => {
        const files = [...fileInput.files].slice(0, 4);
        content.querySelector('.attachment-selection').textContent = files.map((file) => file.name).join(' · ');
      });
      content.querySelector('#messageForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const hasAttachment = data.getAll('attachments').some((file) => file instanceof File && file.size);
        if (!String(data.get('body') || '').trim() && !hasAttachment) {
          toast('Écris un message ou ajoute une pièce jointe.', true);
          return;
        }
        const button = form.querySelector('button[type=submit]');
        button.disabled = true;
        try {
          await api('/api/members/messages', { method: 'POST', body: data });
          state.directory = null;
          state.opening = false;
          await openConversationDirect(conversationId);
        } catch (error) {
          toast(error.message, true);
          button.disabled = false;
        }
      });
      const messages = content.querySelector('.messages');
      messages?.scrollTo({ top: messages.scrollHeight });
    } catch (error) {
      toast('Cette conversation n’a pas pu être ouverte. Réessaie dans quelques secondes.', true);
      const canonicalButton = document.querySelector('.sidebar [data-route="conversations"]');
      const menu = sidebar();
      if (menu) menu.inert = false;
      canonicalButton?.click();
      requestAnimationFrame(() => window.VelvetWebV11?.synchronize());
    } finally {
      state.opening = false;
    }
  }

  function patch() {
    state.patchPending = false;
    if (state.patching) return;
    state.patching = true;
    patchFeedAvatars();
    requestAnimationFrame(() => { state.patching = false; });
  }

  function schedulePatch() {
    if (state.patchPending || state.patching) return;
    state.patchPending = true;
    requestAnimationFrame(patch);
  }

  async function refreshProfiles() {
    try {
      state.directory = await api('/api/members/directory');
      state.profiles = list(state.directory.profiles);
      schedulePatch();
    } catch {
      // Le parcours reste fonctionnel en cas de rafraîchissement temporairement indisponible.
    }
  }

  function relayMessagesRoute(event) {
    if (!matchMedia(MOBILE_QUERY).matches) return false;
    const messageButton = event.target.closest('.bottom-nav [data-route="conversations"]');
    if (!messageButton || messageButton.dataset.velvetRouteRelay === 'true') return false;
    const canonicalButton = document.querySelector('.sidebar [data-route="conversations"]');
    if (!canonicalButton) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeMobileMenu();
    messageButton.dataset.velvetRouteRelay = 'true';
    const menu = sidebar();
    if (menu) menu.inert = false;
    canonicalButton.click();
    requestAnimationFrame(() => {
      delete messageButton.dataset.velvetRouteRelay;
      window.VelvetWebV11?.synchronize();
    });
    return true;
  }

  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close-feed-lightbox]');
    if (close || (event.target.classList?.contains('velvet-photo-lightbox'))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeLightbox();
      return;
    }

    const lightboxProfile = event.target.closest('[data-lightbox-open-profile]');
    if (lightboxProfile) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const profileId = lightboxProfile.dataset.lightboxOpenProfile;
      closeLightbox();
      setTimeout(() => dispatchProfileOpen(profileId), 0);
      return;
    }

    const feedPhoto = event.target.closest('.feed-photo');
    if (feedPhoto) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openFeedLightbox(feedPhoto);
      return;
    }

    const conversation = event.target.closest('[data-open-conversation]');
    if (conversation) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openConversationDirect(conversation.dataset.openConversation);
      return;
    }

    relayMessagesRoute(event);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.lightbox) {
      event.preventDefault();
      closeLightbox();
    }
  });

  new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProfiles(); });
  window.addEventListener('focus', refreshProfiles);
  window.addEventListener('pageshow', () => {
    closeLightbox();
    closeMobileMenu();
    refreshProfiles();
  });

  refreshProfiles();
  schedulePatch();
})();
