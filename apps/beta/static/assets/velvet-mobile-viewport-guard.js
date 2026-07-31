(() => {
  'use strict';

  const root = document.documentElement;
  const state = {
    scheduled: false,
    wasKeyboardOpen: false,
    composerObserver: null,
    observedComposer: null
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

  function chatElements() {
    return {
      page: document.querySelector('.velvet-whatsapp-layout'),
      panel: document.querySelector('.velvet-whatsapp-layout .velvet-chat-panel'),
      messages: document.querySelector('.velvet-whatsapp-layout .messages'),
      composer: document.querySelector('.velvet-whatsapp-layout .composer.composer-v2'),
      textarea: document.querySelector('.velvet-whatsapp-layout textarea[name="body"]')
    };
  }

  function scrollLatestMessage(behavior = 'auto') {
    const { messages } = chatElements();
    if (!messages) return;
    messages.scrollTo({ top: messages.scrollHeight, behavior });
  }

  function observeComposer() {
    const { composer } = chatElements();
    if (composer === state.observedComposer) return;
    state.composerObserver?.disconnect();
    state.observedComposer = composer || null;
    if (!composer || typeof ResizeObserver !== 'function') return;
    state.composerObserver = new ResizeObserver(() => {
      scheduleViewport();
      requestAnimationFrame(() => scrollLatestMessage('auto'));
    });
    state.composerObserver.observe(composer);
  }

  function keepInputVisible(behavior = 'auto') {
    const { panel, messages, composer, textarea } = chatElements();
    if (!panel || !messages || !composer) return;

    const panelHeight = panel.getBoundingClientRect().height;
    const composerHeight = composer.getBoundingClientRect().height;
    root.style.setProperty('--velvet-composer-height', `${Math.ceil(composerHeight)}px`);

    if (panelHeight > composerHeight && document.activeElement === textarea) {
      messages.scrollTo({ top: messages.scrollHeight, behavior });
    }
  }

  function clearChatViewport() {
    root.style.removeProperty('--velvet-chat-height');
    root.style.removeProperty('--velvet-chat-width');
    root.style.removeProperty('--velvet-chat-offset-top');
    root.style.removeProperty('--velvet-chat-offset-left');
    root.style.removeProperty('--velvet-composer-height');
    document.body?.classList.remove('velvet-keyboard-open');
    state.wasKeyboardOpen = false;
    state.composerObserver?.disconnect();
    state.composerObserver = null;
    state.observedComposer = null;
  }

  function applyViewport() {
    state.scheduled = false;
    resetHorizontalScroll();

    const chatOpen = document.body?.classList.contains('velvet-whatsapp-chat');
    if (!chatOpen) {
      clearChatViewport();
      return;
    }

    const viewport = window.visualViewport;
    const height = Math.max(1, Math.round(viewport?.height || window.innerHeight));
    const width = Math.max(1, Math.round(viewport?.width || window.innerWidth));
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    const offsetLeft = Math.max(0, Math.round(viewport?.offsetLeft || 0));
    const keyboardOpen = window.innerHeight - height > 120;

    root.style.setProperty('--velvet-chat-height', `${height}px`);
    root.style.setProperty('--velvet-chat-width', `${width}px`);
    root.style.setProperty('--velvet-chat-offset-top', `${offsetTop}px`);
    root.style.setProperty('--velvet-chat-offset-left', `${offsetLeft}px`);
    document.body.classList.toggle('velvet-keyboard-open', keyboardOpen);

    observeComposer();
    requestAnimationFrame(() => keepInputVisible('auto'));

    if (keyboardOpen && !state.wasKeyboardOpen) {
      requestAnimationFrame(() => scrollLatestMessage('auto'));
      window.setTimeout(() => {
        scheduleViewport();
        keepInputVisible('auto');
      }, 80);
      window.setTimeout(() => {
        scheduleViewport();
        keepInputVisible('smooth');
      }, 240);
    }
    state.wasKeyboardOpen = keyboardOpen;
  }

  function scheduleViewport() {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(applyViewport);
  }

  lockViewportMeta();
  window.VelvetMobileViewport = { sync: scheduleViewport };

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
    for (const delay of [60, 180, 360]) {
      window.setTimeout(() => {
        scheduleViewport();
        keepInputVisible(delay === 360 ? 'smooth' : 'auto');
      }, delay);
    }
  });

  document.addEventListener('input', (event) => {
    if (!event.target.matches('.velvet-whatsapp-layout textarea[name="body"]')) return;
    scheduleViewport();
    requestAnimationFrame(() => keepInputVisible('auto'));
  });

  document.addEventListener('focusout', (event) => {
    if (!event.target.matches('.velvet-whatsapp-layout textarea[name="body"]')) return;
    window.setTimeout(scheduleViewport, 120);
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
