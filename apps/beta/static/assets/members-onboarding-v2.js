(() => {
  const content = document.querySelector('#content');
  const toastNode = document.querySelector('#toast');
  const state = {
    profileResult: null,
    invitation: null,
    photos: [],
    draft: {},
    wizard: null,
    waitingMessage: ''
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
    invalid_photo_file: 'Choisis une photo JPG, PNG ou WebP de moins de 4 Mo.',
    ai_source_too_short: 'Ajoute au moins trois mots-clés précis avant de solliciter Velvet IA.',
    profile_ai_unavailable: 'Velvet IA est momentanément indisponible.',
    profile_ai_generation_failed: 'Velvet IA n’a pas pu composer ce texte. Enrichis légèrement ton brouillon puis réessaie.'
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

  function aiWriterField(name, label, value = '', {
    maxLength = 4000,
    minLength = 0,
    required = false
  } = {}) {
    return `<div class="ov-field ai-writer-field">
      <label>${escapeHtml(label)}
        <textarea name="${escapeHtml(name)}" data-ai-writer-source="${escapeHtml(name)}" maxlength="${maxLength}"${minLength ? ` minlength="${minLength}"` : ''}${required ? ' required' : ''}>${escapeHtml(value)}</textarea>
      </label>
      <div class="ai-writer-tools">
        <button type="button" class="ai-writer-button" data-ai-writer="${escapeHtml(name)}" disabled>✦ Velvet IA</button>
        <small data-ai-writer-status>Ajoute au moins 3 mots-clés précis.</small>
      </div>
    </div>`;
  }

  function sufficientAiSource(value) {
    const words = String(value || '').toLocaleLowerCase('fr').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{1,}/gu) || [];
    return String(value || '').trim().length >= 18 && new Set(words).size >= 3;
  }

  function bindAiWriters(scope) {
    scope.querySelectorAll('[data-ai-writer]').forEach((button) => {
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
              profileType: values.get('profile_type') || state.draft.profile_type || 'individual',
              relationshipSince: values.get('relationship_since') || state.draft.relationship_since || '',
              practices: values.getAll('practices').length ? values.getAll('practices') : (state.draft.practices || []),
              values: values.getAll('values_list').length ? values.getAll('values_list') : (state.draft.values_list || []),
              orientation: values.get('p0_orientation') || state.draft.p0_orientation || '',
              frequency: values.get('p0_frequency') || state.draft.p0_frequency || ''
            })
          });
          textarea.value = result.text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          status.textContent = 'Proposition générée — tu gardes la main avant l’enregistrement.';
          toast('Velvet IA a préparé une proposition. Relis-la et adapte-la librement.');
        } catch (error) {
          status.textContent = errors[error.message] || error.message;
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

  function optionList(options, current = '', { allowOther = true } = {}) {
    const known = options.includes(current);
    return `<option value="">Choisir…</option>${options.map((option) =>
      `<option value="${escapeHtml(option)}"${option === current ? ' selected' : ''}>${escapeHtml(option)}</option>`
    ).join('')}${allowOther ? `<option value="Autre"${current && !known ? ' selected' : ''}>Autre — je me définis autrement</option>` : ''}`;
  }

  function checkGrid(name, options, values = [], { allowOther = true } = {}) {
    const active = new Set(values || []);
    const custom = (values || []).find((value) => !options.includes(value)) || '';
    return `<div class="ov-choice-grid" data-choice-group="${escapeHtml(name)}">${options.map((option) => `
      <label class="ov-check">
        <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(option)}"${active.has(option) ? ' checked' : ''}>
        <span>${escapeHtml(option)}</span>
      </label>`).join('')}${allowOther ? `
      <label class="ov-check ov-check-other">
        <input type="checkbox" name="${escapeHtml(name)}" value="__other__"${custom ? ' checked' : ''}>
        <span>Autre — préciser librement</span>
      </label>
      <label class="ov-field ov-other-field"${custom ? '' : ' hidden'}>Ma réponse
        <input type="text" data-other-for="${escapeHtml(name)}" maxlength="120" value="${escapeHtml(custom)}" placeholder="Quelques mots suffisent">
      </label>` : ''}</div>`;
  }

  function selectWithOther(name, label, options, current = '', required = false) {
    const known = options.includes(current);
    return `<div class="ov-select-other"><label class="ov-field">${escapeHtml(label)}
      <select name="${escapeHtml(name)}"${required ? ' required' : ''}>${optionList(options, current)}</select>
    </label><label class="ov-field ov-other-field"${current && !known ? '' : ' hidden'}>Ma réponse
      <input type="text" data-select-other-for="${escapeHtml(name)}" maxlength="120" value="${escapeHtml(current && !known ? current : '')}" placeholder="Décris-toi avec tes propres mots">
    </label></div>`;
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

  function discoveryPreview(draft, couple) {
    const chips = (values) => (values || []).map((value) => `<span>${escapeHtml(value)}</span>`).join('') || '<em>À compléter plus tard</em>';
    return `<div class="ov-preview">
      <article><small>Présentation</small><strong>${escapeHtml(draft.display_name || draft.p0_first_name || 'Mon profil')}</strong><p>${escapeHtml(draft.description || '')}</p></article>
      <article><small>${couple ? 'Notre univers' : 'Mon univers'}</small><div>${chips(draft.practices || draft.p0_desired_practices)}</div></article>
      <article><small>Ce qui compte</small><div>${chips(draft.values_list)}</div></article>
      <article><small>Rencontres et affinités</small><div>${chips([...(draft.meeting_styles || []), ...(draft.p0_attracted_to || [])])}</div></article>
      <p>Tout restera modifiable depuis le profil. Velvet n’ajoute aucune envie ni expérience que tu n’as pas déclarée.</p>
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
    bindAiWriters(scope);
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
    form.querySelectorAll('[data-other-for]').forEach((input) => {
      const name = input.dataset.otherFor;
      const custom = input.value.trim();
      const values = Array.isArray(draft[name]) ? draft[name].filter((value) => value !== '__other__') : [];
      if (custom && form.querySelector(`[name="${CSS.escape(name)}"][value="__other__"]`)?.checked) values.push(custom);
      draft[name] = values;
    });
    form.querySelectorAll('[data-select-other-for]').forEach((input) => {
      const name = input.dataset.selectOtherFor;
      if (draft[name] === 'Autre') draft[name] = input.value.trim();
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
      form.querySelectorAll('[data-choice-group]').forEach((group) => {
        const other = group.querySelector('input[value="__other__"]');
        const field = group.querySelector('[data-other-for]')?.closest('.ov-other-field');
        other?.addEventListener('change', () => {
          if (field) field.hidden = !other.checked;
          if (other.checked) field?.querySelector('input')?.focus();
        });
      });
      form.querySelectorAll('.ov-select-other select').forEach((select) => {
        const field = select.closest('.ov-select-other')?.querySelector('[data-select-other-for]')?.closest('.ov-other-field');
        select.addEventListener('change', () => {
          if (field) field.hidden = select.value !== 'Autre';
          if (select.value === 'Autre') field?.querySelector('input')?.focus();
        });
      });
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
        audience: 'À propos du couple', kicker: 'Vos premiers repères',
        title: 'D’où partez-vous, et depuis quand avancez-vous ensemble ?',
        guide: 'Ces deux repères suffisent. La commune exacte reste privée et seule la zone choisie sera affichée.',
        body: (d) => `<div class="ov-grid"><label class="ov-field">Ensemble depuis<input name="relationship_since" type="number" min="1900" max="${new Date().getFullYear()}" value="${escapeHtml(d.relationship_since)}" placeholder="Exemple : 2012"></label>${communeInput('city', 'Commune de résidence', d.city, 'Cette information reste privée.')}</div>`
      },
      {
        audience: 'À propos du couple', kicker: 'Votre localisation publique',
        title: 'Quelle zone souhaitez-vous montrer ?',
        guide: 'Choisissez une zone assez précise pour être utile, mais suffisamment large pour préserver votre discrétion.',
        body: (d) => communeInput('location_zone', 'Zone affichée sur le profil', d.location_zone, 'Exemple : Lens et alentours.')
      },
      {
        audience: 'À propos du couple', kicker: 'Votre façon de rencontrer',
        title: 'Quel type de connexion vous ressemble ?',
        guide: 'Choisissez les réponses qui vous attirent. Si aucune ne convient, écrivez la vôtre en quelques mots.',
        body: () => checkGrid('meeting_styles', ['Faire connaissance avant de se rencontrer', 'Sorties en club ou spa', 'Soirées privées en petit comité', 'Rencontres suivies', 'Découverte sans scénario écrit', 'Selon le feeling'], selected('meeting_styles'))
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
        audience: 'À propos du couple', kicker: 'Vos mots',
        title: 'Décrivez-vous, simplement.',
        guide: 'C’est le seul texte libre demandé. Dites ce qui vous rend singuliers ; Velvet utilisera aussi vos choix pour structurer le reste de la fiche.',
        body: (d) => aiWriterField('description', 'Décrivez-vous', d.description, { minLength: 20, maxLength: 4000, required: true })
      },
      {
        audience: 'À propos du couple', kicker: 'Vos habitudes',
        title: 'Quels lieux aimez-vous fréquenter ?',
        guide: 'Commencez à saisir le nom d’un club ou d’un spa. Cette liste restera modifiable depuis votre profil.',
        body: (d) => venueInput(d.favorite_places || [])
      },
      {
        audience: 'À propos du couple', kicker: 'Votre reflet Velvet',
        title: 'Est-ce bien vous ?',
        guide: 'Voici ce que vos réponses racontent. Revenez en arrière si quelque chose ne vous ressemble pas.',
        finish: 'Créer notre espace couple',
        body: (d) => discoveryPreview(d, true)
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
        body: (d) => selectWithOther('p0_gender_identity', 'Identité de genre', GENDERS, d.p0_gender_identity, true)
      },
      {
        audience: audience(), kicker: 'Quelques repères',
        title: 'Comment te décrirais-tu physiquement ?',
        guide: 'Tu peux laisser les informations facultatives vides et les compléter plus tard.',
        body: (d) => `<div class="ov-grid">
          <label class="ov-field">Année de naissance<input name="p0_birth_year" type="number" min="1900" max="${new Date().getFullYear() - 18}" value="${escapeHtml(d.p0_birth_year)}"></label>
          <label class="ov-field">Taille en cm<input name="p0_height_cm" type="number" min="100" max="250" value="${escapeHtml(d.p0_height_cm)}"></label>
          <label class="ov-field">Poids en kg<input name="p0_weight_kg" type="number" min="30" max="350" value="${escapeHtml(d.p0_weight_kg)}"></label>
          ${selectWithOther('p0_morphology', 'Morphologie', MORPHOLOGIES, d.p0_morphology)}
        </div>`
      },
      {
        audience: audience(), kicker: 'Ton allure',
        title: 'Quels détails complètent ton portrait ?',
        guide: 'Deux repères simples avant de passer à ce qui te caractérise vraiment.',
        body: (d) => `<div class="ov-grid">
          ${selectWithOther('p0_hair_color', 'Couleur des cheveux', HAIR, d.p0_hair_color)}
          ${selectWithOther('p0_eye_color', 'Couleur des yeux', EYES, d.p0_eye_color)}
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
        body: (d) => selectWithOther('p0_orientation', 'Orientation', ORIENTATIONS, d.p0_orientation)
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
        body: (d) => selectWithOther('p0_frequency', 'Fréquence actuelle', FREQUENCIES, d.p0_frequency)
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
    if (couple) {
      steps.push({
        audience: audience(), kicker: 'Tes envies personnelles',
        title: 'Qu’aimerais-tu vivre ou explorer pour toi ?',
        guide: 'Cette réponse appartient à ta fiche personnelle. Elle complète les pratiques communes sans les confondre.',
        body: (d) => checkGrid('p0_desired_practices', PRACTICES, selected('p0_desired_practices'))
      });
    }
    steps[steps.length - 1].finish = couple ? 'Enregistrer ma fiche' : 'Continuer';
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
        title: 'Décris-toi, simplement.',
        guide: 'C’est le seul texte libre demandé. Parle de ton caractère et de ce qui te rend singulier ; Velvet structurera le reste à partir de tes réponses.',
        body: (d) => aiWriterField('description', 'Décris-toi', d.description, { minLength: 20, maxLength: 4000, required: true })
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
        body: (d) => venueInput(d.favorite_places || [])
      },
      {
        audience: 'Ton profil individuel', kicker: 'Ton reflet Velvet',
        title: 'Est-ce bien toi ?',
        guide: 'Voici ce que tes réponses racontent. Reviens en arrière si quelque chose ne te ressemble pas.',
        finish: 'Créer mon profil',
        body: (d) => discoveryPreview(d, false)
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
            story: '',
            journey: '',
            search_text: discoverySearchText(draft, true),
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

  function discoverySearchText(draft, couple) {
    const targets = (draft.p0_attracted_to || []).join(', ');
    const styles = (draft.meeting_styles || []).join(', ');
    const values = (draft.values_list || []).join(', ');
    const parts = [];
    if (targets) parts.push(`${couple ? 'Nous pouvons être attirés par' : 'Je peux être attiré(e) par'} ${targets.toLocaleLowerCase('fr')}`);
    if (styles) parts.push(`${couple ? 'Nous privilégions' : 'Je privilégie'} ${styles.toLocaleLowerCase('fr')}`);
    if (values) parts.push(`Avec ${values.toLocaleLowerCase('fr')}`);
    return parts.length ? `${parts.join('. ')}.` : '';
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
        story: common.story || '',
        journey: common.journey || '',
        search_text: common.search_text || discoverySearchText(draft, profileType === 'couple'),
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
          biography: draft.p0_biography || (profileType === 'individual' ? common.description : ''),
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
    const approved = current.filter((photo) => photo.moderation_status === 'approved');
    const pending = current.filter((photo) => photo.moderation_status === 'pending');
    const rejected = current.filter((photo) => photo.moderation_status === 'rejected');
    content.innerHTML = `<div class="ov-page"><section class="ov-shell">
      <div class="ov-guide"><span>V</span><p><strong>Velvet</strong>${escapeHtml(guide)}</p></div>
      <p class="ov-kicker">Photos obligatoires</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="ov-photo-progress"><strong>${approved.length}</strong><span>sur ${minimum} validée${minimum > 1 ? 's' : ''}</span></div>
      <form id="ovPhotoForm" class="ov-photo-form">
        <label class="ov-drop"><span data-file-label>Choisir ${minimum > 1 ? 'des photos' : 'une photo'}</span><input type="file" name="photos" accept="image/jpeg,image/png,image/webp"${minimum > 1 ? ' multiple' : ''} required></label>
        <button class="primary" type="submit" data-upload disabled>Ajouter et faire vérifier</button>
        <div data-selection hidden aria-live="polite" style="grid-column:1/-1;margin-top:12px"></div>
        <p data-status role="status"></p>
      </form>
      ${pending.length ? `<p class="ov-alert">${pending.length} photo${pending.length > 1 ? 's sont' : ' est'} enregistrée${pending.length > 1 ? 's' : ''} et transmise${pending.length > 1 ? 's' : ''} au contrôle. Il est inutile de ${pending.length > 1 ? 'les' : 'la'} renvoyer.</p>` : ''}
      ${rejected.length ? `<p class="ov-alert">${rejected.length} photo${rejected.length > 1 ? 's doivent' : ' doit'} être remplacée${rejected.length > 1 ? 's' : ''}.</p>` : ''}
      <div class="ov-photo-list">${current.map((photo) => `<figure style="margin:0;display:grid;gap:7px;min-width:110px">
        ${photo.previewUrl ? `<img src="${escapeHtml(photo.previewUrl)}" alt="Photo de profil enregistrée" style="width:110px;height:130px;object-fit:cover;border-radius:14px">` : ''}
        <span class="${escapeHtml(photo.moderation_status)}">${photo.moderation_status === 'approved' ? 'Validée' : photo.moderation_status === 'rejected' ? 'À remplacer' : 'Contrôle en attente'}</span>
        ${photo.moderation_status === 'rejected' ? `<button type="button" class="secondary" data-delete-photo="${escapeHtml(photo.id)}">Supprimer</button>` : ''}
      </figure>`).join('')}</div>
      <div class="ov-actions standalone">
        ${pending.length ? '<button class="secondary" type="button" data-retry-ai>Relancer la validation automatique</button>' : ''}
        <button class="primary" type="button" data-next${approved.length < minimum ? ' disabled' : ''}>${role === 'couple_gallery' ? 'Maintenant, parlons de moi' : 'Continuer'}</button>
      </div>
    </section></div>`;
    const form = content.querySelector('#ovPhotoForm');
    const fileInput = form.elements.photos;
    const fileLabel = form.querySelector('[data-file-label]');
    const selection = form.querySelector('[data-selection]');
    const uploadButton = form.querySelector('[data-upload]');
    fileInput.addEventListener('change', () => {
      const files = [...fileInput.files];
      uploadButton.disabled = files.length === 0;
      fileLabel.textContent = files.length
        ? `${files.length} photo${files.length > 1 ? 's' : ''} sélectionnée${files.length > 1 ? 's' : ''}`
        : `Choisir ${minimum > 1 ? 'des photos' : 'une photo'}`;
      selection.hidden = files.length === 0;
      selection.innerHTML = files.length ? `
        <strong>${files.length} fichier${files.length > 1 ? 's' : ''} prêt${files.length > 1 ? 's' : ''} à être envoyé${files.length > 1 ? 's' : ''}</strong>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,120px));gap:10px;margin-top:10px">
          ${files.map((file) => {
            const previewUrl = URL.createObjectURL(file);
            return `<figure style="margin:0"><img data-local-preview src="${escapeHtml(previewUrl)}" alt="Aperçu de ${escapeHtml(file.name)}" style="display:block;width:100%;height:110px;object-fit:cover;border-radius:14px"><figcaption style="margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${escapeHtml(file.name)}</figcaption></figure>`;
          }).join('')}
        </div>
        <small style="display:block;margin-top:9px">Clique maintenant sur « Ajouter et faire vérifier » pour lancer l’enregistrement et l’analyse.</small>` : '';
      selection.querySelectorAll('[data-local-preview]').forEach((image) => {
        image.addEventListener('load', () => URL.revokeObjectURL(image.src), { once: true });
      });
      uploadButton.textContent = files.length
        ? `Ajouter et vérifier ${files.length} photo${files.length > 1 ? 's' : ''}`
        : 'Ajouter et faire vérifier';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = uploadButton;
      const status = form.querySelector('[data-status]');
      button.disabled = true;
      try {
        const files = [...fileInput.files];
        if (!files.length) throw new Error('invalid_photo_file');
        await uploadPhotos(files, role, individualProfileId, status);
        showPhotoStage({ role, minimum, title, guide, individualProfileId });
      } catch (error) {
        status.textContent = errors[error.message] || error.message;
        button.disabled = false;
      }
    });
    content.querySelectorAll('[data-delete-photo]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await api(`/api/members/photos?id=${encodeURIComponent(button.dataset.deletePhoto)}`, { method: 'DELETE' });
        await refreshState();
        showPhotoStage({ role, minimum, title, guide, individualProfileId });
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
    }));
    content.querySelector('[data-retry-ai]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const status = form.querySelector('[data-status]');
      button.disabled = true;
      button.textContent = 'Velvet Intelligence analyse…';
      try {
        const result = await api('/api/members/photos', { method: 'PATCH', body: '{}' });
        if (!result.attempted) {
          status.textContent = 'Ces photos ont déjà été analysées et attendent une décision humaine.';
        } else if (result.failed) {
          status.textContent = `L’analyse automatique n’a pas pu traiter ${result.failed} photo${result.failed > 1 ? 's' : ''}. Elles restent disponibles dans Velvet Control.`;
        } else {
          status.textContent = `${result.approved} validée${result.approved > 1 ? 's' : ''}, ${result.review} transmise${result.review > 1 ? 's' : ''} au contrôle et ${result.rejected} refusée${result.rejected > 1 ? 's' : ''}.`;
        }
        await refreshState();
        window.setTimeout(() => showPhotoStage({ role, minimum, title, guide, individualProfileId }), 900);
      } catch (error) {
        status.textContent = errors[error.message] || 'La validation automatique reste indisponible. Les photos sont conservées pour le contrôle humain.';
        button.disabled = false;
        button.textContent = 'Relancer la validation automatique';
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
    const pendingGallery = gallery.filter((photo) => photo.moderation_status === 'pending').length;
    const rejectedGallery = gallery.filter((photo) => photo.moderation_status === 'rejected').length;
    const missingGallery = Math.max(0, 3 - gallery.length);
    const approvedPortraits = new Set(portraits.filter((photo) => photo.moderation_status === 'approved').map((photo) => photo.individual_profile_id)).size;
    const isCouple = profile.profile_type === 'couple';
    const guide = isCouple
      ? partnerPending
        ? 'Ta partie est entre de bonnes mains. Pendant ce temps, ta moitié avance à son rythme.'
        : 'Vous vous êtes tous les deux confiés. Velvet Intelligence termine maintenant les vérifications.'
      : 'Ton profil est bien enregistré. Velvet Intelligence termine maintenant la vérification de tes photos.';
    const title = isCouple
      ? partnerPending
        ? 'Un peu de patience, votre moitié n’a pas fini de se confier.'
        : 'Votre histoire est presque prête à être dévoilée.'
      : 'Ton profil est presque prêt à être dévoilé.';

    content.innerHTML = `<div class="ov-page"><section class="ov-shell ov-waiting">
      <div class="ov-guide"><span>V</span><p><strong>Velvet</strong>${escapeHtml(guide)}</p></div>
      <p class="ov-kicker">Admission Velvet</p>
      <h1>${escapeHtml(title)}</h1>
      <div class="ov-progress-cards">
        <article><strong>✓</strong><span>${isCouple ? 'Fiche du couple' : 'Fiche individuelle'}</span></article>
        <article><strong>${linkedPeople.length}/${profile.profile_type === 'couple' ? 2 : 1}</strong><span>Fiches personnelles</span></article>
        <article><strong>${approvedGallery}/3</strong><span>Photos du carrousel validées</span></article>
        ${isCouple ? `<article><strong>${approvedPortraits}/2</strong><span>Portraits individuels validés</span></article>` : ''}
      </div>
      ${missingGallery ? `<p class="ov-alert">${missingGallery === 3 ? 'Aucune photo n’a encore été enregistrée.' : `${missingGallery} photo${missingGallery > 1 ? 's manquent' : ' manque'} encore.`} Ajoute ${missingGallery > 1 ? 'tes photos' : 'la photo manquante'} pour poursuivre ton admission.</p>` : ''}
      ${pendingGallery ? `<p class="ov-alert">${pendingGallery} photo${pendingGallery > 1 ? 's sont enregistrées' : ' est enregistrée'} et ${pendingGallery > 1 ? 'attendent' : 'attend'} une validation. Tu n’as rien à renvoyer.</p>` : ''}
      ${rejectedGallery ? `<p class="ov-alert">${rejectedGallery} photo${rejectedGallery > 1 ? 's ont' : ' a'} été refusée${rejectedGallery > 1 ? 's' : ''}. Remplace-${rejectedGallery > 1 ? 'les' : 'la'} pour poursuivre.</p>` : ''}
      ${isCouple && !ownPortrait && own ? '<p class="ov-alert">Ta photo individuelle manque encore.</p>' : ''}
      ${state.waitingMessage ? `<p class="ov-alert" role="status">${escapeHtml(state.waitingMessage)}</p>` : ''}
      <div class="ov-actions standalone">
        ${missingGallery ? '<button class="secondary" type="button" data-add-gallery>Ajouter mes photos</button>' : ''}
        ${rejectedGallery ? '<button class="secondary" type="button" data-replace-gallery>Remplacer les photos refusées</button>' : ''}
        ${isCouple && !ownPortrait && own ? '<button class="secondary" type="button" data-own-photo>Ajouter ma photo</button>' : ''}
        <button class="primary" type="button" data-refresh>Actualiser l’avancement</button>
      </div>
      <button class="ov-logout" type="button" data-logout>Se déconnecter</button>
    </section></div>`;
    content.querySelector('[data-refresh]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Vérification en cours…';
      const previousStatus = profile.admission_status;
      const previousApproved = approvedGallery + approvedPortraits;
      await refreshState();
      const refreshedProfile = state.profileResult.profile;
      const refreshedApproved = state.photos.filter((photo) => photo.moderation_status === 'approved').length;
      if (refreshedProfile.admission_status === previousStatus && refreshedApproved === previousApproved) {
        const refreshedGallery = state.photos.filter((photo) => photo.media_role === galleryRole);
        state.waitingMessage = refreshedGallery.length
          ? `Vérification effectuée à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Le contrôle est toujours en cours ; tes photos sont bien enregistrées.`
          : `Vérification effectuée à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Aucune photo n’est enregistrée : utilise « Ajouter mes photos ».`;
      } else {
        state.waitingMessage = 'L’avancement vient d’être mis à jour.';
      }
      await renderWaitingGate();
    });
    content.querySelector('[data-add-gallery]')?.addEventListener('click', () => showPhotoStage({
      role: galleryRole, minimum: 3,
      title: isCouple ? 'Ajoutez les photos publiques de votre couple.' : 'Ajoute les photos publiques de ton profil.',
      guide: isCouple ? 'Vous devez être visibles tous les deux, au minimum à mi-corps et avec une netteté suffisante.' : 'Tu dois être clairement visible, au minimum à mi-corps et avec une netteté suffisante.'
    }));
    content.querySelector('[data-replace-gallery]')?.addEventListener('click', () => showPhotoStage({
      role: galleryRole, minimum: 3,
      title: isCouple ? 'Remplacez les photos refusées de votre couple.' : 'Remplace les photos refusées de ton profil.',
      guide: isCouple ? 'Vous devez être visibles tous les deux, au minimum à mi-corps et avec une netteté suffisante.' : 'Tu dois être clairement visible, au minimum à mi-corps et avec une netteté suffisante.'
    }));
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

      if (profile.profile_type === 'individual' && galleryCount < 3) {
        showPhotoStage({
          role: 'individual_gallery',
          minimum: 3,
          title: 'Ajoute les premières photos de ton profil.',
          guide: 'Ces photos alimenteront directement ton carrousel public. Tu dois être clairement visible, au minimum à mi-corps.'
        });
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
