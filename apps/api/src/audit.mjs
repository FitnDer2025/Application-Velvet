import { createHmac } from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function appendAudit(client, key, event) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('velvet_audit_chain'))");
  const previous = await client.query(
    'SELECT event_hash FROM audit_events ORDER BY sequence_number DESC LIMIT 1 FOR UPDATE'
  );
  const previousHash = previous.rows[0]?.event_hash || 'GENESIS';
  const occurredAt = new Date().toISOString();
  const payload = {
    previousHash,
    occurredAt,
    actorUserId: event.actorUserId || null,
    actorType: event.actorType || 'system',
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId || null,
    metadata: event.metadata || {},
    requestId: event.requestId || null
  };
  const eventHash = createHmac('sha256', key).update(canonical(payload)).digest('hex');
  await client.query(
    `INSERT INTO audit_events
      (occurred_at, actor_user_id, actor_type, action, entity_type, entity_id, metadata, request_id, previous_hash, event_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      occurredAt,
      payload.actorUserId,
      payload.actorType,
      payload.action,
      payload.entityType,
      payload.entityId,
      payload.metadata,
      payload.requestId,
      previousHash,
      eventHash
    ]
  );
  return eventHash;
}

export async function appendOutbox(client, eventType, aggregateType, aggregateId, payload) {
  await client.query(
    `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1,$2,$3,$4)`,
    [eventType, aggregateType, aggregateId, payload]
  );
}
