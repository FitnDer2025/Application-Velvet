(() => {
  if (!location.pathname.startsWith('/membres')) return;

  let scheduled = false;
  let selectedFile = null;
  let selectedForm = null;

  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
    node.classList.add('visible');
    window.setTimeout(() => node.classList.remove('visible'), 3600);
  }

  function conversationId(form) {
    return form?.querySelector('[name="conversationId"]')?.value || '';
  }

  function closeComposer() {
    document.querySelector('[data-zwit-ephemeral-compose]')?.remove();
    selectedFile = null;
    selectedForm = null;
  }

  function openComposer(form, file) {
    closeComposer();
    selectedFile = file;
    selectedForm = form;
    const layer = document.createElement('div');
    layer.className = 'zwit-ephemeral-compose';
    layer.dataset.zwitEphemeralCompose = '1';
    const kind = file.type.startsWith('video/') ? 'Vidéo' : 'Photo';
    layer.innerHTML = `<div class="zwit-ephemeral-panel">
      <button type="button" class="zwit-ephemeral-close" data-zwit-ephemeral-close aria-label="Fermer">×</button>
      <span>MÉDIA ÉPHÉMÈRE</span><h2>${kind} privée</h2>
      <p>Le fichier n’apparaît jamais avec une URL permanente dans la conversation.</p>
      <div class="zwit-ephemeral-file"><strong>${e(file.name || kind)}</strong><small>${(file.size / 1024 / 1024).toFixed(1)} Mo</small></div>
      <div class="zwit-ephemeral-modes" role="radiogroup" aria-label="Durée du média">
        <label><input type="radio" name="zwitEphemeralMode" value="view_once" checked><span><b>1×</b><strong>Voir une fois</strong><small>Expire aussi après 24 h</small></span></label>
        <label><input type="radio" name="zwitEphemeralMode" value="10"><span><b>10</b><strong>10 minutes</strong><small>Ouvert plusieurs fois</small></span></label>
        <label><input type="radio" name="zwitEphemeralMode" value="60"><span><b>60</b><strong>1 heure</strong><small>Ouvert plusieurs fois</small></span></label>
      </div>
      <button type="button" class="primary zwit-ephemeral-send" data-zwit-ephemeral-send>Envoyer discrètement</button>
      <small class="zwit-ephemeral-note">L’éphémère limite l’accès technique, mais ne remplace jamais le consentement ni la confiance.</small>
    </div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('visible'));
  }

  async function sendEphemeral(button) {
    if (!selectedFile || !selectedForm) return;
    const id = conversationId(selectedForm);
    if (!id || selectedForm.dataset.zwitRequestLocked === '1') {
      toast('Cette conversation attend encore une réponse.', true);
      closeComposer();
      return;
    }
    button.disabled = true;
    const choice = document.querySelector('input[name="zwitEphemeralMode"]:checked')?.value || 'view_once';
    const body = new FormData();
    body.set('conversationId', id);
    body.set('media', selectedFile);
    if (choice === 'view_once') body.set('mode', 'view_once');
    else {
      body.set('mode', 'expires');
      body.set('expiresMinutes', choice);
    }
    try {
      const response = await fetch('/api/members/ephemeral-message', {
        method: 'POST', credentials: 'same-origin', body
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'ephemeral_message_failed');
      closeComposer();
      toast(choice === 'view_once' ? 'Média envoyé en voir-une-fois.' : 'Média éphémère envoyé.');
      document.dispatchEvent(new CustomEvent('zwit:ephemeral-sent', { detail: { conversationId: id } }));
      // Le moteur temps réel remontera le message ; on force aussi un petit cycle de patch UI.
      window.setTimeout(schedule, 150);
    } catch (error) {
      button.disabled = false;
      toast(error.message === 'conversation_request_waiting'
        ? 'Une réponse est nécessaire avant un nouveau message.'
        : 'Le média éphémère n’a pas pu être envoyé.', true);
    }
  }

  function ephemeralKind(message) {
    const text = message.textContent || '';
    if (!text.includes('éphémère')) return null;
    if (text.includes('Photo éphémère')) return 'photo';
    if (text.includes('Vidéo éphémère')) return 'video';
    return null;
  }

  function patchMessages(page) {
    page.querySelectorAll('.message[data-message-id], [data-message-id].message').forEach((message) => {
      if (message.dataset.zwitEphemeralPatched === '1') return;
      const kind = ephemeralKind(message);
      if (!kind) return;
      const id = message.dataset.messageId;
      if (!id) return;
      message.dataset.zwitEphemeralPatched = '1';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'zwit-ephemeral-open';
      button.dataset.zwitEphemeralOpen = id;
      button.innerHTML = `<span aria-hidden="true">${kind === 'photo' ? '◫' : '▶'}</span><strong>Ouvrir ${kind === 'photo' ? 'la photo' : 'la vidéo'}</strong><small>Accès éphémère</small>`;
      message.appendChild(button);
    });
  }

  async function openMedia(button) {
    const messageId = button.dataset.zwitEphemeralOpen;
    if (!messageId) return;
    button.disabled = true;
    try {
      const response = await fetch('/api/members/ephemeral-message', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'ephemeral_open_failed');
      showMedia(payload.media);
      if (payload.media?.mode === 'view_once' && !payload.media?.sender) {
        button.innerHTML = '<span aria-hidden="true">✓</span><strong>Ouvert</strong><small>Voir-une-fois consommé</small>';
        button.disabled = true;
      } else {
        button.disabled = false;
      }
    } catch (error) {
      button.disabled = true;
      button.innerHTML = `<span aria-hidden="true">×</span><strong>${error.message === 'ephemeral_message_consumed' ? 'Déjà ouvert' : error.message === 'ephemeral_message_expired' ? 'Expiré' : 'Indisponible'}</strong><small>Ce média n’est plus accessible</small>`;
    }
  }

  function showMedia(media) {
    document.querySelector('[data-zwit-ephemeral-viewer]')?.remove();
    const layer = document.createElement('div');
    layer.className = 'zwit-ephemeral-viewer';
    layer.dataset.zwitEphemeralViewer = '1';
    const isVideo = String(media?.mimeType || '').startsWith('video/');
    layer.innerHTML = `<div class="zwit-ephemeral-viewer-top"><span>ACCÈS PRIVÉ · ${media?.mode === 'view_once' ? 'VOIR UNE FOIS' : 'ÉPHÉMÈRE'}</span><button type="button" data-zwit-ephemeral-viewer-close>Fermer</button></div><div class="zwit-ephemeral-media">${isVideo
      ? `<video src="${e(media.previewUrl)}" controls autoplay playsinline></video>`
      : `<img src="${e(media.previewUrl)}" alt="Média éphémère" decoding="async">`}</div><p>Cette URL privée expire automatiquement dans environ une minute.</p>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('visible'));
    window.setTimeout(() => layer.remove(), 65_000);
  }

  function enhance(page) {
    patchMessages(page);
    const form = page.querySelector('#messageForm');
    if (!form || form.querySelector('[data-zwit-ephemeral-pick]')) return;
    const send = form.querySelector('button[type="submit"]');
    if (!send) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';
    input.hidden = true;
    input.dataset.zwitEphemeralInput = '1';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zwit-ephemeral-pick';
    button.dataset.zwitEphemeralPick = '1';
    button.setAttribute('aria-label', 'Envoyer un média éphémère');
    button.innerHTML = '<b>1×</b>';
    button.addEventListener('click', () => {
      if (form.dataset.zwitRequestLocked === '1') return toast('Cette conversation attend encore une réponse.', true);
      input.click();
    });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      openComposer(form, file);
    });
    form.appendChild(input);
    send.before(button);
  }

  function sync() {
    scheduled = false;
    const page = document.querySelector('.velvet-direct-conversation');
    if (page) enhance(page);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-zwit-ephemeral-close]') || event.target.matches('[data-zwit-ephemeral-compose]')) return closeComposer();
    const send = event.target.closest('[data-zwit-ephemeral-send]');
    if (send) return sendEphemeral(send);
    const open = event.target.closest('[data-zwit-ephemeral-open]');
    if (open) return openMedia(open);
    if (event.target.closest('[data-zwit-ephemeral-viewer-close]') || event.target.matches('[data-zwit-ephemeral-viewer]')) {
      event.target.closest('[data-zwit-ephemeral-viewer]')?.remove();
    }
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
