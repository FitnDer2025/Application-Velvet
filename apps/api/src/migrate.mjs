import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { createDatabase } from './db.mjs';

export async function migrate(database, directory = resolve(fileURLToPath(new URL('../../../infra/postgres/migrations/', import.meta.url)))) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const exists = await database.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (exists.rowCount) continue;
    const sql = await readFile(resolve(directory, name), 'utf8');
    await database.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    });
    console.log(JSON.stringify({ level: 'info', event: 'migration.applied', name }));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const database = createDatabase(config);
  try {
    await migrate(database);
  } finally {
    await database.close();
  }
}
