import { memberSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const PERSONAS = {
  'clara-mathieu': 'French fictional couple, woman 35 with chestnut hair and green eyes, man 38 with dark hair and brown eyes, elegant contemporary outfits, natural complicity',
  'lea-nord': 'French fictional woman, 33, brunette, hazel eyes, elegant and independent, refined contemporary outfit, natural expression',
  'sophie-thomas': 'French fictional couple, woman 37 with blonde hair and blue eyes, man 39 with chestnut hair and blue eyes, warm and reassuring, elegant casual outfits',
  'maxime-lille': 'French fictional man, 36, athletic, dark hair and brown eyes, friendly and respectful, premium casual outfit',
  'nina-lucas': 'Belgian fictional couple, woman 34 with red hair and green eyes, man 36 with dark hair and green eyes, lively and sophisticated, cocktail outfits',
  'camille-bxl': 'Belgian fictional woman, 32, black hair and brown eyes, creative artistic director, inclusive and refined, fashion editorial outfit'
};

async function requireControl(request, env) {
  const session = await memberSession(request, env, { allowUnverified: true });
  if (session.response) return session.response;
  if (!session.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return new Response('Accès marketing réservé à Velvet Control.', { status: 403 });
  }
  return null;
}

function decodeBase64(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function initials(slug) {
  return slug.split('-').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[char]);
}

function fallbackSvg(slug, variant) {
  const label = escapeXml(initials(slug));
  const offset = Number(variant || 0) % 3;
  const palettes = [
    ['#160f14', '#641b36', '#c6a96a'],
    ['#111114', '#3e2432', '#d4b873'],
    ['#181217', '#78304d', '#b99459']
  ];
  const [start, end, accent] = palettes[offset];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient><radialGradient id="r"><stop stop-color="${accent}" stop-opacity=".38"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#g)"/><circle cx="780" cy="180" r="310" fill="url(#r)"/>
    <circle cx="512" cy="390" r="172" fill="#e5d7ca" opacity=".92"/><path d="M220 1024c26-276 132-426 292-426s266 150 292 426" fill="#231b20"/>
    <circle cx="512" cy="512" r="360" fill="none" stroke="${accent}" stroke-opacity=".25" stroke-width="3"/>
    <text x="512" y="900" text-anchor="middle" fill="${accent}" font-family="Georgia,serif" font-size="94" letter-spacing="16">${label}</text>
  </svg>`;
}

function portraitPrompt(slug, variant) {
  const scenes = [
    'premium lounge with warm cinematic light, natural seated portrait, candid expression',
    'elegant urban hotel lobby, three-quarter lifestyle portrait, soft evening light',
    'refined cocktail setting, spontaneous premium editorial photography, shallow depth of field'
  ];
  return [
    'Square photorealistic lifestyle portrait for a premium French adult community marketing demonstration.',
    `Entirely fictional adults only: ${PERSONAS[slug]}.`,
    `Scene: ${scenes[Number(variant || 0) % scenes.length]}.`,
    'Natural skin, anatomically correct hands and faces, realistic French or Belgian people, discreet confidence, warm editorial photography, burgundy charcoal and champagne accents.',
    'No nudity, no underwear, no sexual pose, no explicit content, no text, no logo, no watermark, no celebrity, no real person.'
  ].join(' ').slice(0, 2048);
}

async function generatedImage(env, slug, variant) {
  if (!env.AI || typeof env.AI.run !== 'function') return null;
  const generation = env.AI.run(IMAGE_MODEL, {
    prompt: portraitPrompt(slug, variant),
    steps: 4
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 6500));
  const result = await Promise.race([generation, timeout]);
  return result?.image ? decodeBase64(result.image) : null;
}

export async function onRequestGet({ request, env }) {
  const denied = await requireControl(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const slug = String(url.searchParams.get('slug') || '').toLowerCase();
  const variant = Math.max(0, Math.min(2, Number.parseInt(url.searchParams.get('variant') || '0', 10) || 0));
  if (!PERSONAS[slug]) return new Response('Portrait marketing inconnu.', { status: 404 });

  const cacheUrl = new URL(`/__velvet-marketing-portrait/${slug}-${variant}.jpg`, url.origin);
  const cacheKey = new Request(cacheUrl, { method: 'GET' });
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch {
    // Le cache d’edge est optionnel sur certains environnements de recette.
  }

  let response;
  try {
    const bytes = await generatedImage(env, slug, variant);
    if (!bytes) throw new Error('marketing_portrait_generation_unavailable');
    response = new Response(bytes, {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=2592000, immutable',
        'x-velvet-marketing-image': 'workers-ai'
      }
    });
  } catch {
    response = new Response(fallbackSvg(slug, variant), {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=86400',
        'x-velvet-marketing-image': 'safe-fallback'
      }
    });
  }

  try {
    await caches.default.put(cacheKey, response.clone());
  } catch {
    // Le navigateur conservera malgré tout la réponse grâce au cache HTTP.
  }
  return response;
}
