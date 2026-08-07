(() => {
  if (!location.pathname.startsWith('/membres')) return;

  let scheduled = false;
  let activeConversationId = '';
  let lastSignature = '';
  let loading = false;

  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  }

  function conversationPage() {
    return document.querySelector('.velvet-direct-conversation');
  }

  function conversationId(page) {
    return page?.querySelector('#messageForm [name="conversationId"]')?.value || '';
  }

  function formatFollowUp(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function setComposerEnabled(page, enabled, reason = '') {
    const form = page.querySelector('#messageForm');
    if (!form) return;
    form.dataset.zwitRequestLocked = enabled ? '0' : '1';
    const controls = form.querySelectorAll('textarea, input[type="file"], button[type="submit"], .attachment-picker');
    controls.forEach((control) => {
      if ('disabled' in control) control.disabled = !enabled;
      control.classList.toggle('zwit-request-disabled', !enabled);
      if (!enabled && reason) control.setAttribute('title', reason);
      else control.removeAttribute('title');
    });
    const textarea = form.querySelector('textarea[name="body"]');
    if (textarea) textarea.placeholder = enabled ? 'Écrire un message…' : reason;
  }

  function bannerMarkup(state) {
    const status = state?.status || 'accepted';
    const role = state?.role || 'legacy';
    const sent = Number(state?.introMessagesSent || 0);
    const canSend = state?.canSend !== false;

    if (status === 'accepted' || role === 'legacy') return '';

    if (status === 'declined' && role === 'recipient') {
      return `<aside class="zwit-request-banner declined" data-zwit-request-banner>
        <div class="zwit-request-seal" aria-hidden="true">◇</div>
        <div><span>CONVERSATION PROTÉGÉE</span><strong>Vous avez décliné cette demande</strong><p>La conversation reste silencieuse. Vous pouvez la rouvrir à tout moment.</p></div>
        <button type="button" data-zwit-request-decision="accept">Réouvrir</button>
      </aside>`;
    }

    if (status === 'declined') {
      return `<aside class="zwit-request-banner declined" data-zwit-request-banner>
        <div class="zwit-request-seal" aria-hidden="true">◇</div>
        <div><span>RESPECT DU CHOIX</span><strong>La demande a été déclinée</strong><p>Zwit bloque les nouvelles relances pour préserver une expérience sereine.</p></div>
      </aside>`;
    }

    if (role === 'recipient') {
      return `<aside class="zwit-request-banner incoming" data-zwit-request-banner>
        <div class="zwit-request-seal" aria-hidden="true">✦</div>
        <div><span>NOUVELLE RENCONTRE</span><strong>Souhaitez-vous ouvrir cette conversation ?</strong><p>Vous gardez le contrôle. Répondre au message l’acceptera également automatiquement.</p></div>
        <div class="zwit-request-actions"><button type="button" data-zwit-request-decision="accept">Accepter</button><button type="button" class="secondary" data-zwit-request-decision="decline">Décliner</button></div>
      </aside>`;
    }

    if (sent === 0) {
      return `<aside class="zwit-request-banner outgoing" data-zwit-request-banner>
        <div class="zwit-request-seal" aria-hidden="true">✦</div>
        <div><span>PREMIER CONTACT</span><strong>Un message qui donne envie de répondre</strong><p>Après ce premier message, Zwit limite les relances tant que l’autre membre n’a pas répondu.</p></div>
      </aside>`;
    }

    if (sent === 1 && canSend) {
      return `<aside class="zwit-request-banner outgoing" data-zwit-request-banner>
        <div class="zwit-request-seal" aria-hidden="true">◷</div>
        <div><span>RELANCE UNIQUE</span><strong>Une dernière relance est disponible</strong><p>Après celle-ci, la conversation restera en attente d’une réponse.</p></div>
      </aside>`;
    }

    const followUp = sent === 1 && state.followUpAt ? formatFollowUp(state.followUpAt) : '';
    return `<aside class="zwit-request-banner waiting" data-zwit-request-banner>
      <div class="zwit-request-seal" aria-hidden="true">◷</div>
      <div><span>EN ATTENTE</span><strong>Laissez le temps de répondre</strong><p>${followUp ? `Une unique relance sera possible ${e(followUp)}.` : 'Les relances sont maintenant suspendues jusqu’à une réponse.'}</p></div>
    </aside>`;
  }

  function render(page, state) {
    const existing = page.querySelector('[data-zwit-request-banner]');
    const markup = bannerMarkup(state);
    if (!markup) existing?.remove();
    else if (existing) existing.outerHTML = markup;
    else {
      const anchor = page.querySelector('.velvet-chat-topbar, :scope > .page-head, :scope > .conversation-peer-header');
      if (anchor) anchor.insertAdjacentHTML('afterend', markup);
      else page.insertAdjacentHTML('afterbegin', markup);
    }

    const locked = state?.status === 'declined'
      || (state?.status === 'pending' && state?.role === 'requester' && state?.canSend === false);
    const reason = state?.status === 'declined'
      ? 'Cette demande de conversation a été déclinée.'
      : 'En attente d’une réponse.';
    setComposerEnabled(page, !locked, reason);
  }

  async function load(page, id, { force = false } = {}) {
    if (!id || loading) return;
    const signature = `${id}:${page.querySelectorAll('.message').length}`;
    if (!force && signature === lastSignature) return;
    loading = true;
    activeConversationId = id;
    try {
      const payload = await api(`/api/members/conversation-request?conversationId=${encodeURIComponent(id)}`);
      if (!page.isConnected || activeConversationId !== id) return;
      render(page, payload.request || { status: 'accepted', role: 'legacy', canSend: true });
      lastSignature = signature;
    } catch {
      // Si la migration n'est pas encore déployée, la messagerie historique reste fonctionnelle.
      setComposerEnabled(page, true);
    } finally {
      loading = false;
    }
  }

  async function decide(button, decision) {
    const page = conversationPage();
    const id = conversationId(page);
    if (!page || !id) return;
    button.disabled = true;
    try {
      const payload = await api('/api/members/conversation-request', {
        method: 'PATCH',
        body: JSON.stringify({ conversationId: id, decision })
      });
      render(page, payload.request);
      lastSignature = '';
    } catch {
      button.disabled = false;
    }
  }

  function sync() {
    scheduled = false;
    const page = conversationPage();
    if (!page) {
      activeConversationId = '';
      lastSignature = '';
      return;
    }
    const id = conversationId(page);
    if (id) load(page, id);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-zwit-request-decision]');
    if (!button) return;
    event.preventDefault();
    decide(button, button.dataset.zwitRequestDecision);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('#messageForm');
    if (!form || form.dataset.zwitRequestLocked !== '1') return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  schedule();
})();
