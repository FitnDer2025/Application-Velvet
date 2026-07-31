import pg from 'pg';
import { deliveryBody, signDelivery, targetsForEvent } from './delivery.mjs';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const signingKey = Buffer.from(process.env.INTEGRATION_SIGNING_KEY_BASE64 || '', 'base64');
const webhooks = JSON.parse(process.env.INTEGRATION_WEBHOOKS_JSON || '{}');
const dryRun = process.env.OUTBOX_DRY_RUN === 'true';
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (signingKey.length < 32) throw new Error('INTEGRATION_SIGNING_KEY_BASE64 must contain at least 32 bytes');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 5,
  application_name: 'velvet-outbox-worker'
});

let storageQueueAvailability = null;

async function prepareDeliveries() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const events = await client.query(
      `SELECT * FROM outbox_events
       WHERE published_at IS NULL
       ORDER BY occurred_at
       LIMIT 25
       FOR UPDATE SKIP LOCKED`
    );
    for (const event of events.rows) {
      for (const target of targetsForEvent(event.event_type)) {
        await client.query(
          `INSERT INTO integration_deliveries (outbox_event_id, target, status)
           VALUES ($1,$2,'pending')
           ON CONFLICT (outbox_event_id, target) DO NOTHING`,
          [event.id, target]
        );
      }
    }
    await client.query('COMMIT');
    return events.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function claimDeliveries() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deliveries = await client.query(
      `SELECT d.id AS delivery_id, d.target, d.attempts AS delivery_attempts, o.*
       FROM integration_deliveries d
       JOIN outbox_events o ON o.id = d.outbox_event_id
       WHERE (
         (d.status IN ('pending','failed') AND d.next_attempt_at <= now())
         OR (d.status = 'delivering' AND d.claimed_at < now() - interval '5 minutes')
       )
       ORDER BY o.occurred_at
       LIMIT 25
       FOR UPDATE OF d SKIP LOCKED`
    );
    if (deliveries.rowCount) {
      await client.query(
        `UPDATE integration_deliveries
         SET status = 'delivering', claimed_at = now(), attempts = attempts + 1
         WHERE id = ANY($1::uuid[])`,
        [deliveries.rows.map((row) => row.delivery_id)]
      );
    }
    await client.query('COMMIT');
    return deliveries.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deliverBatch() {
  const deliveries = await claimDeliveries();
  for (const event of deliveries) {
    const body = deliveryBody(event);
    try {
      if (!dryRun) {
        const endpoint = webhooks[event.target];
        if (!endpoint) throw new Error(`No webhook configured for ${event.target}`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-velvet-event-id': event.id,
            'x-velvet-signature': signDelivery(body, signingKey)
          },
          body,
          signal: AbortSignal.timeout(8_000)
        });
        if (!response.ok) throw new Error(`Webhook ${event.target} returned ${response.status}`);
      }
      await pool.query(
        `UPDATE integration_deliveries
         SET status = 'delivered', delivered_at = now(), last_error = NULL
         WHERE id = $1`,
        [event.delivery_id]
      );
    } catch (error) {
      const delaySeconds = Math.min(3600, 2 ** Math.min(event.delivery_attempts + 1, 10));
      await pool.query(
        `UPDATE integration_deliveries
         SET status = 'failed',
             next_attempt_at = now() + make_interval(secs => $2),
             last_error = $3
         WHERE id = $1`,
        [event.delivery_id, delaySeconds, String(error.message).slice(0, 1000)]
      );
    }
  }
  await pool.query(
    `UPDATE outbox_events o SET published_at = now()
     WHERE o.published_at IS NULL
       AND EXISTS (SELECT 1 FROM integration_deliveries d WHERE d.outbox_event_id = o.id)
       AND NOT EXISTS (
         SELECT 1 FROM integration_deliveries d
         WHERE d.outbox_event_id = o.id AND d.status <> 'delivered'
       )`
  );
  return deliveries.length;
}

async function storageQueueAvailable() {
  if (storageQueueAvailability !== null) return storageQueueAvailability;
  const result = await pool.query("select to_regclass('public.storage_deletion_queue') is not null as available");
  storageQueueAvailability = Boolean(result.rows[0]?.available);
  return storageQueueAvailability;
}

async function claimStorageDeletions() {
  if (!supabaseUrl || !supabaseServiceRoleKey || !(await storageQueueAvailable())) return [];
  const result = await pool.query(
    `WITH candidates AS (
       SELECT id
       FROM public.storage_deletion_queue
       WHERE (
         (status IN ('pending','failed') AND next_attempt_at <= now())
         OR (status='processing' AND claimed_at < now() - interval '10 minutes')
       )
       ORDER BY created_at
       LIMIT 25
       FOR UPDATE SKIP LOCKED
     )
     UPDATE public.storage_deletion_queue q
     SET status='processing', claimed_at=now(), attempts=attempts+1
     FROM candidates c
     WHERE q.id=c.id
     RETURNING q.*`
  );
  return result.rows;
}

function storageObjectUrl(item) {
  const encodedPath = String(item.storage_path || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${supabaseUrl}/storage/v1/object/${encodeURIComponent(item.bucket_name)}/${encodedPath}`;
}

async function deleteStorageBatch() {
  const items = await claimStorageDeletions();
  for (const item of items) {
    try {
      const response = await fetch(storageObjectUrl(item), {
        method: 'DELETE',
        headers: {
          apikey: supabaseServiceRoleKey,
          authorization: `Bearer ${supabaseServiceRoleKey}`
        },
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok && response.status !== 404) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Storage deletion returned ${response.status}: ${detail.slice(0, 500)}`);
      }
      await pool.query(
        `UPDATE public.storage_deletion_queue
         SET status='completed', completed_at=now(), last_error=null
         WHERE id=$1`,
        [item.id]
      );
    } catch (error) {
      const delaySeconds = Math.min(21600, 2 ** Math.min(item.attempts + 1, 14));
      await pool.query(
        `UPDATE public.storage_deletion_queue
         SET status='failed',
             next_attempt_at=now()+make_interval(secs => $2),
             last_error=$3
         WHERE id=$1`,
        [item.id, delaySeconds, String(error.message).slice(0, 1000)]
      );
    }
  }
  return items.length;
}

async function cycle() {
  try {
    const prepared = await prepareDeliveries();
    const delivered = await deliverBatch();
    const storageDeleted = await deleteStorageBatch();
    if (prepared || delivered || storageDeleted) {
      console.log(JSON.stringify({
        level: 'info',
        event: 'worker.cycle',
        prepared,
        delivered,
        storageDeleted,
        dryRun
      }));
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'worker.cycle_failed', message: error.message }));
  }
}

const timer = setInterval(cycle, 1_000);
await cycle();

async function shutdown(signal) {
  clearInterval(timer);
  console.log(JSON.stringify({ level: 'info', event: 'worker.shutdown', signal }));
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
