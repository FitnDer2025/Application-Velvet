(() => {
  document.body.classList.add('admission-locked');
  const state = {
    account: null,
    profile: null,
    directory: {
      profiles: [],
      establishments: [],
      events: [],
      conversations: [],
      recommendations: []
    },
    organizerRequest: null,
    membership: null,
    personalProfileComplete: false,
    photos: [],
    settings: null,
    route: 'home',
    selectedProfileId: null,
    profileTab: 'couple',
    editing: false,
    installPrompt: null,
    serviceWorker: null
  };

  const content = document.querySelector('#content');
  const toastNode = document.querySelector('#toast');
  const navButtons = [...document.querySelectorAll('[data-route]')];

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
    personal_photo_owner_required: 'Chaque personne doit publier elle-même son portrait.'
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
      icon: '/assets/velvet-icon.svg',
      badge: '/assets/velvet-icon.svg',
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

  function profileCarousel(profile) {
    const photos = approvedProfilePhotos(profile);
    if (!photos.length) return '';
    return `<div class="profile-carousel" aria-label="Photos publiques de ${e(profile.display_name)}">
      ${photos.map((photo, index) => `<figure><img src="${e(photo.previewUrl)}" alt="Photo publique ${index + 1} de ${e(profile.display_name)}"></figure>`).join('')}
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
      <p class="eyebrow">${e(kicker)}</p><h1>${e(title)}</h1><p>${e(text)}</p>
    </div>${action}</header>`;
  }

  async function loadAll() {
    try {
      const profileResult = await api('/api/members/profile');
      state.profile = profileResult.profile;
      state.account = profileResult.account;
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
      const [directoryResult, organizerResult] = await Promise.all([
        api('/api/members/directory'),
        api('/api/members/organizer-request').catch(() => ({ request: null }))
      ]);
      state.directory = directoryResult;
      state.organizerRequest = organizerResult.request;
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
    state.membership = profileResult.membership;
    state.personalProfileComplete = profileResult.personalProfileComplete;
    if (state.profile?.admission_status !== 'approved') {
      state.directory = { profiles: [], establishments: [], events: [], conversations: [], recommendations: [] };
      state.organizerRequest = null;
      await loadPhotos();
      return;
    }
    const [directoryResult, organizerResult] = await Promise.all([
      api('/api/members/directory'),
      api('/api/members/organizer-request').catch(() => ({ request: null }))
    ]);
    state.directory = directoryResult;
    state.organizerRequest = organizerResult.request;
  }

  function lockApplication() {
    document.body.classList.add('admission-locked');
    document.querySelector('.sidebar')?.classList.remove('open');
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
        <label class="wide">Description personnelle<textarea name="p${index}_biography" class="long" maxlength="4000">${e(person.biography)}</textarea></label>
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
            <label class="wide">Description principale<textarea name="description" class="long" maxlength="4000" required>${e(profile?.description)}</textarea></label>
            <label class="wide">Votre histoire<textarea name="story" class="long" maxlength="8000">${e(profile?.story)}</textarea></label>
            <label class="wide">Votre parcours<textarea name="journey" maxlength="4000">${e(profile?.journey)}</textarea></label>
            <label class="wide">Ce que vous recherchez<textarea name="search_text" maxlength="4000">${e(profile?.search_text)}</textarea></label>
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
        <label>Ta description personnelle
          <textarea name="p0_biography" class="long" maxlength="4000" placeholder="Ton caractère, ta façon d’aborder les rencontres, ce qui compte pour toi…">${e(ownPerson.biography)}</textarea>
        </label>
      `)
    );

    if (!joiningPartner) {
      const commonIndex = nextIndex + 9;
      steps.push(
        discoveryStep(commonIndex, 'L’essentiel', 'Quelle première impression doit donner votre profil ?', 'Imagine les premières lignes de votre page. Elles doivent être sincères, vivantes et donner envie de découvrir la suite.', `
          <label><span data-description-label>Description principale</span>
            <textarea name="description" class="long" minlength="20" maxlength="4000" required placeholder="Décrivez votre énergie, votre complicité et votre façon de rencontrer…">${e(profile?.description)}</textarea>
          </label>
        `),
        discoveryStep(commonIndex + 1, 'Votre histoire', 'Raconte-moi votre histoire.', 'C’est ici que le profil prend une âme : ce qui vous unit, votre complicité et les moments qui ont construit votre univers.', `
          <label>Votre histoire<textarea name="story" class="long" maxlength="8000">${e(profile?.story)}</textarea></label>
        `),
        discoveryStep(commonIndex + 2, 'Votre parcours', 'Comment avez-vous découvert cet univers ?', 'Racontez votre cheminement, vos premières découvertes et la manière dont vos envies ont évolué.', `
          <label>Votre parcours<textarea name="journey" class="long" maxlength="4000">${e(profile?.journey)}</textarea></label>
        `),
        discoveryStep(commonIndex + 3, 'Vos rencontres', 'Qu’aimeriez-vous trouver sur Velvet ?', 'Parlez-moi des personnes, du type de relation et du feeling que vous espérez rencontrer.', `
          <label>Ce que vous recherchez
            <textarea name="search_text" class="long" maxlength="4000">${e(profile?.search_text)}</textarea>
          </label>
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

  function renderHome() {
    const own = state.profile;
    const others = list(state.directory.profiles).filter((profile) => profile.id !== own.id);
    const upcoming = list(state.directory.events).filter((event) => new Date(event.starts_at) >= new Date());
    return `<div class="page">
      ${pageHead('Votre espace privé', `Bonjour ${own.display_name}`, 'La BETA affiche désormais exclusivement les contenus réellement enregistrés par les membres invités.')}
      <section class="grid four">
        <article class="card kpi"><strong>${others.length}</strong><span>autre profil réel</span></article>
        <article class="card kpi"><strong>${upcoming.length}</strong><span>sortie publiée</span></article>
        <article class="card kpi"><strong>${list(state.directory.establishments).length}</strong><span>établissement publié</span></article>
        <article class="card kpi"><strong>${list(state.directory.conversations).length}</strong><span>conversation active</span></article>
      </section>
      <section class="grid two" style="margin-top:16px">
        <article class="card">
          <p class="eyebrow">Votre profil central</p><h2>${e(own.display_name)}</h2>
          <p>${e(own.description)}</p>
          <button class="primary" data-route="me">Ouvrir ma fiche complète</button>
        </article>
        <article class="card">
          <p class="eyebrow">Communauté BETA</p><h2>${others.length ? 'Les premiers membres sont arrivés' : 'La communauté commence ici'}</h2>
          <p>${others.length ? 'Découvre uniquement les profils authentiques admis à cette BETA.' : 'Aucun profil de démonstration n’est affiché. Les nouveaux membres apparaîtront après leur inscription et la publication de leur fiche.'}</p>
          <button class="secondary" data-route="discover">Accéder à Découvrir</button>
        </article>
      </section>
    </div>`;
  }

  function memberTile(profile) {
    const cover = approvedProfilePhotos(profile)[0];
    return `<button class="card member-tile profile-card-button" data-open-profile="${e(profile.id)}">
      <div class="member-cover">${cover ? `<img src="${e(cover.previewUrl)}" alt="">` : e(initials(profile.display_name))}</div>
      <div class="member-body">
        <div class="member-meta"><span>${e(profile.profile_type === 'couple' ? 'Couple' : 'Individuel')}</span><span>${e(profile.location_zone || profile.city || 'Localisation privée')}</span></div>
        <h3>${e(profile.display_name)}</h3>
        <p>${e(profile.description || 'Profil en cours de rédaction.')}</p>
        ${chips(list(profile.practices).slice(0, 4))}
      </div>
    </button>`;
  }

  function renderDiscover() {
    const profiles = list(state.directory.profiles).filter((profile) => profile.id !== state.profile.id);
    return `<div class="page">
      ${pageHead('Profils authentiques', 'Découvrir', 'Chaque résultat provient directement de Supabase. Aucun profil fictif, aucun chiffre artificiel.')}
      <form id="discoverFilters" class="filters">
        <input name="query" placeholder="Nom, ville, recherche ou pratique" aria-label="Rechercher">
        <select name="type"><option value="">Tous les profils</option><option value="couple">Couples</option><option value="individual">Individuels</option></select>
        <input name="city" placeholder="Ville ou secteur" aria-label="Ville">
        <input name="practice" placeholder="Pratique" aria-label="Pratique">
      </form>
      <div id="discoverResults">
        ${profiles.length ? `<section class="grid three">${profiles.map(memberTile).join('')}</section>` : emptyState(
          'Aucun autre profil pour le moment',
          'La base est volontairement neutre. Les profils apparaîtront ici uniquement après l’inscription de véritables testeurs.',
          '◇'
        )}
      </div>
    </div>`;
  }

  function bindDiscover() {
    const form = document.querySelector('#discoverFilters');
    if (!form) return;
    form.addEventListener('input', () => {
      const data = new FormData(form);
      const query = String(data.get('query') || '').toLowerCase();
      const city = String(data.get('city') || '').toLowerCase();
      const practice = String(data.get('practice') || '').toLowerCase();
      const type = String(data.get('type') || '');
      const rows = list(state.directory.profiles)
        .filter((profile) => profile.id !== state.profile.id)
        .filter((profile) => !type || profile.profile_type === type)
        .filter((profile) => !city || `${profile.city || ''} ${profile.location_zone || ''}`.toLowerCase().includes(city))
        .filter((profile) => !practice || list(profile.practices).join(' ').toLowerCase().includes(practice))
        .filter((profile) => !query || [
          profile.display_name, profile.city, profile.location_zone, profile.description,
          profile.search_text, ...list(profile.practices), ...list(profile.values_list)
        ].join(' ').toLowerCase().includes(query));
      document.querySelector('#discoverResults').innerHTML = rows.length
        ? `<section class="grid three">${rows.map(memberTile).join('')}</section>`
        : emptyState('Aucun résultat', 'Modifie les filtres pour élargir la recherche.', '◇');
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
          ${personalPhotos.length ? `<div class="mini-gallery">${personalPhotos.map((photo) => `<img src="${e(photo.previewUrl)}" alt="Photo individuelle de ${e(person.first_name)}">`).join('')}</div>` : '<h3>Aucune photo publiée</h3><p>Velvet n’affiche aucune image de substitution.</p>'}
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

  function albumsView(profile, own) {
    const albums = list(profile.albums);
    const targetProfiles = list(state.directory.profiles).filter((row) => row.id !== state.profile.id);
    return `<section>
      <div class="page-head"><div><p class="eyebrow">Bibliothèque organisée</p><h1>Albums publics & privés</h1><p>Les albums publics sont visibles par tous les membres admis. Les albums privés ne révèlent rien sans une autorisation accordée par leur propriétaire.</p></div></div>
      ${albums.length ? `<div class="album-library">${albums.map((album) => {
        const photos = list(album.media_assets).filter((photo) => photo.previewUrl);
        const pendingPhotos = photos.filter((photo) => photo.moderation_status === 'pending').length;
        const isPublic = album.confidentiality === 'public';
        const canSee = own || isPublic || photos.length > 0;
        const activeGrants = list(album.album_access_grants).filter(
          (grant) => !grant.revoked_at && (!grant.expires_at || new Date(grant.expires_at) > new Date())
        );
        const grantedProfiles = [...new Set(activeGrants.map((grant) => grant.grantee_profile_id).filter(Boolean))];
        return `<article class="card album-detail ${isPublic ? 'public' : 'private'}">
          <header><div><p class="eyebrow">${e(confidentialityLabel(album.confidentiality))}</p><h2>${e(album.name)}</h2></div><span class="pill">${photos.length} photo${photos.length > 1 ? 's' : ''}</span></header>
          ${canSee
            ? (photos.length ? `<div class="album-gallery">${photos.map((photo) => `<figure><img src="${e(photo.previewUrl)}" alt=""></figure>`).join('')}</div>` : '<p class="muted">Aucune photo visible dans cet album.</p>')
            : '<div class="private-vault"><span>⌑</span><strong>Album privé verrouillé</strong><p>Aucune miniature ni information sur son contenu n’est révélée.</p></div>'}
          ${own && pendingPhotos ? `<p class="status-box">${pendingPhotos} photo${pendingPhotos > 1 ? 's' : ''} visible${pendingPhotos > 1 ? 's' : ''} seulement par vous, en attente de modération.</p>` : ''}
          ${own ? `<form class="album-photo-form" data-album-id="${e(album.id)}">
            <label>Ajouter des photos<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required></label>
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
            <form class="album-access-form" data-album-id="${e(album.id)}">
              <label>Membre bénéficiaire<select name="profileId" required><option value="">Choisir un profil</option>${targetProfiles.map((target) => `<option value="${e(target.id)}">${e(target.display_name)}</option>`).join('')}</select></label>
              <label>Durée<select name="duration" required><option value="1">1 heure</option><option value="2">2 heures</option><option value="4">4 heures</option><option value="8">8 heures</option><option value="12">12 heures</option><option value="24">24 heures</option><option value="permanent">Permanent</option></select></label>
              <button class="primary" type="submit">Donner l’accès</button>
            </form>
          </div>` : ''}
        </article>`;
      }).join('')}</div>` : emptyState('Aucun album publié', own ? 'Crée un album, donne-lui un nom et choisis s’il est public ou privé.' : 'Ce membre n’a encore publié aucun album.', '⌑')}
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
    return `<section class="profile-layout">
      <div>
        <article class="card section"><p class="eyebrow">En quelques mots</p><h2>Qui sommes-nous ?</h2><p class="quote">${e(profile.description || 'Description à compléter.')}</p>${chips(profile.values_list, 'Valeurs à compléter')}</article>
        <article class="card section"><p class="eyebrow">Le récit</p><h2>Notre histoire</h2><p>${e(profile.story || 'Histoire à compléter.')}</p></article>
        <article class="card section"><p class="eyebrow">Le chemin parcouru</p><h2>Notre parcours</h2><p>${e(profile.journey || 'Parcours à compléter.')}</p></article>
        <article class="card section"><p class="eyebrow">Les rencontres souhaitées</p><h2>Ce que nous recherchons</h2><p>${e(profile.search_text || 'Recherche à compléter.')}</p></article>
        <article class="card section"><p class="eyebrow">Nos pratiques</p><h2>Ce que nous aimons vivre</h2>${chips(profile.practices, 'Pratiques à compléter')}</article>
        <article class="card section"><p class="eyebrow">Ils parlent de nous</p><h2>Recommandations</h2>${recommendationsFor(profile)}</article>
        ${own ? `<article class="card section"><p class="eyebrow">Carrousel public</p><h2>Ajouter des photos de profil</h2><p>Ces photos complètent le carrousel principal après validation.</p><form class="profile-photo-form" data-photo-role="${profile.profile_type === 'couple' ? 'couple_gallery' : 'individual_gallery'}"><label>Choisir des photos<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required></label><button class="secondary" type="submit">Ajouter au carrousel</button><small class="photo-upload-status" role="status"></small></form></article>` : ''}
      </div>
      <aside>
        <article class="card">
          <p class="eyebrow">Les personnes</p>
          ${people.map((person, index) => `<button class="card person-card profile-card-button" style="margin-top:10px" data-profile-tab="person${index}">
            <span class="avatar">${e(initials(person.first_name))}</span><span><strong>${e(person.first_name || 'Fiche personnelle')}</strong><p>${e(person.biography || 'Découvrir cette personne')}</p></span><span>→</span>
          </button>`).join('')}
        </article>
        <article class="card" style="margin-top:14px"><p class="eyebrow">Localisation</p><h3>${e(profile.location_zone || profile.city || 'Privée')}</h3><p>Seule la zone choisie par le membre est affichée.</p></article>
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
    if (state.profileTab.startsWith('person') && !people[Number(state.profileTab.replace('person', ''))]) state.profileTab = 'couple';
    const activeContent = state.profileTab === 'albums'
      ? albumsView(profile, own)
      : state.profileTab.startsWith('person')
        ? personView(people[Number(state.profileTab.replace('person', ''))], profile, own)
        : profileOverview(profile, own);
    return `<div class="page">
      <section class="hero">${profileCarousel(profile)}<div class="hero-copy">
        <p class="eyebrow">${e(profile.profile_type === 'couple' ? 'Profil couple' : 'Profil individuel')} · ${e(profile.city || 'Localisation privée')}</p>
        <h1>${e(profile.display_name)}</h1><p class="lead">${e(profile.description)}</p>
        <div class="badges"><span class="pill gold">Membre BETA réel</span>${profile.relationship_since ? `<span class="pill">Depuis ${e(profile.relationship_since)}</span>` : ''}<span class="pill">${e(profile.location_zone || 'Zone privée')}</span></div>
        <div class="actions">${own ? '<button class="primary" data-edit-profile>Modifier mon profil</button>' : ''}${!own ? '<button class="secondary" data-route="conversations">Conversations</button>' : ''}</div>
      </div></section>
      <nav class="profile-nav" aria-label="Sections du profil">
        <button data-profile-tab="couple" class="${state.profileTab === 'couple' ? 'active' : ''}">${profile.profile_type === 'couple' ? 'Le couple' : 'Présentation'}</button>
        ${people.map((person, index) => `<button data-profile-tab="person${index}" class="${state.profileTab === `person${index}` ? 'active' : ''}">${e(person.first_name || `Personne ${index + 1}`)}</button>`).join('')}
        <button data-profile-tab="albums" class="${state.profileTab === 'albums' ? 'active' : ''}">Albums (${list(profile.albums).length})</button>
      </nav>
      ${activeContent}
    </div>`;
  }

  function renderMaps() {
    const located = list(state.directory.profiles).filter((profile) => profile.id !== state.profile.id && (profile.location_zone || profile.city));
    return `<div class="page">${pageHead('Localisation choisie', 'Maps', 'Velvet n’affiche que les zones volontairement partagées par les membres et jamais leur adresse privée.')}
      ${located.length ? `<section class="grid three">${located.map(memberTile).join('')}</section>` : emptyState('Aucune position partagée', 'La carte se remplira uniquement avec les zones déclarées par les véritables membres.', '⌖')}
    </div>`;
  }

  function renderEvents() {
    const events = list(state.directory.events);
    return `<div class="page">${pageHead('Agenda réel', 'Sorties', 'Seules les sorties effectivement publiées dans Supabase apparaissent ici.')}
      ${events.length ? `<section class="grid two">${events.map((event) => `<article class="card"><p class="eyebrow">${e(new Date(event.starts_at).toLocaleString('fr-FR'))}</p><h2>${e(event.title)}</h2><p>${e(event.description || '')}</p><div class="facts"><div class="fact"><small>Lieu public</small><strong>${e(event.location_public || 'Confidentiel')}</strong></div><div class="fact"><small>Capacité</small><strong>${e(event.capacity)} places</strong></div><div class="fact"><small>Public</small><strong>${e(event.audience || 'Membres BETA')}</strong></div></div></article>`).join('')}</section>` : emptyState('Aucune sortie publiée', 'Aucune soirée fictive n’est conservée. Les prochaines sorties apparaîtront après leur publication par un organisateur ou un établissement validé.', '✦')}
    </div>`;
  }

  function renderVenues() {
    const venues = list(state.directory.establishments);
    return `<div class="page">${pageHead('Partenaires validés', 'Établissements', 'Chaque fiche visible provient du CRM Velvet Pro et de la même base Supabase.')}
      ${venues.length ? `<section class="grid three">${venues.map((venue) => `<article class="card"><p class="eyebrow">${e(venue.kind)}</p><h2>${e(venue.name)}</h2><p>${e(venue.description || '')}</p><div class="facts"><div class="fact"><small>Ville</small><strong>${e(venue.city || 'Non renseignée')}</strong></div><div class="fact"><small>Adresse publique</small><strong>${e(venue.address_public || 'Sur demande')}</strong></div></div>${chips(venue.amenities)}</article>`).join('')}</section>` : emptyState('Aucun établissement publié', 'La rubrique restera neutre jusqu’à la validation d’un véritable établissement dans Velvet Pro.', '⌑')}
    </div>`;
  }

  function renderNotifications() {
    return `<div class="page">${pageHead('Activité authentique', 'Notifications', 'Aucune notification simulée n’est générée dans cette BETA.')}
      ${emptyState('Aucune notification', 'Les messages, demandes d’album, inscriptions et validations futures apparaîtront ici lorsqu’une action réelle aura lieu.', '○')}
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
    return `<div class="page settings-page">
      ${pageHead('Confidentialité · tranquillité · contrôle', 'Paramètres', 'Décide précisément qui peut te découvrir, qui peut t’écrire et ce que Velvet est autorisé à te signaler.')}
      <form id="settingsForm" class="settings-layout">
        <section class="card settings-card">
          <p class="eyebrow">Visibilité</p><h2>Qui peut voir votre profil ?</h2>
          <p>Les catégories décochées ne verront plus votre fiche dans Découvrir et ne pourront pas l’ouvrir directement.</p>
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
      state.settings = await api('/api/members/settings');
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
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type=submit]');
      const status = form.querySelector('#settingsStatus');
      const data = new FormData(form);
      const enabledEvents = new Set(data.getAll('event_type'));
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

    form.querySelector('[data-test-notification]')?.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        toast('Ce navigateur ne prend pas en charge les notifications web.', true);
        return;
      }
      const permission = await Notification.requestPermission();
      const browserToggle = form.querySelector('[name=browser_enabled]');
      browserToggle.checked = permission === 'granted';
      if (permission === 'granted') {
        await showBrowserNotification('Velvet est prêt', 'Tes notifications web sont maintenant autorisées.');
        toast('Notification de test envoyée.');
      } else {
        toast('Les notifications restent bloquées dans les réglages du navigateur.', true);
      }
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
      ${rows.length ? `<section class="grid two">${rows.map((conversation) => `<button class="card conversation" data-open-conversation="${e(conversation.id)}"><p class="eyebrow">${e(conversation.kind)}</p><h2>${e(conversation.subject || 'Conversation privée')}</h2><p>${list(conversation.conversation_members).length} participant(s)</p></button>`).join('')}</section>` : emptyState('Aucune conversation', 'Tes échanges réels apparaîtront ici. Aucun historique fictif n’a été conservé.', '◌')}
    </div>`;
  }

  async function openConversation(conversationId) {
    content.innerHTML = `<div class="page"><section class="loading-state"><span class="loader"></span><p>Chargement de la conversation…</p></section></div>`;
    try {
      const result = await api(`/api/members/messages?conversationId=${encodeURIComponent(conversationId)}`);
      const conversation = list(state.directory.conversations).find((row) => row.id === conversationId);
      content.innerHTML = `<div class="page">
        ${pageHead('Conversation privée', conversation?.subject || 'Conversation', 'Les messages sont enregistrés dans Supabase et protégés par les règles d’accès de la conversation.', '<button class="secondary" data-route="conversations">Retour</button>')}
        <section class="card">
          <div class="messages">${list(result.messages).length ? result.messages.map((message) => `<article class="message ${message.sender_user_id === result.currentUserId ? 'mine' : ''}"><small>${e(message.sender_identity || (message.sender_user_id === result.currentUserId ? 'Vous' : 'Membre'))}</small>${e(message.body)}</article>`).join('') : '<p>Aucun message dans cette conversation.</p>'}</div>
          <form id="messageForm" class="composer"><input name="body" maxlength="10000" placeholder="Écrire un message…" required><button class="primary" type="submit">Envoyer</button></form>
        </section>
      </div>`;
      document.querySelector('#messageForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const button = event.currentTarget.querySelector('button');
        button.disabled = true;
        try {
          await api('/api/members/messages', { method: 'POST', body: JSON.stringify({ conversationId, body: data.get('body') }) });
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

  function route(name) {
    if (state.profile?.admission_status !== 'approved') {
      renderAdmission();
      return;
    }
    state.route = name;
    state.editing = false;
    navButtons.forEach((button) => button.classList.toggle('active', button.dataset.route === name));
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('#mobileMenuButton')?.setAttribute('aria-expanded', 'false');
    if (name === 'home') content.innerHTML = renderHome();
    if (name === 'discover') content.innerHTML = renderDiscover();
    if (name === 'maps') content.innerHTML = renderMaps();
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

  function openProfile(id) {
    const profile = list(state.directory.profiles).find((row) => row.id === id);
    if (!profile) {
      toast('Profil introuvable.', true);
      return;
    }
    state.selectedProfileId = id;
    state.profileTab = 'couple';
    content.innerHTML = renderProfile(profile, id === state.profile.id);
    bindDynamicForms();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindDynamicForms() {
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
            body.set('photo', await optimizePhoto(files[index]));
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

    document.querySelectorAll('.album-access-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        const values = Object.fromEntries(new FormData(form));
        button.disabled = true;
        try {
          await api('/api/members/album-access', {
            method: 'POST',
            body: JSON.stringify({
              albumId: form.dataset.albumId,
              profileId: values.profileId,
              duration: values.duration
            })
          });
          await refreshData();
          state.profileTab = 'albums';
          content.innerHTML = renderProfile(state.profile, true);
          bindDynamicForms();
          toast('Accès privé accordé.');
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
    if (event.target.closest('[data-admission]')) {
      renderAdmission();
      return;
    }
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) {
      event.preventDefault();
      route(routeButton.dataset.route);
      return;
    }
    const profileButton = event.target.closest('[data-open-profile]');
    if (profileButton) {
      openProfile(profileButton.dataset.openProfile);
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
    const conversationButton = event.target.closest('[data-open-conversation]');
    if (conversationButton) openConversation(conversationButton.dataset.openConversation);
  });

  document.querySelector('#logoutButton').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
    window.location.href = '/';
  });

  document.querySelector('#mobileMenuButton').addEventListener('click', (event) => {
    const sidebar = document.querySelector('.sidebar');
    const open = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });

  initializeWebExperience();
  loadAll();
})();
