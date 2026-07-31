import {
  json,
  readJson,
  supabase,
  verifyTurnstile
} from '../auth/_shared.js';

function text(value, max) {
  return String(value || '').trim().slice(0, max);
}

function nullableUuid(value) {
  const candidate = String(value || '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const human = await verifyTurnstile(
      request,
      env,
      body.turnstileToken,
      'illegal_content_notice'
    );
    if (!human.ok) return json({ error: human.error }, 400);
    if (body.goodFaith !== true) {
      return json({ error: 'good_faith_declaration_required' }, 400);
    }

    const response = await supabase(env, '/rest/v1/rpc/submit_illegal_content_notice', {
      method: 'POST',
      body: JSON.stringify({
        target_email: text(body.email, 320),
        target_name: text(body.name, 160) || null,
        target_organization: text(body.organization, 200) || null,
        target_url: text(body.subjectUrl, 2000),
        target_subject_type: text(body.subjectType, 80) || null,
        target_subject_id: nullableUuid(body.subjectId),
        target_explanation: text(body.explanation, 10000),
        target_legal_basis: text(body.legalBasis, 4000) || null,
        target_good_faith: true
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return json({
        error: payload?.message || payload?.code || 'illegal_content_notice_failed'
      }, 400);
    }
    const saved = payload?.[0] || {};
    return json({
      ok: true,
      noticeId: saved.notice_id,
      referenceCode: saved.reference_code
    }, 201);
  } catch (error) {
    return json({ error: error.message || 'illegal_content_notice_failed' }, 400);
  }
}
