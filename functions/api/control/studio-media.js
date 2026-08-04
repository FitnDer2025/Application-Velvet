import { json, readJson } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const ALLOWED_FORMATS = new Set(['9:16', '1:1', '16:9', '4:5']);
const ALLOWED_PRESETS = new Set(['rencontre-premium', 'soiree-chic', 'lifestyle-urbain', 'velvet-pro']);
const ALLOWED_SCENARIOS = new Set(['profil', 'recherche', 'message', 'evenement']);

const MOCK_PROFILES = {
  couple_lille: {
    label: 'Élise & Marc',
    description: 'fictional French couple aged 36 and 39, elegant, natural, warm and genuinely connected'
  },
  couple_bruxelles: {
    label: 'Claire & Julien',
    description: 'fictional Belgian couple aged 34 and 38, sophisticated, relaxed and affectionate'
  },
  femme_lille: {
    label: 'Sofia',
    description: 'fictional French woman aged 35, confident, elegant, natural and approachable'
  },
  couple_mixte: {
    label: 'Maya & Thomas',
    description: 'fictional mixed-race European couple aged 37 and 40, refined, joyful and authentic'
  }
};

async function requireControl(request, env) {
  const session = await memberSession(request, env, { allowUnverified: true });
  if (session.response) return session;
  if (!session.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return { response: json({ error: 'studio_access_required' }, 403) };
  }
  return session;
}

function text(value, max = 1200) {
  return String(value ?? '').trim().slice(0, max);
}

function integer(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function presetDirection(preset) {
  if (preset === 'soiree-chic') {
    return 'upmarket evening atmosphere, elegant restaurant or private lounge, cinematic warm light, subtle mystery, premium editorial advertising';
  }
  if (preset === 'lifestyle-urbain') {
    return 'contemporary French urban lifestyle, stylish terrace or refined city street at golden hour, spontaneous authentic connection, premium dating campaign';
  }
  if (preset === 'velvet-pro') {
    return 'premium hospitality and nightlife business campaign, elegant venue owner welcoming adult guests, refined event atmosphere, polished commercial photography';
  }
  return 'premium French dating campaign, sincere eye contact, warm natural expressions, sophisticated but accessible lifestyle, emotional and reassuring advertising';
}

function scenarioDirection(scenario) {
  if (scenario === 'recherche') return 'leave clean negative space for a premium mobile search interface overlay';
  if (scenario === 'message') return 'leave clean negative space for a tasteful private message notification overlay';
  if (scenario === 'evenement') return 'suggest anticipation before an elegant adult social event and leave space for an event card overlay';
  return 'leave clean negative space for a premium fictional member profile card overlay';
}

function formatDirection(format) {
  if (format === '9:16') return 'vertical social media composition, subject framed for a 9:16 crop';
  if (format === '16:9') return 'wide cinematic composition, subject framed for a 16:9 crop';
  if (format === '4:5') return 'portrait social media composition, subject framed for a 4:5 crop';
  return 'balanced square social media composition, subject framed for a 1:1 crop';
}

function buildPrompt(body) {
  const userPrompt = text(body.prompt, 900);
  const preset = ALLOWED_PRESETS.has(body.preset) ? body.preset : 'rencontre-premium';
  const format = ALLOWED_FORMATS.has(body.format) ? body.format : '9:16';
  const scenario = ALLOWED_SCENARIOS.has(body.scenario) ? body.scenario : 'profil';
  const profile = MOCK_PROFILES[body.mockProfile] || MOCK_PROFILES.couple_lille;

  return [
    'High-end photorealistic French advertising photograph for Velvet, a premium adult dating and social experience platform.',
    profile.description + '.',
    presetDirection(preset) + '.',
    scenarioDirection(scenario) + '.',
    formatDirection(format) + '.',
    userPrompt ? `Creative brief: ${userPrompt}.` : '',
    'Realistic skin texture, natural hands, credible anatomy, authentic expressions, cinematic depth of field, contemporary European styling, warm champagne highlights, discreet burgundy accents.',
    'All people are fictional adults over 30. No nudity, no lingerie focus, no explicit sexual content, no fetish content, no minors, no real person, no celebrity, no text, no logo, no watermark, no distorted faces or extra fingers.'
  ].filter(Boolean).join(' ').slice(0, 2048);
}

function capabilities(env) {
  return {
    version: '3.1',
    binding: Boolean(env.AI && typeof env.AI.run === 'function'),
    model: IMAGE_MODEL,
    mode: 'workers-ai-direct',
    formats: [...ALLOWED_FORMATS],
    presets: [...ALLOWED_PRESETS],
    scenarios: [...ALLOWED_SCENARIOS],
    mockProfiles: Object.entries(MOCK_PROFILES).map(([id, profile]) => ({ id, label: profile.label }))
  };
}

export async function onRequestPost({ request, env }) {
  const session = await requireControl(request, env);
  if (session.response) return session.response;

  try {
    const body = await readJson(request);
    const action = text(body.action, 60);

    if (action === 'capabilities') return json(capabilities(env));
    if (action !== 'generate_image') return json({ error: 'studio_media_action_unknown' }, 400);
    if (!env.AI || typeof env.AI.run !== 'function') return json({ error: 'workers_ai_binding_missing' }, 503);

    const prompt = buildPrompt(body);
    const seed = integer(body.seed, 1, 2_147_483_647, Math.floor(Math.random() * 2_147_483_646) + 1);
    const steps = integer(body.steps, 4, 8, 8);
    const response = await env.AI.run(IMAGE_MODEL, { prompt, seed, steps });
    if (!response?.image) return json({ error: 'workers_ai_image_missing' }, 502);

    const format = ALLOWED_FORMATS.has(body.format) ? body.format : '9:16';
    const scenario = ALLOWED_SCENARIOS.has(body.scenario) ? body.scenario : 'profil';
    const profile = MOCK_PROFILES[body.mockProfile] || MOCK_PROFILES.couple_lille;

    return json({
      media: {
        id: crypto.randomUUID(),
        kind: 'image',
        format,
        scenario,
        mockProfile: text(body.mockProfile || 'couple_lille', 80),
        mockProfileLabel: profile.label,
        model: IMAGE_MODEL,
        seed,
        steps,
        prompt,
        dataUri: `data:image/jpeg;base64,${response.image}`,
        createdAt: new Date().toISOString(),
        studioOnly: true,
        fictionalAdultsOnly: true
      }
    });
  } catch (error) {
    return json({ error: error?.message || 'studio_media_generation_failed' }, 400);
  }
}
