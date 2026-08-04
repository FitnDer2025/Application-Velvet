import { onRequestPost as studioMediaPost } from './studio-media.js';

function cleanSpeech(value, max = 360) {
  const source = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[•▪◦◆◇✦✧★☆→←↔✓✔🔥❤️💫✨]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source) return '';
  const clipped = source.slice(0, max).replace(/\s+\S*$/, '').trim();
  return /[.!?…]$/.test(clipped) ? clipped : `${clipped}.`;
}

function fallbackSpeech(duration = 15) {
  return Number(duration) > 20
    ? 'Bienvenue dans Velvet. Découvrez des profils complets, échangez en toute confiance, trouvez des sorties et explorez les établissements proches de vous. Une expérience élégante, fluide et pensée pour des rencontres plus sincères. Velvet, là où les plus belles rencontres commencent.'
    : 'Bienvenue dans Velvet. Découvrez des profils, échangez en confiance et trouvez les sorties qui vous ressemblent. Velvet, là où les plus belles rencontres commencent.';
}

function requestWithBody(request, body) {
  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  return new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function responsePayload(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('json')) return null;
  return response.clone().json().catch(() => null);
}

export async function onRequestPost(context) {
  const body = await context.request.clone().json().catch(() => null);
  if (!body || body.action !== 'generate_voice') {
    return studioMediaPost(context);
  }

  const duration = Math.max(10, Math.min(45, Number(body.duration || 15)));
  const max = duration <= 15 ? 260 : duration <= 30 ? 430 : 620;
  const prompt = cleanSpeech(body.text || body.voiceOver, max);
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'studio_voice_text_required', action: 'generate_voice' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const first = await studioMediaPost({
    ...context,
    request: requestWithBody(context.request, { ...body, text: prompt, voiceOver: prompt })
  });
  if (first.ok) return first;

  const detail = await responsePayload(first);
  if (detail?.error !== 'workers_ai_invalid_input' && detail?.code !== '8002') return first;

  const safe = fallbackSpeech(duration);
  const retry = await studioMediaPost({
    ...context,
    request: requestWithBody(context.request, { ...body, text: safe, voiceOver: safe })
  });
  if (!retry.ok) return retry;

  const response = new Response(retry.body, retry);
  response.headers.set('x-velvet-studio-voice-fallback', 'safe-copy');
  return response;
}
