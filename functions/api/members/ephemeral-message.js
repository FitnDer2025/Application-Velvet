import { json, readJson, supabase } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { deliverMessageNotifications } from './_message-notifications.js';
import { signedEphemeralMediaUrl } from './media.js';

const TYPES = new Map([
  ['image/jpeg', { mediaType: 'image', extension: 'jpg', max: 10 * 1024 * 1024 }],
  ['image/png', { mediaType: 'image', extension: 'png', max: 10 * 1024 * 1024 }],
  ['image/webp', { mediaType: 'image', extension: 'webp', max: 10 * 1024 * 1024 }],
  ['video/mp4', { mediaType: 'video', extension: 'mp4', max: 50 * 1024 * 1024 }],
  ['video/webm', { mediaType: 'video', extension: 'webm', max: 50 * 1024 * 1024 }],
  ['video/quicktime', { mediaType: 'video', extension: 'mov', max: 50 * 1024 * 1024 }]
]);

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function ownMembership(env, access, conversationId) {
  const rows = await restJson(
    env,
    `/rest/v1/conversation_members?select=conversation_id,user_id,display_identity&conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(access.account.userId)}&left_at=is.null&limit=1`,
    access.session
  );
  return rows?.[0] || null;
}

async function activeMembers(env, access, conversationId) {
  return restJson(
    env,
    `/rest/v1/conversation_members?select=user_id,display_identity&conversation_id=eq.${encodeURIComponent(conversationId)}&left_at=is.null&order=joined_at.asc`,
    access.session
  ).catch(() => []);
}

