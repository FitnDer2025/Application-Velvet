import { json } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';
import { onRequestPost as studioMediaPost } from './studio-media.js';
import { generateSocialPlan, SOCIAL_TEXT_MODEL } from './studio-social-plan.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const FRENCH_VOICE_MODEL = '@cf/myshell-ai/melotts';

function cleanFrenchSpeech(value, max = 190) {
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

function firstSentence(value, max = 135) {
  const clean = cleanFrenchSpeech(value, max);
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  return match?.[0]?.trim() || clean;
}

function frenchFallback(duration = 6) {
  return Number(duration) >= 7
    ? 'Tout commence par une envie, puis par quelques mots. Avec Velvet, une rencontre peut devenir une histoire.'
    : 'Avec Velvet, une envie peut devenir une belle histoire.';
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
  const clean = String(value || '').replace(/^data:audio\/[^;]+;base64,/, '').trim();
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function audioHeaders(attempt, contentType = 'audio/mpeg') {
  return {
    'content-type': contentType || 'audio/mpeg',
    'cache-control': 'no-store',
    'x-velvet-studio-voice-model': FRENCH_VOICE_MODEL,
    'x-velvet-studio-voice-language': 'fr',
    'x-velvet-studio-voice-attempt': attempt
  };
}

function binaryResponse(value, attempt, contentType = 'audio/mpeg') {
  if (value instanceof ArrayBuffer) return new Response(value, { headers: audioHeaders(attempt, contentType) });
  if (ArrayBuffer.isView(value)) {
    const bytes = value.byteOffset === 0 && value.byteLength === value.buffer.byteLength
      ? value.buffer
      : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    return new Response(bytes, { headers: audioHeaders(attempt, contentType) });
  }
  if (value instanceof ReadableStream) return new Response(value, { headers: audioHeaders(attempt, contentType) });
  return null;
}

async function frenchAudioResponse(result, attempt) {
  if (result instanceof Response) {
    if (!result.ok) {
      const detail = await result.clone().text().catch(() => 'voice_response_failed');
      throw new Error(detail || `voice_response_${result.status}`);
    }
    const type = result.headers.get('content-type') || 'audio/mpeg';
    return new Response(result.body, {
      status: 200,
      headers: { ...Object.fromEntries(result.headers), ...audioHeaders(attempt, type) }
    });
  }

  const direct = binaryResponse(result, attempt);
  if (direct) return direct;

  const candidates = [
    result?.audio,
    result?.audio?.data,
    result?.data,
    result?.result,
    result?.result?.audio,
    result?.result?.audio?.data,
    result?.output,
    result?.output?.audio,
    result?.body
  ];

  for (const candidate of candidates) {
    const binary = binaryResponse(candidate, attempt);
    if (binary) return binary;
    if (typeof candidate === 'string' && candidate.trim()) {
      return new Response(decodeBase64Audio(candidate), { headers: audioHeaders(attempt) });
    }
    if (Array.isArray(candidate) && candidate.length) {
      return new Response(Uint8Array.from(candidate), { headers: audioHeaders(attempt) });
    }
  }

  if (typeof result === 'string' && result.trim()) {
    return new Response(decodeBase64Audio(result), { headers: audioHeaders(attempt) });
  }
  throw new Error(`workers_ai_voice_missing:${Object.keys(result || {}).slice(0, 8).join(',') || 'empty'}`);
}

async function meloFrench(env, prompt, attempt, raw = true) {
  const options = raw ? { returnRawResponse: true } : undefined;
  const result = await env.AI.run(FRENCH_VOICE_MODEL, { prompt, lang: 'fr' }, options);
  return frenchAudioResponse(result, attempt);
}

async function generateFrenchVoice(env, requestedText, duration) {
  const clean = cleanFrenchSpeech(requestedText, duration <= 5 ? 135 : 190);
  const short = firstSentence(clean, duration <= 5 ? 105 : 145);
  const fallback = frenchFallback(duration);
  const attempts = [
    { name: 'melotts-fr-raw', text: clean, raw: true },
    { name: 'melotts-fr-object', text: short, raw: false },
    { name: 'melotts-fr-safe-raw', text: fallback, raw: true },
    { name: 'melotts-fr-safe-object', text: fallback, raw: false }
  ];
  const failures = [];

  for (const attempt of attempts) {
    try {
      const response = await meloFrench(env, attempt.text, attempt.name, attempt.raw);
      if (failures.length) response.headers.set('x-velvet-studio-voice-recovered', 'true');
      return response;
    } catch (error) {
      failures.push({
        engine: attempt.name,
        code: errorCode(error),
        reason: String(error?.message || error).slice(0, 90)
      });
    }
  }

  return json({
    error: 'workers_ai_french_voice_unavailable',
    action: 'generate_voice',
    language: 'fr',
    attempts: failures.map(({ engine, code, reason }) => ({ engine, code, reason }))
  }, 502);
}

function socialCapabilities(env) {
  return {
    version: 'social-video-v1',
    binding: Boolean(env.AI && typeof env.AI.run === 'function'),
    products: ['member', 'pro'],
    formats: ['9:16', '1:1', '16:9'],
    textModel: SOCIAL_TEXT_MODEL,
    voiceEngine: 'browser-speech-fr',
    recordingEngine: 'display-media-live-crop',
    sources: ['/marketing/', '/marketing-pro/'],
    generatedImages: false,
    syntheticOnly: true
  };
}

export async function onRequestPost(context) {
  const body = await context.request.clone().json().catch(() => null);
  const action = body?.action || '';

  if (action === 'capabilities') {
    const denied = await requireControl(context.request, context.env);
    if (denied) return denied;
    return json(socialCapabilities(context.env));
  }

  if (action === 'plan_video' && ['member', 'pro'].includes(body?.product)) {
    const denied = await requireControl(context.request, context.env);
    if (denied) return denied;
    if (!context.env.AI || typeof context.env.AI.run !== 'function') {
      return json({ error: 'workers_ai_binding_missing', action: 'plan_video' }, 503);
    }
    return json({ plan: await generateSocialPlan(context.env, body) });
  }

  if (action !== 'generate_voice') return studioMediaPost(context);

  const denied = await requireControl(context.request, context.env);
  if (denied) return denied;
  if (!context.env.AI || typeof context.env.AI.run !== 'function') {
    return json({ error: 'workers_ai_binding_missing', action: 'generate_voice' }, 503);
  }

  const duration = Math.max(3, Math.min(12, Number(body.duration || 6)));
  const prompt = cleanFrenchSpeech(body.text || body.voiceOver, duration <= 5 ? 135 : 190);
  if (!prompt) return json({ error: 'studio_voice_text_required', action: 'generate_voice' }, 400);
  return generateFrenchVoice(context.env, prompt, duration);
}
