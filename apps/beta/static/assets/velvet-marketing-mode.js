(() => {
  'use strict';

  if (!location.pathname.startsWith('/marketing')) return;
  window.__VELVET_MARKETING_MODE__ = true;

  const nativeFetch = window.fetch.bind(window);
  const currentUserId = '10000000-0000-4000-8000-000000000001';
  const currentProfileId = '20000000-0000-4000-8000-000000000001';
  const now = new Date();
  const isoIn = (days, hour = 20) => {
    const value = new Date(now);
    value.setDate(value.getDate() + days);
    value.setHours(hour, 30, 0, 0);
    return value.toISOString();
  };
  const createdAgo = (days) => {
    const value = new Date(now);
    value.setDate(value.getDate() - days);
    return value.toISOString();
  };

  const portrait = (slug, variant = 0) => `/api/control/marketing-portrait?slug=${encodeURIComponent(slug)}&variant=${variant}`;
  const uuid = (group, index) => `${String(group).padStart(8, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`;

  function person(profileIndex, slot, data) {
    return {
      id: uuid(30000000 + profileIndex, slot + 1),
      member_slot: slot === 0 ? (data.couple ? 'partner_a' : 'individual') : 'partner_b',
      linked_user_id: profileIndex === 1 && slot === 0 ? currentUserId : uuid(40000000 + profileIndex, slot + 1),
      first_name: data.firstName,
      birth_year: data.birthYear,
      gender_identity: data.gender,
      height_cm: data.height,
      weight_kg: data.weight || null,
      morphology: data.morphology,
      hair_color: data.hair,
      eye_color: data.eyes,
      children_status: 'private',
      profession: data.profession,
      profession_private: false,
      orientation: data.orientation,
      frequency: data.frequency || 'Régulièrement, sans fréquence fixe',
      biography: data.biography,
      attracted_to: data.attractedTo || ['Couples', 'Femmes'],
      desired_practices: data.desiredPractices || ['Rencontres en couple', 'Clubs et spas', 'À discuter selon le feeling'],
      partner_permissions: data.couple ? ['Conversation', 'Sortie', 'Album privé'] : []
    };
  }

  function media(profileId, slug, variant, role, createdDays = 30) {
    return {
      id: uuid(50000000 + Number(profileId.slice(-2)), variant + 1),
      profile_id: profileId,
      media_type: 'image',
      media_role: role,
      visibility: 'profile',
      moderation_status: 'approved',
      is_primary: variant === 0,
      previewUrl: portrait(slug, variant),
      created_at: createdAgo(createdDays - variant * 4),
      ai_assessment: { synthetic: true, marketing_only: true }
    };
  }

  function makeProfile(index, config) {
    const id = index === 1 ? currentProfileId : uuid(20000000, index);
    const role = config.type === 'couple' ? 'couple_gallery' : 'individual_gallery';
    const mediaAssets = [media(id, config.slug, 0, role, 42), media(id, config.slug, 1, role, 24)];
    const people = config.people.map((row, slot) => person(index, slot, { ...row, couple: config.type === 'couple' }));
    return {
      id,
      profile_type: config.type,
      display_name: config.name,
      city: config.city,
      country_code: config.country || 'FR',
      location_zone: config.zone,
      latitude: config.latitude,
      longitude: config.longitude,
      distance_km: config.distance,
      description: config.description,
      story: config.story,
      journey: config.journey,
      search_text: config.search,
      relationship_since: config.relationshipSince || null,
      practices: config.practices,
      values_list: config.values,
      favorite_places: config.favoritePlaces,
      availability_text: config.availability,
      admission_status: 'approved',
      photo_ready: true,
      trust_score: config.trust,
      verification_status: 'verified',
      created_at: createdAgo(config.createdDays || 120),
      updated_at: createdAgo(1),
      individual_profiles: people,
      media_assets: mediaAssets,
      albums: [
        {
          id: uuid(60000000, index),
          name: config.type === 'couple' ? 'Notre univers' : 'Instants choisis',
          confidentiality: 'public',
          description: 'Une sélection de moments qui reflètent notre univers.',
          media_assets: [mediaAssets[1]],
          album_access_grants: [],
          created_at: createdAgo(20)
        },
        {
          id: uuid(61000000, index),
          name: 'Parenthèses privées',
          confidentiality: 'request',
          description: 'Accessible uniquement après un échange et un accord explicite.',
          media_assets: [],
          album_access_grants: [],
          created_at: createdAgo(12)
        }
      ]
    };
  }

  const profiles = [
    makeProfile(1, {
      slug: 'clara-mathieu', type: 'couple', name: 'Clara & Mathieu', city: 'Lille', zone: 'Métropole lilloise', latitude: 50.632, longitude: 3.057, distance: 2, trust: 96,
      description: 'Complices, naturels et attachés aux rencontres élégantes, nous aimons prendre le temps de découvrir les personnes avant de partager une soirée.',
      story: 'Ensemble depuis 2017, nous avons construit notre univers autour du dialogue, du respect et d’une curiosité vécue à deux.',
      journey: 'Une découverte progressive, faite de belles conversations, de sorties et de rencontres choisies.',
      search: 'Couples et femmes seules avec qui construire un vrai feeling, partager des sorties et vivre des moments simples et raffinés.',
      practices: ['Rencontres en couple', 'Soirées privées', 'Clubs et spas', 'Sensualité et massages'],
      values: ['Consentement', 'Respect', 'Élégance', 'Complicité', 'Humour'], favoritePlaces: ['Lille', 'Belgique', 'Côte d’Opale'], availability: 'Vendredi soir et certains week-ends.', relationshipSince: 2017,
      people: [
        { firstName: 'Clara', birthYear: 1991, gender: 'Femme', height: 166, morphology: 'Sportive', hair: 'Châtains', eyes: 'Verts', profession: 'Cadre', orientation: 'Bisexuelle', biography: 'Souriante, curieuse et attentive au feeling.' },
        { firstName: 'Mathieu', birthYear: 1988, gender: 'Homme', height: 181, morphology: 'Athlétique', hair: 'Bruns', eyes: 'Marron', profession: 'Entrepreneur', orientation: 'Hétérosexuel', biography: 'Calme, sociable et profondément attaché au respect.' }
      ]
    }),
    makeProfile(2, {
      slug: 'lea-nord', type: 'individual', name: 'Léa', city: 'Arras', zone: 'Pas-de-Calais', latitude: 50.291, longitude: 2.777, distance: 46, trust: 93,
      description: 'Indépendante et sélective, je préfère quelques échanges sincères à beaucoup de messages sans personnalité.', story: 'J’avance librement, sans précipitation, avec une vraie attention portée aux mots et aux intentions.', journey: 'Une approche assumée, douce et construite autour de la confiance.', search: 'Couples respectueux, femmes et connexions naturelles.', practices: ['Dîner et feeling', 'Clubs et spas', 'À discuter selon le feeling'], values: ['Discrétion', 'Conversation', 'Liberté', 'Consentement'], favoritePlaces: ['Arras', 'Lille', 'Le Touquet'], availability: 'Plutôt en soirée.', createdDays: 18,
      people: [{ firstName: 'Léa', birthYear: 1993, gender: 'Femme', height: 169, morphology: 'Svelte', hair: 'Bruns', eyes: 'Noisette', profession: 'Consultante', orientation: 'Bisexuelle', biography: 'Curieuse, indépendante et sensible aux échanges intelligents.' }]
    }),
    makeProfile(3, {
      slug: 'sophie-thomas', type: 'couple', name: 'Sophie & Thomas', city: 'Lens', zone: 'Bassin minier', latitude: 50.433, longitude: 2.833, distance: 37, trust: 91,
      description: 'Débutants, très complices et décidés à avancer uniquement à notre rythme.', story: 'Notre curiosité est récente, mais notre dialogue et notre confiance sont solides.', journey: 'Une première phase de découverte commune, sans pression.', search: 'Couples bienveillants, conseils et sorties accessibles aux débutants.', practices: ['À découvrir ensemble', 'Clubs et spas', 'Rencontres en couple'], values: ['Bienveillance', 'Patience', 'Consentement', 'Complicité'], favoritePlaces: ['Lens', 'Lille', 'Belgique'], availability: 'Quelques samedis selon le feeling.', relationshipSince: 2012,
      people: [
        { firstName: 'Sophie', birthYear: 1989, gender: 'Femme', height: 164, morphology: 'Pulpeuse / Curvy', hair: 'Blonds', eyes: 'Bleus', profession: 'Responsable commerciale', orientation: 'Bi-curieuse', biography: 'Spontanée, souriante et prudente.' },
        { firstName: 'Thomas', birthYear: 1987, gender: 'Homme', height: 178, morphology: 'Standard', hair: 'Châtains', eyes: 'Bleus', profession: 'Technicien', orientation: 'Hétérosexuel', biography: 'Calme, protecteur et très attaché au dialogue.' }
      ]
    }),
    makeProfile(4, {
      slug: 'maxime-lille', type: 'individual', name: 'Maxime', city: 'Lille', zone: 'Métropole lilloise', latitude: 50.641, longitude: 3.078, distance: 4, trust: 89,
      description: 'Sociable, sportif et toujours respectueux des limites exprimées.', story: 'Je privilégie l’humour, la conversation et les rencontres où chacun se sent libre.', journey: 'Une expérience régulière mais jamais automatique.', search: 'Couples ouverts à la discussion et sorties conviviales.', practices: ['Soirées privées', 'Voyages', 'À discuter selon le feeling'], values: ['Respect', 'Humour', 'Franchise', 'Hygiène'], favoritePlaces: ['Lille', 'Tournai', 'Bruxelles'], availability: 'Deux ou trois soirs par mois.',
      people: [{ firstName: 'Maxime', birthYear: 1990, gender: 'Homme', height: 184, morphology: 'Sportive', hair: 'Bruns', eyes: 'Marron', profession: 'Chef de projet', orientation: 'Hétérosexuel', biography: 'Souriant, attentif et direct sans jamais être insistant.' }]
    }),
    makeProfile(5, {
      slug: 'nina-lucas', type: 'couple', name: 'Nina & Lucas', city: 'Tournai', zone: 'Belgique frontalière', country: 'BE', latitude: 50.607, longitude: 3.389, distance: 29, trust: 95,
      description: 'Très actifs dans les sorties, nous aimons découvrir de nouveaux lieux et créer des groupes sympathiques.', story: 'Notre univers est convivial, énergique et toujours respectueux.', journey: 'Une vie sociale riche et des rencontres choisies.', search: 'Couples sociables, sorties, événements et voyages.', practices: ['Clubs et spas', 'Voyages', 'Soirées privées'], values: ['Convivialité', 'Respect', 'Énergie', 'Discrétion'], favoritePlaces: ['Tournai', 'Lille', 'Bruxelles'], availability: 'Souvent disponibles le week-end.', relationshipSince: 2019,
      people: [
        { firstName: 'Nina', birthYear: 1992, gender: 'Femme', height: 171, morphology: 'Sportive', hair: 'Roux', eyes: 'Verts', profession: 'Designer', orientation: 'Bisexuelle', biography: 'Énergique, sociable et toujours partante pour découvrir un nouveau lieu.' },
        { firstName: 'Lucas', birthYear: 1990, gender: 'Homme', height: 182, morphology: 'Athlétique', hair: 'Bruns', eyes: 'Verts', profession: 'Commercial', orientation: 'Hétérosexuel', biography: 'Ouvert, drôle et attentif à ce que chacun soit à l’aise.' }
      ]
    }),
    makeProfile(6, {
      slug: 'camille-bxl', type: 'individual', name: 'Camille', city: 'Bruxelles', zone: 'Bruxelles et alentours', country: 'BE', latitude: 50.846, longitude: 4.352, distance: 111, trust: 92,
      description: 'Créative, ouverte d’esprit et très attachée au respect de chaque identité.', story: 'Je cherche surtout de belles conversations et des personnes capables de rester naturelles.', journey: 'Une exploration libre, culturelle et assumée.', search: 'Femmes, couples et personnes ouvertes, événements culturels et sorties premium.', practices: ['Événements', 'Voyages', 'Photographie'], values: ['Inclusion', 'Élégance', 'Curiosité', 'Consentement'], favoritePlaces: ['Bruxelles', 'Anvers', 'Lille'], availability: 'Plutôt en semaine et lors d’événements.',
      people: [{ firstName: 'Camille', birthYear: 1994, gender: 'Personne non binaire', height: 173, morphology: 'Svelte', hair: 'Noirs', eyes: 'Marron', profession: 'Direction artistique', orientation: 'Pansexuelle', biography: 'Créative, sensible à l’esthétique et aux conversations qui sortent du banal.' }]
    })
  ];

  const venues = [
    { id: uuid(70000000, 1), claimed_establishment_id: uuid(71000000, 1), name: 'L’Only', kind: 'club', city: 'Lille', postal_code: '59000', country_code: 'FR', region: 'Hauts-de-France', latitude: 50.629, longitude: 3.061, address_public: 'Lille · adresse communiquée avant la soirée', description: 'Un établissement élégant aux soirées thématiques et à l’accueil soigné.', audience: 'Couples et membres sélectionnés', evening_types: 'Soirées couples, mixtes et événements premium', amenities: ['Vestiaire', 'Lounge', 'Espace danse', 'Parking'], opening_hours_text: 'Vendredi et samedi à partir de 21 h 30', pricing_text: 'Tarifs selon programmation', subscription_status: 'active', claim_status: 'claimed', website: '', manual_review_required: false },
    { id: uuid(70000000, 2), claimed_establishment_id: uuid(71000000, 2), name: 'La Tentation', kind: 'club', city: 'Mouscron', postal_code: '7700', country_code: 'BE', region: 'Wallonie', latitude: 50.744, longitude: 3.214, address_public: 'Mouscron · Belgique', description: 'Une adresse reconnue de la région frontalière avec une programmation variée.', audience: 'Couples, femmes et soirées mixtes', evening_types: 'Nuits couples et soirées à thème', amenities: ['Lounge', 'Bar', 'Piste de danse'], opening_hours_text: 'Selon agenda', pricing_text: 'Tarifs communiqués par soirée', subscription_status: 'active', claim_status: 'claimed', manual_review_required: false },
    { id: uuid(70000000, 3), claimed_establishment_id: uuid(71000000, 3), name: 'O’Pulsion', kind: 'spa', city: 'Hauts-de-France', postal_code: '62000', country_code: 'FR', region: 'Hauts-de-France', latitude: 50.412, longitude: 2.805, address_public: 'Hauts-de-France', description: 'Un espace bien-être intimiste qui privilégie la convivialité et la discrétion.', audience: 'Couples et membres sur réservation', evening_types: 'Spa, détente et soirées privées', amenities: ['Spa', 'Sauna', 'Espace détente'], opening_hours_text: 'Sur réservation', pricing_text: 'Formules selon créneau', subscription_status: 'active', claim_status: 'claimed', manual_review_required: false }
  ];

  const events = [
    { id: uuid(80000000, 1), title: 'Nuit Zwit · Élégance & Connexions', description: 'Une soirée pensée pour favoriser les échanges dans une ambiance chic, musicale et bienveillante.', starts_at: isoIn(4, 21), ends_at: isoIn(5, 3), location_public: 'L’Only · Lille', audience: 'Couples et femmes', capacity: 120, registered_count: 84, establishment_id: venues[0].claimed_establishment_id, organizer_profile_id: profiles[4].id, latitude: venues[0].latitude, longitude: venues[0].longitude },
    { id: uuid(80000000, 2), title: 'Cocktail Découverte', description: 'Une première rencontre simple et rassurante pour découvrir la communauté Velvet.', starts_at: isoIn(7, 20), ends_at: isoIn(8, 1), location_public: 'La Tentation · Mouscron', audience: 'Couples, femmes et nouveaux membres', capacity: 90, registered_count: 62, establishment_id: venues[1].claimed_establishment_id, organizer_profile_id: profiles[2].id, latitude: venues[1].latitude, longitude: venues[1].longitude },
    { id: uuid(80000000, 3), title: 'Parenthèse Spa & Complicité', description: 'Un rendez-vous intimiste autour du bien-être et de la convivialité.', starts_at: isoIn(11, 19), ends_at: isoIn(12, 0), location_public: 'O’Pulsion · Hauts-de-France', audience: 'Couples', capacity: 36, registered_count: 28, establishment_id: venues[2].claimed_establishment_id, organizer_profile_id: profiles[0].id, latitude: venues[2].latitude, longitude: venues[2].longitude }
  ];

  const conversations = [
    { id: uuid(90000000, 1), kind: 'direct', subject: 'Léa · Clara & Mathieu', conversation_members: [{ user_id: currentUserId }, { user_id: profiles[1].individual_profiles[0].linked_user_id }] },
    { id: uuid(90000000, 2), kind: 'direct', subject: 'Nina & Lucas · Clara & Mathieu', conversation_members: [{ user_id: currentUserId }, { user_id: profiles[4].individual_profiles[0].linked_user_id }] }
  ];

  const messagesByConversation = {
    [conversations[0].id]: [
      { id: uuid(91000000, 1), sender_user_id: profiles[1].individual_profiles[0].linked_user_id, sender_identity: 'Léa', body: 'Bonsoir, votre univers et votre façon de présenter les choses me parlent beaucoup.', created_at: createdAgo(1), attachments: [] },
      { id: uuid(91000000, 2), sender_user_id: currentUserId, sender_identity: 'Clara & Mathieu', body: 'Merci Léa. On aime prendre le temps de découvrir les personnes sans rien précipiter.', created_at: createdAgo(1), attachments: [] },
      { id: uuid(91000000, 3), sender_user_id: profiles[1].individual_profiles[0].linked_user_id, sender_identity: 'Léa', body: 'C’est exactement ce que je recherche. Peut-être se croiser à la soirée de samedi ?', created_at: now.toISOString(), attachments: [] }
    ],
    [conversations[1].id]: [
      { id: uuid(92000000, 1), sender_user_id: profiles[4].individual_profiles[0].linked_user_id, sender_identity: 'Nina & Lucas', body: 'Nous serons à L’Only samedi. Votre profil nous semble très naturel.', created_at: createdAgo(2), attachments: [] },
      { id: uuid(92000000, 2), sender_user_id: currentUserId, sender_identity: 'Clara & Mathieu', body: 'Avec plaisir pour prendre un verre et voir si le feeling est là.', created_at: createdAgo(2), attachments: [] }
    ]
  };

  const recommendations = [
    { id: uuid(93000000, 1), target_type: 'profile', target_id: profiles[0].id, author_profile_id: profiles[4].id, body: 'Un couple naturel, respectueux et très agréable à rencontrer.', rating: 5, created_at: createdAgo(14) },
    { id: uuid(93000000, 2), target_type: 'profile', target_id: profiles[1].id, author_profile_id: profiles[0].id, body: 'Une très belle qualité d’échange, beaucoup de finesse et de sincérité.', rating: 5, created_at: createdAgo(8) },
    { id: uuid(93000000, 3), target_type: 'establishment', target_id: venues[0].claimed_establishment_id, author_profile_id: profiles[4].id, body: 'Une ambiance élégante et une équipe attentive.', rating: 5, created_at: createdAgo(20) }
  ];

  const notifications = [
    { id: uuid(94000000, 1), event_type: 'messages', title: 'Nouveau message de Léa', body: 'Peut-être se croiser à la soirée de samedi ?', actor_profile_id: profiles[1].id, entity_type: 'conversation', entity_id: conversations[0].id, created_at: now.toISOString(), read_at: null },
    { id: uuid(94000000, 2), event_type: 'likes', title: 'Nina & Lucas aiment votre univers', body: 'Votre profil a reçu un nouveau coup de cœur.', actor_profile_id: profiles[4].id, entity_type: 'profile', entity_id: profiles[0].id, created_at: createdAgo(1), read_at: null },
    { id: uuid(94000000, 3), event_type: 'events', title: 'Rappel de sortie', body: 'Nuit Zwit commence samedi à 21 h 30.', actor_profile_id: null, entity_type: 'event', entity_id: events[0].id, created_at: createdAgo(1), read_at: createdAgo(1) }
  ];

  const access = {
    tier: 'beta_full', source: 'founder', validUntil: null,
    features: { advancedSearch: true, savedSearches: true, unlimitedConversations: true, unlimitedFollowing: true, followConnectionAlerts: true, profileAiLimit: 20, profileAiUsed: 2, followingUsed: 2 }
  };
  const directory = {
    profiles,
    establishments: venues.map((venue) => ({ ...venue, id: venue.claimed_establishment_id })),
    venueDirectory: venues,
    venueRelationships: [{ venue_id: venues[0].id, relation_type: 'favorite' }, { venue_id: venues[1].id, relation_type: 'visited' }],
    events,
    conversations,
    recommendations
  };
  const engagement = {
    views: profiles.slice(1, 5).map((profile, index) => ({ profile_id: profile.id, last_viewed_at: createdAgo(index + 1), view_count: index + 1 })),
    reactions: [{ profile_id: profiles[1].id, reaction: 5 }, { profile_id: profiles[4].id, reaction: 4 }],
    streaks: [{ conversation_id: conversations[0].id, current_streak: 4, longest_streak: 7 }, { conversation_id: conversations[1].id, current_streak: 2, longest_streak: 3 }],
    currentUserId,
    currentProfileId
  };
  const map = {
    center: { latitude: 50.629, longitude: 3.057, source: 'private_approximate_location', label: 'Lille' },
    members: profiles.slice(1).map((profile) => ({ profile_id: profile.id, latitude: profile.latitude, longitude: profile.longitude, display_name: profile.display_name, profile_type: profile.profile_type, distance_km: profile.distance_km })),
    venues,
    events
  };
  const discovery = {
    presence: profiles.map((profile, index) => ({ profile_id: profile.id, presence_status: index === 1 || index === 4 ? 'online' : 'recent' })),
    savedSearches: [{ id: uuid(95000000, 1), name: 'Autour de Lille', filters: { city: 'Lille', types: ['couple'], withPhotos: true } }],
    persistenceAvailable: true,
    presenceAvailable: true,
    following: [profiles[1].id, profiles[4].id],
    access
  };
  const settings = {
    privacy: { profile_visibility: 'members', location_precision: 'approximate', allow_messages_from: ['couple', 'woman'], show_online_status: true },
    notifications: { email: true, push: true, events: { messages: true, likes: true, album_access: true, profile_views: true, events: true, recommendations: true, security: true } }
  };

  let localNotifications = [...notifications];
  let localRelationships = [...directory.venueRelationships];

  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-velvet-marketing': 'synthetic' }
    });
  }

  function fixtureResponse(url, init = {}) {
    const path = url.pathname;
    const method = String(init.method || 'GET').toUpperCase();
    if (path === '/api/members/profile') return json({ profile: profiles[0], account: { userId: currentUserId, email: 'marketing@velvet.internal', roles: ['admin', 'direction'] }, access, membership: { plan_code: 'member_signature', status: 'active' }, personalProfileComplete: true });
    if (path === '/api/members/verification') return json({ status: 'verified', verified: true, adultVerified: true, accessBlockedByVerification: false, providerConfigured: true });
    if (path === '/api/members/directory') return json(directory);
    if (path === '/api/members/organizer-request') return json({ request: null });
    if (path === '/api/members/engagement') return json(engagement);
    if (path === '/api/members/photo-reactions') return json({ reactions: [] });
    if (path === '/api/members/notifications') {
      if (method === 'POST') {
        const body = JSON.parse(String(init.body || '{}'));
        localNotifications = localNotifications.map((row) => body.action === 'read_all' || row.id === body.notificationId ? { ...row, read_at: now.toISOString() } : row);
      }
      return json({ notifications: localNotifications, unreadCount: localNotifications.filter((row) => !row.read_at).length });
    }
    if (path === '/api/members/location') return json({ location: { enabled: true, precision: 'approximate', city: 'Lille', latitude: 50.629, longitude: 3.057 }, nearbyVenues: venues });
    if (path === '/api/members/map') return json(map);
    if (path === '/api/members/discovery') return json(discovery);
    if (path === '/api/members/plans') return json({ venueVisits: [{ id: uuid(96000000, 1), profile_id: profiles[0].id, venue_id: venues[0].id, visit_date: isoIn(4).slice(0, 10), venue_directory: venues[0] }], travelPlans: [], eventPlans: [{ id: uuid(96000000, 2), profile_id: profiles[0].id, event_id: events[0].id, registration_status: 'confirmed' }], migrationPending: false });
    if (path === '/api/members/account-actions') return json({ profile: null, action: null });
    if (path === '/api/members/photos') return json({ photos: profiles[0].media_assets });
    if (path === '/api/members/settings') return json({ settings });
    if (path === '/api/members/venue-relationships') {
      if (method === 'POST') return json({ relationships: localRelationships });
      return json({ relationships: localRelationships });
    }
    if (path === '/api/members/social-actions') return json({ favorite: true, blocked: false });
    if (path === '/api/members/conversations' && method === 'POST') return json({ conversationId: conversations[0].id });
    if (path === '/api/members/messages') {
      const conversationId = url.searchParams.get('conversationId') || conversations[0].id;
      return json({ messages: messagesByConversation[conversationId] || [], currentUserId, streak: engagement.streaks.find((row) => row.conversation_id === conversationId) || null });
    }
    if (path === '/api/members/event-registrations') {
      const eventId = url.searchParams.get('eventId') || events[0].id;
      return json({ currentUserId, registrations: [{ id: uuid(97000000, 1), event_id: eventId, user_id: currentUserId, places: 2, status: 'confirmed', registration_status: 'confirmed', visible_to_participants: true }] });
    }
    if (path === '/api/billing/catalog') return json({ provider: { configured: false }, prices: [] });
    if (path.startsWith('/api/reference/communes')) return json({ results: [{ city: 'Lille', postalCode: '59000', countryCode: 'FR', region: 'Hauts-de-France', latitude: 50.629, longitude: 3.057, label: 'Lille (59000)' }] });
    if (path.startsWith('/api/members/')) return json({ ok: true, synthetic: true });
    return null;
  }

  function accessDenied() {
    document.documentElement.classList.remove('velvet-marketing-pending');
    document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:30px;background:#0d0d0d;color:#f5f1ed;font-family:Inter,Arial"><section style="max-width:620px;text-align:center"><p style="color:#c6a96a;letter-spacing:.16em">ZWIT MARKETING</p><h1 style="font:500 48px Georgia">Accès réservé</h1><p>Cette démonstration est accessible uniquement depuis Zwit Control avec un rôle Direction ou Admin.</p><a href="/control/" style="display:inline-block;margin-top:18px;padding:13px 18px;border-radius:999px;background:#c6a96a;color:#17120b;text-decoration:none;font-weight:800">Retour à Zwit Control</a></section></main>';
  }

  document.documentElement.classList.add('velvet-marketing-pending');
  const accessReady = nativeFetch('/api/control/studio-media', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'capabilities' })
  }).then((response) => {
    if (!response.ok) throw new Error('marketing_access_required');
    document.documentElement.classList.remove('velvet-marketing-pending');
    return true;
  }).catch((error) => {
    accessDenied();
    throw error;
  });

  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input?.url || '', location.origin);
    const fixture = fixtureResponse(url, init);
    if (!fixture) return nativeFetch(input, init);
    try {
      await accessReady;
      return fixture;
    } catch {
      return json({ error: 'studio_access_required' }, 403);
    }
  };

  function installMarketingIdentity() {
    document.title = 'Zwit — BETA Marketing';
    document.querySelectorAll('.brand small').forEach((node) => { node.textContent = 'BETA Marketing'; });
    const foot = document.querySelector('.sidebar-foot p');
    if (foot) foot.innerHTML = '<span class="live-dot"></span>Données fictives · environnement marketing';
    if (!document.querySelector('#velvetMarketingBadge')) {
      const badge = document.createElement('div');
      badge.id = 'velvetMarketingBadge';
      badge.textContent = 'BETA MARKETING · PROFILS FICTIFS';
      badge.style.cssText = 'position:fixed;z-index:9997;right:14px;top:14px;padding:8px 11px;border:1px solid #c6a96a55;border-radius:999px;background:#0d0d0ddd;color:#c6a96a;font:700 10px Inter,Arial;letter-spacing:.12em;backdrop-filter:blur(12px)';
      document.body.appendChild(badge);
    }
  }

  function inlineStylesForCapture() {
    if (!new URLSearchParams(location.search).has('velvet_capture') || document.querySelector('#velvetMarketingInlineCss')) return;
    const css = [];
    for (const sheet of [...document.styleSheets]) {
      try { css.push([...sheet.cssRules].map((rule) => rule.cssText).join('\n')); } catch {}
    }
    const style = document.createElement('style');
    style.id = 'velvetMarketingInlineCss';
    style.textContent = `${css.join('\n')}\n#velvetMarketingBadge,.sidebar-foot{display:none!important}.app-shell{min-height:100vh!important}`;
    document.head.appendChild(style);
  }

  function actualRoute(name) {
    return document.querySelector(`[data-route="${name}"]`);
  }

  function installCaptureBridge() {
    if (!new URLSearchParams(location.search).has('velvet_capture')) return;
    const shell = document.querySelector('.app-shell');
    const content = document.querySelector('#content');
    if (!shell || !content || content.querySelector('.loading-state')) return;
    shell.classList.add('vc-shell');
    if (document.querySelector('#velvetMarketingCaptureBridge')) return;
    inlineStylesForCapture();
    const bridge = document.createElement('div');
    bridge.id = 'velvetMarketingCaptureBridge';
    bridge.hidden = true;
    bridge.innerHTML = ['home', 'discover', 'profile', 'messages', 'events', 'map'].map((view) => `<button type="button" data-vc-view="${view}">${view}</button>`).join('');
    document.body.appendChild(bridge);
    const navigate = (view) => {
      if (view === 'home') actualRoute('home')?.click();
      if (view === 'discover') actualRoute('discover')?.click();
      if (view === 'events') actualRoute('events')?.click();
      if (view === 'map') actualRoute('maps')?.click();
      if (view === 'profile') {
        actualRoute('discover')?.click();
        setTimeout(() => document.querySelector('[data-open-profile]')?.click(), 30);
      }
      if (view === 'messages') {
        actualRoute('conversations')?.click();
        setTimeout(() => document.querySelector('[data-open-conversation]')?.click(), 30);
      }
    };
    bridge.querySelectorAll('[data-vc-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.vcView)));
  }

  function disableMarketingWrites() {
    document.addEventListener('submit', (event) => {
      if (!location.pathname.startsWith('/marketing')) return;
      if (event.target.matches('#messageForm')) return;
      event.preventDefault();
    }, true);
  }

  if (navigator.serviceWorker?.register) {
    try { navigator.serviceWorker.register = () => Promise.resolve(null); } catch {}
  }
  disableMarketingWrites();
  document.addEventListener('DOMContentLoaded', () => {
    installMarketingIdentity();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      installMarketingIdentity();
      installCaptureBridge();
      if (attempts > 160 || document.querySelector('#velvetMarketingCaptureBridge')) clearInterval(timer);
    }, 50);
  });
})();
