(() => {
  'use strict';

  if (!location.pathname.startsWith('/marketing-pro')) return;
  window.__VELVET_MARKETING_PRO_MODE__ = true;

  const studioBridge = document.createElement('script');
  studioBridge.src = '/assets/velvet-marketing-pro-studio-bridge.js?v=20260805-1';
  studioBridge.async = false;
  document.head.appendChild(studioBridge);

  const nativeFetch = window.fetch.bind(window);
  const now = new Date();
  const uuid = (group, index) => `${String(group).padStart(8, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`;
  const isoIn = (days, hour = 21) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hour, 30, 0, 0);
    return date.toISOString();
  };
  const isoAgo = (days) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const venueId = uuid(72000000, 1);
  const events = [
    { id: uuid(82000000, 1), establishment_id: venueId, owner_type: 'establishment', title: 'Nuit Velvet · Élégance & Connexions', description: 'Une soirée premium pensée pour les échanges naturels et les rencontres choisies.', starts_at: isoIn(4), ends_at: isoIn(5, 3), capacity: 120, location_public: 'Lille · adresse communiquée aux participants', audience: 'Couples et femmes', visibility: 'published', price_cents: 6000, currency: 'EUR', registration_open: true, dress_code: 'Élégant et soigné', created_at: isoAgo(34), updated_at: isoAgo(1) },
    { id: uuid(82000000, 2), establishment_id: venueId, owner_type: 'establishment', title: 'Cocktail Première Rencontre', description: 'Un rendez-vous doux et rassurant pour découvrir l’établissement et la communauté.', starts_at: isoIn(11, 20), ends_at: isoIn(12, 1), capacity: 80, location_public: 'Lille', audience: 'Nouveaux membres et couples', visibility: 'published', price_cents: 4500, currency: 'EUR', registration_open: true, dress_code: 'Chic décontracté', created_at: isoAgo(22), updated_at: isoAgo(2) },
    { id: uuid(82000000, 3), establishment_id: venueId, owner_type: 'establishment', title: 'Parenthèse Couples', description: 'Une ambiance intimiste, musicale et raffinée.', starts_at: isoIn(18, 21), ends_at: isoIn(19, 3), capacity: 56, location_public: 'Lille', audience: 'Couples uniquement', visibility: 'draft', price_cents: 7000, currency: 'EUR', registration_open: false, dress_code: 'Noir et or', created_at: isoAgo(8), updated_at: isoAgo(1) }
  ];

  const names = [
    ['Clara & Mathieu', 'couple', 'Lille'], ['Nina & Lucas', 'couple', 'Tournai'], ['Léa', 'individual', 'Arras'],
    ['Sophie & Thomas', 'couple', 'Lens'], ['Camille', 'individual', 'Bruxelles'], ['Élodie & Marc', 'couple', 'Douai'],
    ['Anaïs', 'individual', 'Lille'], ['Julie & Antoine', 'couple', 'Valenciennes'], ['Chloé', 'individual', 'Roubaix'],
    ['Emma & Julien', 'couple', 'Béthune'], ['Laura', 'individual', 'Mouscron'], ['Sarah & Nicolas', 'couple', 'Tourcoing']
  ];

  const registrations = [];
  for (let index = 0; index < 38; index += 1) {
    const identity = names[index % names.length];
    registrations.push({
      registration_id: uuid(83000000, index + 1),
      event_id: events[index % 2].id,
      profile_id: uuid(23000000, (index % names.length) + 1),
      display_name: identity[0],
      profile_type: identity[1],
      location_zone: identity[2],
      places: identity[1] === 'couple' ? 2 : 1,
      registration_status: index % 9 === 0 ? 'checked_in' : 'confirmed',
      registered_at: isoAgo((index % 14) + 1)
    });
  }

  const workspace = {
    account: { userId: uuid(10000000, 9), email: 'direction@velvet-marketing.internal', roles: ['admin', 'pro_owner'] },
    venues: [{
      id: venueId,
      directory_venue_id: uuid(70000000, 1),
      slug: 'maison-velvet-lille',
      name: 'Maison Velvet Lille',
      kind: 'club',
      description: 'Une adresse élégante et contemporaine qui place l’accueil, la discrétion et la qualité des rencontres au centre de chaque soirée.',
      city: 'Lille',
      address_public: 'Lille · adresse communiquée avant la soirée',
      phone_public: '03 20 00 00 00',
      email_public: 'contact@maison-velvet.demo',
      opening_hours: { public: 'Vendredi et samedi à partir de 21 h 30' },
      amenities: ['Lounge', 'Vestiaire', 'Bar', 'Piste de danse', 'Parking privé'],
      visibility: 'published',
      verified_at: isoAgo(120),
      subscription_status: 'active',
      updated_at: isoAgo(1),
      establishment_staff: [{ user_id: uuid(10000000, 9), staff_role: 'owner', status: 'active' }]
    }],
    events,
    registrations,
    drafts: [],
    billingPrices: [
      { price_code: 'pro_monthly_eur', plan_code: 'pro_workspace', currency: 'EUR', amount_cents: 3990, interval_unit: 'month', interval_count: 1 },
      { price_code: 'pro_annual_eur', plan_code: 'pro_workspace', currency: 'EUR', amount_cents: 39900, interval_unit: 'year', interval_count: 1 }
    ]
  };

  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-velvet-marketing-pro': 'synthetic' }
    });
  }

  function accessDenied() {
    document.documentElement.classList.remove('velvet-marketing-pro-pending');
    document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:30px;background:#0d0d0d;color:#f5f1ed;font-family:Inter,Arial"><section style="max-width:620px;text-align:center"><p style="color:#d5b477;letter-spacing:.16em">VELVET PRO MARKETING</p><h1 style="font:500 48px Georgia">Accès réservé</h1><p>Cet environnement de démonstration est réservé à Velvet Control.</p><a href="/control/" style="display:inline-block;margin-top:18px;padding:13px 18px;border-radius:999px;background:#d5b477;color:#17120b;text-decoration:none;font-weight:800">Retour à Velvet Control</a></section></main>';
  }

  document.documentElement.classList.add('velvet-marketing-pro-pending');
  const accessReady = nativeFetch('/api/control/studio-media', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'capabilities' })
  }).then((response) => {
    if (!response.ok) throw new Error('marketing_pro_access_required');
    document.documentElement.classList.remove('velvet-marketing-pro-pending');
    return true;
  }).catch((error) => {
    accessDenied();
    throw error;
  });

  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input?.url || '', location.origin);
    if (url.pathname === '/api/pro/workspace') {
      try {
        await accessReady;
        return json({ ...workspace, ok: true });
      } catch {
        return json({ error: 'studio_access_required' }, 403);
      }
    }
    if (url.pathname === '/api/billing/catalog') return json({ provider: { configured: false }, prices: workspace.billingPrices });
    if (url.pathname === '/api/billing/checkout') return json({ error: 'marketing_mode_no_checkout' }, 409);
    return nativeFetch(input, init);
  };

  function installIdentity() {
    document.title = 'Velvet Pro — BETA Marketing';
    document.querySelectorAll('.brand b').forEach((node) => { node.textContent = 'VELVET'; });
    document.querySelectorAll('.brand .pro').forEach((node) => { node.textContent = 'PRO MARKETING'; });
    if (!document.querySelector('#velvetMarketingProBadge')) {
      const badge = document.createElement('div');
      badge.id = 'velvetMarketingProBadge';
      badge.textContent = 'BETA MARKETING PRO · DONNÉES FICTIVES';
      badge.style.cssText = 'position:fixed;z-index:9997;right:14px;top:14px;padding:8px 11px;border:1px solid #d5b47755;border-radius:999px;background:#0d0d0ddd;color:#d5b477;font:700 10px Inter,Arial;letter-spacing:.12em;backdrop-filter:blur(12px)';
      document.body.appendChild(badge);
    }
  }

  function callView(view) {
    if (typeof window.go === 'function') {
      window.go(view);
      return;
    }
    const label = ({ dashboard: 'Tableau de bord', venue: 'Établissement', events: 'Événements', bookings: 'Inscriptions' })[view] || '';
    const button = [...document.querySelectorAll('.nav button,.mobile-nav button')].find((node) => node.textContent.includes(label));
    button?.click();
  }

  function installCaptureBridge() {
    if (!new URLSearchParams(location.search).has('velvet_capture')) return;
    if (!document.querySelector('.shell') || document.querySelector('#velvetMarketingProCaptureBridge')) return;
    const style = document.createElement('style');
    style.id = 'velvetMarketingProCaptureCss';
    style.textContent = '#velvetMarketingProBadge,.sidebar-foot,body>nav[aria-label="Informations légales"]{display:none!important}.shell{min-height:100vh!important}';
    document.head.appendChild(style);
    const bridge = document.createElement('div');
    bridge.id = 'velvetMarketingProCaptureBridge';
    bridge.hidden = true;
    bridge.innerHTML = ['dashboard', 'venue', 'events', 'bookings'].map((view) => `<button type="button" data-vp-view="${view}">${view}</button>`).join('');
    document.body.appendChild(bridge);
    bridge.querySelectorAll('[data-vp-view]').forEach((button) => button.addEventListener('click', () => callView(button.dataset.vpView)));
  }

  if (navigator.serviceWorker?.register) {
    try { navigator.serviceWorker.register = () => Promise.resolve(null); } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    installIdentity();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      installIdentity();
      installCaptureBridge();
      if (attempts > 180 || document.querySelector('#velvetMarketingProCaptureBridge')) clearInterval(timer);
    }, 60);
  });
})();
