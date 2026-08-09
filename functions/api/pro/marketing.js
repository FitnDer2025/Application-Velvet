import { json, readJson, supabase } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from '../members/_shared.js';

const PRO_ROLES = new Set(['pro_owner', 'pro_staff', 'admin', 'direction']);
const PRIVILEGED_ROLES = new Set(['admin', 'direction']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COPY_MODEL = '@cf/zai-org/glm-4.7-flash';
const STUDIO_BUCKET = 'velvet-pro-studio';
const NETWORKS = new Set(['facebook', 'instagram', 'tiktok']);
const CAMPAIGN_STATUSES = new Set(['draft', 'ready', 'scheduled', 'running', 'completed', 'cancelled', 'archived']);
const GRAPH_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'];
const TIKTOK_SCOPES = ['user.info.basic', 'video.publish', 'video.upload'];
const MAX_COPY = 4000;

function isPrivileged(access) {
  return access.account.roles.some((role) => PRIVILEGED_ROLES.has(role));
}

async function proAccess(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return access;
  if (!access.account.roles.some((role) => PRO_ROLES.has(role))) {
    return { ...access, response: withSession({ error: 'pro_access_required' }, access.session, 403) };
  }
  return access;
}

async function allowedVenue(env, access, venueId) {
  if (!UUID.test(String(venueId || ''))) return null;
  if (isPrivileged(access)) {
    const rows = await restJson(env, `/rest/v1/establishments?select=id,name,kind,city,slug,subscription_status&id=eq.${encodeURIComponent(venueId)}&limit=1`, access.session);
    return rows[0] || null;
  }
  const rows = await restJson(
    env,
    `/rest/v1/establishments?select=id,name,kind,city,slug,subscription_status,establishment_staff!inner(user_id,staff_role,status)&id=eq.${encodeURIComponent(venueId)}&establishment_staff.user_id=eq.${encodeURIComponent(access.account.userId)}&establishment_staff.status=eq.active&limit=1`,
    access.session
  );
  const venue = rows[0] || null;
  return venue && ['trial', 'active'].includes(venue.subscription_status) ? venue : null;
}

function safeJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function migrationMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('pro_marketing_') || message.includes('pro_social_connections');
}

function configured(env) {
  return {
    meta: Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_GRAPH_VERSION && env.SOCIAL_TOKEN_ENCRYPTION_KEY && env.SOCIAL_OAUTH_STATE_SECRET),
    tiktok: Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.SOCIAL_TOKEN_ENCRYPTION_KEY && env.SOCIAL_OAUTH_STATE_SECRET),
    scheduler: Boolean(env.SUPABASE_SERVICE_ROLE_KEY && env.SOCIAL_TOKEN_ENCRYPTION_KEY),
    workersAI: Boolean(env.AI && typeof env.AI.run === 'function')
  };
}

function base64UrlEncode(bytes) {
  let binary = '';
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < array.length; index += 1) binary += String.fromCharCode(array[index]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || ''))));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secret || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(value || ''))));
}

async function timingSafeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ''));
  const b = new TextEncoder().encode(String(right || ''));
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

async function encryptPayload(env, payload) {
  const secret = String(env.SOCIAL_TOKEN_ENCRYPTION_KEY || '');
  if (!secret) throw new Error('social_token_encryption_not_configured');
  const rawKey = await sha256(secret);
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}`;
}

async function decryptPayload(env, value) {
  const [version, encodedIv, encodedCiphertext] = String(value || '').split('.');
  if (version !== 'v1' || !encodedIv || !encodedCiphertext) throw new Error('social_credentials_invalid');
  const rawKey = await sha256(String(env.SOCIAL_TOKEN_ENCRYPTION_KEY || ''));
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlDecode(encodedIv) }, key, base64UrlDecode(encodedCiphertext));
  return JSON.parse(new TextDecoder().decode(clear));
}

async function oauthState(env, payload) {
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ ...payload, expiresAt: Date.now() + 10 * 60 * 1000 })));
  const signature = await hmac(env.SOCIAL_OAUTH_STATE_SECRET, encoded);
  return `${encoded}.${signature}`;
}

async function verifyOauthState(env, state, provider, userId) {
  const [encoded, signature] = String(state || '').split('.');
  if (!encoded || !signature) throw new Error('social_oauth_state_invalid');
  const expected = await hmac(env.SOCIAL_OAUTH_STATE_SECRET, encoded);
  if (!(await timingSafeEqual(signature, expected))) throw new Error('social_oauth_state_invalid');
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded)));
  if (payload.provider !== provider || payload.userId !== userId || Number(payload.expiresAt) < Date.now() || !UUID.test(payload.venueId)) {
    throw new Error('social_oauth_state_invalid');
  }
  return payload;
}

function redirectUri(request, provider) {
  const url = new URL(request.url);
  return `${url.origin}/api/pro/marketing/oauth/${provider}/callback`;
}

function appReturnUrl(request, destination = 'connections') {
  const url = new URL(request.url);
  const target = url.searchParams.get('return') === 'marketing-pro' ? '/marketing-pro/' : '/pro/';
  return `${url.origin}${target}?velvet_marketing=${encodeURIComponent(destination)}`;
}

async function signedStudioUrl(env, token, path, expiresIn = 1800) {
  if (!path) return '';
  const response = await supabase(env, `/storage/v1/object/sign/${STUDIO_BUCKET}/${path}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn })
  }, token);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.signedURL) return '';
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  return /^https?:\/\//.test(payload.signedURL) ? payload.signedURL : `${base}/storage/v1${payload.signedURL.startsWith('/') ? '' : '/'}${payload.signedURL}`;
}

