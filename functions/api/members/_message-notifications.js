const encoder = new TextEncoder();
let cachedApnsToken = null;
let cachedApnsTokenExpiresAt = 0;

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function base64Url(bytes) {
  const source = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes);
  let binary = '';
  for (const byte of source) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function concat(...parts) {
  const arrays = parts.map((part) => part instanceof Uint8Array ? part : new Uint8Array(part));
  const result = new Uint8Array(arrays.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  arrays.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

async function serviceRest(env, path, init = {}) {
  const url = clean(env.SUPABASE_URL, 1000).replace(/\/$/, '');
  const key = clean(env.SUPABASE_SERVICE_ROLE_KEY, 4000);
  if (!url || !key) throw new Error('service_role_not_configured');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || payload?.code || 'service_request_failed');
  }
  return payload;
}

function pemBytes(value) {
  const source = String(value || '').replace(/\\n/g, '\n');
  const base64 = source
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function apnsJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsToken && cachedApnsTokenExpiresAt > now + 60) return cachedApnsToken;
  const keyId = clean(env.APNS_KEY_ID, 20);
  const teamId = clean(env.APNS_TEAM_ID, 20);
  const privateKey = clean(env.APNS_PRIVATE_KEY, 10000);
  if (!keyId || !teamId || !privateKey) throw new Error('apns_not_configured');
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'ES256', kid: keyId })));
  const claims = base64Url(encoder.encode(JSON.stringify({ iss: teamId, iat: now })));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(`${header}.${claims}`)
  );
  cachedApnsToken = `${header}.${claims}.${base64Url(signature)}`;
  cachedApnsTokenExpiresAt = now + 45 * 60;
  return cachedApnsToken;
}

async function sendApns(env, device, payload) {
  const token = await apnsJwt(env);
  const host = device.environment === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
  const response = await fetch(`${host}/3/device/${device.token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${token}`,
      'apns-topic': device.bundle_id,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const error = new Error(detail.reason || `apns_${response.status}`);
    error.permanent = response.status === 410 || ['BadDeviceToken', 'Unregistered'].includes(detail.reason);
    throw error;
  }
}

async function hkdf(ikm, salt, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: 'HKDF',
    hash: 'SHA-256',
    salt,
    info
  }, key, length * 8));
}

async function vapidAuthorization(env, endpoint) {
  const publicKey = decodeBase64Url(env.VAPID_PUBLIC_KEY);
  const privateKey = decodeBase64Url(env.VAPID_PRIVATE_KEY);
  if (publicKey.length !== 65 || privateKey.length !== 32 || publicKey[0] !== 4) {
    throw new Error('vapid_not_configured');
  }
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC',
    crv: 'P-256',
    x: base64Url(publicKey.slice(1, 33)),
    y: base64Url(publicKey.slice(33, 65)),
    d: base64Url(privateKey),
    ext: true,
    key_ops: ['sign']
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const audience = new URL(endpoint).origin;
  const header = base64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64Url(encoder.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: clean(env.VAPID_SUBJECT, 300) || 'mailto:contact@velvet-app.fr'
  })));
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(`${header}.${claims}`)
  );
  return `vapid t=${header}.${claims}.${base64Url(signature)}, k=${clean(env.VAPID_PUBLIC_KEY, 500)}`;
}

async function encryptWebPush(subscription, payload) {
  const userPublic = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth_secret);
  if (userPublic.length !== 65 || authSecret.length < 16) throw new Error('invalid_push_subscription');

  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const importedUserKey = await crypto.subtle.importKey(
    'raw',
    userPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({
    name: 'ECDH',
    public: importedUserKey
  }, ephemeral.privateKey, 256));
  const keyInfo = concat(encoder.encode('WebPush: info\0'), userPublic, serverPublic);
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(ikm, salt, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, encoder.encode('Content-Encoding: nonce\0'), 12);
  const plaintext = concat(encoder.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    plaintext
  ));
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([serverPublic.length]), serverPublic, ciphertext);
}

async function sendWebPush(env, subscription, payload) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error('vapid_not_configured');
  const body = await encryptWebPush(subscription, payload);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidAuthorization(env, subscription.endpoint),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: '3600',
      urgency: 'high'
    },
    body
  });
  if (!response.ok) {
    const error = new Error(`web_push_${response.status}`);
    error.permanent = response.status === 404 || response.status === 410;
    throw error;
  }
}

function messagesEnabled(settings) {
  return settings?.event_types?.messages !== false;
}

function preview(value) {
  const text = clean(value, 240).replace(/\s+/g, ' ');
  return text || 'Vous avez reçu une nouvelle pièce jointe.';
}

