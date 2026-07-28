import { createHmac, timingSafeEqual } from 'node:crypto';

const ROUTES = Object.freeze({
  'user.registered': ['members', 'control'],
  'member_profile.updated': ['members', 'control'],
  'establishment.updated': ['members', 'pro', 'control'],
  'event.created': ['members', 'pro', 'control'],
  'event.registration_created': ['members', 'pro', 'control'],
  'moderation.case_created': ['control'],
  'moderation.case_resolved': ['control']
});

export function targetsForEvent(eventType) {
  return ROUTES[eventType] || ['control'];
}

export function deliveryBody(event) {
  return JSON.stringify({
    id: event.id,
    type: event.event_type,
    aggregate: {
      type: event.aggregate_type,
      id: event.aggregate_id
    },
    occurredAt: event.occurred_at,
    payload: event.payload
  });
}

export function signDelivery(body, key) {
  return `sha256=${createHmac('sha256', key).update(body).digest('hex')}`;
}

export function verifyDelivery(body, signature, key) {
  const expected = Buffer.from(signDelivery(body, key));
  const actual = Buffer.from(String(signature));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
