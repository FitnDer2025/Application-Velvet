(() => {
  'use strict';

  const MOBILE_QUERY = '(max-width: 900px)';
  const PRIMARY_ROUTES = ['home', 'discover', 'venues', 'conversations', 'me'];
  const PRIMARY_FOR_ROUTE = {
    maps: 'venues',
    events: 'venues',
    settings: 'me'
  };
  let frame = 0;

  function isMobile() {
    return window.matchMedia?.(MOBILE_QUERY).matches === true;
  }

  function closeMenu({ restoreFocus = false } = {}) {
    const sidebar = document.querySelector('.sidebar');
    const menuButton = document.querySelector('#mobileMenuButton');
    const wasOpen = sidebar?.classList.contains('open');
    sidebar?.classList.remove('open');
    document.body.classList.remove('nav-open', 'velvet-mobile-menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    synchronizeNavigation();
    if (restoreFocus && wasOpen) menuButton?.focus({ preventScroll: true });
  }

  function toggleMenu({ restoreFocus = false } = {}) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || !isMobile()) return false;
    const open = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    if (!open && restoreFocus) {
      document.querySelector('#mobileMenuButton')?.focus({ preventScroll: true });
    }
    synchronizeNavigation();
    return open;
  }

  function ensureScrim() {
    let scrim = document.querySelector('.nav-scrim');
    if (!scrim) {
      scrim = document.createElement('button');
      scrim.type = 'button';
      scrim.className = 'nav-scrim';
      scrim.setAttribute('aria-label', 'Fermer le menu');
      document.body.append(scrim);
    }
    if (scrim.dataset.velvetV11Bound !== 'true') {
      scrim.addEventListener('click', () => closeMenu({ restoreFocus: true }));
      scrim.dataset.velvetV11Bound = 'true';
    }
    return scrim;
  }

  function bindMenuButton() {
    const menuButton = document.querySelector('#mobileMenuButton');
    if (!menuButton || menuButton.dataset.velvetV11ControllerBound === 'true') return;
    menuButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu({ restoreFocus: true });
    });
    menuButton.dataset.velvetV11ControllerBound = 'true';
  }

  function currentRoute() {
    const route = document.body.dataset.velvetRoute
      || document.querySelector('.sidebar [data-route].active')?.dataset.route
      || 'home';
    return PRIMARY_FOR_ROUTE[route] || route;
  }

  function synchronizeNavigation() {
    bindMenuButton();
    const primary = currentRoute();
    document.querySelectorAll('#mainNav [data-route],.bottom-nav [data-route]').forEach((button) => {
      const active = button.dataset.route === primary;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    const sidebar = document.querySelector('.sidebar');
    const open = isMobile() && sidebar?.classList.contains('open');
    document.body.classList.toggle('nav-open', Boolean(open));
    document.body.classList.toggle('velvet-mobile-menu-open', Boolean(open));
    const menuButton = document.querySelector('#mobileMenuButton');
    menuButton?.setAttribute('aria-expanded', String(Boolean(open)));
    menuButton?.setAttribute('aria-label', open ? 'Fermer la navigation' : 'Ouvrir la navigation');
    if (sidebar && isMobile()) {
      sidebar.inert = !open;
      sidebar.setAttribute('aria-hidden', String(!open));
      sidebar.setAttribute('aria-modal', String(Boolean(open)));
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-label', 'Plus de Velvet');
    } else if (sidebar) {
      sidebar.inert = false;
      sidebar.removeAttribute('aria-hidden');
      sidebar.removeAttribute('aria-modal');
      sidebar.setAttribute('role', 'navigation');
      sidebar.setAttribute('aria-label', 'Navigation Velvet');
    }

    const scrim = ensureScrim();
    scrim.setAttribute('aria-hidden', String(!open));
    scrim.tabIndex = open ? 0 : -1;
  }

  function synchronizeContent() {
    const content = document.querySelector('#content');
    if (!content) return;
    content.classList.toggle('is-loading', Boolean(content.querySelector(':scope > .loading-state')));
    content.querySelectorAll('button,a,input,select,textarea,summary').forEach((control) => {
      if (!control.hasAttribute('data-v11-touch')) control.setAttribute('data-v11-touch', '');
    });
    document.body.classList.add('velvet-v11');
    document.documentElement.dataset.velvetWebVersion = '1.1';
  }

  function synchronize() {
    frame = 0;
    synchronizeNavigation();
    synchronizeContent();
  }

  function schedule() {
    if (frame) return;
    frame = window.requestAnimationFrame(synchronize);
  }

  document.addEventListener('click', (event) => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton && isMobile() && routeButton.id !== 'mobileMenuButton') {
      window.setTimeout(closeMenu, 0);
    }
    schedule();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu({ restoreFocus: true });
  });

  window.addEventListener('pageshow', schedule);
  window.addEventListener('resize', schedule, { passive: true });
  window.matchMedia?.(MOBILE_QUERY).addEventListener?.('change', () => {
    closeMenu();
    schedule();
  });

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-velvet-route']
  });

  document.addEventListener('DOMContentLoaded', synchronize, { once: true });
  synchronize();

  window.VelvetWebV11 = {
    version: '1.1',
    primaryRoutes: [...PRIMARY_ROUTES],
    closeMenu,
    toggleMenu,
    synchronize
  };
})();
