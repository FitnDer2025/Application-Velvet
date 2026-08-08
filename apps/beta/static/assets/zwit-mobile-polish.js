(() => {
  'use strict';
  if (!location.pathname.startsWith('/membres')) return;

  const NS = 'http://www.w3.org/2000/svg';
  let scheduled = false;
  let normalizing = false;

  const PATHS = {
    bell: [
      'M6.2 9.7a5.8 5.8 0 0 1 11.6 0c0 6 2.4 6.5 2.4 6.5H3.8s2.4-.5 2.4-6.5Z',
      'M9.5 19.1a2.8 2.8 0 0 0 5 0'
    ],
    menu: ['M4 6.5h16', 'M4 12h16', 'M4 17.5h16']
  };

  function symbol(name) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.75');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('zwit-mobile-header-icon');
    for (const data of PATHS[name] || []) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', data);
      svg.append(path);
    }
    return svg;
  }

  function keepSingleButton(container, selector) {
    const nodes = [...container.querySelectorAll(selector)];
    nodes.slice(1).forEach((node) => node.remove());
    return nodes[0] || null;
  }

  function normalizeHeader() {
    if (normalizing) return;
    normalizing = true;
    try {
      document.body.classList.add('zwit-mobile-polished');
      const actions = document.querySelector('.mobile-head-actions');
      if (!actions) return;

      const notifications = keepSingleButton(actions, '[data-route="notifications"]');
      if (notifications) {
        notifications.type = 'button';
        notifications.setAttribute('aria-label', 'Notifications');
        const correct = notifications.children.length === 1
          && notifications.firstElementChild?.matches('svg.zwit-mobile-header-icon');
        if (!correct) notifications.replaceChildren(symbol('bell'));
      }

      const menu = keepSingleButton(actions, '#mobileMenuButton');
      if (menu) {
        menu.type = 'button';
        menu.setAttribute('aria-label', 'Ouvrir la navigation');
        const correct = menu.children.length === 1
          && menu.firstElementChild?.matches('svg.zwit-mobile-header-icon');
        if (!correct) menu.replaceChildren(symbol('menu'));
      }
    } finally {
      normalizing = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      normalizeHeader();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pageshow', schedule);
  document.addEventListener('DOMContentLoaded', normalizeHeader, { once: true });
  schedule();
})();
