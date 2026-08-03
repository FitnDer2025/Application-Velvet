(() => {
  const POLL_INTERVAL = 12000;
  const state = {
    directory: null,
    lastUnread: null,
    selectedConversationId: null,
    patchScheduled: false,
    isPatching: false
  };

  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
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
    return String(value || 'V').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0]).join('').toUpperCase() || 'V';
  }

  function shortDate(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return date.toDateString() === new Date().toDateString()
      ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date)
      : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
  }

  function conversations() {
    return state.directory?.conversations || [];
  }

  function conversationById(id) {
    return conversations().find((conversation) => String(conversation.id) === String(id));
  }

  function unreadCount() {
    const declared = state.directory?.messageUnreadCount ?? state.directory?.message_unread_count;
    if (Number.isFinite(Number(declared))) return Number(declared);
    return conversations().reduce((total, conversation) => total + Number(conversation.unread_count || 0), 0);
  }

  function avatar(conversation) {
    const name = conversation.participant_display_name || conversation.subject || 'Velvet';
    return `<span class="conversation-avatar-v2">${conversation.participant_photo_url
      ? `<img src="${e(conversation.participant_photo_url)}" alt="Photo de ${e(name)}">`
      : e(conversation.kind === 'event' ? '✦' : initials(name))}</span>`;
  }

  function updateBadges() {
    const count = unreadCount();
    document.querySelectorAll('[data-route="conversations"]').forEach((button) => {
      const existing = button.querySelector('.velvet-message-badge');
      if (!count) {
        existing?.remove();
        return;
      }
      const label = count > 99 ? '99+' : String(count);
      if (existing) {
        if (existing.textContent !== label) existing.textContent = label;
        existing.setAttribute('aria-label', `${count} messages non lus`);
        return;
      }
      const badge = document.createElement('span');
      badge.className = 'velvet-message-badge';
      badge.textContent = label;
      badge.setAttribute('aria-label', `${count} messages non lus`);
      button.appendChild(badge);
    });
  }

  function patchConversationCards() {
    if (!state.directory) return;
    document.querySelectorAll('[data-open-conversation]').forEach((button) => {
      const conversation = conversationById(button.dataset.openConversation);
      if (!conversation) return;
      const count = Number(conversation.unread_count || 0);
      const name = conversation.participant_display_name || conversation.subject
        || (conversation.kind === 'event' ? 'Salon Velvet' : 'Membre Velvet');
      const date = shortDate(conversation.last_message_at || conversation.updated_at);
      const preview = conversation.last_message_body || 'Commencez la conversation…';
      const signature = JSON.stringify([
        name,
        date,
        preview,
        count,
        conversation.participant_photo_url || '',
        conversation.kind || ''
      ]);
      if (button.dataset.messagingSignature === signature) return;
      button.dataset.messagingSignature = signature;
      button.classList.add('conversation-v2');
      button.classList.toggle('unread', count > 0);
      button.innerHTML = `${avatar(conversation)}
        <span class="conversation-copy-v2">
          <span class="conversation-title-v2"><strong>${e(name)}</strong><time>${e(date)}</time></span>
          <p>${e(preview)}</p>
          <small>${conversation.kind === 'event' ? 'Salon Velvet' : 'Échange privé'}</small>
        </span>
        ${count ? `<span class="conversation-count-v2" aria-label="${count} messages non lus">${count > 99 ? '99+' : count}</span>` : '<span class="conversation-chevron-v2">›</span>'}`;
    });
  }

  function patchPeerHeader(form) {
    const id = form.querySelector('[name="conversationId"]')?.value || state.selectedConversationId;
    const conversation = conversationById(id);
    const page = form.closest('.page');
    if (!conversation || !page || page.querySelector('.conversation-peer-header')) return;
    const name = conversation.participant_display_name || conversation.subject
      || (conversation.kind === 'event' ? 'Salon Velvet' : 'Membre Velvet');
    const header = document.createElement('section');
    header.className = 'conversation-peer-header';
    header.innerHTML = `${avatar(conversation)}<span><strong>${e(name)}</strong><small>${conversation.kind === 'event' ? 'Salon Velvet' : 'Conversation privée'}</small></span>`;
    page.querySelector('.page-head')?.insertAdjacentElement('afterend', header);
  }

  function patchComposer() {
    const form = document.querySelector('#messageForm');
    if (!form) return;
    form.classList.add('composer-v2');
    const field = form.querySelector('[name="body"]');
    if (field?.tagName === 'INPUT') {
      const textarea = document.createElement('textarea');
      textarea.name = 'body';
      textarea.maxLength = Number(field.maxLength || 10000);
      textarea.placeholder = field.placeholder || 'Écrire un message…';
      textarea.rows = 2;
      textarea.value = field.value || '';
      textarea.autocomplete = 'off';
      textarea.setAttribute('aria-label', 'Message');
      textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          form.requestSubmit();
        }
      });
      field.replaceWith(textarea);
    }
    const button = form.querySelector('button[type="submit"]');
    if (button && !button.querySelector('.send-symbol')) {
      button.innerHTML = '<span class="send-symbol" aria-hidden="true">➤</span><span class="send-label">Envoyer</span>';
      button.setAttribute('aria-label', 'Envoyer le message');
    }
    patchPeerHeader(form);
  }

  function patch() {
    state.patchScheduled = false;
    if (state.isPatching) return;
    state.isPatching = true;
    updateBadges();
    patchConversationCards();
    patchComposer();
    requestAnimationFrame(() => { state.isPatching = false; });
  }

  function schedulePatch() {
    if (state.patchScheduled || state.isPatching) return;
    state.patchScheduled = true;
    requestAnimationFrame(patch);
  }

  async function notifyIfNeeded(previous, next) {
    if (previous === null || next <= previous || document.visibilityState === 'visible') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const conversation = conversations()
      .filter((row) => Number(row.unread_count || 0) > 0)
      .sort((left, right) => new Date(right.last_message_at || 0) - new Date(left.last_message_at || 0))[0];
    if (!conversation) return;
    const registration = await navigator.serviceWorker?.ready.catch(() => null);
    registration?.active?.postMessage({
      type: 'VELVET_NOTIFICATION',
      title: `${conversation.participant_display_name || 'Un membre Velvet'} vous a écrit`,
      body: conversation.last_message_body || 'Un nouveau message vous attend.',
      tag: `velvet-message-${conversation.id}`,
      url: '/membres/'
    });
  }

  async function refreshMessaging() {
    try {
      const previous = state.lastUnread;
      state.directory = await api('/api/members/directory');
      const next = unreadCount();
      state.lastUnread = next;
      schedulePatch();
      await notifyIfNeeded(previous, next);
    } catch {
      // Le parcours d’inscription ou une session expirée ne bloque pas la page.
    }
  }

  function applicationServerKey(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  async function enrollWebPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const configuration = await api('/api/members/push-subscriptions');
      if (!configuration.publicKey) return;
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
      // Les badges restent disponibles si le serveur Web Push n’est pas configuré.
    }
  }

  function closeMenu() {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.body.classList.remove('nav-open', 'velvet-mobile-menu-open');
    document.querySelector('#mobileMenuButton')?.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu(button) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const open = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    document.body.classList.toggle('velvet-mobile-menu-open', open);
    button.setAttribute('aria-expanded', String(open));
  }

  document.addEventListener('click', (event) => {
    const menu = event.target.closest('#mobileMenuButton');
    if (menu) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (window.VelvetWebV11?.toggleMenu) window.VelvetWebV11.toggleMenu();
      else toggleMenu(menu);
      return;
    }
    const conversation = event.target.closest('[data-open-conversation]');
    if (conversation) state.selectedConversationId = conversation.dataset.openConversation;
    if (event.target.closest('[data-route]') && matchMedia('(max-width:900px)').matches) closeMenu();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshMessaging();
  });
  window.addEventListener('focus', refreshMessaging);

  new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });
  refreshMessaging();
  enrollWebPush();
  window.setInterval(refreshMessaging, POLL_INTERVAL);
})();
