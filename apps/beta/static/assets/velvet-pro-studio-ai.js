(() => {
  'use strict';

  const API_URL = '/api/pro/studio-ai';
  const LOCAL_PREFIX = 'velvet_pro_studio_v3_';
  const FORMATS = {
    '9:16': { width: 1080, height: 1920, label: 'Story · 9:16' },
    '4:5': { width: 1080, height: 1350, label: 'Post · 4:5' },
    '1:1': { width: 1080, height: 1080, label: 'Carré · 1:1' },
    '16:9': { width: 1600, height: 900, label: 'Bannière · 16:9' },
    a4: { width: 1754, height: 2480, label: 'Impression · A4' }
  };
  const DEFAULT_TEMPLATES = [
    { template_code: 'neon-club', name: 'Néon Club', description: 'Rose et bleu électrique, dense et festif.', configuration: { visualStyle: 'neon club, magenta and electric blue, premium nightlife', layout: 'event' } },
    { template_code: 'velvet-luxe', name: 'Zwit Luxe', description: 'Bordeaux, noir et champagne, sensuel et élégant.', configuration: { visualStyle: 'luxury burgundy black champagne nightlife', layout: 'balanced' } },
    { template_code: 'electric-night', name: 'Electric Night', description: 'Lasers, lumière et énergie pour DJ et performers.', configuration: { visualStyle: 'electric premium club, laser and particles', layout: 'rich' } },
    { template_code: 'dark-desire', name: 'Dark Desire', description: 'Sombre, mystérieux et sophistiqué.', configuration: { visualStyle: 'dark sophisticated cinematic club', layout: 'balanced' } },
    { template_code: 'summer-pool', name: 'Summer Pool', description: 'Lumineux, estival et festif.', configuration: { visualStyle: 'premium tropical pool party nightlife', layout: 'rich' } }
  ];

  const state = {
    open: false,
    tab: 'create',
    loading: false,
    snapshot: null,
    venueId: '',
    brand: null,
    project: null,
    eventPhotos: [],
    generated: [],
    selectedRender: null,
    progress: '',
    error: '',
    migrationPending: false,
    installTimer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
  const uid = () => crypto.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function venueId() {
    return $('#venueSelect')?.value || state.venueId || '';
  }

  function localKey() {
    return `${LOCAL_PREFIX}${venueId() || 'unknown'}`;
  }

  function localSnapshot() {
    try {
      const parsed = JSON.parse(localStorage.getItem(localKey()) || '{}');
      return {
        brand: parsed.brand || null,
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        renders: Array.isArray(parsed.renders) ? parsed.renders : [],
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        templates: DEFAULT_TEMPLATES,
        migrationPending: true,
        capabilities: { workersAI: true, v1: true, v2: true, v3: true }
      };
    } catch {
      return { brand: null, projects: [], renders: [], assets: [], templates: DEFAULT_TEMPLATES, migrationPending: true };
    }
  }

  function saveLocalSnapshot(snapshot) {
    try {
      localStorage.setItem(localKey(), JSON.stringify({
        brand: snapshot.brand,
        projects: snapshot.projects || [],
        renders: (snapshot.renders || []).map((render) => ({ ...render, previewUrl: render.previewUrl?.startsWith('data:') ? render.previewUrl : '' })),
        assets: (snapshot.assets || []).map((asset) => ({ ...asset, previewUrl: asset.previewUrl?.startsWith('data:') ? asset.previewUrl : '' }))
      }));
    } catch {}
  }

  function currentBrand() {
    return state.brand || state.snapshot?.brand || {
      primary_color: '#7D294C', secondary_color: '#0D0D0D', accent_color: '#D5B477', background_color: '#09090B',
      typography_style: 'editorial-premium', visual_style: 'premium-club', density: 'balanced', brand_prompt: '',
      fixed_information: {}, recurring_features: [], locked_rules: {}
    };
  }

  async function apiJson(body, method = 'POST') {
    const options = { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' } };
    if (method !== 'GET') options.body = JSON.stringify(body);
    const url = method === 'GET' ? `${API_URL}?venueId=${encodeURIComponent(venueId())}` : API_URL;
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
    return payload;
  }

  async function apiForm(form) {
    const response = await fetch(API_URL, { method: 'POST', credentials: 'same-origin', body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
    return payload;
  }

  function installStyles() {
    if ($('#vpsaiStyles')) return;
    const style = document.createElement('style');
    style.id = 'vpsaiStyles';
    style.textContent = `
      .vpsai-nav-badge{margin-left:auto;padding:3px 6px;border:1px solid #d5b47755;border-radius:999px;color:#d5b477;font-size:8px;font-style:normal}.vpsai-view{min-height:calc(100vh - 125px)}
      .vpsai-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(310px,.8fr);gap:20px;padding:28px;border:1px solid #d5b47733;border-radius:28px;background:radial-gradient(circle at 88% 0,#a8346852,transparent 34%),linear-gradient(145deg,#171316,#49182e);box-shadow:0 30px 80px #0006}.vpsai-hero h1{margin:8px 0 12px;font-size:clamp(42px,5vw,68px);line-height:.98}.vpsai-hero p{max-width:760px;color:#c0b8b4;line-height:1.65}.vpsai-version{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.vpsai-version span{padding:7px 10px;border:1px solid #ffffff16;border-radius:999px;background:#09090b66;color:#ded6d1;font-size:10px}.vpsai-hero-side{display:grid;align-content:center;gap:10px}.vpsai-hero-side button{width:100%;padding:15px;border-radius:15px}.vpsai-note{padding:12px;border:1px solid #ffffff13;border-radius:14px;background:#09090b73;color:#aaa3a0;font-size:11px;line-height:1.5}
      .vpsai-tabs{display:flex;gap:7px;overflow:auto;margin:20px 0 14px;padding:5px;border:1px solid #ffffff12;border-radius:16px;background:#101013}.vpsai-tabs button{border:0;border-radius:12px;padding:11px 15px;background:transparent;color:#9f9995;white-space:nowrap;font-weight:700}.vpsai-tabs button.active{background:#ffffff0d;color:#fff;box-shadow:inset 0 0 0 1px #ffffff12}.vpsai-grid{display:grid;grid-template-columns:minmax(330px,.78fr) minmax(480px,1.22fr);gap:16px}.vpsai-panel{border:1px solid #ffffff12;border-radius:22px;background:linear-gradient(145deg,#ffffff09,#ffffff04);padding:19px}.vpsai-panel h2{margin:5px 0 15px;font-size:29px}.vpsai-panel h3{margin:6px 0 12px;font-size:21px}.vpsai-section{padding:15px 0;border-top:1px solid #ffffff0c}.vpsai-section:first-of-type{border-top:0;padding-top:0}.vpsai-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vpsai-field{display:grid;gap:6px;color:#aaa4a0;font-size:10px}.vpsai-field.wide{grid-column:1/-1}.vpsai-field input,.vpsai-field select,.vpsai-field textarea{width:100%;padding:11px 12px;border:1px solid #ffffff14;border-radius:12px;background:#121215;color:#fff;outline:none}.vpsai-field textarea{min-height:88px;resize:vertical}.vpsai-field input:focus,.vpsai-field select:focus,.vpsai-field textarea:focus{border-color:#d5b47766}.vpsai-color-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.vpsai-color{display:grid;gap:6px;color:#928c88;font-size:9px}.vpsai-color input{width:100%;height:42px;padding:3px;border:1px solid #ffffff15;border-radius:10px;background:#111}.vpsai-upload{position:relative;display:grid;place-items:center;min-height:110px;padding:13px;border:1px dashed #d5b47755;border-radius:15px;background:#d5b47708;text-align:center;color:#bdb5b0;overflow:hidden}.vpsai-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}.vpsai-upload img{max-width:100%;max-height:100px;object-fit:contain}.vpsai-photo-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:9px}.vpsai-photo{position:relative;height:105px;border:1px solid #ffffff13;border-radius:13px;overflow:hidden;background:#101013}.vpsai-photo img{width:100%;height:100%;object-fit:cover}.vpsai-photo button{position:absolute;right:5px;top:5px;width:25px;height:25px;border:0;border-radius:50%;background:#09090bd9;color:#fff}.vpsai-checks{display:flex;flex-wrap:wrap;gap:7px}.vpsai-check{display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid #ffffff12;border-radius:999px;background:#ffffff05;color:#c4bcb8;font-size:10px}.vpsai-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.vpsai-btn{border:0;border-radius:999px;padding:11px 16px;background:linear-gradient(135deg,#963961,#7d294c);color:#fff;font-weight:800}.vpsai-btn.gold{background:linear-gradient(135deg,#e1c678,#b88940);color:#171109}.vpsai-btn.ghost{border:1px solid #ffffff17;background:#ffffff07;color:#eee}.vpsai-btn:disabled{opacity:.48;cursor:wait}.vpsai-progress{margin:12px 0 0;padding:11px 13px;border:1px solid #d5b47735;border-radius:12px;background:#d5b4770a;color:#d9c38f;font-size:11px}.vpsai-error{border-color:#e17b9355;background:#e17b9310;color:#f0a5b5}
      .vpsai-preview-stage{position:sticky;top:92px;display:grid;place-items:center;min-height:620px;border:1px solid #ffffff12;border-radius:20px;background:radial-gradient(circle at 50% 25%,#4c1d34,#09090b 65%);overflow:hidden}.vpsai-preview-stage canvas{display:block;max-width:94%;max-height:78vh;border-radius:12px;box-shadow:0 25px 80px #000b}.vpsai-empty{text-align:center;color:#8f8885;max-width:360px}.vpsai-empty b{display:block;margin-bottom:10px;color:#d5b477;font:500 48px Georgia}.vpsai-render-actions{position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.vpsai-render-actions button,.vpsai-render-actions a{padding:9px 12px;border:1px solid #ffffff18;border-radius:999px;background:#09090bdc;color:#fff;text-decoration:none;font-size:10px;font-weight:800;backdrop-filter:blur(12px)}
      .vpsai-variants{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.vpsai-card{overflow:hidden;border:1px solid #ffffff13;border-radius:18px;background:#111114}.vpsai-card-preview{aspect-ratio:4/5;background:#09090b;overflow:hidden}.vpsai-card-preview img,.vpsai-card-preview video{width:100%;height:100%;object-fit:cover}.vpsai-card-copy{padding:13px}.vpsai-card-copy h3{margin:0 0 5px;font-size:17px}.vpsai-card-copy p{margin:0;color:#918b87;font-size:10px;line-height:1.45}.vpsai-card-actions{display:flex;gap:6px;margin-top:10px}.vpsai-card-actions button,.vpsai-card-actions a{flex:1;border:1px solid #ffffff14;border-radius:10px;padding:8px;background:#ffffff06;color:#eee;text-align:center;text-decoration:none;font-size:9px;font-weight:800}.vpsai-template-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.vpsai-template{min-height:210px;padding:18px;border:1px solid #ffffff13;border-radius:19px;background:radial-gradient(circle at 90% 0,var(--accent,#7d294c55),transparent 45%),#121215;cursor:pointer}.vpsai-template.selected{border-color:#d5b47788;box-shadow:0 0 0 2px #d5b4771f}.vpsai-template b{display:block;margin:58px 0 8px;font:500 24px Georgia}.vpsai-template p{margin:0;color:#9f9995;font-size:11px;line-height:1.5}.vpsai-brand-preview{display:grid;grid-template-columns:100px 1fr;gap:14px;align-items:center;padding:14px;border:1px solid #ffffff12;border-radius:16px;background:#0e0e11}.vpsai-brand-preview img{width:100px;height:100px;object-fit:contain;border-radius:13px;background:#ffffff05}.vpsai-brand-preview b{font:500 25px Georgia}.vpsai-library-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:14px}.vpsai-library-head h2{margin:0}.vpsai-badge{display:inline-flex;padding:5px 8px;border:1px solid #ffffff14;border-radius:999px;color:#bbb3ae;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.vpsai-badge.ready{color:#83cda1;border-color:#72d3a444}.vpsai-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      @media(max-width:1050px){.vpsai-hero,.vpsai-grid{grid-template-columns:1fr}.vpsai-preview-stage{position:relative;top:auto;min-height:500px}.vpsai-variants,.vpsai-template-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.vpsai-hero{padding:20px}.vpsai-form,.vpsai-color-row{grid-template-columns:1fr}.vpsai-variants,.vpsai-template-grid{grid-template-columns:1fr}.vpsai-photo-list{grid-template-columns:repeat(2,1fr)}.vpsai-actions{flex-direction:column}.vpsai-actions>*{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureNav() {
    const nav = $('#nav');
    if (!nav) return false;
    let button = $('[data-pro-studio-nav]', nav);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.proStudioNav = 'true';
      button.innerHTML = '<i>✦</i>Studio IA <em class="vpsai-nav-badge">V1–V3</em>';
      button.addEventListener('click', openStudio);
      nav.appendChild(button);
    }
    return true;
  }

  function markNav() {
    $$('#nav button').forEach((button) => button.classList.toggle('active', Boolean(button.dataset.proStudioNav) && state.open));
  }

  async function loadSnapshot(force = false) {
    const nextVenue = venueId();
    if (!nextVenue) throw new Error('Aucun établissement actif.');
    if (!force && state.snapshot && state.venueId === nextVenue) return state.snapshot;
    state.venueId = nextVenue;
    try {
      const snapshot = await apiJson(null, 'GET');
      state.migrationPending = snapshot.migrationPending === true;
      state.snapshot = snapshot.migrationPending ? { ...localSnapshot(), capabilities: snapshot.capabilities || {} } : snapshot;
    } catch (error) {
      state.migrationPending = true;
      state.snapshot = localSnapshot();
      if (!String(error.message).includes('pro_studio')) throw error;
    }
    state.brand = state.snapshot.brand || currentBrand();
    return state.snapshot;
  }

  async function openStudio() {
    state.open = true;
    state.error = '';
    state.progress = 'Connexion au Studio IA…';
    markNav();
    const title = $('#pageTitle');
    if (title) title.textContent = 'Studio IA';
    const content = $('#content');
    if (content) content.innerHTML = '<section class="card" style="max-width:760px;margin:8vh auto;text-align:center"><div class="ey">Zwit Pro Studio</div><h1>Préparation du studio…</h1><p class="lead">Chargement de votre identité visuelle, de vos modèles et de votre bibliothèque.</p></section>';
    try {
      await loadSnapshot(true);
      renderStudio();
    } catch (error) {
      state.error = error.message;
      renderStudio();
    }
  }

  function closeOnNativeNavigation() {
    const nav = $('#nav');
    nav?.addEventListener('click', (event) => {
      if (!event.target.closest('[data-pro-studio-nav]')) state.open = false;
    }, true);
    $('#venueSelect')?.addEventListener('change', () => {
      state.snapshot = null;
      state.brand = null;
      state.project = null;
      state.generated = [];
      if (state.open) setTimeout(openStudio, 350);
    });
  }

  function tabsMarkup() {
    const tabs = [
      ['create', 'Créer une affiche'],
      ['library', 'Bibliothèque'],
      ['brand', 'Identité visuelle'],
      ['templates', 'Modèles'],
      ['animate', 'Affiches animées']
    ];
    return `<nav class="vpsai-tabs">${tabs.map(([id, label]) => `<button type="button" class="${state.tab === id ? 'active' : ''}" data-vpsai-tab="${id}">${label}</button>`).join('')}</nav>`;
  }

  function heroMarkup() {
    const venueName = $('#venueSelect option:checked')?.textContent || 'Votre établissement';
    return `<section class="vpsai-hero"><div><div class="ey">ZWIT PRO · GRAPHISTE IA INTÉGRÉ</div><h1>Vos soirées.<br>Votre identité.</h1><p>Créez des affiches professionnelles qui respectent automatiquement le logo, les couleurs et l’univers de ${esc(venueName)}. L’IA réalise le décor ; Zwit compose exactement vos textes, dates, photos et informations.</p><div class="vpsai-version"><span>V1 · Affiches HD</span><span>V2 · Kits multi-formats</span><span>V3 · Affiches animées</span><span>Textes 100 % exacts</span></div></div><div class="vpsai-hero-side"><button class="vpsai-btn gold" data-vpsai-new>Créer une nouvelle soirée</button><button class="vpsai-btn ghost" data-vpsai-tab="brand">Configurer l’identité permanente</button><div class="vpsai-note">${state.migrationPending ? '<b>Migration Supabase 0043 à appliquer.</b><br>Le Studio utilise temporairement la mémoire locale de ce navigateur.' : '<b>Mémoire Zwit active.</b><br>Votre identité, vos projets et vos rendus sont enregistrés dans votre espace professionnel privé.'}</div></div></section>`;
  }

  function renderStudio() {
    if (!state.open) return;
    installStyles();
    markNav();
    const content = $('#content');
    if (!content) return;
    content.innerHTML = `<main class="vpsai-view">${heroMarkup()}${tabsMarkup()}<section data-vpsai-body>${tabMarkup()}</section></main>`;
    hydrateDynamicInputs();
  }

  function tabMarkup() {
    if (state.tab === 'brand') return brandMarkup();
    if (state.tab === 'library') return libraryMarkup();
    if (state.tab === 'templates') return templatesMarkup();
    if (state.tab === 'animate') return animateMarkup();
    return createMarkup();
  }

  function projectDraft() {
    if (state.project) return state.project;
    const brand = currentBrand();
    return {
      id: uid(),
      title: '',
      theme: '',
      output_type: 'social_kit',
      status: 'draft',
      event_payload: {
        title: '', subtitle: '', theme: '', date: '', endDate: '', startTime: '21:00', endTime: '04:00',
        description: '', guest: '', dj: '', promotion: '', dressCode: '', audience: 'Couples, femmes et membres sélectionnés',
        address: brand.fixed_information?.address || '', phone: brand.fixed_information?.phone || '', website: brand.fixed_information?.website || '',
        amenities: brand.recurring_features || []
      },
      creative_payload: {
        brief: '', style: brand.visual_style || 'premium-club', density: brand.density || 'balanced', template: 'velvet-luxe',
        formats: ['4:5', '9:16'], variants: 2
      }
    };
  }

  function createMarkup() {
    const project = projectDraft();
    const event = project.event_payload;
    const creative = project.creative_payload;
    const templates = state.snapshot?.templates?.length ? state.snapshot.templates : DEFAULT_TEMPLATES;
    return `<div class="vpsai-grid"><section class="vpsai-panel"><div class="ey">NOUVELLE CRÉATION</div><h2>Construire l’affiche</h2>
      <div class="vpsai-section"><h3>1. La soirée</h3><div class="vpsai-form">
        ${field('Titre principal', 'event.title', event.title, 'ex. Nuit Néon')}${field('Sous-titre', 'event.subtitle', event.subtitle, 'ex. Un week-end à ne pas manquer')}
        ${field('Thème', 'event.theme', event.theme, 'ex. Harley Folie')}${field('Public', 'event.audience', event.audience)}
        ${field('Date', 'event.date', event.date, '', 'date')}${field('Seconde date éventuelle', 'event.endDate', event.endDate, '', 'date')}
        ${field('Heure de début', 'event.startTime', event.startTime, '', 'time')}${field('Heure de fin', 'event.endTime', event.endTime, '', 'time')}
        ${field('Invité(e), anniversaire ou performer', 'event.guest', event.guest, 'ex. Brenda fête ses 32 ans')}${field('DJ / artiste', 'event.dj', event.dj, 'ex. DJ Kev')}
        ${textarea('Description et ambiance', 'event.description', event.description, 'Décrivez ce qui rend la soirée unique…')}
        ${textarea('Offre / promotion', 'event.promotion', event.promotion, 'ex. -10 € sur l’entrée vendredi et samedi')}
        ${textarea('Dress code', 'event.dressCode', event.dressCode, 'ex. Deux petites couettes pour entrer dans le thème')}
      </div></div>
      <div class="vpsai-section"><h3>2. Photos à intégrer</h3><p class="lead" style="font-size:12px">Ajoutez les vraies photos des invités, du DJ ou de l’établissement. Zwit les composera sans demander à l’IA de recréer les personnes.</p><label class="vpsai-upload"><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-vpsai-event-photos><span>＋ Ajouter jusqu’à 3 photos<br><small>Portraits, DJ, couple, décor ou visuel thématique</small></span></label><div class="vpsai-photo-list">${state.eventPhotos.map((item, index) => photoMarkup(item, index)).join('')}</div></div>
      <div class="vpsai-section"><h3>3. Direction artistique</h3><div class="vpsai-form">
        <label class="vpsai-field"><span>Modèle</span><select data-path="creative.template">${templates.map((item) => `<option value="${esc(item.template_code)}" ${creative.template === item.template_code ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
        <label class="vpsai-field"><span>Densité</span><select data-path="creative.density"><option value="minimal" ${creative.density === 'minimal' ? 'selected' : ''}>Minimaliste</option><option value="balanced" ${creative.density === 'balanced' ? 'selected' : ''}>Équilibrée</option><option value="rich" ${creative.density === 'rich' ? 'selected' : ''}>Riche</option><option value="event" ${creative.density === 'event' ? 'selected' : ''}>Très événementielle</option></select></label>
        ${textarea('Brief libre pour l’IA', 'creative.brief', creative.brief, 'Ambiance néon, festive, très impactante, premium et lisible sur les réseaux sociaux…')}
      </div><div class="vpsai-inline" style="margin-top:12px"><b style="font-size:11px;color:#aaa">Formats :</b>${Object.entries(FORMATS).map(([id, value]) => `<label class="vpsai-check"><input type="checkbox" data-format="${id}" ${creative.formats?.includes(id) ? 'checked' : ''}>${value.label}</label>`).join('')}</div><div class="vpsai-inline" style="margin-top:10px"><b style="font-size:11px;color:#aaa">Variantes :</b>${[1,2,3,4].map((count) => `<label class="vpsai-check"><input type="radio" name="vpsaiVariants" value="${count}" ${Number(creative.variants || 2) === count ? 'checked' : ''}>${count}</label>`).join('')}</div></div>
      <div class="vpsai-actions"><button class="vpsai-btn gold" data-vpsai-generate ${state.loading ? 'disabled' : ''}>${state.loading ? 'Création en cours…' : 'Générer les affiches'}</button><button class="vpsai-btn ghost" data-vpsai-save-draft>Enregistrer le brouillon</button></div>${state.progress ? `<div class="vpsai-progress">${esc(state.progress)}</div>` : ''}${state.error ? `<div class="vpsai-progress vpsai-error">${esc(state.error)}</div>` : ''}
    </section><section class="vpsai-panel"><div class="ey">APERÇU HAUTE DÉFINITION</div><h2>Résultat</h2><div class="vpsai-preview-stage" data-vpsai-stage>${previewMarkup()}</div></section></div>`;
  }

  function field(label, path, value, placeholder = '', type = 'text') {
    return `<label class="vpsai-field"><span>${esc(label)}</span><input type="${type}" data-path="${path}" value="${esc(value || '')}" placeholder="${esc(placeholder)}"></label>`;
  }

  function textarea(label, path, value, placeholder = '') {
    return `<label class="vpsai-field wide"><span>${esc(label)}</span><textarea data-path="${path}" placeholder="${esc(placeholder)}">${esc(value || '')}</textarea></label>`;
  }

  function photoMarkup(item, index) {
    return `<figure class="vpsai-photo"><img src="${esc(item.url)}" alt="Photo fournie"><button type="button" data-remove-photo="${index}" aria-label="Retirer">×</button></figure>`;
  }

  function previewMarkup() {
    if (!state.selectedRender && !state.generated.length) return '<div class="vpsai-empty"><b>✦</b><strong>Votre affiche apparaîtra ici</strong><p>Le décor sera généré par l’IA. Le logo, les photos et tous les textes seront ensuite composés exactement par Zwit.</p></div>';
    const render = state.selectedRender || state.generated[0];
    return `<canvas data-vpsai-main-canvas></canvas><div class="vpsai-render-actions"><button data-vpsai-download="png">Télécharger PNG</button><button data-vpsai-download="jpg">Télécharger JPG</button><button data-vpsai-tab="animate">Animer cette affiche</button><button data-vpsai-show-all>Voir toutes les variantes</button></div>`;
  }

  function brandMarkup() {
    const brand = currentBrand();
    const fixed = brand.fixed_information || {};
    const features = Array.isArray(brand.recurring_features) ? brand.recurring_features.join(', ') : '';
    return `<div class="vpsai-grid"><section class="vpsai-panel"><div class="ey">RÉGLAGE PERMANENT</div><h2>Identité de l’établissement</h2><p class="lead">Ces éléments seront repris automatiquement à chaque création. Vous ne les renseignerez qu’une seule fois.</p>
      <div class="vpsai-section"><h3>Logo officiel</h3><label class="vpsai-upload"><input type="file" accept="image/png,image/jpeg,image/webp" data-vpsai-logo><div>${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="Logo">` : '＋ Ajouter le logo principal<br><small>PNG transparent recommandé</small>'}</div></label></div>
      <div class="vpsai-section"><h3>Charte graphique</h3><div class="vpsai-color-row">${colorInput('Principale','primary_color',brand.primary_color)}${colorInput('Secondaire','secondary_color',brand.secondary_color)}${colorInput('Accent','accent_color',brand.accent_color)}${colorInput('Fond','background_color',brand.background_color)}</div><div class="vpsai-form" style="margin-top:12px"><label class="vpsai-field"><span>Style visuel</span><select data-brand="visual_style"><option value="premium-club" ${brand.visual_style==='premium-club'?'selected':''}>Club premium</option><option value="neon-club" ${brand.visual_style==='neon-club'?'selected':''}>Néon festif</option><option value="luxury-editorial" ${brand.visual_style==='luxury-editorial'?'selected':''}>Luxe éditorial</option><option value="dark-cinematic" ${brand.visual_style==='dark-cinematic'?'selected':''}>Sombre cinématographique</option><option value="electric" ${brand.visual_style==='electric'?'selected':''}>Électro énergique</option></select></label><label class="vpsai-field"><span>Typographie</span><select data-brand="typography_style"><option value="editorial-premium">Éditoriale premium</option><option value="neon-display">Néon / impact</option><option value="minimal-luxury">Minimaliste luxe</option><option value="club-condensed">Club condensée</option></select></label></div>${textareaBrand('ADN visuel permanent','brand_prompt',brand.brand_prompt,'Décrivez l’ambiance qui doit rester commune à toutes vos affiches…')}</div>
      <div class="vpsai-section"><h3>Informations fixes</h3><div class="vpsai-form">${brandField('Adresse','address',fixed.address)}${brandField('Téléphone','phone',fixed.phone)}${brandField('Site web','website',fixed.website)}${brandField('Réseaux sociaux','social',fixed.social)}${brandField('Équipements récurrents','features',features,'Jacuzzi, parking sécurisé, apéro dînatoire…')}</div></div>
      <div class="vpsai-actions"><button class="vpsai-btn gold" data-vpsai-save-brand>Enregistrer l’identité visuelle</button></div>${state.progress ? `<div class="vpsai-progress">${esc(state.progress)}</div>` : ''}${state.error ? `<div class="vpsai-progress vpsai-error">${esc(state.error)}</div>` : ''}
    </section><section class="vpsai-panel"><div class="ey">APERÇU DE MARQUE</div><h2>Cohérence garantie</h2><div class="vpsai-brand-preview">${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="Logo">` : '<div style="display:grid;place-items:center;width:100px;height:100px;border-radius:13px;background:#ffffff07;color:#d5b477;font:500 34px Georgia">V</div>'}<div><b>${esc($('#venueSelect option:checked')?.textContent || 'Votre établissement')}</b><p class="lead" style="margin:7px 0 0;font-size:12px">${esc(brand.brand_prompt || 'Ajoutez votre ADN visuel pour guider toutes les créations.')}</p></div></div><div style="margin-top:18px;height:360px;border-radius:19px;background:radial-gradient(circle at 72% 24%,${esc(brand.primary_color)}88,transparent 28%),linear-gradient(145deg,${esc(brand.background_color)},${esc(brand.secondary_color)});position:relative;overflow:hidden"><div style="position:absolute;inset:28px;border:1px solid ${esc(brand.accent_color)}55;border-radius:18px"></div><div style="position:absolute;left:35px;right:35px;bottom:34px"><small style="color:${esc(brand.accent_color)};letter-spacing:.16em">IDENTITÉ PERMANENTE</small><h2 style="font-size:43px;margin:8px 0;color:#fff">Votre univers restera reconnaissable.</h2></div></div></section></div>`;
  }

  function colorInput(label, key, value) {
    return `<label class="vpsai-color"><span>${label}</span><input type="color" data-brand="${key}" value="${esc(value)}"></label>`;
  }
  function textareaBrand(label, key, value, placeholder) {
    return `<label class="vpsai-field wide" style="margin-top:12px"><span>${label}</span><textarea data-brand="${key}" placeholder="${esc(placeholder)}">${esc(value || '')}</textarea></label>`;
  }
  function brandField(label, key, value, placeholder='') {
    return `<label class="vpsai-field"><span>${label}</span><input data-fixed="${key}" value="${esc(value || '')}" placeholder="${esc(placeholder)}"></label>`;
  }

  function templatesMarkup() {
    const templates = state.snapshot?.templates?.length ? state.snapshot.templates : DEFAULT_TEMPLATES;
    const selected = projectDraft().creative_payload.template;
    return `<section class="vpsai-panel"><div class="vpsai-library-head"><div><div class="ey">DIRECTION ARTISTIQUE</div><h2>Modèles Zwit Pro</h2><p class="lead">Choisissez un point de départ. Votre propre charte reste prioritaire.</p></div></div><div class="vpsai-template-grid">${templates.map((item,index) => `<article class="vpsai-template ${selected===item.template_code?'selected':''}" data-template="${esc(item.template_code)}" style="--accent:${['#f42a8799','#7d294c99','#2689ff99','#2c1b3299','#ef9a3d99'][index%5]}"><span class="vpsai-badge">${item.is_system===false?'Personnel':'Zwit'}</span><b>${esc(item.name)}</b><p>${esc(item.description)}</p></article>`).join('')}</div></section>`;
  }

  function libraryMarkup() {
    const projects = state.snapshot?.projects || [];
    const renders = state.snapshot?.renders || [];
    return `<section class="vpsai-panel"><div class="vpsai-library-head"><div><div class="ey">HISTORIQUE</div><h2>Bibliothèque de créations</h2><p class="lead">Dupliquez une ancienne soirée et ne changez que la date, le thème ou les invités.</p></div><button class="vpsai-btn gold" data-vpsai-new>Nouvelle affiche</button></div>${projects.length ? `<div class="vpsai-variants">${projects.map((project) => {
      const render = renders.find((item) => item.project_id === project.id);
      return `<article class="vpsai-card"><div class="vpsai-card-preview">${render?.previewUrl ? `<img src="${esc(render.previewUrl)}" alt="Affiche">` : '<div style="height:100%;display:grid;place-items:center;color:#d5b477;font:500 44px Georgia;background:radial-gradient(circle at 60% 25%,#7d294c88,#09090b 65%)">V</div>'}</div><div class="vpsai-card-copy"><span class="vpsai-badge ${project.status==='ready'?'ready':''}">${esc(project.status)}</span><h3>${esc(project.title)}</h3><p>${esc(project.theme || project.event_payload?.theme || 'Création Zwit Pro')}</p><div class="vpsai-card-actions"><button data-open-project="${project.id}">Ouvrir</button><button data-duplicate-project="${project.id}">Dupliquer</button><button data-delete-project="${project.id}">Supprimer</button></div></div></article>`;
    }).join('')}</div>` : '<div class="vpsai-empty" style="padding:70px 20px"><b>✦</b><strong>Aucune affiche enregistrée</strong><p>Votre première création apparaîtra ici avec toutes ses déclinaisons.</p></div>'}</section>`;
  }

  function animateMarkup() {
    const render = state.selectedRender || state.generated[0] || state.snapshot?.renders?.find((item) => item.previewUrl);
    return `<div class="vpsai-grid"><section class="vpsai-panel"><div class="ey">V3 · MOTION DESIGN</div><h2>Affiche animée</h2><p class="lead">Transformez une affiche validée en teaser social : zoom cinématographique, pulsation lumineuse, particules et révélation progressive.</p><div class="vpsai-section"><div class="vpsai-form"><label class="vpsai-field"><span>Durée</span><select data-vpsai-motion-duration><option value="6">6 secondes</option><option value="8" selected>8 secondes</option><option value="12">12 secondes</option></select></label><label class="vpsai-field"><span>Mouvement</span><select data-vpsai-motion-style><option value="cinematic">Cinématique premium</option><option value="neon">Pulsation néon</option><option value="energy">Énergie club</option><option value="soft">Élégant et lent</option></select></label></div></div><div class="vpsai-actions"><button class="vpsai-btn gold" data-vpsai-animate ${render ? '' : 'disabled'}>Créer le teaser vidéo</button><button class="vpsai-btn ghost" data-vpsai-tab="library">Choisir une autre affiche</button></div>${state.progress ? `<div class="vpsai-progress">${esc(state.progress)}</div>` : ''}${state.error ? `<div class="vpsai-progress vpsai-error">${esc(state.error)}</div>` : ''}</section><section class="vpsai-panel"><div class="vpsai-preview-stage">${render?.previewUrl ? `<img src="${esc(render.previewUrl)}" style="max-width:94%;max-height:74vh;border-radius:12px;box-shadow:0 25px 80px #000b" alt="Affiche à animer">` : '<div class="vpsai-empty"><b>▶</b><strong>Choisissez d’abord une affiche</strong><p>Une création validée est nécessaire pour produire le teaser animé.</p></div>'}</div></section></div>`;
  }

  function hydrateDynamicInputs() {
    if (state.tab === 'create' && state.selectedRender) drawSelectedOnMainCanvas();
  }

  function updateDraftFromInputs() {
    const project = projectDraft();
    $$('[data-path]').forEach((input) => {
      const [scope, key] = input.dataset.path.split('.');
      const target = scope === 'event' ? project.event_payload : project.creative_payload;
      target[key] = input.value;
    });
    project.title = project.event_payload.title || project.title || 'Nouvelle affiche';
    project.theme = project.event_payload.theme || '';
    project.creative_payload.formats = $$('[data-format]:checked').map((input) => input.dataset.format);
    project.creative_payload.variants = Number($('input[name="vpsaiVariants"]:checked')?.value || 2);
    state.project = project;
    return project;
  }

  async function saveBrand() {
    state.error = '';
    state.progress = 'Enregistrement de l’identité visuelle…';
    renderStudio();
    const brand = { ...currentBrand(), fixed_information: { ...(currentBrand().fixed_information || {}) } };
    $$('[data-brand]').forEach((input) => { brand[input.dataset.brand] = input.value; });
    $$('[data-fixed]').forEach((input) => {
      if (input.dataset.fixed === 'features') brand.recurring_features = input.value.split(',').map((value) => value.trim()).filter(Boolean);
      else brand.fixed_information[input.dataset.fixed] = input.value.trim();
    });
    state.brand = brand;
    try {
      if (!state.migrationPending) {
        const payload = await apiJson({ action: 'save_brand_kit', venueId: venueId(), brand });
        state.snapshot = { ...state.snapshot, ...payload, brand: payload.brand || brand };
      } else {
        state.snapshot.brand = brand;
        saveLocalSnapshot(state.snapshot);
      }
      state.progress = 'Identité visuelle enregistrée. Elle sera appliquée automatiquement aux prochaines créations.';
    } catch (error) {
      state.error = error.message;
    }
    renderStudio();
  }

  async function uploadLogo(file) {
    if (!file) return;
    state.progress = 'Import du logo officiel…'; state.error = ''; renderStudio();
    try {
      if (state.migrationPending) {
        const url = await fileToDataUrl(file);
        state.brand = { ...currentBrand(), logoUrl: url };
        state.snapshot.brand = state.brand;
        saveLocalSnapshot(state.snapshot);
      } else {
        const form = new FormData();
        form.set('action', 'upload_asset'); form.set('venueId', venueId()); form.set('assetKind', 'logo'); form.set('file', file);
        const payload = await apiForm(form);
        state.brand = { ...currentBrand(), logo_storage_path: payload.asset.storage_path, logoUrl: payload.asset.previewUrl };
        state.snapshot.brand = state.brand;
      }
      state.progress = 'Logo importé et verrouillé dans la charte.';
    } catch (error) { state.error = error.message; }
    renderStudio();
  }

  async function addEventPhotos(files) {
    const selected = [...files].slice(0, Math.max(0, 3 - state.eventPhotos.length));
    for (const file of selected) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) continue;
      state.eventPhotos.push({ file, url: URL.createObjectURL(file), name: file.name });
    }
    renderStudio();
  }

  async function saveProject(project, status = 'draft') {
    project.status = status;
    if (state.migrationPending) {
      const projects = state.snapshot.projects || [];
      const index = projects.findIndex((item) => item.id === project.id);
      if (index >= 0) projects[index] = structuredClone(project); else projects.unshift(structuredClone(project));
      state.snapshot.projects = projects;
      saveLocalSnapshot(state.snapshot);
      return project.id;
    }
    const payload = await apiJson({ action: 'save_project', venueId: venueId(), project });
    state.snapshot = { ...state.snapshot, ...payload };
    return payload.projectId || project.id;
  }

  async function saveDraft() {
    state.error = ''; state.progress = 'Enregistrement du brouillon…'; renderStudio();
    try {
      const project = updateDraftFromInputs();
      await saveProject(project, 'draft');
      state.progress = 'Brouillon enregistré dans la bibliothèque.';
    } catch (error) { state.error = error.message; }
    renderStudio();
  }

  function validateProject(project) {
    const event = project.event_payload;
    if (!event.title.trim()) throw new Error('Le titre de la soirée est obligatoire.');
    if (!event.date) throw new Error('La date de la soirée est obligatoire.');
    if (!project.creative_payload.formats.length) throw new Error('Choisissez au moins un format.');
    if (!currentBrand().brand_prompt && !currentBrand().logoUrl) throw new Error('Configurez d’abord l’identité visuelle ou ajoutez le logo de l’établissement.');
  }

  async function generatePosters() {
    state.error = ''; state.loading = true; state.generated = []; state.selectedRender = null;
    const project = updateDraftFromInputs();
    try {
      validateProject(project);
      state.progress = 'Enregistrement du projet…'; renderStudio();
      await saveProject(project, 'generating');
      const creative = project.creative_payload;
      const event = project.event_payload;
      state.progress = 'Le directeur artistique IA prépare la composition…'; renderStudio();
      const directionPayload = await apiJson({ action: 'plan_poster', venueId: venueId(), brand: currentBrand(), event, creative, format: creative.formats[0] });
      const direction = directionPayload.direction;
      const variants = Math.max(1, Math.min(4, Number(creative.variants || 2)));
      const generated = [];
      for (let variant = 1; variant <= variants; variant += 1) {
        state.progress = `Génération du décor ${variant}/${variants}…`; renderStudio();
        let backgroundUrl = '';
        try {
          const variationDirection = { ...direction, backgroundPrompt: `${direction.backgroundPrompt}. Composition variation ${variant}, preserve empty zones for exact typography.` };
          const background = await apiJson({ action: 'generate_background', venueId: venueId(), direction: variationDirection, brand: currentBrand(), event, creative, format: creative.formats[0] });
          backgroundUrl = `data:image/jpeg;base64,${background.image}`;
        } catch (error) {
          if (variant === 1) throw error;
          backgroundUrl = generated[0]?.backgroundUrl || '';
        }
        for (const format of creative.formats) {
          state.progress = `Composition exacte · variante ${variant} · ${FORMATS[format]?.label || format}`; renderStudio();
          const composed = await composePoster({ project, brand: currentBrand(), direction, backgroundUrl, format, variant });
          const render = { id: uid(), project_id: project.id, establishment_id: venueId(), render_type: 'image', format, variant_index: variant, previewUrl: composed.url, blob: composed.blob, canvas: composed.canvas, composition: composed.composition, backgroundUrl, created_at: new Date().toISOString() };
          generated.push(render);
          if (!state.migrationPending) {
            try { await uploadRender(render, project.id); } catch {}
          }
        }
      }
      state.generated = generated;
      state.selectedRender = generated[0];
      project.status = 'ready';
      project.prompt_snapshot = direction.backgroundPrompt || '';
      project.creative_payload.direction = direction;
      await saveProject(project, 'ready');
      if (state.migrationPending) {
        state.snapshot.renders = [...generated.map((item) => ({ ...item, blob: undefined, canvas: undefined })), ...(state.snapshot.renders || [])];
        saveLocalSnapshot(state.snapshot);
      } else {
        await loadSnapshot(true);
      }
      state.progress = `${generated.length} rendus prêts. Les textes, le logo et les informations sont composés séparément et restent parfaitement lisibles.`;
    } catch (error) {
      state.error = friendlyError(error.message);
      state.progress = '';
    } finally {
      state.loading = false;
      renderStudio();
      setTimeout(drawSelectedOnMainCanvas, 50);
    }
  }

  function friendlyError(message) {
    const map = {
      workers_ai_binding_missing: 'Workers AI n’est pas actif sur cette version Cloudflare.',
      workers_ai_image_missing: 'Le moteur IA n’a pas renvoyé de décor exploitable.',
      pro_studio_venue_required: 'Votre compte n’a pas accès au Studio de cet établissement.'
    };
    return map[message] || message || 'La création a échoué.';
  }

  async function uploadRender(render, projectId) {
    const form = new FormData();
    form.set('action', 'save_render'); form.set('venueId', venueId()); form.set('projectId', projectId);
    form.set('renderType', render.render_type); form.set('format', render.format); form.set('variantIndex', String(render.variant_index));
    form.set('composition', JSON.stringify(render.composition)); form.set('file', render.blob, `affiche-${render.format.replace(':','x')}.png`);
    return apiForm(form);
  }

  async function composePoster({ project, brand, direction, backgroundUrl, format, variant }) {
    const size = FORMATS[format] || FORMATS['4:5'];
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    const event = project.event_payload;
    const palette = { bg: brand.background_color || '#09090B', primary: brand.primary_color || '#7D294C', secondary: brand.secondary_color || '#0D0D0D', accent: brand.accent_color || '#D5B477' };
    ctx.fillStyle = palette.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
    const background = backgroundUrl ? await loadImage(backgroundUrl).catch(() => null) : null;
    if (background) drawCover(ctx, background, 0, 0, canvas.width, canvas.height);
    else drawFallbackBackground(ctx, canvas.width, canvas.height, palette, variant);
    const vertical = canvas.height > canvas.width * 1.15;
    const margin = Math.round(canvas.width * .055);
    const topSafe = Math.round(canvas.height * .035);
    const photoTop = Math.round(canvas.height * (vertical ? .24 : .18));
    const photoHeight = Math.round(canvas.height * (vertical ? .40 : .52));
    const footerHeight = Math.round(canvas.height * .15);
    const bottom = canvas.height - margin;

    const overlay = ctx.createLinearGradient(0,0,0,canvas.height);
    overlay.addColorStop(0,'rgba(5,5,8,.34)'); overlay.addColorStop(.34,'rgba(5,5,8,.05)'); overlay.addColorStop(.69,'rgba(5,5,8,.42)'); overlay.addColorStop(1,'rgba(5,5,8,.94)');
    ctx.fillStyle = overlay; ctx.fillRect(0,0,canvas.width,canvas.height);
    drawGlow(ctx, canvas.width*.16, canvas.height*.18, canvas.width*.32, palette.primary, .36);
    drawGlow(ctx, canvas.width*.86, canvas.height*.30, canvas.width*.29, variant%2 ? '#2387ff' : palette.accent, .28);

    const logo = brand.logoUrl ? await loadImage(brand.logoUrl).catch(() => null) : null;
    if (logo) drawContain(ctx, logo, margin, topSafe, canvas.width*.30, canvas.height*.09);
    else {
      ctx.save(); ctx.fillStyle = palette.accent; ctx.font = `700 ${Math.round(canvas.width*.038)}px Georgia`; ctx.letterSpacing = `${canvas.width*.008}px`; ctx.fillText($('#venueSelect option:checked')?.textContent || 'ZWIT PRO', margin, topSafe + canvas.height*.045); ctx.restore();
    }

    const titleTop = topSafe + canvas.height*.105;
    ctx.textAlign = 'center'; ctx.shadowColor = palette.primary; ctx.shadowBlur = canvas.width*.018;
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(canvas.width*(vertical?.082:.064))}px Arial Black, Impact, sans-serif`;
    fitText(ctx, (event.subtitle || 'UNE SOIRÉE À NE PAS MANQUER').toUpperCase(), canvas.width-margin*2, canvas.width*(vertical?.082:.064));
    ctx.fillText((event.subtitle || 'UNE SOIRÉE À NE PAS MANQUER').toUpperCase(), canvas.width/2, titleTop);
    ctx.shadowBlur = 0;

    if (state.eventPhotos.length) {
      const photos = await Promise.all(state.eventPhotos.slice(0,3).map((item) => loadImage(item.url).catch(() => null)));
      const valid = photos.filter(Boolean);
      if (valid.length === 1) drawPhotoHero(ctx, valid[0], margin, photoTop, canvas.width-margin*2, photoHeight, palette, variant);
      else if (valid.length === 2) {
        const gap = margin*.35; const w = (canvas.width-margin*2-gap)/2;
        drawPhotoHero(ctx, valid[0], margin, photoTop, w, photoHeight, palette, variant);
        drawPhotoHero(ctx, valid[1], margin+w+gap, photoTop, w, photoHeight, palette, variant+1);
      } else if (valid.length >= 3) {
        const mainW = (canvas.width-margin*2)*.61; const sideW = canvas.width-margin*2-mainW-margin*.3;
        drawPhotoHero(ctx, valid[0], margin, photoTop, mainW, photoHeight, palette, variant);
        drawPhotoHero(ctx, valid[1], margin+mainW+margin*.3, photoTop, sideW, photoHeight*.49, palette, variant+1);
        drawPhotoHero(ctx, valid[2], margin+mainW+margin*.3, photoTop+photoHeight*.51, sideW, photoHeight*.49, palette, variant+2);
      }
    } else {
      drawAbstractCenter(ctx, canvas.width, canvas.height, palette, variant, photoTop, photoHeight);
    }

    const headlineY = photoTop + photoHeight + canvas.height*.045;
    ctx.textAlign = 'center';
    ctx.shadowColor = palette.primary; ctx.shadowBlur = canvas.width*.026;
    ctx.font = `900 ${Math.round(canvas.width*(vertical?.13:.09))}px Arial Black, Impact, sans-serif`;
    const mainTitle = (event.title || event.theme || 'NUIT ZWIT').toUpperCase();
    fitText(ctx, mainTitle, canvas.width-margin*1.5, canvas.width*(vertical?.13:.09));
    const titleGradient = ctx.createLinearGradient(margin,0,canvas.width-margin,0); titleGradient.addColorStop(0,'#fff'); titleGradient.addColorStop(.43,palette.accent); titleGradient.addColorStop(.7,'#fff'); titleGradient.addColorStop(1,variant%2?'#4ab0ff':palette.primary);
    ctx.fillStyle = titleGradient; ctx.fillText(mainTitle, canvas.width/2, headlineY); ctx.shadowBlur = 0;

    const dateY = headlineY + canvas.height*.052;
    drawDateCards(ctx, event, margin, dateY, canvas.width-margin*2, canvas.height*.105, palette, vertical);

    let infoY = dateY + canvas.height*.13;
    if (event.guest || event.dj) {
      ctx.font = `700 ${Math.round(canvas.width*.027)}px Arial`; ctx.fillStyle = '#fff'; ctx.textAlign='center';
      const people = [event.guest, event.dj].filter(Boolean).join('  ·  '); wrapCentered(ctx, people, canvas.width/2, infoY, canvas.width-margin*2, canvas.width*.035); infoY += canvas.height*.05;
    }
    if (event.promotion || event.dressCode) {
      const boxGap = margin*.35; const boxW = (canvas.width-margin*2-boxGap)/2; const boxH = canvas.height*.095;
      if (event.promotion) drawInfoBox(ctx, margin, infoY, event.promotion, boxW, boxH, palette.primary, 'OFFRE');
      if (event.dressCode) drawInfoBox(ctx, margin+boxW+boxGap, infoY, event.dressCode, boxW, boxH, variant%2?'#237dde':palette.accent, 'DRESS CODE');
      infoY += boxH + canvas.height*.018;
    }

    const features = (event.amenities?.length ? event.amenities : brand.recurring_features || []).slice(0,6);
    if (features.length) drawFeatures(ctx, features, margin, Math.min(infoY,bottom-footerHeight*.78), canvas.width-margin*2, canvas.height*.062, palette);

    const fixed = brand.fixed_information || {};
    const address = event.address || fixed.address || ''; const phone = event.phone || fixed.phone || ''; const web = event.website || fixed.website || '';
    ctx.fillStyle = 'rgba(7,7,10,.88)'; roundRect(ctx, margin, bottom-footerHeight*.58, canvas.width-margin*2, footerHeight*.58, canvas.width*.018); ctx.fill();
    ctx.textAlign='center'; ctx.fillStyle='#f8f4ef'; ctx.font=`700 ${Math.round(canvas.width*.023)}px Arial`;
    wrapCentered(ctx, [phone,address,web].filter(Boolean).join('   •   '), canvas.width/2, bottom-footerHeight*.25, canvas.width-margin*2.5, canvas.width*.032);

    const composition = { format, variant, direction, event, brand: { primary_color: palette.primary, secondary_color: palette.secondary, accent_color: palette.accent }, exactTextLayer: true, photosComposited: state.eventPhotos.length };
    const blob = await canvasBlob(canvas, 'image/png', 1);
    return { canvas, blob, url: URL.createObjectURL(blob), composition };
  }

  function drawFallbackBackground(ctx,w,h,palette,variant){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,palette.bg);g.addColorStop(.45,variant%2?palette.primary:palette.secondary);g.addColorStop(1,'#050507');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);for(let i=0;i<80;i++){ctx.fillStyle=`rgba(${variant%2?'255,47,140':'55,145,255'},${Math.random()*.45})`;ctx.beginPath();ctx.arc(Math.random()*w,Math.random()*h,Math.random()*4+1,0,Math.PI*2);ctx.fill();}}
  function drawGlow(ctx,x,y,r,color,alpha){ctx.save();const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,hexAlpha(color,alpha));g.addColorStop(1,hexAlpha(color,0));ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
  function hexAlpha(hex,alpha){const clean=String(hex||'#7D294C').replace('#','');const r=parseInt(clean.slice(0,2),16)||0,g=parseInt(clean.slice(2,4),16)||0,b=parseInt(clean.slice(4,6),16)||0;return `rgba(${r},${g},${b},${alpha})`;}
  function drawAbstractCenter(ctx,w,h,palette,variant,top,height){ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<7;i++){ctx.strokeStyle=i%2?hexAlpha(palette.primary,.55):hexAlpha(variant%2?'#2588ff':palette.accent,.46);ctx.lineWidth=w*(.006+i*.001);ctx.beginPath();ctx.arc(w/2,top+height*.5,w*(.13+i*.035),Math.PI*.18,Math.PI*1.84);ctx.stroke();}ctx.restore();}
  function drawPhotoHero(ctx,img,x,y,w,h,palette,variant){ctx.save();roundRect(ctx,x,y,w,h,w*.045);ctx.clip();drawCover(ctx,img,x,y,w,h);const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'rgba(0,0,0,.02)');g.addColorStop(.68,'rgba(0,0,0,.05)');g.addColorStop(1,'rgba(0,0,0,.72)');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.restore();ctx.save();ctx.strokeStyle=variant%2?hexAlpha('#268dff',.72):hexAlpha(palette.primary,.8);ctx.lineWidth=Math.max(4,w*.009);ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=w*.035;roundRect(ctx,x,y,w,h,w*.045);ctx.stroke();ctx.restore();}
  function drawDateCards(ctx,event,x,y,w,h,palette,vertical){const dates=[event.date,event.endDate].filter(Boolean);if(!dates.length)return;const gap=w*.025;const cardW=dates.length===1?Math.min(w*.58,w):(w-gap)/2;dates.forEach((date,index)=>{const d=new Date(`${date}T12:00:00`);const cx=dates.length===1?x+(w-cardW)/2:x+index*(cardW+gap);ctx.save();ctx.fillStyle='rgba(7,7,10,.82)';ctx.strokeStyle=index%2?hexAlpha('#278cff',.85):hexAlpha(palette.primary,.9);ctx.lineWidth=Math.max(3,w*.004);ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=w*.018;roundRect(ctx,cx,y,cardW,h,cardW*.045);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font=`900 ${Math.round(h*.22)}px Arial`;ctx.fillText(d.toLocaleDateString('fr-FR',{weekday:'long'}).toUpperCase(),cx+cardW/2,y+h*.27);ctx.font=`900 ${Math.round(h*.43)}px Arial Black`;ctx.fillText(String(d.getDate()),cx+cardW*.34,y+h*.75);ctx.font=`800 ${Math.round(h*.23)}px Arial`;ctx.fillText(d.toLocaleDateString('fr-FR',{month:'long'}).toUpperCase(),cx+cardW*.68,y+h*.69);ctx.font=`800 ${Math.round(h*.15)}px Arial`;ctx.fillStyle=index%2?'#59b2ff':palette.accent;ctx.fillText(`${event.startTime||'21:00'} - ${event.endTime||'04:00'}`,cx+cardW*.68,y+h*.88);ctx.restore();});}
  function drawInfoBox(ctx,x,y,text,w,h,color,label){ctx.save();ctx.fillStyle='rgba(8,8,11,.86)';ctx.strokeStyle=hexAlpha(color,.86);ctx.lineWidth=Math.max(3,w*.007);ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=w*.025;roundRect(ctx,x,y,w,h,w*.045);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.textAlign='center';ctx.fillStyle=color;ctx.font=`900 ${Math.round(h*.16)}px Arial`;ctx.fillText(label,x+w/2,y+h*.23);ctx.fillStyle='#fff';ctx.font=`800 ${Math.round(h*.19)}px Arial`;wrapCentered(ctx,text,x+w/2,y+h*.51,w*.88,h*.23);ctx.restore();}
  function drawFeatures(ctx,features,x,y,w,h,palette){const gap=w*.008;const itemW=(w-gap*(features.length-1))/features.length;features.forEach((feature,index)=>{const ix=x+index*(itemW+gap);ctx.fillStyle='rgba(8,8,11,.78)';ctx.strokeStyle=index%2?hexAlpha('#258aff',.55):hexAlpha(palette.primary,.58);ctx.lineWidth=2;roundRect(ctx,ix,y,itemW,h,itemW*.04);ctx.fill();ctx.stroke();ctx.textAlign='center';ctx.fillStyle=palette.accent;ctx.font=`700 ${Math.round(h*.22)}px Arial`;ctx.fillText(['◇','♨','P','♡','✦','♬'][index%6],ix+itemW/2,y+h*.34);ctx.fillStyle='#fff';ctx.font=`700 ${Math.round(h*.14)}px Arial`;wrapCentered(ctx,String(feature).toUpperCase(),ix+itemW/2,y+h*.63,itemW*.86,h*.17);});}
  function roundRect(ctx,x,y,w,h,r){const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();}
  function drawCover(ctx,img,x,y,w,h){const scale=Math.max(w/img.width,h/img.height);const sw=w/scale,sh=h/scale,sx=(img.width-sw)/2,sy=(img.height-sh)/2;ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
  function drawContain(ctx,img,x,y,w,h){const scale=Math.min(w/img.width,h/img.height);const dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
  function fitText(ctx,text,maxWidth,startSize){let size=startSize;const family=ctx.font.split('px').slice(1).join('px');while(size>18&&ctx.measureText(text).width>maxWidth){size-=2;ctx.font=`900 ${Math.round(size)}px${family}`;}}
  function wrapCentered(ctx,text,x,y,maxWidth,lineHeight){const words=String(text).split(/\s+/);let line='',lines=[];for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test;}if(line)lines.push(line);lines.slice(0,3).forEach((item,index)=>ctx.fillText(item,x,y+index*lineHeight));}
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
  function canvasBlob(canvas,type='image/png',quality=1){return new Promise((resolve)=>canvas.toBlob(resolve,type,quality));}

  function drawSelectedOnMainCanvas() {
    const target = $('[data-vpsai-main-canvas]');
    const render = state.selectedRender || state.generated[0];
    if (!target || !render) return;
    const source = render.canvas;
    if (source) {
      target.width = source.width; target.height = source.height; target.getContext('2d').drawImage(source,0,0);
      return;
    }
    if (render.previewUrl) loadImage(render.previewUrl).then((image)=>{target.width=image.width||1080;target.height=image.height||1350;target.getContext('2d').drawImage(image,0,0,target.width,target.height);}).catch(()=>{});
  }

  function selectRender(render) {
    state.selectedRender = render;
    state.tab = 'create';
    renderStudio();
    setTimeout(drawSelectedOnMainCanvas, 30);
  }

  async function downloadSelected(type) {
    const render = state.selectedRender || state.generated[0];
    if (!render) return;
    let blob = render.blob;
    if (render.canvas) blob = await canvasBlob(render.canvas, type === 'jpg' ? 'image/jpeg' : 'image/png', type === 'jpg' ? .94 : 1);
    if (!blob && render.previewUrl) blob = await fetch(render.previewUrl).then((response) => response.blob());
    if (!blob) return;
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href=url; link.download=`${slug(state.project?.title || 'affiche-zwit')}-${render.format.replace(':','x')}.${type==='jpg'?'jpg':'png'}`; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function slug(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);}

  async function animateSelected() {
    const render = state.selectedRender || state.generated[0] || state.snapshot?.renders?.find((item)=>item.previewUrl);
    if (!render) return;
    if (!HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder) { state.error='Votre navigateur ne permet pas l’export vidéo animé.'; renderStudio(); return; }
    state.error='';state.progress='Préparation de l’animation…';renderStudio();
    try {
      const image = render.canvas ? render.canvas : await loadImage(render.previewUrl);
      const duration = Number($('[data-vpsai-motion-duration]')?.value || 8);
      const style = $('[data-vpsai-motion-style]')?.value || 'cinematic';
      const width=720,height=1280;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
      const stream=canvas.captureStream(30);const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find((value)=>MediaRecorder.isTypeSupported(value))||'';const chunks=[];const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:5_000_000}:undefined);recorder.ondataavailable=(event)=>{if(event.data.size)chunks.push(event.data)};recorder.start(250);
      const started=performance.now();
      await new Promise((resolve)=>{const frame=(now)=>{const p=Math.min(1,(now-started)/(duration*1000));ctx.fillStyle='#070709';ctx.fillRect(0,0,width,height);const pulse=style==='neon'?1+Math.sin(p*Math.PI*8)*.018:1;const zoom=(style==='soft'?1.02:1.06)+(style==='energy'?p*.08:p*.035);const scale=zoom*pulse;const iw=image.width||image.videoWidth,ih=image.height||image.videoHeight;const base=Math.max(width/iw,height/ih)*scale;const dw=iw*base,dh=ih*base;const dx=(width-dw)/2+Math.sin(p*Math.PI*2)*width*.018,dy=(height-dh)/2-p*height*.025;ctx.drawImage(image,dx,dy,dw,dh);const shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'rgba(0,0,0,.03)');shade.addColorStop(1,'rgba(0,0,0,.18)');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);if(style!=='soft'){for(let i=0;i<24;i++){const seed=(i*97)%100/100;const x=(seed*width+Math.sin(p*6+i)*35)%width;const y=((p*(style==='energy'?1.8:1)+i/24)%1)*height;ctx.fillStyle=i%2?'rgba(255,55,155,.5)':'rgba(55,145,255,.45)';ctx.beginPath();ctx.arc(x,y,2+(i%4),0,Math.PI*2);ctx.fill();}}if(p<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame)});
      const blob=await new Promise((resolve)=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||'video/webm'}));recorder.stop()});stream.getTracks().forEach((track)=>track.stop());
      const animated={id:uid(),project_id:render.project_id||state.project?.id,establishment_id:venueId(),render_type:'video',format:'9:16',variant_index:1,previewUrl:URL.createObjectURL(blob),blob,created_at:new Date().toISOString()};state.selectedRender=animated;state.generated.unshift(animated);state.progress='Teaser vidéo prêt. Vous pouvez le prévisualiser et le télécharger.';
      if(!state.migrationPending&&animated.project_id){try{await uploadRender(animated,animated.project_id)}catch{}}
      renderStudio();
      const stage=$('.vpsai-preview-stage');if(stage)stage.innerHTML=`<video src="${animated.previewUrl}" controls autoplay loop style="max-width:94%;max-height:74vh;border-radius:12px"></video><div class="vpsai-render-actions"><a href="${animated.previewUrl}" download="teaser-velvet.webm">Télécharger la vidéo</a></div>`;
    } catch(error){state.error=error.message;state.progress='';renderStudio();}
  }

  function openProject(id, duplicate=false) {
    const source=state.snapshot?.projects?.find((item)=>item.id===id);if(!source)return;
    state.project=structuredClone(source);if(duplicate){state.project.id=uid();state.project.source_project_id=source.id;state.project.status='draft';state.project.title=`${source.title} · copie`;}
    state.eventPhotos=[];state.generated=[];state.selectedRender=null;state.tab='create';renderStudio();
  }

  async function deleteProject(id) {
    if (!confirm('Supprimer cette création de la bibliothèque ?')) return;
    if (state.migrationPending) {
      state.snapshot.projects=(state.snapshot.projects||[]).filter((item)=>item.id!==id);state.snapshot.renders=(state.snapshot.renders||[]).filter((item)=>item.project_id!==id);saveLocalSnapshot(state.snapshot);
    } else {
      await apiJson({action:'delete_project',venueId:venueId(),projectId:id});await loadSnapshot(true);
    }
    renderStudio();
  }

  function showAllVariants() {
    state.tab='library';
    if(state.generated.length){const localProjects=[state.project,...(state.snapshot.projects||[]).filter((item)=>item.id!==state.project?.id)].filter(Boolean);state.snapshot.projects=localProjects;state.snapshot.renders=[...state.generated,...(state.snapshot.renders||[]).filter((item)=>item.project_id!==state.project?.id)];}
    renderStudio();
  }

  document.addEventListener('click', (event) => {
    const tab=event.target.closest('[data-vpsai-tab]');if(tab){event.preventDefault();state.tab=tab.dataset.vpsaiTab;if(state.tab==='create'&&!state.project)state.project=projectDraft();renderStudio();return;}
    if(event.target.closest('[data-vpsai-new]')){event.preventDefault();state.project=null;state.eventPhotos=[];state.generated=[];state.selectedRender=null;state.tab='create';renderStudio();return;}
    if(event.target.closest('[data-vpsai-save-brand]')){event.preventDefault();saveBrand();return;}
    if(event.target.closest('[data-vpsai-save-draft]')){event.preventDefault();saveDraft();return;}
    if(event.target.closest('[data-vpsai-generate]')){event.preventDefault();generatePosters();return;}
    const remove=event.target.closest('[data-remove-photo]');if(remove){event.preventDefault();const index=Number(remove.dataset.removePhoto);const item=state.eventPhotos[index];if(item?.url?.startsWith('blob:'))URL.revokeObjectURL(item.url);state.eventPhotos.splice(index,1);renderStudio();return;}
    const open=event.target.closest('[data-open-project]');if(open){openProject(open.dataset.openProject);return;}
    const duplicate=event.target.closest('[data-duplicate-project]');if(duplicate){openProject(duplicate.dataset.duplicateProject,true);return;}
    const del=event.target.closest('[data-delete-project]');if(del){deleteProject(del.dataset.deleteProject);return;}
    const template=event.target.closest('[data-template]');if(template){state.project=projectDraft();state.project.creative_payload.template=template.dataset.template;state.tab='create';renderStudio();return;}
    const download=event.target.closest('[data-vpsai-download]');if(download){downloadSelected(download.dataset.vpsaiDownload);return;}
    if(event.target.closest('[data-vpsai-show-all]')){showAllVariants();return;}
    if(event.target.closest('[data-vpsai-animate]')){animateSelected();return;}
  });

  document.addEventListener('change', (event) => {
    if(event.target.matches('[data-vpsai-logo]'))uploadLogo(event.target.files?.[0]);
    if(event.target.matches('[data-vpsai-event-photos]'))addEventPhotos(event.target.files||[]);
  });

  function install() {
    installStyles();
    const ready=ensureNav();
    if(ready&&!state.installed){state.installed=true;closeOnNativeNavigation();}
    return ready;
  }

  let attempts=0;
  state.installTimer=setInterval(()=>{attempts+=1;if(install()||attempts>150)clearInterval(state.installTimer)},100);
  install();
})();
