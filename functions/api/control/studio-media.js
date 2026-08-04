import { json, readJson } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const VOICE_MODEL = '@cf/myshell-ai/melotts';

const ALLOWED_FORMATS = new Set(['9:16', '1:1', '16:9', '4:5']);
const ALLOWED_SCREENS = new Set(['home', 'discover', 'profile', 'messages', 'events', 'map']);
const ALLOWED_SCENARIOS = new Set(['profil', 'recherche', 'message', 'evenement']);

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

function formatScreen(screen, index) {
  if (ALLOWED_SCREENS.has(screen)) return screen;
  return ['home', 'discover', 'profile', 'messages', 'events', 'map'][index % 6];
}

function fallbackPlan(brief, duration, format) {
  const screens = duration >= 30
    ? ['home', 'discover', 'profile', 'messages', 'events', 'map']
    : ['home', 'discover', 'profile', 'events'];
  const sceneDuration = Math.max(3, Math.floor(duration / screens.length));
  const copy = {
    home: {
      title: 'Bienvenue dans Velvet',
      onScreen: 'Tout l’univers Velvet, au même endroit.',
      voice: 'Bienvenue dans Velvet, une expérience pensée pour réunir les rencontres, les échanges, les lieux et les événements.'
    },
    discover: {
      title: 'Découvrir',
      onScreen: 'Trouvez les profils qui vous correspondent.',
      voice: 'Une recherche claire et précise permet de découvrir des profils vérifiés autour de vous.'
    },
    profile: {
      title: 'Des profils plus complets',
      onScreen: 'Une identité, un univers, une confiance visible.',
      voice: 'Chaque profil présente son univers, ses envies et son niveau de confiance dans une interface élégante et lisible.'
    },
    messages: {
      title: 'Échanger simplement',
      onScreen: 'Le feeling commence par quelques mots.',
      voice: 'La messagerie sécurisée facilite les échanges tout en respectant la discrétion et le consentement.'
    },
    events: {
      title: 'Sorties et événements',
      onScreen: 'Les expériences proches de vous.',
      voice: 'Velvet rassemble aussi les sorties, les soirées et les événements qui font vivre la communauté.'
    },
    map: {
      title: 'Tout un écosystème',
      onScreen: 'Membres, lieux et événements sur une seule carte.',
      voice: 'La carte Velvet permet de retrouver les membres, les établissements et les expériences disponibles à proximité.'
    }
  };

  const scenes = screens.map((screen, index) => ({
    title: copy[screen].title,
    duration: index === screens.length - 1
      ? Math.max(3, duration - sceneDuration * (screens.length - 1))
      : sceneDuration,
    onScreen: copy[screen].onScreen,
    voice: copy[screen].voice,
    screen
  }));

  const voiceOver = [
    ...scenes.map((scene) => scene.voice),
    'Velvet. Là où les plus belles rencontres commencent.'
  ].join(' ');

  return {
    title: 'Découvrir Velvet',
    format,
    duration,
    mode: 'product-demo',
    brief,
    voiceOver,
    scenes
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
  const source = text(raw, 12000);
  const match = source.match(/\{[\s\S]*\}/);
  if (!match) return fallback;

  try {
    const parsed = JSON.parse(match[0]);
    const maxScenes = duration >= 30 ? 6 : 4;
    const scenes = Array.isArray(parsed.scenes)
      ? parsed.scenes.slice(0, maxScenes).map((scene, index) => ({
          title: text(scene.title || `Étape ${index + 1}`, 100),
          duration: integer(scene.duration, 3, 12, Math.max(3, Math.floor(duration / maxScenes))),
          onScreen: text(scene.onScreen || scene.text || '', 140),
          voice: text(scene.voice || '', 420),
          screen: formatScreen(scene.screen, index)
        }))
      : [];

    if (scenes.length < 3) return fallback;

    return {
      title: text(parsed.title || fallback.title, 120),
      format,
      duration,
      mode: 'product-demo',
      brief,
      voiceOver: text(parsed.voiceOver || scenes.map((scene) => scene.voice).join(' '), 1200),
      scenes
    };
  } catch {
    return fallback;
  }
}

async function generatePlan(env, body) {
  const brief = text(body.brief || body.prompt, 1200);
  const duration = integer(body.duration, 10, 45, 30);
  const format = ALLOWED_FORMATS.has(body.format) ? body.format : '9:16';
  const fallback = fallbackPlan(brief, duration, format);

  const prompt = [
    'Tu es le réalisateur produit de Velvet.',
    'Velvet est une plateforme premium de rencontres et d’expériences entre adultes.',
    'La vidéo doit montrer exclusivement l’interface Velvet en fonctionnement : aucun couple filmé, aucune scène de vie, aucune photographie inventée.',
    'Construis une visite fluide et fidèle du produit à partir des écrans autorisés : home, discover, profile, messages, events, map.',
    'Le texte de voix off doit raconter une histoire simple et valoriser les fonctions réellement visibles.',
    'Réponds exclusivement en JSON valide avec cette structure :',
    '{"title":"...","voiceOver":"...","scenes":[{"title":"...","duration":5,"onScreen":"...","voice":"...","screen":"home"}]}.',
    `Durée cible : ${duration} secondes.`,
    `Format : ${format}.`,
    `Brief utilisateur : ${brief || 'Démonstration générale de Velvet.'}`
  ].join(' ');

  try {
    const result = await env.AI.run(TEXT_MODEL, {
      prompt,
      max_tokens: 1400,
      temperature: 0.2
    });
    return parsePlan(extractModelText(result), brief, duration, format);
  } catch {
    return fallback;
  }
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function audioResponse(result) {
  const headers = {
    'content-type': 'audio/mpeg',
    'cache-control': 'no-store',
    'x-velvet-studio-voice-model': VOICE_MODEL
  };

  if (result instanceof Response) {
    return new Response(result.body, {
      status: result.status,
      headers: { ...Object.fromEntries(result.headers), ...headers }
    });
  }
  if (result instanceof ReadableStream) return new Response(result, { headers });
  if (result instanceof ArrayBuffer) return new Response(result, { headers });
  if (ArrayBuffer.isView(result)) return new Response(result.buffer, { headers });
  if (typeof result?.audio === 'string') return new Response(decodeBase64(result.audio), { headers });
  if (typeof result === 'string') return new Response(decodeBase64(result), { headers });
  return json({ error: 'workers_ai_voice_missing' }, 502);
}

function legacyImagePrompt(body) {
  const prompt = text(body.prompt, 1700);
  return [
    prompt,
    'High-end Velvet advertising illustration.',
    'Fictional adults only, no nudity, no explicit content, no text, no logo, no watermark.'
  ].filter(Boolean).join(' ').slice(0, 2048);
}

function aiErrorPayload(error, action) {
  const message = text(error?.message || 'studio_media_generation_failed', 600);
  const code = message.match(/\b(8002|5004|5007|3006|3007|3036|3040)\b/)?.[1] || '';
  return {
    error: code === '8002' ? 'workers_ai_invalid_input' : message,
    code,
    action
  };
}

function capabilities(env) {
  return {
    version: 'product-demo-v1',
    binding: Boolean(env.AI && typeof env.AI.run === 'function'),
    models: { text: TEXT_MODEL, image: IMAGE_MODEL, voice: VOICE_MODEL },
    mode: 'velvet-interface-capture',
    pipeline: ['plan', 'velvet-screens', 'voice', 'render'],
    formats: [...ALLOWED_FORMATS],
    screens: [...ALLOWED_SCREENS],
    syntheticOnly: true
  };
}

export async function onRequestPost({ request, env }) {
  const session = await requireControl(request, env);
  if (session.response) return session.response;

  let action = '';
  try {
    const body = await readJson(request);
    action = text(body.action, 60);

    if (action === 'capabilities') return json(capabilities(env));
    if (!env.AI || typeof env.AI.run !== 'function') {
      return json({ error: 'workers_ai_binding_missing' }, 503);
    }

    if (action === 'plan_video') {
      return json({ plan: await generatePlan(env, body) });
    }

    if (action === 'generate_voice') {
      const prompt = text(body.text || body.voiceOver, 1200);
      if (!prompt) return json({ error: 'studio_voice_text_required' }, 400);
      const result = await env.AI.run(VOICE_MODEL, { prompt, lang: 'fr' });
      return audioResponse(result);
    }

    if (action === 'generate_image') {
      const prompt = legacyImagePrompt(body);
      if (!prompt) return json({ error: 'studio_image_prompt_required' }, 400);
      const response = await env.AI.run(IMAGE_MODEL, { prompt, steps: 4 });
      if (!response?.image) return json({ error: 'workers_ai_image_missing' }, 502);
      return json({
        media: {
          id: crypto.randomUUID(),
          kind: 'image',
          model: IMAGE_MODEL,
          steps: 4,
          prompt,
          dataUri: `data:image/jpeg;base64,${response.image}`,
          createdAt: new Date().toISOString(),
          studioOnly: true,
          fictionalAdultsOnly: true
        }
      });
    }

    return json({ error: 'studio_media_action_unknown' }, 400);
  } catch (error) {
    return json(aiErrorPayload(error, action), 400);
  }
}
