(() => {
  'use strict';

  if (window.ZwitSmartThumbnails) return;

  const WIDTH = 720;
  const QUALITY = 82;
  const ROOT_MARGIN = '320px';
  const LEGACY_CLASS_PREFIX = ['vel', 'vet'].join('');
  const COMPACT_IMAGE_SELECTOR = [
    '.feed-avatar img',
    '.feed-photo img',
    '.home-discovery-card img',
    '.profile-preview-media img',
    '.profile-preview-card img',
    '.discover-card img',
    '.member-card img',
    '.conversation-avatar-v2 img',
    '.conversation-avatar img',
    `.${LEGACY_CLASS_PREFIX}-parity-recommendation img`,
    `img.${LEGACY_CLASS_PREFIX}-parity-avatar`,
    `.${LEGACY_CLASS_PREFIX}-parity-activity-media img`,
    `.${LEGACY_CLASS_PREFIX}-parity-participants img`,
    `.${LEGACY_CLASS_PREFIX}-experience-panel img`
  ].join(',');
  const FULL_QUALITY_CONTEXT = [
    '.profile-carousel',
    '.album-photo',
    '.album-library',
    '.mini-gallery',
    `.${LEGACY_CLASS_PREFIX}-photo-lightbox`,
    '.photo-lightbox'
  ].join(',');

  const thumbnailCache = new Map();
  const observed = new WeakSet();
  const stats = {
    considered: 0,
    requested: 0,
    applied: 0,
    fallback: 0
  };

  function storagePath(value) {
    let url;
    try {
      url = new URL(value, location.origin);
    } catch {
      return null;
    }
    const markers = [
      '/storage/v1/object/sign/velvet-media/',
      '/storage/v1/render/image/sign/velvet-media/'
    ];
    const marker = markers.find((candidate) => url.pathname.includes(candidate));
    if (!marker) return null;
    const raw = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);
    if (!raw || raw.includes('..')) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  function compactImage(image) {
    return image instanceof HTMLImageElement
      && image.matches(COMPACT_IMAGE_SELECTOR)
      && !image.closest(FULL_QUALITY_CONTEXT);
  }

  async function thumbnailFor(path) {
    if (thumbnailCache.has(path)) return thumbnailCache.get(path);
    const task = (async () => {
      stats.requested += 1;
      try {
        const params = new URLSearchParams({
          path,
          width: String(WIDTH),
          quality: String(QUALITY)
        });
        const response = await fetch(`/api/members/media-thumbnail?${params}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { accept: 'application/json' }
        });
        if (!response.ok) return null;
        const payload = await response.json().catch(() => ({}));
        return typeof payload.thumbnailUrl === 'string' && payload.thumbnailUrl
          ? payload.thumbnailUrl
          : null;
      } catch {
        return null;
      }
    })();
    thumbnailCache.set(path, task);
    if (thumbnailCache.size > 400) {
      const oldest = thumbnailCache.keys().next().value;
      thumbnailCache.delete(oldest);
    }
    return task;
  }

  async function upgrade(image) {
    if (!compactImage(image)) return;
    const current = image.currentSrc || image.src;
    if (!current || image.dataset.zwitThumbnail === 'applied') return;
    const path = storagePath(current);
    if (!path) return;

    stats.considered += 1;
    const thumbnailUrl = await thumbnailFor(path);
    if (!thumbnailUrl || !image.isConnected || !compactImage(image)) {
      if (!thumbnailUrl) stats.fallback += 1;
      return;
    }

    const latest = image.currentSrc || image.src;
    if (storagePath(latest) !== path) return;
    image.dataset.zwitFullSrc = latest;
    image.dataset.zwitThumbnail = 'applied';
    image.loading = image.loading || 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      const full = image.dataset.zwitFullSrc;
      if (!full || image.src === full) return;
      image.dataset.zwitThumbnail = 'fallback';
      image.src = full;
      stats.fallback += 1;
    }, { once: true });
    image.src = thumbnailUrl;
    stats.applied += 1;
  }

  const intersection = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        intersection.unobserve(entry.target);
        upgrade(entry.target);
      });
    }, { rootMargin: ROOT_MARGIN })
    : null;

  function consider(image) {
    if (!compactImage(image) || observed.has(image)) return;
    observed.add(image);
    if (intersection) intersection.observe(image);
    else upgrade(image);
  }

  function scan(root = document) {
    if (root instanceof HTMLImageElement) consider(root);
    root.querySelectorAll?.(COMPACT_IMAGE_SELECTOR).forEach(consider);
  }

  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
        observed.delete(record.target);
        consider(record.target);
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node);
      });
    }
  });

  scan();
  mutations.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });

  window.ZwitSmartThumbnails = Object.freeze({
    version: '2026.08.07-1',
    width: WIDTH,
    quality: QUALITY,
    stats,
    scan
  });
})();