export async function deliverMessageNotifications(env, {
  recipients,
  senderProfile,
  senderIdentity,
  conversationId,
  messageBody
}) {
  const userIds = [...new Set((recipients || []).map((row) => row.user_id).filter(Boolean))];
  if (!userIds.length) return { recipients: 0, notifications: 0, apns: 0, webPush: 0 };
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { recipients: userIds.length, notifications: 0, apns: 0, webPush: 0, configured: false };
  }

  const filter = userIds.join(',');
  const [settingsRows, devices, subscriptions] = await Promise.all([
    serviceRest(env, `/rest/v1/member_notification_settings?select=user_id,event_types,in_app_enabled,browser_enabled,quiet_hours_start,quiet_hours_end&user_id=in.(${filter})`).catch(() => []),
    serviceRest(env, `/rest/v1/member_push_devices?select=id,user_id,token,environment,bundle_id&user_id=in.(${filter})&active=is.true`).catch(() => []),
    serviceRest(env, `/rest/v1/browser_push_subscriptions?select=id,user_id,endpoint,p256dh,auth_secret&user_id=in.(${filter})&revoked_at=is.null`).catch(() => [])
  ]);
  const settingsByUser = new Map((settingsRows || []).map((row) => [row.user_id, row]));
  const eligible = userIds.filter((userId) => messagesEnabled(settingsByUser.get(userId)));
  const author = clean(senderIdentity, 120) || clean(senderProfile?.display_name, 120) || 'Un membre Zwit';
  const title = `${author} vous a écrit`;
  const body = preview(messageBody);
  const metadata = {
    conversationId,
    senderProfileId: senderProfile?.id || null,
    senderIdentity: author
  };
  const notificationRows = eligible
    .filter((userId) => settingsByUser.get(userId)?.in_app_enabled !== false)
    .map((userId) => ({
      user_id: userId,
      actor_profile_id: senderProfile?.id || null,
      event_type: 'messages',
      entity_type: 'conversation',
      entity_id: conversationId,
      title,
      body,
      metadata
    }));
  if (notificationRows.length) {
    await serviceRest(env, '/rest/v1/member_notifications', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(notificationRows)
    }).catch(() => null);
  }

  const unreadRows = await serviceRest(
    env,
    `/rest/v1/member_notifications?select=user_id&id=not.is.null&read_at=is.null&archived_at=is.null&user_id=in.(${filter})`
  ).catch(() => []);
  const badgeByUser = new Map();
  (unreadRows || []).forEach((row) => badgeByUser.set(
    row.user_id,
    Number(badgeByUser.get(row.user_id) || 0) + 1
  ));

  let apnsSent = 0;
  let webPushSent = 0;
  const destination = `/membres/?route=conversations&conversation=${encodeURIComponent(conversationId)}`;
  await Promise.all([
    ...(devices || [])
      .filter((device) => eligible.includes(device.user_id))
      .map(async (device) => {
        try {
          await sendApns(env, device, {
            aps: {
              alert: { title, body },
              sound: 'default',
              badge: badgeByUser.get(device.user_id) || 1,
              'thread-id': conversationId,
              category: 'VELVET_MESSAGE'
            },
            route: 'messages',
            conversationId,
            senderProfileId: senderProfile?.id || null,
            senderIdentity: author
          });
          apnsSent += 1;
        } catch (error) {
          if (error.permanent) {
            await serviceRest(env, `/rest/v1/member_push_devices?id=eq.${device.id}`, {
              method: 'PATCH',
              headers: { prefer: 'return=minimal' },
              body: JSON.stringify({ active: false, updated_at: new Date().toISOString() })
            }).catch(() => null);
          }
        }
      }),
    ...(subscriptions || [])
      .filter((subscription) =>
        eligible.includes(subscription.user_id)
        && settingsByUser.get(subscription.user_id)?.browser_enabled !== false
      )
      .map(async (subscription) => {
        try {
          await sendWebPush(env, subscription, {
            notification: {
              title,
              body,
              icon: '/assets/velvet-icon-192.png',
              badge: '/assets/velvet-icon-192.png',
              tag: `velvet-message-${conversationId}`,
              navigate: destination,
              requireInteraction: false
            },
            route: 'messages',
            conversationId,
            senderProfileId: senderProfile?.id || null,
            senderIdentity: author
          });
          webPushSent += 1;
        } catch (error) {
          if (error.permanent) {
            await serviceRest(env, `/rest/v1/browser_push_subscriptions?id=eq.${subscription.id}`, {
              method: 'PATCH',
              headers: { prefer: 'return=minimal' },
              body: JSON.stringify({ revoked_at: new Date().toISOString() })
            }).catch(() => null);
          }
        }
      })
  ]);

  return {
    recipients: eligible.length,
    notifications: notificationRows.length,
    apns: apnsSent,
    webPush: webPushSent,
    configured: true
  };
}
