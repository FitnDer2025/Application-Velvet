import { randomUUID } from 'node:crypto';

export function requestId(request) {
  const candidate = request.headers['x-request-id'];
  return typeof candidate === 'string' && /^[a-zA-Z0-9._:-]{8,100}$/.test(candidate)
    ? candidate
    : randomUUID();
}

export function sendJson(response, statusCode, body, headers = {}) {
  const data = JSON.stringify(body);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
    ...headers
  });
  response.end(data);
}

export async function readJson(request, maxBytes = 1_048_576) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('payload_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => part.trim()).filter((part) => part.includes('=')).map((part) => {
      const index = part.indexOf('=');
      return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
    })
  );
}

export function refreshCookie(token, config) {
  const pieces = [
    `velvet_refresh=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/v1/auth',
    `Max-Age=${60 * 60 * 24 * 30}`
  ];
  if (config.cookieSecure) pieces.push('Secure');
  if (config.cookieDomain) pieces.push(`Domain=${config.cookieDomain}`);
  return pieces.join('; ');
}

export function clearRefreshCookie(config) {
  const pieces = ['velvet_refresh=', 'HttpOnly', 'SameSite=Strict', 'Path=/v1/auth', 'Max-Age=0'];
  if (config.cookieSecure) pieces.push('Secure');
  if (config.cookieDomain) pieces.push(`Domain=${config.cookieDomain}`);
  return pieces.join('; ');
}

export function createRateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  const buckets = new Map();
  return function rateLimit(key, now = Date.now()) {
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
    }
    current.count += 1;
    return { allowed: current.count <= max, remaining: Math.max(0, max - current.count), resetAt: current.resetAt };
  };
}
