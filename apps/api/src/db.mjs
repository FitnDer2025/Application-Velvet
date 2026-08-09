import pg from 'pg';

const { Pool } = pg;

export function createDatabase(config) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    application_name: 'velvet-api'
  });

  pool.on('error', (error) => {
    console.error(JSON.stringify({ level: 'error', event: 'postgres.pool.error', message: error.message }));
  });

  return {
    query: (text, values = []) => pool.query(text, values),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    health: async () => {
      const result = await pool.query('SELECT now() AS now');
      return result.rows[0];
    },
    close: () => pool.end()
  };
}
