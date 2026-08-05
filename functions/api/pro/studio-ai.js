import { json, readJson, supabase } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from '../members/_shared.js';

const PRO_ROLES = new Set(['pro_owner', 'pro_staff', 'admin', 'direction']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const DIRECTION_MODEL = '@cf/zai-org/glm-4.7-flash';
const BUCKET = 'velvet-pro-studio';
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const ASSET_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['video/webm', 'webm'],
  ['video/mp4', 'mp4']
]);
const ASSET_KINDS = new Set([
  'logo', 'secondary_logo', 'event_photo', 'guest_photo', 'dj_photo',
  'theme_reference', 'generated_background', 'render', 'video'
]);
const FORMATS = new Set(['9:16', '4:5', '1:1', '16:9', 'a4']);

async function proAccess(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return access;
  if (!access.account.roles.some((role) => PRO_ROLES.has(role))) {
    return { response: json({ error: 'pro_access_required' }, 403) };
  }
  return access;
}

function isAdmin(access) {
  return access.account.roles.some((role) => role === 'admin' || role === 'direction');
}

async function allowedVenue(env, access, venueId) {
  if (!UUID.test(String(venueId || ''))) return null;
  const staffFilter = isAdmin(access)
    ? ''
    : `&establishment_staff.user_id=eq.${encodeURIComponent(access.account.userId)}&establishment_staff.status=eq.active`;
  const rows = await restJson(
    env,
    `/rest/v1/establishments?select=id,name,kind,city,address_public,phone_public,email_public,amenities,opening_hours,subscription_status,establishment_staff(user_id,staff_role,status)&id=eq.${encodeURIComponent(venueId)}${staffFilter}&limit=1`,
    access.session
  );
  const venue = rows?.[0] || null;
  if (!venue) return null;
  if (!['trial', 'active'].includes(venue.subscription_status) && !isAdmin(access)) return null;
  return venue;
}

function storageUrl(env, signedPath) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (/^https?:\/\//i.test(signedPath || '')) return signedPath;
  return new URL(String(signedPath || '').replace(/^\/+/, ''), `${base}/storage/v1/`).toString();
}