async function connectionView(env, connection) {
  const view = {
    id: connection.id,
    provider: connection.provider,
    providerAccountId: connection.provider_account_id,
    providerAccountName: connection.provider_account_name,
    providerAccountHandle: connection.provider_account_handle,
    scopes: connection.granted_scopes || [],
    status: connection.status,
    expiresAt: connection.expires_at,
    lastVerifiedAt: connection.last_verified_at,
    configuration: connection.configuration || {},
    lastError: connection.last_error || ''
  };
  if (connection.status === 'selection_required' && connection.credentials_ciphertext) {
    try {
      const credentials = await decryptPayload(env, connection.credentials_ciphertext);
      view.availableAccounts = (credentials.pages || []).map((page) => ({
        id: page.id,
        name: page.name,
        instagramId: page.instagram?.id || '',
        instagramUsername: page.instagram?.username || ''
      }));
    } catch {
      view.availableAccounts = [];
    }
  }
  return view;
}

async function snapshot(env, access, venue) {
  try {
    const [events, projects, renderRows, connections, campaigns, publications, metrics] = await Promise.all([
      restJson(env, `/rest/v1/events?select=id,title,description,starts_at,ends_at,capacity,location_public,audience,visibility,price_cents,currency,registration_open,dress_code&establishment_id=eq.${encodeURIComponent(venue.id)}&order=starts_at.asc&limit=100`, access.session),
      restJson(env, `/rest/v1/pro_studio_projects?select=id,event_id,title,status,theme,output_type,event_payload,updated_at&establishment_id=eq.${encodeURIComponent(venue.id)}&order=updated_at.desc&limit=100`, access.session),
      restJson(env, `/rest/v1/pro_studio_renders?select=id,project_id,render_type,format,variant_index,storage_path,mime_type,status,created_at&establishment_id=eq.${encodeURIComponent(venue.id)}&status=eq.ready&order=created_at.desc&limit=200`, access.session),
      restJson(env, `/rest/v1/pro_social_connections?select=*&establishment_id=eq.${encodeURIComponent(venue.id)}&order=provider.asc`, access.session),
      restJson(env, `/rest/v1/pro_marketing_campaigns?select=*&establishment_id=eq.${encodeURIComponent(venue.id)}&order=updated_at.desc&limit=100`, access.session),
      restJson(env, `/rest/v1/pro_marketing_publications?select=*&establishment_id=eq.${encodeURIComponent(venue.id)}&order=scheduled_at.desc&limit=300`, access.session),
      restJson(env, `/rest/v1/pro_marketing_metrics?select=*&establishment_id=eq.${encodeURIComponent(venue.id)}&order=captured_at.desc&limit=500`, access.session)
    ]);
    const renders = await Promise.all(renderRows.map(async (render) => ({
      ...render,
      previewUrl: await signedStudioUrl(env, access.session.access_token, render.storage_path, 1800)
    })));
    return {
      migrationPending: false,
      venue,
      events,
      projects,
      renders,
      connections: await Promise.all(connections.map((connection) => connectionView(env, connection))),
      campaigns,
      publications,
      metrics,
      capabilities: configured(env)
    };
  } catch (error) {
    if (!migrationMissing(error)) throw error;
    return {
      migrationPending: true,
      venue,
      events: [], projects: [], renders: [], connections: [], campaigns: [], publications: [], metrics: [],
      capabilities: configured(env)
    };
  }
}

function eventContext(event, venue) {
  const date = event?.starts_at ? new Date(event.starts_at) : null;
  return {
    venue: venue?.name || 'Votre établissement',
    city: venue?.city || '',
    title: cleanText(event?.title, 180),
    description: cleanText(event?.description, 1200),
    date: date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
    time: date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
    audience: cleanText(event?.audience, 300),
    dressCode: cleanText(event?.dress_code, 300),
    location: cleanText(event?.location_public, 300),
    price: Number.isFinite(Number(event?.price_cents)) ? `${(Number(event.price_cents) / 100).toFixed(0)} €` : ''
  };
}

function conservativeCompliance(copy, networks = []) {
  const text = String(copy || '').toLowerCase();
  const issues = [];
  const severe = [
    [/\bsexe\b|\bsexuel(?:le)?s?\b|\borgie\b|\bpartouze\b|\béchangisme explicite\b/, 'Formulation sexuellement explicite'],
    [/\bnudité\b|\bnue?s?\b|\bporn(?:o|ographique)?\b/, 'Référence à la nudité ou à la pornographie'],
    [/\bservices? sexuels?\b|\bescort\b|\bprostitution\b/, 'Formulation pouvant évoquer un service sexuel']
  ];
  const sensitive = [
    [/\blibertin(?:e|age|s)?\b|\béchangiste?s?\b/, 'Vocabulaire adulte susceptible de réduire la diffusion'],
    [/\bfetish\b|\bfétich(?:e|iste|isme)\b|\bsm\b|\bbdsm\b/, 'Thème adulte à reformuler avec sobriété']
  ];
  severe.forEach(([pattern, label]) => { if (pattern.test(text)) issues.push({ severity: 'blocking', label }); });
  sensitive.forEach(([pattern, label]) => { if (pattern.test(text)) issues.push({ severity: 'warning', label }); });
  const networkStatus = {};
  networks.forEach((network) => {
    networkStatus[network] = issues.some((issue) => issue.severity === 'blocking')
      ? 'blocked'
      : issues.length ? 'review' : 'ready';
  });
  return {
    score: Math.max(0, 100 - issues.filter((issue) => issue.severity === 'blocking').length * 50 - issues.filter((issue) => issue.severity === 'warning').length * 15),
    issues,
    networkStatus,
    recommendations: issues.length
      ? ['Privilégier les mots élégance, rencontre, liberté, soirée privée et expérience.', 'Conserver une représentation non explicite et destinée à un public majeur.']
      : ['Le texte est formulé de manière sobre et compatible avec une communication grand public.'],
    humanReviewRequired: true
  };
}

