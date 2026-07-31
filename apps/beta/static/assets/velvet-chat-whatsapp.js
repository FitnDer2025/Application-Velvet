(() => {
  'use strict';

  const state = {
    scheduled: false,
    activePage: null,
    conversationId: null
  };

  const list = (value) => Array.isArray(value) ? value : [];

  async function api(path) {
    const response = await fetch(path, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  }

  function formatTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function dayKey(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function dayLabel(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(date) === dayKey(today)) return "Aujourd’hui";
    if (dayKey(date) === dayKey(yesterday)) return 'Hier';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(date);
  }

  function updateViewportHeight() {
    if (!document.body.classList.contains('velvet-whatsapp-chat')) return;
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--velvet-chat-height', `${Math.round(height)}px`);
  }

  function enterChatMode(page) {
    document.body.classList.add('velvet-whatsapp-chat');
    state.activePage = page;
    updateViewportHeight();
  }

  function leaveChatMode() {
    document.body.classList.remove('velvet-whatsapp-chat');
    document.documentElement.style.removeProperty('--velvet-chat-height');
    state.activePage = null;
    state.conversationId = null;
  }

  function dispatchProfileOpen(profileId) {
    if (!profileId) return;
    leaveChatMode();
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.hidden = true;
    trigger.dataset.openProfile = profileId;
    document.body.appendChild(trigger);
    trigger.click();
    trigger.remove();
  }

  function attachmentIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 12.8 14.9 6.5a3.6 3.6 0 0 1 5.1 5.1l-8.2 8.2a5.4 5.4 0 0 1-7.6-7.6l8-8"/><path d="m7.1 14.3 8.2-8.2"/></svg>';
  }

  function sendIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8Z"/><path d="M7 12h14"/></svg><span class="send-label">Envoyer</span>';
  }

  function resizeComposer(textarea) {
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 42), 124)}px`;
  }

  function enhanceComposer(page) {
    const form = page.querySelector('#messageForm');
    if (!form || form.dataset.whatsappComposer === '1') return;
    form.dataset.whatsappComposer = '1';

    const textarea = form.querySelector('textarea[name="body"]');
    if (textarea) {
      textarea.rows = 1;
      textarea.setAttribute('enterkeyhint', 'enter');
      textarea.setAttribute('autocomplete', 'off');
      textarea.addEventListener('input', () => resizeComposer(textarea));
      textarea.addEventListener('focus', () => {
        updateViewportHeight();
        window.setTimeout(() => {
          resizeComposer(textarea);
          page.querySelector('.messages')?.scrollTo({
            top: page.querySelector('.messages').scrollHeight,
            behavior: 'smooth'
          });
        }, 180);
      });
      resizeComposer(textarea);
    }

    const attachment = form.querySelector('.attachment-picker');
    if (attachment) {
      attachment.setAttribute('aria-label', 'Ajouter une photo, une vidéo ou un PDF');
      const slot = attachment.querySelector('span');
      if (slot) slot.innerHTML = attachmentIcon();
    }

    const send = form.querySelector('button[type="submit"]');
    if (send) {
      send.innerHTML = sendIcon();
      send.setAttribute('aria-label', 'Envoyer le message');
    }
  }

  function createTopbar(page) {
    const pageHead = page.querySelector(':scope > .page-head');
    const peer = page.querySelector(':scope > .conversation-peer-header');
    if (!pageHead || !peer) return null;

    const existingBack = pageHead.querySelector('[data-direct-conversation-back]');
    const back = existingBack || document.createElement('button');
    back.type = 'button';
    back.className = 'velvet-chat-back';
    back.setAttribute('aria-label', 'Revenir aux conversations');
    back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';

    const peerButton = document.createElement('button');
    peerButton.type = 'button';
    peerButton.className = 'velvet-chat-peer';
    peerButton.innerHTML = peer.innerHTML;
    peerButton.setAttribute('aria-label', 'Ouvrir le profil de ce membre');

    const topbar = document.createElement('header');
    topbar.className = 'velvet-chat-topbar';
    topbar.append(back, peerButton);

    pageHead.replaceWith(topbar);
    peer.remove();
    return { topbar, peerButton };
  }

  function enhanceMessageTimeline(page, payload, conversation) {
    const container = page.querySelector('.messages');
    const nodes = [...container?.querySelectorAll(':scope > .message') || []];
    const messages = list(payload.messages);
    if (!container || !nodes.length || nodes.length !== messages.length) return;

    container.querySelectorAll('.velvet-chat-day').forEach((node) => node.remove());
    let previousDay = '';
    let previousSender = '';
    let previousDate = 0;

    nodes.forEach((node, index) => {
      const message = messages[index];
      const currentDay = dayKey(message.created_at);
      if (currentDay && currentDay !== previousDay) {
        const separator = document.createElement('div');
        separator.className = 'velvet-chat-day';
        separator.textContent = dayLabel(message.created_at);
        container.insertBefore(separator, node);
      }

      const createdAt = new Date(message.created_at || 0).getTime();
      const grouped = previousSender === message.sender_user_id
        && createdAt - previousDate >= 0
        && createdAt - previousDate < 5 * 60 * 1000;
      node.classList.toggle('grouped', grouped);
      node.classList.toggle('group-start', !grouped);

      const sender = node.querySelector(':scope > small');
      if (sender) sender.classList.add('velvet-chat-sender');
      node.querySelector('.velvet-chat-time')?.remove();
      const time = document.createElement('time');
      time.className = 'velvet-chat-time';
      time.dateTime = message.created_at || '';
      time.textContent = formatTime(message.created_at);
      node.appendChild(time);

      previousDay = currentDay;
      previousSender = message.sender_user_id;
      previousDate = createdAt;
    });

    page.classList.toggle('velvet-private-chat', conversation?.kind !== 'event');
    page.classList.toggle('velvet-salon-chat', conversation?.kind === 'event');
    requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight }));
  }

  async function hydrateConversation(page, conversationId, peerButton) {
    try {
      const [payload, directory] = await Promise.all([
        api(`/api/members/messages?conversationId=${encodeURIComponent(conversationId)}`),
        api('/api/members/directory')
      ]);
      if (!page.isConnected || state.conversationId !== conversationId) return;
      const conversation = list(directory.conversations)
        .find((row) => String(row.id) === String(conversationId));
      const profileId = conversation?.participant_profile_id;
      if (peerButton && profileId) {
        peerButton.dataset.chatProfile = profileId;
        peerButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          dispatchProfileOpen(profileId);
        }, { once: false });
      }
      enhanceMessageTimeline(page, payload, conversation);
    } catch {
      // L’ergonomie reste disponible même si l’enrichissement temporel échoue.
    }
  }

  function enhancePage(page) {
    if (page.dataset.whatsappEnhanced === '1') {
      enterChatMode(page);
      return;
    }
    page.dataset.whatsappEnhanced = '1';
    page.classList.add('velvet-whatsapp-layout');
    enterChatMode(page);

    const form = page.querySelector('#messageForm');
    const conversationId = form?.querySelector('[name="conversationId"]')?.value || '';
    state.conversationId = conversationId;

    const topbar = createTopbar(page);
    const panel = page.querySelector(':scope > .card');
    panel?.classList.add('velvet-chat-panel');
    enhanceComposer(page);
    if (conversationId) hydrateConversation(page, conversationId, topbar?.peerButton);
  }

  function sync() {
    state.scheduled = false;
    const page = document.querySelector('.velvet-direct-conversation');
    if (page) enhancePage(page);
    else if (state.activePage) leaveChatMode();
  }

  function schedule() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(sync);
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.visualViewport?.addEventListener('resize', updateViewportHeight);
  window.visualViewport?.addEventListener('scroll', updateViewportHeight);
  window.addEventListener('orientationchange', () => window.setTimeout(updateViewportHeight, 120));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule();
  });

  schedule();
})();
