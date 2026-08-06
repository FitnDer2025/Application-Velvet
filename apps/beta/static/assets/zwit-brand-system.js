(() => {
  'use strict';

  if (window.__ZWIT_BRAND_SYSTEM__) return;
  window.__ZWIT_BRAND_SYSTEM__ = true;

  const VERSION = '20260806-10';
  const fullLogo = `/assets/zwit-logo-transparent.png?v=${VERSION}`;

  const brand = Object.freeze({
    name: 'ZWIT',
    controlLabel: 'ZWIT CONTRÔLE',
    memberLabel: 'ZWIT',
    proLabel: 'ZWIT PRO',
    studioLabel: 'ZWIT STUDIO',
    assets: Object.freeze({
      icon: fullLogo,
      logoCompact: fullLogo,
      logoHorizontal: fullLogo,
      logoTransparent: fullLogo,
      splash: fullLogo,
      email: fullLogo
    })
  });

  window.ZWIT_BRAND = brand;

  const route = location.pathname.toLowerCase();
  const surface = route.startsWith('/control')
    ? 'control'
    : route.startsWith('/pro') || route.startsWith('/marketing-pro')
      ? 'pro'
      : route.startsWith('/studio')
        ? 'studio'
        : 'member';

  const labels = {
    control: brand.controlLabel,
    pro: brand.proLabel,
    studio: brand.studioLabel,
    member: brand.memberLabel
  };

  const visibleRules = [
    [/\bVELVET\s+CONTR[ÔO]LE\b/g, brand.controlLabel],
    [/\bVelvet\s+Contr[ôo]le\b/g, 'Zwit Contrôle'],
    [/\bVELVET\s+PRO\b/g, brand.proLabel],
    [/\bVelvet\s+Pro\b/g, 'Zwit Pro'],
    [/\bVELVET\s+STUDIO\b/g, brand.studioLabel],
    [/\bVelvet\s+Studio\b/g, 'Zwit Studio'],
    [/\bVELVETPRO\b/g, 'ZWITPRO'],
    [/\bVelvetPro\b/g, 'ZwitPro'],
    [/\bvelvetpro\b/g, 'zwitpro'],
    [/\bVELVET\b/g, brand.name],
    [/\bVelvet\b/g, 'Zwit'],
    [/\bvelvet\b/g, 'zwit']
  ];

  const technicalValue = (value) => {
    const text = String(value || '');
    return /(?:velvet:\/\/|com\.velvet|velvet[_-](?:media|beta|pro|notification|app|control|studio)|VELVET_[A-Z0-9_]+|\/api\/[^\s"']*velvet|supabase[^\s"']*velvet)/i.test(text);
  };

  const replaceVisible = (value) => {
    const original = String(value ?? '');
    if (!original || technicalValue(original)) return original;
    return visibleRules.reduce((copy, [pattern, replacement]) => copy.replace(pattern, replacement), original);
  };

  const legacyLogoPattern = /(?:velvet|zwit)[^/?#]*(?:logo|icon|mark)|(?:appicon|brand-mark)/i;
  const brandContainerSelector = [
    '[data-brand]', '[data-logo]', '[data-zwit-logo]', '[class*="brand"]', '[class*="logo"]',
    '.sidebar header', '.sidebar-brand', '.topbar', '.top-bar', '.app-header', '.control-header',
    '.waiting-room-header', '.invitation-header', '.email-preview', '.communication-preview', '.vg-mark'
  ].join(',');

  function titleForSurface() {
    if (surface === 'control') return 'Zwit Contrôle';
    if (surface === 'pro') return 'Zwit Pro';
    if (surface === 'studio') return 'Zwit Studio';
    return route.includes('conditions')
      ? 'Zwit — Conditions d’utilisation'
      : route.includes('confidential')
        ? 'Zwit — Confidentialité'
        : route.includes('secur')
          ? 'Zwit — Sécurité'
          : 'Zwit';
  }

  function normalizeTextNode(node) {
    if (!(node instanceof Text)) return;
    if (node.parentElement?.closest('script,style,code,pre')) return;
    const next = replaceVisible(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function normalizeControlValue(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLOptionElement)) return;
    const current = element.value;
    const next = replaceVisible(current);
    if (next === current) return;
    element.value = next;
    if ('defaultValue' in element) element.defaultValue = next;
  }

  function isBrandImage(image) {
    const signature = [
      image.getAttribute('src'), image.currentSrc, image.alt, image.title,
      image.id, image.className, image.closest(brandContainerSelector)?.className
    ].filter(Boolean).join(' ');
    return legacyLogoPattern.test(signature) || Boolean(image.closest('[data-zwit-brand],[data-brand-logo],.zwit-logo-reveal,.zwit-logo-environment,.vg-mark'));
  }

  function imageVariant(image) {
    if (image.closest('.zwit-opening-v2,.zwit-opening-v3,.zwit-logo-reveal,.zwit-logo-environment')) return 'splash';
    if (image.closest('.email-preview,.communication-preview,[data-email-preview],[class*="email-preview"],[class*="communication-preview"]')) return 'email';
    return 'compact';
  }

  function normalizeBrandImage(image) {
    if (!(image instanceof HTMLImageElement) || !isBrandImage(image)) return;
    const variant = imageVariant(image);
    const source = variant === 'splash' ? brand.assets.splash : variant === 'email' ? brand.assets.email : brand.assets.logoCompact;
    if (image.getAttribute('src') !== source) image.setAttribute('src', source);
    image.removeAttribute('srcset');
    image.alt = variant === 'splash' ? 'Zwit' : labels[surface];
    image.dataset.zwitCanonicalLogo = variant;
    image.style.background = 'transparent';
    image.style.objectFit = 'contain';
    image.style.objectPosition = 'center';
  }

  function removeFloatingDuplicateBrand() {
    const floating = [...document.querySelectorAll('.zwit-global-brand,[data-zwit-global-brand]')];
    const nativeBrand = document.querySelector('header [class*="brand"],header [class*="logo"],nav [class*="brand"],.sidebar [class*="brand"],.sidebar [class*="logo"],.topbar [class*="logo"],.top-bar [class*="logo"]');
    if (nativeBrand || surface !== 'member') floating.forEach((node) => node.remove());
  }

  function deduplicateBrandContainers(root = document) {
    const containers = [];
    if (root instanceof Element && root.matches(brandContainerSelector)) containers.push(root);
    if (root.querySelectorAll) containers.push(...root.querySelectorAll(brandContainerSelector));

    containers.forEach((container) => {
      const images = [...container.querySelectorAll('img')].filter(isBrandImage);
      images.forEach(normalizeBrandImage);
      if (images.length > 1 && !container.closest('.zwit-opening-v2,.zwit-opening-v3,.email-preview,.communication-preview')) {
        images.slice(1).forEach((image) => image.remove());
      }
    });
  }

  function repairPreviewLogos(root = document) {
    const previewSelectors = [
      '.email-preview [class*="logo"]', '.communication-preview [class*="logo"]',
      '[data-email-preview] [class*="logo"]', '[class*="email-preview"] [class*="logo"]',
      '[class*="communication-preview"] [class*="logo"]', '[class*="email-preview"] [class*="avatar"]'
    ];

    previewSelectors.forEach((selector) => {
      root.querySelectorAll?.(selector).forEach((host) => {
        if (host instanceof HTMLImageElement) return normalizeBrandImage(host);
        let image = host.querySelector('img');
        if (!image) {
          image = document.createElement('img');
          host.replaceChildren(image);
        }
        image.dataset.brandLogo = 'email';
        normalizeBrandImage(image);
        host.style.background = 'transparent';
        host.style.overflow = 'visible';
      });
    });
  }

  function normalizeElement(element) {
    if (!(element instanceof Element)) return;
    if (element instanceof HTMLImageElement) normalizeBrandImage(element);
    normalizeControlValue(element);

    for (const attribute of ['title', 'aria-label', 'placeholder', 'alt', 'value']) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute);
      const next = replaceVisible(current);
      if (next !== current) element.setAttribute(attribute, next);
    }
  }

  function normalizeRoot(root = document) {
    document.title = titleForSurface();
    if (root instanceof Text) return normalizeTextNode(root);
    if (root instanceof Element) normalizeElement(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current = walker.currentNode;
    while (current) {
      if (current instanceof Text) normalizeTextNode(current);
      else normalizeElement(current);
      current = walker.nextNode();
    }

    removeFloatingDuplicateBrand();
    deduplicateBrandContainers(root);
    repairPreviewLogos(root);
  }

  function installCanvasGuard() {
    const prototype = window.CanvasRenderingContext2D?.prototype;
    if (!prototype || prototype.__zwitCanonicalBrand) return;
    const fillText = prototype.fillText;
    const strokeText = prototype.strokeText;
    prototype.fillText = function zwitFillText(text, ...args) { return fillText.call(this, replaceVisible(text), ...args); };
    prototype.strokeText = function zwitStrokeText(text, ...args) { return strokeText.call(this, replaceVisible(text), ...args); };
    Object.defineProperty(prototype, '__zwitCanonicalBrand', { value: true });
  }

  const style = document.createElement('style');
  style.id = 'zwitCanonicalBrandStyles';
  style.textContent = `
    [data-zwit-canonical-logo]{background:transparent!important;box-shadow:none!important;border:0!important}
    [data-zwit-canonical-logo="compact"]{width:36px!important;height:36px!important;max-width:36px!important;max-height:36px!important;object-fit:contain!important;border-radius:0!important;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))!important}
    [data-zwit-canonical-logo="email"]{width:64px!important;height:64px!important;max-width:64px!important;max-height:64px!important;object-fit:contain!important;border-radius:0!important;filter:drop-shadow(0 12px 26px rgba(0,0,0,.45))!important}
    [data-zwit-canonical-logo="splash"]{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;object-fit:contain!important}
    .zwit-global-brand,[data-zwit-global-brand]{box-shadow:none!important;background:transparent!important;border:0!important}
    header,nav,.topbar,.top-bar,.app-header,.control-header{isolation:isolate}
    header img[data-zwit-canonical-logo="compact"],nav img[data-zwit-canonical-logo="compact"],.sidebar img[data-zwit-canonical-logo="compact"]{flex:0 0 36px!important}
    .email-preview [class*="logo"],.communication-preview [class*="logo"],[data-email-preview] [class*="logo"]{background:transparent!important;border:0!important;box-shadow:none!important}
    .vg-mark{position:relative!important;width:68px!important;height:68px!important;margin:0 auto 15px!important;overflow:hidden!important;border:1px solid rgba(217,182,107,.24)!important;border-radius:21px!important;background:linear-gradient(145deg,rgba(25,22,22,.88),rgba(7,7,8,.96))!important;box-shadow:0 16px 38px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.04)!important}
    .vg-mark img[data-zwit-canonical-logo="compact"]{position:absolute!important;left:50%!important;top:0!important;width:106px!important;height:106px!important;max-width:none!important;max-height:none!important;transform:translateX(-50%)!important;object-fit:contain!important;object-position:center top!important;filter:drop-shadow(0 8px 18px rgba(0,0,0,.55))!important}
    @media(max-width:720px){[data-zwit-canonical-logo="compact"]{width:32px!important;height:32px!important;max-width:32px!important;max-height:32px!important}.vg-mark{width:64px!important;height:64px!important;border-radius:20px!important}.vg-mark img[data-zwit-canonical-logo="compact"]{width:100px!important;height:100px!important;max-width:none!important;max-height:none!important}}
  `;
  document.head.appendChild(style);

  installCanvasGuard();
  normalizeRoot(document);

  let queued = false;
  const observer = new MutationObserver((mutations) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element || node instanceof Text) normalizeRoot(node);
        });
        if (mutation.type === 'characterData') normalizeTextNode(mutation.target);
      });
      normalizeRoot(document);
    });
  });

  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener('input', (event) => normalizeControlValue(event.target), true);
  document.addEventListener('change', (event) => normalizeControlValue(event.target), true);
  window.addEventListener('pageshow', () => normalizeRoot(document));
  [150, 600, 1400, 3000].forEach((delay) => setTimeout(() => normalizeRoot(document), delay));
})();
