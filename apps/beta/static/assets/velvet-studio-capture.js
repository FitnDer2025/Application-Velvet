(() => {
  'use strict';

  const JOB_PREFIX = 'velvet_studio_social_job_v1:';
  const params = new URLSearchParams(location.search);
  const jobId = params.get('job') || '';
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function readJob() {
    try {
      const value = JSON.parse(localStorage.getItem(`${JOB_PREFIX}${jobId}`) || 'null');
      return value?.plan?.scenes?.length ? value : null;
    } catch {
      return null;
    }
  }

  const job = readJob();
  const state = {
    running: false,
    cancelled: false,
    displayStream: null,
    canvasStream: null,
    sourceVideo: null,
    recorder: null,
    paintFrame: 0,
    chunks: [],
    voice: null,
    outputUrl: ''
  };

  const frame = document.querySelector('[data-vsc-frame]');
  const iframe = document.querySelector('[data-vsc-iframe]');
  const overlay = document.querySelector('[data-vsc-overlay]');
  const startButton = document.querySelector('[data-vsc-start]');
  const cancelButton = document.querySelector('[data-vsc-cancel]');
  const status = document.querySelector('[data-vsc-status]');
  const step = document.querySelector('[data-vsc-step]');
  const title = document.querySelector('[data-vsc-title]');
  const subtitle = document.querySelector('[data-vsc-subtitle]');
  const intro = document.querySelector('[data-vsc-intro]');
  const outro = document.querySelector('[data-vsc-outro]');
  const cursor = document.querySelector('[data-vsc-cursor]');
  const result = document.querySelector('[data-vsc-result]');

  function setStatus(message, tone = '') {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function setStep(message) {
    if (step) step.textContent = message;
  }

  function fail(message) {
    setStatus(message, 'error');
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent = 'Réessayer le tournage';
    }
  }

  function sourceRoute() {
    return job?.product === 'pro'
      ? `/marketing-pro/?velvet_capture=${encodeURIComponent(jobId)}`
      : `/marketing/?velvet_capture=${encodeURIComponent(jobId)}`;
  }

  function outputSize(format) {
    if (format === '16:9') return { width: 1280, height: 720 };
    if (format === '1:1') return { width: 900, height: 900 };
    return { width: 720, height: 1280 };
  }

  function bestMime() {
    if (!window.MediaRecorder) return '';
    return [
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ].find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function loadVoices(timeout = 5000) {
    if (!window.speechSynthesis) throw new Error('La synthèse vocale française n’est pas disponible dans ce navigateur.');
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const voices = speechSynthesis.getVoices();
      if (voices.length) {
        const selected = voices.find((voice) => voice.voiceURI === job.voice?.voiceURI)
          || voices.find((voice) => voice.name === job.voice?.name && /^fr/i.test(voice.lang || ''))
          || voices.find((voice) => /^fr(?:-|_)/i.test(voice.lang || ''));
        if (selected) return selected;
      }
      await wait(120);
    }
    throw new Error('La voix française sélectionnée n’est pas disponible dans cet onglet.');
  }

  async function waitForCaptureBridge(timeout = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (state.cancelled) throw new Error('studio_cancelled');
      try {
        const doc = iframe.contentDocument;
        const selector = job.product === 'pro' ? '[data-vp-view]' : '[data-vc-view]';
        if (doc?.querySelector(selector)) return doc;
      } catch {}
      await wait(100);
    }
    throw new Error('L’environnement Zwit Marketing ne s’est pas chargé correctement.');
  }

  function moveCursor(x, y) {
    if (!cursor) return;
    cursor.style.left = `${x}%`;
    cursor.style.top = `${y}%`;
  }

  function clickPulse() {
    if (!cursor) return;
    cursor.classList.add('click');
    setTimeout(() => cursor.classList.remove('click'), 180);
  }

  async function smoothTour(doc, direction = 'down') {
    const win = doc.defaultView;
    const scrolling = doc.scrollingElement || doc.documentElement;
    const max = Math.max(0, scrolling.scrollHeight - win.innerHeight);
    if (max < 120) {
      await wait(650);
      return;
    }
    const target = direction === 'up' ? Math.max(0, max * 0.12) : Math.min(max, Math.max(260, max * 0.42));
    win.scrollTo({ top: target, behavior: 'smooth' });
    await wait(900);
  }

  function memberView(screen) {
    return ({ home: 'home', discover: 'discover', profile: 'profile', messages: 'messages', events: 'events', map: 'map' })[screen] || 'home';
  }

  function proView(screen) {
    return ({ pro_dashboard: 'dashboard', dashboard: 'dashboard', pro_venue: 'venue', venue: 'venue', pro_events: 'events', events: 'events', pro_bookings: 'bookings', bookings: 'bookings' })[screen] || 'dashboard';
  }

  async function navigateScene(scene, index) {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('L’interface Zwit n’est plus accessible.');
    doc.defaultView.scrollTo({ top: 0, behavior: 'auto' });
    const view = job.product === 'pro' ? proView(scene.screen) : memberView(scene.screen);
    const selector = job.product === 'pro' ? `[data-vp-view="${view}"]` : `[data-vc-view="${view}"]`;
    const bridge = doc.querySelector(selector);
    const positions = [[13, 20], [14, 34], [34, 38], [52, 62], [18, 72], [72, 30]];
    const [x, y] = positions[index % positions.length];
    moveCursor(x, y);
    await wait(480);
    clickPulse();
    bridge?.click();
    await wait(view === 'profile' || view === 'messages' ? 1100 : 720);
    await smoothTour(doc, index % 2 ? 'up' : 'down');
  }

  function speak(text) {
    return new Promise((resolve, reject) => {
      if (!state.voice) return reject(new Error('Voix française absente.'));
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text || '').trim());
      utterance.voice = state.voice;
      utterance.lang = state.voice.lang || 'fr-FR';
      utterance.rate = Number(job.voice?.rate || 0.9);
      utterance.pitch = Number(job.voice?.pitch || 0.96);
      utterance.volume = 1;
      const fallback = setTimeout(resolve, Math.max(3500, String(text || '').length * 72));
      utterance.onend = () => { clearTimeout(fallback); resolve(); };
      utterance.onerror = () => { clearTimeout(fallback); reject(new Error('La voix française s’est interrompue.')); };
      speechSynthesis.speak(utterance);
    });
  }

  async function requestDisplay() {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Ce navigateur ne permet pas d’enregistrer un onglet. Utilise Chrome, Edge ou Safari sur ordinateur.');
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 30 }, displaySurface: 'browser' },
      audio: true,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude'
    });
    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('Active « Partager l’audio de l’onglet » puis sélectionne cet onglet Velvet.');
    }
    return stream;
  }

  async function createRecorder(stream) {
    const sourceVideo = document.createElement('video');
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    sourceVideo.srcObject = stream;
    await sourceVideo.play();
    const started = Date.now();
    while (!sourceVideo.videoWidth && Date.now() - started < 5000) await wait(50);
    if (!sourceVideo.videoWidth) throw new Error('Le flux vidéo de l’onglet est vide.');
    state.sourceVideo = sourceVideo;

    const size = outputSize(job.format);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Le moteur vidéo du navigateur est indisponible.');

    const canvasStream = canvas.captureStream(30);
    stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
    state.canvasStream = canvasStream;

    let painting = true;
    const paint = () => {
      if (!painting) return;
      const rect = frame.getBoundingClientRect();
      const scaleX = sourceVideo.videoWidth / window.innerWidth;
      const scaleY = sourceVideo.videoHeight / window.innerHeight;
      const sx = Math.max(0, rect.left * scaleX);
      const sy = Math.max(0, rect.top * scaleY);
      const sw = Math.min(sourceVideo.videoWidth - sx, rect.width * scaleX);
      const sh = Math.min(sourceVideo.videoHeight - sy, rect.height * scaleY);
      context.fillStyle = '#0b0b0d';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(sourceVideo, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      state.paintFrame = requestAnimationFrame(paint);
    };
    paint();

    const mime = bestMime();
    const recorder = new MediaRecorder(canvasStream, mime ? {
      mimeType: mime,
      videoBitsPerSecond: job.format === '9:16' ? 7_000_000 : 6_000_000,
      audioBitsPerSecond: 192_000
    } : undefined);
    state.chunks = [];
    recorder.ondataavailable = (event) => { if (event.data?.size) state.chunks.push(event.data); };
    recorder.start(500);
    state.recorder = recorder;

    return async () => {
      painting = false;
      cancelAnimationFrame(state.paintFrame);
      const blob = await new Promise((resolve) => {
        recorder.onstop = () => resolve(new Blob(state.chunks, { type: recorder.mimeType || 'video/webm' }));
        recorder.stop();
      });
      canvasStream.getTracks().forEach((track) => track.stop());
      sourceVideo.srcObject = null;
      return { blob, mime: recorder.mimeType || 'video/webm' };
    };
  }

  async function runStory() {
    const scenes = job.plan.scenes;
    intro.classList.remove('hidden');
    outro.classList.add('hidden');
    await wait(1500);
    intro.classList.add('hidden');

    for (let index = 0; index < scenes.length; index += 1) {
      if (state.cancelled) throw new Error('studio_cancelled');
      const scene = scenes[index];
      setStep(`SCÈNE ${index + 1} / ${scenes.length}`);
      title.textContent = scene.title || 'Zwit';
      subtitle.textContent = scene.onScreen || '';
      title.parentElement.classList.add('visible');
      await navigateScene(scene, index);
      const started = performance.now();
      await speak(scene.voice || scene.onScreen || '').catch((error) => { throw error; });
      const minimum = Math.max(2500, Number(scene.duration || 5) * 1000);
      const elapsed = performance.now() - started;
      if (elapsed < minimum) await wait(minimum - elapsed);
      title.parentElement.classList.remove('visible');
    }

    title.parentElement.classList.remove('visible');
    outro.classList.remove('hidden');
    const closing = job.plan.closingLine || (job.product === 'pro' ? 'Zwit Pro. Donnez à votre établissement la visibilité qu’il mérite.' : 'Velvet. Là où les plus belles rencontres commencent.');
    await speak(closing);
    await wait(900);
  }

  async function startCapture() {
    if (state.running || !job) return;
    state.running = true;
    state.cancelled = false;
    startButton.disabled = true;
    startButton.textContent = 'Préparation…';
    setStatus('Préparation de la voix et du véritable environnement Zwit…');
    try {
      state.voice = await loadVoices();
      await waitForCaptureBridge();
      setStatus('Choisis cet onglet Zwit et active le partage audio.');
      state.displayStream = await requestDisplay();
      state.displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (state.running) cancelCapture();
      });
      const stopRecorder = await createRecorder(state.displayStream);
      overlay.classList.add('hidden');
      document.body.classList.add('recording');
      await wait(700);
      await runStory();
      const output = await stopRecorder();
      state.displayStream.getTracks().forEach((track) => track.stop());
      state.displayStream = null;
      speechSynthesis.cancel();
      document.body.classList.remove('recording');
      state.running = false;
      showResult(output.blob, output.mime);
    } catch (error) {
      state.running = false;
      document.body.classList.remove('recording');
      overlay.classList.remove('hidden');
      state.displayStream?.getTracks().forEach((track) => track.stop());
      state.canvasStream?.getTracks().forEach((track) => track.stop());
      state.displayStream = null;
      state.canvasStream = null;
      speechSynthesis?.cancel?.();
      if (error.name === 'NotAllowedError') fail('Autorisation refusée. Sélectionne cet onglet Zwit et active le partage audio.');
      else if (error.message !== 'studio_cancelled') fail(error.message || 'Le tournage a été interrompu.');
    }
  }

  function showResult(blob, mime) {
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    state.outputUrl = URL.createObjectURL(blob);
    const extension = mime.includes('mp4') ? 'mp4' : 'webm';
    const universe = job.product === 'pro' ? 'pro' : 'membre';
    const filename = `velvet-${universe}-${job.format.replace(':', 'x')}-${Date.now()}.${extension}`;
    result.hidden = false;
    result.innerHTML = `<section class="vsc-result-card"><span>VIDÉO PRÊTE</span><h1>Le véritable Zwit, en mouvement.</h1><p>Voix française intégrée · ${job.format} · ${job.product === 'pro' ? 'Zwit Pro' : 'Zwit Membre'}</p><video src="${state.outputUrl}" controls playsinline></video><div><a href="${state.outputUrl}" download="${filename}">Télécharger la vidéo</a><button type="button" data-vsc-restart>Refaire un tournage</button><a href="/control/">Retour à Zwit Studio</a></div></section>`;
    frame.hidden = true;
    document.querySelector('[data-vsc-progress]')?.setAttribute('hidden', '');
  }

  function cancelCapture() {
    state.cancelled = true;
    state.running = false;
    state.recorder?.state === 'recording' && state.recorder.stop();
    state.displayStream?.getTracks().forEach((track) => track.stop());
    state.canvasStream?.getTracks().forEach((track) => track.stop());
    speechSynthesis?.cancel?.();
    overlay.classList.remove('hidden');
    fail('Tournage annulé.');
  }

  if (!job) {
    fail('Projet vidéo introuvable. Retourne dans Zwit Studio et relance le tournage.');
    startButton.disabled = true;
  } else {
    frame.dataset.format = job.format || '9:16';
    iframe.src = sourceRoute();
    document.querySelector('[data-vsc-universe]').textContent = job.product === 'pro' ? 'ZWIT PRO' : 'ZWIT MEMBRE';
    document.querySelector('[data-vsc-format]').textContent = `${job.format} · ${job.duration} secondes`;
    setStatus('Le véritable environnement Zwit Marketing est en cours de chargement.');
  }

  startButton?.addEventListener('click', startCapture);
  cancelButton?.addEventListener('click', cancelCapture);
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-vsc-restart]')) location.reload();
  });
})();
