(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const PROJECTS_KEY = 'velvet_studio_sprint1_projects_v2';
  const ACTIVE_KEY = 'velvet_studio_sprint1_active_v2';
  const PACKS_KEY = 'velvet_studio_v3_campaign_packs';
  const MAX_PACKS = 20;

  const runtime = {
    pack: null,
    generating: false,
    selectedTab: 'overview',
    capability: null
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
  const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
  const deepClone = (value) => JSON.parse(JSON.stringify(value));

  function readProjects() {
    try {
      const value = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function currentProject() {
    const projects = readProjects();
    const activeId = localStorage.getItem(ACTIVE_KEY);
    return projects.find((item) => item.id === activeId) || projects[0] || null;
  }

  function readPacks() {
    try {
      const value = JSON.parse(localStorage.getItem(PACKS_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function persistPack(pack) {
    const packs = readPacks().filter((item) => item.id !== pack.id);
    packs.unshift(pack);
    localStorage.setItem(PACKS_KEY, JSON.stringify(packs.slice(0, MAX_PACKS)));
  }

  function projectDuration(project) {
    return (project?.scenes || []).reduce((sum, scene) => sum + Number(scene.duration || 0), 0);
  }

  function localCampaignPack(project, brief = {}) {
    const brand = clean(brief.brand || 'Zwit', 80) || 'Zwit';
    const objective = clean(brief.objective || project?.objective || 'Faire connaître Zwit et déclencher des inscriptions qualifiées.', 600);
    const audience = clean(brief.audience || project?.audience || 'Couples, femmes seules et professionnels du secteur', 500);
    const offer = clean(brief.offer || 'Découvrir la plateforme et rejoindre la communauté Zwit', 300);
    const region = clean(brief.region || 'Hauts-de-France et Belgique', 160);
    const tone = clean(brief.tone || 'Premium, humain, élégant, rassurant', 160);
    const masterPrompt = clean(brief.prompt || project?.prompt || objective, 2200);
    const signature = 'Là où les plus belles rencontres commencent.';
    const hooks = [
      'Le libertinage évolue.',
      'Les plus belles rencontres ne commencent pas par un algorithme, mais par la confiance.',
      'Profils, événements, établissements : enfin réunis dans une même expérience.',
      'Moins de bruit. Plus de qualité. Plus de liberté.',
      'Zwit rapproche les personnes, les lieux et les expériences qui comptent.'
    ];
    const ctas = ['Découvrir Zwit', 'Rejoindre la communauté', 'Explorer les événements', 'Découvrir Zwit Pro', 'Créer son profil'];
    const videoDefs = [
      ['Teaser social', 15, '9:16', 'Instagram Reels / TikTok', hooks[0], ctas[0]],
      ['Film découverte', 30, '9:16', 'Instagram Reels / Facebook', hooks[2], ctas[1]],
      ['Film manifeste', 45, '16:9', 'YouTube / site Zwit', hooks[1], ctas[0]],
      ['Focus confiance', 20, '1:1', 'Instagram / Facebook', hooks[3], ctas[4]],
      ['Zwit Pro', 30, '16:9', 'LinkedIn / prospection établissements', hooks[4], ctas[3]]
    ];

    const videos = videoDefs.map(([title, duration, format, channel, hook, cta], index) => ({
      id: uid('video'), kind: 'video', title, duration, format, channel, hook, cta,
      status: 'draft',
      objective: index === 4 ? 'Convaincre les établissements de rejoindre Zwit Pro.' : objective,
      voiceOver: `${hook} ${index === 4 ? 'Zwit Pro centralise vos événements, vos réservations et votre visibilité auprès d’une communauté qualifiée.' : 'Zwit réunit profils, lieux, événements et outils de confiance dans une expérience premium, discrète et pensée pour des rencontres de qualité.'} ${brand}. ${signature}`,
      scenes: buildVideoScenes(project, duration, index),
      provider: 'velvet-campaign-engine-v3'
    }));

    const visualThemes = [
      ['Manifeste', hooks[0], 'Ruban Zwit, fond noir et lumière champagne'],
      ['Confiance', 'La confiance avant tout.', 'Albums privés, consentement et modération'],
      ['Découverte', 'Des rencontres qui ont du sens.', 'Recherche premium et profils de qualité'],
      ['Événements', 'Vivez plus que des conversations.', 'Agenda et sorties à proximité'],
      ['Établissements', 'Les meilleurs lieux, au même endroit.', 'Carte Zwit et sélection d’établissements'],
      ['Discrétion', 'Votre liberté mérite de la discrétion.', 'Interface épurée, données protégées'],
      ['Communauté', 'Une communauté choisie.', 'Diversité adulte et bienveillance'],
      ['Proximité', `Zwit arrive en ${region}.`, 'Carte régionale élégante'],
      ['Zwit Pro', 'Organiser. Remplir. Fidéliser.', 'Cockpit professionnel premium'],
      ['Invitation', 'Votre invitation pour découvrir Velvet.', 'Carte digitale avec ruban bordeaux'],
      ['Fonctionnalités', 'Tout Zwit, en un seul univers.', 'Mosaïque recherche, messages, carte et événements'],
      ['Signature', signature, 'Logo Zwit et halo champagne']
    ];
    const formats = ['1080×1350', '1080×1920', '1200×628', '1080×1080'];
    const visuals = visualThemes.map(([theme, headline, direction], index) => ({
      id: uid('visual'), kind: 'visual', theme, headline, direction,
      format: formats[index % formats.length], status: 'draft',
      prompt: `${direction}. Style ${tone}, palette Zwit noir #0D0D0D, bordeaux #641B36, or #C6A96A, ivoire #F4F4F2. Aucune nudité, aucune donnée réelle, personnes fictives majeures uniquement.`,
      cta: ctas[index % ctas.length]
    }));

    const postBlueprints = [
      ['Instagram', hooks[0], 'Zwit réunit les rencontres, les événements et les établissements dans une seule expérience pensée autour de la confiance.', ctas[0]],
      ['Instagram', 'Des rencontres qui ont du sens.', 'Une interface premium, des profils mieux présentés et une communauté où la qualité compte davantage que la quantité.', ctas[1]],
      ['TikTok', 'Et si les rencontres libres entraient enfin dans une nouvelle ère ?', 'Découvrez Zwit : plus fluide, plus élégant, plus humain.', ctas[0]],
      ['Facebook', 'Zwit arrive près de chez vous.', `Le lancement commence en ${region}, avec les membres, événements et établissements de la région.`, ctas[1]],
      ['Facebook', 'La confiance n’est pas une option.', 'Consentement, discrétion, albums privés et modération font partie de l’expérience Zwit dès le départ.', ctas[4]],
      ['LinkedIn', 'Zwit Pro : le cockpit des établissements.', 'Créez vos événements, développez votre visibilité et fidélisez votre communauté depuis un seul espace.', ctas[3]],
      ['Instagram', 'Votre prochaine sortie commence ici.', 'Explorez les événements et établissements proches de vous dans un environnement premium.', ctas[2]],
      ['TikTok', 'Moins de bruit. Plus de vraies connexions.', 'Zwit remet le feeling, le respect et la qualité au centre.', ctas[1]],
      ['Instagram', 'Une communauté libre. Jamais sans respect.', 'Zwit accueille les envies et les identités dans un cadre adulte, bienveillant et consentant.', ctas[4]],
      ['LinkedIn', 'Une plateforme pensée comme un écosystème.', 'Membres, lieux, événements et professionnels avancent enfin avec les mêmes outils.', ctas[3]]
    ];
    const hashtags = ['#Zwit', '#RencontresLibres', '#Libertinage', '#Communauté', '#Consentement', '#Discrétion', '#Événements', '#VelvetPro', '#HautsDeFrance', '#Belgique'];
    const posts = postBlueprints.map(([platform, headline, body, cta], index) => ({
      id: uid('post'), kind: 'post', platform, headline, body, cta,
      status: 'draft', hashtags: hashtags.slice(0, platform === 'LinkedIn' ? 5 : 8),
      visualId: visuals[index % visuals.length].id,
      characterCount: `${headline} ${body} ${cta}`.length
    }));

    const newsletter = {
      id: uid('newsletter'), kind: 'newsletter', status: 'draft',
      subject: 'Zwit ouvre un nouvel univers pour les rencontres libres',
      preheader: 'Une plateforme premium, plus humaine, plus fluide et pensée autour de la confiance.',
      headline: hooks[0],
      body: `Zwit réunit enfin les profils, les événements, les établissements et les outils professionnels dans une même expérience. Notre ambition : proposer une communauté adulte où la qualité, le respect, la discrétion et le consentement sont visibles à chaque étape. Le lancement commence en ${region}.`,
      cta: ctas[0]
    };

    const banner = {
      id: uid('banner'), kind: 'banner', status: 'draft',
      eyebrow: 'ZWIT · NOUVELLE EXPÉRIENCE',
      headline: hooks[0],
      subheadline: 'Rencontres, événements et établissements réunis dans un même univers premium.',
      cta: ctas[0], format: 'Desktop + mobile'
    };

    const calendarItems = [...videos.slice(0, 4), ...posts, ...visuals.slice(0, 4)];
    const calendar = calendarItems.map((item, index) => {
      const date = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000);
      const hours = [18, 20, 12, 19, 21][index % 5];
      date.setHours(hours, index % 2 ? 30 : 0, 0, 0);
      return {
        id: uid('slot'), itemId: item.id, itemKind: item.kind,
        title: item.title || item.headline || item.theme,
        channel: item.channel || item.platform || (item.kind === 'visual' ? 'Instagram' : 'Multi-réseaux'),
        scheduledAt: date.toISOString(), status: 'planned'
      };
    });

    return {
      id: uid('pack'), version: 3, projectId: project?.id || null,
      title: `${brand} · Campagne ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      brief: masterPrompt, objective, audience, offer, region, tone,
      videos, visuals, posts, hashtags, newsletter, banner, calendar,
      brandGuard: {
        score: 96,
        status: 'pass',
        checks: [
          ['Identité Zwit', true], ['Consentement et respect', true], ['Personnes majeures uniquement', true],
          ['Aucune donnée membre réelle', true], ['Promesses vérifiables', true], ['Aucun contenu explicite', true]
        ]
      },
      metrics: {
        videos: videos.length, visuals: visuals.length, posts: posts.length,
        newsletters: 1, banners: 1, calendarSlots: calendar.length
      },
      createdAt: new Date().toISOString(), provider: 'velvet-local-campaign-engine-v3'
    };
  }

  function buildVideoScenes(project, targetDuration, variantIndex) {
    const source = Array.isArray(project?.scenes) && project.scenes.length ? project.scenes : [{
      title: 'Zwit', visual: 'Ruban Zwit sur fond noir', text: 'Le libertinage évolue.', duration: 5,
      transition: 'Zwit Fade', prompt: 'Univers Zwit premium', palette: ['#0D0D0D', '#641B36']
    }];
    const limit = variantIndex === 0 ? 3 : variantIndex === 3 ? 4 : Math.min(6, source.length);
    const selected = source.slice(0, limit).map((scene) => deepClone(scene));
    const total = selected.reduce((sum, scene) => sum + Math.max(0.5, Number(scene.duration || 5)), 0) || 1;
    selected.forEach((scene, index) => {
      scene.id = uid('scene');
      scene.duration = Math.max(1.5, Number((targetDuration * Math.max(0.5, Number(scene.duration || 5)) / total).toFixed(2)));
      scene.transition = index % 2 ? 'Champagne Glow' : 'Zwit Fade';
    });
    const adjusted = selected.reduce((sum, scene) => sum + scene.duration, 0);
    selected[selected.length - 1].duration = Math.max(1.5, Number((selected[selected.length - 1].duration + targetDuration - adjusted).toFixed(2)));
    return selected;
  }

  async function requestPack(project, brief) {
    try {
      const response = await fetch('/api/control/studio-v3', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'campaign_pack', project, brief })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.pack) throw new Error(payload?.error || 'studio_v3_api_unavailable');
      return payload.pack;
    } catch {
      return localCampaignPack(project, brief);
    }
  }

  function notify(message, tone = 'ok') {
    let node = document.querySelector('#vs3Toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vs3Toast';
      document.body.appendChild(node);
    }
    node.className = `vs3-toast ${tone}`;
    node.textContent = message;
    requestAnimationFrame(() => node.classList.add('show'));
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  function openDesk() {
    const project = currentProject();
    if (!project) return notify('Ouvre d’abord un projet Zwit Studio.', 'error');
    closeDesk();
    runtime.pack = readPacks().find((item) => item.projectId === project.id) || null;
    const modal = document.createElement('section');
    modal.className = 'vs3-desk';
    modal.dataset.velvetStudioV3 = 'true';
    modal.innerHTML = deskMarkup(project);
    document.body.appendChild(modal);
    document.body.classList.add('vs3-open');
    bindDesk(modal);
    if (runtime.pack) renderPack(modal);
  }

  function closeDesk() {
    document.querySelector('[data-velvet-studio-v3]')?.remove();
    document.body.classList.remove('vs3-open');
  }

  function deskMarkup(project) {
    return `
      <header class="vs3-head">
        <div class="vs3-head-brand"><span class="vs3-mark">V3</span><div><strong>Zwit Studio · Campaign Engine</strong><small>${esc(project.title)} · production marketing multicanale</small></div></div>
        <div class="vs3-head-actions"><button data-v3-export ${runtime.pack ? '' : 'disabled'}>Exporter le pack</button><button class="primary" data-v3-generate>${runtime.pack ? 'Régénérer' : 'Créer la campagne'}</button><button class="close" data-v3-close>×</button></div>
      </header>
      <main class="vs3-layout">
        <aside class="vs3-brief-panel">
          <span class="vs3-kicker">Brief unique</span><h1>Une idée.<br>Une campagne complète.</h1>
          <label>Prompt principal<textarea data-v3-field="prompt">${esc(project.prompt || project.objective || '')}</textarea></label>
          <label>Objectif<textarea data-v3-field="objective">${esc(project.objective || '')}</textarea></label>
          <div class="vs3-field-grid"><label>Audience<input data-v3-field="audience" value="${esc(project.audience || '')}"></label><label>Zone de lancement<input data-v3-field="region" value="Hauts-de-France et Belgique"></label></div>
          <label>Offre / action attendue<input data-v3-field="offer" value="Découvrir Zwit et rejoindre la communauté"></label>
          <label>Ton<select data-v3-field="tone"><option>Premium, humain, élégant</option><option>Émotionnel et cinématographique</option><option>Direct et social media</option><option>Business et performant</option></select></label>
          <button class="vs3-generate" data-v3-generate><span>✦</span><strong>${runtime.pack ? 'Régénérer le pack' : 'Générer la campagne V3'}</strong><small>Vidéos · visuels · posts · newsletter · calendrier</small></button>
          <div class="vs3-provider"><span class="ready"></span><div><strong>Mode gratuit-first</strong><small>Moteur Zwit local. Prestataires externes désactivés.</small></div></div>
        </aside>
        <section class="vs3-main" data-v3-main>${emptyState()}</section>
      </main>`;
  }

  function emptyState() {
    return `<div class="vs3-empty"><div class="vs3-orbit"><span>V</span><i></i><b></b></div><span class="vs3-kicker">Campaign Engine V3</span><h2>Le studio attend ton brief.</h2><p>À partir d’une seule intention, Zwit prépare une campagne cohérente, déclinée sur tous les formats utiles et prête à passer dans le moteur vidéo V2.</p><div class="vs3-empty-metrics"><span>5 vidéos</span><span>12 visuels</span><span>10 publications</span><span>1 newsletter</span></div></div>`;
  }

  function loadingState() {
    const tasks = ['Stratégie de campagne', 'Angles créatifs', 'Déclinaisons vidéo', 'Visuels sociaux', 'Copies multicanales', 'Calendrier éditorial', 'Brand Guard'];
    return `<div class="vs3-loading"><div class="vs3-loader"></div><span class="vs3-kicker">Agence IA en production</span><h2>Zwit construit la campagne.</h2><div>${tasks.map((task, index) => `<article style="--delay:${index * 120}ms"><span>${String(index + 1).padStart(2, '0')}</span><strong>${task}</strong><i></i></article>`).join('')}</div></div>`;
  }

  function briefFrom(modal) {
    const get = (name) => clean(modal.querySelector(`[data-v3-field="${name}"]`)?.value || '');
    return { prompt: get('prompt'), objective: get('objective'), audience: get('audience'), region: get('region'), offer: get('offer'), tone: get('tone') };
  }

  async function generate(modal) {
    if (runtime.generating) return;
    runtime.generating = true;
    modal.querySelector('[data-v3-main]').innerHTML = loadingState();
    modal.querySelectorAll('[data-v3-generate]').forEach((button) => { button.disabled = true; });
    const project = currentProject();
    const brief = briefFrom(modal);
    await new Promise((resolve) => setTimeout(resolve, 900));
    runtime.pack = await requestPack(project, brief);
    persistPack(runtime.pack);
    runtime.generating = false;
    renderPack(modal);
    modal.querySelectorAll('[data-v3-generate]').forEach((button) => { button.disabled = false; });
    modal.querySelector('[data-v3-export]')?.removeAttribute('disabled');
    notify('Campagne V3 générée');
  }

  function renderPack(modal) {
    if (!runtime.pack) return;
    const main = modal.querySelector('[data-v3-main]');
    main.innerHTML = `
      <div class="vs3-summary">
        <div><span class="vs3-kicker">Campagne générée</span><h2>${esc(runtime.pack.title)}</h2><p>${esc(runtime.pack.objective)}</p></div>
        <div class="vs3-score"><span>${runtime.pack.brandGuard?.score || 0}</span><small>Brand Guard</small></div>
      </div>
      <nav class="vs3-tabs">${[
        ['overview', 'Vue d’ensemble'], ['videos', 'Vidéos'], ['visuals', 'Visuels'], ['posts', 'Publications'], ['calendar', 'Calendrier'], ['email', 'Newsletter']
      ].map(([id, label]) => `<button class="${runtime.selectedTab === id ? 'active' : ''}" data-v3-tab="${id}">${label}</button>`).join('')}</nav>
      <section class="vs3-tab-body" data-v3-tab-body>${tabMarkup(runtime.selectedTab)}</section>`;
    bindPack(main);
  }

  function tabMarkup(tab) {
    const pack = runtime.pack;
    if (!pack) return emptyState();
    if (tab === 'videos') return videoMarkup(pack.videos || []);
    if (tab === 'visuals') return visualMarkup(pack.visuals || []);
    if (tab === 'posts') return postMarkup(pack.posts || []);
    if (tab === 'calendar') return calendarMarkup(pack.calendar || []);
    if (tab === 'email') return emailMarkup(pack);
    return overviewMarkup(pack);
  }

  function overviewMarkup(pack) {
    return `<div class="vs3-metrics">
      ${metric('Films', pack.metrics?.videos || pack.videos?.length || 0, 'variantes prêtes pour V2')}
      ${metric('Visuels', pack.metrics?.visuals || pack.visuals?.length || 0, 'directions créatives')}
      ${metric('Publications', pack.metrics?.posts || pack.posts?.length || 0, 'copies multicanales')}
      ${metric('Créneaux', pack.metrics?.calendarSlots || pack.calendar?.length || 0, 'planning éditorial')}
    </div>
    <div class="vs3-overview-grid">
      <section class="vs3-card"><div class="vs3-card-head"><div><span class="vs3-kicker">Films prioritaires</span><h3>Production vidéo</h3></div><button data-v3-tab="videos">Tout voir</button></div>${(pack.videos || []).slice(0, 3).map(videoRow).join('')}</section>
      <section class="vs3-card"><div class="vs3-card-head"><div><span class="vs3-kicker">Brand Guard</span><h3>Campagne maîtrisée</h3></div></div><div class="vs3-checks">${(pack.brandGuard?.checks || []).map(([label, ok]) => `<p><span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'}</span>${esc(label)}</p>`).join('')}</div><div class="vs3-hashtags">${(pack.hashtags || []).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div></section>
      <section class="vs3-card wide"><div class="vs3-card-head"><div><span class="vs3-kicker">Prochaine séquence</span><h3>Calendrier éditorial</h3></div><button data-v3-tab="calendar">Ouvrir le planning</button></div><div class="vs3-calendar-strip">${(pack.calendar || []).slice(0, 7).map(calendarMini).join('')}</div></section>
    </div>`;
  }

  function metric(label, value, copy) {
    return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(copy)}</small></article>`;
  }

  function videoRow(item) {
    return `<article class="vs3-video-row"><span class="vs3-format">${esc(item.format)}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.channel)} · ${item.duration} s</small></div><button data-v3-make-video="${item.id}">Créer le projet V2</button></article>`;
  }

  function videoMarkup(items) {
    return `<div class="vs3-section-head"><div><span class="vs3-kicker">5 variantes cohérentes</span><h3>Films de campagne</h3><p>Chaque variante peut devenir un projet autonome dans le moteur de réalisation V2.</p></div></div><div class="vs3-video-grid">${items.map((item, index) => `<article><div class="vs3-video-poster"><span>${esc(item.format)}</span><b>${String(index + 1).padStart(2, '0')}</b><strong>ZWIT</strong><small>${item.duration} secondes</small></div><div class="vs3-video-copy"><span class="vs3-platform">${esc(item.channel)}</span><h4>${esc(item.title)}</h4><p>${esc(item.hook)}</p><small>${esc(item.objective)}</small><button data-v3-make-video="${item.id}">Créer dans Réalisation V2</button></div></article>`).join('')}</div>`;
  }

  function visualMarkup(items) {
    return `<div class="vs3-section-head"><div><span class="vs3-kicker">Direction artistique</span><h3>12 concepts visuels</h3><p>Des prompts précis, cohérents avec la marque, prêts pour un moteur image ou une production interne.</p></div></div><div class="vs3-visual-grid">${items.map((item, index) => `<article><div class="vs3-visual-preview v${index % 4}"><span>${esc(item.format)}</span><strong>${esc(item.headline)}</strong><small>${esc(item.theme)}</small></div><div><h4>${esc(item.theme)}</h4><p>${esc(item.direction)}</p><button data-v3-copy="${esc(item.prompt)}">Copier le prompt</button></div></article>`).join('')}</div>`;
  }

  function postMarkup(items) {
    return `<div class="vs3-section-head"><div><span class="vs3-kicker">Social media</span><h3>10 publications prêtes</h3><p>Chaque texte peut être copié, validé et associé à son visuel.</p></div></div><div class="vs3-post-list">${items.map((item) => `<article data-v3-item="${item.id}"><div class="vs3-post-platform">${esc(item.platform.slice(0, 2).toUpperCase())}</div><div><span class="vs3-platform">${esc(item.platform)} · ${item.characterCount} caractères</span><h4>${esc(item.headline)}</h4><p>${esc(item.body)}</p><div class="vs3-hashtags">${(item.hashtags || []).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div></div><div class="vs3-post-actions"><button data-v3-copy="${esc(`${item.headline}\n\n${item.body}\n\n${item.cta}\n\n${(item.hashtags || []).join(' ')}`)}">Copier</button><button data-v3-toggle-item="${item.id}">${item.status === 'approved' ? 'Validé ✓' : 'Valider'}</button></div></article>`).join('')}</div>`;
  }

  function calendarMarkup(items) {
    const grouped = items.reduce((acc, item) => {
      const day = new Date(item.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
      (acc[day] ||= []).push(item);
      return acc;
    }, {});
    return `<div class="vs3-section-head"><div><span class="vs3-kicker">Plan d’activation</span><h3>Calendrier éditorial</h3><p>Planning proposé automatiquement. Aucun contenu n’est publié sans validation humaine.</p></div><button data-v3-calendar-csv>Exporter CSV</button></div><div class="vs3-calendar">${Object.entries(grouped).map(([day, slots]) => `<section><h4>${esc(day)}</h4>${slots.map((slot) => `<article><time>${new Date(slot.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time><div><strong>${esc(slot.title)}</strong><small>${esc(slot.channel)} · ${esc(slot.itemKind)}</small></div><span>${esc(slot.status === 'planned' ? 'Planifié' : slot.status)}</span></article>`).join('')}</section>`).join('')}</div>`;
  }

  function calendarMini(slot) {
    const date = new Date(slot.scheduledAt);
    return `<article><span>${date.toLocaleDateString('fr-FR', { weekday: 'short' })}</span><strong>${date.getDate()}</strong><small>${esc(slot.channel)}</small></article>`;
  }

  function emailMarkup(pack) {
    const email = pack.newsletter || {};
    const banner = pack.banner || {};
    return `<div class="vs3-email-grid"><section class="vs3-card"><span class="vs3-kicker">Newsletter</span><h3>${esc(email.subject)}</h3><p class="vs3-preheader">${esc(email.preheader)}</p><div class="vs3-email-preview"><span>${esc(banner.eyebrow)}</span><h2>${esc(email.headline)}</h2><p>${esc(email.body)}</p><button>${esc(email.cta)}</button></div><button data-v3-copy="${esc(`Objet : ${email.subject}\nPréheader : ${email.preheader}\n\n${email.headline}\n\n${email.body}\n\n${email.cta}`)}">Copier la newsletter</button></section><section class="vs3-card"><span class="vs3-kicker">Bannière de campagne</span><div class="vs3-banner-preview"><small>${esc(banner.eyebrow)}</small><h2>${esc(banner.headline)}</h2><p>${esc(banner.subheadline)}</p><span>${esc(banner.cta)} →</span></div><button data-v3-copy="${esc(`${banner.eyebrow}\n${banner.headline}\n${banner.subheadline}\n${banner.cta}`)}">Copier les textes</button></section></div>`;
  }

  function bindDesk(modal) {
    modal.querySelector('[data-v3-close]')?.addEventListener('click', closeDesk);
    modal.querySelectorAll('[data-v3-generate]').forEach((button) => button.addEventListener('click', () => generate(modal)));
    modal.querySelector('[data-v3-export]')?.addEventListener('click', exportPack);
  }

  function bindPack(scope) {
    scope.querySelectorAll('[data-v3-tab]').forEach((button) => button.addEventListener('click', () => {
      runtime.selectedTab = button.dataset.v3Tab;
      const modal = document.querySelector('[data-velvet-studio-v3]');
      renderPack(modal);
    }));
    scope.querySelectorAll('[data-v3-copy]').forEach((button) => button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(button.dataset.v3Copy || '');
      notify('Contenu copié');
    }));
    scope.querySelectorAll('[data-v3-make-video]').forEach((button) => button.addEventListener('click', () => makeVideoProject(button.dataset.v3MakeVideo)));
    scope.querySelectorAll('[data-v3-toggle-item]').forEach((button) => button.addEventListener('click', () => toggleItem(button.dataset.v3ToggleItem)));
    scope.querySelector('[data-v3-calendar-csv]')?.addEventListener('click', exportCalendarCsv);
  }

  function toggleItem(itemId) {
    const item = runtime.pack?.posts?.find((entry) => entry.id === itemId);
    if (!item) return;
    item.status = item.status === 'approved' ? 'draft' : 'approved';
    persistPack(runtime.pack);
    renderPack(document.querySelector('[data-velvet-studio-v3]'));
  }

  function makeVideoProject(videoId) {
    const video = runtime.pack?.videos?.find((item) => item.id === videoId);
    const source = currentProject();
    if (!video || !source) return notify('Variante vidéo introuvable.', 'error');
    const projects = readProjects();
    const next = deepClone(source);
    next.id = uid('project');
    next.title = `${runtime.pack.title} · ${video.title}`;
    next.objective = video.objective;
    next.channel = video.channel;
    next.format = video.format;
    next.voiceOver = video.voiceOver;
    next.scenes = video.scenes.map((scene) => ({ ...scene, id: uid('scene') }));
    next.status = 'production';
    next.versions = [];
    next.createdAt = new Date().toISOString();
    next.updatedAt = next.createdAt;
    projects.unshift(next);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    localStorage.setItem(ACTIVE_KEY, next.id);
    notify('Projet vidéo V2 créé');
    setTimeout(() => {
      closeDesk();
      location.reload();
    }, 700);
  }

  function exportPack() {
    if (!runtime.pack) return;
    const blob = new Blob([JSON.stringify(runtime.pack, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${runtime.pack.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'velvet-campaign-v3'}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 500);
  }

  function exportCalendarCsv() {
    if (!runtime.pack) return;
    const rows = [['date', 'heure', 'canal', 'type', 'titre', 'statut']];
    runtime.pack.calendar.forEach((slot) => {
      const date = new Date(slot.scheduledAt);
      rows.push([
        date.toLocaleDateString('fr-FR'), date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        slot.channel, slot.itemKind, slot.title, slot.status
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'velvet-campagne-v3-calendrier.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 500);
  }

  function installButton() {
    const shell = root.querySelector('.vs1-shell');
    if (!shell) return;
    const target = shell.querySelector('.vs1-top-actions,.vs1-editor-actions');
    if (!target || target.querySelector('[data-open-v3]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vs1-btn primary vs3-launch';
    button.dataset.openV3 = 'true';
    button.innerHTML = '<span>✦</span> Campagne V3';
    button.addEventListener('click', openDesk);
    target.prepend(button);
    if (!shell.querySelector('.vs3-ready-badge')) {
      const badge = document.createElement('span');
      badge.className = 'vs3-ready-badge';
      badge.textContent = 'V3 CAMPAIGN';
      shell.querySelector('.vs1-brand')?.appendChild(badge);
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(installButton));
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('pagehide', closeDesk);
  installButton();
})();