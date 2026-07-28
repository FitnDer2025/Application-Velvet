import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { deliveryBody, signDelivery, targetsForEvent, verifyDelivery } from '../src/delivery.mjs';

test('routes shared events to the applications that consume them', () => {
  assert.deepEqual(targetsForEvent('member_profile.updated'), ['members', 'control']);
  assert.deepEqual(targetsForEvent('establishment.updated'), ['members', 'pro', 'control']);
  assert.deepEqual(targetsForEvent('unknown.event'), ['control']);
});

test('signs each integration delivery and rejects modified payloads', () => {
  const key = randomBytes(32);
  const body = deliveryBody({
    id: 'event-1',
    event_type: 'event.created',
    aggregate_type: 'event',
    aggregate_id: 'aggregate-1',
    occurred_at: '2026-07-28T10:00:00.000Z',
    payload: { title: 'Soirée fictive' }
  });
  const signature = signDelivery(body, key);
  assert.equal(verifyDelivery(body, signature, key), true);
  assert.equal(verifyDelivery(`${body}modified`, signature, key), false);
});