function fallbackCopy(event, venue, networks, tone, cta) {
  const context = eventContext(event, venue);
  const base = [
    `✨ ${context.title || 'Une nouvelle soirée vous attend'}`,
    context.description || `Une expérience pensée par ${context.venue}, entre élégance, musique et rencontres choisies.`,
    [context.date, context.time, context.location].filter(Boolean).join(' · '),
    context.dressCode ? `Dress code : ${context.dressCode}` : '',
    context.price ? `Entrée : ${context.price}` : '',
    cta || 'Découvrez la soirée et réservez votre place sur Zwit.'
  ].filter(Boolean).join('\n\n');
  const hashtags = ['#Zwit', '#SoiréePrivée', '#Événement', '#Nightlife', context.city ? `#${context.city.replace(/\s+/g, '')}` : ''].filter(Boolean);
  return {
    baseCopy: base,
    versions: {
      facebook: `${base}\n\n${hashtags.slice(0, 4).join(' ')}`,
      instagram: `${base}\n\n${hashtags.join(' ')}`,
      tiktok: `${context.title}. ${context.date}. ${cta || 'Retrouvez toutes les informations sur Zwit.'}\n\n${hashtags.slice(0, 5).join(' ')}`
    },
    hashtags,
    tone: tone || 'premium',
    compliance: conservativeCompliance(base, networks)
  };
}

function parseAiJson(result) {
  const raw = String(result?.response || result?.answer || result?.result || result || '');
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('marketing_copy_invalid');
  return JSON.parse(match[0]);
}

async function generateCopy(env, { event, venue, networks, tone, objective, cta }) {
  const fallback = fallbackCopy(event, venue, networks, tone, cta);
  if (!env.AI || typeof env.AI.run !== 'function') return fallback;
  const context = eventContext(event, venue);
  const prompt = `Tu es directrice éditoriale senior pour Zwit, plateforme française premium réservée aux adultes et aux professionnels de la nuit.
Écris une campagne qui donne envie de découvrir et réserver la soirée, sans contenu explicite, sans promesse sexuelle et sans vocabulaire vulgaire.
Établissement : ${context.venue}, ${context.city}.
Soirée : ${context.title}.
Description : ${context.description}.
Date et heure : ${context.date}, ${context.time}.
Public : ${context.audience}.
Dress code : ${context.dressCode}.
Lieu : ${context.location}.
Prix : ${context.price}.
Objectif : ${objective || 'inscriptions'}.
Ton : ${tone || 'premium, chaleureux et désirable'}.
CTA : ${cta || 'Découvrir la soirée sur Zwit'}.
Réseaux : ${networks.join(', ')}.
Contraintes : français naturel, élégant, destiné aux réseaux sociaux, aucune nudité, aucun acte sexuel, aucun service sexuel, aucune formulation qui promet une rencontre garantie. Le texte doit rester accessible à un public majeur tout en étant compatible avec la modération des plateformes.
Réponds uniquement en JSON valide : {"baseCopy":"...","versions":{"facebook":"...","instagram":"...","tiktok":"..."},"hashtags":["#..."],"tone":"..."}`;
  try {
    const result = await env.AI.run(COPY_MODEL, {
      messages: [
        { role: 'system', content: 'Réponds uniquement avec un objet JSON valide en français.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.55,
      max_tokens: 1200
    });
    const parsed = parseAiJson(result);
    const versions = {
      facebook: cleanText(parsed.versions?.facebook, MAX_COPY) || fallback.versions.facebook,
      instagram: cleanText(parsed.versions?.instagram, MAX_COPY) || fallback.versions.instagram,
      tiktok: cleanText(parsed.versions?.tiktok, MAX_COPY) || fallback.versions.tiktok
    };
    const baseCopy = cleanText(parsed.baseCopy, MAX_COPY) || fallback.baseCopy;
    return {
      baseCopy,
      versions,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 20).map((item) => cleanText(item, 80)).filter(Boolean) : fallback.hashtags,
      tone: cleanText(parsed.tone, 120) || tone || 'premium',
      compliance: conservativeCompliance(Object.values(versions).join('\n'), networks)
    };
  } catch {
    return fallback;
  }
}

function campaignPayload(body, access, venue) {
  const source = body.campaign || {};
  const networks = Array.isArray(source.selected_networks)
    ? source.selected_networks.filter((network) => NETWORKS.has(network))
    : [];
  return {
    id: UUID.test(source.id) ? source.id : crypto.randomUUID(),
    establishment_id: venue.id,
    event_id: UUID.test(source.event_id) ? source.event_id : null,
    studio_project_id: UUID.test(source.studio_project_id) ? source.studio_project_id : null,
    studio_render_id: UUID.test(source.studio_render_id) ? source.studio_render_id : null,
    title: cleanText(source.title, 220) || 'Nouvelle campagne',
    objective: cleanText(source.objective, 80) || 'event_registration',
    status: CAMPAIGN_STATUSES.has(source.status) ? source.status : 'draft',
    base_copy: cleanText(source.base_copy, MAX_COPY),
    call_to_action: cleanText(source.call_to_action, 300),
    landing_url: cleanText(source.landing_url, 1000) || null,
    selected_networks: networks,
    editorial_plan: safeJson(source.editorial_plan, []),
    compliance_report: safeJson(source.compliance_report, {}),
    settings: safeJson(source.settings, {}),
    created_by: access.account.userId,
    updated_by: access.account.userId
  };
}

async function audit(env, session, venueId, action, details = {}, campaignId = null, publicationId = null, actor = null) {
  return restJson(env, '/rest/v1/pro_marketing_audit_log', session, {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      establishment_id: venueId,
      campaign_id: campaignId,
      publication_id: publicationId,
      actor_user_id: actor,
      action,
      details
    })
  }).catch(() => null);
}

