(() => {
  'use strict';

  let scheduled = false;

  function syncInteractionLayers() {
    scheduled = false;
    if (document.visibilityState === 'visible') {
      document.querySelector('#velvetPrivacyShield')?.classList.remove('visible');
    }

    document.querySelectorAll('.velvet-photo-lightbox:not(.visible)').forEach((node) => {
      if (!node.matches(':focus-within')) node.remove();
    });

    document.querySelectorAll('[data-route],button,a,input,select,textarea').forEach((node) => {
      if (!node.closest('[inert]')) node.style.removeProperty('pointer-events');
    });
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncInteractionLayers);
  }

  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('pageshow', scheduleSync);
  window.addEventListener('focus', scheduleSync);
  document.addEventListener('visibilitychange', scheduleSync);
  document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });

  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  scheduleSync();
})();
