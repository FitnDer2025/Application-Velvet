import { json, readJson, supabase } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  requireAdmittedMember,
  restJson,
  withSession
} from './_shared.js';
import { deliverMessageNotifications } from './_message-notifications.js';
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
const MESSAGE_REACTIONS = new Set(['like', 'love', 'laugh', 'wow', 'sad', 'fire']);
const TYPING_TTL_MS = 9000;

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function dateAt(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
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

async function conversationMembership(env, access, conversationId) {
  const rows = await restJson(
    env,
    `/rest/v1/conversation_members?select=conversation_id,user_id,display_identity,last_delivered_at,last_read_at&conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(access.account.userId)}&left_at=is.null&limit=1`,
    access.session
  );
  return rows?.[0] || null;
}

async function conversationMembers(env, access, conversationId) {
  return restJson(
    env,
    `/rest/v1/conversation_members?select=user_id,display_identity,last_delivered_at,last_read_at&conversation_id=eq.${encodeURIComponent(conversationId)}&left_at=is.null&order=joined_at.asc`,
    access.session
  ).catch(() => []);
}

async function updateConversationReceipt(env, access, conversationId, { delivered = false, read = false } = {}) {
  const now = new Date().toISOString();
  const patch = {};
  if (delivered || read) patch.last_delivered_at = now;
  if (read) patch.last_read_at = now;
  if (!Object.keys(patch).length) return;
  await restJson(
    env,
    `/rest/v1/conversation_members?conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(access.account.userId)}&left_at=is.null`,
    access.session,
    {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    }
  ).catch(() => null);
}

async function consumeConversationNotifications(env, access, conversationId) {
  const now = new Date().toISOString();
  await restJson(
    env,
    `/rest/v1/member_notifications?user_id=eq.${encodeURIComponent(access.account.userId)}&entity_type=eq.conversation&entity_id=eq.${encodeURIComponent(conversationId)}&archived_at=is.null`,
    access.session,
    {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ read_at: now, archived_at: now })
    }
  ).catch(() => null);
}

