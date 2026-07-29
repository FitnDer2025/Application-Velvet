import assert from 'node:assert/strict';

const worker = await import('../apps/beta/worker/index.js');

assert.equal(
  typeof worker.default?.fetch,
  'function',
  'Le Worker BETA doit exporter une fonction fetch chargeable.'
);

console.log('Velvet Worker import check passed.');
