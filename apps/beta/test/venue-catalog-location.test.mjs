import assert from 'node:assert/strict';
import test from 'node:test';
import { enrichVenueCoordinates } from '../../../functions/api/members/directory.js';
import { seededVenueCoordinates } from '../../../functions/api/members/venue-geocoding.js';

const venue = {
  address_public: '9 rue Chemin Vert, Lens, France',
  city: 'Lens',
  country_code: 'FR',
  latitude: null,
  longitude: null
};

test('retrouve les coordonnées d’une entreprise depuis son adresse publique', () => {
  const coordinates = seededVenueCoordinates(venue);
  assert.equal(coordinates?.precision, 'address');
  assert.equal(coordinates?.latitude, 50.435198);
  assert.equal(coordinates?.longitude, 2.84029);
});

test('enrichit le catalogue sans confondre des coordonnées nulles avec 0,0', () => {
  const enriched = enrichVenueCoordinates(venue);
  assert.equal(enriched.latitude, 50.435198);
  assert.equal(enriched.longitude, 2.84029);
  assert.equal(enriched.coordinate_source, 'address_seed');
});
