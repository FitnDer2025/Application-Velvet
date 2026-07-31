const encoder = new TextEncoder();

function clean(value, max = 1000) {
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
  const url = clean(env.SUPABASE_URL).replace(/\/$/, '');
  const key = clean(env.SUPABASE_SERVICE_ROLE_KEY, 4000);
  if (!url || !key) throw new Error('service_role_not_configured');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.code || 'service_request_failed');
  return payload;
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
  const header = base64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64Url(encoder.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
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
  const body = await encryptWebPush(subscription, payload);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidAuthorization(env, subscription.endpoint),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: '3600',
      urgency: 'normal'
    },
    body
  });
  if (!response.ok) {
    const error = new Error(`web_push_${response.status}`);
    error.permanent = response.status === 404 || response.status === 410;
    throw error;
  }
}

export async function deliverBrowserActivity(env, {
  userIds,
  eventType,
  title,
  body,
  tag,
  navigate,
  image,
  profileId,
  conversationId,
  eventId
}) {
  const recipients = [...new Set((userIds || []).filter(Boolean))];
  if (!recipients.length || !env.SUPABASE_SERVICE_ROLE_KEY) return { sent: 0 };
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { sent: 0, configured: false };

  const filter = recipients.join(',');
  const [settingsRows, subscriptions] = await Promise.all([
    serviceRest(
      env,
      `/rest/v1/member_notification_settings?select=user_id,event_types,browser_enabled&user_id=in.(${filter})`
    ).catch(() => []),
    serviceRest(
      env,
      `/rest/v1/browser_push_subscriptions?select=id,user_id,endpoint,p256dh,auth_secret&user_id=in.(${filter})&revoked_at=is.null`
    ).catch(() => [])
  ]);
  const settings = new Map((settingsRows || []).map((row) => [row.user_id, row]));
  let sent = 0;

  await Promise.all((subscriptions || []).map(async (subscription) => {
    const preference = settings.get(subscription.user_id);
    if (preference?.browser_enabled === false) return;
    if (preference?.event_types?.[eventType] === false) return;
    try {
      await sendWebPush(env, subscription, {
        notification: {
          title: clean(title, 140) || 'Velvet',
          body: clean(body, 220) || 'Une nouvelle activité vous attend.',
          icon: '/assets/velvet-icon-192.png',
          badge: '/assets/velvet-icon-192.png',
          image: image || undefined,
          tag: clean(tag, 180) || `velvet-${eventType}`,
          navigate: navigate || '/membres/?route=notifications',
          requireInteraction: false
        },
        route: eventType,
        profileId: profileId || null,
        conversationId: conversationId || null,
        eventId: eventId || null
      });
      sent += 1;
    } catch (error) {
      if (error.permanent) {
        await serviceRest(env, `/rest/v1/browser_push_subscriptions?id=eq.${subscription.id}`, {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ revoked_at: new Date().toISOString() })
        }).catch(() => null);
      }
    }
  }));

  return { sent, configured: true };
}
