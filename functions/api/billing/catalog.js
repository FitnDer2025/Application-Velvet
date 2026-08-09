import { json } from '../auth/_shared.js';
import {
  billingCatalog,
  billingResponse,
  billingSession
} from './_shared.js';

export async function onRequestGet({ request, env }) {
  try {
    const access = await billingSession(request, env);
    if (access.response) return access.response;
    return billingResponse(await billingCatalog(env, access.session), access.session);
  } catch (error) {
    return json({ error: error.message || 'billing_catalog_failed' }, 400);
  }
}
