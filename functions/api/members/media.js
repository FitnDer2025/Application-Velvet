import { supabase } from '../auth/_shared.js';

const INTERNAL_ENVIRONMENTS = new Set(['development', 'dev', 'staging', 'preview', 'internal', 'test']);
const EPHEMERAL_PREFIX = 'messages-ephemeral/';

function mediaUrl(env, signedPath) {
  const supabaseBase = String(env.SUPABASE_URL).replace(/\/$/, '');
  if (/^https?:\/\//i.test(signedPath)) return signedPath;
  if (signedPath.startsWith('/storage/v1/')) {
    return new URL(signedPath, `${supabaseBase}/`).toString();
  }
  return new URL(
    signedPath.replace(/^\/+/, ''),
    `${supabaseBase}/storage/v1/`
  ).toString();
}

function canUseInternalMediaFallback(env, path) {
  const environment = String(env.VELVET_ENVIRONMENT || env.ENVIRONMENT || '').trim().toLowerCase();
  return String(path).startsWith('internal-test-agents/')
    && INTERNAL_ENVIRONMENTS.has(environment)
    && environment !== 'production'
    && String(env.VELVET_INTERNAL_TEST_AGENTS || '') === 'enabled'
    && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
}

function cleanTransform(transform) {
  if (!transform || typeof transform !== 'object') return null;
  const width = Math.max(1, Math.min(2500, Math.round(Number(transform.width) || 0)));
  const height = Math.max(1, Math.min(2500, Math.round(Number(transform.height) || 0)));
  const quality = Math.max(20, Math.min(100, Math.round(Number(transform.quality) || 80)));
  const resize = ['cover', 'contain', 'fill'].includes(transform.resize) ? transform.resize : 'contain';
  const output = { quality, resize };
  if (Number(transform.width) > 0) output.width = width;
  if (Number(transform.height) > 0) output.height = height;
  return output.width || output.height ? output : null;
}

function signedBody(expiresIn, transform) {
  const normalized = cleanTransform(transform);
  return JSON.stringify({
    expiresIn,
    ...(normalized ? { transform: normalized } : {})
  });
}

async function signedInternalMediaUrl(env, path, expiresIn, transform = null) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) return null;
  const response = await fetch(`${base}/storage/v1/object/sign/velvet-media/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: signedBody(expiresIn, transform)
  });
  const payload = await response.json().catch(() => ({}));
  return response.ok && payload.signedURL ? mediaUrl(env, String(payload.signedURL)) : null;
}

async function signMedia(env, session, path, expiresIn = 600, transform = null) {
  if (!path) return null;
  const ttl = Math.max(60, Math.min(3600, Number(expiresIn) || 600));
  const normalized = cleanTransform(transform);
  const response = await supabase(
    env,
    `/storage/v1/object/sign/velvet-media/${path}`,
    {
      method: 'POST',
      body: JSON.stringify({
        expiresIn: ttl,
        ...(normalized ? { transform: normalized } : {})
      })
    },
    session.access_token
  );
  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload.signedURL) {
    return mediaUrl(env, String(payload.signedURL));
  }
  if (canUseInternalMediaFallback(env, path)) {
    return signedInternalMediaUrl(env, path, ttl, transform);
  }
  return null;
}

export async function signedMediaUrl(env, session, path, expiresIn = 600, transform = null) {
  if (String(path || '').startsWith(EPHEMERAL_PREFIX)) return null;
  return signMedia(env, session, path, expiresIn, transform);
}

export async function signedEphemeralMediaUrl(env, session, path, expiresIn = 60) {
  if (!String(path || '').startsWith(EPHEMERAL_PREFIX)) return null;
  // Même après ouverture, l'URL reste très courte et ne doit jamais être mise en cache durablement.
  return signMedia(env, session, path, Math.max(60, Math.min(120, Number(expiresIn) || 60)), null);
}

async function enrichRows(env, session, rows = []) {
  return Promise.all(rows.map(async (media) => ({
    ...media,
    previewUrl: await signedMediaUrl(env, session, media.storage_path)
  })));
}

export async function enrichProfileMedia(env, session, profile) {
  if (!profile) return profile;
  const mediaAssets = await enrichRows(env, session, profile.media_assets || []);
  const albums = await Promise.all((profile.albums || []).map(async (album) => ({
    ...album,
    media_assets: await enrichRows(env, session, album.media_assets || [])
  })));
  return { ...profile, media_assets: mediaAssets, albums };
}

export async function enrichProfilesMedia(env, session, profiles = []) {
  return Promise.all(profiles.map((profile) => enrichProfileMedia(env, session, profile)));
}
