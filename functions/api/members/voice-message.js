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

const AUDIO_TYPES = new Map([
  ['audio/webm', 'webm'],
  ['audio/mp4', 'm4a'],
  ['audio/mpeg', 'mp3'],
  ['audio/ogg', 'ogg'],
  ['audio/wav', 'wav'],
  ['audio/x-m4a', 'm4a']
]);
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

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

async function deleteStoredFile(env, session, path) {
  if (!path) return;
  await supabase(env, `/storage/v1/object/velvet-media/${path}`, { method: 'DELETE' }, session.access_token).catch(() => null);
}

export async function onRequestPost({ request, env, waitUntil }) {
  let uploadedPath = '';
  let cleanupSession = null;
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    cleanupSession = access.session;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return withSession({ error: 'voice_multipart_required' }, access.session, 400);
    }

    const form = await request.formData();
    const conversationId = String(form.get('conversationId') || '');
    const file = form.get('voice');
    const durationSeconds = Math.max(1, Math.min(300, Math.round(Number(form.get('durationSeconds') || 1))));
    if (!validUuid(conversationId)) return withSession({ error: 'invalid_conversation' }, access.session, 400);
    if (!(file instanceof File) || !file.size) return withSession({ error: 'voice_required' }, access.session, 400);
    const extension = AUDIO_TYPES.get(file.type);
    if (!extension || file.size > MAX_AUDIO_BYTES) return withSession({ error: 'invalid_voice_file' }, access.session, 400);
    const ownMembership = await membership(env, access, conversationId);
    if (!ownMembership) return withSession({ error: 'conversation_access_denied' }, access.session, 403);

    uploadedPath = `messages/${conversationId}/${access.account.userId}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase(env, `/storage/v1/object/velvet-media/${uploadedPath}`, {
      method: 'POST',
      headers: { 'content-type': file.type, 'x-upsert': 'false' },
      body: await file.arrayBuffer()
    }, access.session.access_token);
    if (!upload.ok) throw new Error('voice_upload_failed');

    // L'insert messages traverse le trigger v1.5 conversation-request :
    // impossible d'utiliser un vocal pour contourner la règle anti-harcèlement.
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
          sender_identity: ownMembership.display_identity || null,
          body: null
        })
      }
    );
    const message = created?.[0];
    if (!message?.id) throw new Error('message_persistence_failed');

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
          media_type: 'document',
          mime_type: file.type,
          original_name: `Vocal Zwit · ${durationSeconds}s.${extension}`,
          size_bytes: file.size
        })
      }
    );
    const attachment = attachmentRows?.[0];
    if (!attachment?.id) throw new Error('message_attachment_persistence_failed');
    const previewUrl = await signedMediaUrl(env, access.session, uploadedPath);

    await restJson(
      env,
      `/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`,
      access.session,
      {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ updated_at: message.created_at })
      }
    ).catch(() => null);

    const notify = Promise.all([
      recipients(env, access, conversationId),
      senderProfile(env, access)
    ]).then(([targets, profile]) => deliverMessageNotifications(env, {
      recipients: targets,
      senderProfile: profile,
      senderIdentity: ownMembership.display_identity || null,
      conversationId,
      messageBody: '🎙️ Message vocal'
    })).catch(() => null);
    if (typeof waitUntil === 'function') waitUntil(notify);
    else await notify;

    return withSession({
      ok: true,
      message: {
        ...message,
        attachments: [{ ...attachment, kind: 'voice', durationSeconds, previewUrl }]
      }
    }, access.session, 201);
  } catch (error) {
    if (uploadedPath && cleanupSession) await deleteStoredFile(env, cleanupSession, uploadedPath);
    return json({ error: cleanText(error.message, 120) || 'voice_message_failed' }, 400);
  }
}
