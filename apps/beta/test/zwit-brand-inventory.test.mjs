import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  '.wrangler',
  'dist',
  'build',
  'coverage',
]);
const ignoredPaths = [
  `${path.sep}infra${path.sep}supabase${path.sep}migrations${path.sep}`,
  `${path.sep}supabase${path.sep}migrations${path.sep}`,
];
const textExtensions = new Set([
  '.html', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.jsonc',
  '.md', '.txt', '.css', '.svg', '.xml', '.plist', '.swift', '.yml', '.yaml',
]);

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute, files);
      continue;
    }
    if (!entry.isFile() || !textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    if (ignoredPaths.some((fragment) => absolute.includes(fragment))) continue;
    files.push(absolute);
  }
  return files;
}

test('inventory visible Velvet brand references before Zwit rebrand', async () => {
  const files = await walk(root);
  const matches = [];

  for (const absolute of files) {
    if ((await stat(absolute)).size > 750_000) continue;
    const content = await readFile(absolute, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/\bVelvet\b|\bVELVET\b/.test(line)) {
        matches.push(`${path.relative(root, absolute)}:${index + 1}: ${line.trim().slice(0, 240)}`);
      }
    });
  }

  console.log('\nZWIT_BRAND_INVENTORY_START');
  console.log(matches.join('\n'));
  console.log('ZWIT_BRAND_INVENTORY_END\n');
  assert.ok(matches.length >= 0);
});
