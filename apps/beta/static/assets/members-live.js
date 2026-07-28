(() => {
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
    route: 'home',
    selectedProfileId: null,
    profileTab: 'couple',
    editing: false
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
    profile_required: 'Crée d’abord ton profil Velvet.',
    organizer_request_already_pending: 'Une demande Organisateur est déjà en cours.',
    album_name_required: 'Donne un nom à cet album.',
    message_required: 'Écris un message avant de l’envoyer.'
  };

  const e = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
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
      request: 'Privé sur demande',
      trusted_circle: 'Cercle de confiance',
      private_circle: 'Cercle privé',
      favorites: 'Favoris uniquement',
      temporary: 'Accès temporaire'
    })[value] || value;
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
        renderOnboarding(state.profile);
        return;
      }
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
    const [profileResult, directoryResult, organizerResult] = await Promise.all([
      api('/api/members/profile'),
      api('/api/members/directory'),
      api('/api/members/organizer-request').catch(() => ({ request: null }))
    ]);
    state.profile = profileResult.profile;
    state.account = profileResult.account;
    state.membership = profileResult.membership;
    state.personalProfileComplete = profileResult.personalProfileComplete;
    state.directory = directoryResult;
    state.organizerRequest = organizerResult.request;
  }

  function profilePeople(profile) {
    const order = { individual: 0, partner_a: 0, partner_b: 1 };
    return list(profile?.individual_profiles).sort((a, b) => (order[a.member_slot] ?? 9) - (order[b.member_slot] ?? 9));
  }

  function personForm(index, person = {}, couple = true) {
    const title = couple ? (index === 0 ? 'Première personne' : 'Deuxième personne') : 'Votre fiche personnelle';
    return `<section class="person-form">
      <h3>${title}</h3>
      <div class="form-grid">
        <label>Prénom<input name="p${index}_first_name" maxlength="80" value="${e(person.first_name)}" required></label>
        <label>Année de naissance<input name="p${index}_birth_year" type="number" min="1900" max="${new Date().getFullYear() - 18}" value="${e(person.birth_year)}"></label>
        <label>Taille en cm<input name="p${index}_height_cm" type="number" min="100" max="250" value="${e(person.height_cm)}"></label>
        <label>Poids en kg<input name="p${index}_weight_kg" type="number" min="30" max="350" value="${e(person.weight_kg)}"></label>
        <label>Morphologie<input name="p${index}_morphology" maxlength="80" value="${e(person.morphology)}"></label>
        <label>Couleur des cheveux<input name="p${index}_hair_color" maxlength="80" value="${e(person.hair_color)}"></label>
        <label>Couleur des yeux<input name="p${index}_eye_color" maxlength="80" value="${e(person.eye_color)}"></label>
        <label>Enfants
          <select name="p${index}_children_status">
            <option value="private"${person.children_status === 'private' ? ' selected' : ''}>Information privée</option>
            <option value="yes"${person.children_status === 'yes' ? ' selected' : ''}>Oui</option>
            <option value="no"${person.children_status === 'no' ? ' selected' : ''}>Non</option>
          </select>
        </label>
        <label>Profession<input name="p${index}_profession" maxlength="120" value="${e(person.profession)}"></label>
        <label class="check"><input name="p${index}_profession_private" type="checkbox"${person.profession_private !== false ? ' checked' : ''}><span>Garder la profession privée</span></label>
        <label>Orientation / attirances<input name="p${index}_orientation" maxlength="120" value="${e(person.orientation)}"></label>
        <label>Fréquence de pratique<input name="p${index}_frequency" maxlength="120" value="${e(person.frequency)}"></label>
        <label class="wide">Description personnelle<textarea name="p${index}_biography" class="long" maxlength="4000">${e(person.biography)}</textarea></label>
        <label class="wide">Attiré(e) par — séparer par des virgules<input name="p${index}_attracted_to" value="${e(list(person.attracted_to).join(', '))}"></label>
        <label class="wide">Ce que cette personne souhaite pratiquer — séparer par des virgules<input name="p${index}_desired_practices" value="${e(list(person.desired_practices).join(', '))}"></label>
        ${couple ? `<label class="wide">Ce que cette personne autorise son/sa partenaire à pratiquer — séparer par des virgules<input name="p${index}_partner_permissions" value="${e(list(person.partner_permissions).join(', '))}"></label>` : ''}
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
            <label>Ville<input name="city" maxlength="120" value="${e(profile?.city)}"></label>
            <label>Zone de localisation publique<input name="location_zone" maxlength="160" value="${e(profile?.location_zone)}" placeholder="Ville ou secteur, jamais une adresse précise"></label>
            <label>Ensemble depuis — année<input name="relationship_since" type="number" min="1900" max="${new Date().getFullYear()}" value="${e(profile?.relationship_since)}"></label>
            <label>Disponibilités<input name="availability_text" maxlength="1000" value="${e(profile?.availability_text)}"></label>
            <label class="wide">Description principale<textarea name="description" class="long" maxlength="4000" required>${e(profile?.description)}</textarea></label>
            <label class="wide">Votre histoire<textarea name="story" class="long" maxlength="8000">${e(profile?.story)}</textarea></label>
            <label class="wide">Votre parcours<textarea name="journey" maxlength="4000">${e(profile?.journey)}</textarea></label>
            <label class="wide">Ce que vous recherchez<textarea name="search_text" maxlength="4000">${e(profile?.search_text)}</textarea></label>
            <label class="wide">Pratiques — séparer par des virgules<input name="practices" value="${e(list(profile?.practices).join(', '))}"></label>
            <label class="wide">Valeurs — séparer par des virgules<input name="values_list" value="${e(list(profile?.values_list).join(', '))}"></label>
            <label class="wide">Lieux fréquentés ou préférés — séparer par des virgules<input name="favorite_places" value="${e(list(profile?.favorite_places).join(', '))}"></label>
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

  function renderOnboarding(profile = null) {
    state.editing = true;
    content.innerHTML = `<div class="page">${profileForm(profile)}</div>`;
    bindProfileForm();
    content.focus();
  }

  function bindProfileForm() {
    const form = document.querySelector('#profileForm');
    const type = document.querySelector('#profileType');
    if (!form || !type) return;
    type.addEventListener('change', () => {
      const people = profilePeople(state.profile);
      const ownPerson = people.find((person) => person.linked_user_id === state.account?.userId) || {};
      document.querySelector('#peopleForms').innerHTML = personForm(0, ownPerson, type.value === 'couple');
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
      attracted_to: splitList(data.get('p0_attracted_to')),
      desired_practices: splitList(data.get('p0_desired_practices')),
      partner_permissions: splitList(data.get('p0_partner_permissions'))
    };
    const payload = {
      profile_type: profileType,
      display_name: data.get('display_name'),
      city: data.get('city'),
      location_zone: data.get('location_zone'),
      relationship_since: data.get('relationship_since'),
      availability_text: data.get('availability_text'),
      description: data.get('description'),
      story: data.get('story'),
      journey: data.get('journey'),
      search_text: data.get('search_text'),
      practices: splitList(data.get('practices')),
      values_list: splitList(data.get('values_list')),
      favorite_places: splitList(data.get('favorite_places')),
      person
    };
    button.disabled = true;
    status.hidden = false;
    status.textContent = 'Enregistrement sécurisé dans Supabase…';
    try {
      const result = await api('/api/members/profile', { method: 'POST', body: JSON.stringify(payload) });
      state.profile = result.profile;
      await refreshData();
      state.editing = false;
      toast('Profil enregistré dans la mémoire Velvet.');
      route('me');
    } catch (error) {
      status.textContent = errorMessages[error.message] || `Enregistrement impossible : ${error.message}`;
      toast(error.message, true);
    } finally {
      button.disabled = false;
    }
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
    return `<button class="card member-tile profile-card-button" data-open-profile="${e(profile.id)}">
      <div class="member-cover">${e(initials(profile.display_name))}</div>
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

  function personView(person, couple) {
    if (!person) return emptyState('Fiche incomplète', 'Cette personne n’a pas encore complété sa fiche.', '♡');
    return `<section class="profile-layout">
      <div>
        <article class="card section">
          <p class="eyebrow">Portrait personnel</p><h2>${e(person.first_name || 'Profil personnel')}</h2>
          <p class="quote">${e(person.biography || 'Description personnelle à compléter.')}</p>
          ${facts(person)}
        </article>
        <article class="card section"><h2>Attirances</h2>${chips(person.attracted_to)}</article>
        <article class="card section"><h2>Ce que ${e(person.first_name || 'cette personne')} souhaite vivre</h2>${chips(person.desired_practices)}</article>
        ${couple ? `<article class="card section"><h2>Accords au sein du couple</h2><p>Ce que ${e(person.first_name || 'cette personne')} autorise son ou sa partenaire à pratiquer.</p>${chips(person.partner_permissions)}</article>` : ''}
      </div>
      <aside>
        <article class="card"><p class="eyebrow">Orientation et attirances</p><h3>${e(person.orientation || 'Non renseignées')}</h3></article>
        <article class="card" style="margin-top:14px"><p class="eyebrow">Photos individuelles</p><h3>Aucune photo publiée</h3><p>Velvet n’affiche aucune image de substitution.</p></article>
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
    return `<section>
      <div class="page-head"><div><p class="eyebrow">Confidentialité maîtrisée</p><h1>Albums privés</h1><p>Le nom et le niveau d’accès sont visibles. Aucun contenu ne paraît tant que l’album n’est pas déverrouillé.</p></div></div>
      ${albums.length ? `<div class="grid three">${albums.map((album) => `<article class="card album">
        <div class="lock">⌑</div><div><p class="eyebrow">${e(confidentialityLabel(album.confidentiality))}</p><h3>${e(album.name)}</h3><p>Contenu entièrement masqué.</p></div>
      </article>`).join('')}</div>` : emptyState('Aucun album publié', own ? 'Crée ton premier album privé en choisissant son nom et son niveau de confidentialité.' : 'Ce membre n’a encore publié aucun album.', '⌑')}
      ${own ? `<form id="albumForm" class="card" style="margin-top:16px">
        <h2>Créer un album privé</h2>
        <div class="form-grid">
          <label>Nom de l’album<input name="name" maxlength="120" required></label>
          <label>Niveau de confidentialité<select name="confidentiality"><option value="request">Privé sur demande</option><option value="trusted_circle">Cercle de confiance</option><option value="private_circle">Cercle privé</option><option value="favorites">Favoris uniquement</option><option value="temporary">Accès temporaire</option></select></label>
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
        ? personView(people[Number(state.profileTab.replace('person', ''))], profile.profile_type === 'couple')
        : profileOverview(profile, own);
    return `<div class="page">
      <section class="hero"><div class="hero-copy">
        <p class="eyebrow">${e(profile.profile_type === 'couple' ? 'Profil couple' : 'Profil individuel')} · ${e(profile.city || 'Localisation privée')}</p>
        <h1>${e(profile.display_name)}</h1><p class="lead">${e(profile.description)}</p>
        <div class="badges"><span class="pill gold">Membre BETA réel</span>${profile.relationship_since ? `<span class="pill">Depuis ${e(profile.relationship_since)}</span>` : ''}<span class="pill">${e(profile.location_zone || 'Zone privée')}</span></div>
        <div class="actions">${own ? '<button class="primary" data-edit-profile>Modifier mon profil</button>' : ''}${!own ? '<button class="secondary" data-route="conversations">Conversations</button>' : ''}</div>
      </div></section>
      <nav class="profile-nav" aria-label="Sections du profil">
        <button data-profile-tab="couple" class="${state.profileTab === 'couple' ? 'active' : ''}">${profile.profile_type === 'couple' ? 'Le couple' : 'Présentation'}</button>
        ${people.map((person, index) => `<button data-profile-tab="person${index}" class="${state.profileTab === `person${index}` ? 'active' : ''}">${e(person.first_name || `Personne ${index + 1}`)}</button>`).join('')}
        <button data-profile-tab="albums" class="${state.profileTab === 'albums' ? 'active' : ''}">Albums privés (${list(profile.albums).length})</button>
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
        toast('Album privé créé.');
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
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

  function prepareCoupleInvitation() {
    content.innerHTML = `<div class="page">
      ${pageHead('Fiche couple partagée', 'Inviter mon/ma partenaire', 'Le code sera lié à son adresse e-mail. Après inscription et validation des consentements, son compte rejoindra automatiquement votre fiche couple.', '<button class="secondary" data-route="me">Retour au profil</button>')}
      <form id="coupleInviteForm" class="card">
        <h2>Adresse du partenaire</h2>
        <p>Cette opération prépare une invitation valable sept jours. Elle ne sera pas envoyée automatiquement pendant notre phase de validation.</p>
        <label>Adresse e-mail<input type="email" name="email" autocomplete="email" required></label>
        <button class="primary" type="submit" style="margin-top:14px">Créer le code partenaire</button>
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
        content.innerHTML = `<div class="page">
          ${pageHead('Invitation partenaire', 'Code préparé', 'Le code n’a pas été envoyé automatiquement. Il doit être transmis uniquement à la personne dont l’adresse a été renseignée.')}
          <section class="card"><p class="eyebrow">Code à usage unique</p><h2 style="letter-spacing:.12em">${e(invitation?.invite_code || '')}</h2><p>Inscription : ${e(result.registrationUrl)}</p><button class="primary" data-route="me">Retour au profil</button></section>
        </div>`;
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
    });
  }

  document.addEventListener('click', (event) => {
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

  loadAll();
})();
