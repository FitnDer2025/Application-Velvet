(() => {
  const ICONS = {
    home: '<path d="M3.5 10.8 12 3.7l8.5 7.1"/><path d="M5.6 9.4v10h12.8v-10"/><path d="M9.2 19.4v-5.8h5.6v5.8"/>',
    search: '<circle cx="10.7" cy="10.7" r="6.7"/><path d="m15.8 15.8 4.3 4.3"/>',
    map: '<path d="m3.8 6.1 5.3-2.4 5.8 2.4 5.3-2.4v14.2l-5.3 2.4-5.8-2.4-5.3 2.4Z"/><path d="M9.1 3.7v14.2M14.9 6.1v14.2"/>',
    message: '<path d="M20.2 11.4a7.8 7.8 0 0 1-8.1 7.5 9.3 9.3 0 0 1-3.3-.6l-4.7 1.4 1.5-4.3A7.1 7.1 0 0 1 4 11.1a7.8 7.8 0 0 1 8.1-7.5 7.8 7.8 0 0 1 8.1 7.8Z"/>',
    events: '<path d="M12 2.8v18.4M2.8 12h18.4"/><path d="M6.1 6.1 18 18M17.9 6.1 6 18" opacity=".34"/>',
    calendar: '<rect x="3.2" y="5.1" width="17.6" height="15.3" rx="3"/><path d="M7.5 2.8v4.5M16.5 2.8v4.5M3.2 9.4h17.6"/><path d="M7.2 13h2M12 13h2M16.8 13h.1M7.2 17h2M12 17h2"/>',
    venue: '<path d="M4.2 20.2V8.6L12 3.4l7.8 5.2v11.6"/><path d="M2.8 20.2h18.4M8.2 20.2v-6.4h7.6v6.4M8.3 9.2h.1M12 9.2h.1M15.7 9.2h.1"/>',
    bell: '<path d="M5.7 9.5a6.3 6.3 0 0 1 12.6 0c0 7 2.4 7.1 2.4 7.1H3.3s2.4-.1 2.4-7.1Z"/><path d="M9.4 20a3 3 0 0 0 5.2 0"/>',
    profile: '<circle cx="12" cy="8" r="4.2"/><path d="M4.2 20.5c.8-4.3 3.4-6.5 7.8-6.5s7 2.2 7.8 6.5"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 13.8a7.8 7.8 0 0 0 0-3.6l2-1.5-2-3.4-2.5 1a7.7 7.7 0 0 0-3.1-1.8L13.5 2h-4l-.4 2.5A7.7 7.7 0 0 0 6 6.3l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3.6l-2 1.5 2 3.4 2.4-1a7.7 7.7 0 0 0 3.1 1.8l.4 2.5h4l.3-2.5a7.7 7.7 0 0 0 3.1-1.8l2.5 1 2-3.4Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    dashboard: '<rect x="3.2" y="3.2" width="7.1" height="7.1" rx="2"/><rect x="13.7" y="3.2" width="7.1" height="7.1" rx="2"/><rect x="3.2" y="13.7" width="7.1" height="7.1" rx="2"/><rect x="13.7" y="13.7" width="7.1" height="7.1" rx="2"/>',
    ticket: '<path d="M4.2 5.3h15.6v4.1a2.8 2.8 0 0 0 0 5.2v4.1H4.2v-4.1a2.8 2.8 0 0 0 0-5.2Z"/><path d="M12 7.5v1M12 11.5v1M12 15.5v1"/>',
    members: '<circle cx="9" cy="8.1" r="3.4"/><path d="M2.8 19.2c.7-3.7 2.8-5.6 6.2-5.6s5.5 1.9 6.2 5.6"/><path d="M15.3 5.4a3.4 3.4 0 0 1 0 5.4M16.6 13.8c2.5.4 4 2.2 4.6 5.4"/>',
    payment: '<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="3"/><path d="M2.8 9.4h18.4M6.4 15h3"/>',
    eye: '<path d="M2.6 12s3.5-6 9.4-6 9.4 6 9.4 6-3.5 6-9.4 6-9.4-6-9.4-6Z"/><circle cx="12" cy="12" r="2.8"/>',
    team: '<path d="M7.3 18.8v-1.5a4.7 4.7 0 0 1 9.4 0v1.5"/><circle cx="12" cy="8.8" r="3.3"/><path d="M4.1 17.1v-.8a3.4 3.4 0 0 1 2.3-3.2M17.6 13.1a3.4 3.4 0 0 1 2.3 3.2v.8"/>',
    shield: '<path d="M12 2.6 20 6v5.7c0 5-3 8-8 9.7-5-1.7-8-4.7-8-9.7V6Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    quality: '<path d="m12 3 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8Z"/>',
    key: '<circle cx="8.3" cy="14.4" r="4.5"/><path d="m11.5 11.2 8.2-8.2M16.5 6.2l2 2M14.2 8.5l2 2"/>',
    invite: '<path d="M4 5.2h16v13.6H4Z"/><path d="m4 6 8 6 8-6"/>',
    runbook: '<path d="M5 3.2h11.2A2.8 2.8 0 0 1 19 6v14.8H7.8A2.8 2.8 0 0 1 5 18Z"/><path d="M5 18a2.8 2.8 0 0 1 2.8-2.8H19M9 7.3h6M9 10.8h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>'
  };

  const ROUTE_ICONS = {
    home: 'home',
    discover: 'search',
    maps: 'map',
    conversations: 'message',
    events: 'events',
    venues: 'venue',
    notifications: 'bell',
    me: 'profile',
    settings: 'settings'
  };

  const VIEW_ICONS = {
    suite: 'shield',
    release: 'dashboard',
    quality: 'quality',
    access: 'key',
    invitations: 'invite',
    runbook: 'runbook',
    roadmap: 'chart',
    operations: 'dashboard'
  };

  function icon(name, label = '') {
    const title = label ? `<title>${label}</title>` : '';
    return `<svg class="velvet-ui-icon" viewBox="0 0 24 24" aria-hidden="${label ? 'false' : 'true'}" focusable="false" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${title}${ICONS[name] || ICONS.quality}</svg>`;
  }

  function brandMarkup(edition = '') {
    return `<span class="velvet-brand-lockup"><img src="/assets/velvet-icon-192.png" alt="" width="44" height="44"><span><b>VELVET</b>${edition ? `<small>${edition}</small>` : ''}</span></span>`;
  }

  function directText(node) {
    return [...node.childNodes]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join(' ')
      .trim();
  }

  function upgradeMemberButton(button) {
    const name = ROUTE_ICONS[button.dataset.route];
    if (!name) return;
    const slot = button.querySelector(':scope > span');
    if (slot && slot.dataset.velvetIcon !== name) {
      slot.innerHTML = icon(name);
      slot.dataset.velvetIcon = name;
    }
  }

  function memberUi() {
    if (!document.querySelector('.app-shell .bottom-nav')) return false;
    document.body.classList.add('velvet-member-ui');
    const memberProfile = document.querySelector('#content .hero');
    const activeMemberRoute = document.querySelector('.sidebar [data-route].active')?.dataset.route
      || document.querySelector('.bottom-nav [data-route].active')?.dataset.route
      || 'home';
    document.body.dataset.velvetView = memberProfile
      ? `member-profile-${memberProfile.querySelector('[data-edit-profile]') ? 'own' : 'public'}`
      : `member-${activeMemberRoute}`;
    document.querySelectorAll('.brand-mark').forEach((mark) => {
      if (mark.querySelector('img')) return;
      mark.innerHTML = '<img src="/assets/velvet-icon-192.png" alt="" width="44" height="44">';
    });
    document.querySelectorAll('[data-route]').forEach(upgradeMemberButton);

    const header = document.querySelector('.mobile-head');
    const menuButton = document.querySelector('#mobileMenuButton');
    if (header && menuButton) {
      let actions = header.querySelector('.mobile-head-actions');
      if (!actions) {
        actions = document.createElement('span');
        actions.className = 'mobile-head-actions';
        header.append(actions);
      }
      let notifications = actions.querySelector('[data-route="notifications"]');
      if (!notifications) {
        notifications = document.createElement('button');
        notifications.type = 'button';
        notifications.dataset.route = 'notifications';
        actions.prepend(notifications);
      }
      notifications.classList.add('mobile-head-action');
      notifications.setAttribute('aria-label', 'Notifications');
      if (!notifications.querySelector('svg')) notifications.innerHTML = icon('bell');
      menuButton.textContent = '';
      menuButton.setAttribute('aria-label', 'Ouvrir la navigation');
      menuButton.innerHTML = icon('menu');
      menuButton.classList.add('mobile-head-action');
      actions.append(menuButton);
    }
    return true;
  }

  function proIconFromLabel(label) {
    const normalized = label.toLowerCase();
    if (normalized.includes('tableau')) return 'dashboard';
    if (normalized.includes('établissement')) return 'venue';
    if (normalized.includes('agenda') || normalized.includes('soirée')) return 'calendar';
    if (normalized.includes('réservation')) return 'ticket';
    if (normalized.includes('membre')) return 'members';
    if (normalized.includes('message') || normalized.includes('question')) return 'message';
    if (normalized.includes('paiement')) return 'payment';
    if (normalized.includes('visibilité')) return 'eye';
    if (normalized.includes('équipe')) return 'team';
    return 'quality';
  }

  function proIconForButton(button, label) {
    const route = button.getAttribute('onclick')?.match(/go\('([^']+)'\)/)?.[1];
    const routeIcons = {
      dashboard: 'dashboard',
      venue: 'venue',
      events: 'calendar',
      bookings: 'ticket',
      members: 'members',
      messages: 'message',
      finance: 'payment',
      visibility: 'eye',
      team: 'team'
    };
    return routeIcons[route] || proIconFromLabel(label);
  }

  function proUi() {
    if (!document.querySelector('#venueSelect') || !document.querySelector('#mobileNav')) return false;
    document.body.classList.add('velvet-pro-ui');
    const brand = document.querySelector('.sidebar > .brand');
    if (brand && !brand.querySelector('.velvet-brand-lockup')) brand.innerHTML = brandMarkup('PRO');
    const topbar = document.querySelector('.topbar');
    if (topbar && !topbar.querySelector('.velvet-mobile-mark')) {
      const image = document.createElement('img');
      image.src = '/assets/velvet-icon-192.png';
      image.alt = '';
      image.className = 'velvet-mobile-mark';
      image.width = 36;
      image.height = 36;
      topbar.prepend(image);
    }
    document.querySelectorAll('.nav button').forEach((button) => {
      const label = directText(button) || button.textContent;
      const slot = button.querySelector(':scope > i');
      const name = proIconForButton(button, label);
      if (slot && slot.dataset.velvetIcon !== name) {
        slot.innerHTML = icon(name);
        slot.dataset.velvetIcon = name;
      }
    });
    document.querySelectorAll('#mobileNav button').forEach((button) => {
      const label = button.textContent.replace(/[⌂◇◷✓♡◌◉♙€]/g, '').trim();
      const name = proIconForButton(button, label);
      const mobileLabels = {
        dashboard: 'Tableau',
        venue: 'Fiche',
        calendar: 'Agenda',
        ticket: 'Résas',
        members: 'Membres',
        message: 'Messages',
        payment: 'Paiements',
        eye: 'Visibilité',
        team: 'Équipe'
      };
      if (button.dataset.velvetIcon === name) return;
      button.dataset.velvetIcon = name;
      button.innerHTML = `${icon(name)}<small>${mobileLabels[name] || label || 'Espace'}</small>`;
    });
    const activeRoute = document.querySelector('.nav button.active')?.getAttribute('onclick')?.match(/go\('([^']+)'\)/)?.[1];
    document.body.dataset.velvetView = `pro-${activeRoute || 'dashboard'}`;
    document.querySelectorAll('#mobileNav button').forEach((button) => {
      const mobileRoute = button.getAttribute('onclick')?.match(/go\('([^']+)'\)/)?.[1];
      button.classList.toggle('active', Boolean(activeRoute && mobileRoute === activeRoute));
    });
    return true;
  }

  function controlUi() {
    if (!document.querySelector('.top .tabs') || !document.querySelector('#operationsView')) return false;
    document.body.classList.add('velvet-control-ui');
    document.body.dataset.velvetView = `control-${document.querySelector('.top .tab.active[data-view]')?.dataset.view || 'operations'}`;
    const brand = document.querySelector('.top > .brand');
    if (brand && !brand.querySelector('.velvet-brand-lockup')) brand.innerHTML = brandMarkup('CONTRÔLE');
    document.querySelectorAll('.top .tab[data-view]').forEach((button) => {
      const name = VIEW_ICONS[button.dataset.view] || 'quality';
      if (button.querySelector(':scope > .velvet-ui-icon')) return;
      button.insertAdjacentHTML('afterbegin', icon(name));
    });

    const tabs = [...document.querySelectorAll('.top .tab[data-view]')].filter((tab) => !tab.hidden && tab.getAttribute('aria-hidden') !== 'true');
    if (!tabs.length) return true;
    let mobile = document.querySelector('.control-mobile-nav');
    if (!mobile) {
      mobile = document.createElement('nav');
      mobile.className = 'control-mobile-nav';
      mobile.setAttribute('aria-label', 'Navigation Velvet Contrôle');
      document.body.append(mobile);
    }
    const key = tabs.map((tab) => tab.dataset.view).join('|');
    if (mobile.dataset.key !== key) {
      mobile.dataset.key = key;
      mobile.replaceChildren(...tabs.map((tab) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.view = tab.dataset.view;
        button.innerHTML = `${icon(VIEW_ICONS[tab.dataset.view] || 'quality')}<small>${tab.textContent.trim()}</small>`;
        button.addEventListener('click', () => tab.click());
        return button;
      }));
    }
    mobile.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', document.querySelector(`.top .tab[data-view="${button.dataset.view}"]`)?.classList.contains('active'));
    });
    return true;
  }

  function authUi() {
    if (!document.querySelector('#auth.auth-shell')) return false;
    document.body.classList.add('velvet-auth-ui');
    document.querySelectorAll('.brand-copy > .brand, .steps > .brand').forEach((brand) => {
      if (!brand.querySelector('.velvet-brand-lockup')) brand.innerHTML = brandMarkup('');
    });
    const success = document.querySelector('.success-v');
    if (success && !success.querySelector('img')) {
      success.innerHTML = '<img src="/assets/velvet-icon-192.png" alt="" width="94" height="94">';
    }
    return true;
  }

  function enhance() {
    authUi();
    memberUi();
    proUi();
    controlUi();
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhance();
    });
  };

  window.VelvetUI = { icon };
  document.addEventListener('DOMContentLoaded', enhance, { once: true });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'] });
})();
