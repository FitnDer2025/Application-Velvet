(() => {
  const POLL_INTERVAL = 15000;
  let lastUnreadCount = 0;
  let latestDirectory = null;
  let pollTimer = null;

  async function getJson(path) {
    const response = await fetch(path, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`request_${response.status}`);
    return response.json();
  }

  function messageBadge(count) {
    if (!count) return '';
    return `<span class="velvet-message-badge" aria-label="${count} message${count > 1 ? 's' : ''} non lu${count > 1 ? 's' : ''}">${count > 99 ? '99+' : count}</span>`;
  }

  function updateNavigationBadges(count) {
    document.querySelectorAll('[data-route="conversations"]').forEach((button) => {
      button.querySelector('.velvet-message-badge')?.remove();
      if (count > 0) button.insertAdjacentHTML('beforeend', messageBadge(count));
    });
  }

  function profileInitials(value) {
    return String(value || 'V')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'V';
  }

  function enhanceConversationCards() {
    if (!latestDirectory?.conversations) return;
    document.querySelectorAll('[data-open-conversation]').forEach((card) => {
      const conversation = latestDirectory.conversations.find(
        (row) => row.id === card.dataset.openConversation
      );
      if (!conversation) return;
      const name = conversation.participant_display_name
        || conversation.subject
        || (conversation.kind === 'event' ? 'Salon Velvet' : 'Membre Velvet');
      const unread = Number(conversation.unread_count || 0);
      card.classList.toggle('has-unread', unread > 0);
      card.querySelector('h2')?.replaceChildren(document.createTextNode(name));
      const oldParticipant = card.querySelector('.velvet-conversation-participant');
      if (oldParticipant) oldParticipant.remove();
      const photo = conversation.participant_photo_url;
      const participant = document.createElement('span');
      participant.className = 'velvet-conversation-participant';
      participant.innerHTML = photo
        ? `<img src="${String(photo).replace(/"/g, '&quot;')}" alt="Profil de ${name.replace(/"/g, '&quot;')}">`
        : `<span aria-hidden="true">${profileInitials(name)}</span>`;
      card.prepend(participant);
      let preview = card.querySelector('.velvet-conversation-preview');
      if (!preview) {
        preview = document.createElement('p');
        preview.className = 'velvet-conversation-preview';
        card.querySelector('h2')?.insertAdjacentElement('afterend', preview);
      }
      preview.textContent = conversation.last_message_body || 'Nouvelle conversation';
      card.querySelector('.velvet-card-unread')?.remove();
      if (unread > 0) {
        card.insertAdjacentHTML('beforeend', `<span class="velvet-card-unread">${unread > 99 ? '99+' : unread}</span>`);
      }
    });
  }

  function enhanceComposer() {
    const input = document.querySelector('#messageForm input[name="body"]');
    if (input && !document.querySelector('#messageForm textarea[name="body"]')) {
      const textarea = document.createElement('textarea');
      textarea.name = 'body';
      textarea.maxLength = Number(input.maxLength || 10000);
      textarea.placeholder = input.placeholder || 'Écrire un message…';
      textarea.rows = 2;
      textarea.className = 'velvet-message-textarea';
      textarea.value = input.value;
      input.replaceWith(textarea);
    }
    const button = document.querySelector('#messageForm button[type="submit"]');
    if (button) {
      button.classList.add('velvet-explicit-send');
      button.textContent = 'Envoyer';
      button.setAttribute('aria-label', 'Envoyer le message');
    }
  }

  function enhanceMessages() {
    const currentUserId = latestDirectory?.currentUserId;
    document.querySelectorAll('.messages .message').forEach((message) => {
      message.setAttribute('role', 'listitem');
      if (message.classList.contains('mine')) {
        message.setAttribute('aria-label', 'Message envoyé');
      } else {
        message.setAttribute('aria-label', 'Message reçu');
      }
    });
    if (currentUserId) document.querySelector('.messages')?.setAttribute('role', 'list');
  }

  async function showIncomingNotification(directory, newCount) {
    if (newCount <= lastUnreadCount || document.visibilityState === 'visible') return;
    const conversation = directory.conversations
      ?.filter((row) => Number(row.unread_count || 0) > 0)
      .sort((left, right) => new Date(right.last_message_at || 0) - new Date(left.last_message_at || 0))[0];
    if (!conversation || !('Notification' in window) || Notification.permission !== 'granted') return;
    const title = `${conversation.participant_display_name || 'Un membre Velvet'} vous a écrit`;
    const options = {
      body: conversation.last_message_body || 'Nouveau message Velvet',
      icon: '/assets/velvet-icon-192.png',
      badge: '/assets/velvet-icon-192.png',
      tag: `velvet-message-${conversation.id}`,
      data: { route: 'conversations', conversationId: conversation.id }
    };
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) await registration.showNotification(title, options);
      else new Notification(title, options);
    } catch {}
  }

  async function refreshMessaging() {
    try {
      const directory = await getJson('/api/members/directory');
      const count = Number(directory.messageUnreadCount ?? directory.message_unread_count ?? 0);
      await showIncomingNotification(directory, count);
      latestDirectory = directory;
      updateNavigationBadges(count);
      enhanceConversationCards();
      lastUnreadCount = count;
    } catch {}
  }

  function bindMobileMenu() {
    const button = document.querySelector('#mobileMenuButton');
    const sidebar = document.querySelector('.sidebar');
    if (!button || !sidebar || button.dataset.velvetMenuFixed === 'true') return;
    button.dataset.velvetMenuFixed = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const open = !document.body.classList.contains('velvet-mobile-menu-open');
      document.body.classList.toggle('velvet-mobile-menu-open', open);
      button.setAttribute('aria-expanded', String(open));
    }, true);
    sidebar.addEventListener('click', (event) => {
      if (!event.target.closest('[data-route]')) return;
      document.body.classList.remove('velvet-mobile-menu-open');
      button.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.body.classList.remove('velvet-mobile-menu-open');
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function enhance() {
    bindMobileMenu();
    enhanceComposer();
    enhanceMessages();
    enhanceConversationCards();
  }

  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshMessaging();
  });
  window.addEventListener('focus', refreshMessaging);

  bindMobileMenu();
  enhance();
  refreshMessaging();
  pollTimer = window.setInterval(refreshMessaging, POLL_INTERVAL);
  window.addEventListener('beforeunload', () => window.clearInterval(pollTimer), { once: true });
})();