async function upsertConnection(env, access, payload) {
  await restJson(env, '/rest/v1/pro_social_connections?on_conflict=establishment_id,provider', access.session, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });
}

async function selectMetaAccount(env, access, venue, accountId) {
  const rows = await restJson(env, `/rest/v1/pro_social_connections?select=*&establishment_id=eq.${encodeURIComponent(venue.id)}&provider=eq.meta&limit=1`, access.session);
  const connection = rows[0];
  if (!connection?.credentials_ciphertext) throw new Error('meta_connection_missing');
  const credentials = await decryptPayload(env, connection.credentials_ciphertext);
  const page = (credentials.pages || []).find((item) => item.id === accountId);
  if (!page) throw new Error('meta_page_invalid');
  credentials.selectedPageId = page.id;
  await restJson(env, `/rest/v1/pro_social_connections?id=eq.${encodeURIComponent(connection.id)}`, access.session, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      credentials_ciphertext: await encryptPayload(env, credentials),
      provider_account_id: page.id,
      provider_account_name: page.name,
      provider_account_handle: page.instagram?.username || '',
      status: 'active',
      last_verified_at: new Date().toISOString(),
      last_error: null,
      configuration: {
        facebookPageId: page.id,
        facebookPageName: page.name,
        instagramAccountId: page.instagram?.id || '',
        instagramUsername: page.instagram?.username || ''
      }
    })
  });
  await audit(env, access.session, venue.id, 'social_connection_selected', { provider: 'meta', accountId: page.id }, null, null, access.account.userId);
}

async function saveCampaign(env, access, venue, body) {
  const campaign = campaignPayload(body, access, venue);
  await restJson(env, '/rest/v1/pro_marketing_campaigns?on_conflict=id', access.session, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(campaign)
  });
  await audit(env, access.session, venue.id, 'campaign_saved', { status: campaign.status, networks: campaign.selected_networks }, campaign.id, null, access.account.userId);
  return campaign.id;
}

async function scheduleCampaign(env, access, venue, body, publishNow = false) {
  const campaign = campaignPayload(body, access, venue);
  const compliance = conservativeCompliance(
    [campaign.base_copy, ...Object.values(campaign.settings?.copies || {})].join('\n'),
    campaign.selected_networks
  );
  if (compliance.issues.some((issue) => issue.severity === 'blocking')) throw new Error('marketing_compliance_blocking');
  if (body.approved !== true) throw new Error('marketing_human_approval_required');
  if (!campaign.event_id || !campaign.studio_render_id || !campaign.selected_networks.length) throw new Error('marketing_campaign_incomplete');

  const providerConnections = await restJson(env, `/rest/v1/pro_social_connections?select=*&establishment_id=eq.${encodeURIComponent(venue.id)}&status=eq.active`, access.session);
  const connectionByNetwork = {
    facebook: providerConnections.find((item) => item.provider === 'meta'),
    instagram: providerConnections.find((item) => item.provider === 'meta'),
    tiktok: providerConnections.find((item) => item.provider === 'tiktok')
  };
  const missing = campaign.selected_networks.filter((network) => !connectionByNetwork[network]);
  if (missing.length) throw new Error(`social_connection_required:${missing.join(',')}`);

  campaign.status = publishNow ? 'running' : 'scheduled';
  campaign.approved_at = new Date().toISOString();
  campaign.approved_by = access.account.userId;
  campaign.compliance_report = compliance;
  await restJson(env, '/rest/v1/pro_marketing_campaigns?on_conflict=id', access.session, {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(campaign)
  });

  const requestedSlots = Array.isArray(body.slots) && body.slots.length
    ? body.slots.slice(0, 12)
    : [{ code: 'primary', scheduledAt: publishNow ? new Date().toISOString() : body.scheduledAt }];
  const publications = [];
  for (const slot of requestedSlots) {
    const date = new Date(publishNow ? Date.now() : slot.scheduledAt);
    if (Number.isNaN(date.getTime())) throw new Error('marketing_schedule_invalid');
    for (const network of campaign.selected_networks) {
      const copy = cleanText(slot.copies?.[network] || campaign.settings?.copies?.[network] || campaign.base_copy, MAX_COPY);
      publications.push({
        id: crypto.randomUUID(),
        establishment_id: venue.id,
        campaign_id: campaign.id,
        connection_id: connectionByNetwork[network].id,
        provider: network,
        publication_kind: network === 'tiktok' ? (campaign.settings?.tiktokMode === 'draft' ? 'draft' : 'photo') : 'feed',
        sequence_code: cleanText(slot.code, 60) || 'primary',
        copy,
        media_render_id: campaign.studio_render_id,
        scheduled_at: date.toISOString(),
        status: 'scheduled',
        settings: { ...(campaign.settings?.networkSettings?.[network] || {}), publishMode: network === 'tiktok' ? (campaign.settings?.tiktokMode || 'draft') : 'direct' },
        created_by: access.account.userId
      });
    }
  }
  await restJson(env, '/rest/v1/pro_marketing_publications?on_conflict=campaign_id,provider,sequence_code', access.session, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(publications)
  });
  await audit(env, access.session, venue.id, publishNow ? 'campaign_publish_requested' : 'campaign_scheduled', { count: publications.length }, campaign.id, null, access.account.userId);
  if (publishNow) await processDuePublications(env, { campaignId: campaign.id, limit: publications.length });
  return campaign.id;
}

