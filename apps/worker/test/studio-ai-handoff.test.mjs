import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile('apps/beta/static/assets/velvet-studio-ai-module.js', 'utf8');

test('le projet IA mémorise le passage de relais vers le Studio', () => {
  assert.match(source, /PENDING_PROJECT_KEY/);
  assert.match(source, /AUTOPLAY_KEY/);
  assert.match(source, /sessionSet\(PENDING_PROJECT_KEY, project\.id\)/);
  assert.match(source, /sessionSet\(AUTOPLAY_KEY, project\.id\)/);
  assert.match(source, /localStorage\.setItem\(ACTIVE_KEY, project\.id\)/);
});

test('le Studio ouvre la bonne campagne et lance son aperçu', () => {
  assert.match(source, /processPendingProject/);
  assert.match(source, /\[data-open-project\]/);
  assert.match(source, /button\.click\(\)/);
  assert.match(source, /processAutoplay/);
  assert.match(source, /\[data-action="play"\]/);
  assert.match(source, /setTimeout\(\(\) => play\.click\(\), 180\)/);
});

test('l’assistant reste accessible dans l’éditeur', () => {
  assert.match(source, /data-vsai-editor-bridge/);
  assert.match(source, /Projet créé par l’Assistant IA/);
  assert.match(source, /data-vsai-edit-plan/);
  assert.match(source, /data-vsai-replay/);
  assert.match(source, /returnToAssistant/);
});

test('le correctif ne réintroduit aucune capture automatique', () => {
  assert.doesNotMatch(source, /getDisplayMedia|MediaRecorder|<iframe|MutationObserver/);
  assert.match(source, /AbortController/);
  assert.match(source, /35_000/);
});
