import {
  clearRefreshCookie,
  json,
  readJson
} from '../auth/_shared.js';
import { memberSession } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    if (body.confirmation !== 'SUPPRIMER') {
      return json({ error: 'account_deletion_confirmation_required' }, 400);
    }

    const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
    if (!url || !serviceKey) {
      return json({ error: 'account_deletion_not_configured' }, 503);
    }

    const response = await fetch(
      `${url}/auth/v1/admin/users/${encodeURIComponent(access.account.userId)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ should_soft_delete: false })
      }
    );
    if (!response.ok) {
      return json({ error: 'account_deletion_failed' }, 400);
    }
    return json(
      { ok: true, deleted: true },
      200,
      { 'set-cookie': clearRefreshCookie() }
    );
  } catch (error) {
    return json({ error: error.message || 'account_deletion_failed' }, 400);
  }
}
