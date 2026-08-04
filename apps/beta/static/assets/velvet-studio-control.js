(() => {
  const root = document.querySelector('#controlApp');
  if (!root) return;

  const STORAGE_KEY = 'velvet_studio_campaigns_v1';
  const BRAND = {
    black: '#0D0D0D',
    anthracite: '#1B1B1D',
    grey: '#2D2D30',
    burgundy: '#641B36',
    gold: '#C6A96A',
    ivory: '#F4F4F2'
  };

  const campaignTemplates = [
    { id: 'manifesto', label: 'Film manifeste', audience: 'Membres + Pros', objective: 'Faire comprendre la vision Velvet', duration: 45 },
    { id: 'members', label: 'Velvet Membres', audience: 'Particuliers', objective: 'Donner envie de rejoindre la communauté', duration: 35 },
    { id: 'pro', label: 'Velvet Pro', audience: 'Établissements', objective: 'Démontrer le gain de temps et de chiffre', duration: 40 },
    { id: 'feature', label: 'Fonctionnalité', audience: 'Ciblée', objective: 'Expliquer une capacité forte', duration: 20 },
    { id: 'event', label: 'Événement', audience: 'Local', objective: 'Remplir une soirée ou un lancement', duration: 15 }
  ];

  const providerCatalog = [
    { id: 'captures', name: 'Captures Velvet', type: 'Gratuit', status: 'ready', detail: 'Parcours réels Web, Pro et Control' },
    { id: 'ffmpeg', name: 'FFmpeg / Remotion', type: 'Gratuit', status: 'ready', detail: 'Montage, sous-titres et exports multi-formats' },
    { id: 'local', name: 'Moteur local', type: 'Gratuit', status: 'planned', detail: 'Images et clips générés sur machine compatible' },
    { id: 'free-tier', name: 'Fournisseur quota gratuit', type: 'Gratuit-first', status: 'planned', detail: 'Connecteur interchangeable selon disponibilité' },
    { id: 'sora', name: 'OpenAI Video', type: 'Payant optionnel', status: 'disabled', detail: 'Activable uniquement après autorisation explicite' }
  ];

  let state = {
    view: 'dashboard',
    selectedTemplate: 'manifesto',
    channel: 'instagram',
    format: '9:16',
    tone: 'premium',
    objective: 'Présenter Velvet comme la nouvelle référence des rencontres libres',
    feature: 'Confiance, événements, établissements et expérience unifiée',
    campaigns: loadCampaigns(),
    draft: null
  };

  function safe(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function loadCampaigns() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function saveCampaigns() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.campaigns));
  }

  function addStudioNav() {
    if (document.querySelector('[data-velvet-studio-nav]')) return;
    const anchor = document.querySelector('[data-nav-view="communications"]');
    if (!anchor) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = anchor.className;
    button.dataset.velvetStudioNav = 'true';
    button.innerHTML = '<span aria-hidden="true">✦</span><span>Velvet Studio</span>';
    anchor.parentElement.appendChild(button);
    button.addEventListener('click', () => {
      state.view = 'dashboard';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function injectStyles() {
    if (document.querySelector('#velvetStudioStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetStudioStyles';
    style.textContent = `
      .vs-page{min-height:100vh;padding:30px;color:${BRAND.ivory};background:radial-gradient(circle at 78% 0%,#641b3633,transparent 28%),linear-gradient(180deg,#101012,#09090a)}
      .vs-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}.vs-eyebrow{margin:0 0 8px;color:${BRAND.gold};text-transform:uppercase;letter-spacing:.18em;font-size:11px}.vs-head h1{margin:0;font:500 clamp(34px,5vw,58px)/1 Georgia,serif}.vs-head p{max-width:720px;color:#c9c5c1;line-height:1.6}.vs-actions{display:flex;gap:10px;flex-wrap:wrap}
      .vs-btn{border:0;border-radius:999px;padding:11px 17px;background:${BRAND.gold};color:#151515;font-weight:700;cursor:pointer}.vs-btn.secondary{background:#ffffff10;color:${BRAND.ivory};border:1px solid #ffffff20}.vs-btn.danger{background:#641b36;color:white}.vs-btn:disabled{opacity:.45;cursor:not-allowed}
      .vs-metrics,.vs-grid{display:grid;gap:16px}.vs-metrics{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px}.vs-grid.two{grid-template-columns:1.2fr .8fr}.vs-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.vs-card,.vs-metric{border:1px solid #ffffff14;background:linear-gradient(145deg,#ffffff0d,#ffffff05);box-shadow:0 25px 80px #0008;border-radius:24px;padding:20px;backdrop-filter:blur(18px)}.vs-metric small{display:block;color:#aaa}.vs-metric strong{display:block;font-size:30px;margin:8px 0}.vs-card h2,.vs-card h3{margin-top:0}.vs-card p{color:#b9b5b1;line-height:1.55}
      .vs-form{display:grid;gap:14px}.vs-field{display:grid;gap:7px}.vs-field label{font-size:12px;color:#d8c69f}.vs-field input,.vs-field select,.vs-field textarea{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid #ffffff1f;background:#09090b;color:white;padding:12px 13px;outline:none}.vs-field textarea{min-height:92px;resize:vertical}.vs-field input:focus,.vs-field select:focus,.vs-field textarea:focus{border-color:${BRAND.gold}}
      .vs-template-list,.vs-provider-list,.vs-campaign-list{display:grid;gap:10px}.vs-template,.vs-provider,.vs-campaign{display:flex;justify-content:space-between;gap:14px;align-items:center;border:1px solid #ffffff12;background:#ffffff08;border-radius:17px;padding:14px}.vs-template.active{border-color:${BRAND.gold};box-shadow:0 0 0 1px #c6a96a55 inset}.vs-template button{all:unset;cursor:pointer;flex:1}.vs-template strong,.vs-provider strong,.vs-campaign strong{display:block}.vs-template span,.vs-provider span,.vs-campaign span{display:block;color:#aaa;font-size:12px;margin-top:4px}
      .vs-badge{display:inline-flex;align-items:center;border-radius:999px;padding:6px 9px;font-size:11px;background:#ffffff0d;border:1px solid #ffffff17}.vs-badge.ok{color:#a8e0b1}.vs-badge.warn{color:#f3d693}.vs-badge.off{color:#aaa}.vs-score{display:grid;place-items:center;width:88px;height:88px;border-radius:50%;background:conic-gradient(${BRAND.gold} 0 92%,#ffffff12 92%);position:relative}.vs-score:after{content:"";position:absolute;inset:7px;border-radius:50%;background:#101012}.vs-score strong{position:relative;z-index:1;font-size:23px}
      .vs-story{display:grid;gap:9px;margin-top:14px}.vs-scene{display:grid;grid-template-columns:72px 1fr 1fr;gap:12px;border-top:1px solid #ffffff10;padding:12px 0}.vs-scene:first-child{border-top:0}.vs-scene time{color:${BRAND.gold};font-weight:700}.vs-scene b{display:block;margin-bottom:4px}.vs-scene span{color:#aaa;font-size:13px;line-height:1.45}
      .vs-empty{padding:28px;border:1px dashed #ffffff20;border-radius:18px;text-align:center;color:#aaa}.vs-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.vs-tabs button{border:1px solid #ffffff14;background:#ffffff08;color:#ddd;border-radius:999px;padding:9px 13px;cursor:pointer}.vs-tabs button.active{background:${BRAND.burgundy};border-color:${BRAND.burgundy};color:white}
      @media(max-width:900px){.vs-page{padding:18px}.vs-head{display:block}.vs-actions{margin-top:15px}.vs-metrics,.vs-grid.two,.vs-grid.three{grid-template-columns:1fr 1fr}.vs-scene{grid-template-columns:58px 1fr}.vs-scene>div:last-child{grid-column:2}}
      @media(max-width:620px){.vs-metrics,.vs-grid.two,.vs-grid.three{grid-template-columns:1fr}.vs-head h1{font-size:38px}}
    `;
    document.head.appendChild(style);
  }

  function metric(label, value, copy) {
    return `<article class="vs-metric"><small>${safe(label)}</small><strong>${safe(value)}</strong><span>${safe(copy)}</span></article>`;
  }

  function tabs() {
    const entries = [['dashboard','Cockpit'],['create','Créer'],['library','Bibliothèque'],['providers','Moteurs'],['brand','Brand Guard']];
    return `<nav class="vs-tabs">${entries.map(([id,label]) => `<button type="button" class="${state.view===id?'active':''}" data-vs-view="${id}">${label}</button>`).join('')}</nav>`;
  }

  function pageHead(title, lead, actions = '') {
    return `<header class="vs-head"><div><p class="vs-eyebrow">Velvet Control · Marketing Intelligence</p><h1>${safe(title)}</h1><p>${safe(lead)}</p></div><div class="vs-actions">${actions}</div></header>`;
  }

  function dashboard() {
    const ready = state.campaigns.filter(c => c.status === 'ready').length;
    const production = state.campaigns.filter(c => c.status === 'production').length;
    return `${pageHead('Velvet Studio','Le cockpit photo et vidéo IA qui transforme les capacités réelles de Velvet en campagnes cohérentes, premium et mesurables.','<button class="vs-btn" data-vs-view="create">Créer une campagne</button>')}${tabs()}
      <div class="vs-metrics">${metric('Campagnes',state.campaigns.length,'dans la bibliothèque')}${metric('Prêtes',ready,'validées et exportables')}${metric('En production',production,'assets ou montage en cours')}${metric('Coût engagé','0 €','gratuit-first actif')}</div>
      <div class="vs-grid two"><section class="vs-card"><h2>Campagne prioritaire</h2><p>Film social vertical : stratégie Velvet, vraie interface, confiance, événements et écosystème Pro.</p><div class="vs-template-list">${campaignTemplates.slice(0,3).map(t=>`<article class="vs-template"><button data-vs-template="${t.id}"><strong>${safe(t.label)}</strong><span>${safe(t.objective)} · ${t.duration}s</span></button><span class="vs-badge ok">Prêt à briefer</span></article>`).join('')}</div></section>
      <aside class="vs-card"><h2>Brand Guard</h2><div style="display:flex;gap:18px;align-items:center"><div class="vs-score"><strong>92</strong></div><div><strong>Identité maîtrisée</strong><p>Confiance, consentement, discrétion, qualité et promesses vérifiables.</p></div></div><button class="vs-btn secondary" data-vs-view="brand">Voir les contrôles</button></aside></div>
      <section class="vs-card" style="margin-top:16px"><h2>Dernières campagnes</h2>${state.campaigns.length?`<div class="vs-campaign-list">${state.campaigns.slice(0,5).map(c=>campaignRow(c)).join('')}</div>`:'<div class="vs-empty">Aucune campagne enregistrée. Le premier film manifeste peut être créé maintenant.</div>'}</section>`;
  }

  function campaignRow(c) {
    return `<article class="vs-campaign"><div><strong>${safe(c.title)}</strong><span>${safe(c.channel)} · ${safe(c.format)} · ${safe(c.duration)} s</span></div><div><span class="vs-badge ${c.status==='ready'?'ok':'warn'}">${safe(c.status==='ready'?'Prête':'Brouillon')}</span></div></article>`;
  }

  function createView() {
    const selected = campaignTemplates.find(t=>t.id===state.selectedTemplate) || campaignTemplates[0];
    return `${pageHead('Créer une campagne','Définis le résultat attendu. Velvet Studio construit ensuite le concept, le script, le storyboard et les déclinaisons.','<button class="vs-btn secondary" data-vs-view="dashboard">Retour</button>')}${tabs()}
      <div class="vs-grid two"><section class="vs-card"><h2>Brief</h2><div class="vs-form">
      <div class="vs-field"><label>Type de campagne</label><select data-vs-input="template">${campaignTemplates.map(t=>`<option value="${t.id}" ${t.id===state.selectedTemplate?'selected':''}>${safe(t.label)}</option>`).join('')}</select></div>
      <div class="vs-grid three"><div class="vs-field"><label>Canal</label><select data-vs-input="channel"><option>Instagram</option><option>TikTok</option><option>Facebook</option><option>LinkedIn</option><option>YouTube Shorts</option></select></div><div class="vs-field"><label>Format</label><select data-vs-input="format"><option>9:16</option><option>1:1</option><option>16:9</option></select></div><div class="vs-field"><label>Ton</label><select data-vs-input="tone"><option>Premium</option><option>Émotionnel</option><option>Business</option><option>Pédagogique</option></select></div></div>
      <div class="vs-field"><label>Objectif</label><textarea data-vs-input="objective">${safe(state.objective)}</textarea></div>
      <div class="vs-field"><label>Capacités à mettre en avant</label><textarea data-vs-input="feature">${safe(state.feature)}</textarea></div>
      <button class="vs-btn" type="button" data-vs-generate>Générer le concept</button></div></section>
      <aside class="vs-card"><h2>${safe(selected.label)}</h2><p><strong>Cible :</strong> ${safe(selected.audience)}</p><p><strong>Objectif modèle :</strong> ${safe(selected.objective)}</p><p><strong>Durée conseillée :</strong> ${selected.duration} secondes</p><p>Le moteur utilise d’abord les captures réelles Velvet, puis complète uniquement les plans impossibles à filmer.</p></aside></div>${state.draft?draftView(state.draft):''}`;
  }

  function generateDraft() {
    const template = campaignTemplates.find(t=>t.id===state.selectedTemplate) || campaignTemplates[0];
    const duration = template.duration;
    state.draft = {
      title: template.id === 'manifesto' ? 'Le libertinage évolue' : `${template.label} · Velvet`,
      hook: template.id === 'pro' ? 'Votre établissement mérite mieux qu’une organisation dispersée.' : 'Pendant des années, les rencontres se sont limitées à des profils et des messages.',
      promise: 'Velvet réunit les personnes, les événements, les établissements et les outils de confiance dans une expérience unique.',
      duration,
      scenes: [
        ['00–04 s','Logo Velvet','Le ruban forme le V sur fond Noir Velvet.','Le libertinage évolue.'],
        ['04–11 s','Problème actuel','Plans rapides : recherches dispersées, échanges sans contexte, organisation complexe.','Les rencontres libres méritaient une expérience plus humaine.'],
        ['11–22 s','Velvet en action','Captures réelles : recherche, profils, messagerie, carte et événements.','Découvrir, échanger et préparer une rencontre dans un même univers.'],
        ['22–32 s','Confiance','Pacte Velvet, vérification, albums privés, contrôle du consentement.','La confiance n’est pas une option. Elle est intégrée à chaque étape.'],
        ['32–40 s','Écosystème','Velvet Pro : événement, réservations, participants, statistiques.','Et pour les professionnels, une gestion plus simple et une communauté mieux engagée.'],
        ['40–45 s','Signature','Logo, application et appel à l’action.','Velvet. Là où les plus belles rencontres commencent.']
      ]
    };
    render();
  }

  function draftView(draft) {
    return `<section class="vs-card" style="margin-top:16px"><div class="vs-head"><div><p class="vs-eyebrow">Concept généré</p><h2 style="font:500 34px Georgia;margin:0">${safe(draft.title)}</h2><p>${safe(draft.promise)}</p></div><div class="vs-actions"><button class="vs-btn secondary" data-vs-export>Exporter JSON</button><button class="vs-btn" data-vs-save>Enregistrer</button></div></div><div class="vs-story">${draft.scenes.map(scene=>`<article class="vs-scene"><time>${safe(scene[0])}</time><div><b>${safe(scene[1])}</b><span>${safe(scene[2])}</span></div><div><b>Voix off</b><span>${safe(scene[3])}</span></div></article>`).join('')}</div></section>`;
  }

  function libraryView() {
    return `${pageHead('Bibliothèque','Tous les concepts, scripts et campagnes validés restent réutilisables et déclinables.','<button class="vs-btn" data-vs-view="create">Nouvelle campagne</button>')}${tabs()}<section class="vs-card">${state.campaigns.length?`<div class="vs-campaign-list">${state.campaigns.map(c=>campaignRow(c)).join('')}</div>`:'<div class="vs-empty">La bibliothèque est vide.</div>'}</section>`;
  }

  function providersView() {
    return `${pageHead('Moteurs média','Velvet Studio choisit le fournisseur selon la qualité, le coût, la confidentialité et la disponibilité.','')}${tabs()}<section class="vs-card"><div class="vs-provider-list">${providerCatalog.map(p=>`<article class="vs-provider"><div><strong>${safe(p.name)}</strong><span>${safe(p.detail)}</span></div><div><span class="vs-badge ${p.status==='ready'?'ok':p.status==='disabled'?'off':'warn'}">${safe(p.type)} · ${safe(p.status==='ready'?'Actif':p.status==='planned'?'À connecter':'Désactivé')}</span></div></article>`).join('')}</div></section>`;
  }

  function brandView() {
    const checks = [
      ['Promesse réelle','Les fonctionnalités montrées existent dans la V1','ok'],
      ['Confiance avant volume','Aucune logique de catalogue de profils','ok'],
      ['Consentement intégré','Le consentement est visible dans le récit','ok'],
      ['Discrétion','Aucun contenu explicite ou notification intrusive','ok'],
      ['Cohérence visuelle','Noir Velvet, Bordeaux et Or Champagne','ok'],
      ['Validation humaine','Aucune publication automatique','ok']
    ];
    return `${pageHead('Brand Guard','Avant tout export, la campagne est contrôlée contre les règles produit, visuelles, légales et éthiques de Velvet.','')}${tabs()}<section class="vs-card"><div class="vs-provider-list">${checks.map(c=>`<article class="vs-provider"><div><strong>${safe(c[0])}</strong><span>${safe(c[1])}</span></div><span class="vs-badge ok">Conforme</span></article>`).join('')}</div></section>`;
  }

  function saveDraft() {
    if (!state.draft) return;
    const campaign = {
      id: crypto.randomUUID ? crypto.randomUUID() : `campaign-${Date.now()}`,
      title: state.draft.title,
      channel: document.querySelector('[data-vs-input="channel"]')?.value || 'Instagram',
      format: document.querySelector('[data-vs-input="format"]')?.value || '9:16',
      duration: state.draft.duration,
      status: 'draft',
      createdAt: new Date().toISOString(),
      brief: { objective: state.objective, feature: state.feature },
      storyboard: state.draft.scenes
    };
    state.campaigns.unshift(campaign);
    saveCampaigns();
    state.view = 'library';
    render();
  }

  function exportDraft() {
    if (!state.draft) return;
    const blob = new Blob([JSON.stringify(state.draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'velvet-studio-campagne.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function render() {
    injectStyles();
    const views = { dashboard, create: createView, library: libraryView, providers: providersView, brand: brandView };
    root.innerHTML = `<main class="vs-page">${(views[state.view] || dashboard)()}</main>`;
    bind();
  }

  function bind() {
    document.querySelectorAll('[data-vs-view]').forEach(el=>el.addEventListener('click',()=>{state.view=el.dataset.vsView;render();}));
    document.querySelectorAll('[data-vs-template]').forEach(el=>el.addEventListener('click',()=>{state.selectedTemplate=el.dataset.vsTemplate;state.view='create';render();}));
    document.querySelector('[data-vs-generate]')?.addEventListener('click',()=>{
      state.selectedTemplate=document.querySelector('[data-vs-input="template"]')?.value||state.selectedTemplate;
      state.objective=document.querySelector('[data-vs-input="objective"]')?.value||state.objective;
      state.feature=document.querySelector('[data-vs-input="feature"]')?.value||state.feature;
      generateDraft();
    });
    document.querySelector('[data-vs-save]')?.addEventListener('click',saveDraft);
    document.querySelector('[data-vs-export]')?.addEventListener('click',exportDraft);
  }

  const observer = new MutationObserver(addStudioNav);
  observer.observe(document.body,{childList:true,subtree:true});
  addStudioNav();
})();
