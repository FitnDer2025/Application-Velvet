import { json, readJson } from '../auth/_shared.js';
import { memberSession, restJson, withSession } from './_shared.js';

const TOKEN = /^[0-9a-f]{64,256}$/i;
const ENVIRONMENTS = new Set(['sandbox', 'production']);

function clean(value, max = 180) {
  return String(value || '').trim().slice(0, max);
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const devices = await restJson(
      env,
      `/rest/v1/member_push_devices?select=id,device_id,platform,environment,bundle_id,app_version,locale,active,last_registered_at&user_id=eq.${encodeURIComponent(access.account.userId)}&active=is.true&order=last_registered_at.desc`,
      access.session
    );
    return withSession({ devices: devices || [] }, access.session);
  } catch (error) {
    return json({ error: error.message || 'push_devices_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const token = clean(body.token, 256).toLowerCase();
    const deviceId = clean(body.deviceId, 180);
    const environment = clean(body.environment, 20);
    const bundleId = clean(body.bundleId, 180);
    const platform = clean(body.platform, 20);

    if (
      platform !== 'ios'
      || !TOKEN.test(token)
      || deviceId.length < 8
      || !ENVIRONMENTS.has(environment)
      || !/^com\.[a-z0-9.-]+$/i.test(bundleId)
    ) {
      return withSession({ error: 'invalid_push_device' }, access.session, 400);
    }

    const rows = await restJson(
      env,
      '/rest/v1/member_push_devices?on_conflict=user_id,device_id&select=id,device_id,platform,environment,bundle_id,active,last_registered_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          user_id: access.account.userId,
          device_id: deviceId,
          platform,
          token,
          environment,
          bundle_id: bundleId,
          app_version: clean(body.appVersion, 40) || null,
          locale: clean(body.locale, 40) || null,
          active: true,
          last_registered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );
    const device = rows?.[0];
    if (!device?.id) throw new Error('push_device_persistence_failed');
    return withSession({ ok: true, device }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'push_device_registration_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const token = clean(new URL(request.url).searchParams.get('token'), 256).toLowerCase();
    if (!TOKEN.test(token)) {
      return withSession({ error: 'invalid_push_device' }, access.session, 400);
    }
    await restJson(
      env,
      `/rest/v1/member_push_devices?user_id=eq.${encodeURIComponent(access.account.userId)}&token=eq.${encodeURIComponent(token)}`,
      access.session,
      {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({
          active: false,
          updated_at: new Date().toISOString()
        })
      }
    );
    return withSession({ ok: true }, access.session);
  } catch (error) {
    return json({ error: error.message || 'push_device_unregister_failed' }, 400);
  }
}

