import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, requireAdmittedMember, restJson, withSession } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const admission = await requireAdmittedMember(env, access);
    if (admission.response) return admission.response;

    const body = await readJson(request);
    const token = cleanText(body.token, 128);
    if (token.length < 32) return withSession({ error: 'invalid_checkin_token' }, access.session, 400);

    const result = await restJson(env, '/rest/v1/rpc/zwit_v15_redeem_checkin_session', access.session, {
      method: 'POST',
      body: JSON.stringify({ target_token: token })
    });
    const checkin = result?.[0];
    if (!checkin) return withSession({ error: 'checkin_not_confirmed' }, access.session, 400);

    return withSession({
      ok: true,
      checkin: {
        eventId: checkin.event_id,
        establishmentId: checkin.establishment_id,
        eventTitle: checkin.event_title,
        checkedInAt: checkin.checked_in_at
      },
      passportUpdated: true,
      message: 'Présence confirmée. Cette sortie rejoint désormais les preuves réelles de ton Passeport Zwit.'
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'member_checkin_failed' }, 400);
  }
}