async function serviceFetch(env, path, init = {}) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) throw new Error('social_scheduler_not_configured');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${base}${path}`, { ...init, headers });
}

async function serviceRows(env, path, init = {}) {
  const response = await serviceFetch(env, path, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.error || `supabase_${response.status}`);
  return payload;
}

async function servicePatch(env, path, payload) {
  return serviceRows(env, path, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload)
  });
}

async function publicMediaUrl(env, origin, render) {
  const expires = Math.floor(Date.now() / 1000) + 30 * 60;
  const signature = await hmac(env.SOCIAL_OAUTH_STATE_SECRET, `${render.id}.${render.storage_path}.${expires}`);
  return `${origin}/api/pro/marketing/media?renderId=${encodeURIComponent(render.id)}&exp=${expires}&sig=${encodeURIComponent(signature)}`;
}

async function postForm(url, data, token) {
  const form = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.set(key, String(value));
  });
  if (token) form.set('access_token', token);
  const response = await fetch(url, { method: 'POST', body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error?.message || payload.error?.code || `provider_${response.status}`);
  return payload;
}

async function publishFacebook(env, publication, campaign, render, credentials, origin) {
  const page = (credentials.pages || []).find((item) => item.id === credentials.selectedPageId);
  if (!page?.accessToken) throw new Error('meta_page_token_missing');
  const version = String(env.META_GRAPH_VERSION || '');
  if (!version) throw new Error('meta_graph_version_missing');
  const mediaUrl = await publicMediaUrl(env, origin, render);
  const result = await postForm(`https://graph.facebook.com/${version}/${encodeURIComponent(page.id)}/photos`, {
    url: mediaUrl,
    caption: publication.copy,
    published: 'true'
  }, page.accessToken);
  return { status: 'published', externalId: result.post_id || result.id || '', externalUrl: '' };
}

async function publishInstagram(env, publication, campaign, render, credentials, origin) {
  const page = (credentials.pages || []).find((item) => item.id === credentials.selectedPageId);
  const instagramId = page?.instagram?.id;
  if (!page?.accessToken || !instagramId) throw new Error('instagram_professional_account_missing');
  const version = String(env.META_GRAPH_VERSION || '');
  if (!version) throw new Error('meta_graph_version_missing');
  const mediaUrl = await publicMediaUrl(env, origin, render);
  const isVideo = String(render.mime_type || '').startsWith('video/');
  const container = await postForm(`https://graph.facebook.com/${version}/${encodeURIComponent(instagramId)}/media`, isVideo
    ? { media_type: 'REELS', video_url: mediaUrl, caption: publication.copy, share_to_feed: 'true' }
    : { image_url: mediaUrl, caption: publication.copy }, page.accessToken);
  const result = await postForm(`https://graph.facebook.com/${version}/${encodeURIComponent(instagramId)}/media_publish`, { creation_id: container.id }, page.accessToken);
  return { status: 'published', externalId: result.id || '', externalUrl: '' };
}

async function publishTikTok(env, publication, campaign, render, credentials, origin) {
  if (!credentials.accessToken) throw new Error('tiktok_access_token_missing');
  const mediaUrl = await publicMediaUrl(env, origin, render);
  const mode = publication.settings?.publishMode === 'direct' ? 'DIRECT_POST' : 'MEDIA_UPLOAD';
  let privacy = 'SELF_ONLY';
  if (mode === 'DIRECT_POST') {
    const creatorResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: { authorization: `Bearer ${credentials.accessToken}`, 'content-type': 'application/json; charset=UTF-8' }
    });
    const creator = await creatorResponse.json().catch(() => ({}));
    if (!creatorResponse.ok || creator.error?.code !== 'ok') throw new Error(creator.error?.message || creator.error?.code || 'tiktok_creator_info_failed');
    const requested = publication.settings?.privacyLevel || 'SELF_ONLY';
    privacy = creator.data?.privacy_level_options?.includes(requested) ? requested : 'SELF_ONLY';
  }
  const postInfo = mode === 'DIRECT_POST'
    ? {
        title: cleanText(campaign.title, 90),
        description: cleanText(publication.copy, 4000),
        privacy_level: privacy,
        disable_comment: Boolean(publication.settings?.disableComment),
        auto_add_music: Boolean(publication.settings?.autoAddMusic),
        brand_content_toggle: false,
        brand_organic_toggle: true
      }
    : { title: cleanText(campaign.title, 90), description: cleanText(publication.copy, 4000) };
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: { authorization: `Bearer ${credentials.accessToken}`, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: postInfo,
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: [mediaUrl] },
      post_mode: mode,
      media_type: 'PHOTO'
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error?.code !== 'ok') throw new Error(result.error?.message || result.error?.code || `tiktok_${response.status}`);
  return {
    status: mode === 'DIRECT_POST' ? 'published' : 'draft_delivered',
    externalId: '',
    publishId: result.data?.publish_id || '',
    externalUrl: ''
  };
}

