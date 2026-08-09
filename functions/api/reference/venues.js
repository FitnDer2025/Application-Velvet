import { json } from '../auth/_shared.js';
import { cleanText, memberSession, restJson, withSession } from '../members/_shared.js';

function safeSearch(value) {
  return cleanText(value, 80).replace(/[%_(),]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const query = safeSearch(new URL(request.url).searchParams.get('q'));
    if (query.length < 2) return withSession({ results: [] }, access.session);
    const encoded = encodeURIComponent(`*${query}*`);
    const [directory, establishments] = await Promise.all([
      restJson(
        env,
        `/rest/v1/venue_directory?select=id,slug,name,kind,city,country_code,address_public,website,verification_status,source,category_primary,opening_hours_text,pricing_text,claim_status,claimed_establishment_id&public_visibility=eq.listed&verification_status=neq.closed&or=(name.ilike.${encoded},city.ilike.${encoded})&order=name.asc&limit=20`,
        access.session
      ),
      restJson(
        env,
        `/rest/v1/establishments?select=id,directory_venue_id,name,kind,city,address_public,verified_at,subscription_status&visibility=eq.published&name=ilike.${encoded}&order=name.asc&limit=20`,
        access.session
      )
    ]);
    const deduplicated = new Map();
    directory.forEach((venue) => {
      deduplicated.set(venue.name.toLocaleLowerCase('fr'), {
        ...venue,
        label: [venue.name,venue.city,venue.country_code].filter(Boolean).join(' · ')
      });
    });
    establishments.forEach((venue) => {
      deduplicated.set(venue.name.toLocaleLowerCase('fr'), {
        ...venue,
        country_code: 'FR',
        verification_status: venue.verified_at ? 'professional_verified' : 'community_confirmed',
        source: 'velvet',
        claimed_establishment_id: venue.id,
        claim_status: 'claimed',
        label: [venue.name,venue.city].filter(Boolean).join(' · ')
      });
    });
    return withSession({
      results: [...deduplicated.values()].slice(0, 12),
      attribution: '© contributeurs OpenStreetMap — ODbL'
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'venue_reference_failed' }, 400);
  }
}
