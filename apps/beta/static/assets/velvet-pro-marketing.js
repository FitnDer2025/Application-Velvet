(() => {
  'use strict';

  const API_URL = '/api/pro/marketing';
  const LOCAL_PREFIX = 'velvet_pro_marketing_v1_';
  const NETWORKS = {
    facebook: { label: 'Facebook', mark: 'f', format: '4:5' },
    instagram: { label: 'Instagram', mark: '◎', format: '4:5' },
    tiktok: { label: 'TikTok', mark: '♪', format: '9:16' }
  };
  const state = {
    installed: false,
    open: false,
    tab: 'create',
    loading: false,
    snapshot: null,
    venueId: '',
    eventId: '',
    renderId: '',
    networks: ['facebook', 'instagram'],
    tone: 'premium',
    objective: 'event_registration',
    cta: 'Découvrez la soirée et réservez votre place sur Zwit.',
    baseCopy: '',
    copies: { facebook: '', instagram: '', tiktok: '' },
    compliance: null,
    scheduleMode: 'sequence',
    scheduledAt: '',
    approved: false,
    campaignId: '',
    progress: '',
    error: '',
    installTimer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
  const uid = () => crypto.randomUUID?.() || `marketing_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  function venueId() {
    return $('#venueSelect')?.value || state.venueId || '';
  }

  function localKey() {
    return `${LOCAL_PREFIX}${venueId() || 'unknown'}`;
  }

  function defaultLocalSnapshot() {
    return {
      migrationPending: true,
      venue: null,
      events: [],
      projects: [],
      renders: [],
      connections: [],
      campaigns: [],
      publications: [],
      metrics: [],
      capabilities: { meta: false, tiktok: false, scheduler: false, workersAI: true }
    };
  }

  function loadLocal() {
    try {
      return { ...defaultLocalSnapshot(), ...JSON.parse(localStorage.getItem(localKey()) || '{}'), migrationPending: true };
    } catch {
      return defaultLocalSnapshot();
    }
  }

  function saveLocal() {
    if (!state.snapshot) return;
    try {
      localStorage.setItem(localKey(), JSON.stringify({
        campaigns: state.snapshot.campaigns || [],
        publications: state.snapshot.publications || [],
        metrics: state.snapshot.metrics || [],
        connections: state.snapshot.connections || []
      }));
    } catch {}
  }

  async function jsonApi(body, method = 'POST') {
    const options = { method, credentials: 'same-origin', headers: { accept: 'application/json' } };
    if (method !== 'GET') {
      options.headers['content-type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const url = method === 'GET' ? `${API_URL}?venueId=${encodeURIComponent(venueId())}` : API_URL;
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `marketing_${response.status}`);
    return payload;
  }

  async function sourceFallback(snapshot) {
    const next = { ...loadLocal(), ...snapshot, migrationPending: true };
    const [workspaceResult, studioResult] = await Promise.allSettled([
      fetch('/api/pro/workspace', { credentials: 'same-origin' }).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch(`/api/pro/studio-ai?venueId=${encodeURIComponent(venueId())}`, { credentials: 'same-origin' }).then((response) => response.ok ? response.json() : Promise.reject())
    ]);
    if (workspaceResult.status === 'fulfilled') {
      const workspace = workspaceResult.value;
      next.venue = workspace.venues?.find((venue) => venue.id === venueId()) || workspace.venues?.[0] || null;
      next.events = (workspace.events || []).filter((event) => event.establishment_id === venueId());
    }
    if (studioResult.status === 'fulfilled') {
      next.projects = studioResult.value.projects || [];
      next.renders = studioResult.value.renders || [];
    }
    return next;
  }

  async function loadSnapshot(force = false) {
    const nextVenue = venueId();
    if (!nextVenue) throw new Error('Aucun établissement actif.');
    if (!force && state.snapshot && state.venueId === nextVenue) return state.snapshot;
    state.venueId = nextVenue;
    try {
      const snapshot = await jsonApi(null, 'GET');
      state.snapshot = snapshot.migrationPending ? await sourceFallback(snapshot) : snapshot;
    } catch (error) {
      state.snapshot = await sourceFallback(defaultLocalSnapshot());
      if (!String(error.message).includes('pro_marketing') && !String(error.message).includes('social_connections')) throw error;
    }
    chooseDefaults();
    return state.snapshot;
  }

  function chooseDefaults() {
    const upcoming = (state.snapshot?.events || [])
      .filter((event) => new Date(event.starts_at).getTime() > Date.now() - 86400000)
      .sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
    if (!upcoming.some((event) => event.id === state.eventId)) state.eventId = upcoming[0]?.id || state.snapshot?.events?.[0]?.id || '';
    const preferred = compatibleRenders(state.snapshot?.renders || []);
    if (!preferred.some((render) => render.id === state.renderId)) state.renderId = preferred[0]?.id || '';
    if (!state.scheduledAt) {
      const date = new Date(Date.now() + 3600000);
      date.setMinutes(0, 0, 0);
      state.scheduledAt = localDateTime(date);
    }
  }

  function compatibleRenders(renders) {
    return [...renders].sort((left, right) => {
      const score = (render) => (render.format === '4:5' ? 3 : render.format === '9:16' ? 2 : 1) + (render.render_type === 'video' ? 1 : 0);
      return score(right) - score(left) || new Date(right.created_at || 0) - new Date(left.created_at || 0);
    });
  }

  function selectedEvent() {
    return state.snapshot?.events?.find((event) => event.id === state.eventId) || null;
  }

  function selectedRender() {
    return state.snapshot?.renders?.find((render) => render.id === state.renderId) || null;
  }

  function linkedProject(render = selectedRender()) {
    return state.snapshot?.projects?.find((project) => project.id === render?.project_id) || null;
  }

  function currentVenue() {
    return state.snapshot?.venue || { id: venueId(), name: $('#venueSelect option:checked')?.textContent || 'Votre établissement' };
  }

  function installStyles() {
    if ($('#vpmStyles')) return;
    const style = document.createElement('style');
    style.id = 'vpmStyles';
    style.textContent = `
      .vpm-nav-badge{margin-left:auto;padding:3px 7px;border:1px solid #d5b47755;border-radius:999px;color:#d5b477;font-size:8px;font-style:normal}.vpm-view{min-height:calc(100vh - 125px)}
      .vpm-hero{position:relative;display:grid;grid-template-columns:minmax(0,1.28fr) minmax(320px,.72fr);gap:24px;padding:30px;border:1px solid #d5b47735;border-radius:28px;overflow:hidden;background:radial-gradient(circle at 88% 0,#b43d7350,transparent 35%),linear-gradient(145deg,#171316,#49182e);box-shadow:0 30px 80px #0006}.vpm-hero:after{content:'';position:absolute;width:340px;height:340px;right:-140px;bottom:-220px;border:1px solid #d5b47730;border-radius:50%}.vpm-hero h1{margin:8px 0 12px;font-size:clamp(42px,5vw,72px);line-height:.96}.vpm-hero p{max-width:780px;color:#c6bebb;line-height:1.65}.vpm-promise{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.vpm-promise span{padding:7px 10px;border:1px solid #ffffff16;border-radius:999px;background:#09090b66;color:#ded6d1;font-size:10px}.vpm-hero-side{position:relative;z-index:1;display:grid;align-content:center;gap:10px}.vpm-kpi-row{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.vpm-mini-kpi{padding:14px;border:1px solid #ffffff12;border-radius:16px;background:#09090b69}.vpm-mini-kpi small{display:block;color:#99918e;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.vpm-mini-kpi b{display:block;margin-top:7px;color:#fff;font:500 28px Georgia}.vpm-status-note{padding:12px;border:1px solid #ffffff14;border-radius:14px;background:#09090b73;color:#aaa3a0;font-size:11px;line-height:1.5}
      .vpm-tabs{display:flex;gap:7px;overflow:auto;margin:20px 0 14px;padding:5px;border:1px solid #ffffff12;border-radius:16px;background:#101013}.vpm-tabs button{border:0;border-radius:12px;padding:11px 15px;background:transparent;color:#9f9995;white-space:nowrap;font-weight:700}.vpm-tabs button.active{background:#ffffff0d;color:#fff;box-shadow:inset 0 0 0 1px #ffffff12}.vpm-grid{display:grid;grid-template-columns:minmax(340px,.82fr) minmax(460px,1.18fr);gap:16px}.vpm-panel{padding:20px;border:1px solid #ffffff12;border-radius:22px;background:linear-gradient(145deg,#ffffff09,#ffffff04)}.vpm-panel h2{margin:5px 0 15px;font-size:29px}.vpm-panel h3{margin:7px 0 12px;font-size:20px}.vpm-section{padding:17px 0;border-top:1px solid #ffffff0d}.vpm-section:first-of-type{padding-top:0;border-top:0}.vpm-label{display:block;margin-bottom:8px;color:#aaa4a0;font-size:10px}.vpm-select,.vpm-input,.vpm-textarea{box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid #ffffff15;border-radius:12px;background:#111114;color:#fff;outline:none}.vpm-textarea{min-height:126px;resize:vertical;line-height:1.5}.vpm-select:focus,.vpm-input:focus,.vpm-textarea:focus{border-color:#d5b47770}.vpm-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vpm-network-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.vpm-network{display:grid;grid-template-columns:38px 1fr;gap:9px;align-items:center;padding:11px;border:1px solid #ffffff13;border-radius:14px;background:#ffffff05;cursor:pointer}.vpm-network.active{border-color:#d5b47776;background:#d5b4770d}.vpm-network input{position:absolute;opacity:0}.vpm-network-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:#09090b;color:#fff;font:800 18px Arial}.vpm-network small{display:block;color:#8e8784;font-size:9px}.vpm-btn{border:0;border-radius:999px;padding:11px 16px;background:linear-gradient(135deg,#963961,#7d294c);color:#fff;font-weight:800;cursor:pointer}.vpm-btn.gold{background:linear-gradient(135deg,#e1c678,#b88940);color:#171109}.vpm-btn.ghost{border:1px solid #ffffff18;background:#ffffff07;color:#eee}.vpm-btn.danger{border:1px solid #c95b7355;background:#c95b7310;color:#f0a2b2}.vpm-btn:disabled{opacity:.45;cursor:wait}.vpm-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.vpm-progress{margin-top:12px;padding:11px 13px;border:1px solid #d5b47735;border-radius:12px;background:#d5b4770a;color:#d9c38f;font-size:11px}.vpm-error{border-color:#e17b9355;background:#e17b9310;color:#f0a5b5}
      .vpm-event-card{display:grid;grid-template-columns:62px 1fr;gap:12px;padding:13px;border:1px solid #ffffff12;border-radius:16px;background:#0e0e11}.vpm-date{display:grid;place-items:center;align-content:center;min-height:62px;border-radius:13px;background:linear-gradient(145deg,#7d294c,#32111f);color:#fff}.vpm-date b{font:700 25px Georgia}.vpm-date small{font-size:9px;text-transform:uppercase}.vpm-event-card h3{margin:2px 0 5px;font-size:18px}.vpm-event-card p{margin:0;color:#96908c;font-size:10px;line-height:1.45}.vpm-render-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.vpm-render{position:relative;overflow:hidden;border:2px solid transparent;border-radius:14px;background:#0b0b0d;cursor:pointer}.vpm-render.selected{border-color:#d5b477}.vpm-render img,.vpm-render video{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}.vpm-render span{position:absolute;left:6px;right:6px;bottom:6px;padding:6px;border-radius:9px;background:#09090bde;color:#fff;text-align:center;font-size:8px;backdrop-filter:blur(10px)}.vpm-copy-tabs{display:flex;gap:6px;margin-bottom:9px}.vpm-copy-tabs button{border:1px solid #ffffff13;border-radius:999px;padding:8px 11px;background:#ffffff05;color:#aaa;font-size:9px}.vpm-copy-tabs button.active{border-color:#d5b47770;color:#fff}.vpm-copy-editor{display:grid;gap:7px}.vpm-counter{text-align:right;color:#777;font-size:9px}
      .vpm-compliance{display:grid;gap:8px;padding:14px;border:1px solid #ffffff13;border-radius:16px;background:#0e0e11}.vpm-score{display:flex;align-items:center;justify-content:space-between;gap:10px}.vpm-score b{font:500 30px Georgia}.vpm-ready{color:#7ed4a0}.vpm-review{color:#e1bd71}.vpm-blocked{color:#ed879b}.vpm-issue{padding:8px 10px;border-left:3px solid #e1bd71;background:#ffffff04;color:#aaa;font-size:10px}.vpm-issue.blocking{border-color:#ed879b;color:#e9b0bb}.vpm-preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.vpm-social-preview{overflow:hidden;border:1px solid #ffffff13;border-radius:18px;background:#f4f4f4;color:#171717}.vpm-social-head{display:flex;align-items:center;gap:8px;padding:10px;background:#fff}.vpm-social-avatar{display:grid;place-items:center;width:31px;height:31px;border-radius:50%;background:#54192e;color:#d5b477;font:700 13px Georgia}.vpm-social-head b{display:block;font-size:10px}.vpm-social-head small{display:block;color:#777;font-size:8px}.vpm-social-preview img,.vpm-social-preview video{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;background:#171719}.vpm-social-copy{max-height:150px;overflow:auto;padding:10px;white-space:pre-wrap;font-size:9px;line-height:1.45}.vpm-social-foot{display:flex;justify-content:space-between;padding:8px 10px;border-top:1px solid #ddd;color:#555;font-size:9px}
      .vpm-sequence{display:grid;gap:8px}.vpm-slot{display:grid;grid-template-columns:70px 1fr auto;gap:10px;align-items:center;padding:11px;border:1px solid #ffffff12;border-radius:14px;background:#0f0f12}.vpm-slot b{color:#d5b477;font-size:11px}.vpm-slot span{color:#bbb;font-size:10px}.vpm-slot small{color:#777;font-size:9px}.vpm-approval{display:flex;gap:10px;align-items:flex-start;margin-top:13px;padding:13px;border:1px solid #d5b47735;border-radius:14px;background:#d5b47709;color:#c8c0bc;font-size:10px;line-height:1.5}.vpm-approval input{margin-top:2px}
      .vpm-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.vpm-card{padding:16px;border:1px solid #ffffff13;border-radius:18px;background:#111114}.vpm-card h3{margin:7px 0;font-size:18px}.vpm-card p{margin:0;color:#96908c;font-size:10px;line-height:1.5}.vpm-badge{display:inline-flex;padding:5px 8px;border:1px solid #ffffff15;border-radius:999px;color:#aaa;font-size:8px;text-transform:uppercase;letter-spacing:.07em}.vpm-badge.active,.vpm-badge.published{border-color:#5ec58b50;color:#83d4a5}.vpm-badge.failed{border-color:#d45f7750;color:#e991a2}.vpm-badge.scheduled{border-color:#d5b47755;color:#ddc887}.vpm-connection{display:grid;gap:13px;padding:18px;border:1px solid #ffffff13;border-radius:20px;background:radial-gradient(circle at 95% 0,var(--network,#7d294c55),transparent 42%),#111114}.vpm-connection-head{display:flex;justify-content:space-between;gap:12px}.vpm-connection-mark{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;background:#09090b;color:#fff;font:800 22px Arial}.vpm-table{width:100%;border-collapse:collapse}.vpm-table th,.vpm-table td{padding:11px 8px;border-bottom:1px solid #ffffff0d;text-align:left;font-size:10px}.vpm-table th{color:#8f8885;text-transform:uppercase;letter-spacing:.06em}.vpm-empty{padding:65px 20px;text-align:center;color:#888}.vpm-empty b{display:block;margin-bottom:8px;color:#d5b477;font:500 44px Georgia}
      @media(max-width:1120px){.vpm-hero,.vpm-grid{grid-template-columns:1fr}.vpm-preview-grid,.vpm-card-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.vpm-hero{padding:21px}.vpm-form-grid,.vpm-network-row,.vpm-preview-grid,.vpm-card-grid{grid-template-columns:1fr}.vpm-render-list{grid-template-columns:repeat(2,1fr)}.vpm-slot{grid-template-columns:60px 1fr}.vpm-slot small{grid-column:2}.vpm-actions{flex-direction:column}.vpm-actions>*{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureNav() {
    const nav = $('#nav');
    if (!nav) return false;
    let button = $('[data-pro-marketing-nav]', nav);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.proMarketingNav = 'true';
      button.innerHTML = '<i>◉</i>Marketing <em class="vpm-nav-badge">SOCIAL</em>';
      button.addEventListener('click', openMarketing);
      const studio = $('[data-pro-studio-nav]', nav);
      if (studio) studio.insertAdjacentElement('afterend', button);
      else nav.appendChild(button);
    }
    return true;
  }

  function markNav() {
    $$('#nav button').forEach((button) => button.classList.toggle('active', Boolean(button.dataset.proMarketingNav) && state.open));
  }

  function closeOnNativeNavigation() {
    $('#nav')?.addEventListener('click', (event) => {
      if (!event.target.closest('[data-pro-marketing-nav]')) state.open = false;
    }, true);
    $('#venueSelect')?.addEventListener('change', () => {
      state.snapshot = null;
      state.eventId = '';
      state.renderId = '';
      state.baseCopy = '';
      if (state.open) setTimeout(openMarketing, 300);
    });
  }

  async function openMarketing(tab = '') {
    state.open = true;
    state.tab = tab || state.tab || 'create';
    state.error = '';
    state.progress = 'Connexion au concentrateur marketing…';
    markNav();
    if ($('#pageTitle')) $('#pageTitle').textContent = 'Marketing';
    if ($('#content')) $('#content').innerHTML = '<section class="card" style="max-width:760px;margin:8vh auto;text-align:center"><div class="ey">Zwit Marketing</div><h1>Préparation de vos campagnes…</h1><p class="lead">Synchronisation de votre agenda, de vos affiches et de vos réseaux sociaux.</p></section>';
    try {
      await loadSnapshot(true);
      state.progress = '';
    } catch (error) {
      state.error = friendlyError(error.message);
      state.progress = '';
    }
    render();
  }

  function stats() {
    const publications = state.snapshot?.publications || [];
    return {
      scheduled: publications.filter((item) => item.status === 'scheduled').length,
      published: publications.filter((item) => ['published', 'draft_delivered'].includes(item.status)).length,
      failed: publications.filter((item) => item.status === 'failed').length,
      networks: (state.snapshot?.connections || []).filter((item) => item.status === 'active').length
    };
  }

  function heroMarkup() {
    const values = stats();
    const migration = state.snapshot?.migrationPending;
    return `<section class="vpm-hero"><div><div class="ey">ZWIT PRO · CONCENTRATEUR MARKETING</div><h1>Une soirée.<br>Une campagne complète.</h1><p>Retrouvez votre agenda, vos affiches Zwit Studio et vos réseaux dans un seul espace. Zwit prépare les textes, contrôle leur compatibilité, programme la diffusion et mesure les résultats.</p><div class="vpm-promise"><span>Agenda synchronisé</span><span>Affiches Studio IA</span><span>Facebook · Instagram · TikTok</span><span>Validation humaine obligatoire</span></div></div><div class="vpm-hero-side"><div class="vpm-kpi-row"><div class="vpm-mini-kpi"><small>Programmées</small><b>${values.scheduled}</b></div><div class="vpm-mini-kpi"><small>Diffusées</small><b>${values.published}</b></div><div class="vpm-mini-kpi"><small>Réseaux actifs</small><b>${values.networks}/2</b></div><div class="vpm-mini-kpi"><small>À corriger</small><b>${values.failed}</b></div></div><button class="vpm-btn gold" data-vpm-new>Créer une campagne</button><div class="vpm-status-note">${migration ? '<b>Synchronisation locale active.</b><br>La migration Supabase Marketing doit être appliquée pour programmer et diffuser entre plusieurs appareils.' : '<b>Zwit Marketing synchronisé.</b><br>Les campagnes, validations et publications sont mémorisées dans votre espace professionnel.'}</div></div></section>`;
  }

  function tabsMarkup() {
    const tabs = [
      ['create', 'Créer une campagne'],
      ['calendar', 'Calendrier éditorial'],
      ['publications', 'Publications'],
      ['results', 'Résultats'],
      ['connections', 'Connexions']
    ];
    return `<nav class="vpm-tabs">${tabs.map(([id, label]) => `<button type="button" data-vpm-tab="${id}" class="${state.tab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>`;
  }

  function render() {
    if (!state.open) return;
    installStyles();
    markNav();
    const content = $('#content');
    if (!content) return;
    content.innerHTML = `<main class="vpm-view">${heroMarkup()}${tabsMarkup()}<section data-vpm-body>${tabMarkup()}</section></main>`;
  }

  function tabMarkup() {
    if (state.tab === 'calendar') return calendarMarkup();
    if (state.tab === 'publications') return publicationsMarkup();
    if (state.tab === 'results') return resultsMarkup();
    if (state.tab === 'connections') return connectionsMarkup();
    return createMarkup();
  }

  function eventOptions() {
    const events = [...(state.snapshot?.events || [])].sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
    return events.map((event) => `<option value="${event.id}" ${event.id === state.eventId ? 'selected' : ''}>${esc(event.title)} · ${esc(formatDate(event.starts_at, true))}</option>`).join('');
  }

  function createMarkup() {
    const event = selectedEvent();
    const render = selectedRender();
    const renders = compatibleRenders(state.snapshot?.renders || []);
    const project = linkedProject(render);
    const copiesReady = Boolean(state.baseCopy || Object.values(state.copies).some(Boolean));
    return `<div class="vpm-grid"><section class="vpm-panel"><div class="ey">1 · SOURCE DE LA CAMPAGNE</div><h2>Soirée et création</h2><div class="vpm-section"><label class="vpm-label">Soirée issue de votre agenda</label><select class="vpm-select" data-vpm-event>${eventOptions() || '<option value="">Créez d’abord une soirée dans l’agenda</option>'}</select>${event ? eventCard(event) : '<div class="vpm-empty"><b>＋</b>Votre agenda ne contient aucune soirée exploitable.</div>'}</div><div class="vpm-section"><div style="display:flex;align-items:end;justify-content:space-between;gap:10px"><div><h3>Affiche Zwit Studio</h3><p class="lead" style="font-size:11px">Choisissez le format qui accompagnera la publication.</p></div><button class="vpm-btn ghost" data-open-studio>Ouvrir Studio IA</button></div>${renders.length ? `<div class="vpm-render-list">${renders.slice(0, 12).map(renderCard).join('')}</div>` : '<div class="vpm-empty"><b>✦</b>Aucune affiche validée. Créez d’abord un visuel dans Studio IA.</div>'}</div><div class="vpm-section"><h3>Réseaux à activer</h3><div class="vpm-network-row">${Object.entries(NETWORKS).map(([id, item]) => networkChoice(id, item)).join('')}</div></div><div class="vpm-section"><div class="vpm-form-grid"><label><span class="vpm-label">Objectif</span><select class="vpm-select" data-vpm-objective><option value="event_registration" ${state.objective === 'event_registration' ? 'selected' : ''}>Obtenir des inscriptions</option><option value="awareness" ${state.objective === 'awareness' ? 'selected' : ''}>Faire connaître la soirée</option><option value="last_places" ${state.objective === 'last_places' ? 'selected' : ''}>Remplir les dernières places</option><option value="brand" ${state.objective === 'brand' ? 'selected' : ''}>Valoriser l’établissement</option></select></label><label><span class="vpm-label">Ton éditorial</span><select class="vpm-select" data-vpm-tone><option value="premium" ${state.tone === 'premium' ? 'selected' : ''}>Premium et désirable</option><option value="warm" ${state.tone === 'warm' ? 'selected' : ''}>Chaleureux et rassurant</option><option value="festive" ${state.tone === 'festive' ? 'selected' : ''}>Festif et énergique</option><option value="exclusive" ${state.tone === 'exclusive' ? 'selected' : ''}>Exclusif et mystérieux</option></select></label></div><label style="display:block;margin-top:10px"><span class="vpm-label">Appel à l’action</span><input class="vpm-input" data-vpm-cta value="${esc(state.cta)}"></label><div class="vpm-actions"><button class="vpm-btn gold" data-vpm-generate ${state.loading || !event ? 'disabled' : ''}>${state.loading ? 'Rédaction en cours…' : 'Rédiger avec Zwit IA'}</button><button class="vpm-btn ghost" data-vpm-check ${!copiesReady ? 'disabled' : ''}>Contrôler la conformité</button></div>${messageMarkup()}</div></section><section class="vpm-panel"><div class="ey">2 · COMPOSITION ÉDITORIALE</div><h2>Votre publication</h2>${copyMarkup()}${complianceMarkup()}<div class="vpm-section"><div class="ey">PRÉVISUALISATION</div><h3>Rendu sur les réseaux</h3><div class="vpm-preview-grid">${state.networks.map((network) => socialPreview(network, render, project)).join('') || '<div class="vpm-empty"><b>◉</b>Sélectionnez au moins un réseau.</div>'}</div></div><div class="vpm-section"><div class="ey">3 · DIFFUSION</div><h3>Programmation</h3>${scheduleMarkup(event)}<label class="vpm-approval"><input type="checkbox" data-vpm-approved ${state.approved ? 'checked' : ''}><span><b>Je valide personnellement cette campagne.</b><br>J’ai vérifié le texte, le visuel, la date, le compte destinataire et la conformité de la publication.</span></label><div class="vpm-actions"><button class="vpm-btn ghost" data-vpm-save ${!copiesReady ? 'disabled' : ''}>Enregistrer le brouillon</button><button class="vpm-btn gold" data-vpm-schedule ${!copiesReady || !state.approved ? 'disabled' : ''}>Programmer la campagne</button><button class="vpm-btn" data-vpm-publish ${!copiesReady || !state.approved ? 'disabled' : ''}>Publier maintenant</button></div></div></section></div>`;
  }

  function eventCard(event) {
    const date = new Date(event.starts_at);
    return `<article class="vpm-event-card" style="margin-top:10px"><div class="vpm-date"><b>${date.getDate()}</b><small>${date.toLocaleDateString('fr-FR', { month: 'short' })}</small></div><div><span class="vpm-badge ${event.visibility === 'published' ? 'active' : ''}">${esc(event.visibility || 'brouillon')}</span><h3>${esc(event.title)}</h3><p>${esc(event.description || '')}</p><p style="margin-top:6px">${esc([formatDate(event.starts_at, true), event.location_public, event.dress_code].filter(Boolean).join(' · '))}</p></div></article>`;
  }

  function renderCard(render) {
    const selected = render.id === state.renderId;
    const media = String(render.mime_type || '').startsWith('video/') || render.render_type === 'video'
      ? `<video src="${esc(render.previewUrl || '')}" muted playsinline></video>`
      : `<img src="${esc(render.previewUrl || '')}" alt="Affiche Studio">`;
    return `<button type="button" class="vpm-render ${selected ? 'selected' : ''}" data-vpm-render="${render.id}">${media}<span>${esc(render.format)} · V${Number(render.variant_index || 1)}</span></button>`;
  }

  function networkChoice(id, item) {
    const active = state.networks.includes(id);
    const connection = connectionFor(id);
    const status = connection?.status === 'active' ? 'Connecté' : 'À connecter';
    return `<label class="vpm-network ${active ? 'active' : ''}"><input type="checkbox" data-vpm-network="${id}" ${active ? 'checked' : ''}><span class="vpm-network-mark">${item.mark}</span><span><b>${item.label}</b><small>${status}</small></span></label>`;
  }

  function copyMarkup() {
    const active = state.networks[0] || 'facebook';
    return `<div class="vpm-section"><div class="vpm-copy-tabs">${state.networks.map((network) => `<button type="button" data-vpm-copy-tab="${network}" class="${network === active ? 'active' : ''}">${NETWORKS[network].label}</button>`).join('')}</div>${state.networks.map((network, index) => `<div class="vpm-copy-editor" data-vpm-copy-panel="${network}" ${index ? 'hidden' : ''}><textarea class="vpm-textarea" data-vpm-copy="${network}" placeholder="Zwit préparera ici une version adaptée à ${NETWORKS[network].label}…">${esc(state.copies[network] || state.baseCopy)}</textarea><span class="vpm-counter">${String(state.copies[network] || state.baseCopy).length} caractères</span></div>`).join('') || '<div class="vpm-empty"><b>✎</b>Choisissez un réseau pour rédiger la campagne.</div>'}</div>`;
  }

  function complianceMarkup() {
    const report = state.compliance;
    if (!report) return '<div class="vpm-section"><div class="vpm-compliance"><div class="vpm-score"><span><b>—</b><small> Contrôle social</small></span><span class="vpm-badge">À analyser</span></div><p style="margin:0;color:#8f8885;font-size:10px">Zwit vérifiera les formulations sensibles avant toute programmation.</p></div></div>';
    const tone = report.score >= 85 ? 'ready' : report.score >= 55 ? 'review' : 'blocked';
    return `<div class="vpm-section"><div class="vpm-compliance"><div class="vpm-score"><span><b class="vpm-${tone}">${Number(report.score || 0)}/100</b><small> Compatibilité sociale</small></span><span class="vpm-badge ${tone === 'ready' ? 'active' : tone}">${tone === 'ready' ? 'Prêt' : tone === 'review' ? 'À vérifier' : 'Bloqué'}</span></div>${(report.issues || []).map((issue) => `<div class="vpm-issue ${issue.severity === 'blocking' ? 'blocking' : ''}">${esc(issue.label)}</div>`).join('') || '<p style="margin:0;color:#88cfa3;font-size:10px">Aucune formulation bloquante détectée. Une vérification humaine reste obligatoire.</p>'}</div></div>`;
  }

  function socialPreview(network, render) {
    const venue = currentVenue();
    const media = render ? (String(render.mime_type || '').startsWith('video/') || render.render_type === 'video'
      ? `<video src="${esc(render.previewUrl || '')}" muted playsinline></video>`
      : `<img src="${esc(render.previewUrl || '')}" alt="Visuel de publication">`) : '<div style="aspect-ratio:4/5;display:grid;place-items:center;background:#201019;color:#d5b477">Affiche requise</div>';
    const copy = state.copies[network] || state.baseCopy || 'Votre texte apparaîtra ici.';
    return `<article class="vpm-social-preview"><header class="vpm-social-head"><span class="vpm-social-avatar">${NETWORKS[network].mark}</span><span><b>${esc(venue.name)}</b><small>${NETWORKS[network].label} · Sponsorisé par votre établissement</small></span></header>${media}<div class="vpm-social-copy">${esc(copy)}</div><footer class="vpm-social-foot"><span>♡ J’aime · Commenter</span><b>${esc(state.cta.slice(0, 32))}</b></footer></article>`;
  }

  function slotsForEvent(event) {
    if (!event?.starts_at) return [];
    const start = new Date(event.starts_at);
    const offsets = [
      { code: 'j-21', label: 'J‑21', days: 21, purpose: 'Annonce de la soirée' },
      { code: 'j-10', label: 'J‑10', days: 10, purpose: 'Ambiance et thème' },
      { code: 'j-3', label: 'J‑3', days: 3, purpose: 'Dernières places' },
      { code: 'jour-j', label: 'Jour J', days: 0, purpose: 'Rendez-vous ce soir' }
    ];
    return offsets.map((slot) => {
      const date = new Date(start);
      date.setDate(date.getDate() - slot.days);
      date.setHours(slot.days === 0 ? 11 : 19, 0, 0, 0);
      if (date.getTime() < Date.now() + 60000) date.setTime(Date.now() + (offsets.indexOf(slot) + 1) * 5 * 60000);
      return { ...slot, scheduledAt: date.toISOString() };
    });
  }

  function scheduleMarkup(event) {
    const slots = slotsForEvent(event);
    return `<div class="vpm-form-grid"><label><span class="vpm-label">Stratégie</span><select class="vpm-select" data-vpm-schedule-mode><option value="sequence" ${state.scheduleMode === 'sequence' ? 'selected' : ''}>Séquence J‑21 à Jour J</option><option value="single" ${state.scheduleMode === 'single' ? 'selected' : ''}>Une publication unique</option></select></label>${state.scheduleMode === 'single' ? `<label><span class="vpm-label">Date et heure</span><input class="vpm-input" type="datetime-local" data-vpm-scheduled-at value="${esc(state.scheduledAt)}"></label>` : '<div></div>'}</div>${state.scheduleMode === 'sequence' ? `<div class="vpm-sequence" style="margin-top:10px">${slots.map((slot) => `<article class="vpm-slot"><b>${slot.label}</b><span>${esc(slot.purpose)}</span><small>${esc(formatDate(slot.scheduledAt, true))}</small></article>`).join('')}</div>` : ''}`;
  }

  function calendarMarkup() {
    const publications = [...(state.snapshot?.publications || [])].sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
    return `<section class="vpm-panel"><div style="display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:16px"><div><div class="ey">PLANIFICATION</div><h2>Calendrier éditorial</h2><p class="lead">Toutes les prises de parole liées à vos soirées, ordonnées dans le temps.</p></div><button class="vpm-btn gold" data-vpm-new>Nouvelle campagne</button></div>${publications.length ? `<div class="vpm-card-grid">${publications.map(publicationCard).join('')}</div>` : empty('◷', 'Aucune campagne programmée', 'Créez une campagne à partir d’une soirée de votre agenda.')}</section>`;
  }

  function publicationCard(publication) {
    const campaign = state.snapshot?.campaigns?.find((item) => item.id === publication.campaign_id);
    return `<article class="vpm-card"><span class="vpm-badge ${esc(publication.status)}">${esc(publication.status)}</span><h3>${esc(campaign?.title || 'Campagne Zwit')}</h3><p>${NETWORKS[publication.provider]?.label || publication.provider} · ${esc(publication.sequence_code)}</p><p style="margin-top:8px">${esc(formatDate(publication.scheduled_at, true))}</p>${publication.status === 'scheduled' ? `<div class="vpm-actions"><button class="vpm-btn danger" data-vpm-cancel="${publication.id}">Annuler</button></div>` : ''}</article>`;
  }

  function publicationsMarkup() {
    const publications = [...(state.snapshot?.publications || [])].sort((left, right) => new Date(right.scheduled_at) - new Date(left.scheduled_at));
    return `<section class="vpm-panel"><div class="ey">HISTORIQUE</div><h2>Publications</h2><p class="lead">Zwit n’affiche jamais une publication comme réussie sans confirmation de la plateforme.</p>${publications.length ? `<div style="overflow:auto"><table class="vpm-table"><thead><tr><th>Réseau</th><th>Campagne</th><th>Échéance</th><th>Statut</th><th>Diagnostic</th></tr></thead><tbody>${publications.map((publication) => { const campaign = state.snapshot?.campaigns?.find((item) => item.id === publication.campaign_id); return `<tr><td>${esc(NETWORKS[publication.provider]?.label || publication.provider)}</td><td>${esc(campaign?.title || 'Campagne')}</td><td>${esc(formatDate(publication.scheduled_at, true))}</td><td><span class="vpm-badge ${esc(publication.status)}">${esc(publication.status)}</span></td><td>${esc(publication.error_message || publication.external_post_id || '—')}</td></tr>`; }).join('')}</tbody></table></div>` : empty('◎', 'Aucune publication', 'Les publications confirmées par Facebook, Instagram ou TikTok apparaîtront ici.')}</section>`;
  }

  function resultsMarkup() {
    const metrics = state.snapshot?.metrics || [];
    const sum = (key) => metrics.reduce((total, item) => total + Number(item[key] || 0), 0);
    const clicks = sum('clicks');
    const registrations = sum('registrations');
    return `<section class="vpm-panel"><div class="ey">VALEUR MARKETING</div><h2>Résultats attribuables</h2><p class="lead">Aucun chiffre n’est inventé : les indicateurs apparaissent uniquement lorsqu’ils sont renvoyés par les plateformes ou reliés à une inscription Zwit.</p><div class="vpm-kpi-row" style="grid-template-columns:repeat(4,1fr);margin:20px 0"><div class="vpm-mini-kpi"><small>Portée</small><b>${sum('reach').toLocaleString('fr-FR')}</b></div><div class="vpm-mini-kpi"><small>Vues</small><b>${sum('views').toLocaleString('fr-FR')}</b></div><div class="vpm-mini-kpi"><small>Clics</small><b>${clicks.toLocaleString('fr-FR')}</b></div><div class="vpm-mini-kpi"><small>Inscriptions</small><b>${registrations.toLocaleString('fr-FR')}</b></div></div>${metrics.length ? `<div style="overflow:auto"><table class="vpm-table"><thead><tr><th>Date</th><th>Réseau</th><th>Portée</th><th>Interactions</th><th>Clics</th><th>Inscriptions</th></tr></thead><tbody>${metrics.map((metric) => `<tr><td>${esc(formatDate(metric.captured_at, true))}</td><td>${esc(NETWORKS[metric.provider]?.label || metric.provider)}</td><td>${Number(metric.reach || 0).toLocaleString('fr-FR')}</td><td>${Number(metric.likes || 0) + Number(metric.comments || 0) + Number(metric.shares || 0)}</td><td>${Number(metric.clicks || 0)}</td><td>${Number(metric.registrations || 0)}</td></tr>`).join('')}</tbody></table></div>` : empty('↗', 'Mesure en attente', 'Les résultats seront visibles après les premières publications officielles.')}</section>`;
  }

  function connectionFor(network) {
    const provider = network === 'tiktok' ? 'tiktok' : 'meta';
    return state.snapshot?.connections?.find((connection) => connection.provider === provider) || null;
  }

  function connectionsMarkup() {
    const capabilities = state.snapshot?.capabilities || {};
    const meta = connectionFor('facebook');
    const tiktok = connectionFor('tiktok');
    return `<section class="vpm-panel"><div class="ey">PARAMÈTRES SOCIAUX</div><h2>Connexions officielles</h2><p class="lead">Zwit ne demande jamais vos mots de passe. Chaque réseau est relié par son autorisation officielle et peut être déconnecté à tout moment.</p><div class="vpm-card-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:18px">${connectionCard('meta', meta, capabilities.meta)}${connectionCard('tiktok', tiktok, capabilities.tiktok)}</div><div class="vpm-status-note" style="margin-top:14px"><b>Sécurité des accès.</b><br>Les jetons sociaux sont chiffrés côté serveur, séparés par établissement et ne sont jamais envoyés au navigateur.</div></section>`;
  }

  function connectionCard(provider, connection, capability) {
    const isMeta = provider === 'meta';
    const label = isMeta ? 'Facebook & Instagram' : 'TikTok';
    const mark = isMeta ? '∞' : '♪';
    const active = connection?.status === 'active';
    const selection = connection?.status === 'selection_required';
    const returnMode = location.pathname.startsWith('/marketing-pro') ? 'marketing-pro' : 'pro';
    const href = `/api/pro/marketing/oauth/${provider}/start?venueId=${encodeURIComponent(venueId())}&return=${returnMode}`;
    return `<article class="vpm-connection" style="--network:${isMeta ? '#3972ff55' : '#ff375f44'}"><div class="vpm-connection-head"><span class="vpm-connection-mark">${mark}</span><span class="vpm-badge ${active ? 'active' : ''}">${active ? 'Connecté' : selection ? 'Compte à choisir' : capability ? 'Disponible' : 'Configuration requise'}</span></div><div><h3>${label}</h3><p>${active ? `${esc(connection.providerAccountName || label)}${connection.providerAccountHandle ? ` · @${esc(String(connection.providerAccountHandle).replace(/^@/, ''))}` : ''}` : isMeta ? 'Publiez sur votre Page Facebook et votre compte Instagram professionnel associé.' : 'Envoyez une publication en brouillon ou publiez directement après validation TikTok.'}</p></div>${selection ? `<label><span class="vpm-label">Page à utiliser</span><select class="vpm-select" data-vpm-meta-account><option value="">Choisir une Page…</option>${(connection.availableAccounts || []).map((account) => `<option value="${account.id}">${esc(account.name)}${account.instagramUsername ? ` · @${esc(account.instagramUsername)}` : ''}</option>`).join('')}</select></label>` : ''}<div class="vpm-actions">${active ? `<button class="vpm-btn danger" data-vpm-disconnect="${provider}">Déconnecter</button>` : capability ? `<a class="vpm-btn gold" href="${href}" style="text-decoration:none;text-align:center">Connecter ${label}</a>` : '<button class="vpm-btn ghost" disabled>Identifiants plateforme à configurer</button>'}</div></article>`;
  }

  function empty(icon, title, text) {
    return `<div class="vpm-empty"><b>${icon}</b><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
  }

  function messageMarkup() {
    return `${state.progress ? `<div class="vpm-progress">${esc(state.progress)}</div>` : ''}${state.error ? `<div class="vpm-progress vpm-error">${esc(state.error)}</div>` : ''}`;
  }

  function formatDate(value, withTime = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('fr-FR', withTime ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function localDateTime(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function collectCopies() {
    $$('[data-vpm-copy]').forEach((input) => { state.copies[input.dataset.vpmCopy] = input.value.trim(); });
    state.baseCopy = state.copies[state.networks[0]] || state.baseCopy;
  }

  function syncInputs() {
    state.objective = $('[data-vpm-objective]')?.value || state.objective;
    state.tone = $('[data-vpm-tone]')?.value || state.tone;
    state.cta = $('[data-vpm-cta]')?.value.trim() || state.cta;
    state.scheduleMode = $('[data-vpm-schedule-mode]')?.value || state.scheduleMode;
    state.scheduledAt = $('[data-vpm-scheduled-at]')?.value || state.scheduledAt;
    state.approved = Boolean($('[data-vpm-approved]')?.checked);
    collectCopies();
  }

  async function generateCopy() {
    const event = selectedEvent();
    if (!event || !state.networks.length) return;
    syncInputs();
    state.loading = true;
    state.error = '';
    state.progress = 'Zwit IA adapte le récit à chaque réseau…';
    render();
    try {
      const payload = await jsonApi({ action: 'generate_copy', venueId: venueId(), event, networks: state.networks, tone: state.tone, objective: state.objective, cta: state.cta });
      state.baseCopy = payload.copy?.baseCopy || '';
      state.copies = { ...state.copies, ...(payload.copy?.versions || {}) };
      state.compliance = payload.copy?.compliance || null;
      state.progress = 'Trois versions éditoriales ont été préparées. Vous gardez la main sur chaque mot.';
    } catch (error) {
      state.error = friendlyError(error.message);
      state.progress = '';
    } finally {
      state.loading = false;
      render();
    }
  }

  async function complianceCheck() {
    syncInputs();
    state.error = '';
    state.progress = 'Analyse de compatibilité Facebook, Instagram et TikTok…';
    render();
    try {
      const payload = await jsonApi({ action: 'compliance_check', venueId: venueId(), copy: state.networks.map((network) => state.copies[network] || '').join('\n'), networks: state.networks });
      state.compliance = payload.compliance;
      state.progress = state.compliance?.score >= 85 ? 'La campagne est prête pour une vérification humaine finale.' : 'Zwit a identifié des formulations à relire avant diffusion.';
    } catch (error) {
      state.error = friendlyError(error.message);
      state.progress = '';
    }
    render();
  }

  function campaignObject(status = 'draft') {
    syncInputs();
    const event = selectedEvent();
    const render = selectedRender();
    const project = linkedProject(render);
    return {
      id: state.campaignId || uid(),
      event_id: event?.id || null,
      studio_project_id: project?.id || render?.project_id || null,
      studio_render_id: render?.id || null,
      title: event?.title || 'Campagne Zwit',
      objective: state.objective,
      status,
      base_copy: state.baseCopy || state.copies[state.networks[0]] || '',
      call_to_action: state.cta,
      landing_url: event?.id ? `/membres/?event=${encodeURIComponent(event.id)}` : '',
      selected_networks: state.networks,
      editorial_plan: state.scheduleMode === 'sequence' ? slotsForEvent(event) : [],
      compliance_report: state.compliance || {},
      settings: {
        tone: state.tone,
        copies: { ...state.copies },
        tiktokMode: 'draft',
        networkSettings: { tiktok: { privacyLevel: 'SELF_ONLY', autoAddMusic: false, disableComment: false } }
      }
    };
  }

  function localSaveCampaign(campaign, status = 'draft', slots = []) {
    campaign.status = status;
    const campaigns = state.snapshot.campaigns || [];
    const index = campaigns.findIndex((item) => item.id === campaign.id);
    if (index >= 0) campaigns[index] = campaign;
    else campaigns.unshift(campaign);
    state.snapshot.campaigns = campaigns;
    if (slots.length) {
      const connections = state.snapshot.connections || [];
      const publications = state.snapshot.publications || [];
      for (const slot of slots) {
        for (const network of campaign.selected_networks) {
          const existing = publications.find((item) => item.campaign_id === campaign.id && item.provider === network && item.sequence_code === slot.code);
          const publication = {
            id: existing?.id || uid(), campaign_id: campaign.id, establishment_id: venueId(), provider: network,
            connection_id: connectionFor(network)?.id || null, publication_kind: network === 'tiktok' ? 'draft' : 'feed',
            sequence_code: slot.code, copy: state.copies[network] || campaign.base_copy, media_render_id: campaign.studio_render_id,
            scheduled_at: slot.scheduledAt, status: connectionFor(network)?.status === 'active' ? 'scheduled' : 'draft',
            error_message: connectionFor(network)?.status === 'active' ? '' : 'Connexion officielle requise'
          };
          if (existing) Object.assign(existing, publication); else publications.unshift(publication);
        }
      }
      state.snapshot.publications = publications;
    }
    state.campaignId = campaign.id;
    saveLocal();
  }

  async function saveCampaign() {
    const campaign = campaignObject('draft');
    state.error = '';
    state.progress = 'Enregistrement de la campagne…';
    render();
    try {
      if (state.snapshot.migrationPending) {
        localSaveCampaign(campaign, 'draft');
      } else {
        const payload = await jsonApi({ action: 'save_campaign', venueId: venueId(), campaign });
        state.campaignId = payload.campaignId;
        state.snapshot = payload;
      }
      state.progress = 'Brouillon enregistré dans Zwit Marketing.';
    } catch (error) {
      state.error = friendlyError(error.message);
      state.progress = '';
    }
    render();
  }

  function scheduleSlots(publishNow = false) {
    if (publishNow) return [{ code: 'primary', scheduledAt: new Date().toISOString(), copies: { ...state.copies } }];
    if (state.scheduleMode === 'single') {
      return [{ code: 'primary', scheduledAt: new Date(state.scheduledAt).toISOString(), copies: { ...state.copies } }];
    }
    return slotsForEvent(selectedEvent()).map((slot) => ({ ...slot, copies: { ...state.copies } }));
  }

  async function distribute(publishNow = false) {
    syncInputs();
    const campaign = campaignObject(publishNow ? 'running' : 'scheduled');
    const slots = scheduleSlots(publishNow);
    if (!campaign.event_id || !campaign.studio_render_id) {
      state.error = 'Sélectionnez une soirée et une affiche avant la diffusion.';
      render();
      return;
    }
    if (!state.approved) return;
    state.error = '';
    state.progress = publishNow ? 'Transmission aux plateformes…' : 'Programmation de la campagne…';
    render();
    try {
      if (state.snapshot.migrationPending) {
        localSaveCampaign(campaign, publishNow ? 'ready' : 'scheduled', slots);
        state.progress = 'Campagne préparée. La connexion officielle et la migration Marketing sont nécessaires pour la diffusion externe.';
      } else {
        const payload = await jsonApi({
          action: publishNow ? 'publish_now' : 'schedule_campaign', venueId: venueId(), campaign, slots,
          scheduledAt: slots[0]?.scheduledAt, approved: true
        });
        state.snapshot = payload;
        state.campaignId = payload.campaignId;
        state.progress = publishNow ? 'La demande de publication a été transmise. Le statut sera confirmé par chaque plateforme.' : 'Campagne programmée dans Zwit Marketing.';
      }
    } catch (error) {
      state.error = friendlyError(error.message);
      state.progress = '';
      if (String(error.message).startsWith('social_connection_required')) state.tab = 'connections';
    }
    render();
  }

  async function disconnect(provider) {
    if (!confirm(`Déconnecter ${provider === 'meta' ? 'Facebook et Instagram' : 'TikTok'} de Zwit ?`)) return;
    try {
      const payload = await jsonApi({ action: 'disconnect', venueId: venueId(), provider });
      state.snapshot = payload;
      render();
    } catch (error) {
      state.error = friendlyError(error.message);
      render();
    }
  }

  async function selectMetaAccount(accountId) {
    if (!accountId) return;
    state.progress = 'Association de la Page Facebook et du compte Instagram…';
    render();
    try {
      const payload = await jsonApi({ action: 'select_meta_account', venueId: venueId(), accountId });
      state.snapshot = payload;
      state.progress = 'Compte Meta connecté.';
    } catch (error) {
      state.error = friendlyError(error.message);
      state.progress = '';
    }
    render();
  }

  async function cancelPublication(id) {
    try {
      if (state.snapshot.migrationPending) {
        const publication = state.snapshot.publications?.find((item) => item.id === id);
        if (publication) publication.status = 'cancelled';
        saveLocal();
      } else {
        state.snapshot = await jsonApi({ action: 'cancel_publication', venueId: venueId(), publicationId: id });
      }
      render();
    } catch (error) {
      state.error = friendlyError(error.message);
      render();
    }
  }

  function friendlyError(message) {
    const source = String(message || '');
    if (source === 'marketing_human_approval_required') return 'Validez personnellement la campagne avant sa programmation.';
    if (source === 'marketing_compliance_blocking') return 'La campagne contient une formulation bloquante. Corrigez le texte avant diffusion.';
    if (source === 'marketing_campaign_incomplete') return 'La soirée, l’affiche et au moins un réseau sont obligatoires.';
    if (source.startsWith('social_connection_required')) return `Connectez d’abord les réseaux concernés : ${source.split(':')[1] || ''}.`;
    if (source === 'meta_not_configured') return 'L’application Meta Zwit doit être configurée dans Cloudflare.';
    if (source === 'tiktok_not_configured') return 'L’application TikTok Zwit doit être configurée dans Cloudflare.';
    if (source === 'social_scheduler_not_configured') return 'Le planificateur Cloudflare doit être configuré avant diffusion.';
    return source || 'Zwit Marketing est momentanément indisponible.';
  }

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-vpm-tab]');
    if (tab) { event.preventDefault(); syncInputs(); state.tab = tab.dataset.vpmTab; render(); return; }
    if (event.target.closest('[data-vpm-new]')) { event.preventDefault(); state.tab = 'create'; state.campaignId = ''; state.baseCopy = ''; state.copies = { facebook: '', instagram: '', tiktok: '' }; state.compliance = null; state.approved = false; render(); return; }
    const renderButton = event.target.closest('[data-vpm-render]');
    if (renderButton) { state.renderId = renderButton.dataset.vpmRender; render(); return; }
    const copyTab = event.target.closest('[data-vpm-copy-tab]');
    if (copyTab) {
      event.preventDefault();
      $$('[data-vpm-copy-tab]').forEach((button) => button.classList.toggle('active', button === copyTab));
      $$('[data-vpm-copy-panel]').forEach((panel) => { panel.hidden = panel.dataset.vpmCopyPanel !== copyTab.dataset.vpmCopyTab; });
      return;
    }
    if (event.target.closest('[data-vpm-generate]')) { event.preventDefault(); generateCopy(); return; }
    if (event.target.closest('[data-vpm-check]')) { event.preventDefault(); complianceCheck(); return; }
    if (event.target.closest('[data-vpm-save]')) { event.preventDefault(); saveCampaign(); return; }
    if (event.target.closest('[data-vpm-schedule]')) { event.preventDefault(); distribute(false); return; }
    if (event.target.closest('[data-vpm-publish]')) { event.preventDefault(); distribute(true); return; }
    if (event.target.closest('[data-open-studio]')) {
      event.preventDefault();
      const studio = $('[data-pro-studio-nav]');
      state.open = false;
      studio?.click();
      return;
    }
    const disconnectButton = event.target.closest('[data-vpm-disconnect]');
    if (disconnectButton) { event.preventDefault(); disconnect(disconnectButton.dataset.vpmDisconnect); return; }
    const cancel = event.target.closest('[data-vpm-cancel]');
    if (cancel) { event.preventDefault(); cancelPublication(cancel.dataset.vpmCancel); }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-vpm-event]')) { syncInputs(); state.eventId = event.target.value; chooseDefaults(); render(); }
    if (event.target.matches('[data-vpm-network]')) {
      syncInputs();
      const network = event.target.dataset.vpmNetwork;
      state.networks = event.target.checked ? [...new Set([...state.networks, network])] : state.networks.filter((item) => item !== network);
      state.compliance = null;
      render();
    }
    if (event.target.matches('[data-vpm-schedule-mode]')) { syncInputs(); render(); }
    if (event.target.matches('[data-vpm-approved]')) { state.approved = event.target.checked; render(); }
    if (event.target.matches('[data-vpm-meta-account]')) selectMetaAccount(event.target.value);
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-vpm-copy]')) {
      state.copies[event.target.dataset.vpmCopy] = event.target.value;
      const counter = event.target.parentElement?.querySelector('.vpm-counter');
      if (counter) counter.textContent = `${event.target.value.length} caractères`;
      state.compliance = null;
    }
  });

  function install() {
    installStyles();
    const ready = ensureNav();
    if (ready && !state.installed) {
      state.installed = true;
      closeOnNativeNavigation();
      const query = new URLSearchParams(location.search).get('velvet_marketing');
      if (query) setTimeout(() => openMarketing(query === 'select-meta' || query === 'connected' || query === 'connection-error' ? 'connections' : 'create'), 500);
    }
    return ready;
  }

  let attempts = 0;
  state.installTimer = setInterval(() => {
    attempts += 1;
    if (install() || attempts > 180) clearInterval(state.installTimer);
  }, 100);
  install();
})();
