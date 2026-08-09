import { json, supabase } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { deliverMessageNotifications } from './_message-notifications.js';
import { signedMediaUrl } from './media.js';

const TYPES = new Map([
  ['image/jpeg', { mediaType: 'image', extension: 'jpg', max: 10 * 1024 * 1024 }],
  ['image/png', { mediaType: 'image', extension: 'png', max: 10 * 1024 * 1024 }],
  ['image/webp', { mediaType: 'image', extension: 'webp', max: 10 * 1024 * 1024 }],
  ['image/gif', { mediaType: 'image', extension: 'gif', max: 10 * 1024 * 1024 }],
  ['video/mp4', { mediaType: 'video', extension: 'mp4', max: 50 * 1024 * 1024 }],
  ['video/webm', { mediaType: 'video', extension: 'webm', max: 50 * 1024 * 1024 }],
  ['video/quicktime', { mediaType: 'video', extension: 'mov', max: 50 * 1024 * 1024 }],
  ['application/pdf', { mediaType: 'document', extension: 'pdf', max: 10 * 1024 * 1024 }]
]);

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function membership(env, access, conversationId) {
  const rows = await restJson(
    env,
    `/rest/v1/conversation_members?select=conversation_id,user_id,display_identity&conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(access.account.userId)}&left_at=is.null&limit=1`,
    access.session
  );
  return rows?.[0] || null;
}

async function recipients(env, access, conversationId) {
  return restJson(
    env,
    `/rest/v1/conversation_members?select=user_id,display_identity&conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=neq.${encodeURIComponent(access.account.userId)}&left_at=is.null`,
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

async function deleteStoredFile(env, session, storagePath) {
  if (!storagePath) return;
  await supabase(
    env,
    `/storage/v1/object/velvet-media/${storagePath}`,
    { method: 'DELETE' },
    session.access_token
  ).catch(() => null);
}

async function rollbackMessage(env, session, messageId, conversationId) {
  if (!messageId) return;
  await restJson(
    env,
    '/rest/v1/rpc/zwit_v15_rollback_own_message',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        target_message_id: messageId,
        target_conversation_id: conversationId
      })
    }
  ).catch(() => null);
}

export async function onRequestPost({ request, env, waitUntil }) {
  const uploadedPaths = [];
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
      return withSession({ error: 'message_media_multipart_required' }, access.session, 400);
    }

    const form = await request.formData();
    conversationId = String(form.get('conversationId') || '');
    const body = cleanText(form.get('body'), 10000) || null;
    const files = form.getAll('attachments').filter((value) => value instanceof File && value.size > 0);

    if (!validUuid(conversationId) || !files.length) {
      return withSession({ error: 'message_media_required' }, access.session, 400);
    }
    if (files.length > 4) return withSession({ error: 'too_many_message_attachments' }, access.session, 400);

    const ownMembership = await membership(env, access, conversationId);
    if (!ownMembership) return withSession({ error: 'conversation_access_denied' }, access.session, 403);

    const pendingAttachments = [];
    for (const file of files) {
      const rule = TYPES.get(file.type);
      if (!rule || file.size > rule.max) throw new Error('invalid_message_attachment');
      const storagePath = `messages/${conversationId}/${access.account.userId}/${crypto.randomUUID()}.${rule.extension}`;
      const upload = await supabase(
        env,
        `/storage/v1/object/velvet-media/${storagePath}`,
        {
          method: 'POST',
          headers: { 'content-type': file.type, 'x-upsert': 'false' },
          body: await file.arrayBuffer()
        },
        access.session.access_token
      );
      if (!upload.ok) throw new Error('message_attachment_upload_failed');
      uploadedPaths.push(storagePath);
      pendingAttachments.push({
        storagePath,
        mediaType: rule.mediaType,
        mimeType: file.type,
        originalName: cleanText(file.name, 240) || `piece-jointe.${rule.extension}`,
        sizeBytes: file.size
      });
    }

    const created = await restJson(
      env,
      '/rest/v1/messages?select=id,conversation_id,sender_user_id,sender_identity,body,created_at,edited_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          conversation_id: conversationId,
          sender_user_id: access.account.userId,
          sender_identity: ownMembership.display_identity || null,
          body
        })
      }
    );
    const savedMessage = created?.[0];
    if (!savedMessage?.id) throw new Error('message_persistence_failed');
    createdMessageId = savedMessage.id;

    const savedAttachments = [];
    for (const attachment of pendingAttachments) {
      const rows = await restJson(
        env,
        '/rest/v1/rpc/zwit_v15_register_message_attachment',
        access.session,
        {
          method: 'POST',
          body: JSON.stringify({
            target_message_id: savedMessage.id,
            target_conversation_id: conversationId,
            target_storage_path: attachment.storagePath,
            target_media_type: attachment.mediaType,
            target_mime_type: attachment.mimeType,
            target_original_name: attachment.originalName,
            target_size_bytes: attachment.sizeBytes,
            target_attachment_kind: 'media',
            target_duration_seconds: null
          })
        }
      );
      const persisted = rows?.[0];
      if (!persisted?.id) throw new Error('message_attachment_persistence_failed');
      savedAttachments.push({
        ...persisted,
        previewUrl: await signedMediaUrl(env, access.session, attachment.storagePath)
      });
    }

    await Promise.all([
      restJson(
        env,
        `/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`,
        access.session,
        {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ updated_at: savedMessage.created_at })
        }
      ).catch(() => null),
      restJson(
        env,
        `/rest/v1/conversation_typing?conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(access.account.userId)}`,
        access.session,
        { method: 'DELETE', headers: { prefer: 'return=minimal' } }
      ).catch(() => null)
    ]);

    const notify = Promise.all([
      recipients(env, access, conversationId),
      senderProfile(env, access)
    ]).then(([targets, profile]) => deliverMessageNotifications(env, {
      recipients: targets,
      senderProfile: profile,
      senderIdentity: ownMembership.display_identity || null,
      conversationId,
      messageBody: body || (savedAttachments.some((item) => item.media_type === 'video') ? '🎥 Vidéo' : '📷 Photo')
    })).catch(() => null);
    if (typeof waitUntil === 'function') waitUntil(notify);
    else await notify;

    return withSession({
      ok: true,
      message: {
        ...savedMessage,
        attachments: savedAttachments
      }
    }, access.session, 201);
  } catch (error) {
    if (cleanupSession) {
      await rollbackMessage(env, cleanupSession, createdMessageId, conversationId);
      await Promise.all(uploadedPaths.map((storagePath) => deleteStoredFile(env, cleanupSession, storagePath)));
    }
    return json({ error: cleanText(error.message, 120) || 'message_media_failed' }, 400);
  }
}
