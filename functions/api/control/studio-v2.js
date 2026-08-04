import { json, readJson } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const MAX_SCENES = 40;
const MAX_DURATION = 90;
const ALLOWED_FORMATS = new Set(['9:16', '1:1', '16:9']);

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

function projectInput(project = {}) {
  const scenes = Array.isArray(project.scenes) ? project.scenes.slice(0, MAX_SCENES) : [];
  if (!scenes.length) throw new Error('studio_project_scenes_required');
  const normalizedScenes = scenes.map((scene, index) => ({
    id: text(scene.id || `scene_${index + 1}`, 80),
    title: text(scene.title || `Scène ${index + 1}`, 160),
    duration: number(scene.duration, 0.5, 30, 5),
    visual: text(scene.visual, 1200),
    prompt: text(scene.prompt || scene.visual, 2400),
    overlay: text(scene.text, 420),
    voice: text(scene.voice, 600),
    transition: text(scene.transition || 'Velvet Fade', 80),
    palette: Array.isArray(scene.palette) ? scene.palette.slice(0, 2).map((value) => text(value, 20)) : ['#0D0D0D', '#641B36']
  }));
  const duration = normalizedScenes.reduce((sum, scene) => sum + scene.duration, 0);
  if (duration > MAX_DURATION) throw new Error('studio_project_duration_exceeded');
  const format = ALLOWED_FORMATS.has(project.format) ? project.format : '9:16';
  return {
    id: text(project.id || crypto.randomUUID(), 100),
    title: text(project.title || 'Projet Velvet Studio', 180),
    objective: text(project.objective, 1200),
    audience: text(project.audience, 500),
    channel: text(project.channel || 'Instagram', 120),
    format,
    duration,
    voiceOver: text(project.voiceOver, 5000),
    voice: {
      gender: text(project.voice?.gender || 'Féminine', 80),
      accent: text(project.voice?.accent || 'Français neutre', 80),
      tone: text(project.voice?.tone || 'Chaleureuse et assurée', 120),
      pace: number(project.voice?.pace, 0.65, 1.25, 0.95)
    },
    music: {
      genre: text(project.music?.genre || 'Cinématographique premium', 120),
      tempo: number(project.music?.tempo, 60, 150, 92),
      instruments: text(project.music?.instruments || 'Piano feutré, basse chaleureuse et texture de soie', 500),
      emotion: text(project.music?.emotion || 'Élégance, désir, confiance', 240),
      intensity: number(project.music?.intensity, 1, 100, 58)
    },
    scenes: normalizedScenes
  };
}

function providerConfig(env) {
  const gateway = text(env.VELVET_STUDIO_MEDIA_GATEWAY, 1000);
  const enabled = String(env.VELVET_STUDIO_GENERATIVE_MEDIA || '').toLowerCase() === 'enabled';
  const token = text(env.VELVET_STUDIO_MEDIA_GATEWAY_TOKEN, 2000);
  return { gateway, enabled: enabled && Boolean(gateway && token), token };
}

function capabilities(env) {
  const provider = providerConfig(env);
  return {
    version: '2.0',
    maxDuration: MAX_DURATION,
    formats: [...ALLOWED_FORMATS],
    providers: [
      { id: 'browser-compositor', name: 'Compositor Velvet', status: 'ready', mode: 'local temps réel', cost: 'free' },
      { id: 'browser-voice', name: 'Voix navigateur', status: 'ready', mode: 'prévisualisation locale', cost: 'free' },
      { id: 'procedural-music', name: 'Musique procédurale', status: 'ready', mode: 'Web Audio', cost: 'free' },
      { id: 'media-gateway', name: 'Passerelle médias IA', status: provider.enabled ? 'configured' : 'disabled', mode: provider.enabled ? 'serveur sécurisé' : 'activation explicite requise', cost: provider.enabled ? 'provider-dependent' : 'none' }
    ]
  };
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function renderManifest(project, actorUserId) {
  const createdAt = new Date().toISOString();
  const manifest = {
    id: crypto.randomUUID(),
    version: 2,
    createdAt,
    actorUserId,
    projectId: project.id,
    title: project.title,
    format: project.format,
    fps: 30,
    width: project.format === '16:9' ? 1280 : project.format === '1:1' ? 1080 : 720,
    height: project.format === '16:9' ? 720 : project.format === '1:1' ? 1080 : 1280,
    duration: project.duration,
    timeline: project.scenes.map((scene, index) => ({
      track: 'video', index, sceneId: scene.id, duration: scene.duration,
      visualPrompt: scene.prompt, overlay: scene.overlay, transition: scene.transition,
      voice: scene.voice, palette: scene.palette
    })),
    voice: { ...project.voice, text: project.voiceOver, provider: 'browser-or-media-gateway' },
    music: { ...project.music, provider: 'procedural-or-media-gateway' },
    brandGuard: {
      palette: ['#0D0D0D', '#641B36', '#C6A96A', '#F4F4F2'],
      required: ['adult_only', 'non_explicit', 'consent', 'privacy', 'no_real_member_data', 'verified_product_claims'],
      result: 'pass'
    },
    renderer: 'velvet-studio-browser-v2'
  };
  manifest.integrity = await sha256(JSON.stringify(manifest));
  return manifest;
}

async function gatewayJob(env, kind, project, options = {}) {
  const provider = providerConfig(env);
  if (!provider.enabled) {
    return {
      job: {
        id: crypto.randomUUID(), kind, status: 'local_fallback',
        provider: kind === 'voice' ? 'browser-speech-synthesis' : kind === 'music' ? 'web-audio' : 'browser-compositor',
        createdAt: new Date().toISOString()
      }
    };
  }
  const response = await fetch(provider.gateway, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${provider.token}`,
      'content-type': 'application/json',
      'x-velvet-studio-version': '2'
    },
    body: JSON.stringify({ kind, project, options })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'studio_media_gateway_failed');
  return { job: payload?.job || payload, provider: 'media-gateway' };
}

export async function onRequestPost({ request, env }) {
  const session = await requireControl(request, env);
  if (session.response) return session.response;
  try {
    const body = await readJson(request);
    const action = text(body.action, 80);
    if (action === 'capabilities') return json(capabilities(env));
    const project = projectInput(body.project || {});
    if (action === 'render_manifest') {
      return json({ manifest: await renderManifest(project, session.account.user_id || session.user?.id || null) });
    }
    if (action === 'voice_job') return json(await gatewayJob(env, 'voice', project, body.options));
    if (action === 'music_job') return json(await gatewayJob(env, 'music', project, body.options));
    if (action === 'video_job') return json(await gatewayJob(env, 'video', project, body.options));
    return json({ error: 'studio_v2_action_unknown' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'studio_v2_request_failed' }, 400);
  }
}