async function senderProfile(env, access) {
  const rows = await restJson(
    env,
    `/rest/v1/member_profiles?select=id,display_name,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
    access.session
  ).catch(() => []);
  return rows?.[0] || null;
}

async function deleteStoredFile(env, session, path) {
  if (!path) return;
  await supabase(env, `/storage/v1/object/velvet-media/${path}`, { method: 'DELETE' }, session.access_token).catch(() => null);
}

async function rollbackMessage(env, session, messageId, conversationId) {
  if (!messageId) return;
  await restJson(
    env,
    `/rest/v1/messages?id=eq.${encodeURIComponent(messageId)}&conversation_id=eq.${encodeURIComponent(conversationId)}`,
    session,
    { method: 'DELETE', headers: { prefer: 'return=minimal' } }
  ).catch(() => null);
}

export async function onRequestPost({ request, env, waitUntil }) {
  let uploadedPath = '';
  let createdMessageId = '';
  let conversationId = '';
  let cleanupSession = null;
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    cleanupSession = access.session;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return withSession({ error: 'ephemeral_multipart_required' }, access.session, 400);
    }

    const form = await request.formData();
    conversationId = String(form.get('conversationId') || '');
    const file = form.get('media');
    const mode = form.get('mode') === 'expires' ? 'expires' : 'view_once';
    const requestedMinutes = Math.round(Number(form.get('expiresMinutes') || 10));
    const expiresMinutes = mode === 'view_once' ? 24 * 60 : Math.max(5, Math.min(24 * 60, requestedMinutes));
    if (!validUuid(conversationId)) return withSession({ error: 'invalid_conversation' }, access.session, 400);
    if (!(file instanceof File) || !file.size) return withSession({ error: 'ephemeral_media_required' }, access.session, 400);
    const type = TYPES.get(file.type);
    if (!type || file.size > type.max) return withSession({ error: 'invalid_ephemeral_media' }, access.session, 400);

    const membership = await ownMembership(env, access, conversationId);
    const members = await activeMembers(env, access, conversationId);
    if (!membership || members.length !== 2) return withSession({ error: 'direct_conversation_required' }, access.session, 403);

    uploadedPath = `messages-ephemeral/${conversationId}/${access.account.userId}/${crypto.randomUUID()}.${type.extension}`;
    const upload = await supabase(env, `/storage/v1/object/velvet-media/${uploadedPath}`, {
      method: 'POST',
      headers: { 'content-type': file.type, 'x-upsert': 'false' },
      body: await file.arrayBuffer()
    }, access.session.access_token);
    if (!upload.ok) throw new Error('ephemeral_upload_failed');

    const label = type.mediaType === 'image' ? 'Photo' : 'Vidéo';
    const body = mode === 'view_once'
      ? `🔒 ${label} éphémère · Voir une fois`
      : `🔒 ${label} éphémère · Disponible ${expiresMinutes} min`;

    // Même table messages = même trigger de demande de conversation.
    const created = await restJson(
      env,
      '/rest/v1/messages?select=id,conversation_id,sender_user_id,sender_identity,body,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          conversation_id: conversationId,
          sender_user_id: access.account.userId,
          sender_identity: membership.display_identity || null,
          body
        })
      }
    );
    const message = created?.[0];
    if (!message?.id) throw new Error('message_persistence_failed');
    createdMessageId = message.id;

    const attachmentRows = await restJson(
      env,
      '/rest/v1/message_attachments?select=id,message_id,conversation_id,media_type,mime_type,original_name,size_bytes,storage_path,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          message_id: message.id,
          conversation_id: conversationId,
          uploader_user_id: access.account.userId,
          storage_path: uploadedPath,
          media_type: type.mediaType,
          mime_type: file.type,
          original_name: `Éphémère Zwit · ${mode === 'view_once' ? 'voir une fois' : `${expiresMinutes} min`}.${type.extension}`,
          size_bytes: file.size
        })
      }
    );
    const attachment = attachmentRows?.[0];
    if (!attachment?.id) throw new Error('message_attachment_persistence_failed');

    const expiresAt = new Date(Date.now() + expiresMinutes * 60_000).toISOString();
    const metadata = await restJson(
      env,
      '/rest/v1/rpc/zwit_v15_register_ephemeral_attachment',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          target_attachment_id: attachment.id,
          target_message_id: message.id,
          target_conversation_id: conversationId,
          target_mode: mode,
          target_expires_at: expiresAt
        })
      }
    );
    if (!metadata?.[0]?.attachment_id) throw new Error('ephemeral_metadata_persistence_failed');

    await restJson(env, `/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, access.session, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ updated_at: message.created_at })
    }).catch(() => null);

    const targets = members.filter((member) => member.user_id !== access.account.userId);
    const notify = senderProfile(env, access).then((profile) => deliverMessageNotifications(env, {
      recipients: targets,
      senderProfile: profile,
      senderIdentity: membership.display_identity || null,
      conversationId,
      messageBody: `🔒 ${label} éphémère`
    })).catch(() => null);
    if (typeof waitUntil === 'function') waitUntil(notify);
    else await notify;

    return withSession({
      ok: true,
      message: {
        id: message.id,
        conversationId,
        body,
        createdAt: message.created_at,
        ephemeral: { mode, expiresAt, mediaType: type.mediaType }
      }
    }, access.session, 201);
  } catch (error) {
    if (createdMessageId && cleanupSession) await rollbackMessage(env, cleanupSession, createdMessageId, conversationId);
    if (uploadedPath && cleanupSession) await deleteStoredFile(env, cleanupSession, uploadedPath);
    return json({ error: cleanText(error.message, 120) || 'ephemeral_message_failed' }, 400);
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const body = await readJson(request);
    const messageId = String(body.messageId || '');
    if (!validUuid(messageId)) return withSession({ error: 'invalid_message' }, access.session, 400);

    const rows = await restJson(env, '/rest/v1/rpc/zwit_v15_open_ephemeral_message', access.session, {
      method: 'POST',
      body: JSON.stringify({ target_message_id: messageId })
    });
    const opened = rows?.[0];
    if (!opened?.storage_path) return withSession({ error: 'ephemeral_message_not_found' }, access.session, 404);
    const previewUrl = await signedEphemeralMediaUrl(env, access.session, opened.storage_path, 60);
    if (!previewUrl) throw new Error('ephemeral_signing_failed');

    return withSession({
      ok: true,
      media: {
        attachmentId: opened.attachment_id,
        mimeType: opened.mime_type,
        originalName: opened.original_name,
        mode: opened.mode,
        expiresAt: opened.expires_at,
        openedAt: opened.opened_at,
        sender: opened.sender,
        previewUrl,
        urlExpiresIn: 60
      }
    }, access.session);
  } catch (error) {
    return json({ error: cleanText(error.message, 120) || 'ephemeral_open_failed' }, 400);
  }
}
