(() => {
  'use strict';

  const root = document.documentElement;
  const state = {
    scheduled: false,
    wasKeyboardOpen: false
  };

  function lockViewportMeta() {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute(
      'content',
      'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'
    );
  }

  function resetHorizontalScroll() {
    if (root.scrollLeft) root.scrollLeft = 0;
    if (document.body?.scrollLeft) document.body.scrollLeft = 0;
  }

  function scrollLatestMessage(behavior = 'auto') {
    const messages = document.querySelector('.velvet-whatsapp-layout .messages');
    if (!messages) return;
    messages.scrollTo({ top: messages.scrollHeight, behavior });
  }

  function applyViewport() {
    state.scheduled = false;
    resetHorizontalScroll();

    const chatOpen = document.body?.classList.contains('velvet-whatsapp-chat');
    if (!chatOpen) {
      root.style.removeProperty('--velvet-chat-height');
      root.style.removeProperty('--velvet-chat-width');
      root.style.removeProperty('--velvet-chat-offset-top');
      root.style.removeProperty('--velvet-chat-offset-left');
      document.body?.classList.remove('velvet-keyboard-open');
      state.wasKeyboardOpen = false;
      return;
    }

    const viewport = window.visualViewport;
    const height = Math.round(viewport?.height || window.innerHeight);
    const width = Math.round(viewport?.width || window.innerWidth);
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    const offsetLeft = Math.max(0, Math.round(viewport?.offsetLeft || 0));
    const keyboardOpen = window.innerHeight - height > 120;

    root.style.setProperty('--velvet-chat-height', `${height}px`);
    root.style.setProperty('--velvet-chat-width', `${width}px`);
    root.style.setProperty('--velvet-chat-offset-top', `${offsetTop}px`);
    root.style.setProperty('--velvet-chat-offset-left', `${offsetLeft}px`);
    document.body.classList.toggle('velvet-keyboard-open', keyboardOpen);

    if (keyboardOpen && !state.wasKeyboardOpen) {
      requestAnimationFrame(() => scrollLatestMessage('auto'));
      window.setTimeout(() => scrollLatestMessage('smooth'), 80);
    }
    state.wasKeyboardOpen = keyboardOpen;
  }

  function scheduleViewport() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(applyViewport);
  }

  lockViewportMeta();

  window.visualViewport?.addEventListener('resize', scheduleViewport);
  window.visualViewport?.addEventListener('scroll', scheduleViewport);
  window.addEventListener('resize', scheduleViewport);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(scheduleViewport, 120);
  });
  window.addEventListener('scroll', resetHorizontalScroll, { passive: true });

  document.addEventListener('focusin', (event) => {
    if (!event.target.matches('.velvet-whatsapp-layout textarea[name="body"]')) return;
    scheduleViewport();
    window.setTimeout(() => {
      scheduleViewport();
      scrollLatestMessage('smooth');
    }, 180);
  });

  document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (event) => event.preventDefault(), { passive: false });

  new MutationObserver(scheduleViewport).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true
  });

  scheduleViewport();
})();
