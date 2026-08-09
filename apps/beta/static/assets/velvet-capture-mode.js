(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('velvet_capture');
  if (!token || !/^[a-f0-9]{48}$/i.test(token)) return;

  const target = new URL('/marketing/', location.origin);
  target.searchParams.set('velvet_capture', token);
  location.replace(target.toString());
})();

(() => {
  if (window.ZwitMediaOptimizer || document.querySelector('script[data-zwit-media-optimizer]')) return;
  const script = document.createElement('script');
  script.src = '/assets/zwit-media-optimizer.js?v=20260807-2';
  script.async = true;
  script.dataset.zwitMediaOptimizer = 'true';
  document.head.appendChild(script);
})();

(() => {
  if (window.ZwitSmartThumbnails || document.querySelector('script[data-zwit-smart-thumbnails]')) return;
  const script = document.createElement('script');
  script.src = '/assets/zwit-smart-thumbnails.js?v=20260807-1';
  script.async = true;
  script.dataset.zwitSmartThumbnails = 'true';
  document.head.appendChild(script);
})();

(() => {
  if (window.ZwitOnboardingGuideLogo) return;

  const selector = '.ov-guide > span';
  const fallbackLogo = '/assets/zwit-logo-transparent.png?v=20260806-10';

  function logoSource() {
    return window.ZWIT_BRAND?.assets?.logoCompact || window.ZWIT_BRAND?.assets?.icon || fallbackLogo;
  }

  function ensureStyle() {
    if (document.querySelector('style[data-zwit-onboarding-guide-logo]')) return;
    const style = document.createElement('style');
    style.dataset.zwitOnboardingGuideLogo = 'true';
    style.textContent = `
      ${selector}[data-zwit-guide-logo]{color:transparent!important;background:transparent!important;box-shadow:none!important;padding:0!important;overflow:hidden!important;display:grid!important;place-items:center!important}
      ${selector}[data-zwit-guide-logo] img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}
    `;
    document.head.appendChild(style);
  }

  function replaceMark(mark) {
    if (!(mark instanceof HTMLElement) || mark.dataset.zwitGuideLogo === 'true') return;
    mark.dataset.zwitGuideLogo = 'true';
    mark.textContent = '';
    const image = document.createElement('img');
    image.src = logoSource();
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    mark.appendChild(image);
  }

  function scan(root = document) {
    ensureStyle();
    if (root instanceof Element && root.matches(selector)) replaceMark(root);
    root.querySelectorAll?.(selector).forEach(replaceMark);
  }

  scan();
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ZwitOnboardingGuideLogo = Object.freeze({ scan, selector });
})();
