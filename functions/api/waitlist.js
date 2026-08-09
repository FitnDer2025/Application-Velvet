import { json, readJson, supabase, verifyTurnstile } from './auth/_shared.js';

const AUDIENCES = new Set(['member', 'pro']);
const MEMBER_TYPES = new Set(['couple', 'woman', 'man', 'other']);
const PROFESSIONAL_TYPES = new Set(['club', 'spa', 'love_room', 'event_organizer', 'photographer', 'other']);
const COUNTRIES = new Set(['FR', 'BE']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizedEmail(value) {
  return clean(value, 254).toLowerCase();
}

function migrationMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('register_velvet_waitlist')
    || message.includes('velvet_waitlist_entries')
    || message.includes('pgrst202')
    || message.includes('schema cache');
}

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await readJson(request);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  // Honeypot: bots receive a neutral success without creating a record.
  if (clean(input.website, 200)) return json({ ok: true });

  const audience = clean(input.audience, 20);
  const email = normalizedEmail(input.email);
  const location = clean(input.location, 90);
  const country = clean(input.country, 2).toUpperCase();
  const memberType = clean(input.memberType, 30);
  const professionalType = clean(input.professionalType, 40);
  const businessName = clean(input.businessName, 120);
  const contactName = clean(input.contactName, 100);
  const phone = clean(input.phone, 30);

  if (!AUDIENCES.has(audience) || !EMAIL.test(email) || !location || !COUNTRIES.has(country)) {
    return json({ error: EMAIL.test(email) ? 'invalid_waitlist_request' : 'invalid_email' }, 422);
  }
  if (audience === 'member' && !MEMBER_TYPES.has(memberType)) {
    return json({ error: 'invalid_waitlist_request' }, 422);
  }
  if (audience === 'pro' && (!PROFESSIONAL_TYPES.has(professionalType) || !businessName || !contactName)) {
    return json({ error: 'invalid_waitlist_request' }, 422);
  }
  if (input.adultAttestation !== true) return json({ error: 'adult_attestation_required' }, 422);
  if (input.launchConsent !== true) return json({ error: 'launch_consent_required' }, 422);

  const human = await verifyTurnstile(request, env, clean(input.turnstileToken, 4096), 'waitlist');
  if (!human.ok) return json({ error: human.error }, 400);

  const body = {
    p_audience: audience,
    p_email: email,
    p_location: location,
    p_country_code: country,
    p_member_type: audience === 'member' ? memberType : null,
    p_business_name: audience === 'pro' ? businessName : null,
    p_professional_type: audience === 'pro' ? professionalType : null,
    p_contact_name: audience === 'pro' ? contactName : null,
    p_phone: audience === 'pro' && phone ? phone : null,
    p_wants_beta: input.wantsBeta === true,
    p_adult_attestation: true,
    p_launch_consent: true,
    p_source: clean(input.source, 80) || 'direct',
    p_campaign: clean(input.campaign, 120) || null,
    p_medium: clean(input.medium, 80) || null,
    p_content: clean(input.content, 120) || null,
    p_referral_code: clean(input.referral, 32) || null
  };

  try {
    const response = await supabase(env, '/rest/v1/rpc/register_velvet_waitlist', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload?.message || payload?.hint || payload?.code || 'waitlist_registration_failed';
      throw new Error(detail);
    }
    const result = Array.isArray(payload) ? payload[0] : payload;
    const referralCode = result?.referral_code || result?.referralCode || null;
    const origin = new URL(request.url).origin;
    return json({
      ok: true,
      waitlistId: result?.id || null,
      referralCode,
      referralUrl: referralCode ? `${origin}/acces-prive/?ref=${encodeURIComponent(referralCode)}` : null,
      existing: result?.existing === true
    }, result?.existing ? 200 : 201);
  } catch (error) {
    if (migrationMissing(error)) return json({ error: 'waitlist_not_configured' }, 503);
    return json({ error: 'waitlist_registration_failed' }, 500);
  }
}
