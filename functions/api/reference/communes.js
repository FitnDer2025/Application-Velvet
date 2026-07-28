import { json } from '../auth/_shared.js';

const API_URL = 'https://geo.api.gouv.fr/communes';

export async function onRequestGet({ request }) {
  try {
    const query = String(new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80);
    if (query.length < 2) return json({ results: [] });

    const params = new URLSearchParams({
      fields: 'nom,code,codesPostaux,codeDepartement',
      format: 'json',
      geometry: 'centre'
    });
    if (/^\d{2,5}$/.test(query)) {
      params.set('codePostal', query);
    } else {
      params.set('nom', query);
      params.set('boost', 'population');
      params.set('limit', '8');
    }

    const response = await fetch(`${API_URL}?${params}`, {
      headers: { accept: 'application/json' },
      cf: { cacheEverything: true, cacheTtl: 86400 }
    });
    if (!response.ok) return json({ results: [] }, 502);
    const communes = await response.json();
    const results = communes
      .flatMap((commune) => (commune.codesPostaux || []).map((postalCode) => ({
        city: commune.nom,
        postalCode,
        departmentCode: commune.codeDepartement,
        inseeCode: commune.code,
        label: `${postalCode} · ${commune.nom}`
      })))
      .slice(0, 12);

    return json({ results }, 200, {
      'cache-control': 'public, max-age=3600, s-maxage=86400'
    });
  } catch {
    return json({ results: [] }, 502);
  }
}