async function processPublication(env, publication, origin) {
  const [campaignRows, connectionRows, renderRows] = await Promise.all([
    serviceRows(env, `/rest/v1/pro_marketing_campaigns?select=*&id=eq.${encodeURIComponent(publication.campaign_id)}&limit=1`),
    serviceRows(env, `/rest/v1/pro_social_connections?select=*&id=eq.${encodeURIComponent(publication.connection_id)}&limit=1`),
    serviceRows(env, `/rest/v1/pro_studio_renders?select=*&id=eq.${encodeURIComponent(publication.media_render_id)}&limit=1`)
  ]);
  const campaign = campaignRows[0];
  const connection = connectionRows[0];
  const render = renderRows[0];
  if (!campaign || !connection || !render || connection.status !== 'active') throw new Error('marketing_publication_dependencies_missing');
  const credentials = await decryptPayload(env, connection.credentials_ciphertext);
  if (publication.provider === 'facebook') return publishFacebook(env, publication, campaign, render, credentials, origin);
  if (publication.provider === 'instagram') return publishInstagram(env, publication, campaign, render, credentials, origin);
  if (publication.provider === 'tiktok') return publishTikTok(env, publication, campaign, render, credentials, origin);
  throw new Error('marketing_provider_invalid');
}

export async function processDuePublications(env, options = {}) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { processed: 0, skipped: true };
  const now = new Date().toISOString();
  const campaignFilter = UUID.test(options.campaignId) ? `&campaign_id=eq.${encodeURIComponent(options.campaignId)}` : '';
  const limit = Math.max(1, Math.min(50, Number(options.limit || 20)));
  const due = await serviceRows(env, `/rest/v1/pro_marketing_publications?select=*&status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(now)}${campaignFilter}&order=scheduled_at.asc&limit=${limit}`);
  const origin = String(env.VELVET_PUBLIC_ORIGIN || '').replace(/\/$/, '');
  if (!origin && due.length) throw new Error('velvet_public_origin_missing');
  let processed = 0;
  for (const publication of due) {
    const claimed = await servicePatch(env, `/rest/v1/pro_marketing_publications?id=eq.${encodeURIComponent(publication.id)}&status=eq.scheduled`, {
      status: 'processing', attempts: Number(publication.attempts || 0) + 1, last_attempt_at: new Date().toISOString(), error_code: null, error_message: null
    });
    if (!claimed.length) continue;
    try {
      const result = await processPublication(env, { ...publication, status: 'processing' }, origin);
      await servicePatch(env, `/rest/v1/pro_marketing_publications?id=eq.${encodeURIComponent(publication.id)}`, {
        status: result.status,
        external_post_id: result.externalId || null,
        external_post_url: result.externalUrl || null,
        external_publish_id: result.publishId || null,
        published_at: new Date().toISOString(),
        error_code: null,
        error_message: null
      });
      processed += 1;
    } catch (error) {
      const attempts = Number(publication.attempts || 0) + 1;
      await servicePatch(env, `/rest/v1/pro_marketing_publications?id=eq.${encodeURIComponent(publication.id)}`, {
        status: attempts < 3 ? 'scheduled' : 'failed',
        scheduled_at: attempts < 3 ? new Date(Date.now() + attempts * 10 * 60 * 1000).toISOString() : publication.scheduled_at,
        error_code: cleanText(error.message, 120),
        error_message: cleanText(error.message, 800)
      });
    }
  }
  return { processed, due: due.length };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await proAccess(request, env);
    if (access.response) return access.response;
    const venueId = new URL(request.url).searchParams.get('venueId');
    const venue = await allowedVenue(env, access, venueId);
    if (!venue) return withSession({ error: 'pro_marketing_venue_required' }, access.session, 403);
    return withSession({ ok: true, ...(await snapshot(env, access, venue)) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'pro_marketing_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await proAccess(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const action = cleanText(body.action, 60);
    const venue = await allowedVenue(env, access, body.venueId);
    if (!venue) return withSession({ error: 'pro_marketing_venue_required' }, access.session, 403);

    if (action === 'generate_copy') {
      const event = body.event || {};
      const networks = Array.isArray(body.networks) ? body.networks.filter((network) => NETWORKS.has(network)) : [];
      return withSession({ ok: true, copy: await generateCopy(env, { event, venue, networks, tone: body.tone, objective: body.objective, cta: body.cta }) }, access.session);
    }
    if (action === 'compliance_check') {
      return withSession({ ok: true, compliance: conservativeCompliance(cleanText(body.copy, 12000), body.networks || []) }, access.session);
    }
    if (action === 'save_campaign') {
      const campaignId = await saveCampaign(env, access, venue, body);
      return withSession({ ok: true, campaignId, ...(await snapshot(env, access, venue)) }, access.session);
    }
    if (action === 'schedule_campaign' || action === 'publish_now') {
      const campaignId = await scheduleCampaign(env, access, venue, body, action === 'publish_now');
      return withSession({ ok: true, campaignId, ...(await snapshot(env, access, venue)) }, access.session);
    }
    if (action === 'select_meta_account') {
      await selectMetaAccount(env, access, venue, cleanText(body.accountId, 200));
      return withSession({ ok: true, ...(await snapshot(env, access, venue)) }, access.session);
    }
    if (action === 'disconnect') {
      if (!['meta', 'tiktok'].includes(body.provider)) return withSession({ error: 'social_provider_invalid' }, access.session, 400);
      await restJson(env, `/rest/v1/pro_social_connections?establishment_id=eq.${encodeURIComponent(venue.id)}&provider=eq.${encodeURIComponent(body.provider)}`, access.session, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await audit(env, access.session, venue.id, 'social_connection_disconnected', { provider: body.provider }, null, null, access.account.userId);
      return withSession({ ok: true, ...(await snapshot(env, access, venue)) }, access.session);
    }
    if (action === 'cancel_publication') {
      if (!UUID.test(body.publicationId)) return withSession({ error: 'marketing_publication_invalid' }, access.session, 400);
      await restJson(env, `/rest/v1/pro_marketing_publications?id=eq.${encodeURIComponent(body.publicationId)}&establishment_id=eq.${encodeURIComponent(venue.id)}&status=in.(scheduled,draft)`, access.session, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'cancelled' })
      });
      return withSession({ ok: true, ...(await snapshot(env, access, venue)) }, access.session);
    }
    return withSession({ error: 'invalid_pro_marketing_action' }, access.session, 400);
  } catch (error) {
    const message = error.message || 'pro_marketing_write_failed';
    const status = message.startsWith('social_connection_required') || message === 'marketing_human_approval_required' ? 409 : 400;
    return json({ error: message }, status);
  }
}

