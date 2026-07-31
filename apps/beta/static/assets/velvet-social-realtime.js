(() => {
  'use strict';

  const REACTION_EMOJI = {
    like: '👍',
    love: '❤️',
    laugh: '😂',
    wow: '😮',
    sad: '😢',
    fire: '🔥'
  };
  const state = {
    messagesPayload: null,
    conversationId: null,
    notificationFeed: null,
    engagement: null,
    directory: null,
    typingTimer: null,
    typingActive: false,
    lastTypingSentAt: 0,
    archiveDialog: null,
    scheduled: false
  };

  const list = (value) => Array.isArray(value) ? value : [];
  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  async function api(path, options = {}) {
    const response = await fetch(path, {
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

  function formatTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function relativeDate(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    const delta = Date.now() - date.getTime();
    if (delta < 60_000) return 'à l’instant';
    if (delta < 3_600_000) return `il y a ${Math.max(1, Math.round(delta / 60_000))} min`;
    if (delta < 86_400_000) return `il y a ${Math.max(1, Math.round(delta / 3_600_000))} h`;
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function conversationPage() {
    return document.querySelector('.velvet-direct-conversation');
  }

  function currentConversationId(page = conversationPage()) {
    return page?.querySelector('#messageForm [name="conversationId"]')?.value || '';
  }

  async function postConversationAction(action, extra = {}) {
    const conversationId = extra.conversationId || state.conversationId || currentConversationId();
    if (!conversationId) return null;
    return api('/api/members/messages', {
      method: 'POST',
      body: JSON.stringify({ action, conversationId, ...extra })
    });
  }

  function receiptText(receipts = []) {
    if (!receipts.length) return 'Envoyé';
    return receipts.map((receipt) => {
      const name = receipt.displayIdentity || 'Membre Velvet';
      if (receipt.status === 'read') return `Lu par ${name}${receipt.readAt ? ` à ${formatTime(receipt.readAt)}` : ''}`;
      if (receipt.status === 'delivered') return `Distribué à ${name}`;
      return `Envoyé à ${name}`;
    }).join(' · ');
  }

  function groupedReactions(reactions = []) {
    const groups = new Map();
    reactions.forEach((reaction) => {
      const key = reaction.reaction;
      const row = groups.get(key) || { count: 0, names: [] };
      row.count += 1;
      row.names.push(reaction.display_identity || 'Membre Velvet');
      groups.set(key, row);
    });
    return groups;
  }

  function reactionPicker(messageId, conversationId) {
    const picker = document.createElement('div');
    picker.className = 'velvet-message-reaction-picker';
    picker.setAttribute('role', 'menu');
    Object.entries(REACTION_EMOJI).forEach(([reaction, emoji]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = emoji;
      button.title = reaction;
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await postConversationAction('reaction', { conversationId, messageId, reaction }).catch(() => null);
        picker.remove();
        await refreshConversation();
      });
      picker.appendChild(button);
    });
    return picker;
  }

  function decorateMessages(page, payload) {
    const container = page.querySelector('.messages');
    const nodes = [...container?.querySelectorAll(':scope > .message') || []];
    const messages = list(payload?.messages);
    if (!container || !messages.length || nodes.length !== messages.length) return;

    nodes.forEach((node, index) => {
      const message = messages[index];
      const mine = message.sender_user_id === payload.currentUserId;
      node.dataset.messageId = message.id;
      node.querySelectorAll('.velvet-message-receipt,.velvet-message-reactions,.velvet-message-react,.velvet-message-reaction-picker').forEach((item) => item.remove());

      if (!mine && message.sender_identity) {
        const existing = node.querySelector(':scope > small');
        if (existing) existing.textContent = message.sender_identity;
      }

      const reactions = list(payload.reactions?.[message.id]);
      if (reactions.length) {
        const row = document.createElement('div');
        row.className = 'velvet-message-reactions';
        groupedReactions(reactions).forEach((value, reaction) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.innerHTML = `<span>${REACTION_EMOJI[reaction] || '♡'}</span>${value.count > 1 ? `<b>${value.count}</b>` : ''}`;
          chip.title = value.names.join(', ');
          chip.addEventListener('click', async () => {
            const mineReaction = reactions.find((item) => item.user_id === payload.currentUserId && item.reaction === reaction);
            await postConversationAction('reaction', {
              conversationId: state.conversationId,
              messageId: message.id,
              reaction: mineReaction ? null : reaction
            }).catch(() => null);
            await refreshConversation();
          });
          row.appendChild(chip);
        });
        node.appendChild(row);
      }

      if (mine) {
        const receipt = document.createElement('small');
        receipt.className = 'velvet-message-receipt';
        receipt.textContent = receiptText(list(payload.receipts?.[message.id]));
        node.appendChild(receipt);
      } else {
        const react = document.createElement('button');
        react.type = 'button';
        react.className = 'velvet-message-react';
        react.textContent = '☺︎';
        react.setAttribute('aria-label', 'Réagir à ce message');
        react.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          node.querySelector('.velvet-message-reaction-picker')?.remove();
          node.appendChild(reactionPicker(message.id, state.conversationId));
        });
        node.appendChild(react);
      }
    });

    container.querySelector('.velvet-typing-indicator')?.remove();
    const typing = list(payload.typing);
    if (typing.length) {
      const indicator = document.createElement('div');
      indicator.className = 'velvet-typing-indicator';
      const names = typing.map((row) => row.display_identity || 'Un membre').join(' et ');
      indicator.innerHTML = `<span></span><span></span><span></span><em>${e(names)} ${typing.length > 1 ? 'écrivent' : 'écrit'}…</em>`;
      container.appendChild(indicator);
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }

  async function refreshConversation() {
    const page = conversationPage();
    const conversationId = currentConversationId(page);
    if (!page || !conversationId || document.hidden) return;
    state.conversationId = conversationId;
    try {
      const payload = await api(`/api/members/messages?conversationId=${encodeURIComponent(conversationId)}`);
      if (state.conversationId !== conversationId || !page.isConnected) return;
      state.messagesPayload = payload;
      decorateMessages(page, payload);
      await refreshNotifications();
    } catch {
      // La conversation existante reste utilisable pendant une coupure réseau.
    }
  }

  function attachComposer(page) {
    const form = page.querySelector('#messageForm');
    const textarea = form?.querySelector('textarea[name="body"]');
    if (!form || !textarea || form.dataset.socialRealtimeComposer === '1') return;
    form.dataset.socialRealtimeComposer = '1';

    const sendTyping = async (active) => {
      if (active && Date.now() - state.lastTypingSentAt < 1800) return;
      state.lastTypingSentAt = Date.now();
      state.typingActive = active;
      await postConversationAction('typing', { active }).catch(() => null);
    };

    textarea.addEventListener('input', () => {
      const active = textarea.value.trim().length > 0;
      if (active) sendTyping(true);
      clearTimeout(state.typingTimer);
      state.typingTimer = setTimeout(() => sendTyping(false), 4500);
    });
    textarea.addEventListener('blur', () => sendTyping(false));
    form.addEventListener('submit', () => {
      const submitted = textarea.value;
      clearTimeout(state.typingTimer);
      sendTyping(false);
      window.setTimeout(() => {
        if (textarea.value === submitted) {
          textarea.value = '';
          textarea.style.height = '';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 120);
      window.setTimeout(refreshConversation, 500);
    }, true);
  }

  async function markVisibleConversationsDelivered() {
    if (document.hidden) return;
    try {
      const directory = await api('/api/members/directory');
      state.directory = directory;
      await Promise.all(list(directory.conversations)
        .filter((conversation) => Number(conversation.unread_count || 0) > 0)
        .map((conversation) => postConversationAction('delivered', { conversationId: conversation.id }).catch(() => null)));
    } catch {
      // Le statut sera réessayé au prochain cycle.
    }
  }

  function updateNotificationBadges(feed) {
    const count = Number(feed?.unreadCount || 0);
    document.querySelectorAll('[data-route="notifications"]').forEach((button) => {
      let badge = button.querySelector('.velvet-notification-badge-v2');
      if (!count) {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'velvet-notification-badge-v2';
        button.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.setAttribute('aria-label', `${count} notifications non lues`);
    });
  }

  function reactionLabel(notification) {
    const reaction = notification.metadata?.reaction;
    return ({ like: '👍', love: '❤️', adore: '😍' })[reaction] || '❤️';
  }

  function enrichNotificationTiles(feed) {
    list(feed?.notifications).forEach((notification) => {
      const tile = document.querySelector(`[data-open-notification="${CSS.escape(String(notification.id))}"]`);
      if (!tile) return;
      tile.dataset.notificationV2 = '1';
      tile.classList.toggle('unread', !notification.read_at);
      tile.querySelector('.velvet-notification-entity-preview')?.remove();
      if (notification.entityPreviewUrl) {
        const preview = document.createElement('span');
        preview.className = 'velvet-notification-entity-preview';
        preview.innerHTML = `<img src="${e(notification.entityPreviewUrl)}" alt="Photo concernée">${notification.event_type === 'reactions' ? `<b>${reactionLabel(notification)}</b>` : ''}`;
        tile.appendChild(preview);
      }
    });
  }

  function profileFor(id) {
    return list(state.directory?.profiles).find((profile) => String(profile.id) === String(id));
  }

  function openProfile(id) {
    if (!id) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.hidden = true;
    trigger.dataset.openProfile = id;
    document.body.appendChild(trigger);
    trigger.click();
    trigger.remove();
  }

  function ensureArchiveDialog() {
    if (state.archiveDialog?.isConnected) return state.archiveDialog;
    const dialog = document.createElement('dialog');
    dialog.className = 'velvet-notification-archive-dialog';
    dialog.innerHTML = '<header><div><small>ACTIVITÉ</small><h2>Archives</h2></div><button type="button" data-close-archives aria-label="Fermer">×</button></header><section data-archive-content></section>';
    dialog.querySelector('[data-close-archives]').addEventListener('click', () => dialog.close());
    document.body.appendChild(dialog);
    state.archiveDialog = dialog;
    return dialog;
  }

  async function showArchives() {
    const dialog = ensureArchiveDialog();
    const content = dialog.querySelector('[data-archive-content]');
    content.innerHTML = '<p class="muted">Chargement…</p>';
    dialog.showModal();
    try {
      const feed = await api('/api/members/notifications?archived=1');
      content.innerHTML = list(feed.notifications).length
        ? list(feed.notifications).map((notification) => `<article class="velvet-archive-item">
          ${notification.actorPreviewUrl ? `<img src="${e(notification.actorPreviewUrl)}" alt="">` : '<span>V</span>'}
          <div><b>${e(notification.title)}</b><p>${e(notification.body || '')}</p><small>${e(relativeDate(notification.created_at))}</small></div>
          ${notification.entityPreviewUrl ? `<img class="entity" src="${e(notification.entityPreviewUrl)}" alt="Photo concernée">` : ''}
        </article>`).join('')
        : '<p class="muted">Aucune activité archivée.</p>';
    } catch {
      content.innerHTML = '<p class="muted">Les archives sont momentanément indisponibles.</p>';
    }
  }

  function ensureNotificationTools(feed) {
    const page = [...document.querySelectorAll('.page')].find((node) => node.querySelector('[data-read-all-notifications]') || node.querySelector('.notification-feed'));
    if (!page) return;
    let tools = page.querySelector('.velvet-notification-tools-v2');
    if (!tools) {
      tools = document.createElement('section');
      tools.className = 'velvet-notification-tools-v2';
      tools.innerHTML = '<button type="button" data-enable-web-push>Activer les alertes sur cet appareil</button><button type="button" data-open-archives>Archives</button>';
      page.querySelector('.page-head')?.insertAdjacentElement('afterend', tools);
      tools.querySelector('[data-open-archives]').addEventListener('click', showArchives);
      tools.querySelector('[data-enable-web-push]').addEventListener('click', enableWebPush);
    }
    const archiveButton = tools.querySelector('[data-open-archives]');
    archiveButton.textContent = `Archives${feed.archiveCount ? ` · ${feed.archiveCount}` : ''}`;
    updatePushButton(tools.querySelector('[data-enable-web-push]'));
    ensureViewHistory(page);
  }

  async function refreshNotifications() {
    try {
      const feed = await api('/api/members/notifications');
      state.notificationFeed = feed;
      updateNotificationBadges(feed);
      enrichNotificationTiles(feed);
      ensureNotificationTools(feed);
    } catch {
      // Les compteurs existants restent affichés.
    }
  }

  function updatePushButton(button) {
    if (!button || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      button.textContent = 'Alertes activées';
      button.disabled = true;
    } else if (Notification.permission === 'denied') {
      button.textContent = 'Alertes bloquées dans les réglages';
      button.disabled = true;
    } else if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) {
      button.textContent = 'Installer Velvet pour activer les alertes';
    }
  }

  function applicationServerKey(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  async function enableWebPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) {
      alert('Sur iPhone, ajoute d’abord Velvet à l’écran d’accueil, puis active les alertes depuis la Web App.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      refreshNotifications();
      return;
    }
    try {
      const configuration = await api('/api/members/push-subscriptions');
      if (!configuration.publicKey) throw new Error('push_not_configured');
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(configuration.publicKey)
        });
      }
      const serialized = subscription.toJSON();
      await api('/api/members/push-subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: serialized.keys || {},
          installationOrigin: location.origin
        })
      });
    } catch {
      alert('Les alertes ne sont pas encore configurées sur cet environnement Velvet.');
    }
    refreshNotifications();
  }

  function decorateProfileViews() {
    const views = new Map(list(state.engagement?.views).map((view) => [String(view.viewed_profile_id), view]));
    document.querySelectorAll('[data-open-profile]').forEach((button) => {
      const view = views.get(String(button.dataset.openProfile));
      button.querySelector('.velvet-profile-viewed-v2')?.remove();
      if (!view) return;
      const badge = document.createElement('span');
      badge.className = 'velvet-profile-viewed-v2';
      badge.textContent = `Déjà consulté · ${Number(view.view_count || 1)} fois · ${relativeDate(view.last_viewed_at)}`;
      button.appendChild(badge);
    });

    document.querySelectorAll('[data-profile-carousel][data-profile-id]').forEach((carousel) => {
      const view = views.get(String(carousel.dataset.profileId));
      const page = carousel.closest('.page');
      page?.querySelector('.velvet-profile-view-summary-v2')?.remove();
      if (!view || !page) return;
      const summary = document.createElement('div');
      summary.className = 'velvet-profile-view-summary-v2';
      summary.textContent = `Vous avez consulté ce profil ${Number(view.view_count || 1)} fois · dernière visite ${relativeDate(view.last_viewed_at)}`;
      carousel.insertAdjacentElement('afterend', summary);
    });
  }

  function ensureViewHistory(page) {
    if (!state.engagement || !state.directory || page.querySelector('.velvet-view-history-v2')) return;
    const views = list(state.engagement.views).slice(0, 30);
    const section = document.createElement('details');
    section.className = 'velvet-view-history-v2';
    section.innerHTML = `<summary>Profils consultés · ${views.length}</summary><div>${views.length ? views.map((view) => {
      const profile = profileFor(view.viewed_profile_id);
      const photo = profile?.media_assets?.find((media) => media.is_primary)?.previewUrl || profile?.media_assets?.[0]?.previewUrl || '';
      return `<button type="button" data-history-profile="${e(view.viewed_profile_id)}">${photo ? `<img src="${e(photo)}" alt="">` : '<span>V</span>'}<b>${e(profile?.display_name || 'Profil Velvet')}</b><small>${Number(view.view_count || 1)} consultation(s) · ${e(relativeDate(view.last_viewed_at))}</small></button>`;
    }).join('') : '<p class="muted">Aucun profil consulté pour le moment.</p>'}</div>`;
    section.addEventListener('click', (event) => {
      const button = event.target.closest('[data-history-profile]');
      if (button) openProfile(button.dataset.historyProfile);
    });
    page.appendChild(section);
  }

  async function refreshEngagement() {
    try {
      const [engagement, directory] = await Promise.all([
        api('/api/members/engagement'),
        state.directory ? Promise.resolve(state.directory) : api('/api/members/directory')
      ]);
      state.engagement = engagement;
      state.directory = directory;
      decorateProfileViews();
      const page = [...document.querySelectorAll('.page')].find((node) => node.querySelector('.notification-feed'));
      if (page) ensureViewHistory(page);
    } catch {
      // L’historique sera réessayé au prochain cycle.
    }
  }

  function attachGlobalHandlers() {
    document.addEventListener('click', (event) => {
      const notification = event.target.closest('[data-open-notification]');
      if (notification) {
        api('/api/members/notifications', {
          method: 'POST',
          body: JSON.stringify({ action: 'read', notificationId: notification.dataset.openNotification })
        }).then(refreshNotifications).catch(() => null);
      }
      if (event.target.closest('[data-read-all-notifications]')) {
        window.setTimeout(refreshNotifications, 250);
      }
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        refreshConversation();
        refreshNotifications();
        markVisibleConversationsDelivered();
      } else if (state.typingActive) {
        postConversationAction('typing', { active: false }).catch(() => null);
      }
    });
  }

  function sync() {
    state.scheduled = false;
    const page = conversationPage();
    if (page) {
      const id = currentConversationId(page);
      if (id !== state.conversationId) {
        state.conversationId = id;
        state.messagesPayload = null;
      }
      attachComposer(page);
      if (state.messagesPayload) decorateMessages(page, state.messagesPayload);
    }
    if (state.notificationFeed) {
      enrichNotificationTiles(state.notificationFeed);
      ensureNotificationTools(state.notificationFeed);
    }
    if (state.engagement) decorateProfileViews();
  }

  function schedule() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(sync);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  attachGlobalHandlers();
  refreshConversation();
  refreshNotifications();
  refreshEngagement();
  markVisibleConversationsDelivered();
  window.setInterval(refreshConversation, 2600);
  window.setInterval(refreshNotifications, 5000);
  window.setInterval(markVisibleConversationsDelivered, 10000);
  window.setInterval(refreshEngagement, 15000);
})();
