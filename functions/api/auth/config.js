import { json } from './_shared.js';

export async function onRequestGet({ env }) {
  return json({
    turnstileSiteKey: String(env.TURNSTILE_SITE_KEY || '').trim() || null,
    passwordPolicy: {
      minLength: 12,
      uppercase: true,
      lowercase: true,
      number: true,
      symbol: true
    }
  });
}
