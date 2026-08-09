(() => {
  'use strict';

  const root = document.querySelector('#controlApp');
  if (!root) return;

  const STYLE_ID = 'velvetControlScrollRecoveryStyles';

  if (!window.__VELVET_STUDIO_OPEN_PATCH__) {
    window.__VELVET_STUDIO_OPEN_PATCH__ = true;
    const nativeOpen = window.open.bind(window);
    window.open = (url, target, features) => {
      const cleaned = String(features || '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value && !/^noopener(?:=|$)/i.test(value) && !/^noreferrer(?:=|$)/i.test(value))
        .join(',');
      const popup = nativeOpen(url, target, cleaned || undefined);
      try { if (popup) popup.opener = null; } catch {}
      return popup;
    };
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.velvet-control-ui .control-app {
        min-height: 0 !important;
        max-height: none !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior-y: contain;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
      }
      body.velvet-control-ui .control-app.vs1-host:not(.vs1-editor-host) {
        overflow-x: hidden !important;
        overflow-y: auto !important;
      }
      body.velvet-control-ui .control-app.vs1-editor-host {
        height: auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
        padding: 0 !important;
        touch-action: auto;
      }
      body.velvet-control-ui .control-app:not(.vs1-editor-host) .control-page,
      body.velvet-control-ui .control-app:not(.vs1-editor-host) .vs1-projects {
        min-height: max-content;
      }
      @media (max-width: 760px) {
        body.velvet-control-ui .control-app {
          padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important;
          overscroll-behavior-y: auto;
        }
        body.velvet-control-ui .control-app.vs1-editor-host {
          padding-bottom: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function syncHostState() {
    ensureStyles();
    const studioShell = root.querySelector(':scope > .vs1-shell');
    const editorShell = root.querySelector(':scope > .vs1-editor-shell');

    if (!studioShell) {
      root.classList.remove('vs1-host', 'vs1-editor-host');
      root.removeAttribute('data-velvet-studio-open');
      return;
    }

    root.classList.add('vs1-host');
    root.classList.toggle('vs1-editor-host', Boolean(editorShell));
    root.dataset.velvetStudioOpen = editorShell ? 'editor' : 'projects';
  }

  const observer = new MutationObserver(syncHostState);
  observer.observe(root, { childList: true, subtree: false });

  document.addEventListener('click', (event) => {
    const navigation = event.target.closest('[data-nav-view], .control-top .tab, [data-action="projects"], [data-action="return-control"]');
    if (!navigation) return;
    requestAnimationFrame(syncHostState);
    setTimeout(syncHostState, 80);
  }, true);

  window.addEventListener('pageshow', syncHostState);
  window.addEventListener('resize', syncHostState, { passive: true });
  syncHostState();
})();
