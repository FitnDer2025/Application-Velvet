(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const STORAGE_KEY = 'velvet_studio_sprint1_projects_v2';
  const ACTIVE_KEY = 'velvet_studio_sprint1_active_v2';
  const API_URL = '/api/control/studio-media';
  const DEFAULT_BRIEF = 'Raconte comment une envie discrète devient progressivement une belle rencontre grâce à Velvet. Fais naître le mystère, l’attirance, les premiers mots, la confiance et la projection dans une soirée. La véritable interface Velvet doit illustrer chaque étape. Le ton doit être sensuel, élégant, chaleureux et émouvant, jamais explicite. Termine par : Velvet, là où les plus belles rencontres commencent.';

  const state = {
    plan: null,
    audioUrl: '',
    busy: false
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);

  const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  function installStyles() {
    if (document.querySelector('#velvetStudioAiModuleStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetStudioAiModuleStyles';
    style.textContent = `
      .vsai-shell{margin:18px 0 28px;border:1px solid rgba(198,169,106,.22);border-radius:24px;background:linear-gradient(145deg,rgba(23,20,22,.98),rgba(42,18,29,.82));box-shadow:0 22px 62px rgba(0,0,0,.24);overflow:hidden}
      .vsai-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 24px}
      .vsai-title{display:flex;align-items:center;gap:14px;min-width:0}.vsai-icon{display:grid;place-items:center;width:44px;height:44px;border:1px solid rgba(216,189,119,.34);border-radius:15px;background:rgba(216,189,119,.09);color:#d8bd77;font:600 19px Georgia,serif}
      .vsai-title strong{display:block;color:#f7f3ef;font:600 21px/1.15 Georgia,serif}.vsai-title span{display:block;margin-top:5px;color:#9f9996;font:500 12px/1.45 Inter,Arial}
      .vsai-head-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.vsai-status{padding:8px 11px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(0,0,0,.2);color:#aaa4a1;font:700 10px Inter,Arial;letter-spacing:.06em;text-transform:uppercase}.vsai-status.ok{border-color:rgba(78,160,112,.35);color:#8fcca7}.vsai-status.error{border-color:rgba(190,78,90,.35);color:#e59ca6}
      .vsai-button{border:0;border-radius:13px;padding:11px 15px;cursor:pointer;font:800 12px Inter,Arial}.vsai-button.primary{background:linear-gradient(135deg,#dfc376,#b98a40);color:#171109}.vsai-button.secondary{border:1px solid rgba(255,255,255,.12);background:#171719;color:#f5f1ed}.vsai-button:disabled{opacity:.5;cursor:wait}
      .vsai-body{display:none;padding:0 24px 24px;border-top:1px solid rgba(255,255,255,.07)}.vsai-shell.open .vsai-body{display:block}.vsai-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(330px,.8fr);gap:18px;padding-top:20px}.vsai-card{padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(8,8,10,.43)}
      .vsai-label{display:block;margin-bottom:8px;color:#d8bd77;font:800 10px Inter,Arial;letter-spacing:.12em;text-transform:uppercase}.vsai-card textarea{box-sizing:border-box;width:100%;min-height:145px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:#0d0d0f;color:#f4f0ec;outline:none;resize:vertical;font:500 14px/1.55 Inter,Arial}.vsai-card textarea:focus{border-color:rgba(216,189,119,.42)}
      .vsai-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.vsai-options label{display:grid;gap:6px;color:#8f8986;font:800 9px Inter,Arial;letter-spacing:.09em;text-transform:uppercase}.vsai-options select{padding:11px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#111114;color:#eee8e4}
      .vsai-help{margin:10px 0 0;color:#77716f;font:500 11px/1.5 Inter,Arial}.vsai-result{min-height:220px}.vsai-empty{display:grid;place-items:center;min-height:220px;padding:20px;text-align:center;color:#77716f;font:500 12px/1.6 Inter,Arial}.vsai-empty b{display:block;margin-bottom:8px;color:#d8bd77;font:500 28px Georgia,serif}
      .vsai-arc{margin-bottom:12px;padding:11px 13px;border-radius:12px;background:rgba(216,189,119,.08);color:#c7bebb;font:600 11px/1.45 Inter,Arial}.vsai-arc strong{color:#d8bd77}.vsai-scenes{display:grid;gap:8px;max-height:370px;overflow:auto;padding-right:3px}.vsai-scene{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:start;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:#101012}.vsai-scene>i{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:rgba(216,189,119,.12);color:#d8bd77;font:800 10px Inter,Arial;font-style:normal}.vsai-scene b{display:block;color:#f1ece8;font:700 12px Inter,Arial}.vsai-scene p{margin:4px 0 0;color:#8d8784;font:500 10px/1.45 Inter,Arial}.vsai-voice{padding:7px 9px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#171719;color:#ddd5d1;cursor:pointer;font:800 9px Inter,Arial;white-space:nowrap}
      .vsai-result-actions{display:flex;gap:9px;margin-top:12px}.vsai-result-actions>*{flex:1}.vsai-message{margin-top:10px;min-height:16px;color:#aca5a2;font:600 11px/1.4 Inter,Arial}.vsai-message.error{color:#e59ca6}.vsai-message.ok{color:#8fcca7}
      @media(max-width:900px){.vsai-grid{grid-template-columns:1fr}.vsai-head{align-items:flex-start;flex-direction:column}.vsai-head-actions{width:100%}.vsai-button{flex:1}}@media(max-width:580px){.vsai-head,.vsai-body{padding-left:15px;padding-right:15px}.vsai-options{grid-template-columns:1fr}.vsai-result-actions{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function moduleMarkup() {
    return `<section class="vsai-shell" data-vsai-shell aria-label="Assistant IA Velvet">
      <header class="vsai-head">
        <div class="vsai-title"><div class="vsai-icon">✦</div><div><strong>Assistant IA Velvet</strong><span>Écrit une histoire, construit les scènes et crée directement un projet dans ce Studio.</span></div></div>
        <div class="vsai-head-actions"><span class="vsai-status" data-vsai-status>IA non vérifiée</span><button class="vsai-button secondary" data-vsai-check>Vérifier l’IA</button><button class="vsai-button primary" data-vsai-toggle>Créer avec l’IA</button></div>
      </header>
      <div class="vsai-body">
        <div class="vsai-grid">
          <section class="vsai-card"><label class="vsai-label" for="vsaiBrief">L’histoire à raconter</label><textarea id="vsaiBrief" data-vsai-brief>${esc(DEFAULT_BRIEF)}</textarea>
            <div class="vsai-options"><label>Format<select data-vsai-format><option value="9:16">Vertical · Réseaux sociaux</option><option value="1:1">Carré · Publication</option><option value="16:9">Paysage · Site / YouTube</option></select></label><label>Durée<select data-vsai-duration><option value="15">15 secondes</option><option value="30" selected>30 secondes</option><option value="45">45 secondes</option></select></label></div>
            <button class="vsai-button primary" data-vsai-generate>Générer le scénario</button><p class="vsai-help">Aucun enregistrement, aucune iframe et aucun rendu plein écran ne démarre automatiquement. L’IA travaille uniquement après ton clic.</p><div class="vsai-message" data-vsai-message></div>
          </section>
          <section class="vsai-card vsai-result" data-vsai-result><div class="vsai-empty"><div><b>✦</b>Le scénario, l’arc émotionnel et les scènes apparaîtront ici.</div></div></section>
        </div>
      </div>
    </section>`;
  }

  function findHost() {
    return root.querySelector('.vs1-project-main');
  }

  function install() {
    if (root.querySelector('[data-vsai-shell]')) return true;
    const host = findHost();
    if (!host) return false;
    const hero = host.querySelector('.vs1-hero-card');
    const metrics = host.querySelector('.vs1-metrics');
    const module = document.createElement('div');
    module.innerHTML = moduleMarkup();
    const node = module.firstElementChild;
    if (hero) hero.insertAdjacentElement('afterend', node);
    else if (metrics) metrics.insertAdjacentElement('beforebegin', node);
    else host.prepend(node);
    return true;
  }

  function setStatus(label, tone = '') {
    const node = root.querySelector('[data-vsai-status]');
    if (!node) return;
    node.textContent = label;
    node.className = `vsai-status ${tone}`.trim();
  }

  function setMessage(message, tone = '') {
    const node = root.querySelector('[data-vsai-message]');
    if (!node) return;
    node.textContent = message;
    node.className = `vsai-message ${tone}`.trim();
  }

  function setBusy(busy, label = '') {
    state.busy = busy;
    root.querySelectorAll('[data-vsai-generate],[data-vsai-check]').forEach((button) => {
      button.disabled = busy;
    });
    const button = root.querySelector('[data-vsai-generate]');
    if (button) button.textContent = busy ? (label || 'Préparation…') : 'Générer le scénario';
  }

  async function api(body, expected = 'json') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: `Erreur ${response.status}` }));
        throw new Error(payload.error || `Erreur ${response.status}`);
      }
      return expected === 'blob' ? response.blob() : response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Le service IA met trop de temps à répondre. Réessaie dans quelques instants.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkCapabilities() {
    if (state.busy) return;
    setBusy(true, 'Vérification…');
    setMessage('Vérification du binding Workers AI…');
    try {
      const payload = await api({ action: 'capabilities' });
      if (!payload.binding) throw new Error('Le binding Workers AI n’est pas actif sur cette version.');
      setStatus('Workers AI prêt', 'ok');
      setMessage('Le scénario français et la voix sont disponibles.', 'ok');
    } catch (error) {
      setStatus('IA indisponible', 'error');
      setMessage(error.message || 'Impossible de vérifier Workers AI.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function renderPlan(plan) {
    const result = root.querySelector('[data-vsai-result]');
    if (!result) return;
    const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
    result.innerHTML = `<div class="vsai-arc"><strong>Arc narratif</strong> · ${esc(plan.narrativeArc || 'mystère → attirance → émotion → connexion → projection')}</div>
      <div class="vsai-scenes">${scenes.map((scene, index) => `<article class="vsai-scene"><i>${index + 1}</i><div><b>${esc(scene.title || `Scène ${index + 1}`)}</b><p>${esc(scene.onScreen || scene.voice || '')}</p></div><button class="vsai-voice" data-vsai-voice="${index}">Écouter</button></article>`).join('')}</div>
      <div class="vsai-result-actions"><button class="vsai-button primary" data-vsai-create-project>Créer ce projet dans Studio</button><button class="vsai-button secondary" data-vsai-regenerate>Réécrire</button></div>`;
  }

  async function generatePlan() {
    if (state.busy) return;
    const brief = root.querySelector('[data-vsai-brief]')?.value.trim() || '';
    const format = root.querySelector('[data-vsai-format]')?.value || '9:16';
    const duration = Number(root.querySelector('[data-vsai-duration]')?.value || 30);
    if (brief.length < 30) {
      setMessage('Décris un peu plus précisément l’histoire à raconter.', 'error');
      return;
    }
    setBusy(true, 'Écriture en cours…');
    setMessage('Le réalisateur IA construit le récit et les scènes…');
    try {
      const payload = await api({ action: 'plan_video', brief, format, duration });
      if (!payload.plan?.scenes?.length) throw new Error('Le scénario généré est incomplet.');
      state.plan = payload.plan;
      renderPlan(state.plan);
      setStatus('Scénario prêt', 'ok');
      setMessage(`${state.plan.scenes.length} scènes ont été préparées. Rien n’a encore été ajouté à ta bibliothèque.`, 'ok');
    } catch (error) {
      setStatus('Erreur IA', 'error');
      setMessage(error.message || 'Le scénario n’a pas pu être généré.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function playVoice(index) {
    const scene = state.plan?.scenes?.[index];
    if (!scene || state.busy) return;
    setBusy(true, 'Voix française…');
    setMessage(`Préparation de la voix pour « ${scene.title} »…`);
    try {
      const blob = await api({ action: 'generate_voice', text: scene.voice, duration: Math.max(4, Math.round(scene.duration || 6)), language: 'fr' }, 'blob');
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
      state.audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(state.audioUrl);
      await audio.play();
      setMessage('Lecture de la voix française.', 'ok');
    } catch (error) {
      setMessage(error.message === 'workers_ai_french_voice_unavailable' ? 'La voix française Workers AI est actuellement indisponible.' : (error.message || 'La voix n’a pas pu être lue.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  function screenVisual(screen) {
    return ({
      home: 'Navigation dans l’accueil Velvet et son fil communautaire premium.',
      discover: 'Découverte des membres et exploration des profils suggérés.',
      profile: 'Ouverture d’une fiche membre complète, de son univers et de ses albums.',
      messages: 'Ouverture de la messagerie et lecture d’un échange naturel et respectueux.',
      events: 'Découverte des sorties et événements proches qui donnent envie de se rencontrer.',
      map: 'Exploration de la carte Velvet, des lieux et expériences à proximité.'
    })[screen] || 'Navigation dans la véritable interface Velvet.';
  }

  function createProjectFromPlan() {
    const plan = state.plan;
    if (!plan?.scenes?.length) return;
    const now = new Date().toISOString();
    const palette = [
      ['#0D0D0D', '#641B36'], ['#131316', '#3D1F2D'], ['#0F1114', '#493C28'],
      ['#171315', '#6B3147'], ['#101011', '#31262A'], ['#0D0D0D', '#7B2445']
    ];
    const project = {
      id: uid('project'),
      title: plan.title || 'Une envie devient une histoire — Velvet',
      status: 'draft',
      channel: plan.format === '16:9' ? 'Site / YouTube' : 'Instagram / TikTok',
      format: plan.format || '9:16',
      audience: 'Membres et futurs membres Velvet',
      objective: 'Faire ressentir l’émotion, la confiance et l’envie de vivre une rencontre à travers Velvet.',
      prompt: plan.brief || root.querySelector('[data-vsai-brief]')?.value || DEFAULT_BRIEF,
      voiceOver: plan.voiceOver || plan.scenes.map((scene) => scene.voice).join(' '),
      music: {
        genre: 'Cinématographique sensuel premium',
        tempo: 82,
        instruments: 'Piano feutré, basse chaleureuse, texture de soie',
        emotion: 'Mystère, émotion, désir subtil, confiance',
        intensity: 48
      },
      voice: {
        gender: 'Féminine',
        accent: 'Français neutre',
        tone: 'Chaleureuse, intime et élégante',
        pace: 0.92
      },
      scenes: plan.scenes.map((scene, index) => ({
        id: uid('scene'),
        title: scene.title || `Chapitre ${index + 1}`,
        visual: screenVisual(scene.screen),
        text: scene.onScreen || '',
        duration: Number(scene.duration || Math.max(4, Math.round((plan.duration || 30) / plan.scenes.length))),
        transition: index % 2 ? 'Glass Morph' : 'Velvet Fade',
        objective: scene.emotion || 'Faire progresser le récit.',
        prompt: `${screenVisual(scene.screen)} Style Velvet premium, mouvement sobre, aucune image inventée, aucun contenu explicite.`,
        notes: `Écran : ${scene.screen || 'home'} · Action : ${scene.action || 'browse'} · Le scénario dirige la navigation.`,
        voice: scene.voice || '',
        palette: palette[index % palette.length]
      })),
      assets: [
        { id: uid('asset'), name: 'Logo Velvet Or', type: 'Logo', source: 'brand', preview: 'V', meta: 'Identité officielle Velvet' },
        { id: uid('asset'), name: 'Interface Membres Marketing', type: 'Capture', source: 'product', preview: '⌕', meta: 'Données fictives uniquement' }
      ],
      versions: [],
      agentLog: [{ at: now, agent: 'director', text: `Scénario IA créé · ${plan.scenes.length} scènes · ${plan.narrativeArc || 'arc émotionnel Velvet'}` }],
      createdAt: now,
      updatedAt: now
    };

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const projects = Array.isArray(existing) ? existing : [];
      projects.unshift(project);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, 30)));
      localStorage.setItem(ACTIVE_KEY, project.id);
      setMessage('Projet créé. Rechargement du Studio…', 'ok');
      setTimeout(() => window.location.reload(), 350);
    } catch {
      setMessage('Le navigateur n’a pas pu enregistrer le projet localement.', 'error');
    }
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-vsai-toggle]');
    if (toggle) {
      event.preventDefault();
      const shell = root.querySelector('[data-vsai-shell]');
      shell?.classList.toggle('open');
      toggle.textContent = shell?.classList.contains('open') ? 'Fermer l’assistant' : 'Créer avec l’IA';
      return;
    }
    if (event.target.closest('[data-vsai-check]')) {
      event.preventDefault();
      checkCapabilities();
      return;
    }
    if (event.target.closest('[data-vsai-generate]') || event.target.closest('[data-vsai-regenerate]')) {
      event.preventDefault();
      generatePlan();
      return;
    }
    const voice = event.target.closest('[data-vsai-voice]');
    if (voice) {
      event.preventDefault();
      playVoice(Number(voice.dataset.vsaiVoice));
      return;
    }
    if (event.target.closest('[data-vsai-create-project]')) {
      event.preventDefault();
      createProjectFromPlan();
      return;
    }

    if (event.target.closest('[data-vs1-new-project],[data-vs1-back-projects],[data-open-studio]')) {
      setTimeout(install, 80);
    }
  });

  installStyles();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 100) clearInterval(timer);
  }, 100);
  install();
})();
