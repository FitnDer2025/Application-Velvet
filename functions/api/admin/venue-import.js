import { json } from '../auth/_shared.js';
import { memberSession, restJson, withSession } from '../members/_shared.js';

function overpassQuery(countryCode) {
  return `[out:json][timeout:60];
area["ISO3166-1"="${countryCode}"][admin_level=2]->.country;
(
  nwr["amenity"="swingerclub"](area.country);
);
out center tags;`;
}

async function fetchCountry(countryCode) {
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'user-agent': 'Velvet-BETA/1.0 venue-directory'
    },
    body: `data=${encodeURIComponent(overpassQuery(countryCode))}`
  });
  if (!response.ok) throw new Error(`overpass_${countryCode.toLowerCase()}_failed`);
  const payload = await response.json();
  return (payload.elements || []).map((element) => ({ ...element, countryCode }));
}

function venueKind(tags) {
  const text = `${tags.name || ''} ${tags.description || ''} ${tags.leisure || ''}`.toLowerCase();
  return /(spa|sauna|hammam)/.test(text) ? 'spa' : 'club';
}

function address(tags) {
  return [
    [tags['addr:housenumber'],tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:postcode'],
    tags['addr:city']
  ].filter(Boolean).join(', ');
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    if (!access.account.roles.includes('admin')) {
      return json({ error: 'admin_access_required' }, 403);
    }
    const elements = (await Promise.all(['FR','BE'].map(fetchCountry))).flat();
    const rows = elements
      .filter((element) => String(element.tags?.name || '').trim())
      .map((element) => {
        const tags = element.tags || {};
        return {
          source: 'openstreetmap',
          source_id: `${element.type}/${element.id}`,
          name: String(tags.name).trim().slice(0, 180),
          kind: venueKind(tags),
          city: String(tags['addr:city'] || '').trim().slice(0, 120) || null,
          country_code: element.countryCode,
          address_public: address(tags) || null,
          latitude: element.lat ?? element.center?.lat ?? null,
          longitude: element.lon ?? element.center?.lon ?? null,
          website: String(tags.website || tags['contact:website'] || '').trim().slice(0, 500) || null,
          verification_status: 'source_only',
          source_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
    if (rows.length) {
      await restJson(
        env,
        '/rest/v1/venue_directory?on_conflict=source,source_id',
        access.session,
        {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(rows)
        }
      );
    }
    return withSession({
      ok: true,
      imported: rows.length,
      source: 'OpenStreetMap',
      license: 'ODbL'
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'venue_import_failed' }, 400);
  }
}
