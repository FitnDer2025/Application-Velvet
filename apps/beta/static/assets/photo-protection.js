(() => {
  'use strict';

  const WATERMARK_VERSION = 'velvet-v1';
  const PHOTO_ENDPOINTS = new Set(['/api/members/photos', '/api/members/album-media']);
  const nativeFetch = window.fetch.bind(window);
  let viewerCode = 'VX-LOCAL';

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.style.borderColor = error ? 'rgba(255,142,167,.45)' : '';
    node.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove('show'), 4200);
  }

  async function shortViewerCode() {
    try {
      const response = await nativeFetch('/api/members/profile', {
        credentials: 'same-origin',
        headers: { accept: 'application/json' }
      });
      const payload = await response.json();
      const source = String(payload?.account?.userId || payload?.account?.email || 'velvet');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
      viewerCode = `VX-${[...new Uint8Array(digest)].slice(0, 3).map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    } catch {
      viewerCode = 'VX-LOCAL';
    }
  }

  function drawWatermark(canvas, context) {
    const width = canvas.width;
    const height = canvas.height;
    const margin = Math.max(12, Math.round(width * 0.022));
    const markHeight = Math.max(32, Math.min(68, Math.round(width * 0.06)));
    const markWidth = Math.round(markHeight * 2.85);
    const x = width - markWidth - margin;
    const y = height - markHeight - margin;

    context.save();
    context.globalAlpha = 0.68;
    context.fillStyle = '#0b080a';
    context.beginPath();
    if (context.roundRect) context.roundRect(x, y, markWidth, markHeight, markHeight / 2);
    else context.rect(x, y, markWidth, markHeight);
    context.fill();

    context.globalAlpha = 0.94;
    context.fillStyle = '#f0d39b';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `600 ${Math.round(markHeight * 0.5)}px Georgia,serif`;
    context.fillText('V', x + markHeight * 0.62, y + markHeight * 0.52);

    context.globalAlpha = 0.84;
    context.textAlign = 'left';
    context.font = `600 ${Math.max(11, Math.round(markHeight * 0.24))}px Arial,sans-serif`;
    context.fillText('VELVET', x + markHeight * 1.08, y + markHeight * 0.52);
    context.restore();
  }

  async function watermarkPhoto(file) {
    if (!(file instanceof File) || !file.type.startsWith('image/')) return file;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    drawWatermark(canvas, context);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('photo_watermark_failed');
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-velvet.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  }

  window.fetch = async (input, options = {}) => {
    const requestUrl = typeof input === 'string' || input instanceof URL
      ? new URL(input, window.location.href)
      : new URL(input.url, window.location.href);
    const body = options.body;

    if (requestUrl.origin === window.location.origin
      && PHOTO_ENDPOINTS.has(requestUrl.pathname)
      && body instanceof FormData
      && !body.has('watermarkVersion')) {
      const photo = body.get('photo');
      if (photo instanceof File) {
        body.set('photo', await watermarkPhoto(photo));
        body.set('watermarkVersion', WATERMARK_VERSION);
      }
    }

    return nativeFetch(input, options);
  };

  function protectImage(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.velvetProtected === '1') return;
    if (!image.src || image.closest('.brand') || image.src.includes('velvet-icon')) return;
    const parent = image.parentElement;
    if (!parent) return;
    image.dataset.velvetProtected = '1';
    image.draggable = false;
    image.setAttribute('oncontextmenu', 'return false');
    parent.classList.add('velvet-protected-frame');

    const marker = document.createElement('span');
    marker.className = 'velvet-screen-mark';
    marker.textContent = `VELVET · ${viewerCode}`;
    marker.setAttribute('aria-hidden', 'true');
    parent.appendChild(marker);

    image.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      toast('Cette photo est protégée par Velvet et ne peut pas être enregistrée depuis ce menu.', true);
    });
    image.addEventListener('dragstart', (event) => {
      event.preventDefault();
      toast('Le glisser-déposer des photos Velvet est désactivé.', true);
    });
  }

  function scanImages(root = document) {
    root.querySelectorAll?.('img').forEach(protectImage);
  }

  function injectStyles() {
    if (document.querySelector('#velvetPhotoProtectionStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetPhotoProtectionStyles';
    style.textContent = `.velvet-protected-frame{position:relative!important;overflow:hidden}.velvet-protected-frame img{user-select:none;-webkit-user-select:none;-webkit-user-drag:none}.velvet-screen-mark{position:absolute;right:8px;bottom:8px;z-index:5;padding:5px 8px;border:1px solid rgba(240,211,155,.4);border-radius:999px;background:rgba(11,8,10,.7);color:#f0d39b;font:600 9px/1 Arial,sans-serif;letter-spacing:.08em;pointer-events:none;backdrop-filter:blur(4px)}.velvet-capture-note{margin:12px 0;padding:11px 13px;border:1px solid rgba(217,184,121,.24);border-radius:14px;background:rgba(126,32,69,.09);color:#cdbfc4;font-size:12px;line-height:1.5}`;
    document.head.appendChild(style);
  }

  injectStyles();
  shortViewerCode().finally(() => scanImages());
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches?.('img')) protectImage(node);
        scanImages(node);
      }
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.VelvetPhotoProtection = {
    watermarkPhoto,
    watermarkVersion: WATERMARK_VERSION,
    screenshotDetection: 'native_only'
  };
})();
