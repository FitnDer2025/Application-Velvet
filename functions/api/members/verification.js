import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from './_shared.js';

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readVerification(env, access) {
  const [verificationRows, profileRows] = await Promise.all([
    restJson(
      env,
      `/rest/v1/account_identity_age_verifications?select=user_id,provider,status,identity_verified,majority_verified,verified_at,expires_at,last_checked_at,updated_at&user_id=eq.${encodeURIComponent(access.account.userId)}&limit=1`,
      access.session
    ),
    restJson(
      env,
      `/rest/v1/member_profiles?select=id,verification_status,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
      access.session
    )
  ]);

  const row = verificationRows?.[0] || null;
  const profile = profileRows?.[0] || null;
  return {
    verification: row || {
      user_id: access.account.userId,
      provider: null,
      status: 'not_started',
      identity_verified: false,
      majority_verified: false,
      verified_at: null,
      expires_at: null,
      last_checked_at: null,
      updated_at: null
    },
    profileVerificationStatus: profile?.verification_status || 'not_started',
    providerConfigured: Boolean(env.IDENTITY_AGE_VERIFICATION_START_URL),
    documentsStoredByVelvet: false,
    accessBlockedByVerification: false
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    return withSession(await readVerification(env, access), access.session);
  } catch (error) {
    return json({ error: error.message || 'verification_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    if (!env.IDENTITY_AGE_VERIFICATION_START_URL) {
      return withSession({ error: 'verification_provider_not_configured' }, access.session, 503);
    }

    const body = await readJson(request);
    const returnPath = cleanText(body.returnPath, 500).startsWith('/')
      ? cleanText(body.returnPath, 500)
      : '/membres/';
    const provider = cleanText(env.IDENTITY_AGE_VERIFICATION_PROVIDER, 120) || 'external';
    const state = randomState();
    const stateHash = await sha256Hex(state);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await restJson(
      env,
      '/rest/v1/external_verification_sessions',
      access.session,
      {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: access.account.userId,
          provider,
          state_hash: stateHash,
          status: 'created',
          return_path: returnPath,
          expires_at: expiresAt
        })
      }
    );

    const startUrl = new URL(env.IDENTITY_AGE_VERIFICATION_START_URL);
    startUrl.searchParams.set('state', state);
    startUrl.searchParams.set('return_url', `${new URL(request.url).origin}/api/members/verification/callback`);

    return withSession({
      ok: true,
      startUrl: startUrl.toString(),
      expiresAt,
      provider,
      documentsStoredByVelvet: false
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'verification_start_failed' }, 400);
  }
}

export async function onRequestCallback({ request }) {
  return json({
    error: 'verification_provider_adapter_required',
    message: 'Le callback sera finalisé avec le contrat technique du prestataire choisi.'
  }, 501);
}
