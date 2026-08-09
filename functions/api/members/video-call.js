import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { deliverMessageNotifications } from './_message-notifications.js';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function turnConfig(env) {
  return {
    keyId: cleanText(env.CLOUDFLARE_TURN_KEY_ID, 200),
    token: cleanText(env.CLOUDFLARE_TURN_API_TOKEN, 500)
  };
}

async function generateIceServers(env) {
  const { keyId, token } = turnConfig(env);
  if (!keyId || !token) return null;
  const roots = [
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate`
  ];
  for (const url of roots) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ ttl: 3600 })
    }).catch(() => null);
    if (!response?.ok) continue;
    const payload = await response.json().catch(() => ({}));
    const servers = payload.iceServers || payload.ice_servers;
    if (Array.isArray(servers) && servers.length) return servers;
  }
  return null;
}

async function accessPeer(env, access, conversationId) {
  const rows = await restJson(env, '/rest/v1/rpc/zwit_v15_video_call_access', access.session, {
    method: 'POST', body: JSON.stringify({ target_conversation_id: conversationId })
  });
  return rows?.[0]?.peer_user_id || null;
}

async function senderContext(env, access, conversationId) {
  const [membership, profile] = await Promise.all([
    restJson(env, `/rest/v1/conversation_members?select=display_identity&conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(access.account.userId)}&left_at=is.null&limit=1`, access.session).catch(() => []),
    restJson(env, `/rest/v1/member_profiles?select=id,display_name,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`, access.session).catch(() => [])
  ]);
  return { identity: membership?.[0]?.display_identity || null, profile: profile?.[0] || null };
}

async function state(env, access, conversationId, afterSignalId = 0) {
  const rows = await restJson(env, '/rest/v1/rpc/zwit_v15_video_call_state', access.session, {
    method: 'POST',
    body: JSON.stringify({
      target_conversation_id: conversationId,
      after_signal_id: Math.max(0, Number(afterSignalId) || 0)
    })
  });
  return rows?.[0] || { call: null, signals: [] };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId') || '';
    if (!validUuid(conversationId)) return withSession({ error: 'invalid_conversation' }, access.session, 400);
    const afterSignalId = Number(url.searchParams.get('afterSignalId') || 0);
    const callState = await state(env, access, conversationId, afterSignalId);
    return withSession({
      ...callState,
      relayConfigured: Boolean(turnConfig(env).keyId && turnConfig(env).token)
    }, access.session);
  } catch (error) {
    return json({ error: cleanText(error.message, 120) || 'video_call_state_failed' }, 400);
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const action = cleanText(body.action, 20);
    const conversationId = String(body.conversationId || '');
    if (!validUuid(conversationId)) return withSession({ error: 'invalid_conversation' }, access.session, 400);

    if (action === 'start') {
      const iceServers = await generateIceServers(env);
      if (!iceServers) return withSession({ error: 'video_relay_not_configured' }, access.session, 503);
      const rows = await restJson(env, '/rest/v1/rpc/zwit_v15_start_video_call', access.session, {
        method: 'POST', body: JSON.stringify({ target_conversation_id: conversationId })
      });
      const call = rows?.[0];
      if (!call?.call_id) throw new Error('video_call_not_created');
      const peerUserId = await accessPeer(env, access, conversationId);
      const notify = senderContext(env, access, conversationId).then(({ identity, profile }) => {
        if (!peerUserId) return null;
        return deliverMessageNotifications(env, {
          recipients: [{ user_id: peerUserId }],
          senderProfile: profile,
          senderIdentity: identity,
          conversationId,
          messageBody: '📹 Appel vidéo entrant'
        });
      }).catch(() => null);
      if (typeof waitUntil === 'function') waitUntil(notify); else await notify;
      return withSession({
        ok: true,
        call: { id: call.call_id, status: call.status, expiresAt: call.expires_at, incoming: false },
        iceServers
      }, access.session, 201);
    }

    if (action === 'accept' || action === 'decline' || action === 'end') {
      const callId = String(body.callId || '');
      if (!validUuid(callId)) return withSession({ error: 'invalid_video_call' }, access.session, 400);
      const iceServers = action === 'accept' ? await generateIceServers(env) : null;
      if (action === 'accept' && !iceServers) return withSession({ error: 'video_relay_not_configured' }, access.session, 503);
      const rows = await restJson(env, '/rest/v1/rpc/zwit_v15_video_call_action', access.session, {
        method: 'POST', body: JSON.stringify({ target_call_id: callId, action })
      });
      const call = rows?.[0];
      return withSession({
        ok: true,
        call: call ? { id: call.call_id, status: call.status, expiresAt: call.expires_at } : null,
        ...(iceServers ? { iceServers } : {})
      }, access.session);
    }

    if (action === 'signal') {
      const callId = String(body.callId || '');
      const kind = cleanText(body.kind, 12);
      if (!validUuid(callId) || !['offer', 'answer', 'ice'].includes(kind) || !body.payload || typeof body.payload !== 'object') {
        return withSession({ error: 'invalid_video_signal' }, access.session, 400);
      }
      const signalId = await restJson(env, '/rest/v1/rpc/zwit_v15_video_call_signal', access.session, {
        method: 'POST', body: JSON.stringify({ target_call_id: callId, target_kind: kind, target_payload: body.payload })
      });
      return withSession({ ok: true, signalId: Array.isArray(signalId) ? signalId[0] : signalId }, access.session, 201);
    }

    return withSession({ error: 'invalid_video_call_action' }, access.session, 400);
  } catch (error) {
    return json({ error: cleanText(error.message, 120) || 'video_call_failed' }, 400);
  }
}