async function messageRecipients(env, access, conversationId) {
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

async function messageSocialState(env, access, conversationId, messages = []) {
  const ids = messages.map((message) => message.id).filter(validUuid);
  const since = new Date(Date.now() - TYPING_TTL_MS).toISOString();
  const [members, reactions, typing] = await Promise.all([
    conversationMembers(env, access, conversationId),
    ids.length
      ? restJson(
        env,
        `/rest/v1/message_reactions?select=id,message_id,user_id,display_identity,reaction,created_at,updated_at&conversation_id=eq.${encodeURIComponent(conversationId)}&message_id=in.(${ids.join(',')})&order=updated_at.asc`,
        access.session
      ).catch(() => [])
      : [],
    restJson(
      env,
      `/rest/v1/conversation_typing?select=user_id,display_identity,updated_at&conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=neq.${encodeURIComponent(access.account.userId)}&updated_at=gte.${encodeURIComponent(since)}&order=updated_at.desc`,
      access.session
    ).catch(() => [])
  ]);

  const reactionsByMessage = new Map();
  (reactions || []).forEach((reaction) => {
    const rows = reactionsByMessage.get(reaction.message_id) || [];
    rows.push(reaction);
    reactionsByMessage.set(reaction.message_id, rows);
  });

  const receiptsByMessage = {};
  const reactionsPayload = {};
  messages.forEach((message) => {
    const created = dateAt(message.created_at);
    receiptsByMessage[message.id] = (members || [])
      .filter((member) => member.user_id !== message.sender_user_id)
      .map((member) => {
        const read = dateAt(member.last_read_at) >= created;
        const delivered = read || dateAt(member.last_delivered_at) >= created;
        return {
          userId: member.user_id,
          displayIdentity: member.display_identity || 'Membre Zwit',
          status: read ? 'read' : (delivered ? 'delivered' : 'sent'),
          deliveredAt: delivered ? member.last_delivered_at : null,
          readAt: read ? member.last_read_at : null
        };
      });
    reactionsPayload[message.id] = reactionsByMessage.get(message.id) || [];
  });

  return {
    members: members || [],
    receipts: receiptsByMessage,
    reactions: reactionsPayload,
    typing: typing || []
  };
}

async function handleConversationAction(env, access, payload) {
  const conversationId = String(payload.conversationId || '');
  if (!validUuid(conversationId)) return withSession({ error: 'invalid_conversation' }, access.session, 400);
  const membership = await conversationMembership(env, access, conversationId);
  if (!membership) return withSession({ error: 'conversation_access_denied' }, access.session, 403);

  if (payload.action === 'typing') {
    if (payload.active === false) {
      await restJson(
        env,
        `/rest/v1/conversation_typing?conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(access.account.userId)}`,
        access.session,
        { method: 'DELETE', headers: { prefer: 'return=minimal' } }
      ).catch(() => null);
    } else {
      await restJson(
        env,
        '/rest/v1/conversation_typing?on_conflict=conversation_id,user_id',
        access.session,
        {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            conversation_id: conversationId,
            user_id: access.account.userId,
            display_identity: membership.display_identity || null,
            updated_at: new Date().toISOString()
          })
        }
      );
    }
    return withSession({ ok: true }, access.session);
  }

  if (payload.action === 'delivered' || payload.action === 'read') {
    const read = payload.action === 'read';
    await updateConversationReceipt(env, access, conversationId, { delivered: true, read });
    if (read) await consumeConversationNotifications(env, access, conversationId);
    return withSession({ ok: true }, access.session);
  }

  if (payload.action === 'reaction') {
    const messageId = String(payload.messageId || '');
    const reaction = payload.reaction === null ? null : String(payload.reaction || '');
    if (!validUuid(messageId) || (reaction !== null && !MESSAGE_REACTIONS.has(reaction))) {
      return withSession({ error: 'invalid_message_reaction' }, access.session, 400);
    }
    const rows = await restJson(
      env,
      `/rest/v1/messages?select=id,sender_user_id&conversation_id=eq.${encodeURIComponent(conversationId)}&id=eq.${encodeURIComponent(messageId)}&deleted_at=is.null&limit=1`,
      access.session
    );
    if (!rows?.length) return withSession({ error: 'message_not_found' }, access.session, 404);
    if (reaction === null) {
      await restJson(
        env,
        `/rest/v1/message_reactions?message_id=eq.${encodeURIComponent(messageId)}&user_id=eq.${encodeURIComponent(access.account.userId)}`,
        access.session,
        { method: 'DELETE', headers: { prefer: 'return=minimal' } }
      );
    } else {
      await restJson(
        env,
        '/rest/v1/message_reactions?on_conflict=message_id,user_id',
        access.session,
        {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            message_id: messageId,
            conversation_id: conversationId,
            user_id: access.account.userId,
            display_identity: membership.display_identity || null,
            reaction,
            updated_at: new Date().toISOString()
          })
        }
      );
    }
    return withSession({ ok: true }, access.session);
  }

  return withSession({ error: 'invalid_message_action' }, access.session, 400);
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    const conversationId = new URL(request.url).searchParams.get('conversationId');
    if (!validUuid(conversationId)) return json({ error: 'invalid_conversation' }, 400);
    const membership = await conversationMembership(env, access, conversationId);
    if (!membership) return withSession({ error: 'conversation_access_denied' }, access.session, 403);

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
    await Promise.all([
      updateConversationReceipt(env, access, conversationId, { delivered: true, read: true }),
      consumeConversationNotifications(env, access, conversationId)
    ]);
    const enrichedMessages = await enrichAttachments(env, access.session, messages);
    const social = await messageSocialState(env, access, conversationId, messages);
    return withSession({
      messages: enrichedMessages,
      ...social,
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

export async function onRequestPost({ request, env, waitUntil }) {
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
    if (!isMultipart && body.action) return handleConversationAction(env, access, body);

    const conversationId = String(isMultipart ? body.get('conversationId') : body.conversationId || '');
    const message = cleanText(isMultipart ? body.get('body') : body.body, 10000) || null;
    const files = isMultipart
      ? body.getAll('attachments').filter((value) => value instanceof File && value.size > 0)
      : [];
    if (!validUuid(conversationId) || (!message && !files.length)) {
      return json({ error: 'message_required' }, 400);
    }
    if (files.length > 4) return json({ error: 'too_many_message_attachments' }, 400);
    const membership = await conversationMembership(env, access, conversationId);
    if (!membership) return json({ error: 'conversation_access_denied' }, 403);

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
          sender_identity: membership.display_identity || null,
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

    await Promise.all([
      updateConversationReceipt(env, access, conversationId, { delivered: true, read: true }),
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

    const notificationTask = Promise.all([
      messageRecipients(env, access, conversationId),
      senderProfile(env, access)
    ]).then(([recipients, profile]) => deliverMessageNotifications(env, {
      recipients,
      senderProfile: profile,
      senderIdentity: membership.display_identity || null,
      conversationId,
      messageBody: message
    })).catch(() => null);
    if (typeof waitUntil === 'function') waitUntil(notificationTask);
    else await notificationTask;

    return withSession({ ok: true, message: savedMessage }, access.session, 201);
  } catch (error) {
    if (cleanupSession) {
      await Promise.all(uploadedPaths.map((path) => deleteStoredFile(env, cleanupSession, path)));
    }
    return json({ error: error.message || 'message_send_failed' }, 400);
  }
}
