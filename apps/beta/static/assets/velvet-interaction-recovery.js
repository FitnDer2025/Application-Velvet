(() => {
  'use strict';

  const MOBILE_QUERY = '(max-width: 900px)';
  let scheduled = false;

  function isMobile() {
    return window.matchMedia?.(MOBILE_QUERY).matches === true;
  }

  function syncInteractionLayers() {
    scheduled = false;
    const body = document.body;
    const sidebar = document.querySelector('.sidebar');
    const scrim = document.querySelector('.nav-scrim');
    const mobile = isMobile();

    if (sidebar) {
      const open = mobile && sidebar.classList.contains('open');
      if (mobile) {
        sidebar.inert = !open;
        sidebar.setAttribute('aria-hidden', String(!open));
        body.classList.toggle('nav-open', open);
        body.classList.toggle('velvet-mobile-menu-open', open);
      } else {
        sidebar.inert = false;
        sidebar.removeAttribute('aria-hidden');
        body.classList.remove('nav-open', 'velvet-mobile-menu-open');
      }
    }

    if (scrim) {
      const active = mobile && body.classList.contains('nav-open');
      scrim.inert = !active;
      scrim.setAttribute('aria-hidden', String(!active));
      scrim.style.pointerEvents = active ? 'auto' : 'none';
    }

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

  const media = window.matchMedia?.(MOBILE_QUERY);
  media?.addEventListener?.('change', scheduleSync);
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
