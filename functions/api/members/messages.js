import { json, readJson, supabase } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { signedMediaUrl } from './media.js';

const ATTACHMENT_TYPES = new Map([
  ['image/jpeg', { type: 'image', extension: 'jpg', max: 10 * 1024 * 1024 }],
  ['image/png', { type: 'image', extension: 'png', max: 10 * 1024 * 1024 }],
  ['image/webp', { type: 'image', extension: 'webp', max: 10 * 1024 * 1024 }],
  ['image/gif', { type: 'image', extension: 'gif', max: 10 * 1024 * 1024 }],
  ['video/mp4', { type: 'video', extension: 'mp4', max: 50 * 1024 * 1024 }],
  ['video/webm', { type: 'video', extension: 'webm', max: 50 * 1024 * 1024 }],
  ['video/quicktime', { type: 'video', extension: 'mov', max: 50 * 1024 * 1024 }],
  ['application/pdf', { type: 'document', extension: 'pdf', max: 10 * 1024 * 1024 }]
]);

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function enrichAttachments(env, session, messages = []) {
  return Promise.all(messages.map(async (message) => ({
    ...message,
    attachments: await Promise.all((message.message_attachments || []).map(async (attachment) => ({
      ...attachment,
      previewUrl: await signedMediaUrl(env, session, attachment.storage_path)
    })))
  })));
}

async function deleteStoredFile(env, session, path) {
  if (!path) return;
  await supabase(env, `/storage/v1/object/velvet-media/${path}`, {
    method: 'DELETE'
  }, session.access_token).catch(() => null);
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const conversationId = new URL(request.url).searchParams.get('conversationId');
    if (!validUuid(conversationId)) return json({ error: 'invalid_conversation' }, 400);
    const messagesPromise = restJson(
      env,
      `/rest/v1/messages?select=id,conversation_id,sender_user_id,sender_identity,body,created_at,edited_at,message_attachments(id,media_type,mime_type,original_name,size_bytes,storage_path,created_at)&conversation_id=eq.${conversationId}&deleted_at=is.null&order=created_at.asc&limit=500`,
      access.session
    ).catch(() => restJson(
      env,
      `/rest/v1/messages?select=id,conversation_id,sender_user_id,sender_identity,body,created_at,edited_at&conversation_id=eq.${conversationId}&deleted_at=is.null&order=created_at.asc&limit=500`,
      access.session
    ));
    const [messages, engagement] = await Promise.all([
      messagesPromise,
      restJson(
        env,
        `/rest/v1/conversation_engagement?select=conversation_id,current_streak,longest_streak,qualified_days,last_qualified_date,last_message_at,updated_at&conversation_id=eq.${conversationId}&limit=1`,
        access.session
      )
    ]);
    return withSession({
      messages: await enrichAttachments(env, access.session, messages),
      streak: engagement?.[0] || {
        conversation_id: conversationId,
        current_streak: 0,
        longest_streak: 0,
        qualified_days: 0,
        last_qualified_date: null
      },
      currentUserId: access.account.userId
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'messages_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  const uploadedPaths = [];
  let cleanupSession = null;
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    cleanupSession = access.session;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data');
    const body = isMultipart ? await request.formData() : await readJson(request);
    const conversationId = String(isMultipart ? body.get('conversationId') : body.conversationId || '');
    const message = cleanText(isMultipart ? body.get('body') : body.body, 10000) || null;
    const files = isMultipart
      ? body.getAll('attachments').filter((value) => value instanceof File && value.size > 0)
      : [];
    if (!validUuid(conversationId) || (!message && !files.length)) {
      return json({ error: 'message_required' }, 400);
    }
    if (files.length > 4) return json({ error: 'too_many_message_attachments' }, 400);
    const membership = await restJson(
      env,
      `/rest/v1/conversation_members?select=conversation_id&conversation_id=eq.${conversationId}&user_id=eq.${encodeURIComponent(access.account.userId)}&left_at=is.null&limit=1`,
      access.session
    );
    if (!membership?.length) return json({ error: 'conversation_access_denied' }, 403);

    const attachments = [];
    for (const file of files) {
      const rule = ATTACHMENT_TYPES.get(file.type);
      if (!rule || file.size > rule.max) throw new Error('invalid_message_attachment');
      const path = `messages/${conversationId}/${access.account.userId}/${crypto.randomUUID()}.${rule.extension}`;
      const upload = await supabase(env, `/storage/v1/object/velvet-media/${path}`, {
        method: 'POST',
        headers: {
          'content-type': file.type,
          'x-upsert': 'false'
        },
        body: await file.arrayBuffer()
      }, access.session.access_token);
      if (!upload.ok) throw new Error('message_attachment_upload_failed');
      uploadedPaths.push(path);
      attachments.push({
        storage_path: path,
        media_type: rule.type,
        mime_type: file.type,
        original_name: cleanText(file.name, 240) || `piece-jointe.${rule.extension}`,
        size_bytes: file.size
      });
    }
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
          body: message
        })
      }
    );
    const savedMessage = created?.[0];
    if (!savedMessage?.id || savedMessage.conversation_id !== conversationId) {
      throw new Error('message_persistence_failed');
    }
    if (attachments.length) {
      const savedAttachments = await restJson(
        env,
        '/rest/v1/message_attachments?select=id,message_id,conversation_id,media_type,mime_type,original_name,size_bytes,storage_path,created_at',
        access.session,
        {
          method: 'POST',
          headers: { prefer: 'return=representation' },
          body: JSON.stringify(attachments.map((attachment) => ({
            ...attachment,
            message_id: savedMessage.id,
            conversation_id: conversationId,
            uploader_user_id: access.account.userId
          })))
        }
      );
      if (savedAttachments?.length !== attachments.length) throw new Error('message_attachment_persistence_failed');
      savedMessage.attachments = await Promise.all(savedAttachments.map(async (attachment) => ({
        ...attachment,
        previewUrl: await signedMediaUrl(env, access.session, attachment.storage_path)
      })));
    } else {
      savedMessage.attachments = [];
    }
    return withSession({ ok: true, message: savedMessage }, access.session, 201);
  } catch (error) {
    if (cleanupSession) {
      await Promise.all(uploadedPaths.map((path) => deleteStoredFile(env, cleanupSession, path)));
    }
    return json({ error: error.message || 'message_send_failed' }, 400);
  }
}
