import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { backupKey, connectionFingerprint, decryptBackup } from './backup-format.mjs';

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolveRun() : reject(new Error(`${command} a échoué (${code}).`)));
  });
}

const input = String(process.env.VELVET_RESTORE_INPUT || '');
const databaseUrl = String(process.env.VELVET_RESTORE_DATABASE_URL || '');
if (!input || !databaseUrl) throw new Error('VELVET_RESTORE_INPUT et VELVET_RESTORE_DATABASE_URL sont obligatoires.');
if (process.env.VELVET_RESTORE_CONFIRM !== 'RESTORE_RECIPE_DATABASE') {
  throw new Error('Restauration refusée : confirmez avec VELVET_RESTORE_CONFIRM=RESTORE_RECIPE_DATABASE.');
}
const target = new URL(databaseUrl);
const productionLike = /prod|production/i.test(`${target.hostname}${target.pathname}`) || target.hostname.endsWith('.supabase.co');
if (productionLike && process.env.VELVET_RESTORE_PRODUCTION_CONFIRM !== 'I_UNDERSTAND_THIS_OVERWRITES_DATA') {
  throw new Error('Restauration refusée sur une cible assimilée à la production. Utilisez une base de recette isolée.');
}
const { header, plain } = decryptBackup(await readFile(input), backupKey(process.env.VELVET_BACKUP_KEY));
if (header.source_fingerprint === connectionFingerprint(databaseUrl)) {
  throw new Error('Restauration refusée : la cible correspond à la source sauvegardée.');
}
const temp = await mkdtemp(join(tmpdir(), 'velvet-restore-'));
const dump = join(temp, 'database.dump');
try {
  await writeFile(dump, plain, { mode: 0o600 });
  await run('pg_restore', ['--dbname', databaseUrl, '--clean', '--if-exists', '--no-owner', '--no-privileges', dump]);
  console.log('Restauration de recette terminée ; exécutez maintenant les contrôles d’intégrité du runbook.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
