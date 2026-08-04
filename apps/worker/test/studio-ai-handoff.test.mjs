import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleSource = await readFile('apps/beta/static/assets/velvet-studio-ai-module.js', 'utf8');
const captureSource = await readFile('apps/beta/static/assets/velvet-studio-capture.js', 'utf8');

test('le scénario est transmis au studio de tournage par un job isolé', () => {
  assert.match(moduleSource, /JOB_PREFIX/);
  assert.match(moduleSource, /velvet_studio_social_job_v1/);
  assert.match(moduleSource, /createJob/);
  assert.match(moduleSource, /writeJson\(`\$\{JOB_PREFIX\}\$\{id\}`/);
  assert.match(moduleSource, /\/studio-capture\/\?job=/);
});

test('le tournage retrouve le job et ouvre le bon environnement', () => {
  assert.match(captureSource, /readJob/);
  assert.match(captureSource, /job\?\.product === 'pro'/);
  assert.match(captureSource, /\/marketing-pro\/\?velvet_capture=/);
  assert.match(captureSource, /\/marketing\/\?velvet_capture=/);
});

test('le module reste accessible dans l’éditeur', () => {
  assert.match(moduleSource, /data-vss-editor/);
  assert.match(moduleSource, /Vidéos sociales Velvet/);
  assert.match(moduleSource, /data-vss-back-studio/);
  assert.match(moduleSource, /Velvet Membre/);
  assert.match(moduleSource, /Velvet Pro/);
});

test('la capture n’est jamais déclenchée automatiquement depuis Control', () => {
  assert.doesNotMatch(moduleSource, /getDisplayMedia|MediaRecorder|canvas\.captureStream/);
  assert.match(moduleSource, /data-vss-shoot/);
  assert.match(moduleSource, /window\.open/);
  assert.match(captureSource, /data-vsc-start/);
});
