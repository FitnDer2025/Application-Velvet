import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const onboarding = await readFile(new URL('../static/assets/members-onboarding-v2.js', import.meta.url), 'utf8');
const members = await readFile(new URL('../static/assets/members-live.js', import.meta.url), 'utf8');

test('l’inscription guidée ne demande qu’un seul récit libre', () => {
  assert.match(onboarding, /title: 'Décris-toi, simplement\.'/);
  assert.match(onboarding, /title: 'Décrivez-vous, simplement\.'/);
  assert.doesNotMatch(onboarding, /Racontez-moi votre histoire/);
  assert.doesNotMatch(onboarding, /Quel parcours t’a mené jusqu’ici/);
  assert.doesNotMatch(onboarding, /body: \(d\) => aiWriterField\('search_text'/);
});

test('les choix guidés acceptent une réponse personnelle sans l’inventer', () => {
  assert.match(onboarding, /Autre — préciser librement/);
  assert.match(onboarding, /data-other-for/);
  assert.match(onboarding, /data-select-other-for/);
  assert.match(onboarding, /Velvet n’ajoute aucune envie ni expérience que tu n’as pas déclarée/);
});

test('Mon histoire devient une chronologie de faits réels', () => {
  assert.match(members, /function profileStoryTimeline/);
  assert.match(members, /Le début de son histoire Velvet/);
  assert.match(members, /item\.target_type === 'profile'/);
  assert.match(members, /profile-story-timeline/);
  assert.doesNotMatch(members, /<h2>\$\{voice\.storyTitle\}<\/h2><p>\$\{e\(profile\.story/);
});
