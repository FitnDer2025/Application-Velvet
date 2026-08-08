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

export async function signedMediaUrls(env, session, paths = [], expiresIn = 600) {
  const uniquePaths = [...new Set((paths || [])
    .map((path) => String(path || '').trim())
    .filter((path) => path && !path.startsWith(EPHEMERAL_PREFIX)))];
  const urls = new Map();
  if (!uniquePaths.length) return urls;

  const ttl = Math.max(60, Math.min(3600, Number(expiresIn) || 600));
  const response = await supabase(
    env,
    '/storage/v1/object/sign/velvet-media',
    {
      method: 'POST',
      body: JSON.stringify({ expiresIn: ttl, paths: uniquePaths })
    },
    session.access_token
  );
  const payload = await response.json().catch(() => []);

  if (response.ok && Array.isArray(payload)) {
    payload.forEach((item, index) => {
      const path = String(item?.path || uniquePaths[index] || '');
      if (path && item?.signedURL) urls.set(path, mediaUrl(env, String(item.signedURL)));
    });
  }

  // Le seul secours individuel autorisé reste celui des agents IA internes.
  // En production, un échec de signature en lot ne déclenche jamais N sous-requêtes.
  for (const path of uniquePaths) {
    if (urls.has(path) || !canUseInternalMediaFallback(env, path)) continue;
    const fallback = await signedInternalMediaUrl(env, path, ttl, null);
    if (fallback) urls.set(path, fallback);
  }
  return urls;
}

export async function signedEphemeralMediaUrl(env, session, path, expiresIn = 60) {
  if (!String(path || '').startsWith(EPHEMERAL_PREFIX)) return null;
  // Même après ouverture, l'URL reste très courte et ne doit jamais être mise en cache durablement.
  return signMedia(env, session, path, Math.max(60, Math.min(120, Number(expiresIn) || 60)), null);
}

function collectMediaPaths(profiles = []) {
  const paths = [];
  for (const profile of profiles || []) {
    for (const media of profile?.media_assets || []) if (media?.storage_path) paths.push(media.storage_path);
    for (const album of profile?.albums || []) {
      for (const media of album?.media_assets || []) if (media?.storage_path) paths.push(media.storage_path);
    }
  }
  return paths;
}

function attachPreviewUrls(profile, urls) {
  if (!profile) return profile;
  const mediaAssets = (profile.media_assets || []).map((media) => ({
    ...media,
    previewUrl: urls.get(String(media.storage_path || '')) || null
  }));
  const albums = (profile.albums || []).map((album) => ({
    ...album,
    media_assets: (album.media_assets || []).map((media) => ({
      ...media,
      previewUrl: urls.get(String(media.storage_path || '')) || null
    }))
  }));
  return { ...profile, media_assets: mediaAssets, albums };
}

export async function enrichProfileMedia(env, session, profile) {
  if (!profile) return profile;
  const urls = await signedMediaUrls(env, session, collectMediaPaths([profile]));
  return attachPreviewUrls(profile, urls);
}

export async function enrichProfilesMedia(env, session, profiles = []) {
  const rows = profiles || [];
  if (!rows.length) return [];
  const urls = await signedMediaUrls(env, session, collectMediaPaths(rows));
  return rows.map((profile) => attachPreviewUrls(profile, urls));
}
