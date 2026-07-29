import { json, readJson } from '../auth/_shared.js';
import {
  cleanText,
  memberSession,
  restJson,
  withSession
} from './_shared.js';
import { sendCoupleInvitationEmail } from './couple-invitation-email.js';

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const rows = await restJson(
      env,
      `/rest/v1/couple_partner_invitations?select=id,profile_id,invited_email,status,accepted_at,created_at&inviter_user_id=eq.${encodeURIComponent(access.account.userId)}&order=created_at.desc&limit=1`,
      access.session
    );
    const invitation = rows?.[0] || null;
    return withSession({
      ok: true,
      invitation,
      invitedEmail: invitation?.invited_email || null
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'couple_invitation_lookup_failed' }, 400);
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
    if (!result?.[0]?.partner_invitation_id || !result?.[0]?.invite_code) {
      throw new Error('couple_invitation_persistence_failed');
    }
    const registrationUrl = new URL('/', request.url);
    registrationUrl.searchParams.set('invite', result?.[0]?.invite_code || '');
    registrationUrl.searchParams.set('email', email);
    let emailDelivery = {
      status: 'not_attempted',
      provider: 'resend'
    };
    try {
      const profileRows = await restJson(
        env,
        `/rest/v1/member_profiles?select=display_name&profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
        access.session
      );
      emailDelivery = await sendCoupleInvitationEmail({
        env,
        invitedEmail: email,
        profileName: profileRows?.[0]?.display_name || 'Votre moitié',
        registrationUrl: registrationUrl.toString()
      });
    } catch (deliveryError) {
      emailDelivery = {
        status: 'failed',
        provider: 'resend',
        error: deliveryError.message || 'email_delivery_failed'
      };
    }
    return withSession({
      ok: true,
      invitation: result?.[0] || null,
      invitedEmail: email,
      registrationUrl: registrationUrl.toString(),
      emailDelivery
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'couple_invitation_failed' }, 400);
  }
}
