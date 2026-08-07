import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from '../members/_shared.js';

const PRO_ROLES = new Set(['pro_owner', 'pro_staff', 'admin']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    if (!access.account.roles.some((role) => PRO_ROLES.has(role))) {
      return withSession({ error: 'pro_access_required' }, access.session, 403);
    }

    const body = await readJson(request);
    const eventId = cleanText(body.eventId, 60);
    if (!UUID.test(eventId)) return withSession({ error: 'invalid_event' }, access.session, 400);
    const ttlSeconds = Math.max(60, Math.min(300, Math.round(Number(body.ttlSeconds || 120))));

    const result = await restJson(env, '/rest/v1/rpc/zwit_v15_open_checkin_session', access.session, {
      method: 'POST',
      body: JSON.stringify({ target_event_id: eventId, ttl_seconds: ttlSeconds })
    });
    const session = result?.[0];
    if (!session?.token) return withSession({ error: 'checkin_session_not_created' }, access.session, 400);

    const origin = new URL(request.url).origin;
    const checkinUrl = `${origin}/membres/?checkin=${encodeURIComponent(session.token)}`;
    return withSession({
      ok: true,
      checkin: {
        sessionId: session.session_id,
        eventId: session.event_id,
        establishmentId: session.establishment_id,
        eventTitle: session.event_title,
        token: session.token,
        checkinUrl,
        expiresAt: session.expires_at,
        ttlSeconds
      },
      privacy: 'Le QR tourne automatiquement. Seule son empreinte cryptographique est conservée en base.'
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'checkin_session_failed' }, 400);
  }
}
