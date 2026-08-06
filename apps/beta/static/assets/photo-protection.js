(() => {
  'use strict';

  const WATERMARK_VERSION = 'velvet-v2-subtle';
  const PHOTO_ENDPOINTS = new Set(['/api/members/photos', '/api/members/album-media']);
  const nativeFetch = window.fetch.bind(window);

  function toast(message, error = false) {
    const node = document.querySelector('#toast');
    if (!node) return;
    node.textContent = message;
    node.style.borderColor = error ? 'rgba(255,142,167,.45)' : '';
    node.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove('show'), 4200);
  }

  function drawWatermark(canvas, context) {
    const width = canvas.width;
    const height = canvas.height;
    const margin = Math.max(14, Math.round(width * 0.025));
    const fontSize = Math.max(18, Math.min(48, Math.round(width * 0.04)));

    context.save();
    context.globalAlpha = 0.19;
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.font = `600 ${fontSize}px Georgia,serif`;
    context.fillStyle = '#fff8ed';
    context.shadowColor = 'rgba(0,0,0,.55)';
    context.shadowBlur = Math.max(2, Math.round(fontSize * 0.12));
    context.fillText('ZWIT', width - margin, height - margin);
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

  function isAvatarOrInterfaceImage(image) {
    return Boolean(image.closest(
      '.brand,.brand-mark,.velvet-brand-lockup,.feed-avatar,.conversation-avatar-v2,'
      + '.notification-avatar,.member-map-marker,.avatar,.person-card,.mobile-head'
    ));
  }

  function isLargeMedia(image) {
    const rect = image.getBoundingClientRect();
    return Math.max(rect.width, image.naturalWidth || 0) >= 180
      && Math.max(rect.height, image.naturalHeight || 0) >= 180;
  }

  function protectImage(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.velvetProtected === '1') return;
    if (!image.src || image.src.includes('velvet-icon') || isAvatarOrInterfaceImage(image)) return;
    if (!image.complete) {
      image.addEventListener('load', () => protectImage(image), { once: true });
      return;
    }
    if (!isLargeMedia(image)) return;

    const parent = image.parentElement;
    if (!parent) return;
    image.dataset.velvetProtected = '1';
    image.draggable = false;
    image.setAttribute('oncontextmenu', 'return false');
    parent.classList.add('velvet-protected-frame');

    if (!parent.querySelector(':scope > .velvet-screen-mark')) {
      const marker = document.createElement('span');
      marker.className = 'velvet-screen-mark';
      marker.textContent = 'V';
      marker.setAttribute('aria-hidden', 'true');
      parent.appendChild(marker);
    }

    image.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      toast('Cette photo est protégée par Zwit et ne peut pas être enregistrée depuis ce menu.', true);
    });
    image.addEventListener('dragstart', (event) => {
      event.preventDefault();
      toast('Le glisser-déposer des photos Zwit est désactivé.', true);
    });
  }

  function scanImages(root = document) {
    root.querySelectorAll?.('img').forEach(protectImage);
  }

  function privacyShield() {
    let shield = document.querySelector('#velvetPrivacyShield');
    if (!shield) {
      shield = document.createElement('div');
      shield.id = 'velvetPrivacyShield';
      shield.innerHTML = '<span>V</span><strong>Espace privé Zwit</strong>';
      document.body.appendChild(shield);
    }
    return shield;
  }

  function setPrivacyShield(visible) {
    privacyShield().classList.toggle('visible', Boolean(visible));
  }

  function injectStyles() {
    if (document.querySelector('#velvetPhotoProtectionStyles')) return;
    const style = document.createElement('style');
    style.id = 'velvetPhotoProtectionStyles';
    style.textContent = `
      .velvet-protected-frame{position:relative!important;overflow:hidden}
      .velvet-protected-frame img{user-select:none;-webkit-user-select:none;-webkit-user-drag:none}
      .velvet-screen-mark{position:absolute;right:12px;bottom:10px;z-index:5;color:#fff8ed;font:600 22px/1 Georgia,serif;opacity:.18;text-shadow:0 2px 8px #000;pointer-events:none;mix-blend-mode:screen}
      #velvetPrivacyShield{position:fixed;inset:0;z-index:99999;display:none;place-items:center;align-content:center;gap:12px;background:#070607;color:#f6eee6}
      #velvetPrivacyShield.visible{display:grid}
      #velvetPrivacyShield span{font:500 68px/1 Georgia,serif;color:#c6a96a;opacity:.75}
      #velvetPrivacyShield strong{font:600 12px/1.4 Inter,-apple-system,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#c8bdc1}
      .velvet-capture-note{margin:12px 0;padding:11px 13px;border:1px solid rgba(217,184,121,.24);border-radius:14px;background:rgba(126,32,69,.09);color:#cdbfc4;font-size:12px;line-height:1.5}
    `;
    document.head.appendChild(style);
  }

  injectStyles();
  scanImages();
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches?.('img')) protectImage(node);
        scanImages(node);
      }
    }));
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', () => setPrivacyShield(document.hidden));
  window.addEventListener('pagehide', () => setPrivacyShield(true));
  window.addEventListener('pageshow', () => setPrivacyShield(false));

  window.VelvetPhotoProtection = {
    watermarkPhoto,
    watermarkVersion: WATERMARK_VERSION,
    screenshotDetection: 'native_ios_only'
  };
})();
