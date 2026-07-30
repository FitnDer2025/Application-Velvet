import { json, readJson } from '../auth/_shared.js';
import {
  memberAccessState,
  memberSession,
  monetizationMigrationMissing,
  restJson,
  withSession
} from '../members/_shared.js';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const code = String(body.code || '').replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9-]{6,40}$/.test(code)) {
      return withSession({ error: 'promotion_invalid' }, access.session, 400);
    }
    try {
      const result = await restJson(
        env,
        '/rest/v1/rpc/redeem_my_promotion',
        access.session,
        {
          method: 'POST',
          body: JSON.stringify({ target_code_hash: await sha256(code) })
        }
      );
      return withSession({ ok: true, access: result }, access.session);
    } catch (error) {
      if (monetizationMigrationMissing(error)) {
        return withSession({
          error: 'monetization_migration_required',
          access: await memberAccessState(env, access)
        }, access.session, 503);
      }
      throw error;
    }
  } catch (error) {
    return json({ error: error.message || 'promotion_redemption_failed' }, 400);
  }
}
