import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  internalRecipeBypass,
  memberSession,
  restJson,
  verificationGateEnabled,
  withSession
} from './_shared.js';

const CALLBACK_WINDOW_MS = 10 * 60 * 1000;
const MAX_VERIFICATION_VALIDITY_MS = 2 * 365 * 24 * 60 * 60 * 1000;

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

function providerConfigured(env) {
  return Boolean(
    env.IDENTITY_AGE_VERIFICATION_START_URL
    && env.IDENTITY_AGE_VERIFICATION_CALLBACK_SECRET
    && env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function safeReturnPath(value) {
  const path = cleanText(value, 500);
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
    ? path
    : '/membres/';
}

function serviceHeaders(env, extra = {}) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!env.SUPABASE_URL || !key) throw new Error('verification_service_not_configured');
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    ...extra
  };
}

async function serviceJson(env, path, init = {}) {
  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}${path}`, {
    ...init,
    headers: serviceHeaders(env, init.headers)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.code || 'verification_service_request_failed');
  }
  return payload;
}

function hexBytes(value) {
  if (!/^[0-9a-f]{64}$/i.test(String(value || ''))) return null;
  return new Uint8Array(String(value).match(/.{2}/g).map((pair) => Number.parseInt(pair, 16)));
}

export function callbackCanonicalPayload(input) {
  return [
    input.state,
    input.result,
    input.identityVerified ? 'true' : 'false',
    input.majorityVerified ? 'true' : 'false',
    input.reference,
    input.expiresAt,
    input.eventId,
    input.issuedAt
  ].map((value) => encodeURIComponent(String(value || ''))).join('\n');
}

export async function signCallbackPayload(secret, input) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(callbackCanonicalPayload(input))
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyCallbackSignature(secret, input, signature) {
  const received = hexBytes(signature);
  if (!received) return false;
  const expected = hexBytes(await signCallbackPayload(secret, input));
  if (!expected || received.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < received.length; index += 1) {
    mismatch |= received[index] ^ expected[index];
  }
  return mismatch === 0;
}

function readCallback(request) {
  const url = new URL(request.url);
  const result = cleanText(url.searchParams.get('result'), 24).toLowerCase();
  const identityVerified = url.searchParams.get('identity_verified') === 'true';
  const majorityVerified = url.searchParams.get('majority_verified') === 'true';
  return {
    state: cleanText(url.searchParams.get('state'), 128),
    result,
    identityVerified,
    majorityVerified,
    reference: cleanText(url.searchParams.get('reference'), 500),
    expiresAt: cleanText(url.searchParams.get('expires_at'), 80),
    eventId: cleanText(url.searchParams.get('event_id'), 200),
    issuedAt: cleanText(url.searchParams.get('issued_at'), 80),
    signature: cleanText(
      request.headers.get('x-velvet-verification-signature')
        || url.searchParams.get('signature'),
      128
    )
  };
}

function validateCallback(input) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(input.state)) throw new Error('verification_callback_invalid');
  if (!['verified', 'failed', 'rejected', 'expired'].includes(input.result)) {
    throw new Error('verification_callback_invalid');
  }
  if (!input.eventId || !input.issuedAt) throw new Error('verification_callback_invalid');
  const issuedAt = new Date(input.issuedAt).getTime();
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > CALLBACK_WINDOW_MS) {
    throw new Error('verification_callback_expired');
  }
  if (input.result === 'verified') {
    const expiresAt = new Date(input.expiresAt).getTime();
    if (!input.identityVerified || !input.majorityVerified
      || !input.reference
      || !Number.isFinite(expiresAt)
      || expiresAt <= Date.now()
      || expiresAt > Date.now() + MAX_VERIFICATION_VALIDITY_MS) {
      throw new Error('verification_callback_invalid');
    }
  }
}

async function recordAudit(env, userId, action, metadata = {}) {
  await serviceJson(env, '/rest/v1/audit_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      actor_user_id: userId,
      actor_type: 'system',
      action,
      entity_type: 'identity_age_verification',
      entity_id: userId,
      metadata
    })
  }).catch(() => null);
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
  const expiresAt = row?.expires_at ? new Date(row.expires_at).getTime() : null;
  const verified = row?.status === 'verified'
    && row.identity_verified === true
    && row.majority_verified === true
    && (!Number.isFinite(expiresAt) || expiresAt > Date.now());
  const gateEnabled = verificationGateEnabled(env);
  const bypassedForInternalRecipe = internalRecipeBypass(env, access.account.userId);
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
    providerConfigured: providerConfigured(env),
    documentsStoredByVelvet: false,
    verificationRequired: gateEnabled,
    bypassedForInternalRecipe,
    accessBlockedByVerification: gateEnabled && !verified && !bypassedForInternalRecipe
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env, { allowUnverified: true });
    if (access.response) return access.response;
    return withSession(await readVerification(env, access), access.session);
  } catch (error) {
    return json({ error: error.message || 'verification_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env, { allowUnverified: true });
    if (access.response) return access.response;
    if (!providerConfigured(env)) {
      return withSession({ error: 'verification_provider_not_configured' }, access.session, 503);
    }

    const body = await readJson(request);
    const returnPath = safeReturnPath(body.returnPath);
    const provider = cleanText(env.IDENTITY_AGE_VERIFICATION_PROVIDER, 120) || 'external';
    const state = randomState();
    const stateHash = await sha256Hex(state);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await serviceJson(
      env,
      '/rest/v1/external_verification_sessions',
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

    await serviceJson(env, '/rest/v1/account_identity_age_verifications?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: access.account.userId,
        provider,
        status: 'pending',
        identity_verified: false,
        majority_verified: false,
        provider_reference_hash: null,
        verified_at: null,
        expires_at: null,
        last_checked_at: new Date().toISOString()
      })
    });
    await recordAudit(env, access.account.userId, 'verification_started', { provider });

    const startUrl = new URL(env.IDENTITY_AGE_VERIFICATION_START_URL);
    if (startUrl.protocol !== 'https:') throw new Error('verification_provider_url_invalid');
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

export async function onRequestCallback({ request, env }) {
  try {
    if (!providerConfigured(env)) throw new Error('verification_provider_not_configured');
    const callback = readCallback(request);
    validateCallback(callback);
    const validSignature = await verifyCallbackSignature(
      env.IDENTITY_AGE_VERIFICATION_CALLBACK_SECRET,
      callback,
      callback.signature
    );
    if (!validSignature) throw new Error('verification_callback_signature_invalid');

    const stateHash = await sha256Hex(callback.state);
    const sessions = await serviceJson(
      env,
      `/rest/v1/external_verification_sessions?select=id,user_id,provider,status,return_path,expires_at&state_hash=eq.${stateHash}&limit=1`
    );
    const session = sessions?.[0];
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
      throw new Error('verification_session_expired');
    }
    if (session.provider !== (cleanText(env.IDENTITY_AGE_VERIFICATION_PROVIDER, 120) || 'external')) {
      throw new Error('verification_provider_mismatch');
    }

    const successful = callback.result === 'verified'
      && callback.identityVerified
      && callback.majorityVerified;
    if (!['created', 'redirected'].includes(session.status)) {
      const repeated = new URL(safeReturnPath(session.return_path), request.url);
      repeated.searchParams.set('verification', session.status === 'completed' ? 'success' : 'failed');
      return Response.redirect(repeated.toString(), 303);
    }

    const checkedAt = new Date().toISOString();
    await serviceJson(env, '/rest/v1/account_identity_age_verifications?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: session.user_id,
        provider: session.provider,
        status: successful ? 'verified' : callback.result === 'expired' ? 'expired' : 'failed',
        identity_verified: successful,
        majority_verified: successful,
        provider_reference_hash: callback.reference ? await sha256Hex(callback.reference) : null,
        verified_at: successful ? checkedAt : null,
        expires_at: successful ? callback.expiresAt : null,
        last_checked_at: checkedAt
      })
    });
    await serviceJson(
      env,
      `/rest/v1/external_verification_sessions?id=eq.${encodeURIComponent(session.id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: successful ? 'completed' : 'failed',
          completed_at: checkedAt
        })
      }
    );
    await recordAudit(
      env,
      session.user_id,
      successful ? 'verification_completed' : 'verification_failed',
      {
        provider: session.provider,
        event_hash: await sha256Hex(callback.eventId),
        result: callback.result
      }
    );

    const destination = new URL(safeReturnPath(session.return_path), request.url);
    destination.searchParams.set('verification', successful ? 'success' : 'failed');
    return Response.redirect(destination.toString(), 303);
  } catch (error) {
    return json({ error: error.message || 'verification_callback_failed' }, 400, {
      'cache-control': 'no-store'
    });
  }
}
