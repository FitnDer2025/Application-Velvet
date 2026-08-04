Warning: truncated output (original token count: 68367)
Total output lines: 5011

(() => {
  const THEME_STORAGE_KEY = 'velvet-member-theme-v1';
  const SAVED_SEARCH_STORAGE_KEY = 'velvet-saved-searches-v1';
  const DISCOVER_VIEW_STORAGE_KEY = 'velvet-discover-view-v1';

  function preferredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  function applyTheme(theme) {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    document.documentElement.style.colorScheme = value;
    return value;
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Le thème reste appliqué pour la session si le stockage local est bloqué.
    }
  }

  applyTheme(preferredTheme());
  document.body.classList.add('admission-locked');
  const state = {
    account: null,
    access: null,
    billingCatalog: null,
    profile: null,
    directory: {
      profiles: [],
      establishments: [],
      venueDirectory: [],
      venueRelationships: [],
      events: [],
      conversations: [],
      recommendations: []
    },
    engagement: {
      views: [],
      reactions: [],
      streaks: [],
      currentUserId: null,
      currentProfileId: null
    },
    photoReactions: [],
    organizerRequest: null,
    membership: null,
    personalProfileComplete: false,
    photos: [],
    settings: null,
    verification: null,
    socialActions: {},
    notifications: [],
    unreadCount: 0,
    mapData: null,
    locationData: null,
    presence: {},
    presenceAvailable: false,
    savedSearches: [],
    savedSearchPersistenceAvailable: false,
    following: [],
    plans: { venueVisits: [], travelPlans: [], eventPlans: [] },
    lifecycle: { profile: null, action: null },
    selectedSavedSearchId: '',
    discoverView: (() => {
      try {
        return localStorage.getItem(DISCOVER_VIEW_STORAGE_KEY) === 'horizontal' ? 'horizontal' : 'grid';
      } catch {
        return 'grid';
      }
    })(),
    discoverFilters: {
      query: '',
      types: [],
      seeking: [],
      city: '',
      nearMe: false,
      maleAgeMin: 18,
      maleAgeMax: 99,
      femaleAgeMin: 18,
      femaleAgeMax: 99,
      practices: [],
      morphologies: [],
      onlineOnly: false,
      withPhotos: false,
      withRecommendation: false,
      createdToday: false
    },
    eventNearbyOnly: false,
    theme: preferredTheme(),
    homeVenueKind: '',
    homeVenueRadius: '20',
    mapZoom: 10,
    mapCenter: null,
    mapLayers: {
      members: true,
      club: true,
      spa: true,
      bar: true,
      love_room: true,
      hotel: true,
      other: true
    },
    route: 'home',
    selectedProfileId: null,
    profileTab: 'couple',
    carouselIndexes: {},
    editing: false,
    installPrompt: null,
    serviceWorker: null
    ,
    venueQuery: '',
    venueKind: '',
    venueCountry: '',
    venueRegion: '',
    venueLocationQuery: '',
    venueCenter: null,
    venueRadius: 50
  };

  const VENUE_REGIONS = {
    FR: [
      'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne',
      'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France',
      'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie',
      'Pays de la Loire', 'Provence-Alpes-Côte d’Azur'
    ],
    BE: ['Bruxelles-Capitale', 'Flandre', 'Wallonie']
  };
  const VENUE_REGION_CENTERS = [
    ['FR', 'Auvergne-Rhône-Alpes', 45.764, 4.836],
    ['FR', 'Bourgogne-Franche-Comté', 47.322, 5.041],
    ['FR', 'Bretagne', 48.117, -1.677],
    ['FR', 'Centre-Val de Loire', 47.903, 1.909],
    ['FR', 'Corse', 41.919, 8.738],
    ['FR', 'Grand Est', 48.573, 7.752],
    ['FR', 'Hauts-de-France', 50.629, 3.057],
    ['FR', 'Île-de-France', 48.857, 2.352],
    ['FR', 'Normandie', 49.443, 1.100],
    ['FR', 'Nouvelle-Aquitaine', 44.837, -0.579],
    ['FR', 'Occitanie', 43.604, 1.444],
    ['FR', 'Pays de la Loire', 47.218, -1.553],
    ['FR', 'Provence-Alpes-Côte d’Azur', 43.297, 5.370]
  ];

  const content = document.querySelector('#content');
  const toastNode = document.querySelector('#toast');
  const navButtons = [...document.querySelectorAll('[data-route]')];
  let mapResizeObserver = null;

  const errorMessages = {
    authentication_required: 'Ta session a expiré. Reconnecte-toi.',
    member_access_required: 'Ce compte ne possède pas l’accès Membre.',
    incomplete_people: 'Complète chaque personne composant le profil.',
    first_names_required: 'Le prénom de chaque personne est obligatoire.',
    profile_identity_required: 'Ajoute un nom de profil et une description d’au moins 20 caractères.',
    profile_payload_too_large: 'Le contenu du profil est trop volumineux.',
    gender_identity_required: 'Indique ton identité de genre pour compléter ta fiche personnelle.',
    profile_required: 'Crée d’abord ton profil Velvet.',
    organizer_request_already_pending: 'Une demande Organisateur est déjà en cours.',
    album_name_required: 'Donne un nom à cet album.',
    photo_and_album_required: 'Choisis une photo et un album.',
    album_owner_required: 'Seuls les propriétaires du profil peuvent gérer cet album.',
    invalid_album_access_duration: 'Choisis une durée d’accès proposée.',
    target_profile_required: 'Choisis le membre qui recevra l’accès.',
    message_required: 'Écris un message avant de l’envoyer.',
    photo_admission_required: 'Les photos publiques doivent être validées avant cette action.',
    invalid_photo_file: 'Choisis une photo JPG, PNG ou WebP de moins de 4 Mo.',
    invalid_album_media_file: 'Choisis une photo de moins de 4 Mo ou une vidéo MP4, WebM ou MOV de moins de 50 Mo.',
    personal_photo_owner_required: 'Chaque personne doit publier elle-même son portrait.',
    photo_access_denied: 'Cette photo n’est plus accessible.',
    cannot_react_to_own_photo: 'Tu peux consulter les réactions reçues, mais pas réagir à ta propre photo.',
    photo_reaction_persistence_failed: 'La réaction n’a pas pu être confirmée dans la mémoire Velvet.',
    profile_contact_not_allowed: 'Ce profil n’accepte pas les messages de ta catégorie de profil.',
    profile_contact_blocked: 'Cette conversation ne peut pas être ouverte.',
    report_category_required: 'Choisis la raison du signalement.',
    event_registration_closed: 'Les inscriptions à cette sortie sont closes.',
    event_unavailable: 'Cette sortie n’est plus disponible.',
    saved_search_name_required: 'Donne un nom à cette recherche.',
    saved_search_write_failed: 'La recherche n’a pas pu être enregistrée dans Velvet.'
    ,
    lifecycle_email_not_configured: 'L’envoi d’e-mails de confirmation n’est pas configuré.',
    lifecycle_action_already_pending: 'Une action sensible attend déjà des confirmations.',
    lifecycle_email_failed: 'L’e-mail de confirmation n’a pas pu être envoyé.',
    ai_source_too_short: 'Ajoute au moins trois mots-clés précis avant de solliciter Velvet IA.',
    profile_ai_unavailable: 'Velvet IA est momentanément indisponible.',
    profile_ai_generation_failed: 'Velvet IA n’a pas pu composer ce texte. Enrichis légèrement ton brouillon puis réessaie.',
    signature_required_saved_search: 'Les recherches sauvegardées font partie de Velvet Signature.',
    signature_conversation_limit: 'Tes 3 nouvelles conversations de la semaine sont utilisées. Les échanges déjà ouverts restent illimités.',
    signature_follow_limit: 'Velvet Découverte permet de suivre 10 profils. Passe à Signature pour suivre sans limite.',
    signature_profile_ai_limit: 'Ton quota Velvet IA est utilisé pour cette période.',
    promotion_invalid: 'Ce code promotionnel est inconnu ou incorrect.',
    promotion_expired: 'Ce code promotionnel a expiré.',
    promotion_limit_reached: 'Toutes les activations prévues pour ce code ont été utilisées.',
    promotion_already_used: 'Ce code a déjà été utilisé par ce profil.',
    promotion_audience_mismatch: 'Ce code n’est pas destiné à ce type de profil.',
    billing_provider_not_configured: 'Le paiement sera ouvert après validation définitive de notre partenaire bancaire.',
    identity_age_verification_required: 'La vérification de l’identité et de la majorité est obligatoire avant d’accéder à Velvet.',
    verification_provider_not_configured: 'Le prestataire de vérification n’est pas encore raccordé sur cet environnement.',
    data_export_failed: 'Ton export n’a pas pu être préparé. Réessaie ou contacte l’équipe Velvet.'
  };

  const REFERENCES = {
    genderIdentities: [
      'Homme',
      'Femme',
      'Homme trans',
      'Femme trans',
      'Personne non binaire',
      'Autre identité',
      'Information privée'
    ],
    availability: [
      'En semaine — journée',
      'En semaine — soirée',
      'Vendredi soir',
      'Samedi — journée',
      'Samedi soir',
      'Dimanche',
      'Week-end complet',
      'Pendant les vacances',
      'Variable selon les semaines',
      'Uniquement sur rendez-vous'
    ],
    practices: [
      'Rencontres en couple',
      'Côte-à-côtisme',
      'Mélangisme',
      'Échangisme',
      'Triolisme',
      'Sensualité et massages',
      'Voyeurisme',
      'Exhibitionnisme',
      'Jeux de rôle',
      'BDSM soft',
      'BDSM',
      'Soirées privées',
      'Clubs et spas',
      'À découvrir ensemble',
      'À discuter selon le feeling'
    ],
    values: [
      'Consentement',
      'Respect',
      'Communication',
      'Discrétion',
      'Bienveillance',
      'Hygiène',
      'Élégance',
      'Complicité',
      'Humour',
      'Sensualité',
      'Aucune pression',
      'Feeling indispensable',
      'Rencontres suivies'
    ],
    morphologies: [
      'Mince',
      'Svelte',
      'Athlétique',
      'Sportive',
      'Standard',
      'Musclée',
      'Pulpeuse / Curvy',
      'Ronde',
      'Généreuse',
      'Forte',
      'Information privée'
    ],
    hairColors: [
      'Noirs',
      'Bruns',
      'Châtains',
      'Blonds',
      'Roux',
      'Gris / Poivre et sel',
      'Blancs',
      'Colorés',
      'Rasés / Chauve',
      'Information privée'
    ],
    eyeColors: [
      'Marron',
      'Noisette',
      'Verts',
      'Bleus',
      'Gris',
      'Noirs',
      'Vairons',
      'Information privée'
    ],
    orientations: [
      'Hétérosexuel(le)',
      'Bi-curieux / Bi-curieuse',
      'Bisexuel(le)',
      'Pansexuel(le)',
      'Homosexuel(le)',
      'Orientation fluide',
      'En questionnement',
      'Information privée'
    ],
    frequencies: [
      'En découverte',
      'Quelques fois par an',
      'Environ une fois par mois',
      'Deux à trois fois par mois',
      'Environ une fois par semaine',
      'Régulièrement, sans fréquence fixe',
      'En pause actuellement',
      'Information privée'
    ],
    attractions: [
      'Couples',
      'Femmes',
      'Hommes',
      'Personnes non binaires',
      'Femmes trans',
      'Hommes trans',
      'Uniquement avec mon/ma partenaire',
      'Selon le feeling',
      'Information privée'
    ]
  };
  REFERENCES.experiences = [
    'Avec une femme',
    'Avec un homme',
    'Avec un couple',
    'Avec une personne non binaire',
    'Avec une femme trans',
    'Avec un homme trans',
    'À trois',
    'À quatre ou plus',
    ...REFERENCES.practices
  ];

  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const api = async (path, options = {}) => {
    const isForm = options.body instanceof FormData;
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(isForm ? {} : { 'content-type': 'application/json' }),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'request_failed');
    return payload;
  };

  function aiWriterField(name, label, value = '', {
    maxLength = 4000,
    minLength = 0,
    required = false,
    long = false,
    wide = false,
    placeholder = '',
    dynamicLabel = false
  } = {}) {
    return `<div class="ai-writer-field${wide ? ' wide' : ''}">
      <label>${dynamicLabel ? `<span data-description-label>${e(label)}</span>` : e(label)}
        <textarea name="${e(name)}" data-ai-writer-source="${e(name)}"${long ? ' class="long"' : ''} maxlength="${maxLength}"${minLength ? ` minlength="${minLength}"` : ''}${required ? ' required' : ''}${placeholder ? ` placeholder="${e(placeholder)}"` : ''}>${e(value)}</textarea>
      </label>
      <div class="ai-writer-tools">
        <button type="button" class="ai-writer-button" data-ai-writer="${e(name)}" disabled>✦ Velvet IA</button>
        <small data-ai-writer-status>Ajoute au moins 3 mots-clés précis.</small>
      </div>
    </div>`;
  }

  function sufficientAiSource(value) {
    const words = String(value || '').toLocaleLowerCase('fr').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{1,}/gu) || [];
    return String(value || '').trim().length >= 18 && new Set(words).size >= 3;
  }

  function bindAiWriters(scope = document) {
    scope.querySelectorAll('[data-ai-writer]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = 'true';
      const field = button.closest('.ai-writer-field');
      const textarea = field?.querySelector('[data-ai-writer-source]');
      const status = field?.querySelector('[data-ai-writer-status]');
      const form = button.closest('form');
      if (!textarea || !status || !form) return;
      const refresh = () => {
        const ready = sufficientAiSource(textarea.value);
        button.disabled = !ready || button.dataset.loading === 'true';
        if (button.dataset.loading !== 'true') {
          status.textContent = ready
            ? 'Velvet peut maintenant sublimer ce texte.'
            : 'Ajoute au moins 3 mots-clés précis.';
        }
      };
      textarea.addEventListener('input', refresh);
      button.addEventListener('click', async () => {
        if (!sufficientAiSource(textarea.value)) return;
        const values = new FormData(form);
        button.dataset.loading = 'true';
        button.disabled = true;
        button.textContent = '✦ Composition…';
        status.textContent = 'Velvet compose une proposition fidèle à tes mots…';
        try {
          const result = await api('/api/members/profile-copy', {
            method: 'POST',
            body: JSON.stringify({
              purpose: button.dataset.aiWriter.endsWith('_biography') ? 'biography' : button.dataset.aiWriter,
              source: textarea.value,
              profileType: values.get('profile_type') || state.profile?.profile_type || 'individual',
              relationshipSince: values.get('relationship_since') || state.profile?.relationship_since || '',
              practices: values.getAll('practices'),
              values: values.getAll('values_list'),
              orientation: values.get('p0_orientation') || '',
              frequency: values.get('p0_frequency') || ''
            })
          });
          textarea.value = result.text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          status.textContent = 'Proposition générée — tu gardes la main avant l’enregistrement.';
          toast('Velvet IA a préparé une proposition. Relis-la et adapte-la librement.');
        } catch (error) {
          status.textContent = errorMessages[error.message] || error.message;
          toast(error.message, true);
        } finally {
          button.dataset.loading = 'false';
          button.textContent = '✦ Velvet IA';
          refresh();
        }
      });
      refresh();
    });
  }

  function toast(message, isError = false) {
    toastNode.textContent = errorMessages[message] || message;
    toastNode.style.borderColor = isError ? 'rgba(255,142,167,.45)' : '';
    toastNode.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => toastNode.classList.remove('show'), 3200);
  }

  async function initializeWebExperience() {
    if ('serviceWorker' in navigator) {
      state.serviceWorker = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
    }
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      state.installPrompt = event;
      document.querySelector('[data-install-velvet]')?.removeAttribute('hidden');
    });
    window.addEventListener('appinstalled', () => {
      state.installPrompt = null;
      toast('Velvet est installé sur cet appareil.');
    });
  }

  async function showBrowserNotification(title, body, url = '/membres/') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const registration = state.serviceWorker || await navigator.serviceWorker?.ready?.catch(() => null);
    if (!registration) return false;
    await registration.showNotification(title, {
      body,
      icon: '/assets/velvet-icon-192.png',
      badge: '/assets/velvet-icon-192.png',
      tag: 'velvet-settings-test',
      data: { url }
    });
    return true;
  }

  function list(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function splitList(value) {
    return [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))];
  }

  function initials(name) {
    return String(name || 'V').split(/\s|&/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function age(birthYear) {
    return birthYear ? `${new Date().getFullYear() - Number(birthYear)} ans` : 'Non renseigné';
  }

  function childrenLabel(value) {
    return ({ yes: 'Oui', no: 'Non', private: 'Information privée' })[value] || 'Non renseigné';
  }

  function profileVoice(profile) {
    if (profile?.profile_type === 'couple') {
      return {
        profileLabel: 'Profil couple',
        betaLabel: 'Couple BETA réel',
        aboutTitle: 'Qui sommes-nous ?',
        storyTitle: 'Notre histoire',
        journeyTitle: 'Notre parcours',
        searchTitle: 'Ce que nous recherchons',
        practicesEyebrow: 'Nos pratiques',
        practicesTitle: 'Ce que nous aimons vivre',
        recommendationsEyebrow: 'Ils parlent de nous',
        peopleEyebrow: 'Les personnes',
        locationCopy: 'Seule la zone choisie par le couple est affichée.',
        descriptionFallback: 'Description à compléter.',
        storyFallback: 'Histoire à compléter.',
        journeyFallback: 'Parcours à compléter.',
        searchFallback: 'Recherche à compléter.'
      };
    }

    const gender = String(profilePeople(profile)[0]?.gender_identity || '').trim().toLowerCase();
    const feminine = gender === 'femme' || gender === 'femme trans';
    const masculine = gender === 'homme' || gender === 'homme trans';
    const profileLabel = gender === 'femme'
      ? 'Profil femme'
      : gender === 'homme'
        ? 'Profil homme'
        : gender === 'femme trans'
          ? 'Profil femme trans'
          : gender === 'homme trans'
            ? 'Profil homme trans'
            : gender === 'personne non binaire'
              ? 'Profil non binaire'
              : 'Profil individuel';

    return {
      profileLabel,
      betaLabel: feminine ? 'Membre BETA réelle' : masculine ? 'Membre BETA réel' : 'Profil BETA réel',
      aboutTitle: 'Qui suis-je ?',
      storyTitle: 'Mon histoire',
      journeyTitle: 'Mon parcours',
      searchTitle: 'Ce que je recherche',
      practicesEyebrow: 'Mes pratiques',
      practicesTitle: 'Ce que j’aime vivre',
      recommendationsEyebrow: feminine
        ? 'Ils parlent d’elle'
        : masculine
          ? 'Ils parlent de lui'
          : 'Les membres parlent de cette personne',
      peopleEyebrow: feminine
        ? 'Sa fiche personnelle · Elle'
        : masculine
          ? 'Sa fiche personnelle · Lui'
          : 'Sa fiche personnelle',
      locationCopy: feminine
        ? 'Seule la zone choisie par elle est affichée.'
        : masculine
          ? 'Seule la zone choisie par lui est affichée.'
          : 'Seule la zone choisie par cette personne est affichée.',
      descriptionFallback: 'Ma présentation reste à compléter.',
      storyFallback: 'Mon histoire reste à compléter.',
      journeyFallback: 'Mon parcours reste à compléter.',
      searchFallback: 'Ma recherche reste à compléter.'
    };
  }

  function confidentialityLabel(value) {
    return ({
      public: 'Album public',
      request: 'Privé sur demande',
      trusted_circle: 'Cercle de confiance',
      private_circle: 'Cercle privé',
      favorites: 'Favoris uniquement',
      temporary: 'Accès temporaire'
    })[value] || value;
  }

  function approvedProfilePhotos(profile) {
    const expectedRole = profile?.profile_type === 'couple' ? 'couple_gallery' : 'individual_gallery';
    return list(profile?.media_assets).filter(
      (photo) => photo.media_role === expectedRole
        && photo.moderation_status === 'approved'
        && photo.previewUrl
    );
  }

  function photoReactionSummary(mediaId) {
    return list(state.photoReactions).find((row) => row.media_id === mediaId) || {
      media_id: mediaId,
      like_count: 0,
      love_count: 0,
      adore_count: 0,
      total_count: 0,
      my_reaction: null
    };
  }

  const PHOTO_REACTIONS = [
    ['like', '👍', 'J’aime', 'like_count'],
    ['love', '❤️', 'J’adore', 'love_count'],
    ['adore', '🔥', 'Canon', 'adore_count']
  ];

  function photoReactionBar(photo, ownProfile = false) {
    if (!photo?.id) return '';
    const summary = photoReactionSummary(photo.id);
    return `<div class="photo-reaction-bar ${ownProfile ? 'read-only' : ''}" data-photo-reaction-bar="${e(photo.id)}">
      ${PHOTO_REACTIONS.map(([value, icon, label, countKey]) => ownProfile
        ? `<span title="${e(label)}"><b>${icon}</b><small>${e(summary[countKey] || 0)}</small></span>`
        : `<button type="button" class="${summary.my_reaction === value ? 'active' : ''}" data-photo-reaction="${e(value)}" data-photo-id="${e(photo.id)}" aria-label="${e(label)}">
            <b>${icon}</b><small>${e(summary[countKey] || 0)}</small>
          </button>`
      ).join('')}
      <em>${e(summary.total_count || 0)} réaction${summary.total_count === 1 ? '' : 's'}</em>
    </div>`;
  }

  function albumPhotoFigure(photo, albumKey, index, alt, ownProfile) {
    if (photo.media_type === 'video') {
      return `<figure class="album-photo album-video">
        <video controls playsinline preload="metadata" src="${e(photo.previewUrl)}" aria-label="${e(alt)}"></video>
        ${photoReactionBar(photo, ownProfile)}
      </figure>`;
    }
    return `<figure class="album-photo">
      <button class="album-photo-button" type="button" data-album-lightbox="${e(albumKey)}" data-lightbox-index="${index}" aria-label="Agrandir ${e(alt)}">
        <img src="${e(photo.previewUrl)}" alt="${e(alt)}">
        <span class="album-photo-zoom" aria-hidden="true">⌕</span>
      </button>
      ${photoReactionBar(photo, ownProfile)}
    </figure>`;
  }

  function openAlbumLightbox(albumKey, requestedIndex = 0) {
    const triggers = [...document.querySelectorAll('[data-album-lightbox]')]
      .filter((button) => button.dataset.albumLightbox === albumKey);
    const photos = triggers.map((button) => {
      const image = button.querySelector('img');
      return { src: image?.src || '', alt: image?.alt || 'Photo Velvet' };
    }).filter((photo) => photo.src);
    if (!photos.length) return;

    let index = Math.max(0, Math.min(Number(requestedIndex) || 0, photos.length - 1));
    const returnFocus = triggers[index];
    const lightbox = document.createElement('section');
    lightbox.className = 'album-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Visionneuse de l’album');
    lightbox.innerHTML = `
      <button class="lightbox-close" type="button" data-lightbox-close aria-label="Fermer la photo">×</button>
      <div class="lightbox-stage" data-lightbox-stage>
        <figure><img data-lightbox-image alt=""></figure>
      </div>
      ${photos.length > 1 ? `
        <button class="lightbox-arrow previous" type="button" data-lightbox-previous aria-label="Photo précédente">‹</button>
        <button class="lightbox-arrow next" type="button" data-lightbox-next aria-label="Photo suivante">›</button>` : ''}
      <div class="lightbox-footer">
        <p data-lightbox-caption></p>
        <span><b data-lightbox-current></b> / ${photos.length}</span>
      </div>`;

    const render = () => {
      const photo = photos[index];
      const image = lightbox.querySelector('[data-lightbox-image]');
      image.src = photo.src;
      image.alt = photo.alt;
      lightbox.querySelector('[data-lightbox-caption]').textContent = photo.alt;
      lightbox.querySelector('[data-lightbox-current]').textContent = String(index + 1);
    };
    const move = (direction) => {
      index = (index + direction + photos.length) % photos.length;
      render();
    };
    const close = () => {
      document.removeEventListener('keydown', onKeydown);
      document.body.classList.remove('lightbox-open');
      lightbox.remove();
      returnFocus?.focus();
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft' && photos.length > 1) move(-1);
      if (event.key === 'ArrowRight' && photos.length > 1) move(1);
    };

    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox || event.target.closest('[data-lightbox-close]')) close();
      if (event.target.closest('[data-lightbox-previous]')) move(-1);
      if (event.target.closest('[data-lightbox-next]')) move(1);
    });

    let touchStartX = null;
    const stage = lightbox.querySelector('[data-lightbox-stage]');
    stage.addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });
    stage.addEventListener('touchend', (event) => {
      if (touchStartX === null || photos.length < 2) return;
      const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
      touchStartX = null;
    }, { passive: true });

    document.body.append(lightbox);
    document.body.classList.add('lightbox-open');
    document.addEventListener('keydown', onKeydown);
    render();
    lightbox.querySelector('[data-lightbox-close]').focus();
  }

  function profileCarousel(profile) {
    const photos = approvedProfilePhotos(profile);
    if (!photos.length) return '';
    const ownProfile = profile.id === state.profile?.id;
    const initialIndex = Math.min(Number(state.carouselIndexes[profile.id]) || 0, photos.length - 1);
    return `<div class="profile-carousel-shell" data-profile-carousel data-profile-id="${e(profile.id)}" data-carousel-index="${initialIndex}">
      <div class="profile-carousel" data-carousel-track aria-label="Photos publiques de ${e(profile.display_name)}">
        ${photos.map((photo, index) => `<figure data-carousel-slide="${index}"><img src="${e(photo.previewUrl)}" alt="Photo publique ${index + 1} de ${e(profile.display_name)}">${photoReactionBar(photo, ownProfile)}</figure>`).join('')}
      </div>
      ${photos.length > 1 ? `
        <button class="carousel-arrow previous" type="button" data-carousel-previous aria-label="Photo précédente">‹</button>
        <button class="carousel-arrow next" type="button" data-carousel-next aria-label="Photo suivante">›</button>
        <div class="carousel-status" aria-label="${photos.length} photos">
          <span><b data-carousel-current>${initialIndex + 1}</b> / ${photos.length}</span>
          <div>${photos.map((photo, index) => `<button type="button" data-carousel-to="${index}" class="${index === initialIndex ? 'active' : ''}" aria-label="Afficher la photo ${index + 1}" aria-current="${index === initialIndex ? 'true' : 'false'}"></button>`).join('')}</div>
        </div>` : ''}
    </div>`;
  }

  function chips(items, emptyText = 'Non renseigné') {
    const values = list(items);
    return values.length
      ? `<div class="chips">${values.map((item) => `<span class="chip">${e(item)}</span>`).join('')}</div>`
      : `<p class="muted">${e(emptyText)}</p>`;
  }

  function emptyState(title, text, mark = 'V', action = '') {
    return `<section class="empty"><div class="empty-inner">
      <div class="empty-mark">${e(mark)}</div>
      <h2>${e(title)}</h2>
      <p>${e(text)}</p>
      ${action}
    </div></section>`;
  }

  function pageHead(kicker, title, text, action = '') {
    return `<header class="page-head"><div>
      <p class="eyebrow">${e(kicker)}</p><h1>${e(title)}</h1>${text ? `<p>${e(text)}</p>` : ''}
    </div>${action}</header>`;
  }

  function localSavedSearches() {
    try {
      const rows = JSON.parse(localStorage.getItem(SAVED_SEARCH_STORAGE_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function saveLocalSearches(rows) {
    try {
      localStorage.setItem(SAVED_SEARCH_STORAGE_KEY, JSON.stringify(list(rows).slice(0, 50)));
    } catch {
      // Le filtre reste actif même si le navigateur refuse le stockage local.
    }
  }

  function applyDiscoveryState(result = {}) {
    state.presence = Object.fromEntries(list(result.presence).map((row) => [
      row.profile_id,
      row.presence_status
    ]));
    state.presenceAvailable = result.presenceAvailable === true;
    state.savedSearchPersistenceAvailable = result.persistenceAvailable === true;
    state.savedSearches = state.savedSearchPersistenceAvailable
      ? list(result.savedSearches)
      : localSavedSearches();
    state.following = list(result.following);
    if (result.access) state.access = result.access;
  }

  async function loadAll() {
    try {
      const [profileResult, verificationResult] = await Promise.all([
        api('/api/members/profile'),
        api('/api/members/verification')
      ]);
      state.profile = profileResult.profile;
      state.account = profileResult.account;
      state.access = profileResult.access || state.access;
      state.membership = profileResult.membership;
      state.personalProfileComplete = profileResult.personalProfileComplete;
      state.verification = verificationResult;
      if (verificationResult.accessBlockedByVerification) {
        lockApplication();
        renderVerificationGate(verificationResult);
        return;
      }
      if (!state.profile || !state.personalProfileComplete) {
        lockApplication();
        renderOnboarding(state.profile);
        return;
      }
      if (state.profile.admission_status !== 'approved') {
        lockApplication();
        await loadPhotos();
        renderAdmission();
        return;
      }
      unlockApplication();
      const [directoryResult, organizerResult, engagementResult, photoReactionResult, notificationResult, locationResult, mapResult, discoveryResult, plansResult, lifecycleResult] = await Promise.all([
        api('/api/members/directory'),
        api('/api/members/organizer-request').catch(() => ({ request: null })),
        api('/api/members/engagement'),
        api('/api/members/photo-reactions'),
        api('/api/members/notifications'),
        api('/api/members/location').catch(() => ({ location: { enabled: false }, nearbyVenues: [] })),
        api('/api/members/map').catch(() => ({ center: null, members: [], venues: [], events: [] })),
        api('/api/members/discovery').catch(() => ({
          presence: [],
          savedSearches: localSavedSearches(),
          persistenceAvailable: false,
          presenceAvailable: false
        })),
        api('/api/members/plans').catch(() => ({ venueVisits: [], travelPlans: [], eventPlans: [], migrationPending: true })),
        api('/api/members/account-actions').catch(() => ({ profile: null, action: null }))
      ]);
      state.directory = directoryResult;
      state.organizerRequest = organizerResult.request;
      state.engagement = engagementResult;
      state.photoReactions = photoReactionResult.reactions || [];
      state.notifications = notificationResult.notifications || [];
      state.unreadCount = Number(notificationResult.unreadCount || 0);
      state.locationData = locationResult;
      state.mapData = mapResult;
      applyDiscoveryState(discoveryResult);
      state.plans = plansResult;
      state.lifecycle = lifecycleResult;
      updateNotificationBadges();
      route('home');
    } catch (error) {
      if (error.message === 'authentication_required') {
        window.location.href = '/?reason=session';
        return;
      }
      content.innerHTML = `<div class="page">${emptyState(
        'Connexion impossible',
        `La mémoire Velvet n’a pas pu être chargée : ${errorMessages[error.message] || error.message}`,
        '!'
      )}</div>`;
    }
  }

  async function refreshData() {
    const [profileResult, verificationResult] = await Promise.all([
      api('/api/members/profile'),
      api('/api/members/verification')
    ]);
    state.profile = profileResult.profile;
    state.account = profileResult.account;
    state.access = profileResult.access || state.access;
    state.membership = profileResult.membership;
    state.personalProfileComplete = profileResult.personalProfileComplete;
    state.verification = verificationResult;
    if (verificationResult.accessBlockedByVerification) {
      lockApplication();
      renderVerificationGate(verificationResult);
      return;
    }
    if (state.profile?.admission_status !== 'approved') {
      state.directory = { profiles: [], establishments: [], venueDirectory: [], venueRelationships: [], events: [], conversations: [], recommendations: [] };
      state.engagement = { views: [], reactions: [], streaks: [], currentUserId: null, currentProfileId: null };
      state.photoReactions = [];
      state.organizerRequest = null;
      state.notifications = [];
      state.unreadCount = 0;
      state.mapData = null;
      state.locationData = null;
      await loadPhotos();
      return;
    }
    const [directoryResult, organizerResult, engagementResult, photoReactionResult, notificationResult, locationResult, mapResult, discoveryResult, plansResult, lifecycleResult] = await Promise.all([
      api('/api/members/directory'),
      api('/api/members/organizer-request').catch(() => ({ request: null })),
      api('/api/members/engagement'),
      api('/api/members/photo-reactions'),
      api('/api/members/notifications'),
      api('/api/members/location').catch(() => ({ location: { enabled: false }, nearbyVenues: [] })),
      api('/api/members/map').catch(() => ({ center: null, members: [], venues: [], events: [] })),
      api('/api/members/discovery').catch(() => ({
        presence: [],
        savedSearches: localSavedSearches(),
        persistenceAvailable: false,
        presenceAvailable: false
      })),
      api('/api/members/plans').catch(() => ({ venueVisits: [], travelPlans: [], eventPlans: [], migrationPending: true })),
      api('/api/members/account-actions').catch(() => ({ profile: null, action: null }))
    ]);
    state.directory = directoryResult;
    state.organizerRequest = organizerResult.request;
    state.engagement = engagementResult;
    state.photoReactions = photoReactionResult.reactions || [];
    state.notifications = notificationResult.notifications || [];
    state.unreadCount = Number(notificationResult.unreadCount || 0);
    state.locationData = locationResult;
    state.mapData = mapResult;
    applyDiscoveryState(discoveryResult);
    state.plans = plansResult;
    state.lifecycle = lifecycleResult;
    updateNotificationBadges();
  }

  function updateNotificationBadges() {
    document.querySelectorAll('[data-route="notifications"]').forEach((button) => {
      let badge = button.querySelector('.nav-notification-count');
      if (!state.unreadCount) {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('b');
        badge.className = 'nav-notification-count';
        button.append(badge);
      }
      badge.textContent = state.unreadCount > 99 ? '99+' : String(state.unreadCount);
      badge.setAttribute('aria-label', `${state.unreadCount} notification${state.unreadCount > 1 ? 's' : ''} non lue${state.unreadCount > 1 ? 's' : ''}`);
    });
  }

  function lockApplication() {
    document.body.classList.add('admission-locked');
    window.VelvetWebV11?.closeMenu();
  }

  function unlockApplication() {
    document.body.classList.remove('admission-locked');
  }

  function renderVerificationGate(payload = {}) {
    lockApplication();
    const verification = payload.verification || {};
    const status = ({
      pending: 'Contrôle en cours',
      failed: 'Contrôle non abouti',
      expired: 'Vérification à renouveler',
      revoked: 'Vérification retirée'
    })[verification.status] || 'Vérification requise';
    content.innerHTML = `<div class="page admission-page verification-gate">
      <header class="admission-brand">
        <span class="brand-mark">V</span><span><strong>Velvet</strong><small>ACCÈS PROTÉGÉ</small></span>
        <button class="text-button" id="admissionLogout" type="button">Se déconnecter</button>
      </header>
      ${pageHead(
        'Identité · majorité · confidentialité',
        'Vérifions que Velvet reste un espace adulte.',
        'L’accès aux profils, messages, lieux et albums est fermé tant que l’identité et la majorité ne sont pas confirmées.'
      )}
      <section class="card admission-status">
        <div><p class="eyebrow">État actuel</p><h2>${e(status)}</h2><p>Velvet ne conserve ni pièce d’identité, ni identité civile, ni date de naissance. Seuls le résultat, sa date et sa durée de validité sont enregistrés.</p></div>
        <span class="pill">18+</span>
      </section>
      <section class="grid two">
        <article class="card section">
          <p class="eyebrow">Contrôle indépendant</p><h2>Identité et majorité</h2>
          <p>Le prestataire reçoit la pièce nécessaire et renvoie uniquement un résultat signé. Un profil couple exige la vérification personnelle de chacun des deux partenaires.</p>
          ${payload.providerConfigured
            ? '<button class="primary" type="button" data-start-velvet-verification>Commencer la vérification</button>'
            : '<p class="status-box">Le raccordement au prestataire reste volontairement fermé pendant la recette interne zéro dépense.</p>'}
        </article>
        <article class="card section">
          <p class="eyebrow">Tes droits restent accessibles</p><h2>Récupérer tes données</h2>
          <p>Tu peux télécharger tes informations Velvet même lorsque l’accès communautaire est verrouillé.</p>
          <button class="secondary" type="button" data-export-velvet>Préparer mon export JSON</button>
        </article>
      </section>
    </div>`;
    document.querySelector('#admissionLogout')?.addEventListener('click', logout);
  }

  async function loadPhotos() {
    const result = await api('/api/members/photos').catch(() => ({ photos: [] }));
    state.photos = list(result.photos);
  }

  function profilePeople(profile) {
    const order = { individual: 0, partner_a: 0, partner_b: 1 };
    return list(profile?.individual_profiles).sort((a, b) => (order[a.member_slot] ?? 9) - (order[b.member_slot] ?? 9));
  }

  function selectedFromText(value) {
    return String(value || '').split(/\s*(?:,|·)\s*/).map((item) => item.trim()).filter(Boolean);
  }

  function selectField(name, label, options, current = '', help = '') {
    return `<label>${e(label)}
      <select name="${e(name)}">
        <option value="">Choisir…</option>
        ${options.map((option) => `<option value="${e(option)}"${option === current ? ' selected' : ''}>${e(option)}</option>`).join('')}
      </select>
      ${help ? `<small class="field-help">${e(help)}</small>` : ''}
    </label>`;
  }

  function multiField(name, label, options, selected = [], help = '') {
    const values = new Set(list(selected));
    const count = options.filter((option) => values.has(option)).length;
    return `<fieldset class="field wide">
      <legend>${e(label)}</legend>
      <details class="multi-choice" data-multi-choice>
        <summary>${count ? `${count} choix sélectionné${count > 1 ? 's' : ''}` : 'Ouvrir la liste'}</summary>
        <div class="choice-menu">
          ${options.map((option) => `<label class="choice"><input type="checkbox" name="${e(name)}" value="${e(option)}"${values.has(option) ? ' checked' : ''}><span>${e(option)}</span></label>`).join('')}
        </div>
      </details>
      ${help ? `<small class="field-help">${e(help)}</small>` : ''}
    </fieldset>`;
  }

  function communeField(name, label, current = '', help = '') {
    return `<label class="commune-field">${e(label)}
      <span class="commune-input">
        <input name="${e(name)}" value="${e(current)}" autocomplete="off" data-commune-input placeholder="Saisir une commune ou un code postal">
        <span class="commune-results" data-commune-results role="listbox" hidden></span>
      </span>
      ${help ? `<small class="field-help">${e(help)}</small>` : ''}
    </label>`;
  }

  function venueField(selected = []) {
    return `<fieldset class="field wide venue-field" data-venue-field>
      <legend>Lieux fréquentés ou préférés</legend>
      <div class="selected-venues" data-selected-venues>
        ${list(selected).map((name) => `<span class="selected-venue"><span>${e(name)}</span><button type="button" data-remove-venue="${e(name)}" aria-label="Retirer ${e(name)}">×</button><input type="hidden" name="favorite_places" value="${e(name)}"></span>`).join('')}
      </div>
      <span class="commune-input">
        <input autocomplete="off" data-venue-input placeholder="Commence à saisir le nom d’un club ou d’un spa">
        <span class="commune-results venue-results" data-venue-results role="listbox" hidden></span>
      </span>
      <small class="field-help">Référentiel Velvet enrichi par les établissements vérifiés et OpenStreetMap. Les lieux restent soumis à vérification.</small>
    </fieldset>`;
  }

  function personForm(index, person = {}, couple = true) {
    const title = couple ? 'Ta fiche personnelle' : 'Votre fiche personnelle';
    return `<section class="person-form">
      <h3>${title}</h3>
      <div class="form-grid">
        <label>Prénom<input name="p${index}_first_name" maxlength="80" value="${e(person.first_name)}" required></label>
        <label>Identité de genre
          <select name="p${index}_gender_identity" required>
            <option value="">Choisir…</option>
            ${REFERENCES.genderIdentities.map((option) => `<option value="${e(option)}"${option === person.gender_identity ? ' selected' : ''}>${e(option)}</option>`).join('')}
          </select>
        </label>
        <label>Année de naissance<input name="p${index}_birth_year" type="number" min="1900" max="${new Date().getFullYear() - 18}" value="${e(person.birth_year)}"></label>
        <label>Taille en cm<input name="p${index}_height_cm" type="number" min="100" max="250" value="${e(person.height_cm)}"></label>
        <label>Poids en kg<input name="p${index}_weight_kg" type="number" min="30" max="350" value="${e(person.weight_kg)}"></label>
        ${selectField(`p${index}_morphology`, 'Morphologie', REFERENCES.morphologies, person.morphology)}
        ${selectField(`p${index}_hair_color`, 'Couleur des cheveux', REFERENCES.hairColors, person.hair_color)}
        ${selectField(`p${index}_eye_color`, 'Couleur des yeux', REFERENCES.eyeColors, person.eye_color)}
        <label>Enfants
          <select name="p${index}_children_status">
            <option value="private"${person.children_status === 'private' ? ' selected' : ''}>Information privée</option>
            <option value="yes"${person.children_status === 'yes' ? ' selected' : ''}>Oui</option>
            <option value="no"${person.children_status === 'no' ? ' selected' : ''}>Non</option>
          </select>
        </label>
        <label>Profession<input name="p${index}_profession" maxlength="120" value="${e(person.profession)}"></label>
        <label class="check"><input name="p${index}_profession_private" type="checkbox"${person.profession_private !== false ? ' checked' : ''}><span>Garder la profession privée</span></label>
        ${selectField(`p${index}_orientation`, 'Orientation', REFERENCES.orientations, person.orientation)}
        ${selectField(`p${index}_frequency`, 'Fréquence de pratique', REFERENCES.frequencies, person.frequency)}
        ${aiWriterField(`p${index}_biography`, 'Description personnelle', person.biography, { maxLength: 4000, long: true, wide: true })}
        ${multiField(`p${index}_attracted_to`, 'Attiré(e) par', REFERENCES.attractions, person.attracted_to, 'Plusieurs réponses sont possibles.')}
        ${multiField(`p${index}_desired_practices`, 'Ce que cette personne préfère vivre pour elle-même', REFERENCES.experiences, person.desired_practices, 'Ces choix appartiennent uniquement à cette personne.')}
        ${couple ? multiField(`p${index}_partner_permissions`, 'Ce que cette personne est à l’aise de laisser vivre à son/sa partenaire', REFERENCES.experiences, person.partner_permissions, 'Ce référentiel exprime un niveau de confort, jamais un consentement définitif.') : ''}
      </div>
    </section>`;
  }

  function profileForm(profile = null) {
    const people = profilePeople(profile);
    const ownPerson = people.find((person) => person.linked_user_id === state.account?.userId) || {};
    const type = profile?.profile_type || 'couple';
    const joiningPartner = Boolean(profile && !state.personalProfileComplete);
    return `<form id="profileForm" class="form-shell">
      <section class="onboarding">
        <p class="eyebrow">${joiningPartner ? 'Rattachement au couple' : profile ? 'Modifier notre univers' : 'Première connexion'}</p>
        <h1>${joiningPartner ? 'Complète ta partie du profil.' : profile ? 'Votre histoire évolue.' : 'Créons votre page Velvet.'}</h1>
        <p>${joiningPartner ? `Tu as rejoint ${e(profile.display_name)}. Les informations communes pourront être enrichies par vous deux, mais cette fiche personnelle restera uniquement modifiable depuis ton compte.` : 'Cette fiche est enregistrée dans Supabase et visible uniquement par les membres admis à la BETA. Aucun contenu fictif ne sera ajouté.'}</p>

        <section class="form-step">
          <h2>Votre identité Velvet</h2>
          <p>Commence par ce que les autres membres doivent comprendre au premier regard.</p>
          <div class="form-grid">
            <label>Type de profil
              ${profile ? `<input type="hidden" name="profile_type" value="${e(type)}">` : ''}
              <select ${profile ? 'disabled' : 'name="profile_type"'} id="profileType">
                <option value="couple"${type === 'couple' ? ' selected' : ''}>Couple</option>
                <option value="individual"${type === 'individual' ? ' selected' : ''}>Profil individuel</option>
              </select>
            </label>
            <label>Nom affiché<input name="display_name" maxlength="120" value="${e(profile?.display_name)}" required></label>
            ${communeField('city', 'Ville de résidence', profile?.city, 'Sélectionne une commune et son code postal dans le référentiel officiel.')}
            ${communeField('location_zone', 'Localisation rendue publique', profile?.location_zone, 'Cette zone sera visible des autres membres. Elle peut être différente de ta commune de résidence.')}
            <label>Ensemble depuis — année<input name="relationship_since" type="number" min="1900" max="${new Date().getFullYear()}" value="${e(profile?.relationship_since)}"></label>
            ${multiField('availability', 'Disponibilités habituelles', REFERENCES.availability, selectedFromText(profile?.availability_text), 'Plusieurs créneaux peuvent être sélectionnés.')}
            ${aiWriterField('description', 'Description principale', profile?.description, { maxLength: 4000, required: true, long: true, wide: true })}
            ${aiWriterField('story', 'Votre histoire', profile?.story, { maxLength: 8000, long: true, wide: true })}
            ${aiWriterField('journey', 'Votre parcours', profile?.journey, { maxLength: 4000, wide: true })}
            ${aiWriterField('search_text', 'Ce que vous recherchez', profile?.search_text, { maxLength: 4000, wide: true })}
            ${multiField('practices', 'Pratiques du couple', REFERENCES.practices, profile?.practices, 'Sélectionne uniquement les pratiques réellement partagées.')}
            ${multiField('values_list', 'Valeurs du couple', REFERENCES.values, profile?.values_list, 'Ces valeurs structurent les rencontres recherchées.')}
            ${venueField(profile?.favorite_places)}
          </div>
        </section>
        <section class="form-step">
          <h2>${joiningPartner ? 'Ta fiche personnelle' : 'Ta partie personnelle'}</h2>
          <p>${type === 'couple' ? 'Tu complètes uniquement ta propre fiche. Ton ou ta partenaire remplira la sienne depuis son propre compte.' : 'Cette fiche personnelle reste rattachée uniquement à ton compte.'}</p>
          <div id="peopleForms">
            ${personForm(0, ownPerson, type === 'couple')}
          </div>
        </section>
        <div class="actions">
          <button class="primary" type="submit">${profile ? 'Enregistrer les modifications' : 'Publier mon profil BETA'}</button>
          ${profile ? '<button class="secondary" type="button" data-cancel-edit>Annuler</button>' : ''}
        </div>
        <p id="profileFormStatus" class="status-box" hidden></p>
      </section>
    </form>`;
  }

  function hiddenValues(name, values) {
    return list(values).map((value) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`).join('');
  }

  function discoveryStep(number, kicker, title, text, body, attributes = '') {
    return `<section class="discovery-step" data-discovery-step="${number}" ${attributes}${number ? ' hidden' : ''}>
      <div class="velvet-guide">
        <span class="guide-avatar">V</span>
        <p><strong>Velvet</strong><span>${e(text)}</span></p>
      </div>
      <p class="eyebrow">${e(kicker)}</p>
      <h1>${e(title)}</h1>
      <div class="discovery-question">${body}</div>
    </section>`;
  }

  function discoveryChoice(name, value, label, text, selected = false) {
    return `<label class="discovery-choice">
      <input type="radio" name="${e(name)}" value="${e(value)}"${selected ? ' checked' : ''} required>
      <span><strong>${e(label)}</strong><small>${e(text)}</small></span>
    </label>`;
  }

  function discoveryProfileForm(profile = null) {
    const people = profilePeople(profile);
    const ownPerson = people.find((person) => person.linked_user_id === state.account?.userId) || {};
    const joiningPartner = Boolean(profile && !state.personalProfileComplete);
    const currentType = profile?.profile_type || '';
    const commonHidden = joiningPartner ? `
      <input type="hidden" name="display_name" value="${e(profile.display_name)}">
      <input type="hidden" name="city" value="${e(profile.city)}">
      <input type="hidden" name="location_zone" value="${e(profile.location_zone)}">
      <input type="hidden" name="relationship_since" value="${e(profile.relationship_since)}">
      <input type="hidden" name="description" value="${e(profile.description)}">
      <input type="hidden" name="story" value="${e(profile.story)}">
      <input type="hidden" name="journey" value="${e(profile.journey)}">
      <input type="hidden" name="search_text" value="${e(profile.search_text)}">
      ${hiddenValues('availability', selectedFromText(profile.availability_text))}
      ${hiddenValues('practices', profile.practices)}
      ${hiddenValues('values_list', profile.values_list)}
      ${hiddenValues('favorite_places', profile.favorite_places)}
    ` : '';
    const steps = joiningPartner ? [
      discoveryStep(0, `Invitation de ${profile.display_name}`, 'Commençons par toi.', 'La page commune est déjà créée. Je vais maintenant t’aider à construire ta fiche personnelle, celle que toi seul(e) pourras modifier.', `
        <input type="hidden" name="profile_type" value="${e(currentType)}">
        ${commonHidden}
        <label>Ton prénom ou ton pseudonyme
          <input name="p0_first_name" maxlength="80" value="${e(ownPerson.first_name)}" autocomplete="given-name" required autofocus>
        </label>
      `),
      discoveryStep(1, 'Ton identité', 'Comment souhaites-tu être présenté(e) ?', 'Choisis simplement l’identité qui te correspond. Elle permettra aussi à Velvet de respecter les préférences de visibilité de chacun.', `
        <label>Identité de genre
          <select name="p0_gender_identity" required>
            <option value="">Choisir…</option>
            ${REFERENCES.genderIdentities.map((option) => `<option value="${e(option)}"${option === ownPerson.gender_identity ? ' selected' : ''}>${e(option)}</option>`).join('')}
          </select>
        </label>
      `)
    ] : [
      discoveryStep(0, 'Bienvenue dans Velvet', 'Pour qui allons-nous créer ce profil ?', 'Commençons simplement. Dis-moi si cette page doit raconter ton univers personnel ou celui de votre couple.', `
        <div class="discovery-choices">
          ${discoveryChoice('profile_type', 'individual', 'Ce profil est pour moi', 'Une page personnelle centrée sur mon univers.', currentType === 'individual')}
          ${discoveryChoice('profile_type', 'couple', 'Ce profil est pour notre couple', 'Une page commune complétée par nos deux fiches.', currentType === 'couple')}
        </div>
      `),
      discoveryStep(1, 'Votre identité Velvet', 'Quel nom apparaîtra sur votre profil ?', 'Choisis le prénom, le pseudonyme ou le nom de couple avec lequel les autres membres devront vous reconnaître.', `
        <label><span data-name-label>Nom affiché</span>
          <input name="display_name" maxlength="120" value="${e(profile?.display_name)}" autocomplete="nickname" required autofocus>
        </label>
      `),
      discoveryStep(2, 'Votre histoire', 'Depuis quelle année partagez-vous votre vie ?', 'Cette date donnera immédiatement un peu de profondeur à votre page de couple.', `
        <label>Ensemble depuis
          <input name="relationship_since" type="number" min="1900" max="${new Date().getFullYear()}" value="${e(profile?.relationship_since)}" placeholder="Exemple : 2012">
        </label>
      `, 'data-couple-step '),
      discoveryStep(3, 'Votre localisation privée', 'Dans quelle commune vivez-vous ?', 'Cette commune sert à calculer les distances. Elle n’est pas forcément celle qui sera affichée publiquement.', `
        ${communeField('city', 'Commune de résidence', profile?.city, 'Saisis une ville ou un code postal, puis choisis la commune proposée.')}
      `),
      discoveryStep(4, 'Votre localisation publique', 'Que souhaites-tu montrer aux autres membres ?', 'Tu peux rester précis ou choisir une zone plus large. C’est cette information, et uniquement celle-ci, qui apparaîtra sur le profil.', `
        ${communeField('location_zone', 'Zone affichée sur le profil', profile?.location_zone, 'Exemple : Lens · Béthune et alentours · Pas-de-Calais.')}
      `),
      discoveryStep(5, 'Ta place dans ce profil', 'Comment veux-tu qu’on t’appelle personnellement ?', 'Si vous êtes en couple, cette fiche sera la tienne. Ta moitié complétera la sienne depuis son propre lien.', `
        <label>Ton prénom ou ton pseudonyme
          <input name="p0_first_name" maxlength="80" value="${e(ownPerson.first_name)}" required>
        </label>
      `),
      discoveryStep(6, 'Ton identité', 'Comment souhaites-tu être présenté(e) ?', 'Cette réponse permet à Velvet de personnaliser ta fiche et de respecter les filtres de confidentialité.', `
        <label>Identité de genre
          <select name="p0_gender_identity" required>
            <option value="">Choisir…</option>
            ${REFERENCES.genderIdentities.map((option) => `<option value="${e(option)}"${option === ownPerson.gender_identity ? ' selected' : ''}>${e(option)}</option>`).join('')}
          </select>
        </label>
      `)
    ];

    const nextIndex = steps.length;
    steps.push(
      discoveryStep(nextIndex, 'Quelques repères', 'Comment te décrirais-tu physiquement ?', 'Je te propose quelques repères utiles. Tu peux laisser les informations facultatives vides si tu préfères les garder pour plus tard.', `
        <div class="form-grid">
          <label>Année de naissance<input name="p0_birth_year" type="number" min="1900" max="${new Date().getFullYear() - 18}" value="${e(ownPerson.birth_year)}"></label>
          <label>Taille en cm<input name="p0_height_cm" type="number" min="100" max="250" value="${e(ownPerson.height_cm)}"></label>
          <label>Poids en kg<input name="p0_weight_kg" type="number" min="30" max="350" value="${e(ownPerson.weight_kg)}"></label>
          ${selectField('p0_morphology', 'Morphologie', REFERENCES.morphologies, ownPerson.morphology)}
        </div>
      `),
      discoveryStep(nextIndex + 1, 'Ton allure', 'Quels détails complètent ton portrait ?', 'Deux derniers détails visuels, puis nous passerons à ce qui te caractérise vraiment.', `
        <div class="form-grid">
          ${selectField('p0_hair_color', 'Couleur des cheveux', REFERENCES.hairColors, ownPerson.hair_color)}
          ${selectField('p0_eye_color', 'Couleur des yeux', REFERENCES.eyeColors, ownPerson.eye_color)}
        </div>
      `),
      discoveryStep(nextIndex + 2, 'Ce que tu souhaites partager', 'Parlons de ta vie personnelle.', 'Ces informations sont facultatives. Pour ta profession, tu peux la renseigner tout en choisissant de la garder privée.', `
        <div class="form-grid">
          <label>Enfants
            <select name="p0_children_status">
              <option value="private"${ownPerson.children_status === 'private' || !ownPerson.children_status ? ' selected' : ''}>Information privée</option>
              <option value="yes"${ownPerson.children_status === 'yes' ? ' selected' : ''}>Oui</option>
              <option value="no"${ownPerson.children_status === 'no' ? ' selected' : ''}>Non</option>
            </select>
          </label>
          <label>Profession<input name="p0_profession" maxlength="120" value="${e(ownPerson.profession)}"></label>
          <label class="check"><input name="p0_profession_private" type="checkbox"${ownPerson.profession_private !== false ? ' checked' : ''}><span>Garder ma profession privée</span></label>
        </div>
      `),
      discoveryStep(nextIndex + 3, 'Tes affinités', 'Comment définis-tu ton orientation ?', 'Il ne s’agit pas de t’enfermer dans une case : choisis simplement la réponse qui te ressemble aujourd’hui.', `
        ${selectField('p0_orientation', 'Orientation', REFERENCES.orientations, ownPerson.orientation)}
      `),
      discoveryStep(nextIndex + 4, 'Tes affinités', 'Vers qui va naturellement ton attirance ?', 'Plusieurs réponses sont possibles.…38367 tokens truncated…TML = `<div class="page">
        ${pageHead('Conversation privée', conversation?.subject || 'Conversation', 'Les messages sont enregistrés dans Supabase et protégés par les règles d’accès de la conversation.', '<button class="secondary" data-route="conversations">Retour</button>')}
        ${conversationStreakCard(result.streak)}
        <section class="card">
          <div class="messages">${list(result.messages).length ? result.messages.map((message) => `<article class="message ${message.sender_user_id === result.currentUserId ? 'mine' : ''}"><small>${e(message.sender_identity || (message.sender_user_id === result.currentUserId ? 'Vous' : 'Membre'))}</small>${message.body ? `<p>${e(message.body)}</p>` : ''}${messageAttachments(message)}</article>`).join('') : '<p>Aucun message dans cette conversation.</p>'}</div>
          <form id="messageForm" class="composer">
            <input type="hidden" name="conversationId" value="${e(conversationId)}">
            <input name="body" maxlength="10000" placeholder="Écrire un message…">
            <label class="attachment-picker" title="Ajouter des pièces jointes"><input type="file" name="attachments" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf" multiple><span>＋ Photo, vidéo ou PDF</span></label>
            <small class="attachment-selection" role="status"></small>
            <button class="primary" type="submit">Envoyer</button>
          </form>
        </section>
      </div>`;
      const fileInput = document.querySelector('#messageForm [name=attachments]');
      fileInput?.addEventListener('change', () => {
        const files = [...fileInput.files].slice(0, 4);
        document.querySelector('.attachment-selection').textContent = files.length
          ? files.map((file) => file.name).join(' · ')
          : '';
      });
      document.querySelector('#messageForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const button = event.currentTarget.querySelector('button');
        if (!String(data.get('body') || '').trim() && !data.getAll('attachments').some((file) => file instanceof File && file.size)) {
          toast('Écris un message ou ajoute une pièce jointe.', true);
          return;
        }
        button.disabled = true;
        try {
          await api('/api/members/messages', { method: 'POST', body: data });
          await openConversation(conversationId);
        } catch (error) {
          toast(error.message, true);
          button.disabled = false;
        }
      });
    } catch (error) {
      toast(error.message, true);
      route('conversations');
    }
  }

  async function startConversation(profileId) {
    try {
      const result = await api('/api/members/conversations', {
        method: 'POST',
        body: JSON.stringify({ profileId })
      });
      await refreshData();
      await openConversation(result.conversationId);
    } catch (error) {
      toast(errorMessages[error.message] || error.message, true);
    }
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch {
      return '';
    }
  }

  function openingHoursView(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) {
      return '<p class="muted">Les horaires seront publiés depuis Velvet Pro.</p>';
    }
    return `<div class="hours-list">${Object.entries(value).map(([day, hours]) => `<div><span>${e(day)}</span><strong>${e(Array.isArray(hours) ? hours.join(' · ') : hours)}</strong></div>`).join('')}</div>`;
  }

  function venueById(id, fromMap = false) {
    const reference = list(state.directory.venueDirectory).find((venue) => venue.id === id);
    if (reference) {
      const published = list(state.directory.establishments).find((venue) =>
        venue.id === reference.claimed_establishment_id || venue.directory_venue_id === reference.id
      );
      return published
        ? { ...reference, ...published, id: reference.id, claimed_establishment_id: published.id, source: 'establishment' }
        : { ...reference, source: 'directory' };
    }
    if (!fromMap) return null;
    const mapReference = list(state.mapData?.venues).find((venue) => venue.id === id);
    if (!mapReference) return null;
    const linked = list(state.directory.establishments).find((venue) =>
      String(venue.name).trim().toLowerCase() === String(mapReference.name).trim().toLowerCase()
    );
    return linked
      ? { ...mapReference, ...linked, latitude: mapReference.latitude, longitude: mapReference.longitude, source: 'establishment' }
      : { ...mapReference, source: 'directory' };
  }

  function venueRelationship(venueId, relation) {
    return list(state.directory.venueRelationships).some((row) =>
      row.venue_id === venueId && row.relation_type === relation
    );
  }

  function openVenue(id, fromMap = false) {
    const venue = venueById(id, fromMap);
    if (!venue) {
      toast('Établissement introuvable.', true);
      return;
    }
    const establishmentId = venue.claimed_establishment_id || (venue.source === 'establishment' ? venue.id : null);
    const professionalActive = Boolean(establishmentId && ['trial','active'].includes(venue.subscription_status));
    const supportsAgenda = ['club', 'spa', 'bar'].includes(String(venue.kind || '').toLocaleLowerCase('fr'));
    const events = list(state.directory.events)
      .filter((event) => event.establishment_id === establishmentId)
      .filter((event) => new Date(event.starts_at) >= new Date())
      .sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
    const recommendations = list(state.directory.recommendations)
      .filter((item) => item.target_type === 'establishment' && item.target_id === establishmentId);
    const venueVisits = list(state.plans.venueVisits)
      .filter((visit) => visit.venue_id === venue.id)
      .sort((left, right) => left.visit_date.localeCompare(right.visit_date));
    const visitDates = [...new Set(venueVisits.map((visit) => visit.visit_date))];
    const website = safeExternalUrl(venue.website);
    const routeQuery = [venue.address_public || venue.address, venue.city, venue.country_code || venue.countryCode].filter(Boolean).join(', ');
    const routeUrl = routeQuery
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(routeQuery)}`
      : venue.latitude && venue.longitude
        ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(venue.latitude)}&mlon=${encodeURIComponent(venue.longitude)}#map=16/${encodeURIComponent(venue.latitude)}/${encodeURIComponent(venue.longitude)}`
        : '';
    content.innerHTML = `<div class="page venue-site">
      <section class="venue-hero">
        <div><p class="eyebrow">${e(venue.kind || 'Établissement Velvet')}</p><h1>${e(venue.name)}</h1><p>${e(venue.description || 'Cet établissement complète actuellement sa présentation dans Velvet Pro.')}</p>
          <div class="badges"><span class="pill gold">${professionalActive ? 'Professionnel Velvet Pro' : venue.claim_status === 'claimed' ? 'Fiche revendiquée · abonnement inactif' : 'Référencé Velvet · à confirmer'}</span>${venue.city ? `<span class="pill">${e(venue.city)}</span>` : ''}</div>
          <div class="actions">${routeUrl ? `<a class="primary" href="${e(routeUrl)}" target="_blank" rel="noopener noreferrer">Itinéraire</a>` : ''}${website ? `<a class="secondary" href="${e(website)}" target="_blank" rel="noopener noreferrer">Site officiel</a>` : ''}<button class="secondary" data-venue-relation="favorite" data-venue-id="${e(venue.id)}">${venueRelationship(venue.id,'favorite') ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button><button class="secondary" data-venue-relation="visited" data-venue-id="${e(venue.id)}">${venueRelationship(venue.id,'visited') ? 'Déjà fréquenté ✓' : 'J’y suis déjà allé(e)'}</button><button class="secondary" data-venue-relation="planning" data-venue-id="${e(venue.id)}">${venueRelationship(venue.id,'planning') ? 'Envie enregistrée ✓' : 'J’ai envie d’y aller'}</button><button class="secondary" data-route="venues">Retour</button></div>
        </div><span class="venue-hero-mark">V</span>
      </section>
      <nav class="venue-summary" aria-label="Résumé de l’établissement">
        <span><small>Type</small><b>${e(venue.kind || 'Lieu')}</b></span>
        <span><small>Ville</small><b>${e(venue.city || 'À venir')}</b></span>
        <span><small>Adresse</small><b>${e(venue.address_public || venue.address || 'À venir')}</b></span>
      </nav>
      <section class="grid two venue-content">
        <article class="card section"><p class="eyebrow">L’essentiel</p><h2>Présentation</h2><p>${e(venue.description || venue.practical_info || 'Cette fiche provient du référentiel Velvet et doit encore être confirmée par le professionnel.')}</p><h3>Public et programmation</h3>${chips([venue.audience,venue.evening_types].filter(Boolean),'Informations à confirmer')}<h3>Équipements</h3>${chips(venue.amenities, 'Équipements à renseigner')}</article>
        <article class="card section"><p class="eyebrow">Préparer sa venue</p><h2>Horaires</h2>${venue.opening_hours_text ? `<p>${e(venue.opening_hours_text)}</p>` : openingHoursView(venue.opening_hours)}<h3>Tarifs indicatifs</h3><p>${e(venue.pricing_text || 'Tarifs à confirmer auprès de l’établissement.')}</p><h3>Contact public</h3>
          <div class="contact-list">${venue.phone_public || venue.phone ? `<a href="tel:${e(String(venue.phone_public || venue.phone).replace(/[^+0-9]/g, ''))}">${e(venue.phone_public || venue.phone)}</a>` : ''}${venue.email_public || venue.email ? `<a href="mailto:${e(venue.email_public || venue.email)}">${e(venue.email_public || venue.email)}</a>` : ''}${!venue.phone_public && !venue.phone && !venue.email_public && !venue.email ? '<span>Coordonnées à confirmer</span>' : ''}</div>
        </article>
      </section>
      ${venue.manual_review_required ? '<p class="card muted">Fiche issue d’un recensement documentaire. Adresse, horaires, tarifs et statut commercial doivent être confirmés avant déplacement.</p>' : ''}
      <section class="home-section venue-community-calendar">
        <header class="section-heading"><div><p class="eyebrow">Calendrier des membres</p><h2>Qui compte s’y rendre ?</h2><p>Ce calendrier existe même si l’établissement n’a publié aucune soirée. Une seule présence est créée par profil, lieu et date.</p></div></header>
        ${state.plans.migrationPending ? '<p class="card status-box">Le calendrier des membres sera activé après la migration Supabase 0024.</p>' : `<form class="card venue-visit-form" data-venue-id="${e(venue.id)}"><label>Date de votre venue<input type="date" name="visitDate" min="${e(parisDayKey())}" required></label><button class="primary" type="submit">Nous y serons</button></form>`}
        ${visitDates.length ? `<div class="venue-visit-dates">${visitDates.map((date) => {
          const visitors = venueVisits.filter((visit) => visit.visit_date === date);
          return `<article class="card"><p class="eyebrow">${e(date < parisDayKey() ? 'Ils y sont allés' : 'Ils y seront')}</p><h3>${e(dateLabel(date))}</h3><div class="venue-visitors">${visitors.map((visit) => {
            const member = visit.profile_id === state.profile.id
              ? state.profile
              : list(state.directory.profiles).find((profile) => profile.id === visit.profile_id);
            return profilePreviewCard(member, { variant: 'compact' });
          }).join('')}</div></article>`;
        }).join('')}</div>` : '<p class="muted">Aucun membre n’a encore annoncé sa venue.</p>'}
      </section>
      ${supportsAgenda ? `<section class="home-section"><header class="section-heading"><div><p class="eyebrow">Agenda</p><h2>Prochaines soirées</h2></div></header>
        ${professionalActive ? (events.length ? `<div class="grid two">${events.map(eventTile).join('')}</div>` : emptyState('Aucune soirée publiée', 'Ce professionnel peut publier son agenda depuis Velvet Pro.', '✦')) : emptyState('Agenda non disponible', 'L’établissement pourra ouvrir son agenda après revendication de la fiche, validation par Velvet et activation de son abonnement Pro.', '✦')}
      </section>` : ''}
      <section class="grid two home-section">
        <article><header class="section-heading"><div><p class="eyebrow">Galerie</p><h2>L’univers du lieu</h2></div></header>${emptyState(professionalActive ? 'Galerie à venir' : 'Galerie verrouillée', professionalActive ? 'Les photos seront ajoutées par l’établissement depuis son espace professionnel.' : 'Aucune photo n’est publiée sans autorisation. La galerie sera ouverte uniquement par un professionnel abonné.', '◇')}</article>
        <article><header class="section-heading"><div><p class="eyebrow">La communauté en parle</p><h2>Recommandations</h2></div></header>${recommendations.length ? recommendations.map((item) => `<blockquote class="card"><p>« ${e(item.body)} »</p><small>${item.rating ? `${e(item.rating)}/5` : 'Recommandation membre'}</small></blockquote>`).join('') : emptyState('Aucune recommandation', 'Les avis authentiques apparaîtront après les premières visites.', '♡')}</article>
      </section>
    </div>`;
    bindDynamicForms();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function markNotification(notificationId) {
    const result = await api('/api/members/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'read', notificationId })
    });
    state.notifications = result.notifications || [];
    state.unreadCount = Number(result.unreadCount || 0);
    updateNotificationBadges();
  }

  async function openNotification(notificationId) {
    const notification = list(state.notifications).find((row) => row.id === notificationId);
    if (!notification) return;
    try {
      if (!notification.read_at) await markNotification(notificationId);
      if (notification.entity_type === 'conversation') {
        await openConversation(notification.entity_id);
        return;
      }
      if (notification.entity_type === 'event') {
        await openEvent(notification.entity_id);
        return;
      }
      if (notification.entity_type === 'album' && notification.actor_profile_id) {
        state.profileTab = 'albums';
        await openProfile(notification.actor_profile_id);
        state.profileTab = 'albums';
        const profile = list(state.directory.profiles).find((row) => row.id === notification.actor_profile_id);
        content.innerHTML = renderProfile(profile, false);
        bindDynamicForms();
        return;
      }
      if (notification.entity_type === 'media') {
        state.profileTab = 'albums';
        state.selectedProfileId = state.profile.id;
        content.innerHTML = renderProfile(state.profile, true);
        bindDynamicForms();
        return;
      }
      if (notification.actor_profile_id || notification.entity_type === 'profile') {
        await openProfile(notification.actor_profile_id || notification.entity_id);
        return;
      }
      route('notifications');
    } catch (error) {
      toast(errorMessages[error.message] || error.message, true);
    }
  }

  async function updateSocialAction(profileId, action, enabled) {
    try {
      const result = await api('/api/members/social-actions', {
        method: 'POST',
        body: JSON.stringify({ profileId, action, enabled })
      });
      state.socialActions[profileId] = {
        favorite: Boolean(result.favorite),
        blocked: Boolean(result.blocked)
      };
      const profile = list(state.directory.profiles).find((row) => row.id === profileId);
      content.innerHTML = renderProfile(profile, false);
      bindDynamicForms();
      state.following = result.favorite
        ? [...new Set([...state.following, profileId])]
        : state.following.filter((id) => id !== profileId);
      toast(action === 'favorite'
        ? (result.favorite ? 'Vous suivez maintenant ce membre.' : 'Vous ne suivez plus ce membre.')
        : (result.blocked ? 'Profil bloqué.' : 'Profil débloqué.'));
    } catch (error) {
      toast(errorMessages[error.message] || error.message, true);
    }
  }

  function profileForUser(userId) {
    return list(state.directory.profiles).find((profile) =>
      list(profile.individual_profiles).some((person) => person.linked_user_id === userId)
    );
  }

  async function openEvent(eventId) {
    const event = list(state.directory.events).find((row) => row.id === eventId);
    if (!event) {
      toast('Sortie introuvable.', true);
      return;
    }
    content.innerHTML = `<div class="page"><section class="loading-state"><span class="loader"></span><p>Chargement de la sortie…</p></section></div>`;
    try {
      const result = await api(`/api/members/event-registrations?eventId=${encodeURIComponent(eventId)}`);
      const mine = list(result.registrations).find((row) => row.user_id === result.currentUserId);
      const profiles = [...new Map(list(result.registrations)
        .filter((row) => row.visible_to_participants)
        .map((row) => profileForUser(row.user_id))
        .filter(Boolean)
        .map((profile) => [profile.id, profile])).values()];
      content.innerHTML = `<div class="page">
        ${pageHead('Sortie Velvet', event.title, `${new Date(event.starts_at).toLocaleString('fr-FR')} · ${event.location_public || 'Lieu communiqué aux inscrits'}`, '<button class="secondary" data-route="events">Retour aux sorties</button>')}
        <section class="grid two">
          <article class="card section"><p class="eyebrow">Présentation</p><h2>${e(event.title)}</h2><p>${e(event.description || 'La présentation sera prochainement complétée par l’organisateur.')}</p>${chips([event.audience, `${event.capacity} places`].filter(Boolean))}</article>
          <article class="card section"><p class="eyebrow">Votre participation</p><h2>${mine ? (mine.status === 'waitlisted' ? 'Liste d’attente' : 'Inscription enregistrée') : 'Envie de participer ?'}</h2>
            ${mine ? `<p>${mine.places} place${mine.places > 1 ? 's' : ''} · statut ${e(mine.status)}</p><button class="secondary" data-cancel-event="${e(event.id)}">Annuler mon inscription</button>` : `<form id="eventRegistrationForm" data-event-id="${e(event.id)}"><label>Nombre de places<select name="places"><option value="1">1 place</option><option value="2">2 places</option></select></label><label class="toggle"><input type="checkbox" name="visible" checked><span>Montrer mon profil aux autres participants</span></label><button class="primary" type="submit">M’inscrire</button></form>`}
          </article>
        </section>
        <section style="margin-top:18px">${profiles.length ? `<div class="page-head"><div><p class="eyebrow">Communauté de la sortie</p><h2>Participants visibles</h2><p>Seuls les membres ayant choisi d’apparaître sont présentés.</p></div></div><div class="grid three">${profiles.map(memberTile).join('')}</div>` : emptyState('Aucun participant visible', 'Les profils apparaîtront ici après leur inscription et avec leur accord.', '◇')}</section>
      </div>`;
      bindDynamicForms();
    } catch (error) {
      content.innerHTML = `<div class="page">${emptyState('Sortie indisponible', errorMessages[error.message] || error.message, '!')}</div>`;
    }
  }

  function route(name) {
    name = ({
      members: 'discover',
      places: 'venues',
      messages: 'conversations',
      profile: 'me'
    })[name] || name;
    if (state.verification?.accessBlockedByVerification) {
      renderVerificationGate(state.verification);
      return;
    }
    if (state.profile?.admission_status !== 'approved') {
      renderAdmission();
      return;
    }
    state.route = name;
    document.body.dataset.velvetRoute = name;
    if (name !== 'maps') mapResizeObserver?.disconnect();
    state.editing = false;
    const primaryRoute = ({ maps: 'venues', events: 'venues', settings: 'me' })[name] || name;
    navButtons.forEach((button) => {
      const inPrimaryNavigation = Boolean(button.closest('#mainNav,.bottom-nav'));
      const active = button.dataset.route === name
        || (inPrimaryNavigation && button.dataset.route === primaryRoute);
      button.classList.toggle('active', active);
      if (inPrimaryNavigation) {
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
    });
    if (name === 'home') content.innerHTML = renderHome();
    if (name === 'discover') content.innerHTML = renderDiscover();
    if (name === 'maps') {
      openMaps();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (name === 'conversations') content.innerHTML = renderConversations();
    if (name === 'events') content.innerHTML = renderEvents();
    if (name === 'venues') content.innerHTML = renderVenues();
    if (name === 'notifications') content.innerHTML = renderNotifications();
    if (name === 'settings') {
      openSettings();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (name === 'me') {
      state.selectedProfileId = state.profile.id;
      content.innerHTML = renderProfile(state.profile, true);
    }
    if (name === 'discover') bindDiscover();
    bindDynamicForms();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    content.focus();
  }

  async function openProfile(id) {
    const profile = list(state.directory.profiles).find((row) => row.id === id);
    if (!profile) {
      toast('Profil introuvable.', true);
      return;
    }
    state.selectedProfileId = id;
    state.profileTab = 'couple';
    if (id !== state.profile.id) {
      try {
        const [result, social] = await Promise.all([
          api('/api/members/engagement', {
            method: 'POST',
            body: JSON.stringify({ action: 'view', profileId: id })
          }),
          api(`/api/members/social-actions?profileId=${encodeURIComponent(id)}`).catch(() => ({
            favorite: false,
            blocked: false
          }))
        ]);
        state.engagement = {
          views: result.views || [],
          reactions: result.reactions || [],
          streaks: result.streaks || [],
          currentUserId: result.currentUserId,
          currentProfileId: result.currentProfileId
        };
        state.socialActions[id] = social;
      } catch (error) {
        toast('La consultation n’a pas pu être ajoutée à ta mémoire Velvet.', true);
      }
    }
    content.innerHTML = renderProfile(profile, id === state.profile.id);
    bindDynamicForms();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindDynamicForms() {
    document.querySelector('#homeVenueKind')?.addEventListener('change', (event) => {
      state.homeVenueKind = event.target.value;
      content.innerHTML = renderHome();
      bindDynamicForms();
    });
    document.querySelector('#homeVenueRadius')?.addEventListener('change', (event) => {
      state.homeVenueRadius = event.target.value;
      content.innerHTML = renderHome();
      bindDynamicForms();
    });
    document.querySelectorAll('[data-map-zoom]').forEach((button) => {
      button.addEventListener('click', () => {
        state.mapZoom = Math.max(5, Math.min(13, state.mapZoom + Number(button.dataset.mapZoom)));
        refreshMapWorkspace();
      });
    });
    document.querySelectorAll('[data-map-layer]').forEach((input) => {
      input.addEventListener('change', () => {
        state.mapLayers[input.dataset.mapLayer] = input.checked;
        refreshMapWorkspace();
      });
    });
    document.querySelectorAll('[data-enable-location]').forEach((button) => {
      button.addEventListener('click', () => enableProximity(button));
    });
    bindMapInteraction();
    document.querySelectorAll('[data-profile-carousel]').forEach((shell) => {
      const track = shell.querySelector('[data-carousel-track]');
      const slides = [...track.querySelectorAll('[data-carousel-slide]')];
      if (!slides.length) return;
      const profileId = shell.dataset.profileId;
      const sync = (requestedIndex) => {
        const index = Math.max(0, Math.min(slides.length - 1, requestedIndex));
        shell.dataset.carouselIndex = String(index);
        state.carouselIndexes[profileId] = index;
        shell.querySelector('[data-carousel-current]')?.replaceChildren(document.createTextNode(String(index + 1)));
        shell.querySelectorAll('[data-carousel-to]').forEach((dot) => {
          const active = Number(dot.dataset.carouselTo) === index;
          dot.classList.toggle('active', active);
          dot.setAttribute('aria-current', active ? 'true' : 'false');
        });
      };
      const move = (index) => {
        sync(index);
        track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
      };
      const initialIndex = Math.max(0, Math.min(slides.length - 1, Number(shell.dataset.carouselIndex) || 0));
      track.scrollLeft = initialIndex * track.clientWidth;
      sync(initialIndex);
      shell.querySelector('[data-carousel-previous]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const current = Number(shell.dataset.carouselIndex) || 0;
        move((current - 1 + slides.length) % slides.length);
      });
      shell.querySelector('[data-carousel-next]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const current = Number(shell.dataset.carouselIndex) || 0;
        move((current + 1) % slides.length);
      });
      shell.querySelectorAll('[data-carousel-to]').forEach((dot) => dot.addEventListener('click', (event) => {
        event.stopPropagation();
        move(Number(dot.dataset.carouselTo));
      }));
      let frame;
      track.addEventListener('scroll', () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          if (track.clientWidth) sync(Math.round(track.scrollLeft / track.clientWidth));
        });
      }, { passive: true });
    });
    const venueCatalogSearch = document.querySelector('#venueCatalogSearch');
    if (venueCatalogSearch) {
      venueCatalogSearch.addEventListener('input', () => {
        state.venueQuery = venueCatalogSearch.value;
        window.clearTimeout(window.venueCatalogTimer);
        window.venueCatalogTimer = window.setTimeout(() => {
          content.innerHTML = renderVenues();
          bindDynamicForms();
          document.querySelector('#venueCatalogSearch')?.focus();
        }, 180);
      });
      document.querySelector('#venueCatalogKind')?.addEventListener('change', (event) => {
        state.venueKind = event.target.value;
        content.innerHTML = renderVenues();
        bindDynamicForms();
      });
      document.querySelector('#venueCatalogCountry')?.addEventListener('change', (event) => {
        state.venueCountry = event.target.value;
        state.venueRegion = '';
        state.venueLocationQuery = '';
        state.venueCenter = null;
        content.innerHTML = renderVenues();
        bindDynamicForms();
      });
      document.querySelector('#venueCatalogRegion')?.addEventListener('change', (event) => {
        state.venueRegion = event.target.value;
        content.innerHTML = renderVenues();
        bindDynamicForms();
      });
      const locationInput = document.querySelector('#venueCatalogLocation');
      const locationResults = document.querySelector('[data-venue-location-results]');
      if (locationInput && locationResults) {
        let locationTimer;
        let locationRequest = 0;
        let availableLocations = [];
        const chooseLocation = (row) => {
          if (!row || !Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) return;
          state.venueLocationQuery = row.label;
          state.venueCenter = {
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            label: row.label
          };
          content.innerHTML = renderVenues();
          bindDynamicForms();
        };
        locationInput.addEventListener('input', () => {
          window.clearTimeout(locationTimer);
          const query = locationInput.value.trim();
          state.venueLocationQuery = query;
          if (query !== state.venueCenter?.label) state.venueCenter = null;
          if (!query) {
            locationResults.hidden = true;
            content.innerHTML = renderVenues();
            bindDynamicForms();
            return;
          }
          if (query.length < 2) {
            locationResults.hidden = true;
            return;
          }
          const currentRequest = ++locationRequest;
          locationTimer = window.setTimeout(async () => {
            try {
              const countries = state.venueCountry ? [state.venueCountry] : ['FR', 'BE'];
              const payloads = await Promise.all(countries.map((country) =>
                api(`/api/reference/communes?q=${encodeURIComponent(query)}&country=${country}`).catch(() => ({ results: [] }))
              ));
              if (currentRequest !== locationRequest) return;
              availableLocations = [...new Map(payloads
                .flatMap((payload) => list(payload.results))
                .map((row) => [`${row.countryCode}:${row.label}:${row.latitude}:${row.longitude}`, row]))
                .values()].slice(0, 12);
              locationResults.innerHTML = availableLocations.length
                ? availableLocations.map((row, index) => `<button type="button" data-venue-location-index="${index}"><strong>${e(row.postalCode || row.countryCode || '')}</strong><span>${e(row.city)}</span><small>${e(row.region || row.departmentCode || '')}</small></button>`).join('')
                : '<p>Aucune ville trouvée.</p>';
              locationResults.hidden = false;
              locationResults.querySelectorAll('[data-venue-location-index]').forEach((button) => {
                button.addEventListener('click', () => chooseLocation(availableLocations[Number(button.dataset.venueLocationIndex)]));
              });
            } catch {
              locationResults.innerHTML = '<p>Recherche géographique momentanément indisponible.</p>';
              locationResults.hidden = false;
            }
          }, 280);
        });
        locationInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && availableLocations.length) {
            event.preventDefault();
            chooseLocation(availableLocations[0]);
          }
        });
        locationInput.addEventListener('blur', () => window.setTimeout(() => {
          locationResults.hidden = true;
          if (!state.venueCenter && state.venueLocationQuery) {
            content.innerHTML = renderVenues();
            bindDynamicForms();
          }
        }, 180));
      }
      const radiusInput = document.querySelector('#venueCatalogRadius');
      radiusInput?.addEventListener('input', () => {
        document.querySelector('[data-venue-radius-label]')?.replaceChildren(document.createTextNode(`${radiusInput.value} km`));
      });
      radiusInput?.addEventListener('change', () => {
        state.venueRadius = Number(radiusInput.value);
        content.innerHTML = renderVenues();
        bindDynamicForms();
      });
      document.querySelector('[data-clear-venue-location]')?.addEventListener('click', () => {
        state.venueLocationQuery = '';
        state.venueCenter = null;
        content.innerHTML = renderVenues();
        bindDynamicForms();
      });
    }
    const reportForm = document.querySelector('#profileReportForm');
    if (reportForm) reportForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = reportForm.querySelector('[type=submit]');
      const data = new FormData(reportForm);
      button.disabled = true;
      try {
        const result = await api('/api/members/social-actions', {
          method: 'POST',
          body: JSON.stringify({
            action: 'report',
            profileId: reportForm.dataset.profileId,
            category: data.get('category'),
            description: data.get('description')
          })
        });
        state.socialActions[reportForm.dataset.profileId] = {
          favorite: Boolean(result.favorite),
          blocked: true
        };
        state.following = state.following.filter((id) => id !== reportForm.dataset.profileId);
        state.directory.profiles = state.directory.profiles.filter((profile) => profile.id !== reportForm.dataset.profileId);
        reportForm.reset();
        toast('Signalement transmis à Velvet Control. Le membre est bloqué.');
        route('discover');
      } catch (error) {
        toast(errorMessages[error.message] || error.message, true);
      } finally {
        button.disabled = false;
      }
    });

    const venueVisitForm = document.querySelector('.venue-visit-form');
    if (venueVisitForm) venueVisitForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(venueVisitForm);
      const button = venueVisitForm.querySelector('button');
      button.disabled = true;
      try {
        const result = await api('/api/members/plans', {
          method: 'POST',
          body: JSON.stringify({
            action: 'venue_visit',
            venueId: venueVisitForm.dataset.venueId,
            visitDate: data.get('visitDate')
          })
        });
        state.plans = result;
        openVenue(venueVisitForm.dataset.venueId);
        toast('Votre présence est visible sur le lieu et sur votre profil.');
      } catch (error) {
        toast(errorMessages[error.message] || error.message, true);
        button.disabled = false;
      }
    });

    document.querySelectorAll('.cap-travel-form').forEach((form) => {
      const zoneInput = form.querySelector('[data-cap-zone-input]');
      const zoneLabel = form.querySelector('[data-cap-zone-label]');
      form.querySelectorAll('[data-cap-zone]').forEach((point) => {
        point.addEventListener('click', () => {
          if (!zoneInput) return;
          zoneInput.value = point.dataset.capZone;
          if (zoneLabel) zoneLabel.textContent = point.dataset.capZone;
          form.querySelectorAll('[data-cap-zone]').forEach((candidate) => {
            const active = candidate === point;
            candidate.classList.toggle('active', active);
            candidate.setAttribute('aria-pressed', String(active));
          });
        });
      });
    });

    document.querySelectorAll('.travel-plan-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const button = form.querySelector('button');
        button.disabled = true;
        try {
          const result = await api('/api/members/plans', {
            method: 'POST',
            body: JSON.stringify({
              action: 'travel_plan',
              title: data.get('title'),
              locationLabel: data.get('locationLabel'),
              startsOn: data.get('startsOn'),
              endsOn: data.get('endsOn'),
              destinationType: data.get('destinationType'),
              capZone: data.get('capZone'),
              capVenue: data.get('capVenue'),
              notes: data.get('notes'),
              latitude: data.get('latitude'),
              longitude: data.get('longitude'),
              preciseLocationConsent: data.has('preciseLocationConsent')
            })
          });
          state.plans = result;
          content.innerHTML = renderProfile(state.profile, true);
          bindDynamicForms();
          toast('Le séjour est publié sur votre profil.');
        } catch (error) {
          toast(errorMessages[error.message] || error.message, true);
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll('[data-delete-plan]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const result = await api(`/api/members/plans?type=${encodeURIComponent(button.dataset.planType)}&id=${encodeURIComponent(button.dataset.deletePlan)}`, { method: 'DELETE' });
          state.plans = result;
          content.innerHTML = renderProfile(state.profile, true);
          bindDynamicForms();
          toast('Cette information a été retirée du profil.');
        } catch (error) {
          toast(errorMessages[error.message] || error.message, true);
          button.disabled = false;
        }
      });
    });

    const eventRegistrationForm = document.querySelector('#eventRegistrationForm');
    if (eventRegistrationForm) eventRegistrationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(eventRegistrationForm);
      const button = eventRegistrationForm.querySelector('[type=submit]');
      button.disabled = true;
      try {
        const result = await api('/api/members/event-registrations', {
          method: 'POST',
          body: JSON.stringify({
            eventId: eventRegistrationForm.dataset.eventId,
            places: Number(data.get('places')),
            visibleToParticipants: data.has('visible')
          })
        });
        toast(result.registration?.registration_status === 'waitlisted'
          ? 'La sortie est complète : tu es sur liste d’attente.'
          : 'Ton inscription est confirmée.');
        await refreshData();
        await openEvent(eventRegistrationForm.dataset.eventId);
      } catch (error) {
        toast(errorMessages[error.message] || error.message, true);
        button.disabled = false;
      }
    });

    const albumForm = document.querySelector('#albumForm');
    if (albumForm) albumForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      const values = Object.fromEntries(new FormData(event.currentTarget));
      button.disabled = true;
      try {
        await api('/api/members/albums', { method: 'POST', body: JSON.stringify(values) });
        await refreshData();
        state.profileTab = 'albums';
        content.innerHTML = renderProfile(state.profile, true);
        bindDynamicForms();
        toast(values.confidentiality === 'public' ? 'Album public créé.' : 'Album privé créé.');
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
    });

    document.querySelectorAll('.profile-photo-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        const status = form.querySelector('.photo-upload-status');
        const files = [...form.querySelector('input[type=file]').files];
        button.disabled = true;
        try {
          for (let index = 0; index < files.length; index += 1) {
            status.textContent = `Validation ${index + 1}/${files.length}…`;
            const body = new FormData();
            body.set('photo', await optimizePhoto(files[index]));
            body.set('mediaRole', form.dataset.photoRole);
            if (form.dataset.individualProfile) {
              body.set('individualProfileId', form.dataset.individualProfile);
            }
            await api('/api/members/photos', { method: 'POST', body });
          }
          await refreshData();
          content.innerHTML = renderProfile(state.profile, true);
          bindDynamicForms();
          toast('Photos ajoutées. Elles apparaîtront après validation.');
        } catch (error) {
          status.textContent = errorMessages[error.message] || error.message;
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll('.album-photo-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        const status = form.querySelector('.photo-upload-status');
        const files = [...form.querySelector('input[type=file]').files];
        button.disabled = true;
        try {
          for (let index = 0; index < files.length; index += 1) {
            status.textContent = `Envoi ${index + 1}/${files.length}…`;
            const body = new FormData();
            body.set('photo', files[index].type.startsWith('image/')
              ? await optimizePhoto(files[index])
              : files[index]);
            body.set('albumId', form.dataset.albumId);
            await api('/api/members/album-media', { method: 'POST', body });
          }
          await refreshData();
          state.profileTab = 'albums';
          content.innerHTML = renderProfile(state.profile, true);
          bindDynamicForms();
          toast('Photos ajoutées à l’album.');
        } catch (error) {
          status.textContent = errorMessages[error.message] || error.message;
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll('.profile-album-access-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        const formData = new FormData(form);
        const albumIds = formData.getAll('albumIds');
        if (!albumIds.length) {
          toast('Choisis au moins un album privé.', true);
          return;
        }
        button.disabled = true;
        try {
          await api('/api/members/album-access', {
            method: 'POST',
            body: JSON.stringify({
              albumIds,
              profileId: form.dataset.profileId,
              duration: formData.get('duration')
            })
          });
          await refreshData();
          state.profileTab = 'albums';
          const target = list(state.directory.profiles).find((row) => row.id === form.dataset.profileId);
          content.innerHTML = renderProfile(target, false);
          bindDynamicForms();
          toast(`${albumIds.length} album${albumIds.length > 1 ? 's' : ''} ouvert${albumIds.length > 1 ? 's' : ''}.`);
        } catch (error) {
          toast(error.message, true);
          button.disabled = false;
        }
      });
    });

    document.querySelectorAll('[data-revoke-album]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await api(`/api/members/album-access?albumId=${encodeURIComponent(button.dataset.revokeAlbum)}&profileId=${encodeURIComponent(button.dataset.revokeProfile)}`, {
            method: 'DELETE'
          });
          await refreshData();
          state.profileTab = 'albums';
          content.innerHTML = renderProfile(state.profile, true);
          bindDynamicForms();
          toast('Accès révoqué immédiatement.');
        } catch (error) {
          toast(error.message, true);
          button.disabled = false;
        }
      });
    });
  }

  function requestOrganizer() {
    content.innerHTML = `<div class="page">
      ${pageHead('Évolution du compte membre', 'Demander l’accès Organisateur', 'Un organisateur est un membre particulier — couple ou individuel — qui organise des soirées privées à domicile ou dans un lieu tiers. Ce n’est pas un établissement professionnel.', '<button class="secondary" data-route="me">Retour au profil</button>')}
      <form id="organizerRequestForm" class="card">
        <h2>Présente ton projet</h2>
        <p>Indique le type de soirées envisagées, les lieux habituels, la capacité approximative et ton expérience. Velvet examinera la demande avant d’accorder le rôle.</p>
        <label>Présentation de votre activité d’organisateur<textarea name="message" class="long" maxlength="2000" required></textarea></label>
        <button class="primary" type="submit" style="margin-top:14px">Transmettre à Velvet</button>
      </form>
    </div>`;
    document.querySelector('#organizerRequestForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      const message = new FormData(event.currentTarget).get('message');
      button.disabled = true;
      try {
        const result = await api('/api/members/organizer-request', { method: 'POST', body: JSON.stringify({ message }) });
        state.organizerRequest = result.request;
        toast('Demande Organisateur transmise.');
        route('me');
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
    });
  }

  function prepareCoupleInvitation(requiredStep = false) {
    content.innerHTML = `<div class="page">
      ${pageHead(requiredStep ? 'Étape 2 sur 2 · Profil couple' : 'Fiche couple partagée', 'Inviter mon/ma partenaire', 'Le lien sera lié à son adresse e-mail. Après inscription et validation des consentements, son compte rejoindra automatiquement votre fiche couple.', requiredStep ? '' : '<button class="secondary" data-route="me">Retour au profil</button>')}
      <form id="coupleInviteForm" class="card">
        <h2>Adresse du partenaire</h2>
        <p>Cette invitation est valable sept jours et ne peut être utilisée que par l’adresse renseignée. Ton ou ta partenaire complétera uniquement sa propre fiche ; vous pourrez tous les deux enrichir la partie commune du couple.</p>
        <label>Adresse e-mail<input type="email" name="email" autocomplete="email" required></label>
        <button class="primary" type="submit" style="margin-top:14px">Créer le lien partenaire</button>
      </form>
    </div>`;
    document.querySelector('#coupleInviteForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      const email = new FormData(event.currentTarget).get('email');
      button.disabled = true;
      try {
        const result = await api('/api/members/couple-invite', { method: 'POST', body: JSON.stringify({ email }) });
        const invitation = result.invitation;
        const subject = 'Ton invitation privée Velvet';
        const body = `Je t’invite à compléter notre profil couple sur Velvet : ${result.registrationUrl}`;
        const mailto = `mailto:${result.invitedEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        content.innerHTML = `<div class="page">
          ${pageHead('Invitation partenaire', 'Lien sécurisé créé', 'Le lien est prérempli pour l’adresse indiquée et ne peut être utilisé qu’une seule fois.')}
          <section class="card">
            <p class="eyebrow">Destinataire</p><h2>${e(result.invitedEmail)}</h2>
            <p>À son arrivée, cette personne sera rattachée à votre couple et complétera sa propre fiche après validation des consentements.</p>
            <div class="actions">
              <button class="primary" type="button" id="copyPartnerLink">Copier le lien sécurisé</button>
              <a class="secondary" href="${e(mailto)}">Envoyer par e-mail</a>
              <button class="secondary" type="button" data-admission>Continuer vers les photos</button>
            </div>
            <p class="status-box" id="partnerLinkStatus" hidden></p>
            <details style="margin-top:14px"><summary>Afficher le code de secours</summary><p style="letter-spacing:.12em">${e(invitation?.invite_code || '')}</p></details>
          </section>
        </div>`;
        document.querySelector('#copyPartnerLink').addEventListener('click', async () => {
          const status = document.querySelector('#partnerLinkStatus');
          try {
            await navigator.clipboard.writeText(result.registrationUrl);
            status.textContent = 'Lien copié. Transmets-le uniquement à ton ou ta partenaire.';
          } catch {
            status.textContent = result.registrationUrl;
          }
          status.hidden = false;
        });
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
    });
  }

  document.addEventListener('click', (event) => {
    const albumPhotoButton = event.target.closest('[data-album-lightbox]');
    if (albumPhotoButton) {
      event.preventDefault();
      openAlbumLightbox(albumPhotoButton.dataset.albumLightbox, albumPhotoButton.dataset.lightboxIndex);
      return;
    }
    if (event.target.closest('[data-admission]')) {
      renderAdmission();
      return;
    }
    const viewInfo = event.target.closest('[data-view-info]');
    if (viewInfo) {
      event.preventDefault();
      event.stopPropagation();
      const memory = profileViewMemory(viewInfo.dataset.viewInfo);
      if (memory) {
        toast(`Dernière consultation : ${viewedAtLabel(memory.last_viewed_at)} · ${memory.view_count} visite${memory.view_count > 1 ? 's' : ''}.`);
      }
      return;
    }
    const newProfilesButton = event.target.closest('[data-home-new-profiles]');
    if (newProfilesButton) {
      event.preventDefault();
      resetDiscoverFilters();
      state.discoverFilters.createdToday = true;
      route('discover');
      return;
    }
    const nearbyEventsButton = event.target.closest('[data-home-events]');
    if (nearbyEventsButton) {
      event.preventDefault();
      if (state.mapData?.center?.source === 'private_approximate_location') {
        state.eventNearbyOnly = true;
        route('events');
      } else {
        enableProximity(nearbyEventsButton).then(() => {
          if (state.mapData?.center?.source === 'private_approximate_location') {
            state.eventNearbyOnly = true;
            route('events');
          }
        });
      }
      return;
    }
    if (event.target.closest('[data-all-events]')) {
      event.preventDefault();
      state.eventNearbyOnly = false;
      content.innerHTML = renderEvents();
      bindDynamicForms();
      return;
    }
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) {
      event.preventDefault();
      if (routeButton.dataset.route === 'events') state.eventNearbyOnly = false;
      if (routeButton.dataset.route === 'discover') state.discoverFilters.createdToday = false;
      route(routeButton.dataset.route);
      return;
    }
    const profileButton = event.target.closest('[data-open-profile]');
    if (profileButton) {
      openProfile(profileButton.dataset.openProfile);
      return;
    }
    const reactionButton = event.target.closest('[data-reaction-profile]');
    if (reactionButton) {
      event.preventDefault();
      const profileId = reactionButton.dataset.reactionProfile;
      const value = reactionButton.dataset.profileReaction === 'clear'
        ? null
        : Number(reactionButton.dataset.profileReaction);
      reactionButton.disabled = true;
      api('/api/members/engagement', {
        method: 'POST',
        body: JSON.stringify({ action: 'reaction', profileId, reaction: value })
      }).then((result) => {
        state.engagement = {
          views: result.views || [],
          reactions: result.reactions || [],
          streaks: result.streaks || [],
          currentUserId: result.currentUserId,
          currentProfileId: result.currentProfileId
        };
        const profile = list(state.directory.profiles).find((row) => row.id === profileId);
        content.innerHTML = renderProfile(profile, false);
        bindDynamicForms();
        toast(value === null ? 'Ton ressenti a été effacé.' : 'Ton ressenti privé est enregistré.');
      }).catch((error) => {
        toast(errorMessages[error.message] || error.message, true);
        reactionButton.disabled = false;
      });
      return;
    }
    const photoReactionButton = event.target.closest('[data-photo-reaction]');
    if (photoReactionButton) {
      event.preventDefault();
      event.stopPropagation();
      const mediaId = photoReactionButton.dataset.photoId;
      const requestedReaction = photoReactionButton.dataset.photoReaction;
      const current = photoReactionSummary(mediaId);
      const reaction = current.my_reaction === requestedReaction ? null : requestedReaction;
      photoReactionButton.disabled = true;
      api('/api/members/photo-reactions', {
        method: 'POST',
        body: JSON.stringify({ mediaId, reaction })
      }).then((result) => {
        if (!result.summary) throw new Error('photo_reaction_persistence_failed');
        state.photoReactions = [
          result.summary,
          ...list(state.photoReactions).filter((row) => row.media_id !== mediaId)
        ];
        const profile = state.selectedProfileId === state.profile.id
          ? state.profile
          : list(state.directory.profiles).find((row) => row.id === state.selectedProfileId);
        if (profile) {
          content.innerHTML = renderProfile(profile, profile.id === state.profile.id);
          bindDynamicForms();
        }
        toast(reaction ? 'Ta réaction est enregistrée.' : 'Ta réaction est retirée.');
      }).catch((error) => {
        toast(errorMessages[error.message] || error.message, true);
        photoReactionButton.disabled = false;
      });
      return;
    }
    const tabButton = event.target.closest('[data-profile-tab]');
    if (tabButton) {
      state.profileTab = tabButton.dataset.profileTab;
      const profile = state.selectedProfileId === state.profile.id
        ? state.profile
        : list(state.directory.profiles).find((row) => row.id === state.selectedProfileId);
      content.innerHTML = renderProfile(profile, profile?.id === state.profile.id);
      bindDynamicForms();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (event.target.closest('[data-edit-profile]')) {
      state.editing = true;
      content.innerHTML = `<div class="page">${profileForm(state.profile)}</div>`;
      bindProfileForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (event.target.closest('[data-cancel-edit]')) {
      state.editing = false;
      route('me');
      return;
    }
    if (event.target.closest('[data-organizer-request]')) {
      requestOrganizer();
      return;
    }
    if (event.target.closest('[data-couple-invite]')) {
      prepareCoupleInvitation();
      return;
    }
    const messageProfileButton = event.target.closest('[data-message-profile]');
    if (messageProfileButton) {
      startConversation(messageProfileButton.dataset.messageProfile);
      return;
    }
    const favoriteProfileButton = event.target.closest('[data-favorite-profile]');
    if (favoriteProfileButton) {
      const profileId = favoriteProfileButton.dataset.favoriteProfile;
      updateSocialAction(profileId, 'favorite', !state.socialActions[profileId]?.favorite);
      return;
    }
    const blockProfileButton = event.target.closest('[data-block-profile]');
    if (blockProfileButton) {
      updateSocialAction(
        blockProfileButton.dataset.blockProfile,
        'block',
        blockProfileButton.dataset.enabled === 'true'
      );
      return;
    }
    const eventButton = event.target.closest('[data-open-event]');
    if (eventButton) {
      openEvent(eventButton.dataset.openEvent);
      return;
    }
    const venueButton = event.target.closest('[data-open-venue]');
    if (venueButton) {
      openVenue(venueButton.dataset.openVenue, venueButton.dataset.mapVenue === 'true');
      return;
    }
    const venueRelationButton = event.target.closest('[data-venue-relation]');
    if (venueRelationButton) {
      const venueId = venueRelationButton.dataset.venueId;
      const relation = venueRelationButton.dataset.venueRelation;
      const enabled = !venueRelationship(venueId, relation);
      venueRelationButton.disabled = true;
      api('/api/members/venue-relationships', {
        method: 'POST',
        body: JSON.stringify({ venueId, relation, enabled })
      }).then((result) => {
        state.directory.venueRelationships = result.relationships || [];
        openVenue(venueId);
        toast(enabled ? 'Ton choix est enregistré dans ton profil.' : 'Ton choix a été retiré.');
      }).catch((error) => {
        toast(errorMessages[error.message] || error.message, true);
        venueRelationButton.disabled = false;
      });
      return;
    }
    const notificationButton = event.target.closest('[data-open-notification]');
    if (notificationButton) {
      openNotification(notificationButton.dataset.openNotification);
      return;
    }
    if (event.target.closest('[data-read-all-notifications]')) {
      const button = event.target.closest('[data-read-all-notifications]');
      button.disabled = true;
      api('/api/members/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'read_all' })
      }).then((result) => {
        state.notifications = result.notifications || [];
        state.unreadCount = Number(result.unreadCount || 0);
        updateNotificationBadges();
        content.innerHTML = renderNotifications();
        toast('Toutes les notifications sont marquées comme lues.');
      }).catch((error) => {
        toast(errorMessages[error.message] || error.message, true);
        button.disabled = false;
      });
      return;
    }
    const cancelEventButton = event.target.closest('[data-cancel-event]');
    if (cancelEventButton) {
      api('/api/members/event-registrations', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel', eventId: cancelEventButton.dataset.cancelEvent })
      }).then(async () => {
        toast('Ton inscription est annulée.');
        await refreshData();
        return openEvent(cancelEventButton.dataset.cancelEvent);
      }).catch((error) => toast(errorMessages[error.message] || error.message, true));
      return;
    }
    const conversationButton = event.target.closest('[data-open-conversation]');
    if (conversationButton) openConversation(conversationButton.dataset.openConversation);
  });

  async function refreshPresence() {
    if (!state.profile || state.profile.admission_status !== 'approved' || document.hidden) return;
    try {
      const result = await api('/api/members/discovery');
      const previousPresence = { ...state.presence };
      applyDiscoveryState(result);
      if (state.access?.features?.followConnectionAlerts) {
        list(state.following).forEach((profileId) => {
          if (previousPresence[profileId] && previousPresence[profileId] !== 'online' && state.presence[profileId] === 'online') {
            const profile = list(state.directory.profiles).find((row) => row.id === profileId);
            if (profile) toast(`${profile.display_name} vient de se connecter.`);
          }
        });
      }
      document.querySelectorAll('[data-profile-presence]').forEach((badge) => {
        const template = document.createElement('template');
        template.innerHTML = presenceBadge(badge.dataset.profilePresence);
        badge.replaceWith(template.content.firstElementChild);
      });
    } catch {
      // La migration peut ne pas encore être appliquée : l’interface reste utilisable.
    }
  }

  window.setInterval(refreshPresence, 4 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshPresence();
  });

  initializeWebExperience();
  loadAll();
})();
