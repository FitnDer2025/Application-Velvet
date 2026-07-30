import {
  accountContext,
  json,
  refreshSession,
  sessionResponse,
  supabase
} from '../auth/_shared.js';

export const FALLBACK_CATALOG = {
  provider: {
    configured: false,
    code: 'unconfigured',
    checkoutMode: 'hosted'
  },
  plans: [
    {
      code: 'member_discovery',
      label: 'Velvet Découverte',
      audience: 'member',
      features: {
        advanced_search: false,
        saved_searches: false,
        new_conversations_per_week: 3,
        follow_limit: 10,
        profile_ai_lifetime: 1
      }
    },
    {
      code: 'member_signature',
      label: 'Velvet Signature',
      audience: 'member',
      features: {
        advanced_search: true,
        saved_searches: true,
        new_conversations_per_week: null,
        follow_limit: null,
        profile_ai_per_month: 20
      }
    },
    {
      code: 'pro_workspace',
      label: 'Velvet Pro',
      audience: 'pro',
      features: {
        managed_establishments: 1,
        event_commission_percent: 0,
        workspace: true
      }
    }
  ],
  prices: [
    { price_code: 'signature_monthly_eur', plan_code: 'member_signature', amount_cents: 1490, currency: 'EUR', interval_unit: 'month', interval_count: 1 },
    { price_code: 'signature_quarterly_eur', plan_code: 'member_signature', amount_cents: 3490, currency: 'EUR', interval_unit: 'month', interval_count: 3 },
    { price_code: 'signature_annual_eur', plan_code: 'member_signature', amount_cents: 9990, currency: 'EUR', interval_unit: 'year', interval_count: 1 },
    { price_code: 'pro_monthly_eur', plan_code: 'pro_workspace', amount_cents: 3990, currency: 'EUR', interval_unit: 'month', interval_count: 1 },
    { price_code: 'pro_annual_eur', plan_code: 'pro_workspace', amount_cents: 39900, currency: 'EUR', interval_unit: 'year', interval_count: 1 }
  ]
};

export async function billingSession(request, env) {
  const session = await refreshSession(request, env);
  if (!session) return { response: json({ error: 'authentication_required' }, 401) };
  const account = await accountContext(env, session);
  if (!account || account.status !== 'active') {
    return { response: json({ error: 'account_access_required' }, 403) };
  }
  return { session, account };
}

export function providerState(env) {
  const code = String(env.VELVET_BILLING_PROVIDER || '').trim().toLowerCase();
  return {
    configured: false,
    code: code || 'unconfigured',
    checkoutMode: 'hosted'
  };
}

export async function billingCatalog(env, session) {
  const [planResponse, priceResponse] = await Promise.all([
    supabase(
      env,
      '/rest/v1/billing_plans?select=code,label,audience,features&active=eq.true&order=code.asc',
      {},
      session.access_token
    ),
    supabase(
      env,
      '/rest/v1/billing_prices?select=id,price_code,plan_code,currency,amount_cents,interval_unit,interval_count&active=eq.true&order=amount_cents.asc',
      {},
      session.access_token
    )
  ]);
  if (!planResponse.ok || !priceResponse.ok) {
    return {
      ...FALLBACK_CATALOG,
      provider: providerState(env),
      migrationPending: true
    };
  }
  return {
    provider: providerState(env),
    plans: await planResponse.json(),
    prices: await priceResponse.json(),
    migrationPending: false
  };
}

export function billingResponse(payload, session, status = 200) {
  return sessionResponse(payload, session, status);
}
