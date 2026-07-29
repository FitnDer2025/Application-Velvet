(() => {
  const content = document.querySelector('#content');
  const toastNode = document.querySelector('#toast');
  const state = {
    profileResult: null,
    invitation: null,
    photos: [],
    draft: {},
    wizard: null
  };

  const GENDERS = [
    'Homme', 'Femme', 'Homme trans', 'Femme trans',
    'Personne non binaire', 'Autre identité', 'Information privée'
  ];
  const TARGETS = [
    'Une femme', 'Un homme', 'Un couple', 'Une personne non binaire',
    'Une femme trans', 'Un homme trans', 'Selon le feeling'
  ];
  const PRACTICES = [
    'Rencontres en couple', 'Côte-à-côtisme', 'Mélangisme', 'Échangisme',
    'Triolisme', 'Sensualité et massages', 'Voyeurisme', 'Exhibitionnisme',
    'Jeux de rôle', 'BDSM soft', 'BDSM', 'Soirées privées', 'Clubs et spas',
    'À découvrir ensemble', 'À discuter selon le feeling'
  ];
  const VALUES = [
    'Consentement', 'Respect', 'Communication', 'Discrétion', 'Bienveillance',
    'Hygiène', 'Élégance', 'Complicité', 'Humour', 'Sensualité',
    'Aucune pression', 'Feeling indispensable', 'Rencontres suivies'
  ];
  const AVAILABILITY = [
    'En semaine — journée', 'En semaine — soirée', 'Vendredi soir',
    'Samedi — journée', 'Samedi soir', 'Dimanche', 'Week-end complet',
    'Pendant les vacances', 'Variable selon les semaines',
    'Uniquement sur rendez-vous'
  ];
  const MORPHOLOGIES = [
    'Mince', 'Svelte', 'Athlétique', 'Sportive', 'Standard', 'Musclée',
    'Pulpeuse / Curvy', 'Ronde', 'Généreuse', 'Forte', 'Information privée'
  ];
  const HAIR = [
    'Noirs', 'Bruns', 'Châtains', 'Blonds', 'Roux', 'Gris / Poivre et sel',
    'Blancs', 'Colorés', 'Rasés / Chauve', 'Information privée'
  ];
  const EYES = [
    'Marron', 'Noisette', 'Verts', 'Bleus', 'Gris', 'Noirs', 'Vairons',
    'Information privée'
  ];
  const ORIENTATIONS = [
    'Hétérosexuel(le)', 'Bi-curieux / Bi-curieuse', 'Bisexuel(le)',
    'Pansexuel(le)', 'Homosexuel(le)', 'Orientation fluide',
    'En questionnement', 'Information privée'
  ];
  const FREQUENCIES = [
    'En découverte', 'Quelques fois par an', 'Environ une fois par mois',
    'Deux à trois fois par mois', 'Environ une fois par semaine',
    'Régulièrement, sans fréquence fixe', 'En pause actuellement',
    'Information privée'
  ];

  const errors = {
    authentication_required: 'Ta session a expiré. Reconnecte-toi.',
    profile_identity_required: 'Ajoute un nom de profil et une présentation d’au moins 20 caractères.',
    first_names_required: 'Indique ton prénom ou ton pseudonyme.',
    gender_identity_required: 'Indique comment tu souhaites être présenté(e).',
    invalid_partner_email: 'L’adresse de ta moitié n’est pas valide.',
    partner_email_must_be_different: 'L’invitation doit être envoyée à une autre adresse.',
    couple_partner_already_linked: 'Ta moitié est déjà rattachée à ce profil.',
    invalid_photo_file: 'Choisis une photo JPG, PNG ou WebP de moins de 4 Mo.'
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  async function api(path, options = {}) {
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
  }

  function toast(message, isError = false) {
    if (!toastNode) return;
    toastNode.textContent = errors[message] || message;
    toastNode.style.borderColor = isError ? 'rgba(255,142,167,.45)' : '';
    toastNode.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => toastNode.classList.remove('show'), 3500);
  }

  function selected(name) {
    const value = state.draft[name];
    return Array.isArray(value) ? value : [];
  }

  function optionList(options, current = '') {
    return `<option value="">Choisir…</option>${options.map((option) =>
      `<option value="${escapeHtml(option)}"${option === current ? ' selected' : ''}>${escapeHtml(option)}</option>`
    ).join('')}`;
  }

  function checkGrid(name, options, values = []) {
    const active = new Set(values || []);
    return `<div class="ov-choice-grid">${options.map((option) => `
      <label class="ov-check">
        <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(option)}"${active.has(option) ? ' checked' : ''}>
        <span>${escapeHtml(option)}</span>
      </label>`).join('')}</div>`;
  }

  function communeInput(name, label, value = '', help = '') {
    return `<label class="ov-field">${escapeHtml(label)}
      <span class="ov-autocomplete">
        <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" autocomplete="off" data-commune placeholder="Commune ou code postal">
        <span class="ov-results" data-results hidden></span>
      </span>
      ${help ? `<small>${escapeHtml(help)}</small>` : ''}
    </label>`;
  }

  function venueInput(values = []) {
    return `<div class="ov-field" data-venue-field>
      <span>Lieux fréquentés ou appréciés</span>
      <div class="ov-tags" data-venue-tags>
        ${(values || []).map((name) => `<span>${escapeHtml(name)}<button type="button" data-remove-venue>×</button><input type="hidden" name="favorite_places" value="${escapeHtml(name)}"></span>`).join('')}
      </div>
      <span class="ov-autocomplete">
        <input data-venue-input autocomplete="off" placeholder="Nom d’un club ou d’un spa">
        <span class="ov-results" data-venue-results hidden></span>
      </span>
      <small>Les propositions proviennent du référentiel Velvet France–Belgique.</small>
    </div>`;
  }

  function bindAutocomplete(scope) {
    scope.querySelectorAll('[data-commune]').forEach((input) => {
      const results = input.closest('.ov-autocomplete').querySelector('[data-results]');
      let timer;
      input.addEventListener('input', () => {
        window.clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < 2) {
          results.hidden = true;
          return;
        }
        timer = window.setTimeout(async () => {
          try {
            const payload = await api(`/api/reference/communes?q=${encodeURIComponent(query)}`);
            const rows = payload.results || [];
            results.innerHTML = rows.length ? rows.map((row, index) => `
              <button type="button" data-index="${index}"><strong>${escapeHtml(row.postalCode)}</strong><span>${escapeHtml(row.city)}</span></button>
            `).join('') : '<p>Aucune commune trouvée.</p>';
            results.hidden = false;
            results.querySelectorAll('[data-index]').forEach((button) => {
              button.addEventListener('click', () => {
                const row = rows[Number(button.dataset.index)];
                input.value = row.label;
                results.hidden = true;
              });
            });
          } catch {
            results.innerHTML = '<p>Référentiel momentanément indisponible.</p>';
            results.hidden = false;
          }
        }, 240);
      });
      input.addEventListener('blur', () => window.setTimeout(() => { results.hidden = true; }, 180));
    });

    scope.querySelectorAll('[data-venue-field]').forEach((field) => {
      const input = field.querySelector('[data-venue-input]');
      const results = field.querySelector('[data-venue-results]');
      const tags = field.querySelector('[data-venue-tags]');
      let timer;
      const bindRemoval = () => tags.querySelectorAll('[data-remove-venue]').forEach((button) => {
        button.onclick = () => button.closest('span').remove();
      });
      bindRemoval();
      input.addEventListener('input', () => {
        window.clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < 2) {
          results.hidden = true;
          return;
        }
        timer = window.setTimeout(async () => {
          try {
            const payload = await api(`/api/reference/venues?q=${encodeURIComponent(query)}`);
            const rows = payload.results || [];
            results.innerHTML = rows.length ? rows.map((row, index) => `
              <button type="button" data-index="${index}"><strong>${escapeHtml(row.name)}</strong><span>${escapeHtml([row.city, row.country_code].filter(Boolean).join(' · '))}</span></button>
            `).join('') : '<p>Aucun lieu trouvé pour le moment.</p>';
            results.hidden = false;
            results.querySelectorAll('[data-index]').forEach((button) => {
              button.addEventListener('click', () => {
                const row = rows[Number(button.dataset.index)];
                const exists = [...tags.querySelectorAll('input')].some((node) => node.value === row.name);
                if (!exists) {
                  tags.insertAdjacentHTML('beforeend', `<span>${escapeHtml(row.name)}<button type="button" data-remove-venue>×</button><input type="hidden" name="favorite_places" value="${escapeHtml(row.name)}"></span>`);
                  bindRemoval();
                }
                input.value = '';
                results.hidden = true;
              });
            });
          } catch {
            results.innerHTML = '<p>Référentiel momentanément indisponible.</p>';
            results.hidden = false;
          }
        }, 240);
      });
      input.addEventListener('blur', () => window.setTimeout(() => { results.hidden = true; }, 180));
    });
  }

  function collectForm(form) {
    const draft = { ...state.draft };
    const names = new Set([...form.querySelectorAll('[name]')].map((node) => node.name));
    names.forEach((name) => {
      const nodes = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
      const first = nodes[0];
      if (!first) return;
      if (first.type === 'checkbox') {
        draft[name] = nodes.filter((node) => node.checked).map((node) => node.value);
      } else if (first.type === 'radio') {
        draft[name] = nodes.find((node) => node.checked)?.value || '';
      } else if (nodes.length > 1) {
        draft[name] = nodes.map((node) => node.value).filter(Boolean);
      } else {
        draft[name] = first.value;
      }
    });
    state.draft = draft;
  }

  function runWizard({ steps, onComplete, startAt = 0 }) {
    let index = startAt;
    state.wizard = { steps, onComplete };
    document.body.classList.add('onboarding-v2-active');

    const render = () => {
      const step = steps[index];
      content.innerHTML = `<div class="ov-page">
        <section class="ov-shell">
          <header class="ov-progress">
            <span><strong>${index + 1}</strong> sur ${steps.length}</span>
            <div><i style="width:${((index + 1) / steps.length) * 100}%"></i></div>
            <small>${escapeHtml(step.audience)}</small>
          </header>
          <div class="ov-guide"><span>V</span><p><strong>Velvet</strong>${escapeHtml(step.guide)}</p></div>
          <p class="ov-kicker">${escapeHtml(step.kicker)}</p>
          <h1>${escapeHtml(step.title)}</h1>
          <form id="ovStepForm" class="ov-form">
            ${step.body(state.draft)}
            <footer class="ov-actions">
              <button class="secondary" type="button" data-back${index === 0 ? ' hidden' : ''}>Retour</button>
              <button class="primary" type="submit">${index === steps.length - 1 ? escapeHtml(step.finish || 'Continuer') : 'Continuer'}</button>
            </footer>
          </form>
        </section>
      </div>`;
      const form = content.querySelector('#ovStepForm');
      bindAutocomplete(form);
      form.querySelector('[data-back]')?.addEventListener('click', () => {
        collectForm(form);
        index = Math.max(0, index - 1);
        render();
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        collectForm(form);
        if (index < steps.length - 1) {
          index += 1;
          render();
          return;
        }
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
          await onComplete(state.draft);
        } catch (error) {
          toast(error.message, true);
          button.disabled = false;
        }
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => form.querySelector('input:not([type=hidden]),select,textarea')?.focus({ preventScroll: true }), 80);
    };
    render();
  }

  function commonCoupleSteps() {
    return [
      {
        audience: 'À propos du couple', kicker: 'Votre identité',
        title: 'Comment souhaitez-vous être appelés ensemble ?',
        guide: 'Commençons par le nom qui représentera votre couple auprès des autres membres.',
        body: (d) => `<label class="ov-field">Nom ou pseudonyme du couple<input name="display_name" maxlength="120" value="${escapeHtml(d.display_name)}" required></label>`
      },
      {
        audience: 'À propos du couple', kicker: 'Votre histoire',
        title: 'Depuis quand partagez-vous votre vie ?',
        guide: 'Une année suffit. Elle donnera un premier repère à votre histoire commune.',
        body: (d) => `<label class="ov-field">Ensemble depuis<input name="relationship_since" type="number" min="1900" max="${new Date().getFullYear()}" value="${escapeHtml(d.relationship_since)}" placeholder="Exemple : 2012"></label>`
      },
      {
        audience: 'À propos du couple', kicker: 'Votre localisation privée',
        title: 'Dans quelle commune vivez-vous ?',
        guide: 'Cette commune sert à calculer les distances. Elle ne sera pas publiée telle quelle.',
        body: (d) => communeInput('city', 'Commune de résidence', d.city, 'Cette information reste privée.')
      },
      {
        audience: 'À propos du couple', kicker: 'Votre localisation publique',
        title: 'Quelle zone souhaitez-vous montrer ?',
        guide: 'Choisissez une zone assez précise pour être utile, mais suffisamment large pour préserver votre discrétion.',
        body: (d) => communeInput('location_zone', 'Zone affichée sur le profil', d.location_zone, 'Exemple : Lens et alentours.')
      },
      {
        audience: 'À propos du couple', kicker: 'Première impression',
        title: 'Comment présenteriez-vous votre couple en quelques phrases ?',
        guide: 'C’est le texte que les autres liront en premier. Parlez de votre énergie, de votre complicité et de votre façon de rencontrer.',
        body: (d) => `<label class="ov-field">Présentation principale<textarea name="description" minlength="20" maxlength="4000" required>${escapeHtml(d.description)}</textarea></label>`
      },
      {
        audience: 'À propos du couple', kicker: 'Votre récit',
        title: 'Racontez-moi votre histoire.',
        guide: 'Ce qui vous unit, les étapes importantes et ce qui fait de vous un couple singulier.',
        body: (d) => `<label class="ov-field">Votre histoire<textarea name="story" maxlength="8000">${escapeHtml(d.story)}</textarea></label>`
      },
      {
        audience: 'À propos du couple', kicker: 'Votre parcours',
        title: 'Comment avez-vous découvert cet univers ?',
        guide: 'Il n’est pas nécessaire d’en dire trop. Quelques repères sincères suffisent.',
        body: (d) => `<label class="ov-field">Votre parcours<textarea name="journey" maxlength="4000">${escapeHtml(d.journey)}</textarea></label>`
      },
      {
        audience: 'À propos du couple', kicker: 'Vos rencontres',
        title: 'Qu’aimeriez-vous trouver sur Velvet ?',
        guide: 'Parlez des personnes, du rythme et surtout du type de feeling que vous recherchez.',
        body: (d) => `<label class="ov-field">Ce que nous recherchons<textarea name="search_text" maxlength="4000">${escapeHtml(d.search_text)}</textarea></label>`
      },
      {
        audience: 'À propos du couple', kicker: 'Vos pratiques communes',
        title: 'Qu’aimez-vous vivre ensemble ?',
        guide: 'Ici seulement, nous parlons des pratiques du couple. Chacun précisera ensuite ses attirances personnelles.',
        body: (d) => checkGrid('practices', PRACTICES, selected('practices'))
      },
      {
        audience: 'À propos du couple', kicker: 'Votre philosophie',
        title: 'Quelles valeurs doivent guider vos rencontres ?',
        guide: 'Ces choix aideront immédiatement les autres membres à comprendre votre manière de vivre Velvet.',
        body: (d) => checkGrid('values_list', VALUES, selected('values_list'))
      },
      {
        audience: 'À propos du couple', kicker: 'Votre rythme',
        title: 'Quand êtes-vous généralement disponibles ?',
        guide: 'Plusieurs réponses sont possibles. Vous pourrez les modifier à tout moment.',
        body: (d) => checkGrid('availability', AVAILABILITY, selected('availability'))
      },
      {
        audience: 'À propos du couple', kicker: 'Vos habitudes',
        title: 'Quels lieux aimez-vous fréquenter ?',
        guide: 'Commencez à saisir le nom d’un club ou d’un spa. Cette liste restera modifiable depuis votre profil.',
        finish: 'Créer notre espace couple',
        body: (d) => venueInput(d.favorite_places || [])
      }
    ];
  }

  function personalSteps({ couple, firstName = '' }) {
    const audience = () => state.draft.p0_first_name ? `À propos de ${state.draft.p0_first_name}` : 'À propos de toi';
    const steps = [
      {
        audience: audience(), kicker: 'Ta fiche personnelle',
        title: 'Comment veux-tu qu’on t’appelle ?',
        guide: couple ? 'Cette partie t’appartient. Ta moitié complétera la sienne depuis son propre lien.' : 'Ce prénom ou pseudonyme apparaîtra sur ta fiche personnelle.',
        body: (d) => `<label class="ov-field">Prénom ou pseudonyme<input name="p0_first_name" maxlength="80" value="${escapeHtml(d.p0_first_name || firstName)}" required></label>`
      },
      {
        audience: audience(), kicker: 'Ton identité',
        title: 'Comment souhaites-tu être présenté(e) ?',
        guide: 'Cette réponse permet à Velvet de respecter les filtres de visibilité et de s’adresser correctement à toi.',
        body: (d) => `<label class="ov-field">Identité de genre<select name="p0_gender_identity" required>${optionList(GENDERS, d.p0_gender_identity)}</select></label>`
      },
      {
        audience: audience(), kicker: 'Quelques repères',
        title: 'Comment te décrirais-tu physiquement ?',
        guide: 'Tu peux laisser les informations facultatives vides et les compléter plus tard.',
        body: (d) => `<div class="ov-grid">
          <label class="ov-field">Année de naissance<input name="p0_birth_year" type="number" min="1900" max="${new Date().getFullYear() - 18}" value="${escapeHtml(d.p0_birth_year)}"></label>
          <label class="ov-field">Taille en cm<input name="p0_height_cm" type="number" min="100" max="250" value="${escapeHtml(d.p0_height_cm)}"></label>
          <label class="ov-field">Poids en kg<input name="p0_weight_kg" type="number" min="30" max="350" value="${escapeHtml(d.p0_weight_kg)}"></label>
          <label class="ov-field">Morphologie<select name="p0_morphology">${optionList(MORPHOLOGIES, d.p0_morphology)}</select></label>
        </div>`
      },
      {
        audience: audience(), kicker: 'Ton allure',
        title: 'Quels détails complètent ton portrait ?',
        guide: 'Deux repères simples avant de passer à ce qui te caractérise vraiment.',
        body: (d) => `<div class="ov-grid">
          <label class="ov-field">Couleur des cheveux<select name="p0_hair_color">${optionList(HAIR, d.p0_hair_color)}</select></label>
          <label class="ov-field">Couleur des yeux<select name="p0_eye_color">${optionList(EYES, d.p0_eye_color)}</select></label>
        </div>`
      },
      {
        audience: audience(), kicker: 'Ce que tu souhaites partager',
        title: 'Parlons un peu de ta vie personnelle.',
        guide: 'Ces informations restent facultatives. La profession peut être renseignée tout en restant privée.',
        body: (d) => `<div class="ov-grid">
          <label class="ov-field">Enfants<select name="p0_children_status"><option value="private">Information privée</option><option value="yes"${d.p0_children_status === 'yes' ? ' selected' : ''}>Oui</option><option value="no"${d.p0_children_status === 'no' ? ' selected' : ''}>Non</option></select></label>
          <label class="ov-field">Profession<input name="p0_profession" maxlength="120" value="${escapeHtml(d.p0_profession)}"></label>
          <label class="ov-inline"><input type="checkbox" name="p0_profession_private" value="true"${d.p0_profession_private !== false ? ' checked' : ''}><span>Garder ma profession privée</span></label>
        </div>`
      },
      {
        audience: audience(), kicker: 'Tes affinités',
        title: 'Comment définis-tu ton orientation ?',
        guide: 'Choisis la réponse qui te ressemble aujourd’hui. Elle pourra évoluer plus tard.',
        body: (d) => `<label class="ov-field">Orientation<select name="p0_orientation">${optionList(ORIENTATIONS, d.p0_orientation)}</select></label>`
      },
      {
        audience: audience(), kicker: 'Ce que tu recherches',
        title: 'Qui aimerais-tu rencontrer ?',
        guide: 'Ici, aucun mélange avec les pratiques : choisis uniquement les personnes ou profils qui peuvent t’attirer.',
        body: (d) => checkGrid('p0_attracted_to', TARGETS, selected('p0_attracted_to'))
      },
      {
        audience: audience(), kicker: 'Ton expérience',
        title: 'À quel rythme pratiques-tu aujourd’hui ?',
        guide: 'Découverte, pause ou pratique régulière : choisis simplement ce qui correspond à ta réalité actuelle.',
        body: (d) => `<label class="ov-field">Fréquence actuelle<select name="p0_frequency">${optionList(FREQUENCIES, d.p0_frequency)}</select></label>`
      }
    ];
    if (couple) {
      steps.push({
        audience: audience(), kicker: 'Votre équilibre',
        title: 'Qui es-tu à l’aise de laisser rencontrer à ta moitié ?',
        guide: 'Choisis uniquement des personnes ou des profils. Les pratiques ont déjà été renseignées dans la partie commune du couple.',
        body: (d) => checkGrid('p0_partner_permissions', TARGETS, selected('p0_partner_permissions'))
      });
    }
    steps.push({
      audience: audience(), kicker: 'Tes envies personnelles',
      title: 'Qu’aimerais-tu vivre ou explorer pour toi ?',
      guide: 'Cette réponse appartient à ta fiche personnelle. Elle complète les pratiques communes sans les confondre.',
      body: (d) => checkGrid('p0_desired_practices', PRACTICES, selected('p0_desired_practices'))
    });
    steps.push({
      audience: audience(), kicker: 'Derrière le profil',
      title: 'Si tu devais te présenter librement…',
      guide: 'Raconte ton caractère, ta manière d’aborder les rencontres et ce que les autres devraient comprendre de toi.',
      finish: couple ? 'Enregistrer ma fiche' : 'Continuer',
      body: (d) => `<label class="ov-field">Ta description personnelle<textarea name="p0_biography" maxlength="4000">${escapeHtml(d.p0_biography)}</textarea></label>`
    });
    return steps;
  }

  function soloCommonSteps() {
    return [
      {
        audience: 'Ton profil individuel', kicker: 'Ton identité Velvet',
        title: 'Quel nom apparaîtra sur ton profil ?',
        guide: 'Il peut s’agir de ton prénom, d’un pseudonyme ou d’un nom que tu utilises déjà.',
        body: (d) => `<label class="ov-field">Nom affiché<input name="display_name" maxlength="120" value="${escapeHtml(d.display_name)}" required></label>`
      },
      {
        audience: 'Ton profil individuel', kicker: 'Ta localisation privée',
        title: 'Dans quelle commune vis-tu ?',
        guide: 'Cette commune sert uniquement à calculer les distances.',
        body: (d) => communeInput('city', 'Commune de résidence', d.city, 'Cette information reste privée.')
      },
      {
        audience: 'Ton profil individuel', kicker: 'Ta localisation publique',
        title: 'Quelle zone souhaites-tu afficher ?',
        guide: 'Choisis la précision qui te convient. Seule cette zone sera visible.',
        body: (d) => communeInput('location_zone', 'Zone affichée sur le profil', d.location_zone, 'Exemple : Lille et alentours.')
      },
      ...personalSteps({ couple: false }),
      {
        audience: 'Ton profil individuel', kicker: 'Première impression',
        title: 'Comment te présenter en quelques phrases ?',
        guide: 'Ce texte sera la première chose que les autres membres liront.',
        body: (d) => `<label class="ov-field">Présentation principale<textarea name="description" minlength="20" maxlength="4000" required>${escapeHtml(d.description)}</textarea></label>`
      },
      {
        audience: 'Ton profil individuel', kicker: 'Ton histoire',
        title: 'Quel parcours t’a mené jusqu’ici ?',
        guide: 'Raconte ce que tu souhaites partager de ton histoire et de tes découvertes.',
        body: (d) => `<div class="ov-grid"><label class="ov-field">Ton histoire<textarea name="story" maxlength="8000">${escapeHtml(d.story)}</textarea></label><label class="ov-field">Ton parcours<textarea name="journey" maxlength="4000">${escapeHtml(d.journey)}</textarea></label></div>`
      },
      {
        audience: 'Ton profil individuel', kicker: 'Tes rencontres',
        title: 'Qu’aimerais-tu trouver sur Velvet ?',
        guide: 'Parle des personnes, du rythme et du type de relation que tu recherches.',
        body: (d) => `<label class="ov-field">Ce que je recherche<textarea name="search_text" maxlength="4000">${escapeHtml(d.search_text)}</textarea></label>`
      },
      {
        audience: 'Ton profil individuel', kicker: 'Tes pratiques',
        title: 'Qu’aimes-tu vivre ou explorer ?',
        guide: 'Les pratiques sont renseignées ici, séparément des personnes que tu souhaites rencontrer.',
        body: (d) => checkGrid('practices', PRACTICES, selected('practices'))
      },
      {
        audience: 'Ton profil individuel', kicker: 'Tes valeurs',
        title: 'Quelles valeurs doivent guider tes rencontres ?',
        guide: 'Ces repères donnent immédiatement le ton de ton profil.',
        body: (d) => checkGrid('values_list', VALUES, selected('values_list'))
      },
      {
        audience: 'Ton profil individuel', kicker: 'Ton rythme',
        title: 'Quand es-tu généralement disponible ?',
        guide: 'Plusieurs réponses sont possibles.',
        body: (d) => checkGrid('availability', AVAILABILITY, selected('availability'))
      },
      {
        audience: 'Ton profil individuel', kicker: 'Tes habitudes',
        title: 'Quels lieux aimes-tu fréquenter ?',
        guide: 'Tu pourras compléter cette liste plus tard depuis ta page Mon profil.',
        finish: 'Créer mon profil',
        body: (d) => venueInput(d.favorite_places || [])
      }
    ];
  }

  function startProfileChoice() {
    runWizard({
      steps: [{
        audience: 'Première étape', kicker: 'Bienvenue dans Velvet',
        title: 'Pour qui allons-nous créer ce profil ?',
        guide: 'Dis-moi simplement si cette page doit raconter ton univers personnel ou celui de votre couple.',
        finish: 'Commencer',
        body: (d) => `<div class="ov-profile-choices">
          <label><input type="radio" name="profile_type" value="individual"${d.profile_type === 'individual' ? ' checked' : ''} required><span><b>Ce profil est pour moi</b><small>Une page personnelle centrée sur mon univers.</small></span></label>
          <label><input type="radio" name="profile_type" value="couple"${d.profile_type === 'couple' ? ' checked' : ''} required><span><b>Ce profil est pour notre couple</b><small>Une page commune et deux fiches personnelles.</small></span></label>
        </div>`
      }],
      onComplete: async (draft) => {
        if (draft.profile_type === 'couple') startCoupleCommon();
        else startSolo();
      }
    });
  }

  function startCoupleCommon() {
    runWizard({
      steps: commonCoupleSteps(),
      onComplete: async (draft) => {
        await api('/api/members/couple-profile', {
          method: 'POST',
          body: JSON.stringify({
            display_name: draft.display_name,
            relationship_since: draft.relationship_since,
            city: draft.city,
            location_zone: draft.location_zone,
            description: draft.description,
            story: draft.story,
            journey: draft.journey,
            search_text: draft.search_text,
            practices: draft.practices || [],
            values_list: draft.values_list || [],
            availability_text: (draft.availability || []).join(' · '),
            favorite_places: draft.favorite_places || []
          })
        });
        await refreshState();
        showPartnerInvitation();
      }
    });
  }

  function startSolo() {
    runWizard({
      steps: soloCommonSteps(),
      onComplete: async (draft) => {
        await savePersonalProfile('individual', draft);
        await refreshState();
        showPhotoStage({ role: 'individual_gallery', minimum: 3, title: 'Ajoute les premières photos de ton profil.', guide: 'Ces photos alimenteront directement ton carrousel public. Tu dois être clairement visible, au minimum à mi-corps.' });
      }
    });
  }

  async function savePersonalProfile(profileType, draft) {
    const profile = state.profileResult?.profile;
    const common = profile || draft;
    await api('/api/members/profile', {
      method: 'POST',
      body: JSON.stringify({
        profile_type: profileType,
        display_name: common.display_name,
        city: common.city,
        location_zone: common.location_zone,
        relationship_since: common.relationship_since,
        description: common.description,
        story: common.story,
        journey: common.journey,
        search_text: common.search_text,
        practices: common.practices || draft.practices || [],
        values_list: common.values_list || draft.values_list || [],
        availability_text: common.availability_text || (draft.availability || []).join(' · '),
        favorite_places: common.favorite_places || draft.favorite_places || [],
        person: {
          first_name: draft.p0_first_name,
          gender_identity: draft.p0_gender_identity,
          birth_year: draft.p0_birth_year,
          height_cm: draft.p0_height_cm,
          weight_kg: draft.p0_weight_kg,
          morphology: draft.p0_morphology,
          hair_color: draft.p0_hair_color,
          eye_color: draft.p0_eye_color,
          children_status: draft.p0_children_status || 'private',
          profession: draft.p0_profession,
          profession_private: Array.isArray(draft.p0_profession_private)
            ? draft.p0_profession_private.includes('true')
            : draft.p0_profession_private !== false,
          orientation: draft.p0_orientation,
          frequency: draft.p0_frequency,
          biography: draft.p0_biography,
          attracted_to: draft.p0_attracted_to || [],
          desired_practices: draft.p0_desired_practices || [],
          partner_permissions: profileType === 'couple' ? (draft.p0_partner_permissions || []) : []
        }
      })
    });
  }

  async function refreshState() {
    state.profileResult = await api('/api/members/profile');
    state.photos = (await api('/api/members/photos').catch(() => ({ photos: [] }))).photos || [];
    if (state.profileResult.profile?.profile_type === 'couple') {
      state.invitation = (await api('/api/members/couple-invite').catch(() => ({ invitation: null }))).invitation;
    }
  }

  function showPartnerInvitation() {
    const profile = state.profileResult.profile;
    const existing = state.invitation;
    content.innerHTML = `<div class="ov-page"><section class="ov-shell ov-center">
      <div class="ov-guide"><span>V</span><p><strong>Velvet</strong>La partie commune est prête. Je vais maintenant inviter ta moitié pendant que nous poursuivons ensemble.</p></div>
      <p class="ov-kicker">Profil couple · invitation</p>
      <h1>${existing?.status === 'pending' ? 'L’invitation est déjà en route.' : 'À quelle adresse dois-je écrire à ta moitié ?'}</h1>
      ${existing?.status === 'pending' ? `<div class="ov-status-card"><strong>${escapeHtml(existing.invited_email)}</strong><span>${existing.delivery_status === 'sent' ? 'E-mail envoyé automatiquement' : 'Invitation créée'}</span></div>` : `
        <form id="ovInviteForm" class="ov-form">
          <label class="ov-field">Adresse e-mail de ta moitié<input type="email" name="email" autocomplete="email" required></label>
          <button class="primary" type="submit">Envoyer son invitation</button>
        </form>`}
      <div class="ov-actions standalone">
        ${existing?.status === 'pending' ? '<button class="secondary" type="button" data-renew>Renvoyer ou changer l’adresse</button>' : ''}
        ${existing?.status === 'pending' ? '<button class="primary" type="button" data-continue>Continuer avec nos photos</button>' : ''}
      </div>
    </section></div>`;
    content.querySelector('#ovInviteForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      button.disabled = true;
      try {
        const result = await api('/api/members/couple-invite', {
          method: 'POST',
          body: JSON.stringify({ email: new FormData(event.currentTarget).get('email') })
        });
        state.invitation = {
          invited_email: result.invitedEmail,
          status: 'pending',
          delivery_status: result.emailDelivery?.status || 'not_attempted'
        };
        if (result.emailDelivery?.status === 'sent') toast('Invitation envoyée automatiquement.');
        else toast('Invitation créée. Le lien de secours reste disponible.', true);
        showInvitationResult(result);
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
    });
    content.querySelector('[data-renew]')?.addEventListener('click', () => {
      state.invitation = null;
      showPartnerInvitation();
    });
    content.querySelector('[data-continue]')?.addEventListener('click', () => {
      showPhotoStage({ role: 'couple_gallery', minimum: 3, title: 'Choisissez les premières photos de votre couple.', guide: 'Vous devez être visibles tous les deux, avec un cadrage au minimum à mi-corps et une netteté suffisante.' });
    });
  }

  function showInvitationResult(result) {
    const sent = result.emailDelivery?.status === 'sent';
    content.innerHTML = `<div class="ov-page"><section class="ov-shell ov-center">
      <div class="ov-guide"><span>V</span><p><strong>Velvet</strong>${sent ? 'C’est fait. Ta moitié peut maintenant commencer à se confier de son côté.' : 'L’invitation est créée, mais l’envoi automatique n’est pas encore disponible. Utilise le lien de secours pour ce test.'}</p></div>
      <p class="ov-kicker">Invitation partenaire</p>
      <h1>${sent ? 'Son invitation est en route.' : 'Le lien est prêt.'}</h1>
      <div class="ov-status-card"><strong>${escapeHtml(result.invitedEmail)}</strong><span>${sent ? 'E-mail envoyé automatiquement' : 'Lien personnel valable sept jours'}</span></div>
      <div class="ov-actions standalone">
        ${!sent ? '<button class="secondary" type="button" data-copy>Copier le lien sécurisé</button>' : ''}
        <button class="primary" type="button" data-continue>Continuer avec nos photos</button>
      </div>
    </section></div>`;
    content.querySelector('[data-copy]')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(result.registrationUrl).catch(() => null);
      toast('Lien copié.');
    });
    content.querySelector('[data-continue]').addEventListener('click', () => {
      showPhotoStage({ role: 'couple_gallery', minimum: 3, title: 'Choisissez les premières photos de votre couple.', guide: 'Vous devez être visibles tous les deux, avec un cadrage au minimum à mi-corps et une netteté suffisante.' });
    });
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

  async function uploadPhotos(files, role, individualProfileId = null, statusNode = null) {
    for (let index = 0; index < files.length; index += 1) {
      if (statusNode) statusNode.textContent = `Préparation et analyse ${index + 1}/${files.length}…`;
      const body = new FormData();
      body.set('photo', await optimizePhoto(files[index]));
      body.set('mediaRole', role);
      if (individualProfileId) body.set('individualProfileId', individualProfileId);
      await api('/api/members/photos', { method: 'POST', body });
    }
    await refreshState();
  }

  function showPhotoStage({ role, minimum, title, guide, individualProfileId = null }) {
    const current = state.photos.filter((photo) => photo.media_role === role && (!individualProfileId || photo.individual_profile_id === individualProfileId));
    content.innerHTML = `<div class="ov-page"><section class="ov-shell">
      <div class="ov-guide"><span>V</span><p><strong>Velvet</strong>${escapeHtml(guide)}</p></div>
      <p class="ov-kicker">Photos obligatoires</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="ov-photo-progress"><strong>${current.length}</strong><span>sur ${minimum} minimum</span></div>
      <form id="ovPhotoForm" class="ov-photo-form">
        <label class="ov-drop">Choisir ${minimum > 1 ? 'des photos' : 'une photo'}<input type="file" name="photos" accept="image/jpeg,image/png,image/webp"${minimum > 1 ? ' multiple' : ''} required></label>
        <button class="primary" type="submit">Ajouter et faire vérifier</button>
        <p data-status></p>
      </form>
      <div class="ov-photo-list">${current.map((photo) => `<span class="${escapeHtml(photo.moderation_status)}">${photo.moderation_status === 'approved' ? 'Validée' : photo.moderation_status === 'rejected' ? 'À remplacer' : 'Analyse en cours'}</span>`).join('')}</div>
      <div class="ov-actions standalone">
        <button class="primary" type="button" data-next${current.length < minimum ? ' disabled' : ''}>${role === 'couple_gallery' ? 'Maintenant, parlons de moi' : 'Continuer'}</button>
      </div>
    </section></div>`;
    const form = content.querySelector('#ovPhotoForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const status = form.querySelector('[data-status]');
      button.disabled = true;
      try {
        const files = [...form.elements.photos.files];
        await uploadPhotos(files, role, individualProfileId, status);
        showPhotoStage({ role, minimum, title, guide, individualProfileId });
      } catch (error) {
        status.textContent = errors[error.message] || error.message;
        button.disabled = false;
      }
    });
    content.querySelector('[data-next]').addEventListener('click', async () => {
      if (role === 'couple_gallery') {
        startCouplePersonal();
      } else {
        await renderWaitingGate();
      }
    });
  }

  function startCouplePersonal() {
    const ownPerson = (state.profileResult.profile.individual_profiles || []).find((person) => person.linked_user_id === state.profileResult.account.userId);
    state.draft = ownPerson ? {
      ...state.draft,
      p0_first_name: ownPerson.first_name,
      p0_gender_identity: ownPerson.gender_identity
    } : state.draft;
    runWizard({
      steps: personalSteps({ couple: true }),
      onComplete: async (draft) => {
        await savePersonalProfile('couple', draft);
        await refreshState();
        const person = state.profileResult.profile.individual_profiles.find((row) => row.linked_user_id === state.profileResult.account.userId);
        showPhotoStage({
          role: 'individual_portrait',
          minimum: 1,
          individualProfileId: person.id,
          title: `Ajoute maintenant la photo personnelle de ${person.first_name}.`,
          guide: 'Cette photo alimentera ta fiche individuelle. Tu dois apparaître seul(e), clairement visible et au minimum à mi-corps.'
        });
      }
    });
  }

  async function renderWaitingGate() {
    await refreshState();
    const profile = state.profileResult.profile;
    if (profile.admission_status === 'approved') {
      loadLegacyApplication();
      return;
    }
    const people = profile.individual_profiles || [];
    const linkedPeople = people.filter((person) => person.linked_user_id);
    const own = people.find((person) => person.linked_user_id === state.profileResult.account.userId);
    const galleryRole = profile.profile_type === 'couple' ? 'couple_gallery' : 'individual_gallery';
    const gallery = state.photos.filter((photo) => photo.media_role === galleryRole);
    const portraits = state.photos.filter((photo) => photo.media_role === 'individual_portrait');
    const partnerPending = profile.profile_type === 'couple' && linkedPeople.length < 2;
    const ownPortrait = own && portraits.some((photo) => photo.individual_profile_id === own.id);
    const approvedGallery = gallery.filter((photo) => photo.moderation_status === 'approved').length;
    const approvedPortraits = new Set(portraits.filter((photo) => photo.moderation_status === 'approved').map((photo) => photo.individual_profile_id)).size;

    content.innerHTML = `<div class="ov-page"><section class="ov-shell ov-waiting">
      <div class="ov-guide"><span>V</span><p><strong>Velvet</strong>${partnerPending ? 'Ta partie est entre de bonnes mains. Pendant ce temps, ta moitié avance à son rythme.' : 'Vous vous êtes tous les deux confiés. Velvet Intelligence termine maintenant les vérifications.'}</p></div>
      <p class="ov-kicker">Admission Velvet</p>
      <h1>${partnerPending ? 'Un peu de patience, votre moitié n’a pas fini de se confier.' : 'Votre histoire est presque prête à être dévoilée.'}</h1>
      <div class="ov-progress-cards">
        <article><strong>✓</strong><span>Fiche du couple</span></article>
        <article><strong>${linkedPeople.length}/${profile.profile_type === 'couple' ? 2 : 1}</strong><span>Fiches personnelles</span></article>
        <article><strong>${approvedGallery}/3</strong><span>Photos du carrousel validées</span></article>
        ${profile.profile_type === 'couple' ? `<article><strong>${approvedPortraits}/2</strong><span>Portraits individuels validés</span></article>` : ''}
      </div>
      ${profile.profile_type === 'couple' && !ownPortrait && own ? '<p class="ov-alert">Ta photo individuelle manque encore.</p>' : ''}
      <div class="ov-actions standalone">
        ${profile.profile_type === 'couple' && !ownPortrait && own ? '<button class="secondary" type="button" data-own-photo>Ajouter ma photo</button>' : ''}
        <button class="primary" type="button" data-refresh>Actualiser l’avancement</button>
      </div>
      <button class="ov-logout" type="button" data-logout>Se déconnecter</button>
    </section></div>`;
    content.querySelector('[data-refresh]').addEventListener('click', renderWaitingGate);
    content.querySelector('[data-own-photo]')?.addEventListener('click', () => showPhotoStage({
      role: 'individual_portrait', minimum: 1, individualProfileId: own.id,
      title: `Ajoute la photo personnelle de ${own.first_name}.`,
      guide: 'Tu dois apparaître seul(e), clairement visible et au minimum à mi-corps.'
    }));
    content.querySelector('[data-logout]').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => null);
      window.location.href = '/';
    });
  }

  function loadLegacyApplication() {
    document.body.classList.remove('onboarding-v2-active');
    const script = document.createElement('script');
    script.src = '/assets/members-live.js';
    script.defer = true;
    document.body.appendChild(script);
  }

  async function boot() {
    document.body.classList.add('onboarding-v2-active');
    try {
      await refreshState();
      const profile = state.profileResult.profile;
      if (!profile) {
        startProfileChoice();
        return;
      }
      if (profile.admission_status === 'approved') {
        loadLegacyApplication();
        return;
      }
      const ownComplete = state.profileResult.personalProfileComplete;
      const slot = state.profileResult.membership?.member_slot;
      const galleryRole = profile.profile_type === 'couple' ? 'couple_gallery' : 'individual_gallery';
      const galleryCount = state.photos.filter((photo) => photo.media_role === galleryRole).length;

      if (profile.profile_type === 'couple' && !ownComplete) {
        if (slot === 'partner_a') {
          if (!state.invitation || state.invitation.status !== 'pending') {
            showPartnerInvitation();
            return;
          }
          if (galleryCount < 3) {
            showPhotoStage({ role: 'couple_gallery', minimum: 3, title: 'Choisissez les premières photos de votre couple.', guide: 'Vous devez être visibles tous les deux, avec un cadrage au minimum à mi-corps et une netteté suffisante.' });
            return;
          }
        }
        startCouplePersonal();
        return;
      }

      if (profile.profile_type === 'individual' && !ownComplete) {
        startSolo();
        return;
      }

      await renderWaitingGate();
    } catch (error) {
      if (error.message === 'authentication_required') {
        window.location.href = '/?reason=session';
        return;
      }
      content.innerHTML = `<div class="ov-page"><section class="ov-shell ov-center"><p class="ov-kicker">Velvet</p><h1>Le parcours ne peut pas démarrer.</h1><p>${escapeHtml(errors[error.message] || error.message)}</p></section></div>`;
    }
  }

  boot();
})();
