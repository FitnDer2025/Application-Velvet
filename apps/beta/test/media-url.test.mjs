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
