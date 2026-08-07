(() => {
  if (!location.pathname.startsWith('/membres')) return;

  let scheduled = false;
  let pageConversationId = '';
  let pollTimer = null;
  let call = null;
  let pc = null;
  let localStream = null;
  let remoteStream = null;
  let lastSignalId = 0;
  let iceServers = null;
  let applyingSignal = false;

  async function api(options = {}) {
    const url = options.url || '/api/members/video-call';
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'video_call_failed');
    return payload;
  }

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
    node.classList.add('visible');
    window.setTimeout(() => node.classList.remove('visible'), 3500);
  }

  function conversationPage() {
    return document.querySelector('.velvet-direct-conversation');
  }

  function conversationId(page = conversationPage()) {
    return page?.querySelector('#messageForm [name="conversationId"]')?.value || '';
  }

  function peerName(page = conversationPage()) {
    return page?.querySelector('.conversation-peer-header strong,.velvet-chat-topbar strong,.chat-peer strong')?.textContent?.trim() || 'ce membre';
  }

  function clearPoll() {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = null;
  }

  function stopTracks() {
    localStream?.getTracks().forEach((track) => track.stop());
    remoteStream?.getTracks().forEach((track) => track.stop());
    localStream = null;
    remoteStream = null;
  }

  function destroyPeer() {
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    pc = null;
    stopTracks();
    iceServers = null;
    lastSignalId = 0;
  }

  function closeLayer({ keepCall = false } = {}) {
    clearPoll();
    document.querySelector('[data-zwit-video-layer]')?.remove();
    destroyPeer();
    if (!keepCall) call = null;
  }

  function renderLayer(mode = 'ringing') {
    let layer = document.querySelector('[data-zwit-video-layer]');
    if (!layer) {
      layer = document.createElement('section');
      layer.className = 'zwit-video-layer';
      layer.dataset.zwitVideoLayer = '1';
      document.body.appendChild(layer);
    }
    const name = peerName();
    const incoming = Boolean(call?.incoming);
    layer.dataset.mode = mode;
    layer.innerHTML = `<div class="zwit-video-stage">
      <video data-zwit-video-remote autoplay playsinline></video>
      <video data-zwit-video-local autoplay muted playsinline></video>
      <div class="zwit-video-gradient"></div>
      <header><span>APPEL PRIVÉ ZWIT</span><strong>${name}</strong><small data-zwit-video-status>${mode === 'active' ? 'Connexion sécurisée…' : incoming ? 'Appel vidéo entrant' : 'Appel en cours…'}</small></header>
      <div class="zwit-video-placeholder"><i>◇</i><strong>${name}</strong><small>${mode === 'active' ? 'Connexion de la vidéo…' : incoming ? 'souhaite vous appeler' : 'Sonnerie…'}</small></div>
      <footer>${incoming && mode === 'ringing'
        ? '<button type="button" class="decline" data-zwit-call-action="decline">Refuser</button><button type="button" class="accept" data-zwit-call-action="accept">Accepter</button>'
        : '<button type="button" data-zwit-video-mute aria-label="Couper le micro">Micro</button><button type="button" class="decline" data-zwit-call-action="end">Raccrocher</button><button type="button" data-zwit-video-camera aria-label="Couper la caméra">Caméra</button>'}
      </footer>
      <p>Audio et vidéo transitent directement ou via le relais TURN sécurisé. Zwit ne les enregistre pas.</p>
    </div>`;
    requestAnimationFrame(() => layer.classList.add('visible'));
    attachStreams();
    return layer;
  }

  function attachStreams() {
    const layer = document.querySelector('[data-zwit-video-layer]');
    const local = layer?.querySelector('[data-zwit-video-local]');
    const remote = layer?.querySelector('[data-zwit-video-remote]');
    if (local && localStream && local.srcObject !== localStream) local.srcObject = localStream;
    if (remote && remoteStream && remote.srcObject !== remoteStream) remote.srcObject = remoteStream;
  }

  async function sendSignal(kind, payload) {
    if (!call?.id || !pageConversationId) return;
    await api({
      method: 'POST',
      body: JSON.stringify({ action: 'signal', conversationId: pageConversationId, callId: call.id, kind, payload })
    });
  }

  async function ensureMediaAndPeer() {
    if (pc) return pc;
    if (!Array.isArray(iceServers) || !iceServers.length) throw new Error('video_relay_not_configured');
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
    });
    remoteStream = new MediaStream();
    pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all', bundlePolicy: 'max-bundle' });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    pc.ontrack = (event) => {
      event.streams?.[0]?.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((current) => current.id === track.id)) remoteStream.addTrack(track);
      });
      attachStreams();
      document.querySelector('.zwit-video-placeholder')?.classList.add('hidden');
    };
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendSignal('ice', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      const state = pc?.connectionState;
      const status = document.querySelector('[data-zwit-video-status]');
      if (status) status.textContent = state === 'connected' ? 'Connecté' : state === 'connecting' ? 'Connexion…' : state === 'failed' ? 'Connexion interrompue' : 'Appel privé';
      if (state === 'failed' || state === 'closed') endCall(false);
    };
    attachStreams();
    return pc;
  }

  async function processSignals(signals = []) {
    if (applyingSignal || !call) return;
    applyingSignal = true;
    try {
      for (const signal of signals) {
        lastSignalId = Math.max(lastSignalId, Number(signal.id || 0));
        if (signal.kind === 'offer') {
          await ensureMediaAndPeer();
          if (pc.signalingState === 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal('answer', { type: answer.type, sdp: answer.sdp });
          }
        } else if (signal.kind === 'answer') {
          if (!pc) continue;
          if (pc.signalingState === 'have-local-offer') await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
        } else if (signal.kind === 'ice') {
          if (!pc) continue;
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.payload)); } catch {}
        }
      }
    } finally {
      applyingSignal = false;
    }
  }

  async function poll() {
    clearPoll();
    if (!pageConversationId) return;
    try {
      const state = await api({
        url: `/api/members/video-call?conversationId=${encodeURIComponent(pageConversationId)}&afterSignalId=${lastSignalId}`
      });
      if (state.call) {
        const previous = call;
        call = state.call;
        if (!previous && state.call.incoming) renderLayer(state.call.status === 'active' ? 'active' : 'ringing');
        if (state.call.status === 'active') {
          renderLayer('active');
          await processSignals(state.signals || []);
        } else if (state.call.incoming) {
          await processSignals(state.signals || []);
        }
      } else if (call) {
        closeLayer();
      }
    } catch (error) {
      if (error.message === 'conversation_acceptance_required') {
        document.querySelector('[data-zwit-video-call]')?.setAttribute('disabled', '');
      }
    } finally {
      if (pageConversationId) pollTimer = window.setTimeout(poll, call ? 900 : 2500);
    }
  }

  async function startCall(button) {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return toast('L’appel vidéo n’est pas disponible sur ce navigateur.', true);
    button.disabled = true;
    try {
      const payload = await api({
        method: 'POST',
        body: JSON.stringify({ action: 'start', conversationId: pageConversationId })
      });
      call = payload.call;
      iceServers = payload.iceServers;
      renderLayer('ringing');
      await ensureMediaAndPeer();
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      await sendSignal('offer', { type: offer.type, sdp: offer.sdp });
      poll();
    } catch (error) {
      closeLayer();
      button.disabled = false;
      toast(error.message === 'video_relay_not_configured'
        ? 'Le relais vidéo sécurisé n’est pas encore activé sur cet environnement.'
        : error.message === 'conversation_acceptance_required'
          ? 'La conversation doit d’abord être acceptée.'
          : 'L’appel vidéo n’a pas pu démarrer.', true);
    }
  }

  async function callAction(action, button) {
    if (!call?.id) return;
    button.disabled = true;
    try {
      const payload = await api({
        method: 'POST',
        body: JSON.stringify({ action, conversationId: pageConversationId, callId: call.id })
      });
      if (action === 'accept') {
        iceServers = payload.iceServers;
        call = { ...call, status: 'active' };
        renderLayer('active');
        await ensureMediaAndPeer();
        poll();
      } else {
        closeLayer();
      }
    } catch (error) {
      button.disabled = false;
      toast(error.message === 'video_relay_not_configured' ? 'Le relais vidéo sécurisé n’est pas encore activé.' : 'Action impossible sur cet appel.', true);
    }
  }

  async function endCall(remote = true) {
    const current = call;
    if (remote && current?.id && pageConversationId) {
      await api({ method: 'POST', body: JSON.stringify({ action: 'end', conversationId: pageConversationId, callId: current.id }) }).catch(() => null);
    }
    closeLayer();
  }

  function toggleTrack(kind, button) {
    const track = kind === 'audio' ? localStream?.getAudioTracks()?.[0] : localStream?.getVideoTracks()?.[0];
    if (!track) return;
    track.enabled = !track.enabled;
    button.classList.toggle('off', !track.enabled);
    button.textContent = kind === 'audio' ? (track.enabled ? 'Micro' : 'Micro coupé') : (track.enabled ? 'Caméra' : 'Caméra coupée');
  }

  function enhance(page) {
    const id = conversationId(page);
    if (id !== pageConversationId) {
      closeLayer();
      pageConversationId = id;
      lastSignalId = 0;
      if (id) poll();
    }
    if (!id || page.querySelector('[data-zwit-video-call]')) return;
    const header = page.querySelector('.velvet-chat-topbar,.conversation-peer-header,.chat-peer');
    if (!header) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zwit-video-call-button';
    button.dataset.zwitVideoCall = '1';
    button.setAttribute('aria-label', 'Appeler en vidéo');
    button.innerHTML = '<span aria-hidden="true">▱</span><small>Vidéo</small>';
    header.appendChild(button);
  }

  function sync() {
    scheduled = false;
    const page = conversationPage();
    if (page) enhance(page);
    else if (pageConversationId) {
      pageConversationId = '';
      endCall(true);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  document.addEventListener('click', (event) => {
    const start = event.target.closest('[data-zwit-video-call]');
    if (start) return startCall(start);
    const action = event.target.closest('[data-zwit-call-action]');
    if (action) return callAction(action.dataset.zwitCallAction, action);
    const mute = event.target.closest('[data-zwit-video-mute]');
    if (mute) return toggleTrack('audio', mute);
    const camera = event.target.closest('[data-zwit-video-camera]');
    if (camera) return toggleTrack('video', camera);
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => { if (call) endCall(true); });
  schedule();
})();
