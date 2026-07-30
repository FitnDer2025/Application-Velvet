import { json, readJson } from '../auth/_shared.js';
import { restJson } from '../members/_shared.js';
import {
  billingCatalog,
  billingResponse,
  billingSession,
  providerState
} from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const access = await billingSession(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    const catalog = await billingCatalog(env, access.session);
    const price = catalog.prices.find((row) => row.price_code === String(body.priceCode || ''));
    if (!price || !['member_signature', 'pro_workspace'].includes(price.plan_code)) {
      return billingResponse({ error: 'invalid_billing_price' }, access.session, 400);
    }
    let subjectType = 'profile';
    let subjectId = null;
    if (price.plan_code === 'member_signature') {
      const memberships = await restJson(
        env,
        `/rest/v1/profile_members?select=profile_id&user_id=eq.${encodeURIComponent(access.account.userId)}&status=eq.active&limit=1`,
        access.session
      );
      subjectId = memberships?.[0]?.profile_id || null;
    } else {
      subjectType = 'establishment';
      const establishmentId = String(body.establishmentId || '');
      const staff = await restJson(
        env,
        `/rest/v1/establishment_staff?select=establishment_id&establishment_id=eq.${encodeURIComponent(establishmentId)}&user_id=eq.${encodeURIComponent(access.account.userId)}&status=eq.active&limit=1`,
        access.session
      );
      subjectId = staff?.[0]?.establishment_id || null;
    }
    if (!subjectId) {
      return billingResponse({ error: 'billing_subject_required' }, access.session, 403);
    }
    const provider = providerState(env);
    if (!provider.configured) {
      return billingResponse({
        error: 'billing_provider_not_configured',
        provider,
        priceCode: price.price_code,
        subjectType,
        subjectId
      }, access.session, 503);
    }
    return billingResponse({ error: 'billing_provider_not_configured' }, access.session, 503);
  } catch (error) {
    return json({ error: error.message || 'billing_checkout_failed' }, 400);
  }
}
