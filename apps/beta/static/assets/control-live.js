(() => {
  let data = null;
  const api = (options = {}) => controlApi('/api/control/workspace', options);
  const root = document.createElement('section');
  root.id = 'operationsView';
  root.className = 'view';
  document.querySelector('main')?.append(root);
  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.dataset.view = 'operations';
  tab.textContent = 'Opérations réelles';
  tab.addEventListener('click', () => showOperations(tab));
  document.querySelector('.tabs')?.prepend(tab);
  document.querySelectorAll('.tab:not([data-view="invitations"]):not([data-view="operations"])').forEach((item) => {
    item.hidden = true;
    item.setAttribute('aria-hidden', 'true');
  });
  document.querySelector('.release')?.replaceChildren(document.createTextNode('BETA · Données réelles'));

  function optionAccounts() {
    return (data.accounts || []).filter((account) => account.status === 'active').map((account) =>
      `<option value="${safe(account.user_id)}">${safe(account.email)} · ${safe((account.roles || []).join(', ') || 'sans rôle')}</option>`
    ).join('');
  }

  function render() {
    const pendingOrganizers = (data.organizers || []).filter((item) => item.status === 'pending');
    const openReports = (data.reports || []).filter((item) => ['open', 'assigned'].includes(item.status));
    const publishedEvents = (data.events || []).filter((item) => item.visibility === 'published');
    const releaseChecks = data.releaseChecks || [];
    const failedChecks = releaseChecks.filter((item) => item.status === 'failed');
    const warningChecks = releaseChecks.filter((item) => item.status === 'warning');
    const releaseLabel = failedChecks.length ? 'Bloquée' : warningChecks.length ? 'À surveiller' : 'Prête';
    const releaseState = failedChecks.length ? 'danger' : warningChecks.length ? 'warn' : 'ok';
    root.innerHTML = `<div class="head"><div><div class="ey">Supabase · source de vérité</div><h1>Opérations Velvet</h1><p class="lead">Établissements, soirées, inscriptions et demandes organisateur réellement enregistrés.</p></div><button class="btn secondary" id="controlRefresh">Actualiser</button></div>
      <div class="kpis"><div class="kpi"><small>Comptes actifs</small><b>${data.accounts.filter((item) => item.status === 'active').length}</b></div><div class="kpi"><small>Profils membres</small><b>${data.profiles.length}</b></div><div class="kpi"><small>Établissements</small><b>${data.establishments.length}</b></div><div class="kpi"><small>Soirées publiées</small><b>${publishedEvents.length}</b></div><div class="kpi"><small>Inscriptions</small><b>${data.registrations.length}</b></div><div class="kpi"><small>Signalements ouverts</small><b>${openReports.length}</b></div></div>
      <div class="section-head"><div><h2>Préparation BETA</h2><p>Contrôles calculés directement sur la mémoire Velvet. Une anomalie rouge doit être corrigée avant la recette.</p></div><span class="state ${releaseState}">${releaseLabel}</span></div>
      <section class="card">${releaseChecks.length ? releaseChecks.map((item) => `<div class="audit-row"><time><span class="state ${item.status === 'failed' ? 'danger' : item.status === 'warning' ? 'warn' : 'ok'}">${item.status === 'failed' ? 'À corriger' : item.status === 'warning' ? 'Attention' : 'Conforme'}</span></time><p><b>${safe(releaseCheckLabel(item.check_code))}</b><small>${safe(item.detail)}</small></p><strong>${safe(item.affected_count)}</strong></div>`).join('') : '<div class="invite-empty">Aucun contrôle de publication disponible. Appliquez la dernière migration Supabase.</div>'}</section>
      <div class="grid g2">
        <section class="card"><div class="ey">Velvet Pro</div><h2>Créer un établissement</h2><form id="controlVenueForm" class="invite-form">
          <label>Nom<input name="name" required minlength="2"></label><label>Identifiant public<input name="slug" required pattern="[a-z0-9-]+"></label>
          <label>Type<select name="kind"><option value="club">Club</option><option value="spa">Spa</option><option value="bar">Bar</option><option value="love_room">Love room</option><option value="other">Autre</option></select></label>
          <label>Propriétaire<select name="ownerUserId" required>${optionAccounts()}</select></label><button class="btn" type="submit">Créer et attribuer</button>
        </form></section>
        <section class="card"><div class="ey">Organisateurs privés</div><h2>${pendingOrganizers.length} demande${pendingOrganizers.length > 1 ? 's' : ''} en attente</h2>
          ${pendingOrganizers.length ? pendingOrganizers.map((item) => `<div class="audit-row"><time>${safe(new Date(item.created_at).toLocaleDateString('fr-FR'))}</time><p><b>${safe(data.profiles.find((profile) => profile.id === item.member_profile_id)?.display_name || 'Profil membre')}</b><small>${safe(item.message || 'Aucun message')}</small></p><span><button class="btn secondary" data-organizer-decision="declined" data-request="${safe(item.id)}">Refuser</button> <button class="btn" data-organizer-decision="approved" data-request="${safe(item.id)}">Valider</button></span></div>`).join('') : '<div class="invite-empty">Aucune demande à traiter.</div>'}
        </section>
      </div>
      <div class="section-head"><div><h2>Établissements et visibilité</h2><p>Chaque changement est immédiatement appliqué à Velvet Pro et Velvet Membres.</p></div></div>
      <section class="card">${data.establishments.length ? data.establishments.map((venue) => {
        const eventCount = data.events.filter((event) => event.establishment_id === venue.id).length;
        const owner = data.staff.find((staff) => staff.establishment_id === venue.id && staff.staff_role === 'owner');
        return `<div class="audit-row"><time>${safe(venue.kind)}</time><p><b>${safe(venue.name)}</b><small>${eventCount} soirée${eventCount > 1 ? 's' : ''} · propriétaire ${safe(data.accounts.find((account) => account.user_id === owner?.user_id)?.email || 'non attribué')}</small></p><select data-venue-visibility="${safe(venue.id)}"><option value="draft"${venue.visibility === 'draft' ? ' selected' : ''}>Brouillon</option><option value="review"${venue.visibility === 'review' ? ' selected' : ''}>En revue</option><option value="published"${venue.visibility === 'published' ? ' selected' : ''}>Publié</option><option value="suspended"${venue.visibility === 'suspended' ? ' selected' : ''}>Suspendu</option></select></div>`;
      }).join('') : '<div class="invite-empty">Aucun établissement dans la base.</div>'}</section>
      <div class="section-head"><div><h2>Journal serveur</h2><p>Dernières actions enregistrées dans l’audit immuable.</p></div></div>
      <section class="card">${data.audits.slice(0, 12).map((item) => `<div class="audit-row"><time>${safe(new Date(item.occurred_at).toLocaleString('fr-FR'))}</time><p><b>${safe(item.action)}</b><small>${safe(item.entity_type)} · ${safe(item.entity_id || 'système')}</small></p><span class="state info">#${safe(item.sequence_number)}</span></div>`).join('') || '<div class="invite-empty">Aucune action auditée.</div>'}</section>`;
    bind();
  }

  function bind() {
    document.querySelector('#controlRefresh')?.addEventListener('click', load);
    document.querySelector('#controlVenueForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await mutate({ action: 'create_establishment', ...values }, 'Établissement créé et attribué.');
    });
    root.querySelectorAll('[data-organizer-decision]').forEach((button) => button.addEventListener('click', () =>
      mutate({ action: 'decide_organizer', requestId: button.dataset.request, decision: button.dataset.organizerDecision }, 'Décision Organisateur enregistrée.')
    ));
    root.querySelectorAll('[data-venue-visibility]').forEach((select) => select.addEventListener('change', () =>
      mutate({ action: 'venue_visibility', venueId: select.dataset.venueVisibility, visibility: select.value }, 'Visibilité synchronisée.')
    ));
  }

  async function mutate(payload, message) {
    try {
      data = await api({ method: 'POST', body: JSON.stringify(payload) });
      render(); toastMsg(message);
    } catch (error) { toastMsg(`Action refusée : ${error.message}`); }
  }

  async function load() {
    root.innerHTML = '<div class="invite-empty">Lecture sécurisée de Supabase…</div>';
    try { data = await api(); render(); }
    catch (error) { root.innerHTML = `<div class="invite-empty">Velvet Control indisponible : ${safe(error.message)}</div>`; }
  }

  window.showOperations = (button = tab) => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view === root));
    const suite = document.querySelector('#suiteView');
    if (suite) suite.style.display = 'none';
    load();
  };
  const releaseCheckLabel = (code) => ({
    active_accounts_without_role: 'Comptes actifs sans rôle',
    profiles_pending_admission: 'Profils en attente d’admission',
    incomplete_couple_profiles: 'Couples encore incomplets',
    published_venues_incomplete: 'Établissements publiés incomplets',
    events_over_capacity: 'Soirées au-delà de leur capacité',
    overdue_data_requests: 'Demandes RGPD hors délai',
    open_reports: 'Signalements ouverts',
    pending_organizers: 'Demandes Organisateur en attente'
  }[code] || code);
  showOperations(tab);
})();
