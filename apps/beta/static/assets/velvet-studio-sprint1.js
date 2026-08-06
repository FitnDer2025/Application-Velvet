(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const STORAGE_KEY = 'velvet_studio_sprint1_projects_v2';
  const ACTIVE_KEY = 'velvet_studio_sprint1_active_v2';
  const MAX_VERSIONS = 12;
  const MAX_ASSET_BYTES = 1_500_000;
  const AGENTS = [
    ['writer', 'Auteur IA', 'Structure le récit et la voix de marque'],
    ['director', 'Réalisateur IA', 'Découpe le film et dirige les plans'],
    ['storyboard', 'Storyboard IA', 'Transforme le récit en scènes'],
    ['motion', 'Motion Designer IA', 'Définit les mouvements et transitions'],
    ['voice', 'Voix OFF IA', 'Prépare le texte, le rythme et l’intention'],
    ['composer', 'Compositeur IA', 'Conçoit l’identité musicale'],
    ['editor', 'Monteur IA', 'Synchronise image, voix, musique et texte'],
    ['community', 'Community Manager IA', 'Adapte les formats aux réseaux']
  ];

  const SCENE_PALETTES = [
    ['#0D0D0D', '#641B36'],
    ['#131316', '#3d1f2d'],
    ['#0f1114', '#493c28'],
    ['#171315', '#6b3147'],
    ['#101011', '#31262a'],
    ['#0D0D0D', '#7b2445']
  ];

  const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
  const deepClone = (value) => JSON.parse(JSON.stringify(value));

  function defaultScenes() {
    return [
      scene('Le libertinage évolue', 'Un ruban bordeaux se déploie et dessine le V Zwit sur fond noir profond.', 'Le libertinage évolue.', 4, 'Silk Reveal', 'Créer l’arrêt visuel et installer la marque.'),
      scene('Des rencontres qui ont du sens', 'Capture premium de la recherche membres, profils vérifiés et filtres de proximité.', 'Des rencontres de qualité.', 8, 'Glass Morph', 'Montrer la qualité de la communauté.'),
      scene('Tout un univers à proximité', 'Carte Zwit, établissements, événements et agenda autour de Lille et de la Belgique.', 'Des lieux. Des événements. Une communauté.', 8, 'Champagne Glow', 'Présenter l’écosystème complet.'),
      scene('La confiance intégrée', 'Messagerie, albums privés temporaires, Pacte Zwit et décisions de consentement.', 'Confiance. Discrétion. Consentement.', 9, 'Zwit Fade', 'Rassurer et différencier Velvet.'),
      scene('Zwit Pro', 'Un responsable de club crée une soirée, suit les inscriptions et pilote son remplissage.', 'Organiser. Remplir. Fidéliser.', 9, 'Glass Morph', 'Mettre en valeur la dimension business.'),
      scene('Signature', 'Le logo Zwit apparaît avec le ruban, une lumière champagne et la signature officielle.', 'Là où les plus belles rencontres commencent.', 7, 'Zwit Blur', 'Conclure avec une empreinte mémorable.')
    ];
  }

  function scene(title, visual, text, duration, transition, objective) {
    const index = Math.floor(Math.random() * SCENE_PALETTES.length);
    return {
      id: uid('scene'),
      title,
      visual,
      text,
      duration,
      transition,
      objective,
      prompt: `${visual} Style Zwit premium, lumière chaude, mouvements fluides, aucun contenu explicite, personnes fictives majeures uniquement.`,
      notes: 'Privilégier la véritable interface Zwit et des mouvements sobres.',
      voice: '',
      palette: SCENE_PALETTES[index]
    };
  }

  function seedProject() {
    return {
      id: uid('project'),
      title: 'Film manifeste Zwit — Réseaux sociaux',
      status: 'draft',
      channel: 'Instagram / TikTok',
      format: '9:16',
      audience: 'Couples, femmes seules et professionnels du secteur',
      objective: 'Présenter Zwit comme la nouvelle référence premium des rencontres libres et de l’écosystème événementiel.',
      prompt: 'Crée une publicité sociale verticale qui démontre que Zwit ne se limite pas à une liste de profils : Zwit réunit rencontres, confiance, établissements, événements et outils professionnels dans une seule expérience premium.',
      voiceOver: 'Pendant des années, les rencontres se sont limitées à des profils et des messages. Zwit réunit enfin les personnes, les lieux et les expériences dans un même écosystème pensé autour de la confiance, de la discrétion et du consentement. Velvet. Là où les plus belles rencontres commencent.',
      music: {
        genre: 'Cinématographique premium',
        tempo: 92,
        instruments: 'Piano feutré, basse chaleureuse, texture de soie, cloche cristalline',
        emotion: 'Élégance, désir, confiance',
        intensity: 58
      },
      voice: {
        gender: 'Féminine',
        accent: 'Français neutre',
        tone: 'Chaleureuse et assurée',
        pace: 0.95
      },
      scenes: defaultScenes(),
      assets: defaultAssets(),
      versions: [],
      agentLog: [
        { at: new Date().toISOString(), agent: 'director', text: 'Projet initial prêt. Le storyboard peut être affiné.' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function defaultAssets() {
    return [
      { id: uid('asset'), name: 'Logo Zwit Or', type: 'Logo', source: 'brand', preview: 'V', meta: 'SVG officiel · Or Champagne' },
      { id: uid('asset'), name: 'Ruban Zwit', type: 'Motion', source: 'brand', preview: '〰', meta: 'Transition Silk Reveal' },
      { id: uid('asset'), name: 'Recherche membres', type: 'Capture', source: 'product', preview: '⌕', meta: 'Interface Web · 9:16' },
      { id: uid('asset'), name: 'Carte & établissements', type: 'Capture', source: 'product', preview: '⌖', meta: 'Interface Web · 9:16' },
      { id: uid('asset'), name: 'Zwit Pro', type: 'Capture', source: 'product', preview: 'PRO', meta: 'Cockpit professionnel' },
      { id: uid('asset'), name: 'Identité sonore', type: 'Audio', source: 'brand', preview: '♫', meta: '2,5 secondes · brouillon' }
    ];
  }

  function normalizeProject(project) {
    const base = seedProject();
    return {
      ...base,
      ...project,
      music: { ...base.music, ...(project.music || {}) },
      voice: { ...base.voice, ...(project.voice || {}) },
      scenes: Array.isArray(project.scenes) && project.scenes.length ? project.scenes : base.scenes,
      assets: Array.isArray(project.assets) ? project.assets : base.assets,
      versions: Array.isArray(project.versions) ? project.versions : [],
      agentLog: Array.isArray(project.agentLog) ? project.agentLog : []
    };
  }

  function loadProjects() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(stored) && stored.length) return stored.map(normalizeProject);
    } catch {}
    const initial = seedProject();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([initial]));
    localStorage.setItem(ACTIVE_KEY, initial.id);
    return [initial];
  }

  const state = {
    projects: loadProjects(),
    activeProjectId: localStorage.getItem(ACTIVE_KEY),
    selectedSceneId: null,
    screen: 'projects',
    inspector: 'storyboard',
    playing: false,
    playhead: 0,
    timer: null,
    captureStream: null,
    recorder: null,
    recordedChunks: [],
    generationRunning: false,
    agentState: Object.fromEntries(AGENTS.map(([id]) => [id, { status: 'idle', progress: 0, detail: 'En attente du brief.' }]))
  };

  if (!state.projects.some((project) => project.id === state.activeProjectId)) {
    state.activeProjectId = state.projects[0]?.id || null;
  }

  function project() {
    return state.projects.find((item) => item.id === state.activeProjectId) || state.projects[0];
  }

  function selectedScene() {
    const current = project();
    if (!current) return null;
    const selected = current.scenes.find((item) => item.id === state.selectedSceneId);
    return selected || current.scenes[0] || null;
  }

  function projectDuration(current = project()) {
    return (current?.scenes || []).reduce((sum, item) => sum + Number(item.duration || 0), 0);
  }

  function formatTime(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    const mins = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    const tenths = Math.floor((value % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  }

  function persist() {
    const current = project();
    if (current) current.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.projects));
    localStorage.setItem(ACTIVE_KEY, state.activeProjectId || '');
  }

  function snapshot(label = 'Sauvegarde manuelle') {
    const current = project();
    if (!current) return;
    const copy = deepClone(current);
    delete copy.versions;
    current.versions.unshift({ id: uid('version'), label, at: new Date().toISOString(), snapshot: copy });
    current.versions = current.versions.slice(0, MAX_VERSIONS);
    persist();
    toast('Version enregistrée');
    render();
  }

  function restoreVersion(versionId) {
    const current = project();
    const version = current?.versions.find((item) => item.id === versionId);
    if (!current || !version) return;
    const preservedVersions = current.versions;
    Object.assign(current, deepClone(version.snapshot), { versions: preservedVersions, updatedAt: new Date().toISOString() });
    state.selectedSceneId = current.scenes[0]?.id || null;
    persist();
    toast('Version restaurée');
    render();
  }

  function toast(message, tone = 'ok') {
    let node = document.querySelector('#vs1Toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vs1Toast';
      document.body.appendChild(node);
    }
    node.className = `vs1-toast ${tone}`;
    node.textContent = message;
    requestAnimationFrame(() => node.classList.add('show'));
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 2400);
  }

  function agentName(id) {
    return AGENTS.find(([agentId]) => agentId === id)?.[1] || id;
  }

  function logAgent(id, text) {
    const current = project();
    if (!current) return;
    current.agentLog.unshift({ at: new Date().toISOString(), agent: id, text });
    current.agentLog = current.agentLog.slice(0, 50);
  }

  function setAgent(id, status, progress, detail, shouldLog = false) {
    state.agentState[id] = { status, progress, detail };
    if (shouldLog) logAgent(id, detail);
    updateAgentDom(id);
  }

  function updateAgentDom(id) {
    const info = state.agentState[id];
    const card = root.querySelector(`[data-agent-card="${id}"]`);
    if (!card || !info) return;
    card.dataset.status = info.status;
    card.querySelector('[data-agent-detail]').textContent = info.detail;
    card.querySelector('[data-agent-progress]').style.width = `${info.progress}%`;
    card.querySelector('[data-agent-status]').textContent = ({ idle: 'En attente', working: 'Travaille', done: 'Terminé', error: 'Erreur' })[info.status] || info.status;
  }

  async function runGeneration() {
    if (state.generationRunning) return;
    const current = project();
    if (!current) return;
    state.generationRunning = true;
    snapshot('Avant génération IA');
    const steps = [
      ['writer', 'Analyse du prompt et construction de la promesse centrale.', 500],
      ['director', 'Découpage du film, rythme et intention de chaque plan.', 650],
      ['storyboard', 'Création du storyboard et estimation des durées.', 650],
      ['motion', 'Sélection des transitions et mouvements de caméra.', 500],
      ['voice', 'Réécriture de la voix off pour la durée cible.', 550],
      ['composer', 'Conception de la direction musicale et de l’intensité.', 550],
      ['editor', 'Synchronisation de la timeline image, texte, voix et musique.', 650],
      ['community', 'Adaptation du hook et du rythme au canal sélectionné.', 450]
    ];

    for (const [id] of AGENTS) setAgent(id, 'idle', 0, 'En attente du brief.');

    let generated = null;
    try {
      const response = await fetch('/api/control/studio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_prompt',
          brief: {
            audience: current.audience,
            objective: current.objective,
            feature: current.prompt,
            channel: current.channel,
            format: current.format,
            tone: 'premium'
          }
        })
      });
      if (response.ok) generated = (await response.json()).prompt;
    } catch {}

    for (const [id, detail, delay] of steps) {
      setAgent(id, 'working', 18, detail, true);
      await wait(delay / 2);
      setAgent(id, 'working', 64, detail);
      await wait(delay / 2);
      setAgent(id, 'done', 100, detail.replace(/\.$/, '') + ' terminé.', true);
    }

    if (generated?.scenes?.length) {
      current.title = generated.title || current.title;
      current.voiceOver = generated.voiceOver || current.voiceOver;
      current.scenes = generated.scenes.map((item, index) => {
        const seconds = String(item.seconds || '');
        const match = seconds.match(/(\d+)\D+(\d+)/);
        const duration = match ? Math.max(2, Number(match[2]) - Number(match[1])) : 6;
        const next = scene(
          item.message || `Scène ${index + 1}`,
          item.visual || 'Plan Zwit premium',
          item.message || '',
          duration,
          ['Silk Reveal', 'Glass Morph', 'Champagne Glow', 'Zwit Fade'][index % 4],
          'Servir la promesse centrale de la campagne.'
        );
        next.voice = item.message || '';
        return next;
      });
    } else {
      current.scenes = buildScenesFromPrompt(current);
      current.voiceOver = buildVoiceOver(current);
    }

    current.status = 'production';
    state.selectedSceneId = current.scenes[0]?.id || null;
    state.playhead = 0;
    state.generationRunning = false;
    persist();
    toast('Storyboard et timeline générés');
    render();
  }

  function buildScenesFromPrompt(current) {
    const channel = current.channel || 'Instagram';
    return [
      scene('Hook', `Ouverture très courte pensée pour ${channel}. Ruban Zwit, contraste noir et or, mouvement immédiat.`, 'Le libertinage évolue.', 4, 'Silk Reveal', 'Stopper le défilement.'),
      scene('Problème', 'Évoquer les plateformes classiques : profils, messages dispersés et manque de confiance, sans citer de concurrent.', 'Plus qu’une liste de profils.', 6, 'Zwit Fade', 'Créer la tension narrative.'),
      scene('Solution Zwit', 'Montrer la recherche, les profils, l’indice de confiance et la carte dans la véritable interface.', 'Une expérience pensée autour de la confiance.', 9, 'Glass Morph', 'Démontrer la valeur membre.'),
      scene('Événements & lieux', 'Enchaîner agenda, établissements et sorties à proximité.', 'Les personnes. Les lieux. Les expériences.', 8, 'Champagne Glow', 'Présenter l’écosystème.'),
      scene('Zwit Pro', 'Afficher la création d’événement, le suivi des inscriptions et le cockpit de pilotage.', 'Zwit accompagne aussi ceux qui créent les expériences.', 9, 'Glass Morph', 'Prouver la double proposition de valeur.'),
      scene('Signature', 'Logo Zwit, ruban, lumière champagne et appel à découvrir la plateforme.', 'Là où les plus belles rencontres commencent.', 7, 'Zwit Blur', 'Mémorisation et conversion.')
    ];
  }

  function buildVoiceOver(current) {
    return `Le libertinage évolue. ${current.objective} Zwit réunit les personnes, les établissements et les événements dans une expérience pensée autour de la confiance, de la discrétion et du consentement. Velvet. Là où les plus belles rencontres commencent.`;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function sceneAtTime(time) {
    const current = project();
    let cursor = 0;
    for (const item of current?.scenes || []) {
      const end = cursor + Number(item.duration || 0);
      if (time < end) return item;
      cursor = end;
    }
    return current?.scenes?.at(-1) || null;
  }

  function startPlayback() {
    const duration = projectDuration();
    if (!duration) return;
    if (state.playhead >= duration) state.playhead = 0;
    state.playing = true;
    clearInterval(state.timer);
    let previous = performance.now();
    state.timer = setInterval(() => {
      const now = performance.now();
      state.playhead += (now - previous) / 1000;
      previous = now;
      if (state.playhead >= duration) {
        state.playhead = duration;
        stopPlayback();
      }
      const active = sceneAtTime(state.playhead);
      if (active && active.id !== state.selectedSceneId) state.selectedSceneId = active.id;
      updatePlaybackDom();
    }, 80);
    updatePlaybackDom();
  }

  function stopPlayback() {
    state.playing = false;
    clearInterval(state.timer);
    state.timer = null;
    updatePlaybackDom();
  }

  function togglePlayback() {
    state.playing ? stopPlayback() : startPlayback();
  }

  function seekToScene(sceneId) {
    const current = project();
    let cursor = 0;
    for (const item of current?.scenes || []) {
      if (item.id === sceneId) break;
      cursor += Number(item.duration || 0);
    }
    state.playhead = cursor;
    state.selectedSceneId = sceneId;
    renderEditorBody();
  }

  function updatePlaybackDom() {
    const duration = projectDuration();
    const active = sceneAtTime(state.playhead) || selectedScene();
    const percent = duration ? clamp((state.playhead / duration) * 100, 0, 100) : 0;
    root.querySelectorAll('[data-playhead]').forEach((node) => { node.style.left = `${percent}%`; });
    root.querySelectorAll('[data-current-time]').forEach((node) => { node.textContent = formatTime(state.playhead); });
    root.querySelectorAll('[data-total-time]').forEach((node) => { node.textContent = formatTime(duration); });
    const playButton = root.querySelector('[data-action="play"]');
    if (playButton) playButton.innerHTML = state.playing ? '❚❚' : '▶';
    const preview = root.querySelector('[data-preview-scene]');
    if (preview && active && !state.captureStream) preview.innerHTML = previewSceneMarkup(active, currentSceneProgress(active));
    root.querySelectorAll('[data-timeline-scene]').forEach((node) => node.classList.toggle('active', node.dataset.timelineScene === active?.id));
  }

  function currentSceneProgress(active) {
    const current = project();
    let start = 0;
    for (const item of current?.scenes || []) {
      if (item.id === active.id) break;
      start += Number(item.duration || 0);
    }
    return clamp((state.playhead - start) / Math.max(0.1, Number(active.duration || 1)), 0, 1);
  }

  async function startCapture(kind) {
    stopCapture();
    try {
      const stream = kind === 'camera'
        ? await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      state.captureStream = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', stopCapture);
      renderEditorBody();
      const video = root.querySelector('[data-live-video]');
      if (video) video.srcObject = stream;
      toast(kind === 'camera' ? 'Caméra connectée' : 'Capture écran connectée');
    } catch (error) {
      toast(error?.message || 'Capture refusée', 'error');
    }
  }

  function stopCapture() {
    if (state.recorder?.state === 'recording') state.recorder.stop();
    state.captureStream?.getTracks().forEach((track) => track.stop());
    state.captureStream = null;
    state.recorder = null;
    state.recordedChunks = [];
    const current = root.querySelector('[data-live-video]');
    if (current) current.srcObject = null;
  }

  function toggleRecording() {
    if (!state.captureStream || typeof MediaRecorder === 'undefined') {
      toast('Lance d’abord une capture écran ou caméra', 'error');
      return;
    }
    if (state.recorder?.state === 'recording') {
      state.recorder.stop();
      return;
    }
    state.recordedChunks = [];
    const mimeType = supportedMimeType();
    const recorder = mimeType ? new MediaRecorder(state.captureStream, { mimeType }) : new MediaRecorder(state.captureStream);
    state.recorder = recorder;
    recorder.ondataavailable = (event) => { if (event.data?.size) state.recordedChunks.push(event.data); };
    recorder.onstop = () => {
      if (!state.recordedChunks.length) return;
      const blob = new Blob(state.recordedChunks, { type: recorder.mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const current = project();
      current.assets.unshift({ id: uid('asset'), name: `Plan enregistré ${new Date().toLocaleTimeString('fr-FR')}`, type: 'Vidéo', source: 'capture', preview: '▶', meta: `${Math.round(blob.size / 1024)} Ko · session courante`, url, volatile: true });
      logAgent('director', 'Un plan live a été enregistré et ajouté à la bibliothèque.');
      persist();
      toast('Plan ajouté à la bibliothèque');
      renderEditorBody();
    };
    recorder.start(250);
    toast('Enregistrement du plan démarré');
    renderEditorBody();
  }

  function supportedMimeType() {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  function speakVoiceOver() {
    const current = project();
    if (!('speechSynthesis' in window)) {
      toast('Synthèse vocale indisponible sur ce navigateur', 'error');
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.voiceOver || '');
    utterance.lang = 'fr-FR';
    utterance.rate = Number(current.voice.pace || 1);
    utterance.pitch = current.voice.gender === 'Féminine' ? 1.08 : 0.92;
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find((voice) => voice.lang.startsWith('fr') && (current.voice.gender === 'Féminine' ? /female|audrey|amélie|marie/i.test(voice.name) : /male|thomas|paul/i.test(voice.name))) || voices.find((voice) => voice.lang.startsWith('fr'));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setAgent('voice', 'working', 55, 'Lecture de la voix off dans le studio.');
    utterance.onend = () => setAgent('voice', 'done', 100, 'Aperçu de la voix off terminé.', true);
    speechSynthesis.speak(utterance);
  }

  function previewMusic() {
    const current = project();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      toast('Audio Web indisponible', 'error');
      return;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.12);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);
    master.connect(ctx.destination);
    const base = current.music.tempo >= 100 ? 220 : 196;
    [1, 1.25, 1.5].forEach((ratio, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.value = base * ratio;
      gain.gain.value = 0.22 / (index + 1);
      osc.connect(gain).connect(master);
      osc.start(ctx.currentTime + index * 0.08);
      osc.stop(ctx.currentTime + 3.3);
    });
    setAgent('composer', 'working', 70, 'Lecture de la maquette musicale procédurale.');
    setTimeout(() => setAgent('composer', 'done', 100, 'Maquette musicale prête à être générée par un moteur audio.', true), 3300);
  }

  function addUploadedAsset(file) {
    if (!file) return;
    if (file.size > MAX_ASSET_BYTES) {
      toast('Pour le prototype, limite l’asset à 1,5 Mo', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const current = project();
      current.assets.unshift({
        id: uid('asset'),
        name: file.name,
        type: file.type.startsWith('image/') ? 'Image' : file.type.startsWith('audio/') ? 'Audio' : file.type.startsWith('video/') ? 'Vidéo' : 'Fichier',
        source: 'upload',
        preview: file.type.startsWith('image/') ? reader.result : file.type.startsWith('audio/') ? '♫' : '▶',
        dataUrl: reader.result,
        meta: `${Math.round(file.size / 1024)} Ko · import local`
      });
      persist();
      toast('Asset ajouté');
      renderEditorBody();
    };
    reader.readAsDataURL(file);
  }

  function createNewProject() {
    const next = seedProject();
    next.title = 'Nouveau projet Zwit';
    next.scenes = [scene('Nouvelle scène', 'Décris ici le premier plan de la campagne.', 'Votre message', 6, 'Zwit Fade', 'Définir le hook.')];
    next.versions = [];
    state.projects.unshift(next);
    state.activeProjectId = next.id;
    state.selectedSceneId = next.scenes[0].id;
    state.screen = 'editor';
    persist();
    render();
  }

  function duplicateProject(id) {
    const source = state.projects.find((item) => item.id === id);
    if (!source) return;
    const next = deepClone(source);
    next.id = uid('project');
    next.title = `${source.title} — Copie`;
    next.scenes = next.scenes.map((item) => ({ ...item, id: uid('scene') }));
    next.versions = [];
    next.createdAt = new Date().toISOString();
    next.updatedAt = next.createdAt;
    state.projects.unshift(next);
    persist();
    render();
  }

  function deleteProject(id) {
    if (state.projects.length <= 1) {
      toast('Zwit Studio doit conserver au moins un projet', 'error');
      return;
    }
    state.projects = state.projects.filter((item) => item.id !== id);
    if (state.activeProjectId === id) state.activeProjectId = state.projects[0].id;
    persist();
    render();
  }

  function openProject(id) {
    state.activeProjectId = id;
    state.selectedSceneId = project()?.scenes?.[0]?.id || null;
    state.screen = 'editor';
    state.playhead = 0;
    persist();
    render();
  }

  function moveScene(sceneId, direction) {
    const current = project();
    const index = current.scenes.findIndex((item) => item.id === sceneId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.scenes.length) return;
    [current.scenes[index], current.scenes[target]] = [current.scenes[target], current.scenes[index]];
    persist();
    renderEditorBody();
  }

  function duplicateScene(sceneId) {
    const current = project();
    const index = current.scenes.findIndex((item) => item.id === sceneId);
    if (index < 0) return;
    const copy = { ...deepClone(current.scenes[index]), id: uid('scene'), title: `${current.scenes[index].title} — Copie` };
    current.scenes.splice(index + 1, 0, copy);
    state.selectedSceneId = copy.id;
    persist();
    renderEditorBody();
  }

  function deleteScene(sceneId) {
    const current = project();
    if (current.scenes.length <= 1) {
      toast('Un projet doit contenir au moins une scène', 'error');
      return;
    }
    current.scenes = current.scenes.filter((item) => item.id !== sceneId);
    state.selectedSceneId = current.scenes[0].id;
    persist();
    renderEditorBody();
  }

  function addScene() {
    const current = project();
    const next = scene('Nouvelle scène', 'Décris le plan ou sélectionne un asset Velvet.', 'Nouveau message', 6, 'Zwit Fade', 'Compléter la narration.');
    current.scenes.push(next);
    state.selectedSceneId = next.id;
    persist();
    renderEditorBody();
  }

  function exportProject() {
    const current = project();
    const payload = deepClone(current);
    payload.assets = payload.assets.map(({ dataUrl, url, ...asset }) => asset);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${current.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'velvet-studio'}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function returnToControl() {
    stopPlayback();
    stopCapture();
    location.reload();
  }

  function installNavigation() {
    document.querySelectorAll('[data-velvet-studio-nav],[data-velvet-studio-bootstrap]').forEach((node) => node.remove());
    const existing = document.querySelector('[data-velvet-studio-sprint1-nav]');
    if (existing) return;
    const candidates = [...document.querySelectorAll('button')];
    const communications = candidates.find((button) => /communications/i.test(button.textContent || ''));
    const nav = communications?.parentElement || document.querySelector('.control-nav') || document.querySelector('nav');
    if (!nav) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.velvetStudioSprint1Nav = 'true';
    button.className = communications?.className || '';
    button.innerHTML = '<span aria-hidden="true">✦</span><span>Zwit Studio</span>';
    button.addEventListener('click', () => {
      state.screen = 'projects';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    communications ? communications.insertAdjacentElement('afterend', button) : nav.appendChild(button);
  }

  function injectStylesheet() {
    if (document.querySelector('link[data-velvet-studio-sprint1-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/velvet-studio-sprint1.css?v=20260804-1';
    link.dataset.velvetStudioSprint1Style = 'true';
    document.head.appendChild(link);
  }

  function render() {
    injectStylesheet();
    stopPlayback();
    root.classList.add('vs1-host');
    root.innerHTML = state.screen === 'editor' ? editorMarkup() : projectsMarkup();
    bindCommon();
    if (state.screen === 'editor') bindEditor();
    else bindProjects();
    AGENTS.forEach(([id]) => updateAgentDom(id));
  }

  function projectsMarkup() {
    const count = state.projects.length;
    const production = state.projects.filter((item) => item.status === 'production').length;
    const ready = state.projects.filter((item) => item.status === 'ready').length;
    return `<section class="vs1-shell vs1-projects">
      ${topBar('Projets', 'Agence marketing IA intégrée à Zwit', '<button class="vs1-btn primary" data-action="new-project">+ Nouveau projet</button>')}
      <main class="vs1-project-main">
        <section class="vs1-hero-card">
          <div><span class="vs1-kicker">Sprint 1 · Studio de production</span><h1>Conçois, dirige et monte les campagnes Velvet.</h1><p>Prompt principal, visionneuse temps réel, storyboard éditable, timeline multipiste, agents IA, voix off, musique, assets et historique de versions.</p></div>
          <button class="vs1-btn primary large" data-action="new-project">Créer une campagne</button>
        </section>
        <div class="vs1-metrics">
          ${metricCard('Projets', count, 'dans le studio')}
          ${metricCard('En production', production, 'storyboards actifs')}
          ${metricCard('Prêts', ready, 'validés pour export')}
          ${metricCard('Moteurs payants', '0', 'gratuit-first actif')}
        </div>
        <div class="vs1-section-head"><div><span class="vs1-kicker">Bibliothèque de projets</span><h2>Campagnes Zwit</h2></div></div>
        <div class="vs1-project-grid">${state.projects.map(projectCard).join('')}</div>
      </main>
    </section>`;
  }

  function topBar(section, subtitle, actions = '') {
    return `<header class="vs1-topbar"><div class="vs1-brand"><span class="vs1-brand-mark">V</span><div><strong>Zwit Studio</strong><small>${esc(section)} · ${esc(subtitle)}</small></div></div><div class="vs1-top-actions">${actions}<button class="vs1-btn ghost" data-action="return-control">Retour à Control</button></div></header>`;
  }

  function metricCard(label, value, copy) {
    return `<article class="vs1-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(copy)}</small></article>`;
  }

  function projectCard(item) {
    const duration = projectDuration(item);
    return `<article class="vs1-project-card" data-project-card="${item.id}">
      <div class="vs1-project-poster"><div class="vs1-poster-ribbon"></div><span>${esc(item.format)}</span><strong>ZWIT</strong><small>${esc(item.channel)}</small></div>
      <div class="vs1-project-copy"><div class="vs1-project-meta"><span class="vs1-status ${esc(item.status)}">${statusLabel(item.status)}</span><span>${formatTime(duration)}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.objective)}</p><small>Mis à jour ${new Date(item.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small></div>
      <div class="vs1-project-actions"><button class="vs1-btn primary" data-open-project="${item.id}">Ouvrir</button><button class="vs1-icon-btn" title="Dupliquer" data-duplicate-project="${item.id}">⧉</button><button class="vs1-icon-btn danger" title="Supprimer" data-delete-project="${item.id}">×</button></div>
    </article>`;
  }

  function statusLabel(status) {
    return ({ draft: 'Brouillon', production: 'Production', ready: 'Prêt', archived: 'Archivé' })[status] || status;
  }

  function editorMarkup() {
    const current = project();
    if (!current) return projectsMarkup();
    const duration = projectDuration(current);
    return `<section class="vs1-shell vs1-editor-shell">
      ${topBar('Éditeur', current.title, `<button class="vs1-btn ghost" data-action="projects">Tous les projets</button><button class="vs1-btn ghost" data-action="save-version">Sauver une version</button><button class="vs1-btn primary" data-action="export">Exporter</button>`)}
      <div class="vs1-editor-toolbar">
        <div class="vs1-project-title"><input data-project-field="title" value="${esc(current.title)}" aria-label="Titre du projet"><span class="vs1-status ${esc(current.status)}">${statusLabel(current.status)}</span></div>
        <div class="vs1-transport"><button class="vs1-transport-btn" data-action="previous-scene">◀</button><button class="vs1-play-btn" data-action="play">▶</button><button class="vs1-transport-btn" data-action="next-scene">▶</button><span><b data-current-time>${formatTime(state.playhead)}</b> / <span data-total-time>${formatTime(duration)}</span></span></div>
        <div class="vs1-editor-actions"><button class="vs1-btn ghost" data-action="capture-screen">Capturer écran</button><button class="vs1-btn ghost" data-action="capture-camera">Caméra</button><button class="vs1-btn ${state.recorder?.state === 'recording' ? 'danger' : 'ghost'}" data-action="record">${state.recorder?.state === 'recording' ? '■ Arrêter' : '● Enregistrer'}</button></div>
      </div>
      <main class="vs1-workspace">
        <aside class="vs1-left-panel">
          ${leftPanelMarkup(current)}
        </aside>
        <section class="vs1-stage-column">
          ${stageMarkup(current)}
          ${timelineMarkup(current)}
        </section>
        <aside class="vs1-right-panel">
          ${rightPanelMarkup(current)}
        </aside>
      </main>
      <input type="file" hidden data-asset-upload accept="image/*,video/*,audio/*,.svg">
    </section>`;
  }

  function leftPanelMarkup(current) {
    const tabs = [['storyboard', 'Storyboard'], ['agents', 'Agents IA'], ['assets', 'Assets'], ['versions', 'Versions']];
    return `<div class="vs1-panel-tabs">${tabs.map(([id, label]) => `<button class="${state.inspector === id ? 'active' : ''}" data-inspector="${id}">${label}</button>`).join('')}</div><div class="vs1-panel-body">${leftPanelBody(current)}</div>`;
  }

  function leftPanelBody(current) {
    if (state.inspector === 'agents') return agentsMarkup(current);
    if (state.inspector === 'assets') return assetsMarkup(current);
    if (state.inspector === 'versions') return versionsMarkup(current);
    return storyboardMarkup(current);
  }

  function storyboardMarkup(current) {
    return `<div class="vs1-panel-heading"><div><span class="vs1-kicker">Storyboard vivant</span><h3>${current.scenes.length} scènes</h3></div><button class="vs1-icon-btn" data-action="add-scene">+</button></div><div class="vs1-story-list">${current.scenes.map((item, index) => storyboardCard(item, index)).join('')}</div>`;
  }

  function storyboardCard(item, index) {
    return `<article class="vs1-story-card ${selectedScene()?.id === item.id ? 'active' : ''}" data-select-scene="${item.id}" draggable="true" data-drag-scene="${item.id}"><div class="vs1-story-thumb" style="--p1:${esc(item.palette?.[0] || '#0D0D0D')};--p2:${esc(item.palette?.[1] || '#641B36')}"><span>${index + 1}</span><b>${esc(item.text || 'ZWIT')}</b></div><div><strong>${esc(item.title)}</strong><p>${esc(item.visual)}</p><small>${Number(item.duration || 0)} s · ${esc(item.transition)}</small></div></article>`;
  }

  function agentsMarkup(current) {
    return `<div class="vs1-panel-heading"><div><span class="vs1-kicker">Équipe créative IA</span><h3>8 agents spécialisés</h3></div><button class="vs1-icon-btn" data-action="run-generation">↻</button></div><div class="vs1-agent-list">${AGENTS.map(([id, name, role]) => {
      const info = state.agentState[id];
      return `<article class="vs1-agent-card" data-agent-card="${id}" data-status="${info.status}"><div class="vs1-agent-avatar">${esc(name.split(' ')[0][0])}</div><div class="vs1-agent-copy"><div><strong>${esc(name)}</strong><span data-agent-status>En attente</span></div><small>${esc(role)}</small><p data-agent-detail>${esc(info.detail)}</p><div class="vs1-agent-bar"><i data-agent-progress style="width:${info.progress}%"></i></div></div></article>`;
    }).join('')}</div><div class="vs1-agent-log"><h4>Journal d’activité</h4>${current.agentLog.slice(0, 8).map((entry) => `<p><span>${esc(agentName(entry.agent))}</span>${esc(entry.text)}</p>`).join('') || '<p>Aucune activité pour le moment.</p>'}</div>`;
  }

  function assetsMarkup(current) {
    return `<div class="vs1-panel-heading"><div><span class="vs1-kicker">Bibliothèque</span><h3>Assets Zwit</h3></div><button class="vs1-icon-btn" data-action="upload-asset">+</button></div><div class="vs1-asset-grid">${current.assets.map((asset) => `<article class="vs1-asset-card" data-asset="${asset.id}"><div class="vs1-asset-preview">${asset.dataUrl && /^data:image/.test(asset.dataUrl) ? `<img src="${asset.dataUrl}" alt="">` : asset.url && asset.type === 'Vidéo' ? `<video src="${asset.url}" muted></video>` : `<span>${esc(asset.preview || '◆')}</span>`}</div><strong>${esc(asset.name)}</strong><small>${esc(asset.type)} · ${esc(asset.meta || '')}</small></article>`).join('')}</div>`;
  }

  function versionsMarkup(current) {
    return `<div class="vs1-panel-heading"><div><span class="vs1-kicker">Historique</span><h3>${current.versions.length} versions</h3></div><button class="vs1-icon-btn" data-action="save-version">+</button></div><div class="vs1-version-list">${current.versions.map((version, index) => `<article><div><strong>V${current.versions.length - index} · ${esc(version.label)}</strong><small>${new Date(version.at).toLocaleString('fr-FR')}</small></div><button class="vs1-btn ghost small" data-restore-version="${version.id}">Restaurer</button></article>`).join('') || '<div class="vs1-empty">Sauvegarde une première version pour pouvoir revenir en arrière.</div>'}</div>`;
  }

  function stageMarkup(current) {
    const item = selectedScene();
    const aspect = current.format === '16:9' ? 'wide' : current.format === '1:1' ? 'square' : 'vertical';
    return `<section class="vs1-stage-card"><div class="vs1-stage-head"><div><span class="vs1-live-dot"></span><strong>Moniteur réalisateur</strong><small>${esc(current.format)} · ${esc(current.channel)}</small></div><div><button class="vs1-icon-btn" data-action="stop-capture" title="Arrêter la capture">■</button><button class="vs1-icon-btn" data-action="fullscreen-preview" title="Plein écran">⛶</button></div></div><div class="vs1-preview-wrap"><div class="vs1-preview ${aspect}" data-preview-frame>${state.captureStream ? '<video data-live-video autoplay muted playsinline></video><span class="vs1-live-label">LIVE</span>' : `<div class="vs1-preview-scene" data-preview-scene>${previewSceneMarkup(item, 0)}</div>`}</div></div><div class="vs1-stage-footer"><div><span>Scène sélectionnée</span><strong>${esc(item?.title || 'Aucune')}</strong></div><div class="vs1-stage-progress"><i data-playhead style="left:${projectDuration() ? (state.playhead / projectDuration()) * 100 : 0}%"></i></div><small>${esc(item?.transition || '')}</small></div></section>`;
  }

  function previewSceneMarkup(item, progress = 0) {
    if (!item) return '<div class="vs1-preview-empty">Ajoute une scène au storyboard.</div>';
    const p1 = item.palette?.[0] || '#0D0D0D';
    const p2 = item.palette?.[1] || '#641B36';
    const shift = Math.round(progress * 22);
    return `<div class="vs1-scene-canvas" style="--scene-a:${esc(p1)};--scene-b:${esc(p2)};--scene-shift:${shift}px"><div class="vs1-scene-glow"></div><div class="vs1-scene-ribbon"></div><div class="vs1-mock-device"><div class="vs1-device-top"><span></span><b>ZWIT</b><i></i></div><div class="vs1-device-body"><div class="vs1-device-card"></div><div class="vs1-device-lines"><i></i><i></i><i></i></div><div class="vs1-device-pills"><span></span><span></span><span></span></div></div></div><div class="vs1-scene-copy"><span>ZWIT</span><h2>${esc(item.text || item.title)}</h2><p>${esc(item.visual)}</p></div></div>`;
  }

  function timelineMarkup(current) {
    const duration = Math.max(1, projectDuration(current));
    const blocks = current.scenes.map((item, index) => {
      const width = Math.max(7, (Number(item.duration || 0) / duration) * 100);
      return `<button class="vs1-clip ${selectedScene()?.id === item.id ? 'selected' : ''}" style="width:${width}%" data-timeline-scene="${item.id}" draggable="true" data-drag-scene="${item.id}"><span>${index + 1}</span><strong>${esc(item.title)}</strong><small>${item.duration}s</small></button>`;
    }).join('');
    const textBlocks = current.scenes.map((item) => `<div style="width:${Math.max(7, (Number(item.duration || 0) / duration) * 100)}%"><span>${esc(item.text)}</span></div>`).join('');
    const voiceBlocks = current.scenes.map((item, index) => `<div style="width:${Math.max(7, (Number(item.duration || 0) / duration) * 100)}%">${waveform(14, index + 2)}</div>`).join('');
    return `<section class="vs1-timeline"><div class="vs1-timeline-head"><div><strong>Timeline</strong><span>${current.scenes.length} scènes · ${formatTime(duration)}</span></div><div><button class="vs1-icon-btn" data-action="zoom-out">−</button><span>100 %</span><button class="vs1-icon-btn" data-action="zoom-in">+</button></div></div><div class="vs1-timeline-scroll"><div class="vs1-time-ruler">${Array.from({ length: 10 }, (_, index) => `<span>${formatTime((duration / 9) * index)}</span>`).join('')}</div><div class="vs1-tracks"><div class="vs1-track-labels"><span>VIDÉO</span><span>TEXTE</span><span>VOIX</span><span>MUSIQUE</span></div><div class="vs1-track-area"><i class="vs1-playhead" data-playhead style="left:${(state.playhead / duration) * 100}%"></i><div class="vs1-track video">${blocks}</div><div class="vs1-track text">${textBlocks}</div><div class="vs1-track voice">${voiceBlocks}</div><div class="vs1-track music"><div style="width:100%"><b>${esc(current.music.genre)}</b>${waveform(64, 8)}</div></div></div></div></div></section>`;
  }

  function waveform(count = 40, seed = 1) {
    return `<span class="vs1-wave">${Array.from({ length: count }, (_, index) => `<i style="height:${18 + ((index * 17 + seed * 29) % 68)}%"></i>`).join('')}</span>`;
  }

  function rightPanelMarkup(current) {
    const item = selectedScene();
    return `<div class="vs1-inspector-head"><span class="vs1-kicker">Inspecteur</span><h3>${esc(item?.title || 'Projet')}</h3></div><div class="vs1-inspector-tabs"><button class="active" data-right-tab="scene">Scène</button><button data-right-tab="voice">Voix</button><button data-right-tab="music">Musique</button><button data-right-tab="project">Projet</button></div><div class="vs1-inspector-body" data-right-panel>${sceneInspector(item)}</div>`;
  }

  function sceneInspector(item) {
    if (!item) return '<div class="vs1-empty">Aucune scène sélectionnée.</div>';
    return `<div class="vs1-form"><label>Titre<input data-scene-field="title" value="${esc(item.title)}"></label><label>Texte à l’écran<textarea data-scene-field="text">${esc(item.text)}</textarea></label><label>Description visuelle<textarea data-scene-field="visual">${esc(item.visual)}</textarea></label><label>Prompt du plan<textarea class="tall" data-scene-field="prompt">${esc(item.prompt)}</textarea></label><div class="vs1-field-grid"><label>Durée (s)<input type="number" min="1" max="60" step="0.5" data-scene-field="duration" value="${Number(item.duration || 0)}"></label><label>Transition<select data-scene-field="transition">${['Zwit Fade', 'Silk Reveal', 'Champagne Glow', 'Glass Morph', 'Zwit Blur', 'Coupe franche'].map((option) => `<option ${item.transition === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label></div><label>Objectif<textarea data-scene-field="objective">${esc(item.objective)}</textarea></label><label>Notes IA<textarea data-scene-field="notes">${esc(item.notes)}</textarea></label><div class="vs1-inspector-actions"><button class="vs1-icon-btn" data-move-scene="-1">←</button><button class="vs1-icon-btn" data-duplicate-scene="${item.id}">⧉</button><button class="vs1-icon-btn" data-move-scene="1">→</button><button class="vs1-btn danger small" data-delete-scene="${item.id}">Supprimer</button></div></div>`;
  }

  function voiceInspector(current) {
    return `<div class="vs1-form"><label>Voix<select data-voice-field="gender"><option ${current.voice.gender === 'Féminine' ? 'selected' : ''}>Féminine</option><option ${current.voice.gender === 'Masculine' ? 'selected' : ''}>Masculine</option></select></label><label>Accent<select data-voice-field="accent"><option>Français neutre</option><option>Français chaleureux</option><option>Belge francophone</option></select></label><label>Intention<select data-voice-field="tone"><option>Chaleureuse et assurée</option><option>Intime et élégante</option><option>Business et précise</option><option>Cinématographique</option></select></label><label>Vitesse<input type="range" min="0.7" max="1.3" step="0.05" value="${Number(current.voice.pace || 1)}" data-voice-field="pace"><span>${Number(current.voice.pace || 1).toFixed(2)}×</span></label><label>Texte de la voix off<textarea class="very-tall" data-project-field="voiceOver">${esc(current.voiceOver)}</textarea></label><button class="vs1-btn primary" data-action="speak">▶ Écouter la voix off</button><p class="vs1-help">L’aperçu utilise la synthèse vocale locale du navigateur. Le moteur de voix studio sera branché au Sprint 2.</p></div>`;
  }

  function musicInspector(current) {
    return `<div class="vs1-form"><label>Direction musicale<input data-music-field="genre" value="${esc(current.music.genre)}"></label><label>Tempo<input type="number" min="50" max="180" data-music-field="tempo" value="${Number(current.music.tempo || 92)}"></label><label>Instruments<textarea data-music-field="instruments">${esc(current.music.instruments)}</textarea></label><label>Émotion<textarea data-music-field="emotion">${esc(current.music.emotion)}</textarea></label><label>Intensité<input type="range" min="0" max="100" value="${Number(current.music.intensity || 50)}" data-music-field="intensity"><span>${Number(current.music.intensity || 50)} %</span></label><div class="vs1-music-preview">${waveform(48, 9)}</div><button class="vs1-btn primary" data-action="music-preview">♫ Générer une maquette sonore</button><p class="vs1-help">Cette maquette procédurale permet de valider le tempo et l’intention. Le moteur de composition complet sera branché au Sprint 2.</p></div>`;
  }

  function projectInspector(current) {
    return `<div class="vs1-form"><label>Audience<textarea data-project-field="audience">${esc(current.audience)}</textarea></label><label>Objectif<textarea data-project-field="objective">${esc(current.objective)}</textarea></label><label>Prompt principal<textarea class="very-tall" data-project-field="prompt">${esc(current.prompt)}</textarea></label><div class="vs1-field-grid"><label>Canal<select data-project-field="channel">${['Instagram / TikTok', 'Facebook', 'YouTube Shorts', 'LinkedIn', 'Tous réseaux'].map((option) => `<option ${current.channel === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label><label>Format<select data-project-field="format">${['9:16', '1:1', '16:9'].map((option) => `<option ${current.format === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label></div><label>Statut<select data-project-field="status">${['draft', 'production', 'ready', 'archived'].map((option) => `<option value="${option}" ${current.status === option ? 'selected' : ''}>${statusLabel(option)}</option>`).join('')}</select></label><button class="vs1-btn primary" data-action="run-generation">✦ Lancer l’agence IA</button><p class="vs1-help">Le brief est envoyé au moteur Studio sécurisé lorsqu’il est configuré. Sans fournisseur externe, Zwit utilise son moteur de marque local.</p></div>`;
  }

  function bindCommon() {
    root.querySelectorAll('[data-action="return-control"]').forEach((node) => node.addEventListener('click', returnToControl));
  }

  function bindProjects() {
    root.querySelectorAll('[data-action="new-project"]').forEach((node) => node.addEventListener('click', createNewProject));
    root.querySelectorAll('[data-open-project]').forEach((node) => node.addEventListener('click', () => openProject(node.dataset.openProject)));
    root.querySelectorAll('[data-duplicate-project]').forEach((node) => node.addEventListener('click', () => duplicateProject(node.dataset.duplicateProject)));
    root.querySelectorAll('[data-delete-project]').forEach((node) => node.addEventListener('click', () => deleteProject(node.dataset.deleteProject)));
  }

  function bindEditor() {
    const current = project();
    root.querySelector('[data-action="projects"]')?.addEventListener('click', () => { state.screen = 'projects'; render(); });
    root.querySelector('[data-action="save-version"]')?.addEventListener('click', () => snapshot('Sauvegarde manuelle'));
    root.querySelector('[data-action="export"]')?.addEventListener('click', exportProject);
    root.querySelector('[data-action="play"]')?.addEventListener('click', togglePlayback);
    root.querySelector('[data-action="previous-scene"]')?.addEventListener('click', () => navigateScene(-1));
    root.querySelector('[data-action="next-scene"]')?.addEventListener('click', () => navigateScene(1));
    root.querySelector('[data-action="capture-screen"]')?.addEventListener('click', () => startCapture('screen'));
    root.querySelector('[data-action="capture-camera"]')?.addEventListener('click', () => startCapture('camera'));
    root.querySelector('[data-action="stop-capture"]')?.addEventListener('click', () => { stopCapture(); renderEditorBody(); });
    root.querySelector('[data-action="record"]')?.addEventListener('click', toggleRecording);
    root.querySelector('[data-action="fullscreen-preview"]')?.addEventListener('click', () => root.querySelector('[data-preview-frame]')?.requestFullscreen?.());
    root.querySelector('[data-action="add-scene"]')?.addEventListener('click', addScene);
    root.querySelectorAll('[data-action="run-generation"]').forEach((node) => node.addEventListener('click', runGeneration));
    root.querySelector('[data-action="upload-asset"]')?.addEventListener('click', () => root.querySelector('[data-asset-upload]')?.click());
    root.querySelector('[data-asset-upload]')?.addEventListener('change', (event) => addUploadedAsset(event.target.files?.[0]));
    root.querySelector('[data-action="speak"]')?.addEventListener('click', speakVoiceOver);
    root.querySelector('[data-action="music-preview"]')?.addEventListener('click', previewMusic);

    root.querySelectorAll('[data-inspector]').forEach((node) => node.addEventListener('click', () => { state.inspector = node.dataset.inspector; renderEditorBody(); }));
    root.querySelectorAll('[data-select-scene],[data-timeline-scene]').forEach((node) => node.addEventListener('click', () => seekToScene(node.dataset.selectScene || node.dataset.timelineScene)));
    root.querySelectorAll('[data-restore-version]').forEach((node) => node.addEventListener('click', () => restoreVersion(node.dataset.restoreVersion)));
    root.querySelectorAll('[data-project-field]').forEach((node) => node.addEventListener('input', () => updateProjectField(node)));
    root.querySelectorAll('[data-scene-field]').forEach((node) => node.addEventListener('input', () => updateSceneField(node)));
    root.querySelectorAll('[data-voice-field]').forEach((node) => node.addEventListener('input', () => updateNestedField('voice', node)));
    root.querySelectorAll('[data-music-field]').forEach((node) => node.addEventListener('input', () => updateNestedField('music', node)));
    root.querySelectorAll('[data-move-scene]').forEach((node) => node.addEventListener('click', () => moveScene(selectedScene()?.id, Number(node.dataset.moveScene))));
    root.querySelectorAll('[data-duplicate-scene]').forEach((node) => node.addEventListener('click', () => duplicateScene(node.dataset.duplicateScene)));
    root.querySelectorAll('[data-delete-scene]').forEach((node) => node.addEventListener('click', () => deleteScene(node.dataset.deleteScene)));
    root.querySelectorAll('[data-right-tab]').forEach((node) => node.addEventListener('click', () => switchRightTab(node.dataset.rightTab)));
    bindDragAndDrop();

    if (state.captureStream) {
      const video = root.querySelector('[data-live-video]');
      if (video) video.srcObject = state.captureStream;
    }
    if (!state.selectedSceneId) state.selectedSceneId = current.scenes[0]?.id || null;
    updatePlaybackDom();
  }

  function renderEditorBody() {
    if (state.screen !== 'editor') return render();
    root.innerHTML = editorMarkup();
    bindCommon();
    bindEditor();
    AGENTS.forEach(([id]) => updateAgentDom(id));
  }

  function navigateScene(direction) {
    const current = project();
    const index = current.scenes.findIndex((item) => item.id === selectedScene()?.id);
    const next = current.scenes[clamp(index + direction, 0, current.scenes.length - 1)];
    if (next) seekToScene(next.id);
  }

  function updateProjectField(node) {
    const current = project();
    const field = node.dataset.projectField;
    current[field] = node.value;
    persist();
    if (['format', 'channel', 'status'].includes(field)) renderEditorBody();
  }

  function updateSceneField(node) {
    const item = selectedScene();
    if (!item) return;
    const field = node.dataset.sceneField;
    item[field] = field === 'duration' ? clamp(Number(node.value || 1), 1, 60) : node.value;
    persist();
    if (field === 'duration' || field === 'transition') renderEditorBody();
    else updatePlaybackDom();
  }

  function updateNestedField(group, node) {
    const current = project();
    const field = node.dataset[`${group}Field`];
    current[group][field] = ['tempo', 'intensity', 'pace'].includes(field) ? Number(node.value) : node.value;
    persist();
    const next = node.nextElementSibling;
    if (next?.tagName === 'SPAN') next.textContent = field === 'pace' ? `${Number(node.value).toFixed(2)}×` : `${node.value} %`;
  }

  function switchRightTab(tab) {
    const current = project();
    const panel = root.querySelector('[data-right-panel]');
    root.querySelectorAll('[data-right-tab]').forEach((node) => node.classList.toggle('active', node.dataset.rightTab === tab));
    panel.innerHTML = tab === 'voice' ? voiceInspector(current) : tab === 'music' ? musicInspector(current) : tab === 'project' ? projectInspector(current) : sceneInspector(selectedScene());
    panel.querySelectorAll('[data-project-field]').forEach((node) => node.addEventListener('input', () => updateProjectField(node)));
    panel.querySelectorAll('[data-scene-field]').forEach((node) => node.addEventListener('input', () => updateSceneField(node)));
    panel.querySelectorAll('[data-voice-field]').forEach((node) => node.addEventListener('input', () => updateNestedField('voice', node)));
    panel.querySelectorAll('[data-music-field]').forEach((node) => node.addEventListener('input', () => updateNestedField('music', node)));
    panel.querySelector('[data-action="speak"]')?.addEventListener('click', speakVoiceOver);
    panel.querySelector('[data-action="music-preview"]')?.addEventListener('click', previewMusic);
    panel.querySelector('[data-action="run-generation"]')?.addEventListener('click', runGeneration);
    panel.querySelectorAll('[data-move-scene]').forEach((node) => node.addEventListener('click', () => moveScene(selectedScene()?.id, Number(node.dataset.moveScene))));
    panel.querySelectorAll('[data-duplicate-scene]').forEach((node) => node.addEventListener('click', () => duplicateScene(node.dataset.duplicateScene)));
    panel.querySelectorAll('[data-delete-scene]').forEach((node) => node.addEventListener('click', () => deleteScene(node.dataset.deleteScene)));
  }

  function bindDragAndDrop() {
    let dragged = null;
    root.querySelectorAll('[data-drag-scene]').forEach((node) => {
      node.addEventListener('dragstart', () => { dragged = node.dataset.dragScene; node.classList.add('dragging'); });
      node.addEventListener('dragend', () => { dragged = null; node.classList.remove('dragging'); });
      node.addEventListener('dragover', (event) => event.preventDefault());
      node.addEventListener('drop', (event) => {
        event.preventDefault();
        const target = node.dataset.dragScene;
        if (!dragged || dragged === target) return;
        const current = project();
        const from = current.scenes.findIndex((item) => item.id === dragged);
        const to = current.scenes.findIndex((item) => item.id === target);
        if (from < 0 || to < 0) return;
        const [moved] = current.scenes.splice(from, 1);
        current.scenes.splice(to, 0, moved);
        persist();
        renderEditorBody();
      });
    });
  }

  document.addEventListener('keydown', (event) => {
    if (state.screen !== 'editor') return;
    const tag = event.target?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); snapshot('Raccourci Ctrl+S'); }
    if (event.key === 'ArrowLeft') navigateScene(-1);
    if (event.key === 'ArrowRight') navigateScene(1);
  });

  const observer = new MutationObserver(installNavigation);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  injectStylesheet();
  installNavigation();
})();