import { json, readJson } from '../auth/_shared.js';
import { cleanText, restJson, withSession } from '../members/_shared.js';
import { requireControlSession } from './_security.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODERATION_ROLES = new Set(['admin', 'moderator']);
const INCIDENT_ROLES = new Set(['admin', 'direction']);

function hasAnyRole(account, allowed) {
  return account.roles.some((role) => allowed.has(role));
}

async function complianceWorkspace(env, access) {
  const [checks, reports, notices, dsrs, incidents, breaches, storageQueue, retention] = await Promise.all([
    restJson(env, '/rest/v1/rpc/control_compliance_checks', access.session, {
      method: 'POST', body: '{}'
    }),
    restJson(
      env,
      '/rest/v1/reports?select=id,reporter_user_id,subject_type,subject_id,category,description,status,source,subject_url,legal_basis,assigned_to,decision,decision_reason,action_taken,statement_of_reasons,evidence_retention_until,created_at,updated_at&order=created_at.desc&limit=500',
      access.session
    ),
    restJson(
      env,
      '/rest/v1/illegal_content_notices?select=id,reference_code,notifier_email,notifier_name,notifier_organization,subject_url,subject_type,subject_id,explanation,legal_basis,good_faith_declaration,status,assigned_to,decision_reason,created_at,decided_at&order=created_at.desc&limit=500',
      access.session
    ),
    restJson(
      env,
      '/rest/v1/data_subject_requests?select=id,user_id,request_type,status,details,requested_at,due_at,deadline_extended_to,identity_verified_at,assigned_to,decision_reason,completed_at&order=requested_at.desc&limit=500',
      access.session
    ),
    restJson(
      env,
      '/rest/v1/security_incidents?select=id,reference_code,severity,status,title,description,detected_at,contained_at,resolved_at,incident_lead,created_at,updated_at&order=detected_at.desc&limit=250',
      access.session
    ),
    restJson(
      env,
      '/rest/v1/personal_data_breaches?select=id,incident_id,data_categories,sensitive_data_involved,approximate_people_affected,risk_level,risk_assessment,cnil_notification_required,cnil_notification_deadline,cnil_notified_at,data_subject_notification_required,data_subjects_notified_at,non_notification_reason,detected_at,created_at,updated_at&order=detected_at.desc&limit=250',
      access.session
    ),
    restJson(
      env,
      '/rest/v1/storage_deletion_queue?select=id,bucket_name,storage_path,reason,status,attempts,next_attempt_at,completed_at,last_error,created_at&order=created_at.desc&limit=500',
      access.session
    ),
    restJson(
      env,
      '/rest/v1/data_retention_policies?select=code,data_category,active_retention,post_closure_retention,deletion_method,legal_basis,owner_role,requires_legal_validation,reviewed_at,next_review_at,notes&order=code.asc',
      access.session
    )
  ]);
  return { checks, reports, notices, dsrs, incidents, breaches, storageQueue, retention };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await requireControlSession(request, env);
    if (access.response) return access.response;
    return withSession({
      account: access.account,
      ...(await complianceWorkspace(env, access))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'compliance_workspace_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await requireControlSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);

    if (body.action === 'decide_report') {
      if (!hasAnyRole(access.account, MODERATION_ROLES) || !UUID.test(body.reportId || '')) {
        return withSession({ error: 'moderator_mfa_required' }, access.session, 403);
      }
      await restJson(env, '/rest/v1/rpc/control_decide_report', access.session, {
        method: 'POST',
        body: JSON.stringify({
          target_report: body.reportId,
          target_decision: body.decision,
          target_reason: cleanText(body.reason, 4000),
          target_action: body.actionTaken,
          target_legal_basis: cleanText(body.legalBasis, 4000) || null,
          target_statement: body.statement && typeof body.statement === 'object'
            ? body.statement
            : {}
        })
      });
    } else if (body.action === 'create_incident') {
      if (!hasAnyRole(access.account, INCIDENT_ROLES)) {
        return withSession({ error: 'incident_lead_required' }, access.session, 403);
      }
      const detectedAt = new Date(body.detectedAt || Date.now());
      if (Number.isNaN(detectedAt.getTime())
        || !['low', 'medium', 'high', 'critical'].includes(body.severity)) {
        return withSession({ error: 'invalid_incident' }, access.session, 400);
      }
      const referenceCode = `SEC-${detectedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await restJson(env, '/rest/v1/security_incidents', access.session, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          reference_code: referenceCode,
          severity: body.severity,
          status: 'open',
          title: cleanText(body.title, 200),
          description: cleanText(body.description, 10000),
          detected_at: detectedAt.toISOString(),
          incident_lead: access.account.userId,
          created_by: access.account.userId
        })
      });
    } else if (body.action === 'declare_breach') {
      if (!hasAnyRole(access.account, INCIDENT_ROLES) || !UUID.test(body.incidentId || '')) {
        return withSession({ error: 'incident_lead_required' }, access.session, 403);
      }
      const detectedAt = new Date(body.detectedAt || Date.now());
      if (Number.isNaN(detectedAt.getTime())
        || !['unlikely', 'risk', 'high_risk'].includes(body.riskLevel)) {
        return withSession({ error: 'invalid_breach_assessment' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/personal_data_breaches', access.session, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          incident_id: body.incidentId,
          data_categories: Array.isArray(body.dataCategories)
            ? body.dataCategories.slice(0, 30).map((item) => cleanText(item, 100)).filter(Boolean)
            : [],
          sensitive_data_involved: body.sensitiveDataInvolved === true,
          approximate_people_affected: Number.isInteger(Number(body.peopleAffected))
            ? Math.max(0, Number(body.peopleAffected))
            : null,
          risk_level: body.riskLevel,
          risk_assessment: cleanText(body.riskAssessment, 10000),
          cnil_notification_required: body.cnilNotificationRequired === true,
          data_subject_notification_required: body.dataSubjectNotificationRequired === true,
          non_notification_reason: cleanText(body.nonNotificationReason, 4000) || null,
          detected_at: detectedAt.toISOString()
        })
      });
    } else {
      return withSession({ error: 'invalid_compliance_action' }, access.session, 400);
    }

    return withSession({
      ok: true,
      ...(await complianceWorkspace(env, access))
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'compliance_action_failed' }, 400);
  }
}
