import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    return withSession({
      publicKey: cleanText(env.VAPID_PUBLIC_KEY, 500) || null,
      installationOrigin: new URL(request.url).origin,
      reenrollOnDomainMigration: true,
      note: 'Lors du passage au domaine privé, chaque appareil devra autoriser de nouveau les notifications.'
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'push_configuration_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const endpoint = cleanText(body.endpoint, 4000);
    if (!endpoint.startsWith('https://')) {
      return withSession({ error: 'invalid_push_subscription' }, access.session, 400);
    }
    await restJson(
      env,
      '/rest/v1/browser_push_subscriptions?on_conflict=endpoint',
      access.session,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: access.account.userId,
          endpoint,
          p256dh: cleanText(body.keys?.p256dh, 500),
          auth_secret: cleanText(body.keys?.auth, 500),
          user_agent: cleanText(request.headers.get('user-agent'), 500),
          last_seen_at: new Date().toISOString(),
          revoked_at: null
        })
      }
    );
    await restJson(
      env,
      '/rest/v1/member_notification_settings?on_conflict=user_id',
      access.session,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: access.account.userId,
          browser_enabled: true
        })
      }
    );
    return withSession({
      ok: true,
      installationOrigin: cleanText(body.installationOrigin, 500) || new URL(request.url).origin,
      reenrollOnDomainMigration: true
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'push_subscription_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const endpoint = new URL(request.url).searchParams.get('endpoint') || '';
    if (!endpoint.startsWith('https://')) {
      return withSession({ error: 'invalid_push_subscription' }, access.session, 400);
    }
    await restJson(
      env,
      `/rest/v1/browser_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_id=eq.${encodeURIComponent(access.account.userId)}`,
      access.session,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
    );
    return withSession({ ok: true }, access.session);
  } catch (error) {
    return json({ error: error.message || 'push_unsubscribe_failed' }, 400);
  }
}
