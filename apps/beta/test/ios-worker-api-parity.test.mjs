import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const IOS_ROOT = path.join(ROOT, 'ios', 'Velvet');
const WORKER_PATH = path.join(ROOT, 'apps', 'beta', 'worker', 'index.js');

function filesUnder(directory, extension) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(target, extension);
    return entry.isFile() && target.endsWith(extension) ? [target] : [];
  });
}

function iosCalls() {
  const calls = new Map();
  const callPattern = /\.(get|post|delete|patch|upload|postWithoutResponse)\s*\(\s*"(\/api\/[^"?]+)(?:\?[^\"]*)?"/gms;
  for (const file of filesUnder(IOS_ROOT, '.swift')) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(callPattern)) {
      const swiftMethod = match[1];
      const method = swiftMethod === 'get' ? 'GET'
        : swiftMethod === 'delete' ? 'DELETE'
          : swiftMethod === 'patch' ? 'PATCH'
            : 'POST';
      const key = `${method} ${match[2]}`;
      const locations = calls.get(key) || [];
      locations.push(path.relative(ROOT, file));
      calls.set(key, locations);
    }
  }
  return calls;
}

function workerRoutes() {
  const source = fs.readFileSync(WORKER_PATH, 'utf8');
  return new Set([...source.matchAll(/\['(GET|POST|DELETE|PATCH) (\/api\/[^']+)'\s*,/g)].map((match) => `${match[1]} ${match[2]}`));
}

test('every iOS API call is actually routed by the Cloudflare Worker', () => {
  const calls = iosCalls();
  const routes = workerRoutes();
  const missing = [...calls.entries()]
    .filter(([key]) => !routes.has(key))
    .map(([key, files]) => `${key} <- ${[...new Set(files)].join(', ')}`)
    .sort();

  assert.deepEqual(
    missing,
    [],
    `iOS contains API calls that compile but are not exposed by apps/beta/worker/index.js:\n${missing.join('\n')}`
  );
});
