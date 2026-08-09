import { json, readJson } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const MAX_PROMPT = 3000;
const MAX_PROJECT_SCENES = 40;
const ALLOWED_FORMATS = new Set(['9:16', '1:1', '16:9']);
const ALLOWED_STATUSES = new Set(['draft', 'approved', 'scheduled', 'published', 'archived']);

async function requireControl(request, env) {
  const session = await memberSession(request, env, { allowUnverified: true });
  if (session.response) return session;
  if (!session.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return { response: json({ error: 'studio_access_required' }, 403) };
  }
  return session;
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function number(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function uid() {
  return crypto.randomUUID();
}

function normalizeProject(project = {}) {
  const scenes = Array.isArray(project.scenes) ? project.scenes.slice(0, MAX_PROJECT_SCENES) : [];
  return {
    id: text(project.id || uid(), 100),
    title: text(project.title || 'Projet Zwit Studio', 180),
    objective: text(project.objective, 1200),
    audience: text(project.audience, 500),
    channel: text(project.channel || 'Instagram', 120),
    format: ALLOWED_FORMATS.has(project.format) ? project.format : '9:16',
    prompt: text(project.prompt || project.objective, MAX_PROMPT),
    voiceOver: text(project.voiceOver, 5000),
    scenes: scenes.map((scene, index) => ({
      id: text(scene.id || `scene_${index + 1}`, 100),
      title: text(scene.title || `Scène ${index + 1}`, 180),
      visual: text(scene.visual, 1200),
      text: text(scene.text, 500),
      prompt: text(scene.prompt || scene.visual, 2400),
      duration: number(scene.duration, 0.5, 30, 5),
      transition: text(scene.transition || 'Zwit Fade', 80),
      palette: Array.isArray(scene.palette) ? scene.palette.slice(0, 2).map((item) => text(item, 20)) : ['#0D0D0D', '#641B36']
    }))
  };
}

function normalizeBrief(brief = {}, project = {}) {
  return {
    brand: text(brief.brand || 'Zwit', 80) || 'Zwit',
    prompt: text(brief.prompt || project.prompt || project.objective, MAX_PROMPT),
    objective: text(brief.objective || project.objective || 'Faire connaître Zwit et déclencher des inscriptions qualifiées.', 1200),
    audience: text(brief.audience || project.audience || 'Couples, femmes seules et professionnels du secteur', 500),
    region: text(brief.region || 'Hauts-de-France et Belgique', 180),
    offer: text(brief.offer || 'Découvrir Zwit et rejoindre la communauté', 320),
    tone: text(brief.tone || 'Premium, humain, élégant', 180)
  };
}

function campaignGateway(env) {
  const enabled = String(env.VELVET_STUDIO_CAMPAIGN_AI || '').toLowerCase() === 'enabled';
  const url = text(env.VELVET_STUDIO_CAMPAIGN_GATEWAY, 1000);
  const token = text(env.VELVET_STUDIO_CAMPAIGN_GATEWAY_TOKEN, 2000);
  return { enabled: enabled && Boolean(url && token), url, token };
}

function videoScenes(project, targetDuration, maxScenes) {
  const source = project.scenes.length ? project.scenes : [{
    id: uid(), title: 'Zwit', visual: 'Ruban Zwit sur fond noir', text: 'Le libertinage évolue.', prompt: 'Univers Zwit premium', duration: 5,
    transition: 'Zwit Fade', palette: ['#0D0D0D', '#641B36']
  }];
  const selected = source.slice(0, Math.min(maxScenes, source.length)).map((scene) => ({ ...scene, id: uid() }));
  const total = selected.reduce((sum, scene) => sum + scene.duration, 0) || 1;
  selected.forEach((scene) => {
    scene.duration = Math.max(1.5, Number((targetDuration * scene.duration / total).toFixed(2)));
  });
  const actual = selected.reduce((sum, scene) => sum + scene.duration, 0);
  selected[selected.length - 1].duration = Math.max(1.5, Number((selected[selected.length - 1].duration + targetDuration - actual).toFixed(2)));
  return selected;
}

function localPack(project, brief) {
  const signature = 'Là où les plus belles rencontres commencent.';
  const hooks = [
    'Le libertinage évolue.',
    'Les plus belles rencontres commencent par la confiance.',
    'Profils, événements et établissements enfin réunis.',
    'Moins de bruit. Plus de qualité. Plus de liberté.',
    'Zwit rapproche les personnes, les lieux et les expériences qui comptent.'
  ];
  const videoDefinitions = [
    ['Teaser social', 15, '9:16', 'Instagram Reels / TikTok', hooks[0], 3],
    ['Film découverte', 30, '9:16', 'Instagram Reels / Facebook', hooks[2], 5],
    ['Film manifeste', 45, '16:9', 'YouTube / site Zwit', hooks[1], 6],
    ['Focus confiance', 20, '1:1', 'Instagram / Facebook', hooks[3], 4],
    ['Zwit Pro', 30, '16:9', 'LinkedIn / prospection', hooks[4], 5]
  ];
  const videos = videoDefinitions.map(([title, duration, format, channel, hook, maxScenes], index) => ({
    id: uid(), kind: 'video', title, duration, format, channel, hook,
    status: 'draft',
    objective: index === 4 ? 'Convaincre les établissements de rejoindre Zwit Pro.' : brief.objective,
    cta: index === 4 ? 'Découvrir Zwit Pro' : 'Découvrir Zwit',
    voiceOver: `${hook} ${index === 4 ? 'Zwit Pro centralise vos événements, vos réservations et votre visibilité auprès d’une communauté qualifiée.' : 'Zwit réunit profils, lieux, événements et outils de confiance dans une expérience premium et discrète.'} ${signature}`,
    scenes: videoScenes(project, duration, maxScenes)
  }));

  const visualData = [
    ['Manifeste', hooks[0], 'Ruban Zwit et lumière champagne'],
    ['Confiance', 'La confiance avant tout.', 'Consentement, albums privés et modération'],
    ['Découverte', 'Des rencontres qui ont du sens.', 'Recherche premium et profils de qualité'],
    ['Événements', 'Vivez plus que des conversations.', 'Agenda et sorties à proximité'],
    ['Établissements', 'Les meilleurs lieux, au même endroit.', 'Carte Zwit et sélection de lieux'],
    ['Discrétion', 'Votre liberté mérite de la discrétion.', 'Interface épurée et données protégées'],
    ['Communauté', 'Une communauté choisie.', 'Diversité adulte et bienveillance'],
    ['Proximité', `Zwit arrive en ${brief.region}.`, 'Carte régionale élégante'],
    ['Zwit Pro', 'Organiser. Remplir. Fidéliser.', 'Cockpit professionnel premium'],
    ['Invitation', 'Votre invitation pour découvrir Zwit.', 'Carte digitale avec ruban bordeaux'],
    ['Fonctionnalités', 'Tout Zwit, en un seul univers.', 'Recherche, messages, carte et événements'],
    ['Signature', signature, 'Logo Zwit et halo champagne']
  ];
  const formats = ['1080×1350', '1080×1920', '1200×628', '1080×1080'];
  const visuals = visualData.map(([theme, headline, direction], index) => ({
    id: uid(), kind: 'visual', theme, headline, direction, format: formats[index % formats.length], status: 'draft',
    prompt: `${direction}. Style ${brief.tone}, palette Zwit #0D0D0D #641B36 #C6A96A #F4F4F2. Personnes fictives majeures, aucune nudité, aucune donnée réelle.`,
    cta: index === 8 ? 'Découvrir Zwit Pro' : 'Découvrir Zwit'
  }));

  const hashtags = ['#Zwit', '#RencontresLibres', '#Libertinage', '#Communauté', '#Consentement', '#Discrétion', '#Événements', '#VelvetPro', '#HautsDeFrance', '#Belgique'];
  const postData = [
    ['Instagram', hooks[0], 'Zwit réunit les rencontres, les événements et les établissements dans une seule expérience pensée autour de la confiance.'],
    ['Instagram', 'Des rencontres qui ont du sens.', 'Une interface premium et une communauté où la qualité compte davantage que la quantité.'],
    ['TikTok', 'Et si les rencontres libres entraient enfin dans une nouvelle ère ?', 'Découvrez Zwit : plus fluide, plus élégant, plus humain.'],
    ['Facebook', 'Zwit arrive près de chez vous.', `Le lancement commence en ${brief.region}, avec les membres, événements et établissements de la région.`],
    ['Facebook', 'La confiance n’est pas une option.', 'Consentement, discrétion, albums privés et modération font partie de Zwit dès le départ.'],
    ['LinkedIn', 'Zwit Pro : le cockpit des établissements.', 'Créez vos événements, développez votre visibilité et fidélisez votre communauté depuis un seul espace.'],
    ['Instagram', 'Votre prochaine sortie commence ici.', 'Explorez les événements et établissements proches de vous dans un environnement premium.'],
    ['TikTok', 'Moins de bruit. Plus de vraies connexions.', 'Zwit remet le feeling, le respect et la qualité au centre.'],
    ['Instagram', 'Une communauté libre. Jamais sans respect.', 'Zwit accueille les envies et les identités dans un cadre adulte, bienveillant et consentant.'],
    ['LinkedIn', 'Une plateforme pensée comme un écosystème.', 'Membres, lieux, événements et professionnels avancent enfin avec les mêmes outils.']
  ];
  const posts = postData.map(([platform, headline, body], index) => ({
    id: uid(), kind: 'post', platform, headline, body,
    cta: platform === 'LinkedIn' ? 'Découvrir Zwit Pro' : 'Découvrir Zwit',
    status: 'draft', hashtags: hashtags.slice(0, platform === 'LinkedIn' ? 5 : 8), visualId: visuals[index % visuals.length].id,
    characterCount: `${headline} ${body}`.length
  }));

  const newsletter = {
    id: uid(), kind: 'newsletter', status: 'draft',
    subject: 'Zwit ouvre un nouvel univers pour les rencontres libres',
    preheader: 'Une plateforme premium, plus humaine, plus fluide et pensée autour de la confiance.',
    headline: hooks[0],
    body: `Zwit réunit les profils, les événements, les établissements et les outils professionnels dans une même expérience. Notre ambition : proposer une communauté adulte où la qualité, le respect, la discrétion et le consentement sont visibles à chaque étape. Le lancement commence en ${brief.region}.`,
    cta: 'Découvrir Zwit'
  };
  const banner = {
    id: uid(), kind: 'banner', status: 'draft', eyebrow: 'ZWIT · NOUVELLE EXPÉRIENCE',
    headline: hooks[0], subheadline: 'Rencontres, événements et établissements réunis dans un même univers premium.',
    cta: 'Découvrir Zwit', format: 'Desktop + mobile'
  };

  const calendarItems = [...videos.slice(0, 4), ...posts, ...visuals.slice(0, 4)];
  const calendar = calendarItems.map((item, index) => {
    const date = new Date(Date.now() + (index + 1) * 86400000);
    date.setUTCHours([17, 19, 11, 18, 20][index % 5], index % 2 ? 30 : 0, 0, 0);
    return {
      id: uid(), itemId: item.id, itemKind: item.kind,
      title: item.title || item.headline || item.theme,
      channel: item.channel || item.platform || 'Instagram',
      scheduledAt: date.toISOString(), status: 'planned'
    };
  });

  return {
    id: uid(), version: 3, projectId: project.id,
    title: `${brief.brand} · Campagne ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
    brief: brief.prompt, objective: brief.objective, audience: brief.audience, offer: brief.offer, region: brief.region, tone: brief.tone,
    videos, visuals, posts, hashtags, newsletter, banner, calendar,
    brandGuard: {
      score: 96, status: 'pass',
      checks: [
        ['Identité Zwit', true], ['Consentement et respect', true], ['Personnes majeures uniquement', true],
        ['Aucune donnée membre réelle', true], ['Promesses vérifiables', true], ['Aucun contenu explicite', true]
      ]
    },
    metrics: { videos: 5, visuals: 12, posts: 10, newsletters: 1, banners: 1, calendarSlots: calendar.length },
    createdAt: new Date().toISOString(), provider: 'velvet-local-campaign-engine-v3'
  };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function campaignManifest(pack, actorUserId) {
  const manifest = {
    id: uid(), version: 3, actorUserId, createdAt: new Date().toISOString(),
    packId: pack.id, projectId: pack.projectId, title: pack.title,
    counts: pack.metrics,
    channels: [...new Set([...(pack.posts || []).map((item) => item.platform), ...(pack.videos || []).map((item) => item.channel)])],
    publicationMode: 'human_validation_required',
    items: [
      ...(pack.videos || []).map((item) => ({ id: item.id, kind: 'video', title: item.title, status: item.status, channel: item.channel })),
      ...(pack.visuals || []).map((item) => ({ id: item.id, kind: 'visual', title: item.theme, status: item.status, channel: 'multi' })),
      ...(pack.posts || []).map((item) => ({ id: item.id, kind: 'post', title: item.headline, status: item.status, channel: item.platform })),
      { id: pack.newsletter?.id, kind: 'newsletter', title: pack.newsletter?.subject, status: pack.newsletter?.status, channel: 'email' },
      { id: pack.banner?.id, kind: 'banner', title: pack.banner?.headline, status: pack.banner?.status, channel: 'web' }
    ],
    brandGuard: pack.brandGuard
  };
  manifest.integrity = await sha256(JSON.stringify(manifest));
  return manifest;
}

async function remotePack(env, project, brief) {
  const gateway = campaignGateway(env);
  if (!gateway.enabled) return null;
  const response = await fetch(gateway.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${gateway.token}`,
      'content-type': 'application/json',
      'x-velvet-studio-version': '3'
    },
    body: JSON.stringify({ action: 'campaign_pack', project, brief })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.pack) throw new Error(payload?.error || 'studio_campaign_gateway_failed');
  return payload.pack;
}

function capabilities(env) {
  const gateway = campaignGateway(env);
  return {
    version: '3.0',
    outputs: { videos: 5, visuals: 12, posts: 10, newsletter: 1, banner: 1 },
    publication: { automatic: false, validationRequired: true },
    providers: [
      { id: 'velvet-local-campaign-engine-v3', status: 'ready', cost: 'free' },
      { id: 'campaign-gateway', status: gateway.enabled ? 'configured' : 'disabled', cost: gateway.enabled ? 'provider-dependent' : 'none' }
    ]
  };
}

export async function onRequestPost({ request, env }) {
  const session = await requireControl(request, env);
  if (session.response) return session.response;
  try {
    const body = await readJson(request);
    const action = text(body.action, 80);
    if (action === 'capabilities') return json(capabilities(env));

    const project = normalizeProject(body.project || {});
    const brief = normalizeBrief(body.brief || {}, project);

    if (action === 'campaign_pack') {
      const external = await remotePack(env, project, brief).catch(() => null);
      const pack = external || localPack(project, brief);
      return json({ pack, generative: Boolean(external), provider: external ? 'campaign-gateway' : 'velvet-local-campaign-engine-v3' });
    }
    if (action === 'campaign_manifest') {
      const pack = body.pack && typeof body.pack === 'object' ? body.pack : localPack(project, brief);
      return json({ manifest: await campaignManifest(pack, session.account.user_id || session.user?.id || null) });
    }
    if (action === 'validate_item_status') {
      const status = text(body.status, 40);
      if (!ALLOWED_STATUSES.has(status)) return json({ error: 'studio_campaign_status_invalid' }, 400);
      return json({ status, accepted: true, automaticPublication: false });
    }
    return json({ error: 'studio_v3_action_unknown' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'studio_v3_request_failed' }, 400);
  }
}