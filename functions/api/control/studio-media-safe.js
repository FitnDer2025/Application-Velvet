import { json } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';
import { onRequestPost as studioMediaPost } from './studio-media.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const MELO_MODEL = '@cf/myshell-ai/melotts';
const AURA_MODEL = '@cf/deepgram/aura-1';

function cleanSpeech(value, max = 240) {
  const source = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[•▪◦◆◇✦✧★☆→←↔✓✔🔥❤💫✨]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source) return '';
  const clipped = source.slice(0, max).replace(/\s+\S*$/, '').trim();
  return /[.!?…]$/.test(clipped) ? clipped : `${clipped}.`;
}

function asciiSpeech(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackSpeech(duration = 15) {
  return Number(duration) > 20
    ? 'Bienvenue dans Velvet. Decouvrez des profils complets, echangez en confiance, trouvez des sorties et explorez les lieux proches de vous. Velvet reunit les rencontres, les experiences et la communaute.'
    : 'Bienvenue dans Velvet. Decouvrez les profils, les sorties et les lieux qui vous ressemblent.';
}

async function requireControl(request, env) {
  const session = await memberSession(request, env, { allowUnverified: true });
  if (session.response) return session.response;
  if (!session.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return json({ error: 'studio_access_required' }, 403);
  }
  return null;
}

function errorCode(error) {
  const message = String(error?.message || error || '');
  return message.match(/\b(8002|5004|5007|3003|3006|3007|3036|3040)\b/)?.[1] || '';
}

async function responseFromResult(result, model, engine) {
  const headers = {
    'content-type': 'audio/mpeg',
    'cache-control': 'no-store',
    'x-velvet-studio-voice-model': model,
    'x-velvet-studio-voice-engine': engine
  };

  if (result instanceof Response) {
    if (!result.ok) {
      const detail = await result.clone().text().catch(() => 'voice_response_failed');
      throw new Error(detail || `voice_response_${result.status}`);
    }
    return new Response(result.body, {
      status: 200,
      headers: { ...Object.fromEntries(result.headers), ...headers }
    });
  }
  if (result instanceof ReadableStream) return new Response(result, { headers });
  if (result instanceof ArrayBuffer) return new Response(result, { headers });
  if (ArrayBuffer.isView(result)) return new Response(result.buffer, { headers });

  if (typeof result?.audio === 'string' || typeof result === 'string') {
    const encoded = typeof result === 'string' ? result : result.audio;
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Response(bytes, { headers });
  }
  throw new Error('workers_ai_voice_missing');
}

async function melo(env, prompt, { language = true, engine = 'melotts-fr' } = {}) {
  const payload = language ? { prompt, lang: 'fr' } : { prompt };
  const result = await env.AI.run(MELO_MODEL, payload);
  return responseFromResult(result, MELO_MODEL, engine);
}

async function aura(env, text) {
  const result = await env.AI.run(
    AURA_MODEL,
    { text, speaker: 'asteria', encoding: 'mp3' },
    { returnRawResponse: true }
  );
  return responseFromResult(result, AURA_MODEL, 'aura-fallback');
}

async function generateVoice(env, requestedText, duration) {
  const max = duration <= 15 ? 220 : 360;
  const clean = cleanSpeech(requestedText, max);
  const ascii = asciiSpeech(clean);
  const safe = fallbackSpeech(duration);
  const attempts = [
    { name: 'melotts-fr', run: () => melo(env, clean, { language: true, engine: 'melotts-fr' }) },
    { name: 'melotts-fr-ascii', run: () => melo(env, ascii || safe, { language: true, engine: 'melotts-fr-ascii' }) },
    { name: 'melotts-minimal', run: () => melo(env, safe, { language: false, engine: 'melotts-minimal' }) },
    { name: 'aura-fallback', run: () => aura(env, clean || safe) }
  ];
  const failures = [];

  for (const attempt of attempts) {
    try {
      const response = await attempt.run();
      response.headers.set('x-velvet-studio-voice-attempt', attempt.name);
      if (failures.length) response.headers.set('x-velvet-studio-voice-recovered', 'true');
      return response;
    } catch (error) {
      failures.push({ engine: attempt.name, code: errorCode(error), message: String(error?.message || error).slice(0, 180) });
    }
  }

  return json({
    error: 'workers_ai_voice_unavailable',
    action: 'generate_voice',
    attempts: failures.map(({ engine, code }) => ({ engine, code }))
  }, 502);
}

export async function onRequestPost(context) {
  const body = await context.request.clone().json().catch(() => null);
  if (!body || body.action !== 'generate_voice') return studioMediaPost(context);

  const denied = await requireControl(context.request, context.env);
  if (denied) return denied;
  if (!context.env.AI || typeof context.env.AI.run !== 'function') {
    return json({ error: 'workers_ai_binding_missing', action: 'generate_voice' }, 503);
  }

  const duration = Math.max(10, Math.min(45, Number(body.duration || 15)));
  const prompt = cleanSpeech(body.text || body.voiceOver, duration <= 15 ? 220 : 360);
  if (!prompt) return json({ error: 'studio_voice_text_required', action: 'generate_voice' }, 400);
  return generateVoice(context.env, prompt, duration);
}