export async function onMetaStart({ request, env }) {
  const access = await proAccess(request, env);
  if (access.response) return access.response;
  if (!configured(env).meta) return withSession({ error: 'meta_not_configured' }, access.session, 503);
  const url = new URL(request.url);
  const venue = await allowedVenue(env, access, url.searchParams.get('venueId'));
  if (!venue) return withSession({ error: 'pro_marketing_venue_required' }, access.session, 403);
  const state = await oauthState(env, { provider: 'meta', venueId: venue.id, userId: access.account.userId, return: url.searchParams.get('return') || 'pro' });
  const parameters = new URLSearchParams({
    client_id: String(env.META_APP_ID),
    redirect_uri: redirectUri(request, 'meta'),
    state,
    response_type: 'code',
    scope: GRAPH_SCOPES.join(',')
  });
  return Response.redirect(`https://www.facebook.com/${encodeURIComponent(env.META_GRAPH_VERSION)}/dialog/oauth?${parameters}`, 302);
}

export async function onMetaCallback({ request, env }) {
  const access = await proAccess(request, env);
  if (access.response) return access.response;
  const url = new URL(request.url);
  try {
    const state = await verifyOauthState(env, url.searchParams.get('state'), 'meta', access.account.userId);
    if (url.searchParams.get('error')) throw new Error(url.searchParams.get('error_description') || 'meta_authorization_cancelled');
    const code = url.searchParams.get('code');
    if (!code) throw new Error('meta_authorization_code_missing');
    const version = String(env.META_GRAPH_VERSION || '');
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({ client_id: String(env.META_APP_ID), client_secret: String(env.META_APP_SECRET), redirect_uri: redirectUri(request, 'meta'), code }).toString();
    const shortResponse = await fetch(tokenUrl);
    const shortToken = await shortResponse.json().catch(() => ({}));
    if (!shortResponse.ok || !shortToken.access_token) throw new Error(shortToken.error?.message || 'meta_token_exchange_failed');
    const longUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    longUrl.search = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: String(env.META_APP_ID), client_secret: String(env.META_APP_SECRET), fb_exchange_token: shortToken.access_token }).toString();
    const longResponse = await fetch(longUrl);
    const longToken = await longResponse.json().catch(() => ({}));
    const userToken = longResponse.ok && longToken.access_token ? longToken.access_token : shortToken.access_token;
    const accountsUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
    accountsUrl.search = new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account{id,username,name}', access_token: userToken }).toString();
    const accountsResponse = await fetch(accountsUrl);
    const accountsPayload = await accountsResponse.json().catch(() => ({}));
    if (!accountsResponse.ok || !Array.isArray(accountsPayload.data)) throw new Error(accountsPayload.error?.message || 'meta_pages_unavailable');
    const pages = accountsPayload.data.map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      instagram: page.instagram_business_account ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username || '', name: page.instagram_business_account.name || '' } : null
    }));
    if (!pages.length) throw new Error('meta_no_managed_page');
    const selected = pages.length === 1 ? pages[0] : null;
    await upsertConnection(env, access, {
      establishment_id: state.venueId,
      provider: 'meta',
      provider_account_id: selected?.id || null,
      provider_account_name: selected?.name || null,
      provider_account_handle: selected?.instagram?.username || null,
      credentials_ciphertext: await encryptPayload(env, { userToken, pages, selectedPageId: selected?.id || null }),
      granted_scopes: GRAPH_SCOPES,
      status: selected ? 'active' : 'selection_required',
      expires_at: longToken.expires_in ? new Date(Date.now() + Number(longToken.expires_in) * 1000).toISOString() : null,
      last_verified_at: new Date().toISOString(),
      configuration: selected ? { facebookPageId: selected.id, facebookPageName: selected.name, instagramAccountId: selected.instagram?.id || '', instagramUsername: selected.instagram?.username || '' } : { accountCount: pages.length },
      connected_by: access.account.userId,
      last_error: null
    });
    await audit(env, access.session, state.venueId, 'social_connection_authorized', { provider: 'meta', accounts: pages.length }, null, null, access.account.userId);
    return Response.redirect(appReturnUrl(request, selected ? 'connected' : 'select-meta'), 302);
  } catch (error) {
    return Response.redirect(`${appReturnUrl(request, 'connection-error')}&provider=meta&reason=${encodeURIComponent(cleanText(error.message, 180))}`, 302);
  }
}

