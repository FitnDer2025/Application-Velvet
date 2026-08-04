(() => {
  'use strict';

  const PROJECTS_KEY = 'velvet_studio_sprint1_projects_v2';
  const ACTIVE_KEY = 'velvet_studio_sprint1_active_v2';
  const PACKS_KEY = 'velvet_studio_v3_campaign_packs';
  const DB_NAME = 'velvetStudioMediaV31';
  const STORE_NAME = 'media';
  const FPS = 30;
  const CLIP_SECONDS = 12;

  const MOCK_PROFILES = {
    couple_lille: { label: 'Élise & Marc', type: 'Couple', age: '36 & 39 ans', city: 'Lille', trust: 'Profil vérifié' },
    couple_bruxelles: { label: 'Claire & Julien', type: 'Couple', age: '34 & 38 ans', city: 'Bruxelles', trust: 'Profil vérifié' },
    femme_lille: { label: 'Sofia', type: 'Femme', age: '35 ans', city: 'Lille', trust: 'Profil vérifié' },
    couple_mixte: { label: 'Maya & Thomas', type: 'Couple', age: '37 & 40 ans', city: 'Tournai', trust: 'Profil vérifié' }
  };

  const SCENARIOS = {
    profil: { label: 'Découverte d’un profil', headline: 'Des rencontres qui ont du sens.', subline: 'Des profils mieux présentés. Une confiance visible.' },
    recherche: { label: 'Recherche de membres', headline: 'Trouvez les personnes qui vous ressemblent.', subline: 'Une recherche plus fluide, plus humaine, plus proche.' },
    message: { label: 'Nouvelle conversation', headline: 'Le feeling commence parfois par quelques mots.', subline: 'Une messagerie pensée pour laisser la connexion se créer.' },
    evenement: { label: 'Événement à proximité', headline: 'Votre prochaine expérience commence ici.', subline: 'Sorties, lieux et événements réunis dans un même univers.' }
  };

  const state = {
    generating: false,
    rendering: false,
    media: [],
    capabilities: null,
    activeProjectId: null
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
  const clean = (value, max = 1600) => String(value ?? '').trim().slice(0, max);

  function readProjects() {
    try {
      const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      return Array.isArray(projects) ? projects : [];
    } catch {
      return [];
    }
  }

  function currentProject() {
    const projects = readProjects();
    const id = localStorage.getItem(ACTIVE_KEY);
    return projects.find((item) => item.id === id) || projects[0] || null;
  }

  function currentPack() {
    try {
      const packs = JSON.parse(localStorage.getItem(PACKS_KEY) || '[]');
      const project = currentProject();
      return Array.isArray(packs) ? packs.find((item) => item.projectId === project?.id) || packs[0] || null : null;
    } catch {
      return null;
    }
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveMedia(item) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(item);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  async function listMedia(projectId) {
    const db = await openDatabase();
    const items = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).index('projectId').getAll(projectId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function deleteMedia(id) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  function notify(message, tone = 'ok') {
    let node = document.querySelector('#vs31Toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vs31Toast';
      document.body.appendChild(node);
    }
    node.className = `vs31-toast ${tone}`;
    node.textContent = message;
    requestAnimationFrame(() => node.classList.add('show'));
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 3200);
  }

  function installTab() {
    const modal = document.querySelector('[data-velvet-studio-v3]');
    const nav = modal?.querySelector('.vs3-tabs');
    if (!modal || !nav || nav.querySelector('[data-v31-media-tab]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v31MediaTab = 'true';
    button.innerHTML = '<span>✦</span> Médias IA';
    button.addEventListener('click', () => openMediaTab(modal));
    nav.appendChild(button);
  }

  async function openMediaTab(modal) {
    const project = currentProject();
    if (!project) return notify('Ouvre d’abord un projet Velvet Studio.', 'error');
    state.activeProjectId = project.id;
    modal.querySelectorAll('.vs3-tabs button').forEach((button) => button.classList.remove('active'));
    modal.querySelector('[data-v31-media-tab]')?.classList.add('active');
    const body = modal.querySelector('[data-v3-tab-body]');
    if (!body) return;
    body.innerHTML = mediaWorkspaceMarkup(project);
    bindWorkspace(body);
    await Promise.all([loadCapabilities(body), refreshGallery(body)]);
  }

  function mediaWorkspaceMarkup(project) {
    const pack = currentPack();
    const prompt = clean(pack?.brief || project.prompt || project.objective || 'Créer une campagne Velvet premium qui montre une connexion sincère et la qualité de l’expérience.', 1200);
    return `<div class="vs31-workspace">
      <section class="vs31-generator">
        <div class="vs31-heading"><div><span class="vs3-kicker">V3.1 · Génération réelle</span><h3>Studio photo & vidéo</h3><p>Crée une photographie publicitaire avec Workers AI, puis transforme-la en clip social avec une démonstration fictive de Velvet.</p></div><div class="vs31-ai-state" data-v31-capability><i></i><span>Vérification de Workers AI…</span></div></div>
        <div class="vs31-form">
          <label class="wide">Prompt créatif<textarea data-v31-prompt>${esc(prompt)}</textarea></label>
          <label>Style<select data-v31-preset><option value="rencontre-premium">Rencontre premium</option><option value="soiree-chic">Soirée chic</option><option value="lifestyle-urbain">Lifestyle urbain</option><option value="velvet-pro">Velvet Pro</option></select></label>
          <label>Profil fictif<select data-v31-profile>${Object.entries(MOCK_PROFILES).map(([id, profile]) => `<option value="${id}">${esc(profile.label)} · ${esc(profile.city)}</option>`).join('')}</select></label>
          <label>Fonction simulée<select data-v31-scenario>${Object.entries(SCENARIOS).map(([id, scenario]) => `<option value="${id}">${esc(scenario.label)}</option>`).join('')}</select></label>
          <label>Format<select data-v31-format><option value="9:16">Story / Reel · 9:16</option><option value="4:5">Instagram · 4:5</option><option value="1:1">Carré · 1:1</option><option value="16:9">Paysage · 16:9</option></select></label>
          <label>Variantes<select data-v31-count><option value="1">1 image</option><option value="2">2 images</option><option value="3">3 images</option></select></label>
          <button class="vs31-generate" data-v31-generate><span>✦</span><strong>Générer les visuels</strong><small>Personnes fictives majeures · non explicite</small></button>
        </div>
        <div class="vs31-promise"><article><strong>Photo réelle</strong><span>FLUX.1 Schnell</span></article><article><strong>Simulation Velvet</strong><span>Profil, recherche, message ou sortie</span></article><article><strong>Clip social</strong><span>WebM animé, prêt à tester</span></article></div>
      </section>
      <section class="vs31-gallery-section"><div class="vs31-gallery-head"><div><span class="vs3-kicker">Productions</span><h3>Galerie média</h3></div><span data-v31-count-label>Chargement…</span></div><div class="vs31-gallery" data-v31-gallery><div class="vs31-empty">Aucun média généré pour ce projet.</div></div></section>
    </div>`;
  }

  function bindWorkspace(scope) {
    scope.querySelector('[data-v31-generate]')?.addEventListener('click', () => generateMedia(scope));
    scope.addEventListener('click', async (event) => {
      const download = event.target.closest('[data-v31-download]');
      if (download) return downloadImage(download.dataset.v31Download);
      const render = event.target.closest('[data-v31-video]');
      if (render) return renderClip(render.dataset.v31Video, scope);
      const copy = event.target.closest('[data-v31-copy]');
      if (copy) {
        await navigator.clipboard.writeText(state.media.find((item) => item.id === copy.dataset.v31Copy)?.prompt || '');
        return notify('Prompt copié');
      }
      const remove = event.target.closest('[data-v31-delete]');
      if (remove) {
        await deleteMedia(remove.dataset.v31Delete);
        return refreshGallery(scope);
      }
    });
  }

  async function loadCapabilities(scope) {
    const node = scope.querySelector('[data-v31-capability]');
    try {
      const response = await fetch('/api/control/studio-media', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'capabilities' })
      });
      const payload = await response.json();
      state.capabilities = payload;
      const ready = response.ok && payload.binding;
      node.classList.toggle('ready', ready);
      node.classList.toggle('error', !ready);
      node.querySelector('span').textContent = ready ? 'Workers AI connecté · génération gratuite disponible' : 'Binding AI non détecté sur cette version';
    } catch {
      node.classList.add('error');
      node.querySelector('span').textContent = 'Impossible de vérifier Workers AI';
    }
  }

  async function generateMedia(scope) {
    if (state.generating) return;
    const button = scope.querySelector('[data-v31-generate]');
    const project = currentProject();
    const values = {
      action: 'generate_image',
      prompt: clean(scope.querySelector('[data-v31-prompt]')?.value, 1200),
      preset: scope.querySelector('[data-v31-preset]')?.value || 'rencontre-premium',
      mockProfile: scope.querySelector('[data-v31-profile]')?.value || 'couple_lille',
      scenario: scope.querySelector('[data-v31-scenario]')?.value || 'profil',
      format: scope.querySelector('[data-v31-format]')?.value || '9:16',
      steps: 8
    };
    const count = Math.min(3, Math.max(1, Number(scope.querySelector('[data-v31-count]')?.value || 1)));
    state.generating = true;
    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('strong').textContent = `Génération 0 / ${count}`;

    try {
      for (let index = 0; index < count; index += 1) {
        button.querySelector('strong').textContent = `Génération ${index + 1} / ${count}`;
        const response = await fetch('/api/control/studio-media', {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...values, seed: Math.floor(Math.random() * 2_000_000_000) + 1 })
        });
        const payload = await response.json();
        if (!response.ok || !payload.media) throw new Error(payload.error || 'generation_failed');
        await saveMedia({ ...payload.media, projectId: project.id, title: `${SCENARIOS[values.scenario].label} · ${MOCK_PROFILES[values.mockProfile].label}` });
        await refreshGallery(scope);
      }
      notify(`${count} visuel${count > 1 ? 's' : ''} généré${count > 1 ? 's' : ''}`);
    } catch (error) {
      const messages = {
        workers_ai_binding_missing: 'Le binding AI n’est pas disponible sur le déploiement actif.',
        studio_access_required: 'Ton compte doit avoir le rôle Direction ou Admin.',
        workers_ai_image_missing: 'Workers AI n’a pas renvoyé d’image.'
      };
      notify(messages[error.message] || `Génération impossible : ${error.message}`, 'error');
    } finally {
      state.generating = false;
      button.disabled = false;
      button.classList.remove('loading');
      button.querySelector('strong').textContent = 'Générer les visuels';
    }
  }

  async function refreshGallery(scope) {
    const project = currentProject();
    state.media = project ? await listMedia(project.id) : [];
    const gallery = scope.querySelector('[data-v31-gallery]');
    const label = scope.querySelector('[data-v31-count-label]');
    if (!gallery) return;
    label.textContent = `${state.media.length} média${state.media.length > 1 ? 's' : ''}`;
    gallery.innerHTML = state.media.length ? state.media.map(mediaCard).join('') : '<div class="vs31-empty"><strong>La galerie est vide.</strong><span>Décris la campagne, choisis un profil fictif puis lance la première génération.</span></div>';
  }

  function mediaCard(item) {
    const profile = MOCK_PROFILES[item.mockProfile] || MOCK_PROFILES.couple_lille;
    const scenario = SCENARIOS[item.scenario] || SCENARIOS.profil;
    return `<article class="vs31-media-card" data-media-id="${item.id}"><div class="vs31-image ${esc(item.format).replace(':', '-')}" style="--media-image:url('${item.dataUri}')"><img src="${item.dataUri}" alt="Visuel publicitaire Velvet généré"><div class="vs31-image-brand"><b>V</b><span>VELVET</span></div><div class="vs31-member-preview"><small>${esc(profile.type)} · ${esc(profile.city)}</small><strong>${esc(profile.label)}</strong><span>${esc(profile.age)} · ${esc(profile.trust)}</span></div></div><div class="vs31-media-copy"><div><span>${esc(item.format)} · ${esc(scenario.label)}</span><h4>${esc(item.title)}</h4><small>${new Date(item.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${esc(item.model)}</small></div><div class="vs31-media-actions"><button data-v31-video="${item.id}" class="primary">Créer le clip</button><button data-v31-download="${item.id}">Photo</button><button data-v31-copy="${item.id}">Prompt</button><button data-v31-delete="${item.id}" class="danger">×</button></div></div></article>`;
  }

  function downloadImage(id) {
    const item = state.media.find((entry) => entry.id === id);
    if (!item) return;
    const link = document.createElement('a');
    link.href = item.dataUri;
    link.download = `velvet-${item.scenario}-${item.seed}.jpg`;
    link.click();
  }

  function dimensions(format) {
    if (format === '16:9') return { width: 1280, height: 720 };
    if (format === '1:1') return { width: 1080, height: 1080 };
    if (format === '4:5') return { width: 864, height: 1080 };
    return { width: 720, height: 1280 };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
  }

  function coverImage(ctx, image, width, height, scale = 1, pan = 0) {
    const base = Math.max(width / image.width, height / image.height) * scale;
    const drawWidth = image.width * base;
    const drawHeight = image.height * base;
    const x = (width - drawWidth) / 2 + pan * width * 0.04;
    const y = (height - drawHeight) / 2 - pan * height * 0.025;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  }

  function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let lineIndex = 0;
    for (const word of words) {
      const candidate = `${line}${word} `;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, y + lineIndex * lineHeight);
        line = `${word} `;
        lineIndex += 1;
        if (lineIndex >= maxLines) return;
      } else line = candidate;
    }
    if (lineIndex < maxLines) ctx.fillText(line.trim(), x, y + lineIndex * lineHeight);
  }

  function ease(value) {
    const v = Math.max(0, Math.min(1, value));
    return v * v * (3 - 2 * v);
  }

  function drawPhone(ctx, width, height, profile, scenario, progress) {
    const landscape = width > height;
    const phoneW = landscape ? width * 0.25 : width * 0.62;
    const phoneH = landscape ? height * 0.78 : height * 0.46;
    const startX = width + phoneW;
    const targetX = landscape ? width * 0.68 : width * 0.32;
    const x = startX + (targetX - startX) * ease(progress);
    const y = landscape ? height * 0.12 : height * 0.43;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.58)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#111114';
    roundRect(ctx, x, y, phoneW, phoneH, phoneW * 0.08);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const pad = phoneW * 0.07;
    ctx.fillStyle = '#641B36';
    roundRect(ctx, x + pad, y + pad, phoneW - pad * 2, phoneH * 0.14, 18);
    ctx.fill();
    ctx.fillStyle = '#C6A96A';
    ctx.font = `700 ${Math.max(14, phoneW * 0.06)}px Georgia`;
    ctx.fillText('VELVET', x + pad * 1.5, y + pad + phoneH * 0.085);

    ctx.fillStyle = '#242126';
    roundRect(ctx, x + pad, y + phoneH * 0.23, phoneW - pad * 2, phoneH * 0.38, 22);
    ctx.fill();
    ctx.fillStyle = '#F4F4F2';
    ctx.font = `600 ${Math.max(13, phoneW * 0.055)}px Inter, sans-serif`;
    ctx.fillText(profile.label, x + pad * 1.35, y + phoneH * 0.48);
    ctx.fillStyle = '#C6A96A';
    ctx.font = `500 ${Math.max(10, phoneW * 0.038)}px Inter, sans-serif`;
    ctx.fillText(`${profile.age} · ${profile.city}`, x + pad * 1.35, y + phoneH * 0.54);

    ctx.fillStyle = '#641B36';
    roundRect(ctx, x + pad, y + phoneH * 0.68, phoneW - pad * 2, phoneH * 0.18, 18);
    ctx.fill();
    ctx.fillStyle = '#F4F4F2';
    ctx.font = `600 ${Math.max(11, phoneW * 0.043)}px Inter, sans-serif`;
    const action = scenario === 'message' ? 'Nouveau message' : scenario === 'evenement' ? 'Soirée près de vous' : scenario === 'recherche' ? 'Découvrir le profil' : 'Profil vérifié';
    ctx.fillText(action, x + pad * 1.35, y + phoneH * 0.79);
    ctx.restore();
  }

  function drawClipFrame(ctx, canvas, image, item, seconds) {
    const width = canvas.width;
    const height = canvas.height;
    const profile = MOCK_PROFILES[item.mockProfile] || MOCK_PROFILES.couple_lille;
    const scenario = SCENARIOS[item.scenario] || SCENARIOS.profil;
    const progress = seconds / CLIP_SECONDS;

    ctx.fillStyle = '#0D0D0D';
    ctx.fillRect(0, 0, width, height);
    coverImage(ctx, image, width, height, 1.02 + progress * 0.1, (progress - 0.5) * 2);

    const overlay = ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, 'rgba(8,8,10,.18)');
    overlay.addColorStop(0.52, 'rgba(8,8,10,.2)');
    overlay.addColorStop(1, 'rgba(8,8,10,.9)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);

    const pad = width * 0.07;
    ctx.fillStyle = '#C6A96A';
    ctx.font = `700 ${Math.max(16, width * 0.027)}px Georgia`;
    ctx.fillText('VELVET', pad, height * 0.085);
    ctx.fillStyle = 'rgba(244,244,242,.78)';
    ctx.font = `600 ${Math.max(10, width * 0.015)}px Inter, sans-serif`;
    ctx.fillText('RENCONTRES · ÉVÉNEMENTS · CONFIANCE', pad, height * 0.115);

    if (seconds > 2.3 && seconds < 9.8) drawPhone(ctx, width, height, profile, item.scenario, Math.min(1, (seconds - 2.3) / 1.2));

    const textIn = ease(Math.min(1, seconds / 1.4));
    ctx.save();
    ctx.globalAlpha = textIn;
    ctx.translate(0, (1 - textIn) * 28);
    ctx.fillStyle = '#F4F4F2';
    ctx.font = `500 ${Math.max(38, width * 0.065)}px Georgia`;
    wrap(ctx, seconds < 9.3 ? scenario.headline : 'Velvet.', pad, height * 0.69, width * 0.78, height * 0.058, 3);
    ctx.fillStyle = 'rgba(244,244,242,.86)';
    ctx.font = `500 ${Math.max(17, width * 0.027)}px Inter, sans-serif`;
    wrap(ctx, seconds < 9.3 ? scenario.subline : 'Là où les plus belles rencontres commencent.', pad, height * 0.84, width * 0.78, height * 0.035, 3);
    ctx.restore();

    if (seconds > 9.2) {
      const cta = ease((seconds - 9.2) / 0.8);
      ctx.save();
      ctx.globalAlpha = cta;
      ctx.fillStyle = '#C6A96A';
      roundRect(ctx, pad, height * 0.9, width * 0.43, height * 0.055, 999);
      ctx.fill();
      ctx.fillStyle = '#151515';
      ctx.font = `700 ${Math.max(13, width * 0.021)}px Inter, sans-serif`;
      ctx.fillText('DÉCOUVRIR VELVET', pad + width * 0.045, height * 0.935);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(255,255,255,.2)';
    roundRect(ctx, pad, height * 0.975, width * 0.86, Math.max(4, height * 0.004), 99);
    ctx.fill();
    ctx.fillStyle = '#C6A96A';
    roundRect(ctx, pad, height * 0.975, width * 0.86 * progress, Math.max(4, height * 0.004), 99);
    ctx.fill();
  }

  function startMusic(destination, duration) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return { context: null, nodes: [] };
    const context = new Audio();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.11, context.currentTime + 0.6);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration - 0.15);
    master.connect(destination);
    const nodes = [master];
    [130.81, 164.81, 196].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.045 / (index + 1);
      oscillator.connect(gain).connect(master);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
      nodes.push(oscillator, gain);
    });
    return { context, nodes };
  }

  async function renderClip(id, scope) {
    if (state.rendering) return;
    const item = state.media.find((entry) => entry.id === id);
    if (!item) return notify('Média introuvable.', 'error');
    if (!window.MediaRecorder) return notify('Ce navigateur ne permet pas le rendu vidéo.', 'error');
    state.rendering = true;
    const button = scope.querySelector(`[data-v31-video="${id}"]`);
    if (button) { button.disabled = true; button.textContent = 'Rendu en cours…'; }

    try {
      const image = await loadImage(item.dataUri);
      const size = dimensions(item.format);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(FPS);

      const Audio = window.AudioContext || window.webkitAudioContext;
      let music = { context: null, nodes: [] };
      if (Audio) {
        const audioContext = new Audio();
        const destination = audioContext.createMediaStreamDestination();
        music = startMusic(destination, CLIP_SECONDS + 0.4);
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      }

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const chunks = [];
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined);
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.start(250);
      const started = performance.now();

      await new Promise((resolve) => {
        const frame = (now) => {
          const seconds = Math.min(CLIP_SECONDS, (now - started) / 1000);
          drawClipFrame(ctx, canvas, image, item, seconds);
          if (button) button.textContent = `Rendu ${Math.round(seconds / CLIP_SECONDS * 100)} %`;
          if (seconds >= CLIP_SECONDS) return resolve();
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });

      const blob = await new Promise((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
        recorder.stop();
      });
      stream.getTracks().forEach((track) => track.stop());
      music.nodes.forEach((node) => { try { node.stop?.(); } catch {} try { node.disconnect?.(); } catch {} });
      music.context?.close?.();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `velvet-${item.scenario}-${item.seed}.webm`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 15_000);
      notify('Clip social généré et téléchargé');
    } catch (error) {
      notify(`Rendu vidéo impossible : ${error.message}`, 'error');
    } finally {
      state.rendering = false;
      if (button) { button.disabled = false; button.textContent = 'Créer le clip'; }
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(installTab));
  observer.observe(document.body, { childList: true, subtree: true });
  installTab();
})();
