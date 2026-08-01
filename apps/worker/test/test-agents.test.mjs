import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentPrompt,
  extractResponseText,
  isInternalTestEnvironment,
  nextRunDelayMinutes
} from '../src/test-agents.mjs';

test('internal agents are impossible in production', () => {
  assert.equal(isInternalTestEnvironment({
    VELVET_ENVIRONMENT: 'production',
    VELVET_INTERNAL_TEST_AGENTS: 'enabled'
  }), false);
});

test('internal agents require both an internal environment and explicit flag', () => {
  assert.equal(isInternalTestEnvironment({
    VELVET_ENVIRONMENT: 'staging',
    VELVET_INTERNAL_TEST_AGENTS: 'enabled'
  }), true);
  assert.equal(isInternalTestEnvironment({
    VELVET_ENVIRONMENT: 'staging',
    VELVET_INTERNAL_TEST_AGENTS: 'disabled'
  }), false);
  assert.equal(isInternalTestEnvironment({
    VELVET_ENVIRONMENT: 'preview'
  }), false);
});

test('agent prompt keeps persona, boundaries and internal secrecy', () => {
  const prompt = buildAgentPrompt({
    display_name: 'Clara & Mathieu',
    persona: {
      display_name: 'Clara & Mathieu',
      story: 'Un couple complice.',
      tone: 'naturel et chaleureux',
      values_list: ['respect', 'consentement'],
      boundaries: ['pas de pression'],
      people: [{ first_name: 'Clara' }, { first_name: 'Mathieu' }]
    }
  }, [{
    sender_identity: 'Cyril',
    body: 'Bonsoir, votre profil est sympa.',
    is_agent: false
  }], { display_name: 'Profil interne', city: 'Lille' });

  assert.match(prompt, /Clara & Mathieu/);
  assert.match(prompt, /pas de pression/);
  assert.match(prompt, /consentement/);
  assert.match(prompt, /Ne mentionne jamais l’IA/);
  assert.match(prompt, /Cyril: Bonsoir/);
  assert.doesNotMatch(prompt, /undefined/);
});

test('response text extraction supports direct and nested Responses payloads', () => {
  assert.equal(extractResponseText({ output_text: ' Bonjour ' }), 'Bonjour');
  assert.equal(extractResponseText({
    output: [{ content: [{ type: 'output_text', text: 'Bonsoir' }] }]
  }), 'Bonsoir');
  assert.equal(extractResponseText({}), '');
});

test('next run delay remains inside the configured safe bounds', () => {
  for (let index = 0; index < 100; index += 1) {
    const delay = nextRunDelayMinutes({
      min_interval_minutes: 12,
      max_interval_minutes: 34
    });
    assert.ok(delay >= 12 && delay <= 34);
  }
  assert.equal(nextRunDelayMinutes({
    min_interval_minutes: 1,
    max_interval_minutes: 1
  }), 5);
});
