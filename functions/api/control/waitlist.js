import { json, readJson } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from '../members/_shared.js';

const READ_ROLES = new Set(['admin', 'direction', 'moderator', 'support', 'auditor']);
const WRITE_ROLES = new Set(['admin', 'direction']);
const STATUSES = new Set(['registered', 'qualified', 'invited', 'converted', 'withdrawn', 'rejected']);
const AUDIENCES = new Set(['member', 'pro']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function access(request, env) {
  const result = await memberSession(request, env, { allowUnverified: true });
  if (result.response) return result;
  if (!result.account.roles.some((role) => READ_ROLES.has(role))) {
    return { response: json({ error: 'control_access_required' }, 403) };
  }
  return result;
}

function canWrite(result) {
  return result.account.roles.some((role) => WRITE_ROLES.has(role));
}

function missingMigration(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('control_waitlist_dashboard')
    || message.includes('control_update_waitlist_status')
    || message.includes('velvet_waitlist_entries')
    || message.includes('pgrst202')
    || message.includes('schema cache');
}

export async function onRequestGet({ request, env }) {
  const current = await access(request, env);
  if (current.response) return current.response;
  const url = new URL(request.url);
  const audienceValue = cleanText(url.searchParams.get('audience'), 20);
  const statusValue = cleanText(url.searchParams.get('status'), 20);
  const search = cleanText(url.searchParams.get('search'), 120);
  const audience = AUDIENCES.has(audienceValue) ? audienceValue : null;
  const status = STATUSES.has(statusValue) ? statusValue : null;
  const limit = Math.min(250, Math.max(1, Number(url.searchParams.get('limit') || 100)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));

  try {
    const dashboard = await restJson(env, '/rest/v1/rpc/control_waitlist_dashboard', current.session, {
      method: 'POST',
      body: JSON.stringify({
        p_audience: audience,
        p_status: status,
        p_search: search || null,
        p_limit: limit,
        p_offset: offset
      })
    });
    return withSession({
      ...dashboard,
      permissions: { canRead: true, canUpdate: canWrite(current) }
    }, current.session);
  } catch (error) {
    if (missingMigration(error)) {
      return withSession({
        error: 'waitlist_not_configured',
        migrationPending: true,
        metrics: { total: 0, members: 0, professionals: 0, last7Days: 0, invited: 0, converted: 0, consented: 0 },
        entries: [],
        topTerritories: [],
        topSources: [],
        permissions: { canRead: true, canUpdate: canWrite(current) }
      }, current.session, 503);
    }
    return withSession({ error: 'waitlist_dashboard_failed' }, current.session, 500);
  }
}

export async function onRequestPatch({ request, env }) {
  const current = await access(request, env);
  if (current.response) return current.response;
  if (!canWrite(current)) return withSession({ error: 'waitlist_write_forbidden' }, current.session, 403);

  let input;
  try {
    input = await readJson(request);
  } catch {
    return withSession({ error: 'invalid_json' }, current.session, 400);
  }
  const id = cleanText(input.id, 64);
  const status = cleanText(input.status, 20);
  if (!UUID.test(id) || !STATUSES.has(status)) {
    return withSession({ error: 'invalid_waitlist_update' }, current.session, 422);
  }

  try {
    const result = await restJson(env, '/rest/v1/rpc/control_update_waitlist_status', current.session, {
      method: 'POST',
      body: JSON.stringify({ p_id: id, p_status: status })
    });
    return withSession({ ok: true, entry: result }, current.session);
  } catch (error) {
    if (missingMigration(error)) return withSession({ error: 'waitlist_not_configured' }, current.session, 503);
    return withSession({ error: 'waitlist_update_failed' }, current.session, 500);
  }
}
