import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const optimizerPath = 'apps/beta/static/assets/zwit-media-optimizer.js';
const loaderPath = 'apps/beta/static/assets/velvet-capture-mode.js';

async function source(path) {
  return readFile(path, 'utf8');
}

function contract(name, run) {
  test(name, async () => {
    try {
      await run();
    } catch (error) {
      const message = String(error?.stack || error?.message || error).replaceAll('\r', '').replaceAll('\n', '%0A');
      console.error(`::error title=Zwit media efficiency · ${name}::${message}`);
      throw error;
    }
  });
}

contract('member experience loads the Zwit media optimizer', async () => {
  const loader = await source(loaderPath);
  assert.ok(loader.includes('/assets/zwit-media-optimizer.js?v=20260807-2'));
  assert.ok(loader.includes('script.dataset.zwitMediaOptimizer'));
});

contract('optimizer preserves high display quality while reducing storage pressure', async () => {
  const optimizer = await source(optimizerPath);
  assert.ok(optimizer.includes('const MAX_EDGE = 2560'));
  assert.ok(optimizer.includes('const TARGET_BYTES = 1.5 * 1024 * 1024'));
  assert.ok(optimizer.includes('const SMALL_FILE_BYPASS_BYTES = 900 * 1024'));
  assert.ok(optimizer.includes('const QUALITY_STEPS = [0.94, 0.92, 0.90, 0.88]'));
  assert.ok(optimizer.includes("ctx.imageSmoothingQuality = 'high'"));
  assert.ok(optimizer.includes('const preferredType = file.type'));
});

contract('optimizer never blocks a usable original when optimization is unavailable', async () => {
  const optimizer = await source(optimizerPath);
  assert.ok(optimizer.includes('if (!bestBlob) return file'));
  assert.ok(optimizer.includes('if (!mustFitServer && !meaningfulSaving && !resizedLargeImage) return file'));
  assert.ok(optimizer.includes('stats.bytesAfter += file.size || 0;'));
  assert.ok(optimizer.includes('output.push(file);'));
});

contract('videos remain untouched by the image optimization layer', async () => {
  const optimizer = await source(optimizerPath);
  assert.ok(optimizer.includes("['image/jpeg', 'image/png', 'image/webp']"));
  assert.equal(optimizer.includes('video/mp4'), false);
});
