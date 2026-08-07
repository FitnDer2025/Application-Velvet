import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mediaApiPath = 'functions/api/members/media.js';
const thumbnailApiPath = 'functions/api/members/media-thumbnail.js';
const runtimePath = 'apps/beta/static/assets/zwit-smart-thumbnails.js';
const loaderPath = 'apps/beta/static/assets/velvet-capture-mode.js';

async function source(path) {
  return readFile(path, 'utf8');
}

test('signed media supports bounded Supabase image transformations', async () => {
  const media = await source(mediaApiPath);
  assert.ok(media.includes("['cover', 'contain', 'fill']"));
  assert.ok(media.includes('Math.min(2500'));
  assert.ok(media.includes('Math.min(100'));
  assert.ok(media.includes('...(normalized ? { transform: normalized } : {})'));
  assert.ok(media.includes('export async function signedMediaUrl(env, session, path, expiresIn = 600, transform = null)'));
});

test('thumbnail endpoint keeps Retina quality while bounding cost and resolution', async () => {
  const endpoint = await source(thumbnailApiPath);
  assert.ok(endpoint.includes("boundedNumber(url.searchParams.get('width'), 720, 160, 960)"));
  assert.ok(endpoint.includes("boundedNumber(url.searchParams.get('quality'), 82, 70, 90)"));
  assert.ok(endpoint.includes("{ width, quality, resize: 'contain' }"));
  assert.ok(endpoint.includes('IMAGE_PATH'));
  assert.ok(endpoint.includes("!path.includes('..')"));
});

test('smart thumbnails are lazy and excluded from full-quality photo surfaces', async () => {
  const runtime = await source(runtimePath);
  assert.ok(runtime.includes('const WIDTH = 720'));
  assert.ok(runtime.includes('const QUALITY = 82'));
  assert.ok(runtime.includes("const ROOT_MARGIN = '320px'"));
  assert.ok(runtime.includes("const LEGACY_CLASS_PREFIX = ['vel', 'vet'].join('')"));
  assert.ok(runtime.includes("'IntersectionObserver' in window"));
  assert.ok(runtime.includes("'.feed-photo img'"));
  assert.ok(runtime.includes("'.home-discovery-card img'"));
  assert.ok(runtime.includes('`${LEGACY_CLASS_PREFIX}-parity-activity-media img`'));
  assert.ok(runtime.includes("'.profile-carousel'"));
  assert.ok(runtime.includes("'.album-photo'"));
  assert.ok(runtime.includes('`${LEGACY_CLASS_PREFIX}-photo-lightbox`'));
  assert.ok(runtime.includes('image.dataset.zwitFullSrc = latest'));
  assert.ok(runtime.includes('image.src = full'));
});

test('member shell loads the smart thumbnail runtime without replacing media optimizer', async () => {
  const loader = await source(loaderPath);
  assert.ok(loader.includes('/assets/zwit-media-optimizer.js?v=20260807-2'));
  assert.ok(loader.includes('/assets/zwit-smart-thumbnails.js?v=20260807-1'));
  assert.ok(loader.includes('script.dataset.zwitSmartThumbnails'));
});
