(() => {
  'use strict';
  if (window.__VELVET_STUDIO_OPEN_PATCH__) return;
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
})();
