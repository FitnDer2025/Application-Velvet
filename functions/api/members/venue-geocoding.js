import { VENUE_ADDRESS_COORDINATES } from './venue-address-coordinates.js';

const venueGeocodeCache = new Map();
let belgiumGeocodeQueue = Promise.resolve();

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function venueAddressKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function venueAddressQuery(venue) {
  const address = String(venue?.address_public || '').trim();
  if (!address) return '';
  const normalizedAddress = venueAddressKey(address);
  const supplements = [
    venue?.postal_code,
    venue?.city,
    venue?.country_code === 'BE' ? 'Belgique' : venue?.country_code === 'FR' ? 'France' : venue?.country_code
  ].filter((part) => part && !normalizedAddress.includes(venueAddressKey(part)));
  return [address, ...supplements].join(', ').slice(0, 300);
}

export function seededVenueCoordinates(venue) {
  const key = venueAddressKey(venueAddressQuery(venue));
  const coordinates = VENUE_ADDRESS_COORDINATES[key];
  return coordinates ? { ...coordinates, source: 'address_seed' } : null;
}

function coordinatesFromFeature(feature) {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const longitude = finite(coordinates[0]);
  const latitude = finite(coordinates[1]);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
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

async function geocodeFrenchAddress(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(
      `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: { accept: 'application/json' },
        signal: controller.signal
      }
    );
    if (!response.ok) return null;
    const feature = (await response.json())?.features?.[0];
    const coordinates = coordinatesFromFeature(feature);
    if (!coordinates || !coordinatesMatchCountry(coordinates, 'FR')) return null;
    const featureType = feature?.properties?._type || feature?.properties?.type || '';
    return {
      ...coordinates,
      precision: ['address', 'housenumber'].includes(featureType) ? 'address' : featureType === 'street' ? 'street' : 'locality',
      provider: 'ign_ban'
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function belgiumPrecision(row) {
  const type = String(row?.addresstype || row?.type || '');
  if (['house', 'building', 'amenity', 'shop', 'tourism', 'leisure'].includes(type)) return 'address';
  if (['road', 'pedestrian', 'residential'].includes(type)) return 'street';
  return 'locality';
}

async function requestBelgianAddress(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=be&addressdetails=1&q=${encodeURIComponent(query)}`,
      {
        headers: {
          accept: 'application/json',
          'accept-language': 'fr',
          'user-agent': 'Velvet-BETA/1.0 venue-address-geocoder'
        },
        signal: controller.signal
      }
    );
    if (!response.ok) return null;
    const row = (await response.json())?.[0];
    const latitude = finite(row?.lat);
    const longitude = finite(row?.lon);
    const coordinates = { latitude, longitude };
    if (latitude === null || longitude === null || !coordinatesMatchCountry(coordinates, 'BE')) return null;
    return {
      ...coordinates,
      precision: belgiumPrecision(row),
      provider: 'openstreetmap_nominatim'
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeBelgianAddress(query) {
  const task = belgiumGeocodeQueue.then(() => requestBelgianAddress(query));
  belgiumGeocodeQueue = task.then(
    () => new Promise((resolve) => setTimeout(resolve, 1100)),
    () => new Promise((resolve) => setTimeout(resolve, 1100))
  );
  return task;
}

export async function geocodeVenueAddress(venue) {
  const query = venueAddressQuery(venue);
  const key = venueAddressKey(query);
  if (!key || ['france', 'belgique', 'belgique belgique'].includes(key)) return null;
  const seeded = seededVenueCoordinates(venue);
  if (seeded) return seeded;
  if (venueGeocodeCache.has(key)) return venueGeocodeCache.get(key);

  const task = (venue.country_code === 'FR'
    ? geocodeFrenchAddress(query)
    : venue.country_code === 'BE'
      ? geocodeBelgianAddress(query)
      : Promise.resolve(null))
    .then((result) => result ? { ...result, source: 'address_runtime' } : null);
  venueGeocodeCache.set(key, task);
  return task;
}
