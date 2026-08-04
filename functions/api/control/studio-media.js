import { json, readJson } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const TEXT_MODEL = '@cf/zai-org/glm-4.7-flash';
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const VOICE_MODEL = '@cf/myshell-ai/melotts';

const ALLOWED_FORMATS = new Set(['9:16', '1:1', '16:9', '4:5']);
const ALLOWED_SCREENS = new Set(['home', 'discover', 'profile', 'messages', 'events', 'map']);
const ALLOWED_ACTIONS = new Set(['arrive', 'browse', 'open_profile', 'read_profile', 'open_message', 'read_message', 'open_event', 'explore_map', 'close']);
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

function formatAction(action, screen) {
  if (ALLOWED_ACTIONS.has(action)) return action;
  return ({
    home: 'arrive',
    discover: 'browse',
    profile: 'open_profile',
    messages: 'open_message',
    events: 'open_event',
    map: 'explore_map'
  })[screen] || 'browse';
}

function fallbackPlan(brief, duration, format) {
  const screens = duration >= 30
    ? ['home', 'discover', 'profile', 'messages', 'events', 'map']
    : ['home', 'discover', 'profile', 'events'];
  const sceneDuration = Math.max(3, Math.floor(duration / screens.length));
  const copy = {
    home: {
      title: 'Une envie que l’on n’osait pas encore nommer',
      onScreen: 'Tout commence par une envie.',
      voice: 'Il y a des envies que l’on garde longtemps pour soi. Puis vient le moment de les découvrir autrement.',
      action: 'arrive',
      emotion: 'mystère'
    },
    discover: {
      title: 'Un univers attire le regard',
      onScreen: 'Un profil. Une intuition.',
      voice: 'Sur Velvet, on ne fait pas que défiler des visages. On découvre des univers capables de faire naître une véritable curiosité.',
      action: 'browse',
      emotion: 'attirance'
    },
    profile: {
      title: 'Derrière les images, une histoire',
      onScreen: 'Prendre le temps de découvrir.',
      voice: 'Quelques photos, des mots choisis, des envies partagées. Assez pour ressentir ce petit trouble qui donne envie d’en savoir plus.',
      action: 'open_profile',
      emotion: 'émotion'
    },
    messages: {
      title: 'Les premiers mots',
      onScreen: 'Le feeling commence ici.',
      voice: 'Alors un premier message est envoyé. Sans pression. Avec cette élégance qui laisse doucement la place au feeling.',
      action: 'open_message',
      emotion: 'connexion'
    },
    events: {
      title: 'Quand l’échange devient une promesse',
      onScreen: 'Et si la rencontre avait lieu ce soir ?',
      voice: 'Une conversation devient une invitation. Une soirée se dessine. L’imaginaire laisse enfin place à une expérience réelle.',
      action: 'open_event',
      emotion: 'désir'
    },
    map: {
      title: 'Tout devient plus proche',
      onScreen: 'Les rencontres et les expériences autour de vous.',
      voice: 'Velvet rapproche les personnes, les lieux et les événements qui partagent la même envie de vivre quelque chose de vrai.',
      action: 'explore_map',
      emotion: 'projection'
    }
  };

  const scenes = screens.map((screen, index) => ({
    title: copy[screen].title,
    duration: index === screens.length - 1
      ? Math.max(3, duration - sceneDuration * (screens.length - 1))
      : sceneDuration,
    onScreen: copy[screen].onScreen,
    voice: copy[screen].voice,
    screen,
    action: copy[screen].action,
    emotion: copy[screen].emotion,
    beat: index + 1
  }));

  const voiceOver = [
    ...scenes.map((scene) => scene.voice),
    'Velvet. Là où les plus belles rencontres commencent.'
  ].join(' ');

  return {
    title: 'Une envie devient une histoire',
    format,
    duration,
    mode: 'story-led-product-demo',
    narrativeArc: 'mystère → attirance → émotion → connexion → désir → projection',
    brief,
    voiceOver,
    closingLine: 'Velvet. Là où les plus belles rencontres commencent.',
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
  const source = text(raw, 16000);
  const match = source.match(/\{[\s\S]*\}/);
  if (!match) return fallback;

  try {
    const parsed = JSON.parse(match[0]);
    const requiredScreens = duration >= 30
      ? ['home', 'discover', 'profile', 'messages', 'events', 'map']
      : ['home', 'discover', 'profile', 'events'];
    const generated = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    const byScreen = new Map(generated.map((scene, index) => [formatScreen(scene.screen, index), scene]));
    const fallbackByScreen = new Map(fallback.scenes.map((scene) => [scene.screen, scene]));
    const sceneDuration = duration / requiredScreens.length;

    const scenes = requiredScreens.map((screen, index) => {
      const sourceScene = byScreen.get(screen) || {};
      const backup = fallbackByScreen.get(screen);
      return {
        title: text(sourceScene.title || backup.title, 110),
        duration: sceneDuration,
        onScreen: text(sourceScene.onScreen || sourceScene.text || backup.onScreen, 120),
        voice: text(sourceScene.voice || backup.voice, 230),
        screen,
        action: formatAction(sourceScene.action || backup.action, screen),
        emotion: text(sourceScene.emotion || backup.emotion, 40),
        beat: index + 1
      };
    });

    return {
      title: text(parsed.title || fallback.title, 120),
      format,
      duration,
      mode: 'story-led-product-demo',
      narrativeArc: text(parsed.narrativeArc || fallback.narrativeArc, 180),
      brief,
      voiceOver: text(parsed.voiceOver || scenes.map((scene) => scene.voice).join(' '), 1600),
      closingLine: text(parsed.closingLine || fallback.closingLine, 160),
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

  const system = [
    'Tu es le réalisateur et concepteur-rédacteur d’une campagne française premium pour Velvet.',
    'Velvet est un univers de rencontres et d’expériences entre adultes fondé sur la confiance, le consentement, l’élégance et la discrétion.',
    'Tu ne réalises pas un catalogue de fonctionnalités. Tu racontes une histoire sensuelle, émotionnelle et subtile à travers la véritable interface Velvet.',
    'La sensualité repose sur le mystère, les mots, l’attente, le feeling et la projection. Elle ne doit jamais devenir explicite, vulgaire ou sexuelle.',
    'Le scénario est le réalisateur : chaque phrase de voix off doit déclencher l’écran et l’action qui illustrent précisément ce qui est raconté.',
    'Utilise exclusivement les écrans réels autorisés : home, discover, profile, messages, events, map.',
    'Arc obligatoire : une envie intime → une découverte → une attirance → les premiers mots → la projection dans une sortie → l’envie de rejoindre Velvet.',
    'La narration doit être naturelle à l’oral, française, chaleureuse, lente, cinématographique et composée de phrases courtes.',
    'Ne dis jamais « fonctionnalité », « plateforme », « utilisateur », « filtre » ou « application » dans la voix off.',
    'Ne montre aucun couple filmé, aucune scène extérieure et aucune photographie inventée : l’histoire est racontée uniquement par la navigation dans Velvet.',
    'Chaque scène doit avoir screen, action, emotion, title, onScreen, voice et duration.',
    'Actions autorisées : arrive, browse, open_profile, read_profile, open_message, read_message, open_event, explore_map, close.',
    'Réponds exclusivement avec un objet JSON valide, sans markdown.'
  ].join(' ');

  const user = [
    `Durée cible : ${duration} secondes.`,
    `Format : ${format}.`,
    `Brief : ${brief || 'Faire ressentir comment une envie discrète devient une belle rencontre grâce à Velvet.'}`,
    'Structure JSON :',
    '{"title":"...","narrativeArc":"...","closingLine":"...","voiceOver":"...","scenes":[{"title":"...","duration":5,"onScreen":"...","voice":"...","screen":"home","action":"arrive","emotion":"mystère"}]}.'
  ].join(' ');

  try {
    const result = await env.AI.run(TEXT_MODEL, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_completion_tokens: 1800,
      temperature: 0.72,
      top_p: 0.9
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
    version: 'story-led-live-v2',
    binding: Boolean(env.AI && typeof env.AI.run === 'function'),
    models: { text: TEXT_MODEL, image: IMAGE_MODEL, voice: VOICE_MODEL },
    mode: 'story-led-velvet-live-recording',
    pipeline: ['story', 'directed-navigation', 'french-voice', 'live-recording'],
    formats: [...ALLOWED_FORMATS],
    screens: [...ALLOWED_SCREENS],
    actions: [...ALLOWED_ACTIONS],
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
      const result = await env.AI.run(VOICE_MODEL, { prompt, lang: 'fr' }, { returnRawResponse: true });
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
