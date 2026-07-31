(() => {
  const POLL_INTERVAL = 12000;
  const state = {
    directory: null,
    lastUnread: null,
    selectedConversationId: null,
    refreshTimer: null,
    patchScheduled: false
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  async function api(path, options = {}) {
    const response = await fetch(path, {
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

  function initials(value) {
    return String(value || 'V')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'V';
  }

  function dateValue(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function shortDate(value) {
    const date = dateValue(value);
    if (!date) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
    }
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
  }

  function avatarMarkup(conversation, extraClass = '') {
    const name = conversation.participant_display_name || conversation.subject || 'Velvet';
    return `<span class="conversation-avatar-v2 ${extraClass}">${
      conversation.participant_photo_url
        ? `<img src="${escapeHtml(conversation.participant_photo_url)}" alt="Photo de ${escapeHtml(name)}">`
        : escapeHtml(conversation.kind === 'event' ? '✦' : initials(name))
    }</span>`;
  }

  function conversationById(id) {
    return (state.directory?.conversations || []).find((conversation) => String(conversation.id) === String(id));
  }

  function unreadCount() {
    if (Number.isFinite(Number(state.directory?.messageUnreadCount))) {
      return Number(state.directory.messageUnreadCount);
    }
    if (Number.isFinite(Number(state.directory?.message_unread_count))) {
      return Number(state.directory.message_unread_count);
    }
    return (state.directory?.conversations || []).reduce(
      (total, conversation) => total + Number(conversation.unread_count || 0),
      0
    );
  }

  function updateMessageBadges() {
    const count = unreadCount();
    document.querySelectorAll('[data-route="conversations"]').forEach((button) => {
      button.querySelector('.message-unread-badge')?.remove();
      if (!count) return;
      const badge = document.createElement('span');
      badge.className = 'message-unread-badge';
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.setAttribute('aria-label', `${count} messages non lus`);
      button.appendChild(badge);
    });
  }

  function patchConversationCards() {
    if (!state.directory) return;
    document.querySelectorAll('[data-open-conversation]').forEach((button) => {
      const conversation = conversationById(button.dataset.openConversation);
      if (!conversation) return;
      const unread = Number(conversation.unread_count || 0);
      const name = conversation.participant_display_name
        || conversation.subject
        || (conversation.kind === 'event' ? 'Salon Velvet' : 'Membre Velvet');
      button.classList.add('conversation-v2');
      button.classList.toggle('unread', unread > 0);
      button.innerHTML = `${avatarMarkup(conversation)}
        <span class="conversation-copy-v2">
          <span class="conversation-title-v2"><strong>${escapeHtml(name)}</strong><time>${escapeHtml(shortDate(conversation.last_message_at || conversation.updated_at))}</time></span>
          <p>${escapeHtml(conversation.last_message_body || 'Commencez la conversation…')}</p>
          <small>${conversation.kind === 'event' ? 'Salon Velvet' : 'Échange privé'}</small>
        </span>
        ${unread ? `<span class="conversation-count-v2" aria-label="${unread} messages non lus">${unread > 99 ? '99+' : unread}</span>` : '<span class="conversation-chevron-v2">›</span>'}`;
    });
  }

  function patchPeerHeader(form) {
    const conversationId = form.querySelector('[name="conversationId"]')?.value || state.selectedConversationId;
    const conversation = conversationById(conversationId);
    const page = form.closest('.page');
    if (!conversation || !page || page.querySelector('.conversation-peer-header')) return;
    const header = document.createElement('section');
    header.className = 'conversation-peer-header';
    const name = conversation.participant_display_name
      || conversation.subject
      || (conversation.kind === 'event' ? 'Salon Velvet' : 'Membre Velvet');
    header.innerHTML = `${avatarMarkup(conversation)}<span><strong>${escapeHtml(name)}</strong><small>${conversation.kind === 'event' ? 'Salon Velvet' : 'Conversation privée'}</small></span>`;
    const pageHead = page.querySelector('.page-head');
    if (pageHead) pageHead.insertAdjacentElement('afterend', header);
  }

  function patchComposer() {
    const form = document.querySelector('#messageForm');
    if (!form) return;
    form.classList.add('composer-v2');

    const currentField = form.querySelector('[name="body"]');
    if (currentField?.tagName === 'INPUT') {
      const textarea = document.createElement('textarea');
      textarea.name = 'body';
      textarea.maxLength = Number(currentField.maxLength || 10000);
      textarea.placeholder = currentField.placeholder || 'Écrire un message…';
      textarea.rows = 2;
      textarea.value = currentField.value || '';
      textarea.autocomplete = 'off';
      textarea.setAttribute('aria-label', 'Message');
      textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          form.requestSubmit();
        }
      });
      currentField.replaceWith(textarea);
    }

    const sendButton = form.querySelector('button[type="submit"]');
    if (sendButton && !sendButton.querySelector('.send-symbol')) {
      sendButton.innerHTML = '<span class="send-symbol" aria-hidden="true">➤</span><span class="send-label">Envoyer</span>';
      sendButton.setAttribute('aria-label', 'Envoyer le message');
    }
    patchPeerHeader(form);
  }

  function patchMessagingUI() {
    state.patchScheduled = false;
    updateMessageBadges();
    patchConversationCards();
    patchComposer();
  }

  function schedulePatch() {
    if (state.patchScheduled) return;
    state.patchScheduled = true;
    requestAnimationFrame(patchMessagingUI);
  }

  async function showIncomingNotification(previousCount, nextCount) {
    if (previousCount === null || nextCount <= previousCount || Notification.permission !== 'granted') return;
    const incoming = (state.directory?.conversations || []).find((conversation) => Number(conversation.unread_count || 0) > 0);
    if (!incoming || document.visibilityState === 'visible') return;
    const registration = await navigator.serviceWorker?.ready.catch(() => null);
    registration?.active?.postMessage({
      type: 'VELVET_NOTIFICATION',
      title: `${incoming.participant_display_name || 'Un membre Velvet'} vous a écrit`,
      body: incoming.last_message_body || 'Un nouveau message vous attend.',
      tag: `velvet-message-${incoming.id}`,
      url: '/membres/'
    });
  }

  async function refreshDirectory() {
    try {
      const previous = state.lastUnread;
      state.directory = await api('/api/members/directory');
      const next = unreadCount();
      state.lastUnread = next;
      schedulePatch();
      await showIncomingNotification(previous, next);
    } catch {
      // Le parcours d’inscription ou une session expirée ne doit pas bloquer l’interface.
    }
  }

  function base64UrlBytes(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - normalized.length % 4) % 4);
    const raw = atob(normalized + padding);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  async function enrollWebPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
    try {
      const configuration = await api('/api/members/push-subscriptions');
      if (!configuration.publicKey) return;
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlBytes(configuration.publicKey)
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
      // Le badge et les notifications intégrées restent actifs si le Web Push n’est pas configuré.
    }
  }

  function closeMobileMenu() {
    document.querySelector('.sidebar')?.classList.remove('open');
    const button = document.querySelector('#mobileMenuButton');
    button?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }

  function toggleMobileMenu(button) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const open = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
  }

  document.addEventListener('click', (event) => {
    const menuButton = event.target.closest('#mobileMenuButton');
    if (menuButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleMobileMenu(menuButton);
      return;
    }

    const conversationButton = event.target.closest('[data-open-conversation]');
    if (conversationButton) {
      state.selectedConversationId = conversationButton.dataset.openConversation;
    }

    const routeButton = event.target.closest('[data-route]');
    if (routeButton && window.matchMedia('(max-width:760px)').matches) {
      closeMobileMenu();
    }

    if (event.target.closest('[data-test-notification]')) {
      window.setTimeout(enrollWebPush, 800);
    }
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshDirectory();
  });

  const observer = new MutationObserver(schedulePatch);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  refreshDirectory();
  enrollWebPush();
  state.refreshTimer = window.setInterval(refreshDirectory, POLL_INTERVAL);
})();
