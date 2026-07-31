import {
  json,
  readJson,
  sessionResponse,
  supabase
} from '../auth/_shared.js';
import {
  authenticationAssuranceLevel,
  requireControlSession
} from './_security.js';

function safeFactorId(value) {
  const text = String(value || '');
  return /^[0-9a-f-]{20,80}$/i.test(text) ? text : null;
}

async function authJson(env, path, session, init = {}) {
  const response = await supabase(env, path, init, session.access_token);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || payload?.error_code || 'mfa_request_failed');
  }
  return payload;
}

async function factorState(env, access) {
  const user = await authJson(env, '/auth/v1/user', access.session);
  const factors = Array.isArray(user?.factors) ? user.factors : [];
  return {
    aal: authenticationAssuranceLevel(access.session),
    requiredAal: 'aal2',
    verifiedFactors: factors
      .filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified')
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name || 'Velvet Control',
        createdAt: factor.created_at,
        updatedAt: factor.updated_at
      })),
    unverifiedFactors: factors
      .filter((factor) => factor.factor_type === 'totp' && factor.status !== 'verified')
      .map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name || 'Velvet Control' }))
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await requireControlSession(request, env, { allowAal1: true });
    if (access.response) return access.response;
    return sessionResponse({
      ok: true,
      ...(await factorState(env, access))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'mfa_status_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await requireControlSession(request, env, { allowAal1: true });
    if (access.response) return access.response;
    const body = await readJson(request);

    if (body.action === 'enroll') {
      const enrolled = await authJson(env, '/auth/v1/factors', access.session, {
        method: 'POST',
        body: JSON.stringify({
          factor_type: 'totp',
          friendly_name: 'Velvet Control'
        })
      });
      const factorId = safeFactorId(enrolled?.id);
      if (!factorId) throw new Error('mfa_factor_invalid');
      const challenge = await authJson(
        env,
        `/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`,
        access.session,
        { method: 'POST', body: '{}' }
      );
      return sessionResponse({
        ok: true,
        factorId,
        challengeId: challenge.id,
        qrCode: enrolled?.totp?.qr_code || null,
        secret: enrolled?.totp?.secret || null,
        uri: enrolled?.totp?.uri || null
      }, access.session, 201);
    }

    if (body.action === 'challenge') {
      const factorId = safeFactorId(body.factorId);
      if (!factorId) return sessionResponse({ error: 'mfa_factor_required' }, access.session, 400);
      const challenge = await authJson(
        env,
        `/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`,
        access.session,
        { method: 'POST', body: '{}' }
      );
      return sessionResponse({ ok: true, factorId, challengeId: challenge.id }, access.session);
    }

    if (body.action === 'verify') {
      const factorId = safeFactorId(body.factorId);
      const challengeId = safeFactorId(body.challengeId);
      const code = String(body.code || '').replace(/\s/g, '');
      if (!factorId || !challengeId || !/^\d{6}$/.test(code)) {
        return sessionResponse({ error: 'valid_mfa_code_required' }, access.session, 400);
      }
      const verified = await authJson(
        env,
        `/auth/v1/factors/${encodeURIComponent(factorId)}/verify`,
        access.session,
        {
          method: 'POST',
          body: JSON.stringify({ challenge_id: challengeId, code })
        }
      );
      if (!verified.access_token || !verified.refresh_token) {
        throw new Error('mfa_session_upgrade_failed');
      }
      return sessionResponse({
        ok: true,
        aal: authenticationAssuranceLevel(verified),
        requiredAal: 'aal2'
      }, verified);
    }

    return sessionResponse({ error: 'invalid_mfa_action' }, access.session, 400);
  } catch (error) {
    return json({ error: error.message || 'mfa_action_failed' }, 400);
  }
}
