import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanGeneratedText,
  hasSufficientSource
} from '../../../functions/api/members/profile-copy.js';

test('n’active Zwit IA qu’avec une matière suffisamment précise', () => {
  assert.equal(hasSufficientSource('sensuel'), false);
  assert.equal(hasSufficientSource('complice, discret, curieux'), true);
  assert.equal(hasSufficientSource('respect feeling élégance'), true);
});

test('nettoie la réponse générée avant de la rendre au membre', () => {
  assert.equal(
    cleanGeneratedText({ response: '```text\nProposition : « Nous aimons les rencontres élégantes. »\n```' }, 200),
    'Nous aimons les rencontres élégantes.'
  );
  assert.equal(cleanGeneratedText('<b>Texte élégant</b>', 8), 'Texte él');
});
