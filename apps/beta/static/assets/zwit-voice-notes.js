(() => {
  if (!location.pathname.startsWith('/membres')) return;

  const MAX_SECONDS = 300;
  let active = null;
  let scheduled = false;

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
    node.classList.add('visible');
    window.setTimeout(() => node.classList.remove('visible'), 3600);
  }

  function preferredMime() {
    if (!window.MediaRecorder) return '';
    return [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/webm',
      'audio/ogg;codecs=opus'
    ].find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
  }

  function extension(type) {
    if (type.includes('mp4')) return 'm4a';
    if (type.includes('ogg')) return 'ogg';
    return 'webm';
  }

  function secondsLabel(value) {
    const seconds = Math.max(0, Math.round(value));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function conversationId(form) {
    return form.querySelector('[name="conversationId"]')?.value || '';
  }

  function cleanup({ discard = false } = {}) {
    if (!active) return;
    window.clearInterval(active.timer);
    active.stream?.getTracks().forEach((track) => track.stop());
    if (discard && active.recorder?.state === 'recording') {
      active.discard = true;
      active.recorder.stop();
    }
    active.form?.classList.remove('zwit-voice-recording');
    active.form?.querySelector('[data-zwit-voice-status]')?.remove();
    const button = active.form?.querySelector('[data-zwit-voice-record]');
    if (button) {
      button.classList.remove('recording');
      button.setAttribute('aria-label', 'Enregistrer un message vocal');
      button.innerHTML = '<span aria-hidden="true">⌁</span>';
    }
    active = null;
  }

  function renderVoiceBubble(message) {
    const attachment = message?.attachments?.find((item) => item.kind === 'voice' || String(item.mime_type || '').startsWith('audio/'));
    if (!attachment?.previewUrl) return;
    const messages = document.querySelector('.velvet-direct-conversation .messages');
    if (!messages) return;
    const article = document.createElement('article');
    article.className = 'message mine zwit-voice-message';
    article.dataset.messageId = message.id || '';
    article.innerHTML = `<small>Vous</small><div class="zwit-voice-player"><span aria-hidden="true">⌁</span><audio controls preload="metadata" src="${attachment.previewUrl}"></audio><small>${secondsLabel(attachment.durationSeconds || 0)}</small></div>`;
    messages.appendChild(article);
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  }

  function upgradeHistory(page) {
    page.querySelectorAll('.message-document').forEach((link) => {
      if (link.dataset.zwitVoice === '1' || !/^\s*▤?\s*Vocal Zwit\b/i.test(link.textContent || '')) return;
      link.dataset.zwitVoice = '1';
      const match = (link.textContent || '').match(/·\s*(\d+)s\b/);
      const wrapper = document.createElement('div');
      wrapper.className = 'zwit-voice-player historical';
      wrapper.innerHTML = `<span aria-hidden="true">⌁</span><audio controls preload="metadata"></audio><small>${secondsLabel(Number(match?.[1] || 0))}</small>`;
      wrapper.querySelector('audio').src = link.href;
      link.replaceWith(wrapper);
    });
  }

  async function uploadVoice(form, blob, durationSeconds) {
    const id = conversationId(form);
    if (!id) throw new Error('invalid_conversation');
    const type = (blob.type || preferredMime() || 'audio/webm').split(';')[0];
    const file = new File([blob], `Vocal Zwit ${new Date().toISOString()}.${extension(type)}`, { type });
    const body = new FormData();
    body.set('conversationId', id);
    body.set('durationSeconds', String(Math.max(1, Math.min(MAX_SECONDS, Math.round(durationSeconds)))));
    body.set('voice', file);
    const response = await fetch('/api/members/voice-message', {
      method: 'POST',
      credentials: 'same-origin',
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'voice_message_failed');
    return payload.message;
  }

  async function start(form) {
    if (active || form.dataset.zwitRequestLocked === '1') {
      if (form.dataset.zwitRequestLocked === '1') toast('Cette conversation attend encore une réponse.', true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast('L’enregistrement vocal n’est pas disponible sur ce navigateur.', true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const mime = preferredMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      const startedAt = Date.now();
      active = { form, stream, recorder, chunks, startedAt, timer: null, discard: false };
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener('stop', async () => {
        const snapshot = active;
        if (!snapshot) return;
        const discard = snapshot.discard;
        const duration = Math.min(MAX_SECONDS, (Date.now() - snapshot.startedAt) / 1000);
        const blob = new Blob(snapshot.chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        cleanup();
        if (discard || !blob.size) return;
        try {
          const message = await uploadVoice(form, blob, duration);
          renderVoiceBubble(message);
          toast('Message vocal envoyé.');
          document.dispatchEvent(new CustomEvent('zwit:voice-sent', { detail: { conversationId: conversationId(form) } }));
        } catch (error) {
          toast(error.message === 'conversation_request_waiting'
            ? 'Une réponse est nécessaire avant un nouveau message.'
            : 'Le message vocal n’a pas pu être envoyé.', true);
        }
      }, { once: true });
      recorder.start(250);
      form.classList.add('zwit-voice-recording');
      const button = form.querySelector('[data-zwit-voice-record]');
      button?.classList.add('recording');
      if (button) {
        button.setAttribute('aria-label', 'Arrêter et envoyer le message vocal');
        button.innerHTML = '<span aria-hidden="true">■</span>';
      }
      const status = document.createElement('div');
      status.className = 'zwit-voice-status';
      status.dataset.zwitVoiceStatus = '1';
      status.innerHTML = '<i></i><strong>00:00</strong><span>Enregistrement</span><button type="button" data-zwit-voice-cancel>Annuler</button>';
      form.prepend(status);
      active.timer = window.setInterval(() => {
        if (!active) return;
        const elapsed = Math.min(MAX_SECONDS, (Date.now() - active.startedAt) / 1000);
        const target = form.querySelector('[data-zwit-voice-status] strong');
        if (target) target.textContent = secondsLabel(elapsed);
        if (elapsed >= MAX_SECONDS && recorder.state === 'recording') recorder.stop();
      }, 250);
    } catch {
      cleanup();
      toast('Autorise le microphone pour envoyer un message vocal.', true);
    }
  }

  function stop() {
    if (active?.recorder?.state === 'recording') active.recorder.stop();
  }

  function enhance(page) {
    const form = page.querySelector('#messageForm');
    if (!form) return;
    upgradeHistory(page);
    if (form.querySelector('[data-zwit-voice-record]')) return;
    const send = form.querySelector('button[type="submit"]');
    if (!send) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zwit-voice-button';
    button.dataset.zwitVoiceRecord = '1';
    button.setAttribute('aria-label', 'Enregistrer un message vocal');
    button.innerHTML = '<span aria-hidden="true">⌁</span>';
    send.before(button);
  }

  function sync() {
    scheduled = false;
    const page = document.querySelector('.velvet-direct-conversation');
    if (page) enhance(page);
    else if (active) cleanup({ discard: true });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  document.addEventListener('click', (event) => {
    const record = event.target.closest('[data-zwit-voice-record]');
    if (record) {
      const form = record.closest('#messageForm');
      if (!form) return;
      if (active?.form === form) stop();
      else start(form);
      return;
    }
    const cancel = event.target.closest('[data-zwit-voice-cancel]');
    if (cancel && active) cleanup({ discard: true });
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => { if (active) cleanup({ discard: true }); });
  schedule();
})();
