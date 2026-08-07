(() => {
  'use strict';

  if (!location.pathname.startsWith('/marketing-pro')) return;
  if (window.__VELVET_MARKETING_PRO_STUDIO_BRIDGE__) return;
  window.__VELVET_MARKETING_PRO_STUDIO_BRIDGE__ = true;

  const previousFetch = window.fetch.bind(window);
  const API_PATH = '/api/pro/studio-ai';
  const CONTROL_AI_PATH = '/api/control/studio-media';
  const STORE_KEY = 'velvet_marketing_pro_studio_demo_v1';
  const VENUE_ID = '72000000-0000-4000-8000-000000000001';
  const MAX_PROJECTS = 24;
  const MAX_RENDERS = 24;
  const MAX_ASSETS = 16;

  const TEMPLATES = [
    { id: 'marketing-template-neon', establishment_id: null, template_code: 'neon-club', name: 'Néon Club', description: 'Rose et bleu électrique, dense et festif.', configuration: { visualStyle: 'neon club, magenta and electric blue, premium nightlife', layout: 'event', effects: ['neon', 'glow', 'confetti'] }, is_system: true },
    { id: 'marketing-template-luxe', establishment_id: null, template_code: 'velvet-luxe', name: 'Zwit Luxe', description: 'Bordeaux, noir et champagne, sensuel et élégant.', configuration: { visualStyle: 'luxury burgundy black champagne nightlife', layout: 'balanced', effects: ['silk', 'gold', 'soft glow'] }, is_system: true },
    { id: 'marketing-template-electric', establishment_id: null, template_code: 'electric-night', name: 'Electric Night', description: 'Lasers, lumière et énergie pour DJ et performers.', configuration: { visualStyle: 'electric premium club, laser and particles', layout: 'rich', effects: ['laser', 'particles', 'light streaks'] }, is_system: true },
    { id: 'marketing-template-dark', establishment_id: null, template_code: 'dark-desire', name: 'Dark Desire', description: 'Sombre, mystérieux et sophistiqué.', configuration: { visualStyle: 'dark sophisticated cinematic club', layout: 'balanced', effects: ['smoke', 'rim light', 'deep contrast'] }, is_system: true },
    { id: 'marketing-template-summer', establishment_id: null, template_code: 'summer-pool', name: 'Summer Pool', description: 'Lumineux, estival et festif.', configuration: { visualStyle: 'premium tropical pool party nightlife', layout: 'rich', effects: ['water reflections', 'sunset', 'festive lights'] }, is_system: true }
  ];

  const logoSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520" viewBox="0 0 1000 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#220d18"/><stop offset="1" stop-color="#7D294C"/></linearGradient></defs><rect width="1000" height="520" rx="70" fill="url(#g)"/><circle cx="500" cy="174" r="92" fill="none" stroke="#D5B477" stroke-width="5"/><path d="M451 139c34 77 64 77 98 0M438 205c43-35 81-35 124 0" fill="none" stroke="#D5B477" stroke-width="7" stroke-linecap="round"/><text x="500" y="354" text-anchor="middle" fill="#F7F1EB" font-family="Georgia,serif" font-size="74" letter-spacing="14">MAISON ZWIT</text><text x="500" y="410" text-anchor="middle" fill="#D5B477" font-family="Arial,sans-serif" font-size="24" letter-spacing="9">LILLE</text></svg>`)}`;

  const defaultBrand = () => ({
    establishment_id: VENUE_ID,
    logo_storage_path: 'marketing-local/brand/logo.svg',
    secondary_logo_storage_path: null,
    logoUrl: logoSvg,
    secondaryLogoUrl: '',
    primary_color: '#7D294C',
    secondary_color: '#0D0D0D',
    accent_color: '#D5B477',
    background_color: '#09090B',
    typography_style: 'editorial-premium',
    visual_style: 'velvet-luxe',
    density: 'balanced',
    brand_prompt: 'Maison Zwit Lille : club privé contemporain, chaleureux et premium. Univers bordeaux profond, noir velours et champagne. Sensualité élégante, lumière cinématographique et composition événementielle professionnelle.',
    fixed_information: {
      address: 'Lille · adresse communiquée avant la soirée',
      phone: '03 20 00 00 00',
      website: 'maison-zwit.demo',
      instagram: '@maisonvelvet.demo'
    },
    recurring_features: ['Lounge', 'Vestiaire', 'Bar', 'Piste de danse', 'Parking privé'],
    locked_rules: { alwaysLogo: true, alwaysAddress: true, alwaysPhone: true, keepBrandColors: true },
    updated_at: new Date().toISOString()
  });

  const sampleProject = () => ({
    id: 'a1000000-0000-4000-8000-000000000001',
    establishment_id: VENUE_ID,
    title: 'Nuit Zwit · Élégance & Connexions',
    status: 'draft',
    theme: 'Zwit Luxe',
    output_type: 'social_kit',
    event_payload: {
      title: 'NUIT ZWIT',
      subtitle: 'Élégance & Connexions',
      theme: 'Zwit Luxe',
      date: '',
      endDate: '',
      startTime: '21:30',
      endTime: '04:00',
      description: 'Une soirée élégante et immersive, pensée pour les échanges naturels et les rencontres choisies.',
      guest: '',
      dj: 'DJ LÉON',
      promotion: 'Cocktail de bienvenue avant 23 h',
      dressCode: 'Élégant · noir, bordeaux ou champagne',
      audience: 'Couples, femmes et membres sélectionnés',
      address: 'Lille · adresse communiquée avant la soirée',
      phone: '03 20 00 00 00',
      website: 'maison-zwit.demo',
      amenities: ['Lounge', 'Vestiaire', 'Bar', 'Parking privé']
    },
    creative_payload: {
      brief: 'Créer une affiche premium, sensuelle et très lisible qui évoque le velours, la lumière champagne et une nuit exclusive.',
      style: 'velvet-luxe',
      density: 'balanced',
      template: 'velvet-luxe',
      formats: ['4:5', '9:16'],
      variants: 2
    },
    prompt_snapshot: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const memory = {
    transientRenders: [],
    transientAssets: []
  };

  function uuid() {
    return crypto.randomUUID?.() || `marketing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function safeParse(value, fallback = {}) {
    try { return JSON.parse(String(value || '')); } catch { return fallback; }
  }

  function loadStore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return {
        brand: saved.brand || defaultBrand(),
        projects: Array.isArray(saved.projects) && saved.projects.length ? saved.projects : [sampleProject()],
        assets: Array.isArray(saved.assets) ? saved.assets : [],
        renders: Array.isArray(saved.renders) ? saved.renders : []
      };
    } catch {
      return { brand: defaultBrand(), projects: [sampleProject()], assets: [], renders: [] };
    }
  }

  let store = loadStore();

  function compactPreview(value) {
    const source = String(value || '');
    return source.length <= 420000 ? source : '';
  }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        brand: { ...store.brand, logoUrl: compactPreview(store.brand?.logoUrl) || logoSvg },
        projects: store.projects.slice(0, MAX_PROJECTS),
        assets: store.assets.slice(0, MAX_ASSETS).map((asset) => ({ ...asset, previewUrl: compactPreview(asset.previewUrl) })),
        renders: store.renders.slice(0, MAX_RENDERS).map((render) => ({ ...render, previewUrl: compactPreview(render.previewUrl) }))
      }));
    } catch {
      // L’environnement Marketing reste utilisable en mémoire si le quota local est atteint.
    }
  }

  function snapshot() {
    return {
      ok: true,
      migrationPending: false,
      marketingMode: true,
      brand: store.brand,
      projects: store.projects,
      assets: [...memory.transientAssets, ...store.assets].slice(0, 100),
      renders: [...memory.transientRenders, ...store.renders].slice(0, 100),
      templates: TEMPLATES,
      capabilities: {
        workersAI: true,
        imageModel: '@cf/black-forest-labs/flux-1-schnell',
        directionModel: 'Zwit Marketing Art Director',
        v1: true,
        v2: true,
        v3: true,
        marketingSafe: true
      }
    };
  }

  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-velvet-marketing-pro-studio': 'synthetic'
      }
    });
  }

  async function imageDataUrl(file, options = {}) {
    const maxSide = options.maxSide || 1200;
    const quality = options.quality || 0.78;
    const preservePng = options.preservePng === true && file.type === 'image/png';
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: preservePng });
    if (!preservePng) {
      context.fillStyle = '#09090B';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL(preservePng ? 'image/png' : 'image/jpeg', quality);
  }

  function directionFrom(body) {
    const brand = body.brand || store.brand || defaultBrand();
    const event = body.event || {};
    const creative = body.creative || {};
    const theme = event.theme || event.title || 'soirée premium';
    const style = creative.style || brand.visual_style || 'velvet-luxe';
    const palette = `${brand.primary_color || '#7D294C'}, ${brand.secondary_color || '#0D0D0D'}, ${brand.accent_color || '#D5B477'}`;
    return {
      artDirection: `Affiche de club privé haut de gamme pour Maison Zwit Lille. Thème ${theme}. Style ${style}. Ambiance sensuelle, festive et professionnelle, avec une hiérarchie forte et de larges zones propres pour les textes exacts.`,
      backgroundPrompt: [
        'Premium French private club event poster background',
        `theme ${theme}`,
        `visual style ${style}`,
        `brand palette ${palette}`,
        brand.brand_prompt || 'luxury burgundy black champagne nightlife',
        event.description || creative.brief || '',
        'cinematic nightclub lighting, refined sensual atmosphere, premium editorial composition, realistic decorative environment, layered depth, elegant negative space reserved for later typography, no readable people faces',
        'strictly no text, no typography, no letters, no numbers, no logo, no watermark, no explicit content'
      ].filter(Boolean).join(', ').slice(0, 1900),
      layout: creative.density || brand.density || 'balanced',
      contrast: 'Contraste élevé, centre lumineux et zones sombres réservées aux informations exactes.',
      photoTreatment: 'Les photos fournies restent fidèles, cadrées proprement et composées par Zwit sans recréer les personnes.',
      effects: style.includes('neon') ? ['neon glow', 'electric particles', 'light streaks'] : ['cinematic glow', 'silk texture', 'champagne highlights'],
      warnings: []
    };
  }

  async function generateBackground(body) {
    const direction = body.direction?.backgroundPrompt ? body.direction : directionFrom(body);
    const response = await previousFetch(CONTROL_AI_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_image',
        prompt: `${direction.backgroundPrompt}. Poster background only. Preserve clean negative space for exact event typography added later by Zwit. No text, no letters, no numbers, no logo.`,
        format: body.format || '4:5'
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'marketing_background_generation_failed');
    const dataUri = String(payload.media?.dataUri || '');
    const image = dataUri.split(',')[1] || '';
    if (!image) throw new Error('workers_ai_image_missing');
    return {
      ok: true,
      image,
      prompt: payload.media?.prompt || direction.backgroundPrompt,
      model: payload.media?.model || '@cf/black-forest-labs/flux-1-schnell',
      marketingMode: true
    };
  }

  function upsertProject(project) {
    const next = {
      ...project,
      id: project.id || uuid(),
      establishment_id: VENUE_ID,
      updated_at: new Date().toISOString(),
      created_at: project.created_at || new Date().toISOString()
    };
    const index = store.projects.findIndex((item) => item.id === next.id);
    if (index >= 0) store.projects[index] = next;
    else store.projects.unshift(next);
    store.projects = store.projects.slice(0, MAX_PROJECTS);
    persist();
    return next;
  }

  async function handleJson(request) {
    const body = safeParse(await request.clone().text(), {});
    const action = String(body.action || 'capabilities');

    if (action === 'capabilities') return json(snapshot());
    if (action === 'save_brand_kit') {
      store.brand = {
        ...defaultBrand(),
        ...store.brand,
        ...(body.brand || {}),
        establishment_id: VENUE_ID,
        logoUrl: body.brand?.logoUrl || store.brand?.logoUrl || logoSvg,
        updated_at: new Date().toISOString()
      };
      persist();
      return json(snapshot());
    }
    if (action === 'save_project') {
      const project = upsertProject(body.project || {});
      return json({ ...snapshot(), projectId: project.id });
    }
    if (action === 'delete_project') {
      const projectId = String(body.projectId || '');
      store.projects = store.projects.filter((project) => project.id !== projectId);
      store.renders = store.renders.filter((render) => render.project_id !== projectId);
      memory.transientRenders = memory.transientRenders.filter((render) => render.project_id !== projectId);
      persist();
      return json(snapshot());
    }
    if (action === 'plan_poster') return json({ ok: true, direction: directionFrom(body), marketingMode: true });
    if (action === 'generate_background') {
      try {
        return json(await generateBackground(body));
      } catch (error) {
        return json({ error: error.message || 'marketing_background_generation_failed' }, 502);
      }
    }
    return json({ error: 'marketing_pro_studio_action_unknown' }, 400);
  }

  async function handleForm(request) {
    const form = await request.clone().formData();
    const action = String(form.get('action') || 'upload_asset');
    const file = form.get('file');
    if (!(file instanceof File) || file.size < 1) return json({ error: 'studio_asset_required' }, 400);

    if (action === 'save_render') {
      const previewUrl = await imageDataUrl(file, { maxSide: 720, quality: 0.68 });
      const render = {
        id: uuid(),
        project_id: String(form.get('projectId') || ''),
        establishment_id: VENUE_ID,
        render_type: String(form.get('renderType') || 'image'),
        format: String(form.get('format') || '4:5'),
        variant_index: Math.max(1, Number(form.get('variantIndex') || 1)),
        storage_path: `marketing-local/${VENUE_ID}/renders/${uuid()}.jpg`,
        mime_type: 'image/jpeg',
        composition: safeParse(form.get('composition'), {}),
        status: 'ready',
        previewUrl,
        created_at: new Date().toISOString()
      };
      memory.transientRenders.unshift(render);
      store.renders.unshift({ ...render, previewUrl: compactPreview(previewUrl) });
      store.renders = store.renders.slice(0, MAX_RENDERS);
      persist();
      return json({ ok: true, render, marketingMode: true });
    }

    const kind = String(form.get('assetKind') || 'event_photo');
    const preservePng = kind === 'logo' || kind === 'secondary_logo';
    const previewUrl = await imageDataUrl(file, { maxSide: preservePng ? 1000 : 1400, quality: 0.8, preservePng });
    const asset = {
      id: uuid(),
      establishment_id: VENUE_ID,
      project_id: String(form.get('projectId') || '') || null,
      asset_kind: kind,
      storage_path: `marketing-local/${VENUE_ID}/${kind}/${uuid()}.${preservePng ? 'png' : 'jpg'}`,
      mime_type: preservePng ? 'image/png' : 'image/jpeg',
      byte_size: file.size,
      metadata: safeParse(form.get('metadata'), {}),
      previewUrl,
      created_at: new Date().toISOString()
    };
    memory.transientAssets.unshift(asset);
    store.assets.unshift({ ...asset, previewUrl: compactPreview(previewUrl) });
    store.assets = store.assets.slice(0, MAX_ASSETS);
    if (kind === 'logo') {
      store.brand = { ...store.brand, logo_storage_path: asset.storage_path, logoUrl: previewUrl, updated_at: new Date().toISOString() };
    }
    if (kind === 'secondary_logo') {
      store.brand = { ...store.brand, secondary_logo_storage_path: asset.storage_path, secondaryLogoUrl: previewUrl, updated_at: new Date().toISOString() };
    }
    persist();
    return json({ ok: true, asset, marketingMode: true });
  }

  window.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.origin), init);
    const url = new URL(request.url);
    if (url.pathname !== API_PATH) return previousFetch(input, init);
    if (request.method === 'GET') return json(snapshot());
    const type = request.headers.get('content-type') || '';
    try {
      return type.includes('multipart/form-data') ? await handleForm(request) : await handleJson(request);
    } catch (error) {
      return json({ error: error.message || 'marketing_pro_studio_failed' }, 500);
    }
  };
})();
