import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const optimizerPath = 'apps/beta/static/assets/zwit-media-optimizer.js';
const loaderPath = 'apps/beta/static/assets/velvet-capture-mode.js';

async function source(path) {
  return readFile(path, 'utf8');
}

test('member experience loads the Zwit media optimizer', async () => {
  const loader = await source(loaderPath);
  assert.match(loader, /zwit-media-optimizer\.js\?v=20260807-1/);
  assert.match(loader, /data-zwit-media-optimizer|dataset\.zwitMediaOptimizer/);
});

test('optimizer preserves high display quality while reducing storage pressure', async () => {
  const optimizer = await source(optimizerPath);
  assert.match(optimizer, /const MAX_EDGE = 2560/);
  assert.match(optimizer, /const TARGET_BYTES = 1\.5 \* 1024 \* 1024/);
  assert.match(optimizer, /const SMALL_FILE_BYPASS_BYTES = 900 \* 1024/);
  assert.match(optimizer, /const QUALITY_STEPS = \[0\.94, 0\.92, 0\.90, 0\.88\]/);
  assert.match(optimizer, /imageSmoothingQuality = 'high'/);
});

test('optimizer never blocks a usable original when optimization is unavailable', async () => {
  const optimizer = await source(optimizerPath);
  assert.match(optimizer, /catch \{\s*stats\.bytesAfter \+= file\.size \|\| 0;\s*output\.push\(file\)/);
  assert.match(optimizer, /if \(!bestBlob\) return file/);
  assert.match(optimizer, /if \(!mustFitServer && !meaningfulSaving && !resizedLargeImage\) return file/);
});

test('videos remain untouched by the image optimization layer', async () => {
  const optimizer = await source(optimizerPath);
  assert.match(optimizer, /\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  assert.doesNotMatch(optimizer, /video\/mp4.*supportedImage/);
});
