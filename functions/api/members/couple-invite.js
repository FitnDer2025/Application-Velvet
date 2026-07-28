import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  restJson,
  withSession
} from './_shared.js';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

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

  const subject = `${profileName || 'Votre moitié'} vous invite sur Velvet`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `velvet-couple-${invitationId}`
    },
    body: JSON.stringify({
      from: env.VELVET_FROM_EMAIL,
      to: [email],
      subject,
      text: `Votre moitié a commencé votre profil couple sur Velvet. Rejoignez-la pour compléter votre fiche personnelle : ${registrationUrl}`,
      html: `<div style="background:#0b080a;color:#f6eee6;padding:36px;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;background:#171014;border:1px solid #3b2931;border-radius:24px;padding:32px"><div style="font-family:Georgia,serif;font-size:34px;margin-bottom:18px">Velvet</div><p style="color:#d9b879;text-transform:uppercase;letter-spacing:.14em;font-size:11px">Invitation privée</p><h1 style="font-family:Georgia,serif;font-weight:400">Votre histoire a déjà commencé.</h1><p style="line-height:1.65;color:#d7cdd0">${escapeHtml(profileName || 'Votre moitié')} a créé votre espace couple et vous invite maintenant à compléter la partie qui vous appartient.</p><p style="line-height:1.65;color:#d7cdd0">Le lien est personnel, valable sept jours et ne doit pas être partagé.</p><p style="margin:28px 0"><a href="${escapeHtml(registrationUrl)}" style="display:inline-block;background:#9f2852;color:white;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700">Compléter ma fiche</a></p><p style="font-size:12px;color:#9e9297">Si vous n’attendiez pas cette invitation, ignorez simplement cet e-mail.</p></div></div>`,
      tags: [{ name: 'category', value: 'couple_invitation' }]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    await recordDelivery(env, session, invitationId, 'failed', 'resend');
    return { status: 'failed', provider: 'resend', messageId: null };
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
    return withSession({ invitation: rows?.[0] || null }, access.session);
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
