(() => {
  'use strict';

  if (!location.pathname.startsWith('/membres')) return;

  const LOGO = '/assets/zwit-logo-transparent.png?v=20260806-10';
  const MOBILE_POLISH_CSS = '/assets/zwit-mobile-polish.css?v=20260808-1';
  const ICONS = {
    home: '<path d="M3.5 10.4 12 3.6l8.5 6.8v9.1a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z"/><path d="M9 21v-7h6v7"/>',
    discover: '<path d="M8.6 11.2a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z"/><path d="M2.8 19.3c.6-3.3 2.7-5.2 5.8-5.2 2.3 0 4.1 1 5.1 2.9"/><path d="M15.5 10a2.7 2.7 0 1 0 0-5.4"/><path d="M16.2 13.8c2.7.3 4.4 2 4.9 4.6"/>',
    maps: '<path d="m3.3 5.2 5-2.1 7.4 2.1 5-2.1v15.7l-5 2.1-7.4-2.1-5 2.1z"/><path d="M8.3 3.1v15.7M15.7 5.2v15.7"/>',
    venues: '<path d="M4.2 21V8.2h15.6V21"/><path d="M7.2 8.2V4.1h9.6v4.1M3 21h18"/><path d="M8 12h2M14 12h2M8 16h2M14 16h2"/>',
    conversations: '<path d="M20.6 11.2c0 4.5-4 8.1-8.9 8.1-1.2 0-2.4-.2-3.4-.6l-4.4 1.7 1.5-3.8a7.7 7.7 0 0 1-2.6-5.4c0-4.5 4-8.1 8.9-8.1s8.9 3.6 8.9 8.1Z"/><path d="M7.5 11.2h.1M11.7 11.2h.1M15.9 11.2h.1"/>',
    me: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.9 20.2c.7-4.1 3.1-6.2 7.1-6.2s6.4 2.1 7.1 6.2"/>',
    notifications: '<path d="M6.2 9.6a5.8 5.8 0 0 1 11.6 0c0 6 2.4 6.5 2.4 6.5H3.8s2.4-.5 2.4-6.5Z"/><path d="M9.5 19.1a2.8 2.8 0 0 0 5 0"/>',
    menu: '<path d="M4 6.3h16M4 12h16M4 17.7h16"/>',
    tonight: '<path d="M19.6 15.3A8.4 8.4 0 0 1 8.7 4.4 8.4 8.4 0 1 0 19.6 15.3Z"/><path d="m17.8 4.3.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z"/>',
    passport: '<path d="M12 3 19 6v5c0 4.8-2.9 8.2-7 10-4.1-1.8-7-5.2-7-10V6l7-3Z"/><path d="m9.2 12 1.8 1.8 3.9-4.1"/>',
    photo: '<rect x="3.2" y="5" width="17.6" height="14" rx="2.4"/><circle cx="9" cy="10" r="1.8"/><path d="m5.8 17 4.3-4.2 3.1 2.8 2.2-2 2.8 3.4"/>',
    mic: '<rect x="9" y="3.2" width="6" height="11" rx="3"/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4v3.4M8.8 20.8h6.4"/>'
  };

  const ROUTE_ICON = {
    home: 'home',
    discover: 'discover',
    maps: 'maps',
    venues: 'venues',
    conversations: 'conversations',
    me: 'me',
    events: 'venues',
    notifications: 'notifications',
    settings: 'me'
  };

  function svg(name) {
    const paths = ICONS[name] || ICONS.me;
    return `<svg class="zwit-ios-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  function ensureMobilePolishCss() {
    if (document.querySelector('link[data-zwit-mobile-polish]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MOBILE_POLISH_CSS;
    link.dataset.zwitMobilePolish = '1';
    document.head.append(link);
  }

  function upgradeBrand() {
    document.querySelectorAll('.brand-mark').forEach((mark) => {
      if (mark.dataset.zwitIosLogo === '1') return;
      mark.textContent = '';
      const image = document.createElement('img');
      image.src = LOGO;
      image.alt = '';
      image.decoding = 'async';
      mark.append(image);
      mark.dataset.zwitIosLogo = '1';
    });
  }

  function normalizeMobileHeader() {
    const actions = document.querySelector('.mobile-head-actions');
    if (!actions) return;

    // Ce soir vit dans Profil comme sur iOS ; il ne concurrence plus les actions du header.
    actions.querySelectorAll('[data-zwit-route="tonight"]').forEach((node) => node.remove());

    const notificationButtons = [...actions.querySelectorAll('[data-route="notifications"]')];
    notificationButtons.slice(1).forEach((node) => node.remove());
    const notifications = notificationButtons[0];
    if (notifications) {
      const correctIcon = notifications.children.length === 1
        && notifications.firstElementChild?.matches('svg.zwit-mobile-header-icon');
      if (!correctIcon) {
        notifications.innerHTML = svg('notifications');
        notifications.firstElementChild?.classList.add('zwit-mobile-header-icon');
      }
      notifications.setAttribute('aria-label', 'Notifications');
      notifications.dataset.zwitIosStandaloneIcon = '1';
    }

    const menuButtons = [...actions.querySelectorAll('#mobileMenuButton')];
    menuButtons.slice(1).forEach((node) => node.remove());
    const menu = menuButtons[0];
    if (menu) {
      const correctIcon = menu.children.length === 1
        && menu.firstElementChild?.matches('svg.zwit-mobile-header-icon');
      if (!correctIcon) {
        menu.innerHTML = svg('menu');
        menu.firstElementChild?.classList.add('zwit-mobile-header-icon');
      }
      menu.setAttribute('aria-label', 'Ouvrir la navigation');
      menu.dataset.zwitIosStandaloneIcon = '1';
    }
  }

  function upgradeNavigation() {
    document.querySelectorAll('[data-route]').forEach((button) => {
      const iconName = ROUTE_ICON[button.dataset.route];
      if (!iconName) return;
      let target = button.querySelector(':scope > span');
      if (!target) {
        target = document.createElement('span');
        button.prepend(target);
      }
      if (target.dataset.zwitIosIcon === iconName) return;
      target.innerHTML = svg(iconName);
      target.dataset.zwitIosIcon = iconName;
    });

    document.querySelectorAll('[data-zwit-route="tonight"] > span').forEach((target) => {
      target.innerHTML = svg('tonight');
      target.dataset.zwitIosIcon = 'tonight';
    });

    normalizeMobileHeader();
  }

  function upgradeMessagingComposer() {
    const form = document.querySelector('.velvet-direct-conversation #messageForm');
    if (!form) return;
    form.classList.add('zwit-ios-composer');

    const photo = form.querySelector('.attachment-picker');
    const photoLabel = photo?.querySelector(':scope > span');
    if (photo && photoLabel && photoLabel.dataset.zwitIosLabel !== '1') {
      photo.classList.add('zwit-ios-photo-action');
      photo.setAttribute('aria-label', 'Ajouter une photo, une vidéo ou un PDF');
      photoLabel.innerHTML = `${svg('photo')}<small>Photo</small>`;
      photoLabel.dataset.zwitIosLabel = '1';
    }

    const ephemeral = form.querySelector('[data-zwit-ephemeral-pick]');
    if (ephemeral && ephemeral.dataset.zwitIosLabel !== '1') {
      ephemeral.innerHTML = `<span class="zwit-ios-action-icon">1×</span><small>Éphémère</small>`;
      ephemeral.dataset.zwitIosLabel = '1';
    }

    const voice = form.querySelector('[data-zwit-voice-record]');
    if (voice && !voice.classList.contains('recording') && !voice.querySelector('.zwit-ios-symbol')) {
      voice.innerHTML = `${svg('mic')}<small>Vocal</small>`;
      voice.dataset.zwitIosLabel = '1';
    }
  }

  function upgradeOwnProfileNavigation() {
    const nav = document.querySelector('#content .profile-nav');
    if (!nav || !document.querySelector('#content [data-edit-profile]')) return;

    if (!nav.querySelector('[data-zwit-route="tonight"]')) {
      const tonight = document.createElement('button');
      tonight.type = 'button';
      tonight.dataset.zwitRoute = 'tonight';
      tonight.className = 'zwit-ios-profile-special';
      tonight.innerHTML = `${svg('tonight')}<span>Ce soir</span>`;
      nav.append(tonight);
    }

    if (!nav.querySelector('[data-zwit-passport-focus]')) {
      const passport = document.createElement('button');
      passport.type = 'button';
      passport.dataset.zwitPassportFocus = '1';
      passport.className = 'zwit-ios-profile-special';
      passport.innerHTML = `${svg('passport')}<span>Passeport</span>`;
      nav.append(passport);
    }
  }

  function focusPassport() {
    const target = document.getElementById('zwitPassport');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    document.dispatchEvent(new CustomEvent('zwit:passport-refresh'));
    window.setTimeout(() => document.getElementById('zwitPassport')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220);
  }

  function upgradeDynamicSurfaces() {
    document.querySelectorAll('.page,.form-shell,.velvet-direct-conversation').forEach((node) => {
      node.classList.add('zwit-ios-surface');
    });
    document.querySelectorAll('.page-head,.ios-home-header').forEach((node) => {
      node.classList.add('zwit-ios-page-head');
    });
    upgradeMessagingComposer();
    upgradeOwnProfileNavigation();
  }

  let frame = 0;
  function synchronize() {
    frame = 0;
    document.body.classList.add('zwit-ios-source-of-truth');
    document.documentElement.dataset.zwitUiSource = 'ios';
    ensureMobilePolishCss();
    upgradeBrand();
    upgradeNavigation();
    upgradeDynamicSurfaces();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(synchronize);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-zwit-passport-focus]')) {
      event.preventDefault();
      focusPassport();
    }
  });

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-velvet-route']
  });
  document.addEventListener('DOMContentLoaded', synchronize, { once: true });
  window.addEventListener('pageshow', schedule);
  schedule();

  window.ZwitIOSSourceOfTruth = {
    version: '1.5.1',
    synchronize,
    icons: Object.keys(ICONS)
  };
})();
