(() => {
  'use strict';

  const MAX_EDGE = 2560;
  const TARGET_BYTES = 1.5 * 1024 * 1024;
  const SERVER_LIMIT_BYTES = 4 * 1024 * 1024;
  const SMALL_FILE_BYPASS_BYTES = 900 * 1024;
  const MIN_SAVING_RATIO = 0.88;
  const QUALITY_STEPS = [0.94, 0.92, 0.90, 0.88];
  const handledEvents = new WeakSet();

  const stats = {
    filesSeen: 0,
    filesOptimized: 0,
    bytesBefore: 0,
    bytesAfter: 0
  };

  function supportedImage(file) {
    return file instanceof File && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  }

  function extensionFor(type) {
    if (type === 'image/webp') return 'webp';
    if (type === 'image/png') return 'png';
    return 'jpg';
  }

  function optimizedName(name, type) {
    const base = String(name || 'zwit-photo').replace(/\.[a-z0-9]+$/i, '');
    return `${base}.${extensionFor(type)}`;
  }

  async function decodeImage(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw(ctx, width, height) {
            ctx.drawImage(bitmap, 0, 0, width, height);
          },
          close() {
            bitmap.close?.();
          }
        };
      } catch {
        // Safari fallback below.
      }
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
          draw(ctx, width, height) {
            ctx.drawImage(image, 0, 0, width, height);
          },
          close() {
            URL.revokeObjectURL(url);
          }
        });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image_decode_failed'));
      };
      image.src = url;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  async function encode(canvas, preferredType) {
    let best = null;
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasBlob(canvas, preferredType, quality);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
    return best;
  }

  async function optimizeImage(file) {
    const decoded = await decodeImage(file);
    try {
      const maxDimension = Math.max(decoded.width, decoded.height);
      const initialScale = Math.min(1, MAX_EDGE / Math.max(1, maxDimension));
      if (file.size <= SMALL_FILE_BYPASS_BYTES && initialScale === 1) return file;

      const preferredType = file.type === 'image/png' ? 'image/webp' : file.type;
      let scale = initialScale;
      let bestBlob = null;

      for (let pass = 0; pass < 2; pass += 1) {
        const width = Math.max(1, Math.round(decoded.width * scale));
        const height = Math.max(1, Math.round(decoded.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: preferredType !== 'image/jpeg' });
        if (!ctx) return file;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (preferredType === 'image/jpeg') {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, width, height);
        }
        decoded.draw(ctx, width, height);
        const blob = await encode(canvas, preferredType);
        canvas.width = 1;
        canvas.height = 1;
        if (blob && (!bestBlob || blob.size < bestBlob.size)) bestBlob = blob;
        if (bestBlob && bestBlob.size <= TARGET_BYTES) break;
        scale *= 0.86;
      }

      if (!bestBlob) return file;

      const mustFitServer = file.size > SERVER_LIMIT_BYTES && bestBlob.size < SERVER_LIMIT_BYTES;
      const meaningfulSaving = bestBlob.size <= file.size * MIN_SAVING_RATIO;
      const resizedLargeImage = maxDimension > MAX_EDGE && bestBlob.size < file.size;
      if (!mustFitServer && !meaningfulSaving && !resizedLargeImage) return file;

      return new File([bestBlob], optimizedName(file.name, bestBlob.type || preferredType), {
        type: bestBlob.type || preferredType,
        lastModified: file.lastModified || Date.now()
      });
    } finally {
      decoded.close?.();
    }
  }

  async function optimizeFiles(files) {
    const output = [];
    for (const file of files) {
      stats.filesSeen += 1;
      stats.bytesBefore += file.size || 0;
      if (!supportedImage(file)) {
        stats.bytesAfter += file.size || 0;
        output.push(file);
        continue;
      }
      try {
        const optimized = await optimizeImage(file);
        if (optimized !== file) stats.filesOptimized += 1;
        stats.bytesAfter += optimized.size || 0;
        output.push(optimized);
      } catch {
        stats.bytesAfter += file.size || 0;
        output.push(file);
      }
    }
    return output;
  }

  function replaceFiles(input, files) {
    if (!('DataTransfer' in window)) return false;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    return true;
  }

  document.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || !input.files?.length) return;
    if (handledEvents.has(event)) return;
    if (![...input.files].some(supportedImage)) return;

    event.stopImmediatePropagation();
    const originalFiles = [...input.files];
    input.dataset.zwitOptimizing = 'true';

    const optimizedFiles = await optimizeFiles(originalFiles);
    replaceFiles(input, optimizedFiles);
    delete input.dataset.zwitOptimizing;

    const replay = new Event('change', { bubbles: true });
    handledEvents.add(replay);
    input.dispatchEvent(replay);

    window.dispatchEvent(new CustomEvent('zwit:media-optimized', {
      detail: {
        files: optimizedFiles.length,
        bytesBefore: originalFiles.reduce((sum, file) => sum + (file.size || 0), 0),
        bytesAfter: optimizedFiles.reduce((sum, file) => sum + (file.size || 0), 0)
      }
    }));
  }, true);

  window.ZwitMediaOptimizer = Object.freeze({
    version: '2026.08.07-1',
    maxEdge: MAX_EDGE,
    targetBytes: TARGET_BYTES,
    stats
  });
})();
