import { json, readJson } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const VOICE_MODEL = '@cf/myshell-ai/melotts';
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

function fallbackPlan(brief, duration, format) {
  const sceneDuration = Math.max(3, Math.floor((duration - 3) / 3));
  return {
    title: 'Vidéo Velvet',
    format,
    duration,
    voiceOver: `Les plus belles rencontres commencent par une envie simple : découvrir, échanger et vivre une expérience en confiance. Velvet réunit les personnes, les lieux et les événements dans un univers élégant, discret et pensé pour vous. Velvet. Là où les plus belles rencontres commencent.`,
    scenes: [
      {
        title: 'La connexion',
        duration: sceneDuration,
        onScreen: 'Des rencontres qui ont du sens.',
        voice: 'Les plus belles rencontres commencent par une envie simple : découvrir et échanger.',
        scenario: 'profil',
        prompt: `${brief}. Un couple adulte fictif, naturel et complice, échange un regard sincère dans un lieu élégant en début de soirée.`
      },
      {
        title: 'L’expérience Velvet',
        duration: sceneDuration,
        onScreen: 'Profils. Messages. Événements.',
        voice: 'Velvet réunit les personnes, les lieux et les événements dans une expérience fluide et rassurante.',
        scenario: 'recherche',
        prompt: `${brief}. Adultes fictifs découvrant une application premium de rencontres, ambiance chaleureuse, téléphone visible sans texte lisible.`
      },
      {
        title: 'La confiance',
        duration: sceneDuration,
        onScreen: 'Confiance. Discrétion. Consentement.',
        voice: 'Un univers élégant, discret et pensé autour de la confiance et du consentement.',
        scenario: 'message',
        prompt: `${brief}. Couple adulte fictif dans une atmosphère premium et sereine, lumière champagne, sentiment de confiance.`
      },
      {
        title: 'Signature',
        duration: Math.max(3, duration - sceneDuration * 3),
        onScreen: 'Velvet. Là où les plus belles rencontres commencent.',
        voice: 'Velvet. Là où les plus belles rencontres commencent.',
        scenario: 'evenement',
        prompt: `${brief}. Ambiance de soirée élégante, lumière bordeaux et champagne, espace négatif pour une signature de marque.`
      }
    ]
  };
}

function extractModelText(result) {
  if (typeof result === 'string') return result;
  return result?.response
    || result?.result?.response
    || result?.choices?.[0]?.message?.content
    || result?.choices?.[0]?.text
    || '';
}

function parsePlan(raw, brief, duration, format) {
  const fallback = fallbackPlan(brief, duration, format);
  const source = text(raw, 10000);
  const match = source.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]);
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, 4).map((scene, index) => ({
      title: text(scene.title || `Scène ${index + 1}`, 100),
      duration: integer(scene.duration, 3, 12, Math.max(3, Math.floor(duration / 4))),
      onScreen: text(scene.onScreen || scene.text || '', 140),
      voice: text(scene.voice || '', 420),
      scenario: ALLOWED_SCENARIOS.has(scene.scenario) ? scene.scenario : ['profil', 'recherche', 'message', 'evenement'][index % 4],
      prompt: text(scene.prompt || brief, 900)
    })) : [];
    if (scenes.length < 3) return fallback;
    return {
      title: text(parsed.title || fallback.title, 120),
      format,
      duration,
      voiceOver: text(parsed.voiceOver || scenes.map((scene) => scene.voice).join(' '), 1800),
      scenes
    };
  } catch {
    return fallback;
  }
}

async function generatePlan(env, body) {
  const brief = text(body.brief || body.prompt, 1000);
  const duration = integer(body.duration, 10, 30, 15);
  const format = ALLOWED_FORMATS.has(body.format) ? body.format : '9:16';
  const fallback = fallbackPlan(brief, duration, format);
  const prompt = `Tu es le réalisateur publicitaire de Velvet, une plateforme premium de rencontres et d'expériences entre adultes. À partir du brief ci-dessous, écris un scénario vidéo social français simple, émotionnel et réaliste. Le rendu doit rappeler la qualité des grandes campagnes de rencontre grand public sans copier aucune marque. Toutes les personnes sont fictives, majeures de plus de 30 ans, habillées, sans contenu explicite. Utilise 4 scènes maximum et simule naturellement une fonctionnalité Velvet : profil, recherche, message ou événement. Réponds exclusivement en JSON valide avec cette structure : {"title":"...","voiceOver":"...","scenes":[{"title":"...","duration":4,"onScreen":"...","voice":"...","scenario":"profil","prompt":"description photographique détaillée en français"}]}. Durée cible : ${duration} secondes. Format : ${format}. Brief : ${brief}`;
  try {
    const result = await env.AI.run(TEXT_MODEL, {
      prompt,
      max_tokens: 1200,
      temperature: 0.35
    });
    return parsePlan(extractModelText(result), brief, duration, format);
  } catch {
    return fallback;
  }
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function audioResponse(result) {
  const headers = {
    'content-type': 'audio/mpeg',
    'cache-control': 'no-store',
    'x-velvet-studio-voice-model': VOICE_MODEL
  };
  if (result instanceof Response) return new Response(result.body, { status: result.status, headers: { ...Object.fromEntries(result.headers), ...headers } });
  if (result instanceof ReadableStream) return new Response(result, { headers });
  if (result instanceof ArrayBuffer) return new Response(result, { headers });
  if (ArrayBuffer.isView(result)) return new Response(result.buffer, { headers });
  if (typeof result?.audio === 'string') return new Response(decodeBase64(result.audio), { headers });
  if (typeof result === 'string') return new Response(decodeBase64(result), { headers });
  return json({ error: 'workers_ai_voice_missing' }, 502);
}

function capabilities(env) {
  return {
    version: 'simple-ai-video',
    binding: Boolean(env.AI && typeof env.AI.run === 'function'),
    models: { text: TEXT_MODEL, image: IMAGE_MODEL, voice: VOICE_MODEL },
    mode: 'workers-ai-direct',
    pipeline: ['plan', 'images', 'voice', 'render'],
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
    if (!env.AI || typeof env.AI.run !== 'function') return json({ error: 'workers_ai_binding_missing' }, 503);

    if (action === 'plan_video') {
      return json({ plan: await generatePlan(env, body) });
    }

    if (action === 'generate_voice') {
      const prompt = text(body.text || body.voiceOver, 1800);
      if (!prompt) return json({ error: 'studio_voice_text_required' }, 400);
      const result = await env.AI.run(VOICE_MODEL, { prompt, lang: 'fr' });
      return audioResponse(result);
    }

    if (action !== 'generate_image') return json({ error: 'studio_media_action_unknown' }, 400);

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