async function signedStudioUrl(env, session, path, expiresIn = 1800) {
  if (!path) return null;
  const response = await supabase(env, `/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn: Math.max(60, Math.min(3600, expiresIn)) })
  }, session.access_token);
  const payload = await response.json().catch(() => ({}));
  return response.ok && payload.signedURL ? storageUrl(env, payload.signedURL) : null;
}

async function signedRows(env, session, rows = []) {
  return Promise.all(rows.map(async (row) => ({
    ...row,
    previewUrl: await signedStudioUrl(env, session, row.storage_path)
  })));
}

function migrationMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('pro_studio_') && (
    message.includes('does not exist') || message.includes('relation') || message.includes('schema cache')
  );
}

async function snapshot(env, access, venueId) {
  try {
    const [brandKits, projects, assets, renders, templates] = await Promise.all([
      restJson(env, `/rest/v1/pro_studio_brand_kits?select=*&establishment_id=eq.${encodeURIComponent(venueId)}&limit=1`, access.session),
      restJson(env, `/rest/v1/pro_studio_projects?select=*&establishment_id=eq.${encodeURIComponent(venueId)}&order=updated_at.desc&limit=100`, access.session),
      restJson(env, `/rest/v1/pro_studio_assets?select=*&establishment_id=eq.${encodeURIComponent(venueId)}&order=created_at.desc&limit=200`, access.session),
      restJson(env, `/rest/v1/pro_studio_renders?select=*&establishment_id=eq.${encodeURIComponent(venueId)}&order=created_at.desc&limit=200`, access.session),
      restJson(env, `/rest/v1/pro_studio_templates?select=*&or=(is_system.eq.true,establishment_id.eq.${encodeURIComponent(venueId)})&order=is_system.desc,name.asc`, access.session)
    ]);
    const enrichedAssets = await signedRows(env, access.session, assets);
    const enrichedRenders = await signedRows(env, access.session, renders);
    const brand = brandKits[0] || null;
    if (brand?.logo_storage_path) brand.logoUrl = await signedStudioUrl(env, access.session, brand.logo_storage_path);
    if (brand?.secondary_logo_storage_path) brand.secondaryLogoUrl = await signedStudioUrl(env, access.session, brand.secondary_logo_storage_path);
    return {
      migrationPending: false,
      brand,
      projects,
      assets: enrichedAssets,
      renders: enrichedRenders,
      templates
    };
  } catch (error) {
    if (!migrationMissing(error)) throw error;
    return {
      migrationPending: true,
      brand: null,
      projects: [],
      assets: [],
      renders: [],
      templates: []
    };
  }
}

function safeJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function color(value, fallback) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value || '')) ? String(value) : fallback;
}

function brandPayload(body, access) {
  const source = body.brand || {};
  return {
    establishment_id: body.venueId,
    logo_storage_path: cleanText(source.logo_storage_path, 600) || null,
    secondary_logo_storage_path: cleanText(source.secondary_logo_storage_path, 600) || null,
    primary_color: color(source.primary_color, '#7D294C'),
    secondary_color: color(source.secondary_color, '#0D0D0D'),
    accent_color: color(source.accent_color, '#D5B477'),
    background_color: color(source.background_color, '#09090B'),
    typography_style: cleanText(source.typography_style, 80) || 'editorial-premium',
    visual_style: cleanText(source.visual_style, 80) || 'premium-club',
    density: ['minimal', 'balanced', 'rich', 'event'].includes(source.density) ? source.density : 'balanced',
    brand_prompt: cleanText(source.brand_prompt, 1800),
    fixed_information: safeJson(source.fixed_information, {}),
    recurring_features: safeJson(source.recurring_features, []),
    locked_rules: safeJson(source.locked_rules, {}),
    updated_by: access.account.userId
  };
}

function projectPayload(body, access) {
  const source = body.project || {};
  return {
    id: UUID.test(String(source.id || '')) ? source.id : crypto.randomUUID(),
    establishment_id: body.venueId,
    source_project_id: UUID.test(String(source.source_project_id || '')) ? source.source_project_id : null,
    event_id: UUID.test(String(source.event_id || '')) ? source.event_id : null,
    title: cleanText(source.title, 180) || 'Nouvelle affiche',
    status: ['draft', 'generating', 'ready', 'published', 'archived'].includes(source.status) ? source.status : 'draft',
    theme: cleanText(source.theme, 240),
    output_type: ['poster', 'social_kit', 'animated_poster', 'video_teaser'].includes(source.output_type) ? source.output_type : 'poster',
    event_payload: safeJson(source.event_payload, {}),
    creative_payload: safeJson(source.creative_payload, {}),
    prompt_snapshot: cleanText(source.prompt_snapshot, 4000),
    created_by: access.account.userId,
    updated_by: access.account.userId
  };
}

function parseAiObject(value) {
  const raw = String(value?.response || value?.answer || value?.result || value || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('poster_direction_invalid');
  return JSON.parse(match[0]);
}

function posterDirectionPrompt({ venue, brand, event, creative, format }) {
  return `Tu es directeur artistique senior spécialisé dans les affiches de clubs privés et d'événements nocturnes premium en France et en Belgique.
Établissement : ${venue.name}, ${venue.kind || 'club privé'}, ${venue.city || ''}.
Identité permanente : ${brand?.brand_prompt || 'élégante, premium, nocturne'}.
Couleurs : principale ${brand?.primary_color || '#7D294C'}, secondaire ${brand?.secondary_color || '#0D0D0D'}, accent ${brand?.accent_color || '#D5B477'}.
Style demandé : ${creative?.style || brand?.visual_style || 'premium-club'}.
Thème : ${event?.theme || event?.title || 'soirée Velvet'}.
Ambiance : ${event?.description || creative?.brief || ''}.
Format : ${format || '4:5'}.
Photos fournies : elles seront composées ensuite sans modification par Velvet. Ne demande jamais de recréer les personnes.
Les textes, dates, tarifs, logo et informations pratiques seront ajoutés séparément en haute définition. Le fond généré ne doit donc contenir AUCUN texte, AUCUNE lettre, AUCUN chiffre et AUCUN logo.
Réponds uniquement en JSON :
{"artDirection":"description visuelle précise","backgroundPrompt":"prompt anglais photoréaliste de moins de 1500 caractères, sans texte ni logo","layout":"minimal|balanced|rich|event","contrast":"description","photoTreatment":"description du placement des photos fournies","effects":["effet 1","effet 2"],"warnings":[]}`;
}

function fallbackDirection({ venue, brand, event, creative }) {
  const style = creative?.style || brand?.visual_style || 'premium nightlife';
  const theme = event?.theme || event?.title || 'exclusive club night';
  return {
    artDirection: `Affiche ${style}, immersive, contrastée et très lisible pour ${venue.name}.`,
    backgroundPrompt: `Premium French private club event poster background, ${theme}, ${style}, cinematic nightlife, sophisticated adults atmosphere without identifiable people, deep black, burgundy and champagne accents, luminous details, high-end editorial composition, clean central negative space for later typography, no text, no letters, no numbers, no logo, no watermark, no explicit content`,
    layout: brand?.density || 'balanced',
    contrast: 'Contraste élevé avec zones sombres réservées aux textes exacts.',
    photoTreatment: 'Photos fournies détourées ou cadrées au centre, sans altération des visages.',
    effects: ['cinematic glow', 'premium nightlife particles'],
    warnings: []
  };
}

async function planDirection(env, payload) {
  if (!env.AI || typeof env.AI.run !== 'function') return fallbackDirection(payload);
  try {
    const result = await env.AI.run(DIRECTION_MODEL, {
      messages: [
        { role: 'system', content: 'Réponds uniquement avec un objet JSON valide, en français.' },
        { role: 'user', content: posterDirectionPrompt(payload) }
      ],
      temperature: 0.45,
      max_tokens: 700
    });
    const parsed = parseAiObject(result);
    return {
      ...fallbackDirection(payload),
      ...parsed,
      backgroundPrompt: cleanText(parsed.backgroundPrompt, 1800)
    };
  } catch {
    return fallbackDirection(payload);
  }
}

async function generateBackground(env, direction) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new Error('workers_ai_binding_missing');
  const prompt = `${cleanText(direction.backgroundPrompt, 1800)}. Strictly no text, no typography, no letters, no numbers, no logo, no watermark.`.slice(0, 2048);
  const result = await env.AI.run(IMAGE_MODEL, { prompt, steps: 4 });
  if (!result?.image) throw new Error('workers_ai_image_missing');
  return { image: result.image, prompt, model: IMAGE_MODEL };
}

async function uploadFile({ request, env, access, venue }) {
  const form = await request.formData();
  const file = form.get('file');
  const kind = String(form.get('assetKind') || 'event_photo');
  const projectId = String(form.get('projectId') || '');
  if (!(file instanceof File) || !ASSET_KINDS.has(kind)) throw new Error('studio_asset_required');
  const extension = ASSET_TYPES.get(file.type);
  if (!extension || file.size < 100 || file.size > MAX_ASSET_BYTES) throw new Error('studio_asset_invalid');
  const finalProjectId = UUID.test(projectId) ? projectId : null;
  const path = `${venue.id}/${finalProjectId || 'brand'}/${kind}/${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = await supabase(env, `/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'content-type': file.type, 'x-upsert': 'false' },
    body: bytes
  }, access.session.access_token);
  if (!upload.ok) throw new Error('studio_asset_storage_failed');
  const created = await restJson(env, '/rest/v1/pro_studio_assets?select=*', access.session, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      establishment_id: venue.id,
      project_id: finalProjectId,
      asset_kind: kind,
      storage_path: path,
      mime_type: file.type,
      byte_size: file.size,
      metadata: safeJson(form.get('metadata'), {}),
      created_by: access.account.userId
    })
  });
  const asset = created?.[0];
  if (kind === 'logo' || kind === 'secondary_logo') {
    const patch = kind === 'logo' ? { logo_storage_path: path } : { secondary_logo_storage_path: path };
    await restJson(env, '/rest/v1/pro_studio_brand_kits?on_conflict=establishment_id', access.session, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ establishment_id: venue.id, ...patch, updated_by: access.account.userId })
    });
  }
  return { asset: { ...asset, previewUrl: await signedStudioUrl(env, access.session, path) } };
}

async function saveRender({ request, env, access, venue }) {
  const form = await request.formData();
  const file = form.get('file');
  const projectId = String(form.get('projectId') || '');
  const renderType = String(form.get('renderType') || 'image');
  const format = String(form.get('format') || '4:5');
  const variant = Math.max(1, Math.min(12, Number(form.get('variantIndex') || 1)));
  if (!(file instanceof File) || !UUID.test(projectId) || !['image', 'animated', 'video'].includes(renderType) || !FORMATS.has(format)) {
    throw new Error('studio_render_invalid');
  }
  const extension = ASSET_TYPES.get(file.type);
  if (!extension || file.size > MAX_ASSET_BYTES) throw new Error('studio_render_file_invalid');
  const path = `${venue.id}/${projectId}/renders/${renderType}-${format.replace(':', 'x')}-${variant}-${crypto.randomUUID()}.${extension}`;
  const upload = await supabase(env, `/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'content-type': file.type, 'x-upsert': 'false' },
    body: new Uint8Array(await file.arrayBuffer())
  }, access.session.access_token);
  if (!upload.ok) throw new Error('studio_render_storage_failed');
  const created = await restJson(env, '/rest/v1/pro_studio_renders?select=*', access.session, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      project_id: projectId,
      establishment_id: venue.id,
      render_type: renderType,
      format,
      variant_index: variant,
      storage_path: path,
      mime_type: file.type,
      composition: safeJson(form.get('composition'), {}),
      status: 'ready',
      created_by: access.account.userId
    })
  });
  await restJson(env, `/rest/v1/pro_studio_projects?id=eq.${encodeURIComponent(projectId)}`, access.session, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'ready', updated_by: access.account.userId })
  });
  const render = created?.[0];
  return { render: { ...render, previewUrl: await signedStudioUrl(env, access.session, path) } };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await proAccess(request, env);
    if (access.response) return access.response;
    const venueId = new URL(request.url).searchParams.get('venueId');
    const venue = await allowedVenue(env, access, venueId);
    if (!venue) return withSession({ error: 'pro_studio_venue_required' }, access.session, 403);
    return withSession({
      venue,
      capabilities: { workersAI: Boolean(env.AI), v1: true, v2: true, v3: true },
      ...(await snapshot(env, access, venue.id))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'pro_studio_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await proAccess(request, env);
    if (access.response) return access.response;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const probe = await request.clone().formData();
      const venueId = String(probe.get('venueId') || '');
      const action = String(probe.get('action') || 'upload_asset');
      const venue = await allowedVenue(env, access, venueId);
      if (!venue) return withSession({ error: 'pro_studio_venue_required' }, access.session, 403);
      const result = action === 'save_render'
        ? await saveRender({ request, env, access, venue })
        : await uploadFile({ request, env, access, venue });
      return withSession({ ok: true, ...result }, access.session);
    }

    const body = await readJson(request);
    const action = cleanText(body.action, 50);
    const venue = await allowedVenue(env, access, body.venueId);
    if (!venue) return withSession({ error: 'pro_studio_venue_required' }, access.session, 403);

    if (action === 'capabilities') {
      return withSession({
        ok: true,
        venue,
        capabilities: { workersAI: Boolean(env.AI), imageModel: IMAGE_MODEL, directionModel: DIRECTION_MODEL, v1: true, v2: true, v3: true },
        ...(await snapshot(env, access, venue.id))
      }, access.session);
    }

    if (action === 'save_brand_kit') {
      await restJson(env, '/rest/v1/pro_studio_brand_kits?on_conflict=establishment_id', access.session, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(brandPayload(body, access))
      });
    } else if (action === 'save_project') {
      const project = projectPayload(body, access);
      await restJson(env, '/rest/v1/pro_studio_projects?on_conflict=id', access.session, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(project)
      });
      return withSession({ ok: true, projectId: project.id, ...(await snapshot(env, access, venue.id)) }, access.session);
    } else if (action === 'delete_project') {
      if (!UUID.test(String(body.projectId || ''))) return withSession({ error: 'studio_project_invalid' }, access.session, 400);
      await restJson(env, `/rest/v1/pro_studio_projects?id=eq.${encodeURIComponent(body.projectId)}&establishment_id=eq.${encodeURIComponent(venue.id)}`, access.session, {
        method: 'DELETE', headers: { Prefer: 'return=minimal' }
      });
    } else if (action === 'plan_poster') {
      const direction = await planDirection(env, {
        venue,
        brand: body.brand || {},
        event: body.event || {},
        creative: body.creative || {},
        format: body.format || '4:5'
      });
      return withSession({ ok: true, direction }, access.session);
    } else if (action === 'generate_background') {
      const direction = body.direction?.backgroundPrompt
        ? body.direction
        : await planDirection(env, {
          venue,
          brand: body.brand || {},
          event: body.event || {},
          creative: body.creative || {},
          format: body.format || '4:5'
        });
      return withSession({ ok: true, direction, ...(await generateBackground(env, direction)) }, access.session);
    } else {
      return withSession({ error: 'invalid_pro_studio_action' }, access.session, 400);
    }

    return withSession({ ok: true, ...(await snapshot(env, access, venue.id)) }, access.session);
  } catch (error) {
    return json({ error: error.message || 'pro_studio_write_failed' }, 400);
  }
}
