import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await import('../apps/beta/worker/index.js');
const workerSource = await readFile('apps/beta/worker/index.js', 'utf8');

assert.equal(
  typeof worker.default?.fetch,
  'function',
  'Le Worker BETA doit exporter une fonction fetch chargeable.'
);
assert.match(
  workerSource,
  /img-src[^;]+https:\/\/\*\.supabase\.co/,
  'La CSP doit autoriser les aperçus privés signés provenant de Supabase Storage.'
);

console.log('Velvet Worker import check passed.');
