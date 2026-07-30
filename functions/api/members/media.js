import { supabase } from '../auth/_shared.js';

export async function signedMediaUrl(env, session, path, expiresIn = 600) {
  if (!path) return null;
  const ttl = Math.max(60, Math.min(3600, Number(expiresIn) || 600));
  const response = await supabase(
    env,
    `/storage/v1/object/sign/velvet-media/${path}`,
    {
      method: 'POST',
      body: JSON.stringify({ expiresIn: ttl })
    },
    session.access_token
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.signedURL) return null;
  const supabaseBase = String(env.SUPABASE_URL).replace(/\/$/, '');
  const signedPath = String(payload.signedURL);
  if (/^https?:\/\//i.test(signedPath)) return signedPath;
  if (signedPath.startsWith('/storage/v1/')) {
    return new URL(signedPath, `${supabaseBase}/`).toString();
  }
  return new URL(
    signedPath.replace(/^\/+/, ''),
    `${supabaseBase}/storage/v1/`
  ).toString();
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
