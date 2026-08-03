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
    billing_provider_not_configured: 'Le paiement sera ouvert après validation définitive de notre partenaire bancaire.'
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
      const profileResult = await api('/api/members/profile');
      state.profile = profileResult.profile;
      state.account = profileResult.account;
      state.access = profileResult.access || state.access;
      state.membership = profileResult.membership;
      state.personalProfileComplete = profileResult.personalProfileComplete;
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
    const profileResult = await api('/api/members/profile');
    state.profile = profileResult.profile;
    state.account = profileResult.account;
    state.access = profileResult.access || state.access;
    state.membership = profileResult.membership;
    state.personalProfileComplete = profileResult.personalProfileComplete;
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
      discoveryStep(nextIndex + 4, 'Tes affinités', 'Vers qui va naturellement ton attirance ?', 'Plusieurs réponses sont possibles. Elles amélioreront les propositions sans jamais présumer de tes envies du moment.', `
        ${multiField('p0_attracted_to', 'Je peux être attiré(e) par', REFERENCES.attractions, ownPerson.attracted_to)}
      `),
      discoveryStep(nextIndex + 5, 'Ton expérience', 'À quel rythme pratiques-tu aujourd’hui ?', 'Une découverte, une pause ou une pratique régulière ne racontent pas la même histoire. Choisis ce qui correspond à ta réalité actuelle.', `
        ${selectField('p0_frequency', 'Fréquence actuelle', REFERENCES.frequencies, ownPerson.frequency)}
      `),
      discoveryStep(nextIndex + 6, 'Tes envies', 'Qu’aimerais-tu vivre pour toi ?', 'Choisis ce qui te ressemble aujourd’hui. Chaque rencontre restera évidemment soumise au dialogue et au consentement du moment.', `
        <div class="form-grid">
          ${multiField('p0_desired_practices', 'Ce que je souhaite vivre', REFERENCES.experiences, ownPerson.desired_practices)}
        </div>
      `),
      discoveryStep(nextIndex + 7, 'Votre équilibre', 'Qu’es-tu à l’aise de laisser vivre à ta moitié ?', 'Cette réponse exprime ton niveau de confort actuel. Elle ne remplace jamais une discussion ni un consentement explicite entre vous.', `
        ${multiField('p0_partner_permissions', 'Ce qui me met à l’aise pour mon/ma partenaire', REFERENCES.experiences, ownPerson.partner_permissions)}
      `, 'data-couple-step '),
      discoveryStep(nextIndex + 8, 'Derrière le profil', 'Si tu devais te présenter librement…', 'Oublions les cases. Raconte-moi ton caractère, ta façon d’aborder les rencontres et ce que les autres devraient comprendre de toi.', `
        ${aiWriterField('p0_biography', 'Ta description personnelle', ownPerson.biography, {
          maxLength: 4000,
          long: true,
          placeholder: 'Ton caractère, ta façon d’aborder les rencontres, ce qui compte pour toi…'
        })}
      `)
    );

    if (!joiningPartner) {
      const commonIndex = nextIndex + 9;
      steps.push(
        discoveryStep(commonIndex, 'L’essentiel', 'Quelle première impression doit donner votre profil ?', 'Imagine les premières lignes de votre page. Elles doivent être sincères, vivantes et donner envie de découvrir la suite.', `
          ${aiWriterField('description', 'Description principale', profile?.description, {
            maxLength: 4000,
            minLength: 20,
            required: true,
            long: true,
            dynamicLabel: true,
            placeholder: 'Décrivez votre énergie, votre complicité et votre façon de rencontrer…'
          })}
        `),
        discoveryStep(commonIndex + 1, 'Votre histoire', 'Raconte-moi votre histoire.', 'C’est ici que le profil prend une âme : ce qui vous unit, votre complicité et les moments qui ont construit votre univers.', `
          ${aiWriterField('story', 'Votre histoire', profile?.story, { maxLength: 8000, long: true })}
        `),
        discoveryStep(commonIndex + 2, 'Votre parcours', 'Comment avez-vous découvert cet univers ?', 'Racontez votre cheminement, vos premières découvertes et la manière dont vos envies ont évolué.', `
          ${aiWriterField('journey', 'Votre parcours', profile?.journey, { maxLength: 4000, long: true })}
        `),
        discoveryStep(commonIndex + 3, 'Vos rencontres', 'Qu’aimeriez-vous trouver sur Velvet ?', 'Parlez-moi des personnes, du type de relation et du feeling que vous espérez rencontrer.', `
          ${aiWriterField('search_text', 'Ce que vous recherchez', profile?.search_text, { maxLength: 4000, long: true })}
        `),
        discoveryStep(commonIndex + 4, 'Votre univers', 'Quelles pratiques font partie de vos envies ?', 'Sélectionnez ce que vous appréciez déjà ou souhaitez réellement explorer ensemble.', `
          ${multiField('practices', 'Nos pratiques et envies communes', REFERENCES.practices, profile?.practices)}
        `),
        discoveryStep(commonIndex + 5, 'Votre philosophie', 'Quelles valeurs doivent guider vos rencontres ?', 'Ces valeurs aideront les autres membres à comprendre immédiatement votre manière de vivre Velvet.', `
          ${multiField('values_list', 'Les valeurs qui comptent pour nous', REFERENCES.values, profile?.values_list)}
        `),
        discoveryStep(commonIndex + 6, 'Votre rythme', 'Quand êtes-vous généralement disponibles ?', 'Ces repères permettront à Velvet de vous proposer des sorties et des profils compatibles avec votre quotidien.', `
          ${multiField('availability', 'Nos disponibilités habituelles', REFERENCES.availability, selectedFromText(profile?.availability_text))}
        `),
        discoveryStep(commonIndex + 7, 'Vos habitudes', 'Quels lieux aimez-vous fréquenter ?', 'Commencez à saisir le nom d’un club ou d’un spa. Vous pourrez compléter cette liste plus tard depuis votre profil.', `
          ${venueField(profile?.favorite_places)}
        `)
      );
    }

    const total = steps.length;
    return `<form id="profileForm" class="form-shell discovery-form" data-discovery data-total-steps="${total}">
      <section class="onboarding discovery-shell">
        <header class="discovery-progress" aria-label="Progression">
          <span class="progress-count"><strong data-progress-current>1</strong><small> sur <span data-progress-total>${total}</span></small></span>
          <div><i data-progress-bar style="width:${Math.max(5, 100 / total)}%"></i></div>
          <span class="progress-label">Création guidée du profil</span>
        </header>
        ${steps.join('')}
        <footer class="discovery-actions">
          <button class="secondary" type="button" data-discovery-back hidden>Retour</button>
          <button class="primary" type="button" data-discovery-next>Continuer</button>
          <button class="primary" type="submit" data-discovery-submit hidden>${joiningPartner ? 'Rejoindre notre profil' : 'Découvrir Velvet'}</button>
        </footer>
        <p id="profileFormStatus" class="status-box" hidden></p>
      </section>
    </form>`;
  }

  function renderOnboarding(profile = null) {
    state.editing = true;
    const joiningPartner = Boolean(profile && !state.personalProfileComplete);
    content.innerHTML = `<div class="page">${(!profile || joiningPartner) ? discoveryProfileForm(profile) : profileForm(profile)}</div>`;
    if (!profile || joiningPartner) bindDiscoveryForm();
    else bindProfileForm();
    content.focus();
  }

  function bindDiscoveryForm() {
    const form = document.querySelector('#profileForm[data-discovery]');
    if (!form) return;
    bindReferenceFields(form);
    const steps = [...form.querySelectorAll('[data-discovery-step]')];
    const back = form.querySelector('[data-discovery-back]');
    const next = form.querySelector('[data-discovery-next]');
    const submit = form.querySelector('[data-discovery-submit]');
    const progress = form.querySelector('[data-progress-current]');
    const progressTotal = form.querySelector('[data-progress-total]');
    const bar = form.querySelector('[data-progress-bar]');
    let current = 0;

    const profileType = () => new FormData(form).get('profile_type') || state.profile?.profile_type || '';
    const activeSteps = () => {
      const couple = profileType() === 'couple';
      return steps.filter((step) => !step.hasAttribute('data-couple-step') || couple);
    };
    const refreshCopy = () => {
      const couple = profileType() === 'couple';
      form.querySelectorAll('[data-couple-only]').forEach((node) => {
        node.hidden = !couple;
        node.querySelectorAll('input,select,textarea').forEach((field) => {
          field.disabled = !couple;
        });
      });
      const nameLabel = form.querySelector('[data-name-label]');
      if (nameLabel) nameLabel.textContent = couple
        ? 'Nom ou pseudonyme du couple'
        : 'Ton prénom ou ton pseudonyme';
      const descriptionLabel = form.querySelector('[data-description-label]');
      if (descriptionLabel) descriptionLabel.textContent = couple
        ? 'Description du couple'
        : 'Ta description principale';
      submit.textContent = couple ? 'Inviter ma moitié' : 'Découvrir Velvet';
    };

    const display = () => {
      const visibleSteps = activeSteps();
      current = Math.min(current, visibleSteps.length - 1);
      steps.forEach((step) => { step.hidden = true; });
      visibleSteps[current].hidden = false;
      back.hidden = current === 0;
      next.hidden = current === visibleSteps.length - 1;
      submit.hidden = current !== visibleSteps.length - 1;
      progress.textContent = String(current + 1);
      progressTotal.textContent = String(visibleSteps.length);
      bar.style.width = `${((current + 1) / visibleSteps.length) * 100}%`;
      refreshCopy();
      const focusable = visibleSteps[current].querySelector('input:not([type=hidden]),select,textarea');
      window.setTimeout(() => focusable?.focus({ preventScroll: true }), 80);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const validateCurrent = () => {
      const step = activeSteps()[current];
      const fields = [...step.querySelectorAll('input,select,textarea')].filter((field) => !field.disabled);
      const radioGroups = new Set(fields.filter((field) => field.type === 'radio').map((field) => field.name));
      for (const group of radioGroups) {
        if (!form.querySelector(`input[name="${group}"]:checked`)) {
          form.querySelector(`input[name="${group}"]`)?.reportValidity();
          return false;
        }
      }
      for (const field of fields) {
        if (!field.checkValidity()) {
          field.reportValidity();
          return false;
        }
      }
      return true;
    };

    form.addEventListener('change', (event) => {
      refreshCopy();
      if (event.target.name === 'profile_type') display();
    });
    next.addEventListener('click', () => {
      if (!validateCurrent()) return;
      current = Math.min(activeSteps().length - 1, current + 1);
      display();
    });
    back.addEventListener('click', () => {
      current = Math.max(0, current - 1);
      display();
    });
    form.addEventListener('submit', (event) => {
      if (!validateCurrent()) {
        event.preventDefault();
        return;
      }
      saveProfile(event);
    });
    display();
  }

  function bindReferenceFields(scope = document) {
    scope.querySelectorAll('[data-multi-choice]').forEach((details) => {
      if (details.dataset.bound) return;
      details.dataset.bound = 'true';
      details.addEventListener('change', () => {
        const count = details.querySelectorAll('input:checked').length;
        details.querySelector('summary').textContent = count
          ? `${count} choix sélectionné${count > 1 ? 's' : ''}`
          : 'Ouvrir la liste';
      });
    });

    scope.querySelectorAll('[data-commune-input]').forEach((input) => {
      if (input.dataset.bound) return;
      input.dataset.bound = 'true';
      const resultsNode = input.closest('.commune-input').querySelector('[data-commune-results]');
      let timer;
      let requestNumber = 0;
      input.addEventListener('input', () => {
        window.clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < 2) {
          resultsNode.hidden = true;
          resultsNode.innerHTML = '';
          return;
        }
        const currentRequest = ++requestNumber;
        timer = window.setTimeout(async () => {
          try {
            const result = await api(`/api/reference/communes?q=${encodeURIComponent(query)}`);
            if (currentRequest !== requestNumber) return;
            resultsNode.innerHTML = list(result.results).length
              ? result.results.map((commune, index) => `<button type="button" role="option" data-commune-index="${index}"><strong>${e(commune.postalCode)}</strong><span>${e(commune.city)}</span><small>Département ${e(commune.departmentCode)}</small></button>`).join('')
              : '<p>Aucune commune trouvée.</p>';
            resultsNode.hidden = false;
            resultsNode.querySelectorAll('[data-commune-index]').forEach((button) => {
              button.addEventListener('click', () => {
                const commune = result.results[Number(button.dataset.communeIndex)];
                input.value = commune.label;
                resultsNode.hidden = true;
                resultsNode.innerHTML = '';
              });
            });
          } catch {
            resultsNode.innerHTML = '<p>Référentiel momentanément indisponible.</p>';
            resultsNode.hidden = false;
          }
        }, 260);
      });
      input.addEventListener('blur', () => window.setTimeout(() => {
        resultsNode.hidden = true;
      }, 180));
    });
    bindVenueFields(scope);
    bindAiWriters(scope);
  }

  function bindVenueFields(scope = document) {
    scope.querySelectorAll('[data-venue-field]').forEach((field) => {
      if (field.dataset.bound) return;
      field.dataset.bound = 'true';
      const input = field.querySelector('[data-venue-input]');
      const results = field.querySelector('[data-venue-results]');
      const selectedNode = field.querySelector('[data-selected-venues]');
      let timer;
      let venues = [];

      const selectedNames = () => [...field.querySelectorAll('input[name=favorite_places]')].map((node) => node.value);
      const addVenue = (venue) => {
        if (selectedNames().some((name) => name.toLocaleLowerCase('fr') === venue.name.toLocaleLowerCase('fr'))) return;
        const item = document.createElement('span');
        item.className = 'selected-venue';
        item.innerHTML = `<span>${e(venue.name)}</span><button type="button" aria-label="Retirer ${e(venue.name)}">×</button><input type="hidden" name="favorite_places" value="${e(venue.name)}">`;
        item.querySelector('button').addEventListener('click', () => item.remove());
        selectedNode.appendChild(item);
        input.value = '';
        results.hidden = true;
      };
      field.querySelectorAll('[data-remove-venue]').forEach((button) => {
        button.addEventListener('click', () => button.closest('.selected-venue').remove());
      });
      input.addEventListener('input', () => {
        window.clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < 2) {
          results.hidden = true;
          return;
        }
        timer = window.setTimeout(async () => {
          try {
            const response = await api(`/api/reference/venues?q=${encodeURIComponent(query)}`);
            venues = list(response.results);
            results.innerHTML = venues.length
              ? `${venues.map((venue, index) => `<button type="button" data-venue-index="${index}"><strong>${e(venue.name)}</strong><span>${e([venue.city,venue.country_code].filter(Boolean).join(' · '))}</span><small>${e(venue.kind)}</small></button>`).join('')}<p>${e(response.attribution || '')}</p>`
              : '<p>Aucun établissement vérifié ne correspond. Le référencement sera enrichi progressivement.</p>';
            results.hidden = false;
            results.querySelectorAll('[data-venue-index]').forEach((button) => {
              button.addEventListener('click', () => addVenue(venues[Number(button.dataset.venueIndex)]));
            });
          } catch {
            results.innerHTML = '<p>Référentiel momentanément indisponible.</p>';
            results.hidden = false;
          }
        }, 260);
      });
      input.addEventListener('blur', () => window.setTimeout(() => {
        results.hidden = true;
      }, 180));
    });
  }

  function bindProfileForm() {
    const form = document.querySelector('#profileForm');
    const type = document.querySelector('#profileType');
    if (!form || !type) return;
    bindReferenceFields(form);
    type.addEventListener('change', () => {
      const people = profilePeople(state.profile);
      const ownPerson = people.find((person) => person.linked_user_id === state.account?.userId) || {};
      document.querySelector('#peopleForms').innerHTML = personForm(0, ownPerson, type.value === 'couple');
      bindReferenceFields(document.querySelector('#peopleForms'));
    });
    form.addEventListener('submit', saveProfile);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type=submit]');
    const status = document.querySelector('#profileFormStatus');
    const data = new FormData(form);
    const profileType = data.get('profile_type');
    const person = {
      first_name: data.get('p0_first_name'),
      gender_identity: data.get('p0_gender_identity'),
      birth_year: data.get('p0_birth_year'),
      height_cm: data.get('p0_height_cm'),
      weight_kg: data.get('p0_weight_kg'),
      morphology: data.get('p0_morphology'),
      hair_color: data.get('p0_hair_color'),
      eye_color: data.get('p0_eye_color'),
      children_status: data.get('p0_children_status'),
      profession: data.get('p0_profession'),
      profession_private: data.has('p0_profession_private'),
      orientation: data.get('p0_orientation'),
      frequency: data.get('p0_frequency'),
      biography: data.get('p0_biography'),
      attracted_to: data.getAll('p0_attracted_to'),
      desired_practices: data.getAll('p0_desired_practices'),
      partner_permissions: data.getAll('p0_partner_permissions')
    };
    const payload = {
      profile_type: profileType,
      display_name: data.get('display_name'),
      city: data.get('city'),
      location_zone: data.get('location_zone'),
      relationship_since: data.get('relationship_since'),
      availability_text: data.getAll('availability').join(' · '),
      description: data.get('description'),
      story: data.get('story'),
      journey: data.get('journey'),
      search_text: data.get('search_text'),
      practices: data.getAll('practices'),
      values_list: data.getAll('values_list'),
      favorite_places: data.getAll('favorite_places'),
      person
    };
    button.disabled = true;
    status.hidden = false;
    status.textContent = 'Enregistrement sécurisé dans Supabase…';
    try {
      const firstPublication = !state.profile;
      const result = await api('/api/members/profile', { method: 'POST', body: JSON.stringify(payload) });
      state.profile = result.profile;
      await refreshData();
      state.editing = false;
      toast('Profil enregistré dans la mémoire Velvet.');
      if (firstPublication && profileType === 'couple') {
        prepareCoupleInvitation(true);
      } else if (state.profile?.admission_status !== 'approved') {
        renderAdmission();
      } else {
        route('me');
      }
    } catch (error) {
      status.textContent = errorMessages[error.message] || `Enregistrement impossible : ${error.message}`;
      toast(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  function admissionLabel(status) {
    return ({
      profile_pending: 'Profil à compléter',
      partner_required: 'Partenaire attendu',
      photos_required: 'Photos à compléter',
      ai_review: 'Analyse en cours',
      changes_required: 'Photos à remplacer',
      approved: 'Admission validée',
      suspended: 'Admission suspendue'
    })[status] || 'Admission en cours';
  }

  function photoStatus(photo) {
    if (photo.moderation_status === 'approved') return '<span class="photo-state approved">Validée par Velvet Intelligence</span>';
    if (photo.moderation_status === 'rejected') return `<span class="photo-state rejected">À remplacer</span><small>${e(photo.rejection_reason || photo.ai_assessment?.summary || 'Les critères ne sont pas remplis.')}</small>`;
    return `<span class="photo-state pending">Analyse ou contrôle en cours</span><small>${e(photo.ai_assessment?.summary || 'La photo reste privée pendant le contrôle.')}</small>`;
  }

  function admissionPhotoCard(photo) {
    return `<article class="admission-photo">
      <div class="admission-photo-preview">${photo.previewUrl ? `<img src="${e(photo.previewUrl)}" alt="">` : '<span>Photo privée</span>'}</div>
      <div>${photoStatus(photo)}</div>
      ${photo.owner_user_id === state.account?.userId ? `<button class="text-button" type="button" data-delete-photo="${e(photo.id)}">Supprimer</button>` : '<small>Publiée par ton/ta partenaire</small>'}
    </article>`;
  }

  function renderAdmission() {
    lockApplication();
    const profile = state.profile;
    if (!profile) return renderOnboarding();
    const people = profilePeople(profile);
    const ownPerson = people.find((person) => person.linked_user_id === state.account?.userId);
    const galleryRole = profile.profile_type === 'couple' ? 'couple_gallery' : 'individual_gallery';
    const gallery = state.photos.filter((photo) => photo.media_role === galleryRole);
    const portraits = state.photos.filter((photo) => photo.media_role === 'individual_portrait');
    const approvedGallery = gallery.filter((photo) => photo.moderation_status === 'approved').length;
    const approvedPortraits = new Set(
      portraits.filter((photo) => photo.moderation_status === 'approved').map((photo) => photo.individual_profile_id)
    ).size;
    const requiredPeople = profile.profile_type === 'couple' ? 2 : 1;
    const requiredPortraits = profile.profile_type === 'couple' ? 2 : 0;
    const partnerMissing = profile.profile_type === 'couple' && people.length < 2;
    const canInvite = partnerMissing && state.membership?.member_slot === 'partner_a';

    content.innerHTML = `<div class="page admission-page">
      <header class="admission-brand">
        <span class="brand-mark">V</span><span><strong>Velvet</strong><small>SAS D’ADMISSION</small></span>
        <button class="text-button" id="admissionLogout" type="button">Se déconnecter</button>
      </header>
      ${pageHead(
        'Authenticité · confiance · discrétion',
        'Finalisons votre admission.',
        'La navigation reste volontairement inaccessible tant que les photos publiques obligatoires ne sont pas validées.'
      )}
      <section class="admission-progress">
        <article class="card"><small>Profil</small><strong>✓</strong><span>Informations enregistrées</span></article>
        <article class="card"><small>Fiche partagée</small><strong>${profile.profile_type === 'couple' ? `${people.length}/2` : '1/1'}</strong><span>${partnerMissing ? 'Partenaire à rattacher' : 'Personne(s) rattachée(s)'}</span></article>
        <article class="card"><small>Galerie publique</small><strong>${approvedGallery}/3</strong><span>Photos validées</span></article>
        <article class="card"><small>${profile.profile_type === 'couple' ? 'Portraits' : 'Netteté'}</small><strong>${profile.profile_type === 'couple' ? `${approvedPortraits}/${requiredPortraits}` : 'IA'}</strong><span>${profile.profile_type === 'couple' ? 'Fiches personnelles' : 'Contrôle des 3 photos'}</span></article>
      </section>
      <section class="card admission-status">
        <div><p class="eyebrow">État actuel</p><h2>${e(admissionLabel(profile.admission_status))}</h2></div>
        <span class="pill ${profile.admission_status === 'approved' ? 'gold' : ''}">${e(profile.admission_status)}</span>
      </section>
      ${canInvite ? `<section class="card admission-partner">
        <div><p class="eyebrow">Profil couple</p><h2>Ton ou ta partenaire doit compléter sa fiche.</h2><p>Le couple ne sera admis qu’après son inscription et la validation de son portrait individuel.</p></div>
        <button class="primary" data-couple-invite>Créer ou renouveler son invitation</button>
      </section>` : ''}
      <section class="admission-grid ${profile.profile_type === 'couple' ? '' : 'single'}">
        <article class="card">
          <p class="eyebrow">${profile.profile_type === 'couple' ? 'Photos du couple' : 'Photos du profil'}</p>
          <h2>3 photos publiques obligatoires</h2>
          <p>${profile.profile_type === 'couple' ? 'Vous devez être visibles tous les deux' : 'Tu dois être clairement visible'}, avec le visage et au minimum la moitié du corps, sans brouillage excessif.</p>
          <form class="photo-upload-form" data-photo-role="${galleryRole}">
            <label class="photo-drop">${gallery.length < 3 ? `Ajouter au moins ${3 - gallery.length} photo(s)` : 'Ajouter des photos au carrousel'}
              <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required>
            </label>
            <button class="primary" type="submit">Ajouter et analyser</button>
            <p class="photo-upload-status" role="status"></p>
          </form>
          <div class="admission-photos">${gallery.length ? gallery.map(admissionPhotoCard).join('') : '<p class="muted">Aucune photo transmise.</p>'}</div>
        </article>
        ${profile.profile_type === 'couple' ? `<article class="card">
          <p class="eyebrow">Ta fiche personnelle</p>
          <h2>1 portrait individuel obligatoire</h2>
          <p>Cette photo doit te montrer seul(e), visage visible et cadrage à mi-corps minimum. Chaque partenaire publie uniquement son propre portrait.</p>
          ${ownPerson ? `<form class="photo-upload-form" data-photo-role="individual_portrait" data-individual-profile="${e(ownPerson.id)}">
            <label class="photo-drop">${portraits.some((photo) => photo.individual_profile_id === ownPerson.id) ? 'Ajouter une photo individuelle' : 'Choisir mon premier portrait'}
              <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" required>
            </label>
            <button class="primary" type="submit">Ajouter et analyser</button>
            <p class="photo-upload-status" role="status"></p>
          </form>` : '<p class="status-box">Complète d’abord ta fiche personnelle.</p>'}
          <div class="admission-photos">${portraits.length ? portraits.map(admissionPhotoCard).join('') : '<p class="muted">Aucun portrait transmis.</p>'}</div>
        </article>` : ''}
      </section>
      <section class="card ai-notice">
        <p class="eyebrow">Velvet Intelligence</p>
        <h2>Ce qui est analysé — et ce qui ne l’est pas</h2>
        <p>L’analyse vérifie le nombre de personnes, le cadrage au minimum à mi-corps, la visibilité et la netteté suffisante. Elle n’identifie personne, ne compare aucun visage et ne crée aucun gabarit biométrique. Une décision incertaine est transmise à un contrôle humain.</p>
        <p>Les photos restent privées et inaccessibles aux autres membres tant qu’elles ne sont pas approuvées.</p>
      </section>
      <section class="community-teaser" aria-label="Aperçu verrouillé">
        <p class="eyebrow">Après validation</p><h2>La communauté Velvet se dévoilera ici.</h2>
        <div class="blurred-community">${[1,2,3].map(() => '<article><span></span><strong>Profil protégé</strong><small>Contact verrouillé</small></article>').join('')}</div>
      </section>
    </div>`;
    bindAdmission();
  }

  async function optimizePhoto(file) {
    if (!file.type.startsWith('image/')) throw new Error('invalid_photo_file');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob || blob.size > 4 * 1024 * 1024) throw new Error('invalid_photo_file');
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  }

  function bindAdmission() {
    document.querySelector('#admissionLogout')?.addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
      window.location.href = '/';
    });
    document.querySelectorAll('.photo-upload-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        const status = form.querySelector('.photo-upload-status');
        const files = [...form.querySelector('input[type=file]').files].slice(0, 3);
        button.disabled = true;
        try {
          for (let index = 0; index < files.length; index += 1) {
            status.textContent = `Préparation et analyse ${index + 1}/${files.length}…`;
            const photo = await optimizePhoto(files[index]);
            const body = new FormData();
            body.set('photo', photo);
            body.set('mediaRole', form.dataset.photoRole);
            if (form.dataset.individualProfile) {
              body.set('individualProfileId', form.dataset.individualProfile);
            }
            await api('/api/members/photos', { method: 'POST', body });
          }
          await loadAll();
        } catch (error) {
          status.textContent = errorMessages[error.message] || error.message;
          button.disabled = false;
        }
      });
    });
    document.querySelectorAll('[data-delete-photo]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await api(`/api/members/photos?id=${encodeURIComponent(button.dataset.deletePhoto)}`, { method: 'DELETE' });
          await loadAll();
        } catch (error) {
          toast(error.message, true);
          button.disabled = false;
        }
      });
    });
  }

  function parisDayKey(value = new Date()) {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));
  }

  function profileAudienceLabel(profile) {
    const type = discoverProfileType(profile);
    return ({ couple: 'Couples', woman: 'Femmes', man: 'Hommes', other: 'Personnes non binaires' })[type] || '';
  }

  function profileMatchesOwnPreferences(profile) {
    const preferences = new Set(profilePeople(state.profile).flatMap((person) => list(person.attracted_to)));
    if (!preferences.size || preferences.has('Selon le feeling') || preferences.has('Information privée')) return true;
    return preferences.has(profileAudienceLabel(profile));
  }

  function nearbyHomeEvents(radiusKm = 50) {
    if (state.mapData?.center?.source !== 'private_approximate_location') return [];
    const eventsById = new Map(list(state.directory.events).map((event) => [event.id, event]));
    return list(state.mapData?.events)
      .map((marker) => {
        const event = eventsById.get(marker.id);
        if (!event) return null;
        return {
          ...event,
          distance_km: Math.round(mapDistanceKm(state.mapData.center, marker)),
          mapMarker: marker
        };
      })
      .filter((event) => event && event.distance_km <= radiusKm)
      .sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
  }

  function homeFeedItems() {
    const locationEnabled = state.mapData?.center?.source === 'private_approximate_location';
    const profiles = list(state.directory.profiles)
      .filter((profile) => profile.id !== state.profile.id)
      .filter((profile) => state.following.includes(profile.id) || profileMatchesOwnPreferences(profile))
      .filter((profile) => state.following.includes(profile.id) || !locationEnabled || (profileDistance(profile) ?? Infinity) <= 50);
    const profileItems = profiles.map((profile) => {
      const createdAt = new Date(profile.created_at || 0);
      const updatedAt = new Date(profile.updated_at || profile.created_at || 0);
      const photo = approvedProfilePhotos(profile)
        .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))[0];
      const photoAt = new Date(photo?.created_at || 0);
      if (photo && photoAt > new Date(createdAt.getTime() + 60 * 60 * 1000)) {
        return {
          id: `photo-${photo.id}`,
          type: 'photo',
          date: photo.created_at,
          profile,
          photo
        };
      }
      return {
        id: `profile-${profile.id}`,
        type: 'profile',
        date: updatedAt > new Date(createdAt.getTime() + 12 * 60 * 60 * 1000)
          ? profile.updated_at
          : profile.created_at,
        activity: updatedAt > new Date(createdAt.getTime() + 12 * 60 * 60 * 1000)
          ? `${profile.display_name} a enrichi son profil`
          : `${profile.display_name} vient de rejoindre Velvet`,
        profile
      };
    });
    const eventItems = nearbyHomeEvents(50).map((event) => ({
      id: `event-${event.id}`,
      type: 'event',
      date: event.created_at || event.updated_at || event.starts_at,
      event
    }));
    const followedPlans = [
      ...list(state.plans.travelPlans).filter((plan) => plan.profile_id !== state.profile.id).map((plan) => ({
        id: `travel-${plan.id}`,
        type: 'plan',
        date: plan.created_at,
        profile: list(state.directory.profiles).find((profile) => profile.id === plan.profile_id),
        title: plan.title,
        detail: `${plan.location_label} · du ${dateLabel(plan.starts_on)} au ${dateLabel(plan.ends_on)}`
      })),
      ...list(state.plans.venueVisits).filter((plan) => plan.profile_id !== state.profile.id).map((plan) => ({
        id: `visit-${plan.id}`,
        type: 'plan',
        date: plan.created_at,
        profile: list(state.directory.profiles).find((profile) => profile.id === plan.profile_id),
        title: plan.venue_directory?.name || 'Sortie annoncée',
        detail: dateLabel(plan.visit_date)
      })),
      ...list(state.plans.eventPlans).filter((plan) => plan.profile_id !== state.profile.id).map((plan) => {
        const event = list(state.directory.events).find((row) => row.id === plan.event_id);
        return {
          id: `event-plan-${plan.profile_id}-${plan.event_id}`,
          type: 'plan',
          date: plan.created_at,
          profile: list(state.directory.profiles).find((profile) => profile.id === plan.profile_id),
          title: event?.title || 'Événement Velvet',
          detail: event ? new Date(event.starts_at).toLocaleString('fr-FR') : plan.registration_status
        };
      })
    ].filter((item) => item.profile);
    return [...profileItems, ...eventItems, ...followedPlans]
      .filter((item) => item.date)
      .sort((left, right) => new Date(right.date) - new Date(left.date))
      .slice(0, 30);
  }

  function homeFeedItem(item) {
    if (item.type === 'plan') {
      return `<article class="card home-feed-card event-feed-card">
        <header><span class="feed-icon event">⌖</span><div><strong>${e(item.profile.display_name)} a annoncé une sortie</strong><small>${e(viewedAtLabel(item.date))}</small></div></header>
        <button type="button" class="feed-event" data-open-profile="${e(item.profile.id)}"><span><b>${e(item.title)}</b><small>${e(item.detail)}</small></span><i>→</i></button>
      </article>`;
    }
    if (item.type === 'event') {
      const event = item.event;
      return `<article class="card home-feed-card event-feed-card">
        <header><span class="feed-icon event">✦</span><div><strong>Événement près de chez toi</strong><small>${e(viewedAtLabel(item.date))}</small></div></header>
        <button type="button" class="feed-event" data-open-event="${e(event.id)}">
          <span><b>${e(event.title)}</b><small>${e(event.location_public || 'Lieu communiqué aux inscrits')} · ${e(event.distance_km)} km</small></span><i>→</i>
        </button>
      </article>`;
    }
    const profile = item.profile;
    const cover = approvedProfilePhotos(profile)[0];
    if (item.type === 'photo') {
      return `<article class="card home-feed-card photo-feed-card">
        <header><span class="feed-avatar">${cover ? `<img src="${e(cover.previewUrl)}" alt="">` : e(initials(profile.display_name))}</span><div><strong>${e(profile.display_name)} a publié une nouvelle photo</strong><small>${e(viewedAtLabel(item.date))}</small></div></header>
        <button type="button" class="feed-photo" data-open-profile="${e(profile.id)}"><img src="${e(item.photo.previewUrl)}" alt="Nouvelle photo publique de ${e(profile.display_name)}"></button>
      </article>`;
    }
    return `<article class="card home-feed-card profile-feed-card">
      <header><span class="feed-avatar">${cover ? `<img src="${e(cover.previewUrl)}" alt="">` : e(initials(profile.display_name))}</span><div><strong>${e(item.activity || `${profile.display_name} vient de rejoindre Velvet`)}</strong><small>${e(viewedAtLabel(item.date))}</small></div></header>
      <div class="home-profile-preview">${profilePreviewCard(profile, { variant: 'feed' })}</div>
    </article>`;
  }

  function homeDiscoveryProfiles() {
    const rows = list(state.directory.profiles).filter((profile) => profile.id !== state.profile.id);
    const byId = new Map(rows.map((profile) => [profile.id, profile]));
    const recommended = list(state.directory.recommendations)
      .filter((item) => item.target_type === 'profile')
      .map((item) => byId.get(item.target_id))
      .filter(Boolean);
    const latest = [...rows].sort((left, right) =>
      new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0)
    );
    return [...new Map([...recommended, ...latest].map((profile) => [profile.id, profile])).values()].slice(0, 12);
  }

  function homeDiscoveryCard(profile) {
    const cover = approvedProfilePhotos(profile)[0];
    const identity = profilePreviewIdentity(profile);
    return `<button class="home-discovery-card" type="button" data-open-profile="${e(profile.id)}">
      <span class="home-discovery-media">
        ${cover ? `<img src="${e(cover.previewUrl)}" alt="Photo de profil de ${e(profile.display_name)}">` : `<b>${e(initials(profile.display_name))}</b>`}
        <i class="profile-preview-presence ${(state.presence[profile.id] || 'offline') === 'online' ? 'green' : (state.presence[profile.id] || 'offline') === 'today' ? 'orange' : 'red'}" aria-hidden="true"></i>
      </span>
      <span class="home-discovery-copy"><strong>${e(profile.display_name)}</strong><small>${e(identity.label)} · ${e(profileAges(profile))}</small><em>${e(profile.location_zone || 'Zone privée')}</em></span>
    </button>`;
  }

  function renderHome() {
    const own = state.profile;
    const feed = homeFeedItems();
    const discoveries = homeDiscoveryProfiles();
    const locationEnabled = state.mapData?.center?.source === 'private_approximate_location';
    return `<div class="page home-page">
      <header class="ios-home-header">
        <p class="eyebrow">Bonjour ${e(own.display_name)}</p>
        <h1>Actualité</h1>
        <p>Les personnes, leurs nouvelles photos et les sorties qui prennent vie autour de vous.</p>
      </header>
      <section class="home-discovery-section">
        <header class="section-heading"><div><p class="eyebrow">À découvrir</p><h2>Les profils qui comptent</h2></div><button class="text-button" type="button" data-route="discover">Tout voir</button></header>
        ${discoveries.length
          ? `<div class="home-discovery-rail">${discoveries.map(homeDiscoveryCard).join('')}</div>`
          : emptyState('La sélection se prépare', 'Les nouveaux profils apparaîtront ici.', '◇')}
      </section>
      <section class="home-feed">
        <header class="section-heading"><div><p class="eyebrow">Fil communautaire</p><h2>Ce qui se passe maintenant</h2></div></header>
        ${feed.length
          ? `<div class="home-feed-list">${feed.map(homeFeedItem).join('')}</div>`
          : emptyState(
              'Le fil va prendre vie',
              locationEnabled
                ? 'Les nouveaux profils, photos publiques et événements correspondant à vos préférences apparaîtront ici.'
                : 'Activez votre zone pour ajouter les événements situés à moins de 50 km à votre actualité.',
              'V',
              locationEnabled ? '' : '<button class="secondary" type="button" data-enable-location>Activer ma zone</button>'
            )}
      </section>
    </div>`;
  }

  function profileViewMemory(profileId) {
    return list(state.engagement?.views).find((row) => row.viewed_profile_id === profileId) || null;
  }

  function profileReactions(profileId) {
    return list(state.engagement?.reactions).filter((row) => row.target_profile_id === profileId);
  }

  function reactionDetails(value) {
    return ({
      '-1': { icon: '🧊', label: 'Pas pour moi', tone: 'cold' },
      1: { icon: '🔥', label: 'J’aime bien', tone: 'warm' },
      2: { icon: '🔥🔥', label: 'J’adore', tone: 'hot' },
      3: { icon: '🔥🔥🔥', label: 'C’est canon', tone: 'blazing' }
    })[String(value)] || { icon: '◇', label: 'Pas encore d’avis', tone: 'neutral' };
  }

  function viewedAtLabel(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  function seenBadge(profileId) {
    const memory = profileViewMemory(profileId);
    if (!memory) return '';
    return `<span class="seen-badge" role="button" tabindex="0" data-view-info="${e(profileId)}" aria-label="Voir la dernière consultation">
      <span>✓</span> Déjà vu
    </span>`;
  }

  function profileAges(profile) {
    const values = profilePeople(profile)
      .map((person) => person.birth_year ? new Date().getFullYear() - Number(person.birth_year) : null)
      .filter(Number.isFinite);
    if (!values.length) return 'Âge non renseigné';
    return `${values.join(profile.profile_type === 'couple' ? ' et ' : '')} an${values.length === 1 && values[0] === 1 ? '' : 's'}`;
  }

  function presenceBadge(profileId) {
    const status = state.presence[profileId] || 'offline';
    const details = {
      online: ['En ligne', 'green'],
      today: ['Connecté aujourd’hui', 'orange'],
      offline: ['Pas de connexion aujourd’hui', 'red']
    }[status] || ['Pas de connexion aujourd’hui', 'red'];
    return `<span class="presence-badge ${details[1]}" data-profile-presence="${e(profileId)}"><i aria-hidden="true"></i>${details[0]}</span>`;
  }

  function profilePreviewIdentity(profile) {
    const type = discoverProfileType(profile);
    return {
      label: ({
        couple: 'Couple',
        woman: 'Femme seule',
        man: 'Homme seul',
        other: 'Profil individuel'
      })[type] || 'Profil Velvet',
      icon: ({
        couple: '⚭',
        woman: '♀',
        man: '♂',
        other: '◇'
      })[type] || '◇'
    };
  }

  function profilePreviewCard(profile, {
    variant = 'grid',
    showSeen = false,
    summary = false,
    followed = false,
    notification = null
  } = {}) {
    if (!profile) return '';
    const cover = approvedProfilePhotos(profile)[0];
    const identity = profilePreviewIdentity(profile);
    const status = state.presence[profile.id] || 'offline';
    const presence = {
      online: ['En ligne', 'green'],
      today: ['Connecté aujourd’hui', 'orange'],
      offline: ['Pas de connexion aujourd’hui', 'red']
    }[status] || ['Pas de connexion aujourd’hui', 'red'];
    const action = notification
      ? `data-open-notification="${e(notification.id)}"`
      : `data-open-profile="${e(profile.id)}"`;
    const context = notification ? `<span class="profile-preview-context">
      <small>${e(viewedAtLabel(notification.created_at))}</small>
      <b>${e(notification.title)}</b>
      <em>${e(notification.body || '')}</em>
    </span>` : '';
    return `<button class="profile-preview-card preview-${e(variant)} ${notification && !notification.read_at ? 'unread' : ''}" type="button" ${action}>
      <span class="profile-preview-head">
        <span class="profile-preview-kind" aria-label="${e(identity.label)}">${identity.icon}</span>
        <strong>${e(profile.display_name)}</strong>
        <i class="profile-preview-presence ${presence[1]}" title="${e(presence[0])}" aria-label="${e(presence[0])}"></i>
      </span>
      <span class="profile-preview-media">
        ${cover ? `<img src="${e(cover.previewUrl)}" alt="Photo de profil de ${e(profile.display_name)}">` : `<b>${e(initials(profile.display_name))}</b>`}
        ${showSeen ? seenBadge(profile.id) : ''}
        ${followed ? '<small class="profile-preview-followed">Suivi</small>' : ''}
      </span>
      <span class="profile-preview-details">
        <b>${e(identity.label)} · ${e(profileAges(profile))}</b>
        <em>⌖ ${e(profile.location_zone || 'Ville non renseignée')}</em>
        ${summary ? `<small>${e(profile.description || profile.search_text || 'Présentation à compléter.')}</small>` : ''}
      </span>
      ${context}
      ${notification && !notification.read_at ? '<span class="profile-preview-unread">Nouveau</span>' : ''}
    </button>`;
  }

  function memberTile(profile) {
    return profilePreviewCard(profile, { variant: 'grid', showSeen: true });
  }

  function discoverGridTile(profile) {
    return profilePreviewCard(profile, {
      variant: 'grid',
      showSeen: true,
      followed: state.following.includes(profile.id)
    });
  }

  function discoverHorizontalTile(profile) {
    return profilePreviewCard(profile, {
      variant: 'horizontal',
      showSeen: true,
      summary: true,
      followed: state.following.includes(profile.id)
    });
  }

  function profileEngagementPanel(profile, own) {
    if (own) return '';
    const memory = profileViewMemory(profile.id);
    const reactions = profileReactions(profile.id);
    const mine = reactions.find((row) => row.reactor_user_id === state.engagement?.currentUserId);
    const others = reactions.filter((row) => row.reactor_user_id !== state.engagement?.currentUserId);
    const myReaction = reactionDetails(mine?.reaction);
    const positive = reactions.filter((row) => row.reaction > 0);
    const consensus = reactions.length < 2
      ? 'Ta moitié n’a pas encore donné son ressenti.'
      : positive.length === reactions.length
        ? `Vous êtes tous les deux séduits par ce profil.`
        : positive.length === 0
          ? 'Vos ressentis vont dans la même direction.'
          : 'Vos premières impressions sont différentes — à vous d’en parler.';
    return `<section class="profile-engagement-panel">
      <article class="memory-card">
        <span class="memory-icon">✓</span>
        <div><small>Votre mémoire Velvet</small><strong>${memory ? `Consulté ${memory.view_count} fois` : 'Première découverte'}</strong>
        <p>${memory ? `Dernière visite : ${e(viewedAtLabel(memory.last_viewed_at))}` : 'Cette visite sera ajoutée à votre historique privé.'}</p></div>
      </article>
      <article class="reaction-card">
        <header><div><small>Ton ressenti privé</small><strong>${e(myReaction.label)}</strong></div><span class="reaction-current ${e(myReaction.tone)}">${myReaction.icon}</span></header>
        <div class="reaction-picker" role="group" aria-label="Donner mon ressenti">
          ${[-1,1,2,3].map((value) => {
            const detail = reactionDetails(value);
            return `<button type="button" class="${mine?.reaction === value ? 'active' : ''}" data-reaction-profile="${e(profile.id)}" data-profile-reaction="${value}" title="${e(detail.label)}"><span>${detail.icon}</span><small>${e(detail.label)}</small></button>`;
          }).join('')}
        </div>
        ${mine ? `<button class="text-button clear-reaction" type="button" data-reaction-profile="${e(profile.id)}" data-profile-reaction="clear">Effacer mon ressenti</button>` : ''}
        ${state.profile?.profile_type === 'couple' ? `<div class="couple-reaction">
          <p class="eyebrow">Le regard du couple</p>
          <div>${reactions.map((row) => {
            const detail = reactionDetails(row.reaction);
            return `<span><strong>${e(row.reactor_name || 'Partenaire')}</strong><b>${detail.icon}</b><small>${e(detail.label)}</small></span>`;
          }).join('') || '<small>Donne ton premier ressenti.</small>'}</div>
          <p>${e(consensus)}</p>
        </div>` : ''}
        <p class="privacy-note">Ce ressenti reste invisible pour le profil consulté. Il sert à votre comparaison et, plus tard, aux recommandations privées de Velvet Intelligence.</p>
      </article>
    </section>`;
  }

  function discoverProfileType(profile) {
    if (profile.profile_type === 'couple') return 'couple';
    const identity = String(profilePeople(profile)[0]?.gender_identity || '').toLocaleLowerCase('fr');
    if (identity === 'homme' || identity === 'homme trans') return 'man';
    if (identity === 'femme' || identity === 'femme trans') return 'woman';
    return 'other';
  }

  function discoverChoices(name, choices, selected, formatter = (value) => value) {
    const selectedValues = new Set(list(selected));
    return `<div class="discover-choice-list">${choices.map((value) => `
      <label class="discover-choice">
        <input type="checkbox" name="${e(name)}" value="${e(value)}"${selectedValues.has(value) ? ' checked' : ''}>
        <span><i aria-hidden="true"></i>${e(formatter(value))}</span>
      </label>`).join('')}</div>`;
  }

  function ageForPerson(person) {
    return person?.birth_year ? new Date().getFullYear() - Number(person.birth_year) : null;
  }

  function personGenderGroup(person) {
    const identity = String(person?.gender_identity || '').toLocaleLowerCase('fr');
    if (identity.includes('femme')) return 'woman';
    if (identity.includes('homme')) return 'man';
    return 'other';
  }

  function profileMatchesAge(profile, group, minimum, maximum) {
    const constrained = Number(minimum) > 18 || Number(maximum) < 99;
    if (!constrained) return true;
    const ages = profilePeople(profile)
      .filter((person) => personGenderGroup(person) === group)
      .map(ageForPerson)
      .filter(Number.isFinite);
    return ages.length > 0 && ages.some((value) => value >= Number(minimum) && value <= Number(maximum));
  }

  function profileDistance(profile) {
    if (state.mapData?.center?.source !== 'private_approximate_location') return null;
    const marker = list(state.mapData.members).find((item) => item.id === profile.id);
    return marker ? mapDistanceKm(state.mapData.center, marker) : null;
  }

  function candidateSeeking(profile) {
    return new Set(profilePeople(profile).flatMap((person) => list(person.attracted_to)));
  }

  function filteredDiscoverProfiles() {
    const filters = state.discoverFilters;
    const query = filters.query.toLocaleLowerCase('fr').trim();
    const city = filters.city.toLocaleLowerCase('fr').trim();
    const recommendationIds = new Set(list(state.directory.recommendations)
      .filter((item) => item.target_type === 'profile')
      .map((item) => item.target_id));
    return list(state.directory.profiles)
      .filter((profile) => profile.id !== state.profile.id)
      .filter((profile) => !filters.types.length || filters.types.includes(discoverProfileType(profile)))
      .filter((profile) => {
        if (!filters.seeking.length) return true;
        const seeking = candidateSeeking(profile);
        return filters.seeking.every((value) => seeking.has(value));
      })
      .filter((profile) => !city || String(profile.location_zone || '').toLocaleLowerCase('fr').includes(city))
      .filter((profile) => !filters.nearMe || (profileDistance(profile) ?? Infinity) <= 50)
      .filter((profile) => profileMatchesAge(profile, 'man', filters.maleAgeMin, filters.maleAgeMax))
      .filter((profile) => profileMatchesAge(profile, 'woman', filters.femaleAgeMin, filters.femaleAgeMax))
      .filter((profile) => filters.practices.every((practice) => list(profile.practices).includes(practice)))
      .filter((profile) => !filters.morphologies.length || filters.morphologies.some((morphology) =>
        profilePeople(profile).some((person) => person.morphology === morphology)
      ))
      .filter((profile) => !filters.onlineOnly || state.presence[profile.id] === 'online')
      .filter((profile) => !filters.withPhotos || approvedProfilePhotos(profile).length > 0)
      .filter((profile) => !filters.withRecommendation || recommendationIds.has(profile.id))
      .filter((profile) => !filters.createdToday || parisDayKey(profile.created_at) === parisDayKey())
      .filter((profile) => !query || [
        profile.display_name,
        profile.location_zone,
        profile.description,
        profile.search_text,
        ...list(profile.practices),
        ...list(profile.values_list)
      ].join(' ').toLocaleLowerCase('fr').includes(query));
  }

  function renderDiscoverResults() {
    const rows = filteredDiscoverProfiles();
    return `<div class="discover-results-heading">
      <div><strong>${rows.length}</strong><span>profil${rows.length > 1 ? 's' : ''} correspondant${rows.length > 1 ? 's' : ''}${state.discoverFilters.createdToday ? ' · créé aujourd’hui' : ''}</span></div>
      <div class="discover-view-actions" role="group" aria-label="Affichage des profils">
        <button class="${state.discoverView === 'grid' ? 'active' : ''}" type="button" data-discover-view="grid" aria-pressed="${state.discoverView === 'grid'}">▦ Damier</button>
        <button class="${state.discoverView === 'horizontal' ? 'active' : ''}" type="button" data-discover-view="horizontal" aria-pressed="${state.discoverView === 'horizontal'}">☰ Résumé</button>
        <button class="text-button" type="button" data-reset-discover>Effacer les filtres</button>
      </div>
    </div>
    ${rows.length
      ? `<section class="discover-profile-results ${e(state.discoverView)}">${rows.map((profile) => state.discoverView === 'horizontal' ? discoverHorizontalTile(profile) : discoverGridTile(profile)).join('')}</section>`
      : emptyState('Aucun résultat', 'Modifie les critères ou efface les filtres pour élargir la recherche.', '◇')}`;
  }

  function renderDiscover() {
    const filters = state.discoverFilters;
    const signature = ['signature', 'beta_full'].includes(state.access?.tier);
    const locationReady = state.mapData?.center?.source === 'private_approximate_location';
    const typeLabels = { couple: 'Tous les couples', woman: 'Toutes les femmes', man: 'Tous les hommes' };
    return `<div class="page discover-page">
      ${pageHead('Recherche sur mesure', 'Recherche', 'Combine librement les critères : chaque groupe accepte plusieurs sélections sans limite.')}
      ${signature ? '' : '<section class="signature-notice"><div><p class="eyebrow">Velvet Découverte</p><strong>La recherche essentielle reste accessible.</strong><small>Âges, pratiques, physique, présence et recherches sauvegardées sont inclus dans Velvet Signature.</small></div><button class="secondary" type="button" data-route="settings">Voir Signature</button></section>'}
      <section class="card saved-search-bar">
        <label>Mes recherches
          <select id="savedSearchSelect">
            <option value="">Choisir une recherche sauvegardée…</option>
            ${list(state.savedSearches).map((search) => `<option value="${e(search.id)}"${String(state.selectedSavedSearchId) === String(search.id) ? ' selected' : ''}>${e(search.name)}</option>`).join('')}
          </select>
        </label>
        <label>Nom de cette recherche<input id="savedSearchName" maxlength="80" placeholder="Ex. Couples échangistes autour de Lille"></label>
        <button class="primary" type="button" data-save-search${signature ? '' : ' disabled'}>Enregistrer</button>
        <button class="secondary" type="button" data-delete-search${state.selectedSavedSearchId ? '' : ' disabled'}>Supprimer</button>
        <small>${signature ? (state.savedSearchPersistenceAvailable ? 'Synchronisée avec ton compte Velvet.' : 'Enregistrée sur cet appareil jusqu’à l’installation de la migration Supabase.') : 'Disponible avec Velvet Signature.'}</small>
      </section>
      <div class="discover-layout">
        <form id="discoverFilters" class="card discover-filter-panel">
          <label class="discover-query">Recherche libre<input name="query" value="${e(filters.query)}" placeholder="Nom, zone, envie ou pratique"></label>
          <details class="discover-filter-section${signature ? '' : ' signature-locked'}" open>
            <summary>Nous recherchons</summary>
            ${discoverChoices('types', ['couple', 'woman', 'man'], filters.types, (value) => typeLabels[value])}
          </details>
          <details class="discover-filter-section">
            <summary>Qui recherchent</summary>
            ${discoverChoices('seeking', ['Couples', 'Femmes', 'Hommes'], filters.seeking)}
          </details>
          <details class="discover-filter-section" open>
            <summary>Localisation</summary>
            <div class="discover-location">
              <label>Ville ou zone publique<input name="city" value="${e(filters.city)}" placeholder="Saisissez une ville"></label>
              <span>ou</span>
              <label class="discover-switch">
                <input type="checkbox" name="nearMe"${filters.nearMe ? ' checked' : ''}${locationReady ? '' : ' disabled'}>
                <i aria-hidden="true"></i><b>Près de chez moi · 50 km</b>
              </label>
              ${locationReady ? '' : '<small>Active ta zone approximative pour utiliser ce filtre.</small>'}
            </div>
          </details>
          <details class="discover-filter-section" open>
            <summary>Âges</summary>
            <div class="discover-age-grid">
              <fieldset${signature ? '' : ' disabled'}><legend>Pour l’homme</legend><label>De<input type="number" name="maleAgeMin" min="18" max="99" value="${e(filters.maleAgeMin)}"></label><label>À<input type="number" name="maleAgeMax" min="18" max="99" value="${e(filters.maleAgeMax)}"></label></fieldset>
              <fieldset${signature ? '' : ' disabled'}><legend>Pour la femme</legend><label>De<input type="number" name="femaleAgeMin" min="18" max="99" value="${e(filters.femaleAgeMin)}"></label><label>À<input type="number" name="femaleAgeMax" min="18" max="99" value="${e(filters.femaleAgeMax)}"></label></fieldset>
            </div>
          </details>
          <details class="discover-filter-section${signature ? '' : ' signature-locked'}">
            <summary>Pratiques <small>plusieurs choix possibles</small></summary>
            <fieldset${signature ? '' : ' disabled'}>${discoverChoices('practices', REFERENCES.practices, filters.practices)}</fieldset>
          </details>
          <details class="discover-filter-section${signature ? '' : ' signature-locked'}">
            <summary>Physique</summary>
            <fieldset${signature ? '' : ' disabled'}>${discoverChoices('morphologies', REFERENCES.morphologies, filters.morphologies)}</fieldset>
          </details>
          <details class="discover-filter-section${signature ? '' : ' signature-locked'}">
            <summary>Divers</summary>
            <fieldset${signature ? '' : ' disabled'}>${discoverChoices('extras', ['onlineOnly', 'withPhotos', 'withRecommendation'], [
              ...(filters.onlineOnly ? ['onlineOnly'] : []),
              ...(filters.withPhotos ? ['withPhotos'] : []),
              ...(filters.withRecommendation ? ['withRecommendation'] : [])
            ], (value) => ({
              onlineOnly: 'Actuellement connecté',
              withPhotos: 'Avec photos publiques',
              withRecommendation: 'Avec recommandation'
            })[value])}</fieldset>
          </details>
        </form>
        <section id="discoverResults" class="discover-results">${renderDiscoverResults()}</section>
      </div>
    </div>`;
  }

  function readDiscoverFilters(form) {
    const data = new FormData(form);
    const clampAge = (name, fallback) => Math.max(18, Math.min(99, Number(data.get(name)) || fallback));
    const extras = new Set(data.getAll('extras'));
    state.discoverFilters = {
      query: String(data.get('query') || ''),
      types: data.getAll('types'),
      seeking: data.getAll('seeking'),
      city: String(data.get('city') || ''),
      nearMe: data.has('nearMe'),
      maleAgeMin: clampAge('maleAgeMin', 18),
      maleAgeMax: clampAge('maleAgeMax', 99),
      femaleAgeMin: clampAge('femaleAgeMin', 18),
      femaleAgeMax: clampAge('femaleAgeMax', 99),
      practices: data.getAll('practices'),
      morphologies: data.getAll('morphologies'),
      onlineOnly: extras.has('onlineOnly'),
      withPhotos: extras.has('withPhotos'),
      withRecommendation: extras.has('withRecommendation'),
      createdToday: state.discoverFilters.createdToday
    };
  }

  function resetDiscoverFilters() {
    state.discoverFilters = {
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
    };
    state.selectedSavedSearchId = '';
  }

  async function saveDiscoverSearch(name) {
    const cleanName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!cleanName) throw new Error('saved_search_name_required');
    const filters = JSON.parse(JSON.stringify(state.discoverFilters));
    if (state.savedSearchPersistenceAvailable) {
      const result = await api('/api/members/discovery', {
        method: 'POST',
        body: JSON.stringify({ name: cleanName, filters })
      });
      applyDiscoveryState(result);
      const saved = state.savedSearches.find((row) => row.name === cleanName);
      state.selectedSavedSearchId = saved?.id || '';
      return;
    }
    const existing = localSavedSearches().find((row) => row.name === cleanName);
    const row = {
      id: existing?.id || `local-${Date.now()}`,
      name: cleanName,
      filters,
      updated_at: new Date().toISOString()
    };
    state.savedSearches = [row, ...localSavedSearches().filter((item) => item.name !== cleanName)];
    saveLocalSearches(state.savedSearches);
    state.selectedSavedSearchId = row.id;
  }

  async function deleteDiscoverSearch(id) {
    if (!id) return;
    if (state.savedSearchPersistenceAvailable) {
      const result = await api(`/api/members/discovery?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      applyDiscoveryState(result);
    } else {
      state.savedSearches = localSavedSearches().filter((row) => String(row.id) !== String(id));
      saveLocalSearches(state.savedSearches);
    }
    state.selectedSavedSearchId = '';
  }

  function bindDiscover() {
    const form = document.querySelector('#discoverFilters');
    if (!form) return;
    const bindResultControls = () => {
      document.querySelector('[data-reset-discover]')?.addEventListener('click', () => {
        resetDiscoverFilters();
        content.innerHTML = renderDiscover();
        bindDiscover();
      });
      document.querySelectorAll('[data-discover-view]').forEach((button) => {
        button.addEventListener('click', () => {
          state.discoverView = button.dataset.discoverView === 'horizontal' ? 'horizontal' : 'grid';
          try {
            localStorage.setItem(DISCOVER_VIEW_STORAGE_KEY, state.discoverView);
          } catch {
            // L’affichage reste actif pour la session.
          }
          document.querySelector('#discoverResults').innerHTML = renderDiscoverResults();
          bindResultControls();
        });
      });
    };
    const refreshResults = () => {
      readDiscoverFilters(form);
      document.querySelector('#discoverResults').innerHTML = renderDiscoverResults();
      bindResultControls();
    };
    form.addEventListener('input', refreshResults);
    form.addEventListener('change', refreshResults);
    bindResultControls();
    document.querySelector('#savedSearchSelect')?.addEventListener('change', (event) => {
      const search = state.savedSearches.find((row) => String(row.id) === String(event.target.value));
      if (!search) {
        state.selectedSavedSearchId = '';
        return;
      }
      state.selectedSavedSearchId = search.id;
      state.discoverFilters = { ...state.discoverFilters, ...search.filters, createdToday: false };
      content.innerHTML = renderDiscover();
      bindDiscover();
      toast(`Recherche « ${search.name} » appliquée.`);
    });
    document.querySelector('[data-save-search]')?.addEventListener('click', async (event) => {
      readDiscoverFilters(form);
      event.currentTarget.disabled = true;
      try {
        await saveDiscoverSearch(document.querySelector('#savedSearchName')?.value);
        content.innerHTML = renderDiscover();
        bindDiscover();
        toast('Recherche sauvegardée.');
      } catch (error) {
        toast(errorMessages[error.message] || error.message, true);
        event.currentTarget.disabled = false;
      }
    });
    document.querySelector('[data-delete-search]')?.addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      try {
        await deleteDiscoverSearch(state.selectedSavedSearchId);
        content.innerHTML = renderDiscover();
        bindDiscover();
        toast('Recherche supprimée.');
      } catch (error) {
        toast(errorMessages[error.message] || error.message, true);
        event.currentTarget.disabled = false;
      }
    });
  }

  function facts(person) {
    const profession = person.profession_private ? 'Information privée' : (person.profession || 'Non renseigné');
    return `<div class="facts">
      <div class="fact"><small>Âge</small><strong>${e(age(person.birth_year))}</strong></div>
      <div class="fact"><small>Identité</small><strong>${e(person.gender_identity || 'Non renseignée')}</strong></div>
      <div class="fact"><small>Taille</small><strong>${person.height_cm ? `${e(person.height_cm)} cm` : 'Non renseignée'}</strong></div>
      <div class="fact"><small>Poids</small><strong>${person.weight_kg ? `${e(person.weight_kg)} kg` : 'Non renseigné'}</strong></div>
      <div class="fact"><small>Morphologie</small><strong>${e(person.morphology || 'Non renseignée')}</strong></div>
      <div class="fact"><small>Cheveux</small><strong>${e(person.hair_color || 'Non renseignés')}</strong></div>
      <div class="fact"><small>Yeux</small><strong>${e(person.eye_color || 'Non renseignés')}</strong></div>
      <div class="fact"><small>Enfants</small><strong>${e(childrenLabel(person.children_status))}</strong></div>
      <div class="fact"><small>Profession</small><strong>${e(profession)}</strong></div>
      <div class="fact"><small>Fréquence</small><strong>${e(person.frequency || 'Non renseignée')}</strong></div>
    </div>`;
  }

  function personView(person, profile, own) {
    if (!person) return emptyState('Fiche incomplète', 'Cette personne n’a pas encore complété sa fiche.', '♡');
    const personalPhotos = list(profile.media_assets).filter(
      (photo) => photo.media_role === 'individual_portrait'
        && photo.individual_profile_id === person.id
        && photo.moderation_status === 'approved'
        && photo.previewUrl
    );
    const canAddPersonalPhotos = own && person.linked_user_id === state.account?.userId;
    return `<section class="profile-layout">
      <div>
        <article class="card section">
          <p class="eyebrow">Portrait personnel</p><h2>${e(person.first_name || 'Profil personnel')}</h2>
          <p class="quote">${e(person.biography || 'Description personnelle à compléter.')}</p>
          ${facts(person)}
        </article>
        <article class="card section"><h2>Attirances</h2>${chips(person.attracted_to)}</article>
        <article class="card section"><h2>Ce que ${e(person.first_name || 'cette personne')} souhaite vivre</h2>${chips(person.desired_practices)}</article>
        ${profile.profile_type === 'couple' ? `<article class="card section"><h2>Accords au sein du couple</h2><p>Ce que ${e(person.first_name || 'cette personne')} autorise son ou sa partenaire à pratiquer.</p>${chips(person.partner_permissions)}</article>` : ''}
      </div>
      <aside>
        <article class="card"><p class="eyebrow">Orientation et attirances</p><h3>${e(person.orientation || 'Non renseignées')}</h3></article>
        <article class="card" style="margin-top:14px"><p class="eyebrow">Photos individuelles</p>
          ${personalPhotos.length ? `<div class="mini-gallery">${personalPhotos.map((photo) => `<figure><img src="${e(photo.previewUrl)}" alt="Photo individuelle de ${e(person.first_name)}">${photoReactionBar(photo, own)}</figure>`).join('')}</div>` : '<h3>Aucune photo publiée</h3><p>Velvet n’affiche aucune image de substitution.</p>'}
          ${canAddPersonalPhotos ? `<form class="profile-photo-form" data-photo-role="individual_portrait" data-individual-profile="${e(person.id)}">
            <label>Ajouter des photos individuelles<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required></label>
            <button class="secondary" type="submit">Ajouter</button><small class="photo-upload-status" role="status"></small>
          </form>` : ''}
        </article>
      </aside>
    </section>`;
  }

  function recommendationsFor(profile) {
    const rows = list(state.directory.recommendations).filter((item) => item.target_type === 'profile' && item.target_id === profile.id);
    if (!rows.length) return `<p>Aucune recommandation reçue pour le moment.</p>`;
    return rows.map((item) => {
      const author = list(state.directory.profiles).find((profileRow) => profileRow.id === item.author_profile_id);
      return `<div class="card" style="margin-top:10px"><strong>${e(author?.display_name || 'Membre Velvet')}</strong><p>${e(item.body)}</p>${item.rating ? `<span class="pill gold">${e(item.rating)}/5</span>` : ''}</div>`;
    }).join('');
  }

  function dateLabel(value) {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`));
  }

  function travelMapPreview(plan) {
    const latitude = Number(plan.latitude ?? (plan.destination_type === 'cap_dagde_village' ? 43.294 : NaN));
    const longitude = Number(plan.longitude ?? (plan.destination_type === 'cap_dagde_village' ? 3.529 : NaN));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
    const zoom = plan.precise_location_consent ? 14 : 12;
    const point = mapPoint(latitude, longitude, zoom);
    const tileX = Math.floor(point.x / 256);
    const tileY = Math.floor(point.y / 256);
    return `<div class="travel-map-preview" style="background-image:url('https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png')" aria-label="Aperçu cartographique ${e(plan.precise_location_consent ? 'précis et consenti' : 'approximatif')}"><i></i><small>${plan.precise_location_consent ? 'Localisation précise partagée' : 'Zone approximative'}</small></div>`;
  }

  const CAP_DAGDE_ZONES = [
    { label: 'Ensemble du village', short: 'Village', x: 48, y: 48 },
    { label: 'Entrée · Natureva · René Oltra', short: 'Entrée', x: 22, y: 63 },
    { label: 'Port Soleil', short: 'Port Soleil', x: 38, y: 67 },
    { label: 'Port Ambonne', short: 'Port Ambonne', x: 48, y: 55 },
    { label: 'Port Nature', short: 'Port Nature', x: 57, y: 43 },
    { label: 'Héliopolis', short: 'Héliopolis', x: 67, y: 32 },
    { label: 'Plage naturiste', short: 'Plage', x: 79, y: 20 },
    { label: 'Marina', short: 'Marina', x: 55, y: 70 }
  ];

  function capDagdePlan(selectedZone = 'Ensemble du village', interactive = false) {
    const selected = CAP_DAGDE_ZONES.some((zone) => zone.label === selectedZone)
      ? selectedZone
      : 'Ensemble du village';
    return `<div class="cap-village-plan ${interactive ? 'interactive' : ''}" data-cap-plan>
      <div class="cap-plan-canvas">
        <svg viewBox="0 0 720 420" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="cap-land" x1="0" x2="1" y1="1" y2="0"><stop stop-color="#2a171e"/><stop offset="1" stop-color="#473123"/></linearGradient>
            <linearGradient id="cap-water" x1="0" x2="1"><stop stop-color="#182a32"/><stop offset="1" stop-color="#274754"/></linearGradient>
          </defs>
          <path class="cap-water" d="M486-20H760V440H392c40-54 75-106 92-165 23-79 16-173 2-295Z"/>
          <path class="cap-shore" d="M486-20c14 122 21 216-2 295-17 59-52 111-92 165"/>
          <path class="cap-land" d="M-20-20h506c14 122 21 216-2 295-17 59-52 111-92 165H-20Z"/>
          <path class="cap-road" d="M80 350c88-56 151-117 213-183 52-55 99-89 169-120"/>
          <path class="cap-road thin" d="M158 348c80-35 163-61 259-71M236 261c34 23 64 61 73 117M342 129c8 61 37 106 95 137"/>
          <path class="cap-marina" d="M330 258c43-49 116-41 137 5-18 52-88 75-142 34Z"/>
          <path class="cap-beach" d="M503 5c20 91 23 170 9 237"/>
        </svg>
        <span class="cap-plan-title"><b>Village naturiste</b><small>Cap d’Agde · repère de zone</small></span>
        ${CAP_DAGDE_ZONES.map((zone) => {
          const active = zone.label === selected;
          const tag = interactive ? 'button' : 'span';
          return `<${tag}${interactive ? ' type="button"' : ''} class="cap-zone-point ${active ? 'active' : ''}" style="--cap-x:${zone.x}%;--cap-y:${zone.y}%" data-cap-zone="${e(zone.label)}"${interactive ? ` aria-pressed="${active}"` : ''}><i></i><b>${e(zone.short)}</b></${tag}>`;
        }).join('')}
        <span class="cap-sea-label">Méditerranée</span>
      </div>
      <p class="cap-zone-selection"><span>Zone sélectionnée</span><strong data-cap-zone-label>${e(selected)}</strong></p>
    </div>`;
  }

  function profilePlansView(profile, own) {
    const today = parisDayKey();
    const visits = list(state.plans.venueVisits).filter((row) => row.profile_id === profile.id);
    const travels = list(state.plans.travelPlans).filter((row) => row.profile_id === profile.id);
    const classicTravels = travels.filter((row) => row.destination_type !== 'cap_dagde_village');
    const capTravels = travels.filter((row) => row.destination_type === 'cap_dagde_village');
    const eventPlans = list(state.plans.eventPlans).filter((row) => row.profile_id === profile.id);
    const eventRows = eventPlans.map((plan) => ({
      plan,
      event: list(state.directory.events).find((event) => event.id === plan.event_id)
    })).filter((row) => row.event);
    const capVenues = ['CHM René Oltra','Natureva Spa','Oz’Inn Hôtel & Spa','Glamour','Glamour Beach','Waiki Beach','Tantra','Kamasutra','Plug & Play','Histoire d’O'];
    const hasClassicAgenda = visits.length || classicTravels.length || eventRows.length;
    return `<article class="card section profile-plans">
      <p class="eyebrow">Agenda public</p><h2>Sorties et séjours</h2>
      <section class="classic-plans-block">
        <header><span>01</span><div><p class="eyebrow">Sorties classiques</p><h3>Nos prochaines escapades</h3><small>Ville, établissement, soirée ou séjour libre.</small></div></header>
      ${hasClassicAgenda ? `<div class="profile-plan-list">
        ${visits.map((visit) => `<div><span>⌖</span><p><strong>${visit.visit_date < today ? 'On y est allé' : 'Nous y serons'} · ${e(visit.venue_directory?.name || 'Établissement')}</strong><small>${e(dateLabel(visit.visit_date))} · ${e(visit.venue_directory?.city || '')}</small></p>${own ? `<button type="button" data-delete-plan="${e(visit.id)}" data-plan-type="venue_visit" aria-label="Supprimer">×</button>` : ''}</div>`).join('')}
        ${eventRows.map(({ plan, event }) => `<button type="button" data-open-event="${e(event.id)}"><span>✦</span><p><strong>${new Date(event.starts_at) < new Date() ? 'On y est allé' : 'Nous participerons'} · ${e(event.title)}</strong><small>${e(new Date(event.starts_at).toLocaleString('fr-FR'))} · ${e(plan.registration_status)}</small></p><i>→</i></button>`).join('')}
        ${classicTravels.map((plan) => `<div class="travel-plan-card">${travelMapPreview(plan)}<p><strong>${plan.ends_on < today ? 'Nous étions' : 'Nous serons'} · ${e(plan.title)}</strong><small>Du ${e(dateLabel(plan.starts_on))} au ${e(dateLabel(plan.ends_on))} · ${e(plan.location_label)}</small>${plan.notes ? `<span>${e(plan.notes)}</span>` : ''}</p>${own ? `<button type="button" data-delete-plan="${e(plan.id)}" data-plan-type="travel_plan" aria-label="Supprimer">×</button>` : ''}</div>`).join('')}
      </div>` : '<p class="muted classic-empty">Aucune sortie classique annoncée.</p>'}
      ${own && !state.plans.migrationPending ? `<details class="travel-plan-editor classic-travel-editor"><summary>Ajouter une sortie classique</summary>
        <form class="travel-plan-form classic-travel-form">
          <input type="hidden" name="destinationType" value="general">
          <div class="form-grid">
            <label>Nom de la sortie<input name="title" maxlength="160" placeholder="Ex. Une soirée à Béthune" required></label>
            <label>Destination<input name="locationLabel" maxlength="240" placeholder="Ville, lieu ou adresse publique" required></label>
            <label>Du<input type="date" name="startsOn" required></label>
            <label>Au<input type="date" name="endsOn" required></label>
            <label class="wide">Note publique<textarea name="notes" maxlength="2000" placeholder="Informations utiles pour les autres membres"></textarea></label>
          </div>
          <details class="precise-location-consent"><summary>Ajouter une localisation précise</summary><p>Facultatif. La position n’est enregistrée que si tu donnes ton consentement explicite.</p><div class="form-grid"><label>Latitude<input type="number" step="0.000001" name="latitude"></label><label>Longitude<input type="number" step="0.000001" name="longitude"></label></div><label class="toggle"><input type="checkbox" name="preciseLocationConsent"><span>Je consens à rendre cette position précise visible aux membres autorisés.</span></label></details>
          <button class="primary" type="submit">Publier sur mon profil</button>
        </form>
      </details>` : own ? '<p class="status-box">Les sorties seront activées après la migration Supabase 0024.</p>' : ''}
      </section>
      ${capTravels.length ? `<section class="cap-dagde-showcase">
        <header><span>02</span><div><p class="eyebrow">Destination signature</p><h3>Nos séjours au Cap d’Agde</h3><small>Village naturiste · repère de zone partagé</small></div></header>
        <div class="cap-showcase-layout">
          ${capDagdePlan(capTravels.find((plan) => plan.ends_on >= today)?.cap_zone || capTravels[0].cap_zone)}
          <div class="cap-stay-list">${capTravels.map((plan) => `<article>
            <p class="eyebrow">${plan.ends_on < today ? 'Souvenir du Cap' : 'Prochain séjour'}</p>
            <h4>${e(plan.title)}</h4>
            <strong>Du ${e(dateLabel(plan.starts_on))} au ${e(dateLabel(plan.ends_on))}</strong>
            <small>${e(plan.cap_zone || 'Ensemble du village')}${plan.cap_venue ? ` · ${e(plan.cap_venue)}` : ''}</small>
            ${plan.notes ? `<p>${e(plan.notes)}</p>` : ''}
            ${own ? `<button type="button" class="cap-delete-plan" data-delete-plan="${e(plan.id)}" data-plan-type="travel_plan">Retirer ce séjour</button>` : ''}
          </article>`).join('')}</div>
        </div>
      </section>` : ''}
      ${own && !state.plans.migrationPending ? `<details class="cap-travel-editor"${capTravels.length ? '' : ' data-empty-cap'}>
        <summary><span class="cap-summary-mark">C</span><span><small>Expérience dédiée</small><strong>Préparer un séjour au Cap d’Agde</strong></span><i>Ouvrir</i></summary>
        <form class="travel-plan-form cap-travel-form">
          <input type="hidden" name="destinationType" value="cap_dagde_village">
          <input type="hidden" name="locationLabel" value="Village naturiste du Cap d’Agde">
          <input type="hidden" name="capZone" value="Ensemble du village" data-cap-zone-input>
          <div class="cap-editor-intro"><p class="eyebrow">Choisir son repère</p><h3>Où serez-vous dans le village ?</h3><p>Sélectionne une zone sur le plan. L’emplacement reste volontairement général tant que tu ne partages pas une position précise.</p></div>
          ${capDagdePlan('Ensemble du village', true)}
          <div class="form-grid cap-travel-fields">
            <label>Nom du séjour<input name="title" maxlength="160" value="Séjour au Cap d’Agde" required></label>
            <label>Établissement ou résidence<select name="capVenue"><option value="">Non précisé</option>${capVenues.map((venue) => `<option>${e(venue)}</option>`).join('')}</select></label>
            <label>Du<input type="date" name="startsOn" required></label>
            <label>Au<input type="date" name="endsOn" required></label>
            <label class="wide">Note publique<textarea name="notes" maxlength="2000" placeholder="Vos envies, les moments où vous serez disponibles…"></textarea></label>
          </div>
          <details class="precise-location-consent"><summary>Partager volontairement un point précis</summary><p>Ne publie jamais ton numéro d’hébergement. La photographie et la vidéo restent soumises au consentement des personnes présentes.</p><div class="form-grid"><label>Latitude<input type="number" step="0.000001" name="latitude"></label><label>Longitude<input type="number" step="0.000001" name="longitude"></label></div><label class="toggle"><input type="checkbox" name="preciseLocationConsent"><span>Je consens à rendre cette position précise visible aux membres autorisés.</span></label></details>
          <button class="primary cap-publish-button" type="submit">Publier mon séjour au Cap</button>
        </form>
      </details>` : ''}
    </article>`;
  }

  function albumsView(profile, own) {
    const albums = list(profile.albums);
    const profilePhotos = approvedProfilePhotos(profile);
    const targetProfiles = list(state.directory.profiles).filter((row) => row.id !== state.profile.id);
    return `<section>
      <div class="page-head"><div><p class="eyebrow">Bibliothèque organisée</p><h1>Albums publics & privés</h1><p>Les albums publics sont visibles par tous les membres admis. Les albums privés ne révèlent rien sans une autorisation accordée par leur propriétaire.</p></div></div>
      ${profilePhotos.length || albums.length ? `<div class="album-library">
        ${profilePhotos.length ? `<details class="album-folder system-album" data-album-folder>
          <summary class="album-folder-cover">
            <span class="album-cover-media">
              <img src="${e(profilePhotos[0].previewUrl)}" alt="Couverture de l’album Photos de profil de ${e(profile.display_name)}">
              <span class="album-cover-count">${profilePhotos.length} photo${profilePhotos.length > 1 ? 's' : ''}</span>
            </span>
            <span class="album-cover-copy">
              <span class="eyebrow">Album système public</span>
              <strong>Photos de profil</strong>
              <small>Alimenté automatiquement par le carrousel</small>
              <span class="album-folder-meta">${profilePhotos.length} photo${profilePhotos.length > 1 ? 's' : ''}</span>
              <span class="album-open-label"><span class="closed-label">Ouvrir le dossier</span><span class="open-label">Fermer le dossier</span> <b>⌄</b></span>
            </span>
          </summary>
          <article class="card album-detail public">
            <header><div><p class="eyebrow">Album système public</p><h2>Photos de profil</h2></div><span class="pill gold">${profilePhotos.length} photo${profilePhotos.length > 1 ? 's' : ''}</span></header>
            <div class="album-gallery">${profilePhotos.map((photo, index) => albumPhotoFigure(
              photo,
              `profile-photos-${profile.id}`,
              index,
              `Photo de profil ${index + 1} de ${profile.display_name}`,
              own
            )).join('')}</div>
            <p class="muted">Cet album est alimenté automatiquement par le carrousel public. Il reste synchronisé sans dupliquer les photos.</p>
          </article>
        </details>` : ''}
        ${albums.map((album) => {
        const photos = list(album.media_assets).filter((photo) => photo.previewUrl);
        const coverMedia = photos.find((photo) => photo.media_type !== 'video');
        const pendingPhotos = photos.filter((photo) => photo.moderation_status === 'pending').length;
        const isPublic = album.confidentiality === 'public';
        const canSee = own || isPublic || photos.length > 0;
        const activeGrants = list(album.album_access_grants).filter(
          (grant) => !grant.revoked_at && (!grant.expires_at || new Date(grant.expires_at) > new Date())
        );
        const grantedProfiles = [...new Set(activeGrants.map((grant) => grant.grantee_profile_id).filter(Boolean))];
        const countLabel = `${photos.length} média${photos.length > 1 ? 's' : ''}`;
        return `<details class="album-folder ${isPublic ? 'public' : 'private'}" data-album-folder>
          <summary class="album-folder-cover">
            <span class="album-cover-media ${canSee && photos.length ? '' : 'locked'}">
              ${canSee && coverMedia
                ? `<img src="${e(coverMedia.previewUrl)}" alt="Couverture de l’album ${e(album.name)}">`
                : `<span class="album-cover-placeholder">${isPublic ? '⌑' : '◇'}</span>`}
              <span class="album-cover-count">${canSee ? countLabel : 'Contenu privé'}</span>
            </span>
            <span class="album-cover-copy">
              <span class="eyebrow">${e(confidentialityLabel(album.confidentiality))}</span>
              <strong>${e(album.name)}</strong>
              <small>${canSee ? 'Ouvrez le dossier pour parcourir son contenu' : 'Aucun aperçu avant autorisation'}</small>
              <span class="album-folder-meta">${canSee ? countLabel : 'Contenu privé'}</span>
              <span class="album-open-label"><span class="closed-label">Ouvrir le dossier</span><span class="open-label">Fermer le dossier</span> <b>⌄</b></span>
            </span>
          </summary>
          <article class="card album-detail ${isPublic ? 'public' : 'private'}">
            <header><div><p class="eyebrow">${e(confidentialityLabel(album.confidentiality))}</p><h2>${e(album.name)}</h2></div>${canSee ? `<span class="pill">${countLabel}</span>` : ''}</header>
            ${canSee
              ? (photos.length ? `<div class="album-gallery">${photos.map((photo, index) => albumPhotoFigure(
                photo,
                `album-${album.id}`,
                index,
                `Photo ${index + 1} de l’album ${album.name}`,
                own
              )).join('')}</div>` : '<p class="muted">Aucune photo visible dans cet album.</p>')
              : '<div class="private-vault"><span>⌑</span><strong>Album privé verrouillé</strong><p>Aucune miniature ni information sur son contenu n’est révélée.</p></div>'}
            ${own && pendingPhotos ? `<p class="status-box">${pendingPhotos} média${pendingPhotos > 1 ? 's' : ''} visible${pendingPhotos > 1 ? 's' : ''} seulement par vous, en attente de modération.</p>` : ''}
            ${own ? `<form class="album-photo-form" data-album-id="${e(album.id)}">
              <label>Ajouter des photos ou vidéos<input type="file" name="photos" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple required></label>
              <button class="secondary" type="submit">Ajouter à l’album</button><small class="photo-upload-status" role="status"></small>
            </form>` : ''}
            ${own && !isPublic ? `<div class="album-access-panel">
              <p><strong>${grantedProfiles.length}</strong> profil${grantedProfiles.length > 1 ? 's' : ''} actuellement autorisé${grantedProfiles.length > 1 ? 's' : ''}.</p>
              ${grantedProfiles.length ? `<div class="active-album-grants">${grantedProfiles.map((profileId) => {
                const target = targetProfiles.find((row) => row.id === profileId);
                const targetGrants = activeGrants.filter((grant) => grant.grantee_profile_id === profileId);
                const permanent = targetGrants.some((grant) => !grant.expires_at);
                const latest = targetGrants.map((grant) => grant.expires_at).filter(Boolean).sort().at(-1);
                return `<span class="selected-venue"><span>${e(target?.display_name || 'Profil autorisé')} · ${permanent ? 'Permanent' : `jusqu’au ${e(new Date(latest).toLocaleString('fr-FR'))}`}</span><button type="button" data-revoke-album="${e(album.id)}" data-revoke-profile="${e(profileId)}" aria-label="Révoquer l’accès">×</button></span>`;
              }).join('')}</div>` : ''}
              <p class="muted">Les nouveaux accès se donnent depuis la fiche du membre concerné. Les accès actifs restent révocables ici.</p>
            </div>` : ''}
          </article>
        </details>`;
      }).join('')}</div>` : emptyState('Aucun album publié', own ? 'Crée un album, donne-lui un nom et choisis s’il est public ou privé.' : 'Ce membre n’a encore publié aucun album.', '⌑')}
      ${!own && list(state.profile?.albums).some((album) => album.confidentiality !== 'public') ? `<form class="card profile-album-access-form" data-profile-id="${e(profile.id)}" style="margin-top:16px">
        <p class="eyebrow">Partage privé</p><h2>Ouvrir mes albums à ${e(profile.display_name)}</h2>
        <p>Choisis un ou plusieurs de tes albums privés. Pour un profil couple, l’autorisation couvre les deux comptes actifs.</p>
        <div class="album-access-choices">${list(state.profile.albums).filter((album) => album.confidentiality !== 'public').map((album) => `<label><input type="checkbox" name="albumIds" value="${e(album.id)}"><span>${e(album.name)}</span></label>`).join('')}</div>
        <div class="form-grid"><label>Durée<select name="duration" required><option value="1">1 heure</option><option value="4">4 heures</option><option value="12">12 heures</option><option value="24">24 heures</option><option value="permanent">Permanent</option></select></label><button class="primary" type="submit">Donner l’accès</button></div>
      </form>` : ''}
      ${own ? `<form id="albumForm" class="card" style="margin-top:16px">
        <h2>Créer un album</h2>
        <div class="form-grid">
          <label>Nom de l’album<input name="name" maxlength="120" required></label>
          <label>Visibilité<select name="confidentiality"><option value="public">Public — visible par tous les membres</option><option value="request">Privé — uniquement sur autorisation</option></select></label>
        </div><button class="primary" type="submit" style="margin-top:14px">Créer l’album</button>
      </form>` : ''}
    </section>`;
  }

  function profileOverview(profile, own) {
    const people = profilePeople(profile);
    const voice = profileVoice(profile);
    return `<section class="profile-layout">
      <div>
        <article class="card section"><p class="eyebrow">En quelques mots</p><h2>${voice.aboutTitle}</h2><p class="quote">${e(profile.description || voice.descriptionFallback)}</p>${chips(profile.values_list, 'Valeurs à compléter')}</article>
        <article class="card section"><p class="eyebrow">Le récit</p><h2>${voice.storyTitle}</h2><p>${e(profile.story || voice.storyFallback)}</p></article>
        <article class="card section"><p class="eyebrow">Le chemin parcouru</p><h2>${voice.journeyTitle}</h2><p>${e(profile.journey || voice.journeyFallback)}</p></article>
        <article class="card section"><p class="eyebrow">Les rencontres souhaitées</p><h2>${voice.searchTitle}</h2><p>${e(profile.search_text || voice.searchFallback)}</p></article>
        <article class="card section"><p class="eyebrow">${voice.practicesEyebrow}</p><h2>${voice.practicesTitle}</h2>${chips(profile.practices, 'Pratiques à compléter')}</article>
        ${profilePlansView(profile, own)}
        <article class="card section"><p class="eyebrow">${voice.recommendationsEyebrow}</p><h2>Recommandations</h2>${recommendationsFor(profile)}</article>
        ${own ? `<article class="card section"><p class="eyebrow">Carrousel public</p><h2>Ajouter des photos de profil</h2><p>Ces photos complètent le carrousel principal après validation.</p><form class="profile-photo-form" data-photo-role="${profile.profile_type === 'couple' ? 'couple_gallery' : 'individual_gallery'}"><label>Choisir des photos<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required></label><button class="secondary" type="submit">Ajouter au carrousel</button><small class="photo-upload-status" role="status"></small></form></article>` : ''}
      </div>
      <aside>
        <article class="card">
          <p class="eyebrow">${voice.peopleEyebrow}</p>
          ${people.map((person, index) => `<button class="card person-card profile-card-button" style="margin-top:10px" data-profile-tab="person${index}">
            <span class="avatar">${e(initials(person.first_name))}</span><span><strong>${e(person.first_name || 'Fiche personnelle')}</strong><p>${e(person.biography || 'Découvrir cette personne')}</p></span><span>→</span>
          </button>`).join('')}
        </article>
        <article class="card" style="margin-top:14px"><p class="eyebrow">Localisation publique</p><h3>${e(profile.location_zone || 'Privée')}</h3><p>${voice.locationCopy}</p></article>
        <article class="card" style="margin-top:14px"><p class="eyebrow">Lieux préférés</p>${chips(profile.favorite_places, 'Aucun lieu renseigné')}</article>
        <article class="card" style="margin-top:14px"><p class="eyebrow">Disponibilités</p><p>${e(profile.availability_text || 'Non renseignées')}</p></article>
        ${own ? partnerInviteBox(profile, people) : ''}
        ${own ? organizerBox() : ''}
      </aside>
    </section>`;
  }

  function partnerInviteBox(profile, people) {
    if (profile.profile_type !== 'couple' || state.membership?.member_slot !== 'partner_a') return '';
    if (people.some((person) => person.member_slot === 'partner_b' && person.linked_user_id)) {
      return `<article class="card" style="margin-top:14px"><p class="eyebrow">Profil partagé</p><h3>Partenaire rattaché(e)</h3><p>Chaque personne contrôle désormais sa propre fiche. Les informations du couple sont communes.</p></article>`;
    }
    return `<article class="card" style="margin-top:14px"><p class="eyebrow">Profil partagé</p><h3>Inviter mon/ma partenaire</h3><p>L’invitation rattache son compte à cette fiche couple. Cette personne remplira elle-même sa partie personnelle.</p><button class="secondary" data-couple-invite>Préparer l’invitation</button></article>`;
  }

  function organizerBox() {
    const request = state.organizerRequest;
    if (request?.status === 'pending') return `<article class="card" style="margin-top:14px"><p class="eyebrow">Organisateur privé</p><h3>Demande en cours</h3><p>Un administrateur ou un modérateur doit valider l’accès.</p></article>`;
    if (request?.status === 'approved') return `<article class="card" style="margin-top:14px"><p class="eyebrow">Organisateur privé</p><h3>Accès validé</h3><p>Le rôle sera disponible dans ton espace autorisé.</p></article>`;
    return `<article class="card" style="margin-top:14px"><p class="eyebrow">Organisateur privé</p><h3>Vous organisez des soirées ?</h3><p>Demande l’accès Organisateur depuis ton profil membre. Ce rôle reste distinct d’un établissement professionnel.</p><button class="secondary" data-organizer-request>Demander l’accès</button></article>`;
  }

  function renderProfile(profile, own = false) {
    if (!profile) return `<div class="page">${emptyState('Profil introuvable', 'Ce profil n’est plus visible dans la BETA.', '♡')}</div>`;
    const people = profilePeople(profile);
    const voice = profileVoice(profile);
    if (state.profileTab.startsWith('person') && !people[Number(state.profileTab.replace('person', ''))]) state.profileTab = 'couple';
    const activeContent = state.profileTab === 'albums'
      ? albumsView(profile, own)
      : state.profileTab.startsWith('person')
        ? personView(people[Number(state.profileTab.replace('person', ''))], profile, own)
        : profileOverview(profile, own);
    return `<div class="page">
      <section class="hero">${profileCarousel(profile)}<div class="hero-copy">
        <p class="eyebrow">${e(voice.profileLabel)} · ${e(profile.location_zone || 'Localisation privée')}</p>
        <h1>${e(profile.display_name)}</h1><p class="lead">${e(profile.description)}</p>
        <div class="badges"><span class="pill gold">${e(voice.betaLabel)}</span>${profile.profile_type === 'couple' && profile.relationship_since ? `<span class="pill">Depuis ${e(profile.relationship_since)}</span>` : ''}<span class="pill">${e(profile.location_zone || 'Zone privée')}</span></div>
        <div class="actions">${own ? '<button class="primary" data-edit-profile>Modifier mon profil</button>' : ''}${!own ? `<button class="primary" data-message-profile="${e(profile.id)}">Écrire</button><button class="secondary" data-favorite-profile="${e(profile.id)}">${state.socialActions[profile.id]?.favorite ? 'Ne plus suivre' : 'Suivre ce membre'}</button>` : ''}</div>
      </div></section>
      ${profileEngagementPanel(profile, own)}
      ${own ? '' : profileSafetyPanel(profile)}
      <nav class="profile-nav" aria-label="Sections du profil">
        <button data-profile-tab="couple" class="${state.profileTab === 'couple' ? 'active' : ''}">${profile.profile_type === 'couple' ? 'Le couple' : 'Présentation'}</button>
        ${people.map((person, index) => `<button data-profile-tab="person${index}" class="${state.profileTab === `person${index}` ? 'active' : ''}">${e(person.first_name || `Personne ${index + 1}`)}</button>`).join('')}
        <button data-profile-tab="albums" class="${state.profileTab === 'albums' ? 'active' : ''}">Albums (${list(profile.albums).length + (approvedProfilePhotos(profile).length ? 1 : 0)})</button>
      </nav>
      ${activeContent}
    </div>`;
  }

  function profileSafetyPanel(profile) {
    const blocked = Boolean(state.socialActions[profile.id]?.blocked);
    return `<details class="card profile-safety">
      <summary>Sécurité et discrétion</summary>
      <div class="profile-safety-grid">
        <div><h3>${blocked ? 'Profil bloqué' : 'Bloquer ce profil'}</h3><p>${blocked ? 'Ce profil ne peut plus entrer en contact avec toi.' : 'Le blocage coupe immédiatement la possibilité de contact entre vos profils.'}</p><button class="secondary" type="button" data-block-profile="${e(profile.id)}" data-enabled="${blocked ? 'false' : 'true'}">${blocked ? 'Débloquer' : 'Bloquer'}</button></div>
        <form id="profileReportForm" data-profile-id="${e(profile.id)}">
          <h3>Signaler discrètement</h3>
          <label>Motif<select name="category" required><option value="">Choisir</option><option value="fake_profile">Suspicion de faux profil</option><option value="consent">Consentement ou comportement</option><option value="harassment">Harcèlement</option><option value="spam">Spam ou démarchage</option><option value="content">Contenu inapproprié</option><option value="other">Autre</option></select></label>
          <label>Précisions<textarea name="description" maxlength="2000" placeholder="Décris les faits, sans information inutile."></textarea></label>
          <button class="secondary" type="submit">Envoyer à la modération</button>
        </form>
      </div>
    </details>`;
  }

  function mapPoint(latitude, longitude, zoom) {
    const scale = 256 * (2 ** zoom);
    const sine = Math.min(Math.max(Math.sin(latitude * Math.PI / 180), -0.9999), 0.9999);
    return {
      x: scale * (0.5 + longitude / 360),
      y: scale * (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI))
    };
  }

  function mapCoordinates(point, zoom) {
    const scale = 256 * (2 ** zoom);
    const x = ((point.x % scale) + scale) % scale;
    const y = Math.max(0, Math.min(scale, point.y));
    const longitude = x / scale * 360 - 180;
    const mercator = Math.PI - 2 * Math.PI * y / scale;
    const latitude = 180 / Math.PI * Math.atan(Math.sinh(mercator));
    return { latitude, longitude };
  }

  function mapViewport(preferredCenter) {
    const pageWidth = document.querySelector('#content .page')?.clientWidth || content.clientWidth || 900;
    const width = Math.max(320, Math.min(1280, Math.round(pageWidth)));
    const height = window.innerWidth <= 760 ? 520 : 600;
    const selectedCenter = state.mapCenter || preferredCenter;
    const center = {
      latitude: Number(selectedCenter?.latitude ?? 46.603354),
      longitude: Number(selectedCenter?.longitude ?? 1.888334)
    };
    return { width, height, center, zoom: Math.max(5, Math.min(13, Number(state.mapZoom || 10))) };
  }

  function defaultMapZoom(center) {
    const pageWidth = document.querySelector('#content .page')?.clientWidth || content.clientWidth || 900;
    const width = Math.max(320, Math.min(1280, Math.round(pageWidth)));
    const latitude = Number(center?.latitude ?? 46.603354);
    const targetMetresPerPixel = 50000 * 2 / width;
    return Math.max(5, Math.min(13,
      Math.log2(156543.03392 * Math.cos(latitude * Math.PI / 180) / targetMetresPerPixel)
    ));
  }

  function venueMapCategory(venue) {
    const kind = String(venue.kind || '').toLocaleLowerCase('fr');
    const category = [
      venue.categoryPrimary,
      venue.category_primary,
      ...list(venue.categoryTags || venue.category_tags)
    ].join(' ').toLocaleLowerCase('fr');
    if (/\bh[oô]tel\b|h[eé]bergement|chambre/.test(category)) return 'hotel';
    return ['club', 'spa', 'bar', 'love_room'].includes(kind) ? kind : 'other';
  }

  function enabledMapMarkers(mapData) {
    const members = state.mapLayers.members ? list(mapData.members) : [];
    const venues = list(mapData.venues).filter((venue) => state.mapLayers[venueMapCategory(venue)]);
    return [...members, ...venues];
  }

  function markerPosition(marker, view) {
    const origin = mapPoint(view.center.latitude, view.center.longitude, view.zoom);
    const point = mapPoint(marker.latitude, marker.longitude, view.zoom);
    return {
      left: point.x - origin.x + view.width / 2,
      top: point.y - origin.y + view.height / 2
    };
  }

  function markerInViewport(marker, view, margin = 0) {
    const position = markerPosition(marker, view);
    return position.left >= -margin
      && position.left <= view.width + margin
      && position.top >= -margin
      && position.top <= view.height + margin;
  }

  function mapDistanceKm(from, marker) {
    const earthRadiusKm = 6371;
    const latitudeDelta = (Number(marker.latitude) - Number(from.latitude)) * Math.PI / 180;
    const longitudeDelta = (Number(marker.longitude) - Number(from.longitude)) * Math.PI / 180;
    const fromLatitude = Number(from.latitude) * Math.PI / 180;
    const toLatitude = Number(marker.latitude) * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  function mapVisibleVenues(mapData) {
    const view = mapViewport(mapData.center);
    return list(mapData.venues)
      .filter((venue) => state.mapLayers[venueMapCategory(venue)])
      .filter((venue) => markerInViewport(venue, view))
      .map((venue) => ({ ...venue, distanceFromCenterKm: Math.round(mapDistanceKm(view.center, venue)) }))
      .sort((left, right) => left.distanceFromCenterKm - right.distanceFromCenterKm);
  }

  function mapRadiusLabel() {
    const view = mapViewport(state.mapData?.center);
    const metresPerPixel = 156543.03392 * Math.cos(view.center.latitude * Math.PI / 180) / (2 ** view.zoom);
    return Math.max(1, Math.round(metresPerPixel * view.width / 2000));
  }

  function mapCanvas(mapData) {
    const view = mapViewport(mapData.center);
    const markers = enabledMapMarkers(mapData).filter((marker) => markerInViewport(marker, view, 40));
    const origin = mapPoint(view.center.latitude, view.center.longitude, view.zoom);
    const tileZoom = Math.floor(view.zoom);
    const tileSize = 256 * (2 ** (view.zoom - tileZoom));
    const tileCount = 2 ** tileZoom;
    const startX = Math.floor((origin.x - view.width / 2) / tileSize);
    const endX = Math.floor((origin.x + view.width / 2) / tileSize);
    const startY = Math.max(0, Math.floor((origin.y - view.height / 2) / tileSize));
    const endY = Math.min(tileCount - 1, Math.floor((origin.y + view.height / 2) / tileSize));
    const tiles = [];
    for (let tileX = startX; tileX <= endX; tileX += 1) {
      for (let tileY = startY; tileY <= endY; tileY += 1) {
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push(`<img class="map-tile" alt="" aria-hidden="true" src="https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${tileY}.png" style="left:${tileX * tileSize - origin.x + view.width / 2}px;top:${tileY * tileSize - origin.y + view.height / 2}px;width:${tileSize + 1}px;height:${tileSize + 1}px">`);
      }
    }
    const markerHtml = markers.map((marker) => {
      const { left, top } = markerPosition(marker, view);
      if (marker.type === 'member') {
        return `<button class="map-marker member-map-marker" style="left:${left}px;top:${top}px" data-open-profile="${e(marker.id)}" title="${e(marker.name)} · ${e(marker.zone)}">
          ${marker.photoUrl ? `<img src="${e(marker.photoUrl)}" alt="">` : `<span>${e(initials(marker.name))}</span>`}<small>${e(marker.name)}</small>
        </button>`;
      }
      return `<button class="map-marker venue-map-marker" style="left:${left}px;top:${top}px" data-open-venue="${e(marker.id)}" data-map-venue="true" title="${e(marker.name)} · ${e(marker.city || '')}">
        <span>⌑</span><small>${e(marker.name)}</small>
      </button>`;
    }).join('');
    return `<section class="velvet-map" data-dynamic-map data-map-width="${view.width}" tabindex="0" style="--map-width:${view.width}px;--map-height:${view.height}px" aria-label="Carte interactive. Faites glisser pour vous déplacer, utilisez la molette ou les boutons pour zoomer.">
      <div class="map-stage" style="width:${view.width}px;height:${view.height}px">${tiles.join('')}${markerHtml}</div>
      <div class="map-center-indicator" aria-hidden="true"><span></span></div>
      <span class="map-gesture-hint">Glisser pour explorer · molette pour zoomer</span>
      <div class="map-legend"><span><i class="member-dot"></i>Membres · zone approximative</span><span><i class="venue-dot"></i>Établissements · adresse publique</span></div>
      <small class="map-credit">© contributeurs OpenStreetMap</small>
    </section>`;
  }

  function mapVisibleVenuesPanel(mapData) {
    const venues = mapVisibleVenues(mapData);
    return `<section class="card map-visible-results" aria-live="polite">
      <header><div><p class="eyebrow">Zone actuellement affichée</p><h2>${venues.length ? `Lieux visibles sur la carte (${venues.length})` : 'Aucun lieu visible dans cette zone'}</h2></div><button class="text-button" type="button" data-map-recenter>Recentrer sur moi</button></header>
      <p>Cette liste suit automatiquement le déplacement, le zoom et les catégories actives de la carte.</p>
      ${venues.length ? `<div class="map-visible-list">${venues.slice(0, 8).map((venue) => `<button type="button" data-open-venue="${e(venue.id)}" data-map-venue="true">
        <span>${e(venue.distanceFromCenterKm)} km</span><div><strong>${e(venue.name)}</strong><small>${e([venue.city, venue.countryCode, venue.kind].filter(Boolean).join(' · '))}</small></div><i>→</i>
      </button>`).join('')}</div>` : '<small class="map-data-note">Déplacez ou dézoomez la carte. Les établissements sont positionnés depuis leur adresse publique lorsqu’elle peut être localisée avec fiabilité.</small>'}
    </section>`;
  }

  function renderMapWorkspace() {
    return `${mapVisibleVenuesPanel(state.mapData)}${mapCanvas(state.mapData)}`;
  }

  function refreshMapWorkspace() {
    const workspace = document.querySelector('#mapWorkspace');
    if (!workspace || !state.mapData) return;
    workspace.innerHTML = renderMapWorkspace();
    const radius = document.querySelector('[data-map-radius]');
    if (radius) radius.textContent = `Rayon d’environ ${mapRadiusLabel()} km`;
    bindMapInteraction();
  }

  function panMapByPixels(deltaX, deltaY) {
    const view = mapViewport(state.mapData?.center);
    const origin = mapPoint(view.center.latitude, view.center.longitude, view.zoom);
    state.mapCenter = mapCoordinates({
      x: origin.x - deltaX,
      y: origin.y - deltaY
    }, view.zoom);
    refreshMapWorkspace();
  }

  function bindMapInteraction() {
    const map = document.querySelector('[data-dynamic-map]');
    if (!map || map.dataset.interactive === 'true') return;
    map.dataset.interactive = 'true';
    const stage = map.querySelector('.map-stage');
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let deltaY = 0;

    const finishDrag = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      map.releasePointerCapture?.(pointerId);
      map.classList.remove('dragging');
      stage.style.transform = '';
      pointerId = null;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) panMapByPixels(deltaX, deltaY);
    };

    map.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('.map-marker')) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      deltaX = 0;
      deltaY = 0;
      map.setPointerCapture?.(pointerId);
      map.classList.add('dragging');
      event.preventDefault();
    });
    map.addEventListener('pointermove', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      deltaX = event.clientX - startX;
      deltaY = event.clientY - startY;
      stage.style.transform = `translate(${deltaX}px,${deltaY}px)`;
    });
    map.addEventListener('pointerup', finishDrag);
    map.addEventListener('pointercancel', finishDrag);
    map.addEventListener('wheel', (event) => {
      event.preventDefault();
      state.mapZoom = Math.max(5, Math.min(13, state.mapZoom + (event.deltaY < 0 ? 1 : -1)));
      refreshMapWorkspace();
    }, { passive: false });
    map.addEventListener('keydown', (event) => {
      const movements = {
        ArrowLeft: [80, 0],
        ArrowRight: [-80, 0],
        ArrowUp: [0, 80],
        ArrowDown: [0, -80]
      };
      if (!movements[event.key]) return;
      event.preventDefault();
      panMapByPixels(...movements[event.key]);
    });
    document.querySelector('[data-map-recenter]')?.addEventListener('click', () => {
      state.mapCenter = {
        latitude: Number(state.mapData.center?.latitude ?? 46.603354),
        longitude: Number(state.mapData.center?.longitude ?? 1.888334)
      };
      state.mapZoom = defaultMapZoom(state.mapCenter);
      refreshMapWorkspace();
    });

    mapResizeObserver?.disconnect();
    if ('ResizeObserver' in window) {
      mapResizeObserver = new ResizeObserver((entries) => {
        const width = Math.round(entries[0]?.contentRect?.width || 0);
        if (width && Math.abs(width - Number(map.dataset.mapWidth)) > 8) refreshMapWorkspace();
      });
      mapResizeObserver.observe(map);
    }
  }

  function renderMaps() {
    if (!state.mapData) {
      return `<div class="page">${pageHead('Localisation choisie', 'Maps', 'Velvet prépare la carte sans jamais exposer l’adresse ni la position exacte d’un membre.')}
        <section class="loading-state"><span class="loader"></span><p>Chargement des zones publiques…</p></section>
      </div>`;
    }
    const locationEnabled = state.mapData.center?.source === 'private_approximate_location';
    const layerOptions = [
      ['members', 'Membres'],
      ['club', 'Clubs'],
      ['spa', 'Spas'],
      ['bar', 'Bars'],
      ['love_room', 'Love rooms'],
      ['hotel', 'Hôtels'],
      ['other', 'Autres lieux']
    ];
    return `<div class="page">${pageHead('Zones publiques et adresses d’établissements', 'Maps', 'Les membres sont placés au centre approximatif de la zone qu’ils ont choisi d’afficher. Les établissements sont localisés depuis leur adresse publique.')}
      <section class="card map-controls" aria-label="Réglages de la carte">
        <div class="map-zoom-controls">
          <button type="button" data-map-zoom="-1" aria-label="Dézoomer">−</button>
          <span><small>Zone affichée</small><strong data-map-radius>Rayon d’environ ${e(mapRadiusLabel())} km</strong></span>
          <button type="button" data-map-zoom="1" aria-label="Zoomer">+</button>
        </div>
        <fieldset><legend>Afficher sur la carte</legend><div class="map-layer-options">
          ${layerOptions.map(([value, label]) => `<label><input type="checkbox" data-map-layer="${value}"${state.mapLayers[value] ? ' checked' : ''}><span>${e(label)}</span></label>`).join('')}
        </div></fieldset>
        ${locationEnabled
          ? '<p class="proximity-note">Carte centrée sur votre localisation approximative. Le rayon initial est de 50 km.</p>'
          : '<p class="proximity-note">Activez votre zone pour centrer la carte dans un rayon initial de 50 km autour de vous. Votre position exacte n’est jamais enregistrée.</p><button class="secondary" type="button" data-enable-location>Activer ma zone de proximité</button>'}
      </section>
      <div id="mapWorkspace" class="map-workspace">${renderMapWorkspace()}</div>
    </div>`;
  }

  async function openMaps() {
    content.innerHTML = renderMaps();
    try {
      state.mapData = await api('/api/members/map');
      state.mapCenter = {
        latitude: Number(state.mapData.center?.latitude ?? 46.603354),
        longitude: Number(state.mapData.center?.longitude ?? 1.888334)
      };
      state.mapZoom = defaultMapZoom(state.mapCenter);
      if (state.route === 'maps') {
        content.innerHTML = renderMaps();
        bindDynamicForms();
      }
    } catch (error) {
      content.innerHTML = `<div class="page">${emptyState('Carte indisponible', `Velvet n’a pas pu charger Maps : ${errorMessages[error.message] || error.message}`, '!')}</div>`;
    }
  }

  async function enableProximity(button) {
    if (!navigator.geolocation) {
      toast('La localisation n’est pas disponible sur cet appareil.', true);
      return;
    }
    button.disabled = true;
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
      ));
      state.locationData = await api('/api/members/location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          consent: true
        })
      });
      state.mapData = await api('/api/members/map');
      state.mapCenter = {
        latitude: Number(state.mapData.center?.latitude ?? 46.603354),
        longitude: Number(state.mapData.center?.longitude ?? 1.888334)
      };
      state.mapZoom = defaultMapZoom(state.mapCenter);
      content.innerHTML = state.route === 'maps' ? renderMaps() : renderHome();
      bindDynamicForms();
      toast('Votre zone approximative est activée.');
    } catch (error) {
      const message = error?.code
        ? 'Autorisez la localisation dans votre navigateur pour activer la proximité.'
        : (errorMessages[error.message] || error.message);
      toast(message, true);
      button.disabled = false;
    }
  }

  function eventTile(event) {
    const date = new Date(event.starts_at);
    return `<button class="card event-tile" data-open-event="${e(event.id)}">
      <time datetime="${e(event.starts_at)}"><strong>${e(date.toLocaleDateString('fr-FR', { day: '2-digit' }))}</strong><span>${e(date.toLocaleDateString('fr-FR', { month: 'short' }))}</span></time>
      <span><small>${e(date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))} · ${e(event.location_public || 'Lieu confidentiel')}${Number.isFinite(Number(event.distance_km)) ? ` · ${e(event.distance_km)} km` : ''}</small><b>${e(event.title)}</b><em>${e(event.capacity)} places · ${e(event.audience || 'Membres Velvet')}</em></span>
      <i>→</i>
    </button>`;
  }

  function venueTile(venue) {
    const distance = Number(venue._catalogDistanceKm);
    const visitors = venueUpcomingProfiles(venue.id);
    return `<button class="card venue-tile" data-open-venue="${e(venue.id)}">
      <span class="venue-tile-main"><span class="venue-symbol">⌑</span><span><small>${e(venue.kind || 'lieu Velvet')} · ${e(venue.city || 'Localisation à confirmer')}${Number.isFinite(distance) ? ` · ${e(Math.round(distance))} km` : Number.isFinite(Number(venue.distance_km)) ? ` · ${e(Math.round(Number(venue.distance_km)))} km` : ''}</small><b>${e(venue.name)}</b><em>${e(venue.claim_status === 'claimed' ? 'Fiche professionnelle reliée à Velvet Pro' : 'Référencé par Velvet · informations à confirmer')}</em></span><i>→</i></span>
      <span class="venue-tile-community">
        <strong>${visitors.length} profil${visitors.length > 1 ? 's' : ''} annoncé${visitors.length > 1 ? 's' : ''}</strong>
        ${visitors.length ? `<span class="venue-presence-rail">${visitors.slice(0, 7).map((profile) => {
          const cover = approvedProfilePhotos(profile)[0];
          return `<span class="venue-presence-avatar" title="${e(profile.display_name)}">${cover ? `<img src="${e(cover.previewUrl)}" alt="">` : e(initials(profile.display_name))}</span>`;
        }).join('')}</span>` : '<small>La communauté apparaîtra ici.</small>'}
      </span>
    </button>`;
  }

  function venueUpcomingProfiles(venueId) {
    const today = parisDayKey();
    const rows = list(state.plans.venueVisits)
      .filter((visit) => visit.venue_id === venueId && String(visit.visit_date || '') >= today)
      .map((visit) => visit.profile_id === state.profile.id
        ? state.profile
        : list(state.directory.profiles).find((profile) => profile.id === visit.profile_id))
      .filter(Boolean);
    return [...new Map(rows.map((profile) => [profile.id, profile])).values()];
  }

  function renderEvents() {
    const events = state.eventNearbyOnly ? nearbyHomeEvents(50) : list(state.directory.events);
    const action = state.eventNearbyOnly
      ? '<button class="secondary" type="button" data-all-events>Voir tout l’agenda</button>'
      : '';
    return `<div class="page">${pageHead(
      state.eventNearbyOnly ? 'À moins de 50 km' : 'Agenda réel',
      state.eventNearbyOnly ? 'Événements près de chez toi' : 'Sorties',
      state.eventNearbyOnly
        ? 'Soirées de clubs, événements professionnels et soirées privées situés dans ta zone approximative.'
        : 'Seules les sorties effectivement publiées dans Supabase apparaissent ici.',
      action
    )}
      ${events.length ? `<section class="grid two">${events.map(eventTile).join('')}</section>` : emptyState(
        state.eventNearbyOnly ? 'Aucun événement dans un rayon de 50 km' : 'Aucune sortie publiée',
        state.eventNearbyOnly
          ? 'Élargis à tout l’agenda pour découvrir les autres événements publiés.'
          : 'Aucune soirée fictive n’est conservée. Les prochaines sorties apparaîtront après leur publication par un organisateur ou un établissement validé.',
        '✦',
        state.eventNearbyOnly ? '<button class="secondary" type="button" data-all-events>Voir tout l’agenda</button>' : ''
      )}
    </div>`;
  }

  function normalizedVenueText(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  }

  function venueRegion(venue) {
    const explicit = String(venue.region || venue.department_or_province || '').trim();
    if (explicit && [...VENUE_REGIONS.FR, ...VENUE_REGIONS.BE].includes(explicit)) return explicit;
    const country = venue.country_code;
    const latitude = Number(venue.latitude);
    const longitude = Number(venue.longitude);
    if (venue.latitude === null || venue.latitude === ''
      || venue.longitude === null || venue.longitude === ''
      || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return explicit;
    if (country === 'BE') {
      if (latitude >= 50.75 && latitude <= 50.95 && longitude >= 4.22 && longitude <= 4.52) return 'Bruxelles-Capitale';
      return latitude >= 50.72 ? 'Flandre' : 'Wallonie';
    }
    const centers = VENUE_REGION_CENTERS.filter(([code]) => code === country);
    return centers
      .map(([, label, centerLatitude, centerLongitude]) => ({
        label,
        distance: mapDistanceKm(
          { latitude: centerLatitude, longitude: centerLongitude },
          { latitude, longitude }
        )
      }))
      .sort((left, right) => left.distance - right.distance)[0]?.label || explicit;
  }

  function venueRegionOptions() {
    const countries = state.venueCountry ? [state.venueCountry] : ['FR', 'BE'];
    return countries.map((country) => `<optgroup label="${country === 'FR' ? 'France' : 'Belgique'}">${
      VENUE_REGIONS[country].map((region) => `<option value="${e(region)}"${state.venueRegion === region ? ' selected' : ''}>${e(region)}</option>`).join('')
    }</optgroup>`).join('');
  }

  function renderVenues() {
    const query = state.venueQuery.toLocaleLowerCase('fr');
    const locationTerm = normalizedVenueText(state.venueLocationQuery);
    const radius = Math.max(5, Math.min(200, Number(state.venueRadius) || 50));
    const hasCenter = Number.isFinite(Number(state.venueCenter?.latitude))
      && Number.isFinite(Number(state.venueCenter?.longitude));
    const venues = list(state.directory.venueDirectory)
      .map((venue) => {
        const latitude = Number(venue.latitude);
        const longitude = Number(venue.longitude);
        const hasCoordinates = venue.latitude !== null && venue.latitude !== ''
          && venue.longitude !== null && venue.longitude !== ''
          && Number.isFinite(latitude) && Number.isFinite(longitude);
        return {
          ...venue,
          _catalogRegion: venueRegion(venue),
          _catalogDistanceKm: hasCenter && hasCoordinates
            ? mapDistanceKm(state.venueCenter, { latitude, longitude })
            : null
        };
      })
      .filter((venue) =>
        (!query || `${venue.name} ${venue.city || ''} ${venue.address_public || ''}`.toLocaleLowerCase('fr').includes(query))
        && (!state.venueKind || venue.kind === state.venueKind)
        && (!state.venueCountry || venue.country_code === state.venueCountry)
        && (!state.venueRegion || venue._catalogRegion === state.venueRegion)
        && (hasCenter
          ? Number.isFinite(venue._catalogDistanceKm) && venue._catalogDistanceKm <= radius
          : !locationTerm || normalizedVenueText(`${venue.city || ''} ${venue.postal_code || ''} ${venue.address_public || ''}`).includes(locationTerm))
      )
      .sort((left, right) => hasCenter
        ? left._catalogDistanceKm - right._catalogDistanceKm
        : String(left.name).localeCompare(String(right.name), 'fr'));
    const radiusHelp = hasCenter
      ? `Dans un rayon de ${radius} km autour de ${e(state.venueCenter.label || state.venueLocationQuery)}.`
      : 'Choisis une ville ou un code postal dans les suggestions pour activer le périmètre.';
    return `<div class="page venues-page">${pageHead(
      'Lieux & sorties',
      'Clubs et établissements',
      'Une recherche distincte des membres, avec les soirées et les profils qui ont annoncé leur présence.',
      '<div class="page-head-actions"><button class="secondary" type="button" data-route="events">Agenda</button><button class="secondary" type="button" data-route="maps">Carte</button></div>'
    )}
      <section class="card venue-catalog-filters">
        <div class="venue-catalog-grid">
          <label>Nom ou mot-clé<input id="venueCatalogSearch" value="${e(state.venueQuery)}" placeholder="Nom ou adresse"></label>
          <label>Type<select id="venueCatalogKind"><option value="">Tous les types</option>${[['club','Club'],['spa','Spa / sauna'],['bar','Bar'],['love_room','Love room'],['other','Autre professionnel']].map(([value,label]) => `<option value="${value}"${state.venueKind === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
          <label>Pays<select id="venueCatalogCountry"><option value="">France et Belgique</option><option value="FR"${state.venueCountry === 'FR' ? ' selected' : ''}>France</option><option value="BE"${state.venueCountry === 'BE' ? ' selected' : ''}>Belgique</option></select></label>
          <label>Région<select id="venueCatalogRegion"><option value="">Toutes les régions</option>${venueRegionOptions()}</select></label>
          <label class="venue-location-filter">Ville ou code postal
            <span class="commune-input"><input id="venueCatalogLocation" value="${e(state.venueLocationQuery)}" autocomplete="off" placeholder="Exemple : 62400 ou Béthune"><span class="commune-results" data-venue-location-results hidden></span></span>
          </label>
          <label class="venue-radius-filter">Périmètre <strong data-venue-radius-label>${radius} km</strong>
            <input id="venueCatalogRadius" type="range" min="5" max="200" step="5" value="${radius}"${hasCenter ? '' : ' disabled'}>
            <small>${radiusHelp}</small>
          </label>
        </div>
        <div class="venue-filter-footer"><p class="muted">${venues.length} résultat${venues.length > 1 ? 's' : ''} · les données marquées « à confirmer » ne constituent pas une validation professionnelle.</p>${state.venueLocationQuery ? '<button class="text-button" type="button" data-clear-venue-location>Effacer la zone</button>' : ''}</div>
      </section>
      ${venues.length ? `<section class="venue-directory-grid">${venues.map(venueTile).join('')}</section>` : emptyState('Aucun établissement correspondant', 'Modifie les filtres pour élargir la recherche.', '⌑')}
    </div>`;
  }

  function notificationIcon(type) {
    return ({
      messages: '✉',
      likes: '♡',
      album_access: '◇',
      events: '✦',
      recommendations: '★',
      security: '⌾'
    })[type] || '○';
  }

  function notificationTile(notification) {
    const actor = list(state.directory.profiles).find((profile) => profile.id === notification.actor_profile_id);
    if (actor) {
      return profilePreviewCard(actor, {
        variant: 'notification',
        notification
      });
    }
    return `<button class="notification-tile ${notification.read_at ? '' : 'unread'}" data-open-notification="${e(notification.id)}">
      <span class="notification-avatar">${notificationIcon(notification.event_type)}</span>
      <span><small>Velvet · ${e(viewedAtLabel(notification.created_at))}</small><b>${e(notification.title)}</b><em>${e(notification.body || '')}</em></span>
      ${notification.read_at ? '<i>→</i>' : '<i class="unread-dot" aria-label="Non lue"></i>'}
    </button>`;
  }

  function renderNotifications() {
    const notifications = list(state.notifications);
    return `<div class="page">${pageHead(
      'Activité authentique',
      'Notifications',
      'Chaque élément correspond à une action réellement enregistrée dans Velvet.',
      state.unreadCount ? `<button class="secondary" data-read-all-notifications>Tout marquer comme lu · ${state.unreadCount}</button>` : ''
    )}
      ${notifications.length ? `<section class="notification-feed profile-preview-feed">${notifications.map(notificationTile).join('')}</section>` : emptyState('Aucune notification', 'Les messages, réactions, accès aux albums et inscriptions apparaîtront ici lorsqu’une action réelle aura lieu.', '○')}
    </div>`;
  }

  const AUDIENCE_OPTIONS = [
    ['couple', 'Couples', 'Profils créés et partagés à deux'],
    ['woman', 'Femmes', 'Profils individuels féminins'],
    ['man', 'Hommes', 'Profils individuels masculins'],
    ['trans_nonbinary', 'Personnes trans et non binaires', 'Identités transgenres et non binaires'],
    ['other', 'Autres identités', 'Identité privée, fluide ou non classée']
  ];

  const NOTIFICATION_EVENTS = [
    ['messages', 'Nouveaux messages', 'Conversation privée et réponses'],
    ['likes', 'Coups de cœur', 'Réactions sur votre profil ou vos photos'],
    ['album_access', 'Albums privés', 'Demandes, accès accordés et expirations'],
    ['profile_views', 'Visites du profil', 'Membres ayant découvert votre univers'],
    ['events', 'Sorties', 'Inscriptions, rappels et changements'],
    ['recommendations', 'Recommandations', 'Nouvelles compatibilités et recommandations'],
    ['security', 'Sécurité du compte', 'Connexion, validation et alertes Velvet']
  ];

  function settingsChecks(name, options, selected) {
    const values = new Set(list(selected));
    return `<div class="settings-options">${options.map(([value, label, help]) => `
      <label class="settings-toggle">
        <span><strong>${e(label)}</strong><small>${e(help)}</small></span>
        <input type="checkbox" name="${e(name)}" value="${e(value)}"${values.has(value) ? ' checked' : ''}>
        <i aria-hidden="true"></i>
      </label>`).join('')}</div>`;
  }

  function notificationEventChecks(events = {}) {
    return `<div class="settings-options">${NOTIFICATION_EVENTS.map(([value, label, help]) => `
      <label class="settings-toggle">
        <span><strong>${e(label)}</strong><small>${e(help)}</small></span>
        <input type="checkbox" name="event_type" value="${e(value)}"${events[value] !== false ? ' checked' : ''}>
        <i aria-hidden="true"></i>
      </label>`).join('')}</div>`;
  }

  function renderSettingsView(settings) {
    const privacy = settings.privacy || {};
    const notifications = settings.notifications || {};
    const installed = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
    const browserPermission = 'Notification' in window ? Notification.permission : 'unsupported';
    const lifecycleProfile = state.lifecycle?.profile || {};
    const lifecycleAction = state.lifecycle?.action;
    const access = state.access || {};
    const accessFeatures = access.features || {};
    const signature = ['signature', 'beta_full'].includes(access.tier);
    const memberPrices = list(state.billingCatalog?.prices).filter((price) => price.plan_code === 'member_signature');
    const priceLabel = (price) => (Number(price.amount_cents || 0) / 100).toLocaleString('fr-FR', {
      style: 'currency',
      currency: price.currency || 'EUR'
    });
    return `<div class="page settings-page">
      ${pageHead('Confidentialité · tranquillité · contrôle', 'Paramètres', 'Décide précisément qui peut te découvrir, qui peut t’écrire et ce que Velvet est autorisé à te signaler.')}
      <form id="settingsForm" class="settings-layout">
        <section class="card settings-card membership-card ${signature ? 'active' : ''}">
          <div class="membership-head"><div><p class="eyebrow">Votre accès</p><h2>${signature ? 'Velvet Signature' : 'Velvet Découverte'}</h2><p>${access.source === 'verified_woman' ? 'Accès complet offert à votre profil vérifié.' : access.source === 'founder' ? 'Accès fondateur offert pendant la période de lancement.' : signature ? 'Votre accès complet est actif.' : 'Le cœur de Velvet reste accessible gratuitement.'}</p></div><span>${signature ? 'SIGNATURE' : 'DÉCOUVERTE'}</span></div>
          ${access.validUntil ? `<small>Accès actif jusqu’au ${e(new Date(access.validUntil).toLocaleDateString('fr-FR'))}.</small>` : ''}
          <div class="membership-comparison">
            <div><strong>Découverte</strong><small>Recherche essentielle</small><small>3 nouvelles conversations / semaine</small><small>10 profils suivis</small><small>1 essai Velvet IA</small></div>
            <div><strong>Signature</strong><small>Recherche avancée et sauvegardée</small><small>Conversations et suivis illimités</small><small>20 textes IA / mois</small><small>Alertes personnalisées</small></div>
          </div>
          ${signature ? `<p class="membership-usage">Velvet IA : ${e(accessFeatures.profileAiUsed || 0)} / ${e(accessFeatures.profileAiLimit || '∞')} · profils suivis : ${e(accessFeatures.followingUsed || 0)}${accessFeatures.followLimit ? ` / ${e(accessFeatures.followLimit)}` : ''}</p>` : `<div class="membership-prices">${memberPrices.map((price) => `<button class="secondary" type="button" data-checkout-price="${e(price.price_code)}"><b>${e(priceLabel(price))}</b><small>${price.interval_count === 3 ? 'pour 3 mois' : price.interval_unit === 'year' ? 'par an' : 'par mois'}</small></button>`).join('')}</div>`}
          ${state.billingCatalog?.provider?.configured ? '' : '<small>Le module est prêt. L’ouverture des paiements attend la validation écrite du partenaire bancaire spécialisé.</small>'}
          <div class="promotion-redeem" data-promotion-redeem>
            <label>Vous avez un code promotionnel ?<input name="code" autocomplete="off" maxlength="40" placeholder="VELVET-XXXX-XXXX-XXXX"></label>
            <button class="secondary" type="button">Activer le code</button>
          </div>
        </section>
        <section class="card settings-card appearance-card">
          <p class="eyebrow">Apparence</p><h2>Ambiance Velvet</h2>
          <p>Bascule tout l’espace membre entre le velours sombre et une version claire ivoire, beige, or et bordeaux.</p>
          <div class="settings-options">
            <label class="settings-toggle">
              <span><strong>Mode clair</strong><small>Le choix est mémorisé sur cet appareil et appliqué immédiatement.</small></span>
              <input type="checkbox" name="light_theme"${state.theme === 'light' ? ' checked' : ''}>
              <i aria-hidden="true"></i>
            </label>
          </div>
          <div class="theme-swatches" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        </section>
        <section class="card settings-card">
          <p class="eyebrow">Visibilité</p><h2>Qui peut voir votre profil ?</h2>
          <p>Les catégories décochées ne verront plus votre fiche dans Recherche et ne pourront pas l’ouvrir directement.</p>
          ${settingsChecks('discoverable_by', AUDIENCE_OPTIONS, privacy.discoverable_by)}
        </section>
        <section class="card settings-card">
          <p class="eyebrow">Messagerie</p><h2>Qui peut vous contacter ?</h2>
          <p>Ce réglage est contrôlé côté serveur lors de la création d’une conversation.</p>
          ${settingsChecks('contactable_by', AUDIENCE_OPTIONS, privacy.contactable_by)}
        </section>
        <section class="card settings-card">
          <p class="eyebrow">Origine des alertes</p><h2>Notifications venant de…</h2>
          <p>Filtre les alertes sociales selon le type de profil à l’origine de l’action.</p>
          ${settingsChecks('notify_from', AUDIENCE_OPTIONS, notifications.notify_from)}
        </section>
        <section class="card settings-card">
          <p class="eyebrow">Activité</p><h2>Que souhaitez-vous recevoir ?</h2>
          ${notificationEventChecks(notifications.event_types)}
        </section>
        <section class="card settings-card">
          <p class="eyebrow">Canaux</p><h2>Où Velvet peut vous prévenir ?</h2>
          <div class="settings-options">
            <label class="settings-toggle"><span><strong>Dans Velvet</strong><small>Badges et centre de notifications</small></span><input type="checkbox" name="in_app_enabled"${notifications.in_app_enabled !== false ? ' checked' : ''}><i></i></label>
            <label class="settings-toggle"><span><strong>Notifications du téléphone</strong><small>Web mobile et PWA · état : ${e(browserPermission)}</small></span><input type="checkbox" name="browser_enabled"${notifications.browser_enabled ? ' checked' : ''}${browserPermission === 'unsupported' ? ' disabled' : ''}><i></i></label>
            <label class="settings-toggle"><span><strong>Par e-mail</strong><small>Récapitulatif et alertes choisies</small></span><input type="checkbox" name="email_enabled"${notifications.email_enabled !== false ? ' checked' : ''}><i></i></label>
          </div>
          <div class="quiet-hours">
            <label>Mode silencieux à partir de<input type="time" name="quiet_hours_start" value="${e(String(notifications.quiet_hours_start || '').slice(0, 5))}"></label>
            <label>Reprendre les alertes à<input type="time" name="quiet_hours_end" value="${e(String(notifications.quiet_hours_end || '').slice(0, 5))}"></label>
          </div>
          <button class="secondary" type="button" data-test-notification>Autoriser et tester une notification</button>
        </section>
        <section class="card settings-card mobile-app-card">
          <p class="eyebrow">Web mobile</p><h2>Velvet sur votre écran d’accueil</h2>
          <p>${installed ? 'Velvet est déjà ouvert comme une application sur cet appareil.' : 'Installe Velvet depuis le navigateur pour obtenir un affichage plein écran, un accès rapide et les notifications web.'}</p>
          <button class="secondary" type="button" data-install-velvet${state.installPrompt || installed ? '' : ' hidden'}>${installed ? 'Velvet est installé' : 'Installer Velvet'}</button>
          <small>Sur iPhone : Partager → Sur l’écran d’accueil. Sur Android : menu du navigateur → Installer l’application.</small>
        </section>
        <section class="card settings-card account-lifecycle-card">
          <p class="eyebrow">Cycle de vie du profil</p><h2>Pause et suppression</h2>
          ${state.lifecycle?.migrationPending ? '<p class="status-box">Cette fonction sera disponible dès l’application de la migration Supabase 0024.</p>'
            : lifecycleAction ? `<p class="status-box">Une demande de ${lifecycleAction.action_type === 'delete' ? 'suppression' : 'mise en pause'} attend les confirmations par e-mail.${lifecycleAction.execute_after ? ` Suppression définitive prévue le ${e(new Date(lifecycleAction.execute_after).toLocaleDateString('fr-FR'))}.` : ''}</p><button class="secondary" type="button" data-lifecycle-action="cancel">Annuler la demande</button>`
            : lifecycleProfile.lifecycle_state === 'paused' ? '<p>Le profil est conservé mais invisible pour les autres membres.</p><button class="primary" type="button" data-lifecycle-action="resume">Réactiver mon profil</button>'
              : lifecycleProfile.lifecycle_state === 'deletion_pending' ? '<p>Le profil est invisible et conservé pendant 30 jours avant effacement définitif.</p><button class="primary" type="button" data-lifecycle-action="cancel">Annuler la suppression</button>'
                : `<p>La pause conserve la fiche. La suppression la rend invisible après validation, puis efface définitivement les données 30 jours plus tard.</p><div class="lifecycle-actions"><button class="secondary" type="button" data-lifecycle-action="pause">Mettre le profil en pause</button><button class="danger" type="button" data-lifecycle-action="delete">Supprimer le compte</button></div>`}
          <small>Pour une fiche couple, Velvet adresse un lien personnel à chaque membre actif et n’applique l’action qu’après toutes les validations.</small>
        </section>
        <footer class="settings-save">
          <p id="settingsStatus" class="status-box" hidden></p>
          <button class="primary" type="submit">Enregistrer mes paramètres</button>
        </footer>
      </form>
    </div>`;
  }

  async function openSettings() {
    content.innerHTML = `<div class="page"><section class="loading-state"><span class="loader"></span><p>Chargement de tes préférences…</p></section></div>`;
    try {
      [state.settings, state.lifecycle, state.billingCatalog] = await Promise.all([
        api('/api/members/settings'),
        api('/api/members/account-actions').catch(() => ({
          profile: { lifecycle_state: 'active' },
          action: null,
          migrationPending: true
        })),
        api('/api/billing/catalog').catch(() => ({ prices: [], provider: { configured: false } }))
      ]);
      content.innerHTML = renderSettingsView(state.settings);
      bindSettings();
      content.focus();
    } catch (error) {
      content.innerHTML = `<div class="page">${emptyState('Paramètres indisponibles', errorMessages[error.message] || error.message, '!')}</div>`;
    }
  }

  function bindSettings() {
    const form = document.querySelector('#settingsForm');
    if (!form) return;
    form.querySelector('[name=light_theme]')?.addEventListener('change', (event) => {
      state.theme = applyTheme(event.target.checked ? 'light' : 'dark');
      storeTheme(state.theme);
    });
    const browserToggle = form.querySelector('[name=browser_enabled]');
    const synchronizeBrowserNotifications = async (enabled) => {
      if (!browserToggle || !window.VelvetPWA) return false;
      browserToggle.disabled = true;
      try {
        if (!enabled) {
          await window.VelvetPWA.disableNotifications();
          browserToggle.checked = false;
          toast('Notifications désactivées sur cet appareil.');
          return true;
        }
        const result = await window.VelvetPWA.enableNotifications();
        browserToggle.checked = true;
        toast(result?.subscribed
          ? 'Notifications Velvet activées sur cet appareil.'
          : 'Autorisation accordée. L’envoi distant doit encore être configuré sur cet environnement.');
        return true;
      } catch (error) {
        browserToggle.checked = false;
        toast(error.message, true);
        return false;
      } finally {
        browserToggle.disabled = false;
      }
    };
    browserToggle?.addEventListener('change', (event) => {
      synchronizeBrowserNotifications(event.target.checked);
    });
    form.querySelector('[data-promotion-redeem] button')?.addEventListener('click', async (event) => {
      const redeem = event.currentTarget.closest('[data-promotion-redeem]');
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await api('/api/billing/promotion', {
          method: 'POST',
          body: JSON.stringify({ code: redeem.querySelector('[name=code]')?.value })
        });
        state.access = result.access;
        content.innerHTML = renderSettingsView(state.settings);
        bindSettings();
        toast('Votre accès Velvet Signature est activé.');
      } catch (error) {
        toast(errorMessages[error.message] || error.message, true);
        button.disabled = false;
      }
    });
    form.querySelectorAll('[data-checkout-price]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await api('/api/billing/checkout', {
          method: 'POST',
          body: JSON.stringify({ priceCode: button.dataset.checkoutPrice })
        });
        if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      } catch (error) {
        toast(errorMessages[error.message] || error.message, true);
        button.disabled = false;
      }
    }));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type=submit]');
      const status = form.querySelector('#settingsStatus');
      const data = new FormData(form);
      const enabledEvents = new Set(data.getAll('event_type'));
      state.theme = applyTheme(data.has('light_theme') ? 'light' : 'dark');
      storeTheme(state.theme);
      const payload = {
        discoverable_by: data.getAll('discoverable_by'),
        contactable_by: data.getAll('contactable_by'),
        notify_from: data.getAll('notify_from'),
        event_types: Object.fromEntries(NOTIFICATION_EVENTS.map(([name]) => [name, enabledEvents.has(name)])),
        in_app_enabled: data.has('in_app_enabled'),
        browser_enabled: data.has('browser_enabled'),
        email_enabled: data.has('email_enabled'),
        quiet_hours_start: data.get('quiet_hours_start'),
        quiet_hours_end: data.get('quiet_hours_end')
      };
      button.disabled = true;
      status.hidden = false;
      status.textContent = 'Enregistrement sécurisé…';
      try {
        state.settings = await api('/api/members/settings', { method: 'POST', body: JSON.stringify(payload) });
        status.textContent = 'Tes préférences sont enregistrées et appliquées.';
        toast('Paramètres enregistrés.');
      } catch (error) {
        status.textContent = errorMessages[error.message] || error.message;
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });

    form.querySelector('[data-test-notification]')?.addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      await synchronizeBrowserNotifications(true);
      event.currentTarget.disabled = false;
    });

    form.querySelectorAll('[data-lifecycle-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        const action = button.dataset.lifecycleAction;
        try {
          state.lifecycle = await api('/api/members/account-actions', {
            method: 'POST',
            body: JSON.stringify({ action })
          });
          content.innerHTML = renderSettingsView(state.settings);
          bindSettings();
          toast(['pause','delete'].includes(action)
            ? 'Les e-mails de confirmation ont été envoyés.'
            : 'Le profil est de nouveau actif.');
        } catch (error) {
          toast(errorMessages[error.message] || error.message, true);
          button.disabled = false;
        }
      });
    });

    form.querySelector('[data-install-velvet]')?.addEventListener('click', async () => {
      if (!state.installPrompt) {
        toast('Utilise le menu du navigateur puis « Sur l’écran d’accueil » ou « Installer ».');
        return;
      }
      await state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
    });
  }

  function renderConversations() {
    const rows = list(state.directory.conversations);
    return `<div class="page">${pageHead('Messagerie privée', 'Conversations', 'Seules les conversations auxquelles ton compte participe sont affichées.')}
      ${rows.length ? `<section class="grid two">${rows.map((conversation) => {
        const streak = list(state.engagement?.streaks).find((row) => row.conversation_id === conversation.id);
        return `<button class="card conversation" data-open-conversation="${e(conversation.id)}">
          <div class="conversation-heading"><p class="eyebrow">${e(conversation.kind)}</p>${streak?.current_streak ? `<span class="streak-badge" title="Série de discussion active">🔥 ${e(streak.current_streak)} j</span>` : ''}</div>
          <h2>${e(conversation.subject || 'Conversation privée')}</h2>
          <p>${list(conversation.conversation_members).length} participant(s)</p>
          ${streak?.longest_streak ? `<small>Meilleure série : ${e(streak.longest_streak)} jour${streak.longest_streak > 1 ? 's' : ''}</small>` : ''}
        </button>`;
      }).join('')}</section>` : emptyState('Aucune conversation', 'Tes échanges réels apparaîtront ici. Aucun historique fictif n’a été conservé.', '◌')}
    </div>`;
  }

  function conversationStreakCard(streak) {
    const current = Number(streak?.current_streak || 0);
    const longest = Number(streak?.longest_streak || 0);
    const qualified = Number(streak?.qualified_days || 0);
    if (!current && !longest) {
      return `<aside class="conversation-streak-card dormant">
        <span class="streak-flame">◇</span>
        <div><small>Complicité Velvet</small><strong>Commencez votre série</strong><p>Une journée compte lorsque les deux profils échangent au moins un message.</p></div>
      </aside>`;
    }
    const nextMilestone = [3, 7, 14, 30, 60, 100].find((value) => value > current);
    return `<aside class="conversation-streak-card">
      <span class="streak-flame">🔥</span>
      <div><small>Série de discussion</small><strong>${e(current)} jour${current > 1 ? 's' : ''} de complicité</strong>
        <p>${current ? `Échangez aujourd’hui pour entretenir la flamme.${nextMilestone ? ` Prochain palier : ${nextMilestone} jours.` : ''}` : `Votre meilleure série reste de ${longest} jours.`}</p>
        <div class="streak-stats"><span><b>${e(longest)}</b> record</span><span><b>${e(qualified)}</b> jours partagés</span></div>
      </div>
    </aside>`;
  }

  function messageAttachments(message) {
    const rows = list(message.attachments);
    if (!rows.length) return '';
    return `<div class="message-attachments">${rows.map((attachment) => {
      if (!attachment.previewUrl) return '';
      if (attachment.media_type === 'image') {
        return `<a href="${e(attachment.previewUrl)}" target="_blank" rel="noopener noreferrer"><img src="${e(attachment.previewUrl)}" alt="${e(attachment.original_name)}"></a>`;
      }
      if (attachment.media_type === 'video') {
        return `<video controls preload="metadata" src="${e(attachment.previewUrl)}"><a href="${e(attachment.previewUrl)}">Télécharger la vidéo</a></video>`;
      }
      return `<a class="message-document" href="${e(attachment.previewUrl)}" target="_blank" rel="noopener noreferrer">▤ ${e(attachment.original_name)} · ${e(Math.max(1, Math.round(Number(attachment.size_bytes || 0) / 1024)))} Ko</a>`;
    }).join('')}</div>`;
  }

  async function openConversation(conversationId) {
    content.innerHTML = `<div class="page"><section class="loading-state"><span class="loader"></span><p>Chargement de la conversation…</p></section></div>`;
    try {
      const result = await api(`/api/members/messages?conversationId=${encodeURIComponent(conversationId)}`);
      const conversation = list(state.directory.conversations).find((row) => row.id === conversationId);
      if (result.streak) {
        const otherStreaks = list(state.engagement?.streaks).filter((row) => row.conversation_id !== conversationId);
        state.engagement.streaks = [result.streak, ...otherStreaks];
      }
      content.innerHTML = `<div class="page">
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

  document.querySelector('#logoutButton').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
    window.location.href = '/';
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