export async function onTikTokStart({ request, env }) {
  const access = await proAccess(request, env);
  if (access.response) return access.response;
  if (!configured(env).tiktok) return withSession({ error: 'tiktok_not_configured' }, access.session, 503);
  const url = new URL(request.url);
  const venue = await allowedVenue(env, access, url.searchParams.get('venueId'));
  if (!venue) return withSession({ error: 'pro_marketing_venue_required' }, access.session, 403);
  const state = await oauthState(env, { provider: 'tiktok', venueId: venue.id, userId: access.account.userId, return: url.searchParams.get('return') || 'pro' });
  const parameters = new URLSearchParams({
    client_key: String(env.TIKTOK_CLIENT_KEY),
    redirect_uri: redirectUri(request, 'tiktok'),
    state,
    response_type: 'code',
    scope: TIKTOK_SCOPES.join(',')
  });
  return Response.redirect(`https://www.tiktok.com/v2/auth/authorize/?${parameters}`, 302);
}

export async function onTikTokCallback({ request, env }) {
  const access = await proAccess(request, env);
  if (access.response) return access.response;
  const url = new URL(request.url);
  try {
    const state = await verifyOauthState(env, url.searchParams.get('state'), 'tiktok', access.account.userId);
    if (url.searchParams.get('error')) throw new Error(url.searchParams.get('error_description') || 'tiktok_authorization_cancelled');
    const code = url.searchParams.get('code');
    if (!code) throw new Error('tiktok_authorization_code_missing');
    const form = new URLSearchParams({
      client_key: String(env.TIKTOK_CLIENT_KEY),
      client_secret: String(env.TIKTOK_CLIENT_SECRET),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(request, 'tiktok')
    });
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form
    });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description || token.error || 'tiktok_token_exchange_failed');
    const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,profile_deep_link', {
      headers: { authorization: `Bearer ${token.access_token}` }
    });
    const userPayload = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || userPayload.error?.code !== 'ok') throw new Error(userPayload.error?.message || 'tiktok_user_info_failed');
    const user = userPayload.data?.user || {};
    await upsertConnection(env, access, {
      establishment_id: state.venueId,
      provider: 'tiktok',
      provider_account_id: user.open_id || token.open_id,
      provider_account_name: user.display_name || 'TikTok',
      provider_account_handle: user.display_name || '',
      credentials_ciphertext: await encryptPayload(env, { accessToken: token.access_token, refreshToken: token.refresh_token, openId: user.open_id || token.open_id }),
      granted_scopes: String(token.scope || '').split(',').map((scope) => scope.trim()).filter(Boolean),
      status: 'active',
      expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
      last_verified_at: new Date().toISOString(),
      configuration: { profileDeepLink: user.profile_deep_link || '', avatarUrl: user.avatar_url || '', directPostAudited: false },
      connected_by: access.account.userId,
      last_error: null
    });
    await audit(env, access.session, state.venueId, 'social_connection_authorized', { provider: 'tiktok' }, null, null, access.account.userId);
    return Response.redirect(appReturnUrl(request, 'connected'), 302);
  } catch (error) {
    return Response.redirect(`${appReturnUrl(request, 'connection-error')}&provider=tiktok&reason=${encodeURIComponent(cleanText(error.message, 180))}`, 302);
  }
}

export async function onRequestMedia({ request, env }) {
  try {
    const url = new URL(request.url);
    const renderId = url.searchParams.get('renderId');
    const expires = Number(url.searchParams.get('exp'));
    const signature = url.searchParams.get('sig');
    if (!UUID.test(renderId) || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + 3600) {
      return new Response('Lien expiré.', { status: 403 });
    }
    const rows = await serviceRows(env, `/rest/v1/pro_studio_renders?select=id,storage_path,mime_type&id=eq.${encodeURIComponent(renderId)}&status=eq.ready&limit=1`);
    const render = rows[0];
    if (!render) return new Response('Média introuvable.', { status: 404 });
    const expected = await hmac(env.SOCIAL_OAUTH_STATE_SECRET, `${render.id}.${render.storage_path}.${expires}`);
    if (!(await timingSafeEqual(signature, expected))) return new Response('Signature invalide.', { status: 403 });
    const response = await serviceFetch(env, `/storage/v1/object/${STUDIO_BUCKET}/${render.storage_path}`);
    if (!response.ok) return new Response('Média indisponible.', { status: 404 });
    return new Response(response.body, {
      headers: {
        'content-type': render.mime_type || response.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'public, max-age=300',
        'content-disposition': 'inline',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch {
    return new Response('Média indisponible.', { status: 404 });
  }
}
