(() => {
  'use strict';

  if (window.__ZWIT_INTERACTION_DATE_FIX__) return;
  window.__ZWIT_INTERACTION_DATE_FIX__ = true;

  const openingSelector = '.zwit-opening-v2,.zwit-opening-v3';
  const directMessageSelector = '[data-message-id],[data-created-at],[data-message-created-at],.message-row,.chat-message,.message-bubble';
  const officialLogo = window.ZWIT_BRAND?.assets?.splash || '/assets/zwit-logo-transparent.png?v=20260806-10';
  let closingOpening = false;
  let lastSignature = '';

  function closeOpening() {
    const layer = document.querySelector(openingSelector);
    if (!layer || closingOpening) return;

    closingOpening = true;
    layer.classList.add('leaving');
    layer.style.pointerEvents = 'none';
    layer.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      layer.remove();
      closingOpening = false;
    }, 220);
  }

  function handleOpeningInteraction(event) {
    if (!document.querySelector(openingSelector)) return;
    if (event.type === 'keydown' && !['Escape', 'Enter', ' '].includes(event.key)) return;
    closeOpening();
  }

  document.addEventListener('pointerdown', handleOpeningInteraction, true);
  document.addEventListener('touchstart', handleOpeningInteraction, { capture: true, passive: true });
  document.addEventListener('keydown', handleOpeningInteraction, true);

  function enforceOpeningLogo(root = document) {
    const images = [];
    if (root instanceof HTMLImageElement) images.push(root);
    if (root.querySelectorAll) images.push(...root.querySelectorAll(`${openingSelector} img`));
    images.forEach((image) => {
      if (!image.closest(openingSelector)) return;
      if (image.getAttribute('src') !== officialLogo) image.setAttribute('src', officialLogo);
      image.removeAttribute('srcset');
      image.style.background = 'transparent';
      image.style.objectFit = 'contain';
    });
  }

  function rawDate(node) {
    const time = node.matches?.('time') ? node : node.querySelector?.('time[datetime],time');
    return node.dataset?.createdAt
      || node.dataset?.messageCreatedAt
      || time?.dateTime
      || time?.getAttribute?.('datetime')
      || '';
  }

  function parseDate(node) {
    const value = rawDate(node);
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dayLabel(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Aujourd’hui';
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';

    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);
  }

  function messageRows() {
    const rows = [...document.querySelectorAll(directMessageSelector)];
    document.querySelectorAll('time[datetime]').forEach((time) => {
      const row = time.closest(directMessageSelector);
      if (row) rows.push(row);
    });

    return [...new Set(rows)]
      .filter((row) => parseDate(row))
      .sort((left, right) => parseDate(left) - parseDate(right));
  }

  function currentVisibleMessage(rows) {
    const viewportCenter = window.innerHeight * 0.42;
    const visible = rows
      .map((row) => ({ row, rect: row.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight)
      .sort((left, right) => Math.abs(left.rect.top - viewportCenter) - Math.abs(right.rect.top - viewportCenter));
    return visible[0]?.row || rows.at(-1);
  }

  function showCurrentDate(rows, force = false) {
    const target = currentVisibleMessage(rows);
    if (!target) return;

    const date = parseDate(target);
    if (!date) return;

    const signature = `${date.toDateString()}-${rows.length}`;
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    let badge = document.querySelector('[data-zwit-current-message-date]');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'zwit-current-message-date';
      badge.dataset.zwitCurrentMessageDate = 'true';
      document.body.appendChild(badge);
    }

    const fullDate = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);
    const relative = dayLabel(date);
    badge.textContent = relative === 'Aujourd’hui' || relative === 'Hier'
      ? `${relative} · ${fullDate}`
      : fullDate;

    badge.classList.add('visible');
  }

  function patchMessageDates(forceDate = false) {
    const rows = messageRows();

    if (!rows.length) {
      document.querySelector('[data-zwit-current-message-date]')?.remove();
      lastSignature = '';
      return;
    }

    document.querySelectorAll('.zwit-day-separator[data-zwit-runtime-date]')
      .forEach((node) => node.remove());

    let previousDay = '';
    rows.forEach((row) => {
      const date = parseDate(row);
      const day = date.toDateString();

      if (day !== previousDay && !row.previousElementSibling?.classList.contains('zwit-day-separator')) {
        const separator = document.createElement('div');
        separator.className = 'zwit-day-separator';
        separator.dataset.zwitRuntimeDate = 'true';
        separator.textContent = dayLabel(date);
        row.before(separator);
      }
      previousDay = day;
    });

    showCurrentDate(rows, forceDate);
  }

  function installScrollDateTrigger() {
    let scrollFrame = 0;
    document.addEventListener('scroll', () => {
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const rows = messageRows();
        if (rows.length) showCurrentDate(rows, true);
      });
    }, true);
  }

  const style = document.createElement('style');
  style.id = 'zwitInteractionDateFixStyles';
  style.textContent = `
    .zwit-opening-v2,.zwit-opening-v3{cursor:pointer;touch-action:manipulation}
    .zwit-opening-v2 .zwit-word span{display:none!important}
    .zwit-opening-v2 img,.zwit-opening-v3 img{background:transparent!important;object-fit:contain!important}
    .zwit-day-separator{display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;width:100%!important;margin:18px auto 12px!important;color:#d8bd77!important;font:700 11px Inter,Arial!important;text-transform:capitalize!important;position:relative!important;z-index:3!important}
    .zwit-day-separator:before,.zwit-day-separator:after{content:""!important;flex:1 1 52px!important;max-width:92px!important;height:1px!important;background:#d8bd7738!important}
    .zwit-current-message-date{position:fixed;z-index:9500;top:max(72px,calc(env(safe-area-inset-top) + 62px));left:50%;transform:translate(-50%,0);max-width:calc(100vw - 32px);padding:7px 14px;border:1px solid #d8bd7738;border-radius:999px;background:#111114e8;color:#d8bd77;backdrop-filter:blur(16px);box-shadow:0 10px 28px #0006;font:700 11px Inter,Arial;text-align:center;text-transform:capitalize;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .22s ease,transform .22s ease}
    .zwit-current-message-date.visible{opacity:1;visibility:visible;transform:translate(-50%,0)}
    @media(max-width:720px){.zwit-current-message-date{top:max(66px,calc(env(safe-area-inset-top) + 56px));font-size:10px;padding:6px 12px}}
  `;
  document.head.appendChild(style);

  enforceOpeningLogo();
  patchMessageDates(true);
  installScrollDateTrigger();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) enforceOpeningLogo(node);
      });
    });
    requestAnimationFrame(() => patchMessageDates(false));
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  [250, 900, 1800].forEach((delay) => setTimeout(() => patchMessageDates(delay === 250), delay));
})();
