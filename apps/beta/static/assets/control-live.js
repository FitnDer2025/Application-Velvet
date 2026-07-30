(() => {
  let data = null;
  let mediaViewer = null;
  const api = (options = {}) => controlApi('/api/control/workspace', options);
  const styles = document.createElement('style');
  styles.textContent = `
    .control-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:14px}
    .control-media-review{min-width:0;overflow:hidden;border:1px solid #ffffff18;border-radius:20px;background:linear-gradient(145deg,#ffffff08,#ffffff025)}
    .control-media-preview{position:relative;display:grid;width:100%;height:230px;padding:0;border:0;background:#09090b;overflow:hidden;color:var(--muted)}
    .control-media-preview img,.control-media-preview video{width:100%;height:100%;object-fit:contain;background:#09090b}
    .control-media-preview:after{content:"Ouvrir";position:absolute;right:10px;bottom:10px;padding:7px 10px;border:1px solid #c6a96a66;border-radius:999px;background:#0d0d0de8;color:var(--gold);font-size:10px;font-weight:700}
    .control-media-preview.unavailable:after{display:none}
    .control-media-copy{display:grid;gap:9px;padding:15px}
    .control-media-copy h3{margin:0;font-size:18px}
    .control-media-copy p{min-height:42px;margin:0;color:var(--muted);font-size:11px;line-height:1.55}
    .control-media-meta{display:flex;flex-wrap:wrap;gap:6px}
    .control-media-copy input{width:100%;border:1px solid var(--line);border-radius:12px;background:#0c0c0f;color:white;padding:10px}
    .control-media-actions{display:flex;justify-content:flex-end;gap:8px}
    .control-media-viewer{position:fixed;z-index:10020;inset:0;display:grid;place-items:center;padding:22px;background:#050507eb;backdrop-filter:blur(18px)}
    .control-media-viewer[hidden]{display:none}
    .control-media-viewer-dialog{position:relative;display:grid;grid-template-rows:minmax(0,1fr) auto;width:min(1100px,96vw);height:min(820px,92vh);overflow:hidden;border:1px solid #c6a96a55;border-radius:24px;background:#101013;box-shadow:0 30px 100px #000}
    .control-media-viewer-stage{display:grid;place-items:center;min-height:0;background:#050507}
    .control-media-viewer-stage img,.control-media-viewer-stage video{max-width:100%;max-height:100%;object-fit:contain}
    .control-media-viewer-caption{padding:14px 58px 14px 16px;color:var(--muted);font-size:12px}
    .control-media-viewer-caption strong{display:block;color:var(--txt);margin-bottom:4px}
    .control-media-viewer-close{position:absolute;z-index:2;right:12px;top:12px;width:40px;height:40px;border:1px solid #ffffff24;border-radius:50%;background:#0d0d0de8;color:white;font-size:24px}
    .control-access-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
    .control-access-card{display:grid;gap:12px;padding:15px;border:1px solid #ffffff16;border-radius:18px;background:#ffffff05}
    .control-access-card header{display:flex;justify-content:space-between;gap:12px}
    .control-access-card header h3{margin:0;font-size:17px}.control-access-card header p{margin:4px 0 0;color:var(--muted);font-size:11px}
    .control-access-card .state{align-self:start}
    .control-inline-form{display:grid;grid-template-columns:minmax(0,1fr) 90px auto;gap:8px;align-items:end}
    .control-inline-form.account{grid-template-columns:minmax(0,1fr) 105px auto}
    .control-inline-form label{display:grid;gap:5px;color:var(--muted);font-size:10px}
    .control-inline-form input,.control-inline-form select{width:100%;min-width:0}
    .control-promo-code{margin:14px 0;padding:16px;border:1px solid #d5b47788;border-radius:18px;background:#d5b47712}
    .control-promo-code code{display:block;margin-top:8px;color:var(--gold);font-size:20px;letter-spacing:.08em;word-break:break-word}
    .control-campaign{display:grid;grid-template-columns:minmax(220px,1fr) minmax(260px,1.4fr) auto;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid #ffffff12}
    .control-campaign:last-child{border-bottom:0}.control-campaign p{margin:0}.control-campaign small{display:block;color:var(--muted)}
    @media(max-width:700px){.control-media-grid,.control-access-grid{grid-template-columns:1fr}.control-media-preview{height:260px}.control-media-viewer{padding:8px}.control-media-viewer-dialog{width:100%;height:94vh}.control-inline-form,.control-inline-form.account,.control-campaign{grid-template-columns:1fr}}
  `;
  document.head.append(styles);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mediaViewer) closeMediaViewer();
  });
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
  const originalShowView = window.showView;
  window.showView = (view, button) => {
    root.hidden = true;
    root.classList.remove('active');
    originalShowView(view, button);
  };
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

  function optionDirectoryVenues() {
    return (data.venueDirectory || [])
      .filter((venue) => venue.claim_status === 'unclaimed' && !venue.claimed_establishment_id)
      .map((venue) =>
        `<option value="${safe(venue.id)}">${safe(venue.name)} · ${safe(venue.city || 'ville à confirmer')} · ${safe(venue.country_code || '')}</option>`
      ).join('');
  }

  function optionCampaignSubjects(campaign) {
    if (campaign.subject_type === 'establishment') {
      return (data.establishments || []).map((venue) =>
        `<option value="${safe(venue.id)}">${safe(venue.name)} · ${safe(venue.city || 'ville non renseignée')}</option>`
      ).join('');
    }
    return [...new Map((data.accounts || [])
      .filter((account) => account.profile_id)
      .map((account) => [account.profile_id, account])).values()]
      .filter((account) => {
        if (campaign.target_audience === 'couple') return account.profile_type === 'couple';
        if (campaign.target_audience === 'solo_man') {
          return account.profile_type === 'individual' && account.gender_identity === 'Homme';
        }
        return true;
      })
      .map((account) => `<option value="${safe(account.profile_id)}">${safe(account.display_name || account.email)} · ${safe(account.profile_type || 'profil')}</option>`)
      .join('');
  }

  function accessLabel(account) {
    if (!account.profile_id) return 'Sans profil membre';
    if (account.access_tier === 'signature') {
      if (account.access_source === 'verified_woman') return 'Signature · femme vérifiée';
      return `Signature · ${account.access_source || 'accès actif'}`;
    }
    return 'Découverte';
  }

  function mediaContext(media) {
    if (!media.album_id) return 'Photo de profil publique';
    return media.albums?.confidentiality === 'public'
      ? `Album public · ${media.albums?.name || 'Sans nom'}`
      : `Album privé · ${media.albums?.name || 'Sans nom'}`;
  }

  function mediaRole(media) {
    if (media.media_type === 'video') return 'Vidéo';
    if (media.media_role === 'couple_gallery') return 'Carrousel couple';
    if (media.media_role === 'individual_portrait') return 'Portrait individuel';
    if (media.media_role === 'individual_gallery') return 'Carrousel individuel';
    return 'Photo d’album';
  }

  function mediaPreview(media, profile) {
    if (!media.previewUrl) {
      return '<span class="control-media-preview unavailable">Aperçu temporaire indisponible</span>';
    }
    const label = `${mediaRole(media)} de ${profile.display_name || 'ce profil'}`;
    if (media.media_type === 'video') {
      return `<button class="control-media-preview" type="button" data-open-media="${safe(media.id)}" aria-label="Ouvrir ${safe(label)}"><video src="${safe(media.previewUrl)}" muted playsinline preload="metadata"></video></button>`;
    }
    return `<button class="control-media-preview" type="button" data-open-media="${safe(media.id)}" aria-label="Ouvrir ${safe(label)}"><img src="${safe(media.previewUrl)}" alt="${safe(label)}"></button>`;
  }

  function closeMediaViewer() {
    mediaViewer?.remove();
    mediaViewer = null;
  }

  function openMediaViewer(mediaId) {
    const media = (data.pendingMedia || []).find((item) => item.id === mediaId);
    if (!media?.previewUrl) {
      toastMsg('Aperçu temporaire indisponible. Actualisez la file de contrôle.');
      return;
    }
    const profile = media.member_profiles || data.profiles.find((item) => item.id === media.profile_id) || {};
    closeMediaViewer();
    mediaViewer = document.createElement('section');
    mediaViewer.className = 'control-media-viewer';
    mediaViewer.setAttribute('role', 'dialog');
    mediaViewer.setAttribute('aria-modal', 'true');
    mediaViewer.setAttribute('aria-label', 'Visionneuse de modération');
    const content = media.media_type === 'video'
      ? `<video controls autoplay playsinline preload="metadata" src="${safe(media.previewUrl)}"></video>`
      : `<img src="${safe(media.previewUrl)}" alt="${safe(mediaRole(media))} de ${safe(profile.display_name || 'Profil membre')}">`;
    mediaViewer.innerHTML = `<div class="control-media-viewer-dialog">
      <button class="control-media-viewer-close" type="button" aria-label="Fermer">×</button>
      <div class="control-media-viewer-stage">${content}</div>
      <div class="control-media-viewer-caption"><strong>${safe(profile.display_name || 'Profil membre')} · ${safe(mediaContext(media))}</strong>Lien signé temporaire réservé à Velvet Contrôle.</div>
    </div>`;
    mediaViewer.querySelector('.control-media-viewer-close')?.addEventListener('click', closeMediaViewer);
    mediaViewer.addEventListener('click', (event) => {
      if (event.target === mediaViewer) closeMediaViewer();
    });
    document.body.append(mediaViewer);
    mediaViewer.querySelector('.control-media-viewer-close')?.focus();
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
    const catalogCount = (data.venueDirectory || []).length;
    const unclaimedCount = (data.venueDirectory || []).filter((venue) => venue.claim_status === 'unclaimed').length;
    const pendingMedia = data.pendingMedia || [];
    root.innerHTML = `<div class="head"><div><div class="ey">Supabase · source de vérité</div><h1>Opérations Velvet</h1><p class="lead">Établissements, soirées, inscriptions et demandes organisateur réellement enregistrés.</p></div><button class="btn secondary" id="controlRefresh">Actualiser</button></div>
      <div class="kpis"><div class="kpi"><small>Comptes actifs</small><b>${data.accounts.filter((item) => item.status === 'active').length}</b></div><div class="kpi"><small>Profils membres</small><b>${data.profiles.length}</b></div><div class="kpi"><small>Lieux recensés</small><b>${catalogCount}</b></div><div class="kpi"><small>Fiches à attribuer</small><b>${unclaimedCount}</b></div><div class="kpi"><small>Pro attribués</small><b>${data.establishments.length}</b></div><div class="kpi"><small>Soirées publiées</small><b>${publishedEvents.length}</b></div><div class="kpi"><small>Inscriptions</small><b>${data.registrations.length}</b></div><div class="kpi"><small>Signalements ouverts</small><b>${openReports.length}</b></div></div>
      <div class="section-head"><div><h2>Préparation BETA</h2><p>Contrôles calculés directement sur la mémoire Velvet. Une anomalie rouge doit être corrigée avant la recette.</p></div><span class="state ${releaseState}">${releaseLabel}</span></div>
      <section class="card">${releaseChecks.length ? releaseChecks.map((item) => `<div class="audit-row"><time><span class="state ${item.status === 'failed' ? 'danger' : item.status === 'warning' ? 'warn' : 'ok'}">${item.status === 'failed' ? 'À corriger' : item.status === 'warning' ? 'Attention' : 'Conforme'}</span></time><p><b>${safe(releaseCheckLabel(item.check_code))}</b><small>${safe(item.detail)}</small></p><strong>${safe(item.affected_count)}</strong></div>`).join('') : '<div class="invite-empty">Aucun contrôle de publication disponible. Appliquez la dernière migration Supabase.</div>'}</section>
      <div class="section-head"><div><h2>Accès membres</h2><p>Basculez une fiche entre Découverte et Signature, ou suspendez son compte. Chaque action est auditée côté serveur.</p></div><span class="state ${data.monetizationAvailable ? 'ok' : 'warn'}">${data.monetizationAvailable ? 'Production prête' : 'Migration 0026 requise'}</span></div>
      <section class="card">${data.monetizationAvailable ? `<div class="control-access-grid">${(data.accounts || []).filter((account) => account.profile_id).map((account) => `<article class="control-access-card">
        <header><div><h3>${safe(account.display_name || account.email)}</h3><p>${safe(account.email)} · ${safe(account.profile_type === 'couple' ? 'Couple' : account.gender_identity || 'Individuel')} · ${safe(account.verification_status || 'non vérifié')}</p></div><span class="state ${account.status === 'active' ? 'ok' : account.status === 'suspended' ? 'warn' : 'danger'}">${safe(account.status)}</span></header>
        <small>${safe(accessLabel(account))}${account.access_until ? ` · jusqu’au ${safe(new Date(account.access_until).toLocaleDateString('fr-FR'))}` : ''}</small>
        <form class="control-inline-form" data-member-access="${safe(account.profile_id)}">
          <label>Accès<select name="mode"><option value="discovery"${account.access_tier === 'discovery' ? ' selected' : ''}>Découverte</option><option value="signature"${account.access_tier === 'signature' ? ' selected' : ''}>Signature</option></select></label>
          <label>Jours<input name="durationDays" type="number" min="1" max="3650" value="90"></label>
          <button class="btn secondary" type="submit">Appliquer</button>
        </form>
        <form class="control-inline-form account" data-account-state="${safe(account.user_id)}">
          <label>Compte<select name="accountAction"><option value="activate">Activer</option><option value="suspend">Suspendre temporairement</option><option value="block">Bloquer</option><option value="delete">Supprimer à J+30</option></select></label>
          <label>Heures<input name="durationHours" type="number" min="1" max="8760" value="24"></label>
          <button class="btn secondary" type="submit">Confirmer</button>
        </form>
      </article>`).join('')}</div>` : '<div class="invite-empty">Appliquez la migration 0026 pour activer les droits commerciaux et les actions comptes.</div>'}</section>
      <div class="section-head"><div><h2>Codes promotionnels et accès fondateurs</h2><p>Un code n’est affiché qu’une seule fois lors de sa création. Un avantage utilisé pendant un abonnement payant est ajouté après la période déjà réglée.</p></div></div>
      ${data.generatedPromotionCode ? `<div class="control-promo-code"><strong>Copiez ce code maintenant</strong><small>Il ne sera plus consultable après actualisation.</small><code>${safe(data.generatedPromotionCode)}</code></div>` : ''}
      <div class="grid g2">
        <section class="card"><div class="ey">Nouvelle campagne</div><h2>Générer un code</h2>
          <form id="controlPromotionForm" class="invite-form">
            <label>Nom interne<input name="name" required minlength="2" maxlength="120" placeholder="Ex. Partenaires lancement"></label>
            <label>Destinataires<select name="audience"><option value="couple">Couples</option><option value="solo_man">Hommes seuls</option><option value="paid_member">Profils normalement payants</option><option value="any_member">Tous les membres</option><option value="pro">Velvet Pro</option></select></label>
            <label>Durée offerte (jours)<input name="durationDays" type="number" min="1" max="3650" value="30" required></label>
            <label>Utilisations maximum<input name="maxRedemptions" type="number" min="1" max="1000000" value="100" required></label>
            <button class="btn" type="submit">Créer le code sécurisé</button>
          </form>
        </section>
        <section class="card"><div class="ey">Catalogue commercial</div><h2>Tarifs prêts au raccordement</h2>
          ${(data.billingPrices || []).map((price) => `<div class="audit-row"><time>${safe(price.plan_code === 'pro_workspace' ? 'PRO' : 'MEMBRE')}</time><p><b>${safe((Number(price.amount_cents) / 100).toLocaleString('fr-FR', { style: 'currency', currency: price.currency }))}</b><small>${safe(price.price_code)} · tous les ${safe(price.interval_count)} ${safe(price.interval_unit === 'year' ? 'an' : 'mois')}</small></p><span class="state ok">Actif</span></div>`).join('') || '<div class="invite-empty">Migration 0026 requise.</div>'}
        </section>
      </div>
      <section class="card">${(data.promotions || []).length ? data.promotions.map((campaign) => `<div class="control-campaign">
        <p><b>${safe(campaign.name)}</b><small>${safe(campaign.duration_days)} jours · ${safe(campaign.redemption_count)}/${safe(campaign.max_redemptions || '∞')} utilisés · ${safe(campaign.target_audience)}</small></p>
        ${campaign.distribution_mode === 'control' ? `<form class="control-inline-form" data-grant-campaign="${safe(campaign.id)}" data-subject-type="${safe(campaign.subject_type)}"><label>Attribuer à<select name="subjectId" required><option value="">Choisir…</option>${optionCampaignSubjects(campaign)}</select></label><span></span><button class="btn secondary" type="submit">Offrir ${safe(campaign.duration_days)} jours</button></form>` : '<small>Code diffusé hors de Control · valeur non consultable</small>'}
        <button class="btn secondary" data-promotion-status="${safe(campaign.id)}" data-active="${campaign.active ? 'true' : 'false'}">${campaign.active ? 'Mettre en pause' : 'Réactiver'}</button>
      </div>`).join('') : '<div class="invite-empty">Aucune campagne disponible.</div>'}</section>
      <div class="section-head"><div><h2>Médias à contrôler</h2><p>L’IA valide ou refuse automatiquement les cas certains. Seuls les résultats ambigus ou interrompus apparaissent ici, avec accès temporaire aux contenus publics et privés.</p></div><span class="state ${pendingMedia.length ? 'warn' : 'ok'}">${pendingMedia.length} en attente</span></div>
      <section class="card">${data.mediaReviewAllowed === false
        ? '<div class="invite-empty">La consultation des médias est réservée aux administrateurs, à la direction et aux modérateurs.</div>'
        : pendingMedia.length ? `<div class="control-media-grid">${pendingMedia.map((media) => {
        const profile = media.member_profiles || data.profiles.find((item) => item.id === media.profile_id) || {};
        const assessment = media.ai_assessment || {};
        const confidence = Number.isFinite(Number(assessment.confidence))
          ? `${Math.round(Number(assessment.confidence) * 100)} % de confiance`
          : 'Analyse interrompue';
        return `<article class="control-media-review" data-media-review="${safe(media.id)}">
          ${mediaPreview(media, profile)}
          <div class="control-media-copy">
            <div class="control-media-meta"><span class="state info">${safe(mediaRole(media))}</span><span class="state ${media.album_id && media.albums?.confidentiality !== 'public' ? 'critical' : 'ok'}">${safe(mediaContext(media))}</span><span class="state warning">${safe(confidence)}</span></div>
            <h3>${safe(profile.display_name || 'Profil membre')}</h3>
            <p>${safe(assessment.summary || 'Analyse automatique indécise ou interrompue. Contrôle humain nécessaire.')}</p>
            <input data-moderation-reason maxlength="500" aria-label="Motif de modération" placeholder="Motif obligatoire en cas de refus">
            <div class="control-media-actions"><button class="btn secondary" data-media-decision="rejected" data-media="${safe(media.id)}">Refuser</button><button class="btn" data-media-decision="approved" data-media="${safe(media.id)}">Valider</button></div>
          </div>
        </article>`;
      }).join('')}</div>` : '<div class="invite-empty">Aucun média ambigu à traiter. Les décisions automatiques sont à jour.</div>'}</section>
      <div class="grid g2">
        <section class="card"><div class="ey">Prospection Velvet Pro</div><h2>Attribuer une fiche recensée</h2><p>La fiche reste en mode référence et les outils Pro demeurent verrouillés tant que l’abonnement n’est pas activé.</p><form id="controlClaimVenueForm" class="invite-form">
          <label>Établissement<select name="venueId" required><option value="">Choisir parmi ${unclaimedCount} fiche${unclaimedCount > 1 ? 's' : ''}</option>${optionDirectoryVenues()}</select></label>
          <label>Compte professionnel<select name="ownerUserId" required><option value="">Choisir un compte</option>${optionAccounts()}</select></label>
          <button class="btn" type="submit">Attribuer sans activer</button>
        </form></section>
        <section class="card"><div class="ey">Lieu absent du référentiel</div><h2>Créer un établissement</h2><form id="controlVenueForm" class="invite-form">
          <label>Nom<input name="name" required minlength="2"></label><label>Identifiant public<input name="slug" required pattern="[a-z0-9-]+"></label>
          <label>Type<select name="kind"><option value="club">Club</option><option value="spa">Spa</option><option value="bar">Bar</option><option value="love_room">Love room</option><option value="other">Autre</option></select></label>
          <label>Propriétaire<select name="ownerUserId" required><option value="">Choisir un compte</option>${optionAccounts()}</select></label><button class="btn" type="submit">Créer et attribuer</button>
        </form></section>
      </div>
      <div class="grid g2">
        <section class="card"><div class="ey">Organisateurs privés</div><h2>${pendingOrganizers.length} demande${pendingOrganizers.length > 1 ? 's' : ''} en attente</h2>
          ${pendingOrganizers.length ? pendingOrganizers.map((item) => `<div class="audit-row"><time>${safe(new Date(item.created_at).toLocaleDateString('fr-FR'))}</time><p><b>${safe(data.profiles.find((profile) => profile.id === item.member_profile_id)?.display_name || 'Profil membre')}</b><small>${safe(item.message || 'Aucun message')}</small></p><span><button class="btn secondary" data-organizer-decision="declined" data-request="${safe(item.id)}">Refuser</button> <button class="btn" data-organizer-decision="approved" data-request="${safe(item.id)}">Valider</button></span></div>`).join('') : '<div class="invite-empty">Aucune demande à traiter.</div>'}
        </section>
        <section class="card"><div class="ey">Qualité du référentiel</div><h2>Fiches à confirmer</h2><p>${(data.venueDirectory || []).filter((venue) => venue.manual_review_required).length} fiches nécessitent encore une validation humaine avant un démarchage ou une certification. Les photos du fichier source ne sont jamais réutilisées sans autorisation.</p></section>
      </div>
      <div class="section-head"><div><h2>Établissements et visibilité</h2><p>Chaque changement est immédiatement appliqué à Velvet Pro et Velvet Membres.</p></div></div>
      <section class="card">${data.establishments.length ? data.establishments.map((venue) => {
        const eventCount = data.events.filter((event) => event.establishment_id === venue.id).length;
        const owner = data.staff.find((staff) => staff.establishment_id === venue.id && staff.staff_role === 'owner');
        return `<div class="audit-row"><time>${safe(venue.kind)}</time><p><b>${safe(venue.name)}</b><small>${eventCount} soirée${eventCount > 1 ? 's' : ''} · propriétaire ${safe(data.accounts.find((account) => account.user_id === owner?.user_id)?.email || 'non attribué')} · ${venue.directory_venue_id ? 'fiche recensée' : 'fiche créée dans Control'}</small></p><span><select aria-label="Abonnement Velvet Pro" data-subscription-status="${safe(venue.id)}"><option value="inactive"${venue.subscription_status === 'inactive' ? ' selected' : ''}>Pro inactif</option><option value="trial"${venue.subscription_status === 'trial' ? ' selected' : ''}>Essai Pro</option><option value="active"${venue.subscription_status === 'active' ? ' selected' : ''}>Pro actif</option><option value="past_due"${venue.subscription_status === 'past_due' ? ' selected' : ''}>Impayé</option><option value="cancelled"${venue.subscription_status === 'cancelled' ? ' selected' : ''}>Résilié</option></select> <select aria-label="Visibilité publique" data-venue-visibility="${safe(venue.id)}"><option value="draft"${venue.visibility === 'draft' ? ' selected' : ''}>Brouillon</option><option value="review"${venue.visibility === 'review' ? ' selected' : ''}>En revue</option><option value="published"${venue.visibility === 'published' ? ' selected' : ''}>Publié</option><option value="suspended"${venue.visibility === 'suspended' ? ' selected' : ''}>Suspendu</option></select></span></div>`;
      }).join('') : '<div class="invite-empty">Aucun établissement dans la base.</div>'}</section>
      <div class="section-head"><div><h2>Signalements membres</h2><p>Les signalements arrivent ici après blocage immédiat du profil par la personne qui signale.</p></div><span class="state ${openReports.length ? 'warn' : 'ok'}">${openReports.length} ouvert${openReports.length > 1 ? 's' : ''}</span></div>
      <section class="card">${openReports.length ? openReports.map((report) => {
        const subject = data.profiles.find((profile) => profile.id === report.subject_id);
        return `<div class="audit-row"><time>${safe(new Date(report.created_at).toLocaleString('fr-FR'))}</time><p><b>${safe(subject?.display_name || `Profil ${report.subject_id}`)}</b><small>${safe(report.category)}${report.description ? ` · ${safe(report.description)}` : ''}</small></p><span class="state warn">${safe(report.status)}</span></div>`;
      }).join('') : '<div class="invite-empty">Aucun signalement à traiter.</div>'}</section>
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
    document.querySelector('#controlClaimVenueForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await mutate({ action: 'claim_directory_venue', ...values }, 'Fiche attribuée. Les outils Pro restent verrouillés jusqu’à activation.');
    });
    document.querySelector('#controlPromotionForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await mutate({
        action: 'create_promotion',
        subjectType: values.audience === 'pro' ? 'establishment' : 'profile',
        ...values
      }, 'Code promotionnel créé. Copiez-le avant d’actualiser.');
    });
    root.querySelectorAll('[data-member-access]').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      await mutate({
        action: 'member_access',
        profileId: form.dataset.memberAccess,
        ...values
      }, 'Accès membre synchronisé.');
    }));
    root.querySelectorAll('[data-account-state]').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      await mutate({
        action: 'account_state',
        userId: form.dataset.accountState,
        ...values
      }, 'État du compte synchronisé.');
    }));
    root.querySelectorAll('[data-grant-campaign]').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      await mutate({
        action: 'grant_campaign',
        campaignId: form.dataset.grantCampaign,
        subjectType: form.dataset.subjectType,
        subjectId: values.subjectId
      }, 'Accès fondateur attribué.');
    }));
    root.querySelectorAll('[data-promotion-status]').forEach((button) => button.addEventListener('click', () =>
      mutate({
        action: 'promotion_status',
        campaignId: button.dataset.promotionStatus,
        active: button.dataset.active !== 'true'
      }, button.dataset.active === 'true' ? 'Campagne mise en pause.' : 'Campagne réactivée.')
    ));
    root.querySelectorAll('[data-organizer-decision]').forEach((button) => button.addEventListener('click', () =>
      mutate({ action: 'decide_organizer', requestId: button.dataset.request, decision: button.dataset.organizerDecision }, 'Décision Organisateur enregistrée.')
    ));
    root.querySelectorAll('[data-venue-visibility]').forEach((select) => select.addEventListener('change', () =>
      mutate({ action: 'venue_visibility', venueId: select.dataset.venueVisibility, visibility: select.value }, 'Visibilité synchronisée.')
    ));
    root.querySelectorAll('[data-subscription-status]').forEach((select) => select.addEventListener('change', () =>
      mutate({ action: 'subscription_status', venueId: select.dataset.subscriptionStatus, status: select.value }, 'Statut Velvet Pro synchronisé.')
    ));
    root.querySelectorAll('[data-open-media]').forEach((button) => button.addEventListener('click', () => {
      openMediaViewer(button.dataset.openMedia);
    }));
    root.querySelectorAll('[data-media-decision]').forEach((button) => button.addEventListener('click', () => {
      const row = button.closest('[data-media-review]');
      const reason = row?.querySelector('[data-moderation-reason]')?.value.trim() || '';
      if (button.dataset.mediaDecision === 'rejected' && !reason) {
        toastMsg('Indiquez le motif du refus avant de continuer.');
        return;
      }
      mutate({
        action: 'decide_media',
        mediaId: button.dataset.media,
        decision: button.dataset.mediaDecision,
        reason
      }, button.dataset.mediaDecision === 'approved' ? 'Média validé.' : 'Média refusé. Le membre pourra le remplacer.');
    }));
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
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    root.hidden = false;
    root.classList.add('active');
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
