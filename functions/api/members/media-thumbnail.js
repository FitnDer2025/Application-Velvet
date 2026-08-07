import { json } from '../auth/_shared.js';
import { memberSession, withSession } from './_shared.js';
import { signedMediaUrl } from './media.js';

const IMAGE_PATH = /^[a-z0-9_./-]+\.(?:jpe?g|png|webp|avif|gif|bmp|tiff)$/i;

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function validPath(value) {
  const path = String(value || '').trim();
  return path.length > 0
    && path.length <= 500
    && !path.startsWith('/')
    && !path.includes('..')
    && IMAGE_PATH.test(path)
    ? path
    : null;
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;

    const url = new URL(request.url);
    const path = validPath(url.searchParams.get('path'));
    if (!path) return withSession({ error: 'invalid_media_thumbnail_path' }, access.session, 400);

    const width = boundedNumber(url.searchParams.get('width'), 720, 160, 960);
    const quality = boundedNumber(url.searchParams.get('quality'), 82, 70, 90);
    const thumbnailUrl = await signedMediaUrl(
      env,
      access.session,
      path,
      900,
      { width, quality, resize: 'contain' }
    );

    if (!thumbnailUrl) {
      return withSession({ thumbnailUrl: null, fallback: true }, access.session);
    }

    return withSession({
      thumbnailUrl,
      width,
      quality,
      expiresIn: 900
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'media_thumbnail_failed' }, 400);
  }
}
