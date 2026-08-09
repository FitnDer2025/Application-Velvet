import assert from 'node:assert/strict';
import test from 'node:test';
import { signedMediaUrl } from '../../../functions/api/members/media.js';

test('builds a Supabase signed media URL without duplicating storage/v1', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    signedURL: '/storage/v1/object/sign/velvet-media/profile/photo.jpg?token=signed'
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
  try {
    const result = await signedMediaUrl({
      SUPABASE_URL: 'https://velvet.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'public-key'
    }, {
      access_token: 'access-token'
    }, 'profile/photo.jpg', 300);
    assert.equal(
      result,
      'https://velvet.supabase.co/storage/v1/object/sign/velvet-media/profile/photo.jpg?token=signed'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('supports the relative object/sign response returned by Supabase Storage', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    signedURL: '/object/sign/velvet-media/profile/photo.jpg?token=signed'
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
  try {
    const result = await signedMediaUrl({
      SUPABASE_URL: 'https://velvet.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'public-key'
    }, {
      access_token: 'access-token'
    }, 'profile/photo.jpg', 300);
    assert.equal(
      result,
      'https://velvet.supabase.co/storage/v1/object/sign/velvet-media/profile/photo.jpg?token=signed'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retries internal test-agent media with the server role only in an internal environment', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, init = {}) => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ message: 'row level security' }), { status: 403 });
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer service-role-key');
    return new Response(JSON.stringify({
      signedURL: '/storage/v1/object/sign/velvet-media/internal-test-agents/alba/portrait-1.png?token=internal'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    const result = await signedMediaUrl({
      SUPABASE_URL: 'https://velvet.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'public-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      VELVET_ENVIRONMENT: 'internal',
      VELVET_INTERNAL_TEST_AGENTS: 'enabled'
    }, {
      access_token: 'member-access-token'
    }, 'internal-test-agents/alba/portrait-1.png', 600);
    assert.equal(calls, 2);
    assert.equal(
      result,
      'https://velvet.supabase.co/storage/v1/object/sign/velvet-media/internal-test-agents/alba/portrait-1.png?token=internal'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('never retries internal media with the server role in production', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ message: 'row level security' }), { status: 403 });
  };
  try {
    const result = await signedMediaUrl({
      SUPABASE_URL: 'https://velvet.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'public-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      VELVET_ENVIRONMENT: 'production',
      VELVET_INTERNAL_TEST_AGENTS: 'enabled'
    }, {
      access_token: 'member-access-token'
    }, 'internal-test-agents/alba/portrait-1.png', 600);
    assert.equal(calls, 1);
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
