import { json } from '../auth/_shared.js';

const API_URL = 'https://geo.api.gouv.fr/communes';
const FRENCH_REGIONS = {
  '11': 'Île-de-France',
  '24': 'Centre-Val de Loire',
  '27': 'Bourgogne-Franche-Comté',
  '28': 'Normandie',
  '32': 'Hauts-de-France',
  '44': 'Grand Est',
  '52': 'Pays de la Loire',
  '53': 'Bretagne',
  '75': 'Nouvelle-Aquitaine',
  '76': 'Occitanie',
  '84': 'Auvergne-Rhône-Alpes',
  '93': 'Provence-Alpes-Côte d’Azur',
  '94': 'Corse'
};

function coordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function belgianLocations(query) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '8',
    countrycodes: 'be',
    addressdetails: '1',
    q: query
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      accept: 'application/json',
      'accept-language': 'fr',
      'user-agent': 'Velvet-BETA/1.0 location-reference'
    },
    cf: { cacheEverything: true, cacheTtl: 86400 }
  });
  if (!response.ok) return [];
  return (await response.json()).map((row) => {
    const address = row.address || {};
    const city = address.city || address.town || address.village || address.municipality || address.city_district || row.name;
    const postalCode = address.postcode || '';
    const region = address['ISO3166-2-lvl4'] === 'BE-BRU'
      ? 'Bruxelles-Capitale'
      : address['ISO3166-2-lvl4'] === 'BE-VLG'
        ? 'Flandre'
        : address['ISO3166-2-lvl4'] === 'BE-WAL'
          ? 'Wallonie'
          : address.state || '';
    return {
      city,
      postalCode,
      countryCode: 'BE',
      departmentCode: address.province || '',
      region,
      latitude: coordinate(row.lat),
      longitude: coordinate(row.lon),
      label: [postalCode, city].filter(Boolean).join(' · ')
    };
  }).filter((row) => row.city && row.latitude !== null && row.longitude !== null);
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const query = String(url.searchParams.get('q') || '').trim().slice(0, 80);
    const country = url.searchParams.get('country') === 'BE' ? 'BE' : 'FR';
    if (query.length < 2) return json({ results: [] });
    if (country === 'BE') {
      return json({ results: await belgianLocations(query) }, 200, {
        'cache-control': 'public, max-age=3600, s-maxage=86400'
      });
    }

    const params = new URLSearchParams({
      fields: 'nom,code,codesPostaux,codeDepartement,codeRegion,centre',
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
        countryCode: 'FR',
        departmentCode: commune.codeDepartement,
        region: FRENCH_REGIONS[commune.codeRegion] || '',
        inseeCode: commune.code,
        latitude: coordinate(commune.centre?.coordinates?.[1]),
        longitude: coordinate(commune.centre?.coordinates?.[0]),
        label: `${postalCode} · ${commune.nom}`
      })))
      .filter((commune) => commune.latitude !== null && commune.longitude !== null)
      .slice(0, 12);

    return json({ results }, 200, {
      'cache-control': 'public, max-age=3600, s-maxage=86400'
    });
  } catch {
    return json({ results: [] }, 502);
  }
}
