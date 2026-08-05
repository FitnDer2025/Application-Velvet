(() => {
  'use strict';

  if (!location.pathname.startsWith('/marketing-pro')) return;
  if (window.__VELVET_MARKETING_PRO_CAMPAIGN_BRIDGE__) return;
  window.__VELVET_MARKETING_PRO_CAMPAIGN_BRIDGE__ = true;

  const previousFetch = window.fetch.bind(window);
  const API_PATH = '/api/pro/marketing';
  const STORE_KEY = 'velvet_marketing_pro_campaign_hub_v1';
  const STUDIO_STORE_KEY = 'velvet_marketing_pro_studio_demo_v1';
  const VENUE_ID = '72000000-0000-4000-8000-000000000001';
  const MAX_CAMPAIGNS = 30;
  const MAX_PUBLICATIONS = 120;

  const safeParse = (value, fallback = {}) => {
    try { return JSON.parse(String(value || '')); } catch { return fallback; }
  };
  const uuid = () => crypto.randomUUID?.() || `campaign_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const clean = (value, max = 4000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  function loadStore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return {
        campaigns: Array.isArray(saved.campaigns) ? saved.campaigns : [],
        publications: Array.isArray(saved.publications) ? saved.publications : [],
        metrics: Array.isArray(saved.metrics) ? saved.metrics : []
      };
    } catch {
      return { campaigns: [], publications: [], metrics: [] };
    }
  }

  let store = loadStore();

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        campaigns: store.campaigns.slice(0, MAX_CAMPAIGNS),
        publications: store.publications.slice(0, MAX_PUBLICATIONS),
        metrics: store.metrics.slice(0, 200)
      }));
    } catch {}
  }

  function connectionFixtures() {
    return [
      {
        id: '91000000-0000-4000-8000-000000000001',
        provider: 'meta',
        providerAccountId: 'maison-velvet-page',
        providerAccountName: 'Maison Velvet Lille',
        providerAccountHandle: 'maisonvelvet.lille',
        scopes: ['pages_manage_posts', 'instagram_content_publish'],
        status: 'active',
        configuration: { previewOnly: true, facebookPageName: 'Maison Velvet Lille', instagramUsername: 'maisonvelvet.lille' },
        lastVerifiedAt: new Date().toISOString()
      },
      {
        id: '91000000-0000-4000-8000-000000000002',
        provider: 'tiktok',
        providerAccountId: 'maison-velvet-tiktok',
        providerAccountName: 'Maison Velvet Lille',
        providerAccountHandle: 'maisonvelvet.lille',
        scopes: ['video.upload'],
        status: 'active',
        configuration: { previewOnly: true, directPostAudited: false },
        lastVerifiedAt: new Date().toISOString()
      }
    ];
  }

  async function sources() {
    const [workspaceResult, studioResult] = await Promise.allSettled([
      previousFetch('/api/pro/workspace', { credentials: 'same-origin' }).then((response) => response.json()),
      previousFetch(`/api/pro/studio-ai?venueId=${encodeURIComponent(VENUE_ID)}`, { credentials: 'same-origin' }).then((response) => response.json())
    ]);
    const workspace = workspaceResult.status === 'fulfilled' ? workspaceResult.value : {};
    let studio = studioResult.status === 'fulfilled' ? studioResult.value : {};
    if (!studio.projects?.length && !studio.renders?.length) {
      const local = safeParse(localStorage.getItem(STUDIO_STORE_KEY), {});
      studio = {
        projects: local.projects || [],
        renders: local.renders || [],
        assets: local.assets || []
      };
    }
    const renders = (studio.renders || []).map((render) => ({
      ...render,
      previewUrl: render.previewUrl || render.preview_url || '',
      mime_type: render.mime_type || (render.render_type === 'video' ? 'video/webm' : 'image/png')
    }));
    return {
      venue: workspace.venues?.find((venue) => venue.id === VENUE_ID) || workspace.venues?.[0] || { id: VENUE_ID, name: 'Maison Velvet Lille', city: 'Lille' },
      events: workspace.events || [],
      projects: studio.projects || [],
      renders
    };
  }

  async function snapshot() {
    const source = await sources();
    return {
      ok: true,
      migrationPending: false,
      marketingPreview: true,
      ...source,
      connections: connectionFixtures(),
      campaigns: store.campaigns,
      publications: store.publications,
      metrics: store.metrics,
      capabilities: { meta: true, tiktok: true, scheduler: true, workersAI: true, previewOnly: true }
    };
  }

  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-velvet-marketing-hub': 'preview'
      }
    });
  }

  function compliance(copy, networks = []) {
    const text = String(copy || '').toLowerCase();
    const issues = [];
    const blocking = [
      [/\bpartouze\b|\borgie\b|\bporn(?:o|ographique)?\b/, 'Formulation sexuellement explicite'],
      [/\bescort\b|\bprostitution\b|\bservice sexuel\b/, 'Formulation pouvant évoquer un service sexuel'],
      [/\bnudité\b|\bnue?s?\b/, 'Référence à la nudité']
    ];
    const warnings = [
      [/\blibertin(?:e|age|s)?\b|\béchangiste?s?\b/, 'Vocabulaire adulte susceptible de réduire la portée'],
      [/\bbdsm\b|\bfétich(?:e|iste|isme)\b/, 'Thématique adulte à présenter avec sobriété']
    ];
    blocking.forEach(([pattern, label]) => { if (pattern.test(text)) issues.push({ severity: 'blocking', label }); });
    warnings.forEach(([pattern, label]) => { if (pattern.test(text)) issues.push({ severity: 'warning', label }); });
    const score = Math.max(0, 100 - issues.filter((item) => item.severity === 'blocking').length * 50 - issues.filter((item) => item.severity === 'warning').length * 15);
    return {
      score,
      issues,
      networkStatus: Object.fromEntries(networks.map((network) => [network, score < 50 ? 'blocked' : score < 85 ? 'review' : 'ready'])),
      recommendations: issues.length ? ['Privilégier une formulation élégante, non explicite et centrée sur l’expérience.'] : ['Le texte est formulé de manière sobre.'],
      humanReviewRequired: true
    };
  }

  function eventContext(event = {}) {
    const date = event.starts_at ? new Date(event.starts_at) : null;
    return {
      title: event.title || 'Une soirée Velvet',
      description: event.description || 'Une expérience élégante, musicale et chaleureuse, pensée pour les rencontres choisies.',
      date: date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
      time: date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      location: event.location_public || 'Lille',
      dress: event.dress_code || '',
      price: Number.isFinite(Number(event.price_cents)) ? `${Math.round(Number(event.price_cents) / 100)} €` : ''
    };
  }

  function copyFor(event, cta, tone) {
    const context = eventContext(event);
    const base = [
      `✨ ${context.title}`,
      context.description,
      [context.date, context.time, context.location].filter(Boolean).join(' · '),
      context.dress ? `Dress code : ${context.dress}` : '',
      context.price ? `Entrée : ${context.price}` : '',
      cta || 'Découvrez la soirée et réservez votre place sur Velvet.'
    ].filter(Boolean).join('\n\n');
    const tags = ['#Velvet', '#SoiréePrivée', '#Nightlife', '#Lille'];
    return {
      baseCopy: base,
      versions: {
        facebook: `${base}\n\n${tags.slice(0, 3).join(' ')}`,
        instagram: `${base}\n\n${tags.join(' ')}`,
        tiktok: `${context.title}. ${context.date}. ${cta || 'Toutes les informations sont sur Velvet.'}\n\n${tags.join(' ')}`
      },
      hashtags: tags,
      tone: tone || 'premium',
      compliance: compliance(base, ['facebook', 'instagram', 'tiktok'])
    };
  }

  function upsertCampaign(source) {
    const campaign = {
      ...source,
      id: source.id || uuid(),
      establishment_id: VENUE_ID,
      updated_at: new Date().toISOString(),
      created_at: source.created_at || new Date().toISOString()
    };
    const index = store.campaigns.findIndex((item) => item.id === campaign.id);
    if (index >= 0) store.campaigns[index] = campaign;
    else store.campaigns.unshift(campaign);
    store.campaigns = store.campaigns.slice(0, MAX_CAMPAIGNS);
    persist();
    return campaign;
  }

  function schedule(campaign, slots = []) {
    const connections = connectionFixtures();
    for (const slot of slots) {
      for (const network of campaign.selected_networks || []) {
        const key = `${campaign.id}:${network}:${slot.code || 'primary'}`;
        const existing = store.publications.find((publication) => publication.previewKey === key);
        const publication = {
          id: existing?.id || uuid(),
          previewKey: key,
          establishment_id: VENUE_ID,
          campaign_id: campaign.id,
          connection_id: network === 'tiktok' ? connections[1].id : connections[0].id,
          provider: network,
          publication_kind: network === 'tiktok' ? 'draft' : 'feed',
          sequence_code: slot.code || 'primary',
          copy: clean(slot.copies?.[network] || campaign.settings?.copies?.[network] || campaign.base_copy),
          media_render_id: campaign.studio_render_id,
          scheduled_at: slot.scheduledAt || new Date().toISOString(),
          status: 'scheduled',
          settings: { previewOnly: true },
          attempts: 0,
          error_message: '',
          created_at: existing?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (existing) Object.assign(existing, publication);
        else store.publications.unshift(publication);
      }
    }
    store.publications = store.publications.slice(0, MAX_PUBLICATIONS);
    persist();
  }

  async function handle(body) {
    const action = String(body.action || 'capabilities');
    if (action === 'generate_copy') return json({ ok: true, copy: copyFor(body.event, body.cta, body.tone) });
    if (action === 'compliance_check') return json({ ok: true, compliance: compliance(body.copy, body.networks || []) });
    if (action === 'save_campaign') {
      const campaign = upsertCampaign({ ...(body.campaign || {}), status: 'draft' });
      return json({ ...(await snapshot()), campaignId: campaign.id });
    }
    if (action === 'schedule_campaign') {
      if (body.approved !== true) return json({ error: 'marketing_human_approval_required' }, 409);
      const campaign = upsertCampaign({ ...(body.campaign || {}), status: 'scheduled', approved_at: new Date().toISOString() });
      schedule(campaign, body.slots || [{ code: 'primary', scheduledAt: body.scheduledAt }]);
      return json({ ...(await snapshot()), campaignId: campaign.id });
    }
    if (action === 'publish_now') {
      return json({ error: 'marketing_preview_external_publish_disabled' }, 409);
    }
    if (action === 'cancel_publication') {
      const publication = store.publications.find((item) => item.id === body.publicationId);
      if (publication && ['scheduled', 'draft'].includes(publication.status)) publication.status = 'cancelled';
      persist();
      return json(await snapshot());
    }
    if (action === 'disconnect') return json({ error: 'marketing_preview_connection_locked' }, 409);
    if (action === 'select_meta_account') return json(await snapshot());
    return json({ error: 'marketing_preview_action_unknown' }, 400);
  }

  window.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.origin), init);
    const url = new URL(request.url);
    if (url.pathname !== API_PATH) return previousFetch(input, init);
    try {
      if (request.method === 'GET') return json(await snapshot());
      const body = safeParse(await request.clone().text(), {});
      return handle(body);
    } catch (error) {
      return json({ error: error.message || 'marketing_preview_failed' }, 500);
    }
  };
})();
