import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { backupKey, connectionFingerprint, encryptBackup } from './backup-format.mjs';

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolveRun() : reject(new Error(`${command} a échoué (${code}).`)));
  });
}

const databaseUrl = String(process.env.VELVET_BACKUP_DATABASE_URL || '');
const output = String(process.env.VELVET_BACKUP_OUTPUT || '');
if (!databaseUrl || !output) throw new Error('VELVET_BACKUP_DATABASE_URL et VELVET_BACKUP_OUTPUT sont obligatoires.');
const key = backupKey(process.env.VELVET_BACKUP_KEY);
const temp = await mkdtemp(join(tmpdir(), 'velvet-backup-'));
const dump = join(temp, 'database.dump');
try {
  await run('pg_dump', ['--dbname', databaseUrl, '--format=custom', '--no-owner', '--no-privileges', '--file', dump]);
  const encrypted = encryptBackup(await readFile(dump), key, {
    source_fingerprint: connectionFingerprint(databaseUrl),
    dump_format: 'postgres-custom'
  });
  await writeFile(resolve(output), encrypted, { mode: 0o600, flag: 'wx' });
  console.log(`Sauvegarde chiffrée créée : ${resolve(output)}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
