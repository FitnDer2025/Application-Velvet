import { json } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';
import { onRequestPost as studioMediaPost } from './studio-media.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const FRENCH_VOICE_MODEL = '@cf/myshell-ai/melotts';

function cleanFrenchSpeech(value, max = 170) {
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

function firstSentence(value, max = 125) {
  const clean = cleanFrenchSpeech(value, max);
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  return match?.[0]?.trim() || clean;
}

function frenchFallback(duration = 6) {
  return Number(duration) >= 7
    ? 'Velvet réunit les profils, les échanges et les expériences dans un univers élégant et rassurant.'
    : 'Découvrez Velvet, un univers élégant pour des rencontres plus sincères.';
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

function decodeBase64Audio(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function frenchAudioResponse(result, attempt) {
  const headers = {
    'content-type': 'audio/mpeg',
    'cache-control': 'no-store',
    'x-velvet-studio-voice-model': FRENCH_VOICE_MODEL,
    'x-velvet-studio-voice-language': 'fr',
    'x-velvet-studio-voice-attempt': attempt
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
  if (typeof result?.audio === 'string') return new Response(decodeBase64Audio(result.audio), { headers });
  if (typeof result === 'string') return new Response(decodeBase64Audio(result), { headers });
  throw new Error('workers_ai_voice_missing');
}

async function meloFrench(env, prompt, attempt) {
  const result = await env.AI.run(FRENCH_VOICE_MODEL, { prompt, lang: 'fr' });
  return frenchAudioResponse(result, attempt);
}

async function generateFrenchVoice(env, requestedText, duration) {
  const clean = cleanFrenchSpeech(requestedText, duration <= 5 ? 125 : 170);
  const short = firstSentence(clean, duration <= 5 ? 100 : 130);
  const fallback = frenchFallback(duration);
  const attempts = [
    { name: 'melotts-fr-scene', text: clean },
    { name: 'melotts-fr-short', text: short },
    { name: 'melotts-fr-safe', text: fallback }
  ];
  const failures = [];

  for (const attempt of attempts) {
    try {
      const response = await meloFrench(env, attempt.text, attempt.name);
      if (failures.length) response.headers.set('x-velvet-studio-voice-recovered', 'true');
      return response;
    } catch (error) {
      failures.push({ engine: attempt.name, code: errorCode(error) });
    }
  }

  return json({
    error: 'workers_ai_french_voice_unavailable',
    action: 'generate_voice',
    language: 'fr',
    attempts: failures
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

  const duration = Math.max(3, Math.min(12, Number(body.duration || 6)));
  const prompt = cleanFrenchSpeech(body.text || body.voiceOver, duration <= 5 ? 125 : 170);
  if (!prompt) return json({ error: 'studio_voice_text_required', action: 'generate_voice' }, 400);
  return generateFrenchVoice(context.env, prompt, duration);
}
