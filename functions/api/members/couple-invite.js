import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  restJson,
  withSession
} from './_shared.js';
import { buildCoupleInvitationEmail } from './couple-invitation-email.js';

async function recordDelivery(env, session, invitationId, status, provider = null, messageId = null) {
  if (!invitationId) return;
  await restJson(
    env,
    '/rest/v1/rpc/record_couple_invitation_delivery',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        target_invitation_id: invitationId,
        target_status: status,
        target_provider: provider,
        target_message_id: messageId
      })
    }
  ).catch(() => null);
}

async function sendInvitationEmail(env, { email, registrationUrl, profileName, invitationId }, session) {
  if (!env.RESEND_API_KEY || !env.VELVET_FROM_EMAIL) {
    await recordDelivery(env, session, invitationId, 'not_configured');
    return { status: 'not_configured', provider: null, messageId: null };
  }

  const template = buildCoupleInvitationEmail({ profileName, registrationUrl });
  const message = {
    from: env.VELVET_FROM_EMAIL,
    to: [email],
    subject: template.subject,
    text: template.text,
    html: template.html,
    tags: [{ name: 'category', value: 'couple_invitation' }]
  };
  if (env.VELVET_REPLY_TO_EMAIL) message.reply_to = env.VELVET_REPLY_TO_EMAIL;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `velvet-couple-${invitationId}`
    },
    body: JSON.stringify(message)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    await recordDelivery(env, session, invitationId, 'failed', 'resend');
    return {
      status: 'failed',
      provider: 'resend',
      messageId: null,
      providerError: payload?.message || payload?.name || 'resend_delivery_failed'
    };
  }

  await recordDelivery(env, session, invitationId, 'sent', 'resend', payload.id || null);
  return { status: 'sent', provider: 'resend', messageId: payload.id || null };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const rows = await restJson(
      env,
      '/rest/v1/couple_partner_invitations?select=id,profile_id,invited_email,status,accepted_user_id,accepted_at,created_at,delivery_status,delivery_provider,delivery_attempted_at&order=created_at.desc&limit=1',
      access.session
    );
    const invitation = rows?.[0] || null;
    return withSession({
      invitation: invitation ? {
        ...invitation,
        partnerAccepted: invitation.status === 'accepted',
        status: invitation.status === 'accepted' ? 'pending' : invitation.status
      } : null
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'couple_invitation_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const email = cleanText(body.email, 320).toLowerCase();
    if (!email.includes('@')) return json({ error: 'invalid_partner_email' }, 400);
    if (email === access.account.email.toLowerCase()) {
      return json({ error: 'partner_email_must_be_different' }, 400);
    }

    const result = await restJson(
      env,
      '/rest/v1/rpc/invite_my_couple_partner',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          partner_email: email,
          validity_days: 7
        })
      }
    );
    const invitation = result?.[0] || null;
    const registrationUrl = new URL('/', request.url);
    registrationUrl.searchParams.set('invite', invitation?.invite_code || '');
    registrationUrl.searchParams.set('email', email);
    const profileRows = await restJson(
      env,
      '/rest/v1/member_profiles?select=display_name&profile_members!inner(user_id,status)&profile_members.user_id=eq.' + encodeURIComponent(access.account.userId) + '&profile_members.status=eq.active&limit=1',
      access.session
    );
    const delivery = await sendInvitationEmail(env, {
      email,
      registrationUrl: registrationUrl.toString(),
      profileName: profileRows?.[0]?.display_name || 'Votre moitié',
      invitationId: invitation?.partner_invitation_id
    }, access.session);

    return withSession({
      ok: true,
      invitation,
      invitedEmail: email,
      registrationUrl: registrationUrl.toString(),
      emailDelivery: delivery
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'couple_invitation_failed' }, 400);
  }
}
