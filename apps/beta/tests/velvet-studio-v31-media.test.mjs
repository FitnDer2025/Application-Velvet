import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const beta = resolve(here, '..');
const root = resolve(beta, '../..');

const [api, media, compat, build] = await Promise.all([
  readFile(resolve(root, 'functions/api/control/studio-media.js'), 'utf8'),
  readFile(resolve(beta, 'static/assets/velvet-studio-v31-media.js'), 'utf8'),
  readFile(resolve(beta, 'static/assets/velvet-studio-v31-compat.js'), 'utf8'),
  readFile(resolve(beta, 'scripts/build.mjs'), 'utf8')
]);

assert.match(api, /CONTROL_ROLES/);
assert.match(api, /env\.AI\.run\(IMAGE_MODEL/);
assert.match(api, /@cf\/black-forest-labs\/flux-1-schnell/);
assert.match(api, /fictional adults over 30/i);
assert.match(api, /studioOnly: true/);
assert.match(media, /indexedDB\.open/);
assert.match(media, /data-v31-media-tab/);
assert.match(media, /couple_lille/);
assert.match(media, /MediaRecorder/);
assert.match(media, /Créer le clip/);
assert.match(compat, /data-v31-video/);

const sprint1 = build.indexOf('velvet-studio-sprint1.js');
const v2 = build.indexOf('velvet-studio-v2.js');
const v3 = build.indexOf('velvet-studio-v3.js');
const v31 = build.indexOf('velvet-studio-v31-media.js');
const recovery = build.indexOf('velvet-control-scroll-recovery.js');
assert.ok(sprint1 < v2 && v2 < v3 && v3 < v31 && v31 < recovery, 'ordre de chargement Studio invalide');

console.log('Velvet Studio V3.1 media: 13 contrôles réussis.');
