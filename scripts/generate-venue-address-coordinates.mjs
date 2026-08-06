import { readFile, writeFile } from 'node:fs/promises';

const CATALOG_PATH = 'infra/supabase/migrations/0020_velvet_venue_catalog.sql';
const OUTPUT_PATH = 'functions/api/members/venue-address-coordinates.js';
const MARKER = '$velvet_catalog$';

function addressKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function addressQuery(venue) {
  const address = String(venue.address_public || '').trim();
  if (!address) return '';
  const normalizedAddress = addressKey(address);
  const supplements = [
    venue.postal_code,
    venue.city,
    venue.country_code === 'BE' ? 'Belgique' : venue.country_code === 'FR' ? 'France' : venue.country_code
  ].filter((part) => part && !normalizedAddress.includes(addressKey(part)));
  return [address, ...supplements].join(', ').slice(0, 300);
}

function catalogRows(source) {
  const start = source.indexOf(MARKER);
  const end = source.indexOf(MARKER, start + MARKER.length);
  if (start < 0 || end < 0) throw new Error('Catalogue Zwit introuvable');
  return JSON.parse(source.slice(start + MARKER.length, end));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retry(task, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await task();
      if (result) return result;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
    await sleep(attempt * 500);
  }
  return null;
}

function featureCoordinates(feature) {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function coordinatesMatchCountry(coordinates, countryCode) {
  if (countryCode === 'FR') {
    return coordinates.latitude >= 41 && coordinates.latitude <= 52
      && coordinates.longitude >= -6 && coordinates.longitude <= 11;
  }
  if (countryCode === 'BE') {
    return coordinates.latitude >= 49.4 && coordinates.latitude <= 51.7
      && coordinates.longitude >= 2.3 && coordinates.longitude <= 6.5;
  }
  return false;
}

async function geocodeFrance(query) {
  return retry(async () => {
    const response = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query)}&limit=1`);
    if (!response.ok) throw new Error(`IGN ${response.status}`);
    const feature = (await response.json())?.features?.[0];
    const coordinates = featureCoordinates(feature);
    if (!coordinates || !coordinatesMatchCountry(coordinates, 'FR')) return null;
    const type = feature?.properties?._type || feature?.properties?.type || '';
    return {
      ...coordinates,
      precision: ['address', 'housenumber'].includes(type) ? 'address' : type === 'street' ? 'street' : 'locality',
      provider: 'ign_ban'
    };
  });
}

function belgiumPrecision(row) {
  const type = String(row?.addresstype || row?.type || '');
  if (['house', 'building', 'amenity', 'shop', 'tourism', 'leisure'].includes(type)) return 'address';
  if (['road', 'pedestrian', 'residential'].includes(type)) return 'street';
  return 'locality';
}

async function geocodeBelgium(query) {
  const result = await retry(async () => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=be&addressdetails=1&q=${encodeURIComponent(query)}`,
      {
        headers: {
          accept: 'application/json',
          'accept-language': 'fr',
          'user-agent': 'Velvet-BETA/1.0 venue-address-geocoder'
        }
      }
    );
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const row = (await response.json())?.[0];
    const latitude = Number(row?.lat);
    const longitude = Number(row?.lon);
    const coordinates = { latitude, longitude };
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !coordinatesMatchCountry(coordinates, 'BE')) return null;
    return {
      ...coordinates,
      precision: belgiumPrecision(row),
      provider: 'openstreetmap_nominatim'
    };
  });
  await sleep(1100);
  return result;
}

async function mapConcurrent(rows, concurrency, mapper) {
  const results = new Array(rows.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < rows.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(rows[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  return results;
}

const catalog = catalogRows(await readFile(CATALOG_PATH, 'utf8'))
  .filter((venue) => venue.verification_status !== 'closed' && venue.address_public);
const unique = [...new Map(catalog.map((venue) => [addressKey(addressQuery(venue)), venue])).values()]
  .filter((venue) => !['france', 'belgique', 'belgique belgique'].includes(addressKey(addressQuery(venue))));
const french = unique.filter((venue) => venue.country_code === 'FR');
const belgian = unique.filter((venue) => venue.country_code === 'BE');
const entries = [];

await mapConcurrent(french, 12, async (venue, index) => {
  const query = addressQuery(venue);
  const result = await geocodeFrance(query);
  if (result) entries.push([addressKey(query), result]);
  if ((index + 1) % 25 === 0) process.stdout.write(`France ${index + 1}/${french.length}\n`);
});

for (let index = 0; index < belgian.length; index += 1) {
  const venue = belgian[index];
  const query = addressQuery(venue);
  const result = await geocodeBelgium(query);
  if (result) entries.push([addressKey(query), result]);
  if ((index + 1) % 10 === 0) process.stdout.write(`Belgique ${index + 1}/${belgian.length}\n`);
}

entries.sort(([left], [right]) => left.localeCompare(right, 'fr'));
const body = `// Généré par scripts/generate-venue-address-coordinates.mjs.
// La clé est l’adresse publique normalisée ; aucune coordonnée du catalogue Supabase n’est utilisée.
export const VENUE_ADDRESS_COORDINATES = Object.freeze(${JSON.stringify(Object.fromEntries(entries), null, 2)});
`;
await writeFile(OUTPUT_PATH, body);
console.log(`Coordonnées dérivées de ${entries.length}/${unique.length} adresses publiques.`);
