(() => {
  'use strict';

  const state = {
    conversationId: '',
    signature: '',
    busy: false
  };
  const list = (value) => Array.isArray(value) ? value : [];
  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  async function api(path) {
    const response = await fetch(path, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  }

  function attachmentMarkup(attachment) {
    const url = attachment?.previewUrl;
    if (!url) return '';
    if (attachment.media_type === 'image') {
      return `<button type="button" class="message-image-button" data-message-image="${e(url)}"><img src="${e(url)}" alt="Pièce jointe"></button>`;
    }
    if (attachment.media_type === 'video') {
      return `<video controls playsinline preload="metadata" src="${e(url)}"></video>`;
    }
    return `<a class="message-document" href="${e(url)}" target="_blank" rel="noopener">${e(attachment.original_name || 'Ouvrir la pièce jointe')}</a>`;
  }

  function messageMarkup(message, currentUserId) {
    const mine = String(message.sender_user_id || '') === String(currentUserId || '');
    return `<article class="message ${mine ? 'mine' : ''}" data-message-id="${e(message.id)}">
      <small>${e(message.sender_identity || (mine ? 'Vous' : 'Membre Zwit'))}</small>
      ${message.body ? `<p>${e(message.body)}</p>` : ''}
      ${list(message.attachments).length ? `<div class="message-attachments">${list(message.attachments).map(attachmentMarkup).join('')}</div>` : ''}
    </article>`;
  }

  async function reconcileConversation() {
    const page = document.querySelector('.velvet-direct-conversation');
    const container = page?.querySelector('.messages');
    const conversationId = page?.querySelector('#messageForm [name="conversationId"]')?.value || '';
    if (!page || !container || !conversationId || document.hidden || state.busy) return;
    state.busy = true;
    try {
      const payload = await api(`/api/members/messages?conversationId=${encodeURIComponent(conversationId)}`);
      if (!page.isConnected) return;
      const messages = list(payload.messages);
      const signature = messages.map((message) => `${message.id}:${message.edited_at || ''}:${list(message.attachments).length}`).join('|');
      if (conversationId !== state.conversationId) {
        state.conversationId = conversationId;
        state.signature = '';
      }
      if (signature !== state.signature) {
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        state.signature = signature;
        container.innerHTML = messages.length
          ? messages.map((message) => messageMarkup(message, payload.currentUserId)).join('')
          : '<p>Aucun message dans cette conversation.</p>';
        if (nearBottom || !container.dataset.realtimeHydrated) {
          requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight, behavior: 'auto' }));
        }
        container.dataset.realtimeHydrated = '1';
      }
    } catch {
      // La dernière conversation rendue reste disponible hors ligne.
    } finally {
      state.busy = false;
    }
  }

  async function reconcileNotifications() {
    const page = [...document.querySelectorAll('.page')].find((node) => node.querySelector('.notification-feed'));
    if (!page || document.hidden) return;
    try {
      const feed = await api('/api/members/notifications');
      const active = new Set(list(feed.notifications).map((row) => String(row.id)));
      page.querySelectorAll('[data-open-notification]').forEach((node) => {
        if (active.has(String(node.dataset.openNotification))) return;
        node.style.transition = 'opacity .18s ease, transform .18s ease, max-height .22s ease, margin .22s ease, padding .22s ease';
        node.style.opacity = '0';
        node.style.transform = 'translateX(14px)';
        node.style.maxHeight = `${node.offsetHeight}px`;
        requestAnimationFrame(() => {
          node.style.maxHeight = '0';
          node.style.margin = '0';
          node.style.paddingTop = '0';
          node.style.paddingBottom = '0';
        });
        setTimeout(() => node.remove(), 240);
      });
      const counter = page.querySelector('[data-read-all-notifications]');
      if (counter && !feed.unreadCount) counter.remove();
    } catch {
      // Le flux actif sera réconcilié au prochain cycle.
    }
  }

  document.addEventListener('click', (event) => {
    const image = event.target.closest('[data-message-image]');
    if (!image) return;
    const url = image.dataset.messageImage;
    if (url) window.open(url, '_blank', 'noopener');
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      reconcileConversation();
      reconcileNotifications();
    }
  });

  reconcileConversation();
  reconcileNotifications();
  window.setInterval(reconcileConversation, 2400);
  window.setInterval(reconcileNotifications, 5000);
})();
