(() => {
  const root = document.querySelector('#controlApp');
  if (!root) return;

  let data = null;
  let currentView = 'pilot';
  let managementSection = 'members';
  let historyFilter = 'all';
  let selectedTemplateKey = null;
  let mediaViewer = null;
  let inviteRows = [];
  let inviteLoading = false;
  let latestInvitation = null;

  const api = (options = {}) => controlApi('/api/control/workspace', options);
  const priorityLabels = { critical: 'Critique', high: 'Prioritaire', normal: 'À traiter', low: 'Suivi' };
  const decisionLabels = { approved: 'Validé', rejected: 'Refusé', review: 'Revue humaine', pending: 'En attente' };
  const viewLabels = {
    pilot: 'Pilotage',
    actions: 'À traiter',
    intelligence: 'IA & modération',
    communications: 'Communications',
    management: 'Gestion'
  };

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mediaViewer) closeMediaViewer();
  });

  function date(value, withTime = true) {
    if (!value) return 'Date non disponible';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Date non disponible';
    return parsed.toLocaleString('fr-FR', withTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'medium' });
  }

  function relativeDate(value) {
    if (!value) return '';
    const delta = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(delta)) return '';
    const minutes = Math.max(0, Math.floor(delta / 60000));
    if (minutes < 1) return 'À l’instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days} j`;
  }

  function state(label, tone = 'neutral') {
    return `<span class="control-state ${tone}">${safe(label)}</span>`;
  }

  function decisionState(decision) {
    const tone = decision === 'approved' ? 'ok' : decision === 'rejected' ? 'danger' : 'warning';
    return state(decisionLabels[decision] || decision, tone);
  }

  function releaseCheckLabel(code) {
    return ({
      active_accounts_without_role: 'Comptes actifs sans rôle',
      profiles_pending_admission: 'Profils en attente d’admission',
      incomplete_couple_profiles: 'Couples encore incomplets',
      published_venues_incomplete: 'Établissements publiés incomplets',
      events_over_capacity: 'Soirées au-delà de leur capacité',
      overdue_data_requests: 'Demandes RGPD hors délai',
      open_reports: 'Signalements ouverts',
      pending_organizers: 'Demandes Organisateur en attente'
    })[code] || code;
  }

  function pageHead(eyebrow, title, lead, extra = '') {
    return `<header class="control-head"><div class="control-head-copy"><p class="control-eyebrow">${safe(eyebrow)}</p><h1>${safe(title)}</h1><p class="control-lead">${safe(lead)}</p></div><div class="control-head-actions">${extra}<button class="control-btn ghost" type="button" data-control-refresh>Actualiser</button></div></header>`;
  }

  function emptyState(title, copy) {
    return `<div class="control-empty"><div><strong>${safe(title)}</strong><span>${safe(copy)}</span></div></div>`;
  }

  function actionRow(action, controls = '') {
    return `<article class="control-action" data-action-type="${safe(action.type)}">
      <i class="control-priority ${safe(action.priority)}" aria-hidden="true"></i>
      <div><h3>${safe(action.title)}</h3><p>${safe(action.detail)}</p>${action.createdAt ? `<time>${safe(relativeDate(action.createdAt))}</time>` : ''}</div>
      <div class="control-action-controls">${controls || state(priorityLabels[action.priority] || 'Suivi', action.priority === 'critical' ? 'danger' : action.priority === 'high' ? 'warning' : 'info')}</div>
    </article>`;
  }

  function historyRow(item) {
    const confidence = item.confidence > 0 ? `${Math.round(item.confidence * 100)} %` : '—';
    return `<article class="control-history-row">
      <div>${decisionState(item.decision)}</div>
      <div><h3>${safe(item.subject)}</h3><p>${safe(item.summary)}</p><div class="control-history-meta">${state(item.agent, 'info')}${item.automatic ? state('Décision automatique', 'ok') : state('Passage humain', 'warning')}${item.technicalError ? state('Incident technique', 'danger') : ''}</div><time>${safe(date(item.occurredAt))}</time></div>
      <strong class="control-confidence" title="Confiance déclarée par le modèle">${safe(confidence)}</strong>
    </article>`;
  }

  function systemIcon(key) {
    const paths = {
      media_ai: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/><path d="m9.8 12 1.4 1.5 3.1-3.2"/>',
      video_review: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/>',
      event_ai: '<rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M8 3v5M16 3v5M4 10h16"/>',
      email: '<path d="M3 6h18v12H3Z"/><path d="m3 7 9 6 9-6"/>',
      identity: '<path d="M12 3 20 6.5v5.2c0 4.7-2.9 7.5-8 9.1-5.1-1.6-8-4.4-8-9.1V6.5Z"/><path d="m8.7 12 2.1 2.1 4.6-4.8"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] || paths.media_ai}</svg>`;
  }

  function systemRow(system) {
    const tone = system.status === 'active' ? 'ok'
      : system.status === 'human' || system.status === 'fallback' ? 'warning'
        : system.status === 'locked' ? 'neutral' : 'danger';
    const label = ({ active: 'Actif', human: 'Humain', fallback: 'Mode réduit', locked: 'Verrouillé', unavailable: 'Non configuré' })[system.status] || system.status;
    return `<article class="control-system"><span class="control-system-icon">${systemIcon(system.key)}</span><div><h3>${safe(system.label)}</h3><p>${safe(system.detail)}</p></div>${state(label, tone)}</article>`;
  }

  function pilotView() {
    const actions = data.humanActions || [];
    const urgent = actions.filter((item) => ['critical', 'high'].includes(item.priority)).length;
    const summary = data.aiSummary || {};
    const topActions = actions.slice(0, 5);
    const recentHistory = (data.aiHistory || []).slice(0, 6);
    const releaseFailures = (data.releaseChecks || []).filter((item) => item.status === 'failed').length;
    const briefingTitle = actions.length
      ? `${actions.length} action${actions.length > 1 ? 's' : ''} attendent une décision.`
      : 'Rien d’urgent ne demande ton intervention.';
    const briefingCopy = actions.length
      ? `${urgent} priorité${urgent > 1 ? 's' : ''} à examiner. L’IA continue de traiter les cas certains et te transmet uniquement les exceptions.`
      : 'Les automatismes continuent de surveiller les médias et les événements. Tu peux consulter leurs dernières décisions ci-dessous.';
    return `<section class="control-page" data-page="pilot">
      ${pageHead('Briefing en temps réel', 'Pilotage Velvet', 'Voici ce que Velvet a fait et ce qui mérite ton attention maintenant.')}
      <div class="control-briefing">
        <article class="control-hero"><p class="control-eyebrow">Décision du moment</p><h2>${safe(briefingTitle)}</h2><p>${safe(briefingCopy)}</p><div class="control-hero-actions">${actions.length ? '<button class="control-btn" type="button" data-nav-view="actions">Traiter les priorités</button>' : ''}<button class="control-btn secondary" type="button" data-nav-view="intelligence">Voir les décisions IA</button></div></article>
        <aside class="control-now"><span class="control-now-number">${safe(actions.length)}</span><h3>actions humaines</h3><p>${urgent ? `${urgent} sont prioritaires.` : 'Aucune urgence détectée.'}</p><div>${releaseFailures ? state(`${releaseFailures} blocage${releaseFailures > 1 ? 's' : ''} BETA`, 'danger') : state('Aucun blocage technique nouveau', 'ok')}</div></aside>
      </div>
      <div class="control-metrics">
        <article class="control-metric highlight"><small>Décisions IA · 24 h</small><strong>${safe(summary.last24Hours || 0)}</strong><span>${safe(summary.autonomyRate || 0)} % traitées sans intervention</span></article>
        <article class="control-metric"><small>Revues humaines · 24 h</small><strong>${safe(summary.humanReviewLast24Hours || 0)}</strong><span>Ambiguïtés, vidéos et incidents</span></article>
        <article class="control-metric"><small>Comptes actifs</small><strong>${safe((data.accounts || []).filter((item) => item.status === 'active').length)}</strong><span>${safe((data.profiles || []).length)} profils membres</span></article>
        <article class="control-metric"><small>Activité Pro</small><strong>${safe((data.events || []).filter((item) => item.visibility === 'published').length)}</strong><span>soirées publiées · ${safe((data.registrations || []).length)} inscriptions</span></article>
      </div>
      <div class="control-grid two">
        <section class="control-card"><div class="control-section-title"><div><h2>À faire maintenant</h2><p>Classé par risque et délai.</p></div>${actions.length ? state(`${actions.length} ouvertes`, urgent ? 'warning' : 'info') : state('À jour', 'ok')}</div><div class="control-action-list">${topActions.length ? topActions.map((action) => actionRow(action, `<button class="control-btn ghost" type="button" data-nav-view="${safe(action.targetView)}">Ouvrir</button>`)).join('') : emptyState('Tout est à jour', 'Aucune décision humaine n’est actuellement requise.')}</div></section>
        <aside class="control-card"><div class="control-section-title"><div><h2>Automatismes réels</h2><p>Aucun service simulé.</p></div></div><div class="control-system-list">${(data.systems || []).map(systemRow).join('')}</div></aside>
      </div>
      <section class="control-section"><div class="control-section-title"><div><h2>Dernières décisions IA</h2><p>Pourquoi l’IA a validé, refusé ou demandé ton avis.</p></div><button class="control-btn secondary" type="button" data-nav-view="intelligence">Historique complet</button></div><div class="control-card control-history-list">${recentHistory.length ? recentHistory.map(historyRow).join('') : emptyState('Aucune décision récente', 'L’historique commencera au prochain traitement IA.')}</div></section>
    </section>`;
  }

  function reportControls(report) {
    if (!data.permissions?.canManageReports) return state('Lecture seule', 'neutral');
    return `${report.status === 'open' || report.status === 'appealed' ? `<button class="control-btn ghost" type="button" data-report-status="assigned" data-report="${safe(report.id)}">Prendre en charge</button>` : ''}<button class="control-btn secondary" type="button" data-report-status="resolved" data-report="${safe(report.id)}">Clôturer</button><button class="control-btn ghost" type="button" data-report-status="dismissed" data-report="${safe(report.id)}">Classer sans suite</button>`;
  }

  function actionsView() {
    const reports = (data.reports || []).filter((item) => ['open', 'assigned', 'appealed'].includes(item.status));
    const organizers = (data.organizers || []).filter((item) => item.status === 'pending');
    const checks = (data.releaseChecks || []).filter((item) => ['failed', 'warning'].includes(item.status));
    const verificationActions = (data.humanActions || []).filter((item) => ['verification', 'data_request'].includes(item.type));
    return `<section class="control-page" data-page="actions">
      ${pageHead('File humaine unifiée', 'À traiter', 'Une seule liste de travail pour les décisions qui ne doivent pas être prises automatiquement.')}
      <div class="control-metrics">
        <article class="control-metric"><small>Signalements</small><strong>${safe(reports.length)}</strong><span>ouverts, affectés ou en recours</span></article>
        <article class="control-metric"><small>Médias</small><strong>${safe((data.pendingMedia || []).length)}</strong><span>à contrôler dans IA & modération</span></article>
        <article class="control-metric"><small>Organisateurs</small><strong>${safe(organizers.length)}</strong><span>demandes en attente</span></article>
        <article class="control-metric"><small>Conformité</small><strong>${safe(verificationActions.length)}</strong><span>vérifications et demandes RGPD</span></article>
      </div>
      <div class="control-grid equal">
        <section class="control-card"><div class="control-section-title"><div><h2>Signalements</h2><p>Traiter, clôturer ou classer avec audit serveur.</p></div>${reports.length ? state(`${reports.length} ouverts`, 'warning') : state('À jour', 'ok')}</div><div class="control-action-list">${reports.length ? reports.map((report) => actionRow({ type: 'report', priority: report.status === 'appealed' ? 'critical' : 'high', title: `${report.subject_type} · ${report.category}`, detail: report.description || 'Aucune précision complémentaire.', createdAt: report.created_at }, reportControls(report))).join('') : emptyState('Aucun signalement ouvert', 'La file de modération ne contient aucun dossier.')}</div></section>
        <section class="control-card"><div class="control-section-title"><div><h2>Demandes Organisateur</h2><p>Les validations ouvrent les droits correspondants.</p></div>${organizers.length ? state(`${organizers.length} en attente`, 'warning') : state('À jour', 'ok')}</div><div class="control-action-list">${organizers.length ? organizers.map((item) => actionRow({ type: 'organizer', priority: 'normal', title: 'Demande Organisateur privé', detail: item.message || 'Aucun message joint.', createdAt: item.created_at }, `<button class="control-btn ghost" type="button" data-organizer-decision="declined" data-request="${safe(item.id)}">Refuser</button><button class="control-btn" type="button" data-organizer-decision="approved" data-request="${safe(item.id)}">Valider</button>`)).join('') : emptyState('Aucune demande', 'Les demandes Organisateur apparaîtront ici.')}</div></section>
      </div>
      <div class="control-grid equal control-section">
        <section class="control-card"><div class="control-section-title"><div><h2>Vérification & RGPD</h2><p>Suivi des exceptions et des échéances.</p></div></div><div class="control-action-list">${verificationActions.length ? verificationActions.map((item) => actionRow(item)).join('') : emptyState('Aucun suivi en retard', 'Les demandes de conformité sont à jour.')}</div></section>
        <section class="control-card"><div class="control-section-title"><div><h2>Contrôles BETA</h2><p>Calculés depuis la source de vérité.</p></div></div><div class="control-action-list">${checks.length ? checks.map((check) => actionRow({ type: 'release', priority: check.status === 'failed' ? 'critical' : 'high', title: releaseCheckLabel(check.check_code), detail: check.detail, createdAt: null }, `<strong>${safe(check.affected_count)}</strong>`)).join('') : emptyState('Contrôles conformes', 'Aucun écart de recette n’est signalé.')}</div></section>
      </div>
      ${(data.pendingMedia || []).length ? `<section class="control-section"><div class="control-card"><div class="control-section-title"><div><h2>${safe(data.pendingMedia.length)} média${data.pendingMedia.length > 1 ? 's' : ''} attendent ton avis</h2><p>Les contenus certains ont déjà été traités par l’IA.</p></div><button class="control-btn" type="button" data-nav-view="intelligence">Ouvrir la file média</button></div></div></section>` : ''}
    </section>`;
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
    if (!media.previewUrl) return '<span class="control-media-preview unavailable">Aperçu temporaire indisponible</span>';
    const label = `${mediaRole(media)} de ${profile.display_name || 'ce profil'}`;
    if (media.media_type === 'video') return `<button class="control-media-preview" type="button" data-open-media="${safe(media.id)}" aria-label="Ouvrir ${safe(label)}"><video src="${safe(media.previewUrl)}" muted playsinline preload="metadata"></video></button>`;
    return `<button class="control-media-preview" type="button" data-open-media="${safe(media.id)}" aria-label="Ouvrir ${safe(label)}"><img src="${safe(media.previewUrl)}" alt="${safe(label)}"></button>`;
  }

  function mediaReviewCard(media) {
    const profile = media.member_profiles || data.profiles.find((item) => item.id === media.profile_id) || {};
    const confidence = media.ai_assessment?.confidence == null ? 'Confiance inconnue' : `Confiance ${Math.round(Number(media.ai_assessment.confidence) * 100)} %`;
    return `<article class="control-media-review" data-media-review="${safe(media.id)}">${mediaPreview(media, profile)}<div class="control-media-copy"><div class="control-media-meta">${state(mediaRole(media), 'info')}${state(mediaContext(media), media.album_id && media.albums?.confidentiality !== 'public' ? 'danger' : 'ok')}${state(confidence, 'warning')}</div><h3>${safe(profile.display_name || 'Profil membre')}</h3><p>${safe(media.ai_assessment?.summary || media.rejection_reason || 'L’analyse automatique demande une vérification humaine.')}</p><label class="control-form">Motif si refus<input data-moderation-reason maxlength="500" placeholder="Explication transmise au membre"></label><div class="control-media-actions"><button class="control-btn ghost" type="button" data-media-decision="rejected" data-media="${safe(media.id)}">Refuser</button><button class="control-btn" type="button" data-media-decision="approved" data-media="${safe(media.id)}">Valider</button></div></div></article>`;
  }

  function policyCard() {
    const policy = data.mediaPolicy || {};
    if (policy.migration_pending || !data.configurationAvailable) return `<section class="control-card"><p class="control-eyebrow">Configuration</p><h2>Réglages prêts à activer</h2><p class="control-card-copy">La modération continue avec les seuils actuels de 86 %. La migration 0039 doit être appliquée pour rendre les réglages persistants et historisés.</p>${state('Migration 0039 requise', 'warning')}</section>`;
    const disabled = data.permissions?.canConfigure ? '' : ' disabled';
    return `<section class="control-card"><div class="control-section-title"><div><h2>Niveau d’autonomie</h2><p>Plus le seuil est haut, plus Velvet te transmet de cas.</p></div>${policy.automation_mode === 'observation' ? state('Observation', 'warning') : state('Décisions actives', 'ok')}</div><form class="control-form" id="mediaPolicyForm"><label>Mode<select name="automationMode"${disabled}><option value="active"${policy.automation_mode === 'active' ? ' selected' : ''}>Actif · décider les cas certains</option><option value="observation"${policy.automation_mode === 'observation' ? ' selected' : ''}>Observation · tout transmettre à l’humain</option></select></label><label>Photos publiques<div class="control-range-row"><input name="publicAutoConfidence" type="range" min="80" max="98" step="1" value="${safe(Math.round(Number(policy.public_auto_confidence) * 100))}"${disabled}><output class="control-range-value" data-range-output="publicAutoConfidence">${safe(Math.round(Number(policy.public_auto_confidence) * 100))} %</output></div></label><label>Albums privés<div class="control-range-row"><input name="privateAutoConfidence" type="range" min="80" max="98" step="1" value="${safe(Math.round(Number(policy.private_auto_confidence) * 100))}"${disabled}><output class="control-range-value" data-range-output="privateAutoConfidence">${safe(Math.round(Number(policy.private_auto_confidence) * 100))} %</output></div></label><p class="control-policy-note">Les vidéos restent en revue humaine. Les signaux de mineur possible, contrainte, violence ou illégalité ne peuvent jamais être désactivés.</p><button class="control-btn" type="submit"${disabled}>Enregistrer la politique</button>${disabled ? '<small class="control-card-copy">Réglage réservé à l’administration et à la direction.</small>' : ''}</form></section>`;
  }

  function intelligenceView() {
    const summary = data.aiSummary || {};
    const filters = ['all', 'approved', 'rejected', 'review'];
    const labels = { all: 'Toutes', approved: 'Validées', rejected: 'Refusées', review: 'Revue humaine' };
    const history = (data.aiHistory || []).filter((item) => historyFilter === 'all' || item.decision === historyFilter);
    return `<section class="control-page" data-page="intelligence">
      ${pageHead('Transparence et réglages', 'IA & modération', 'Chaque décision est explicable. Tu règles le niveau d’autonomie et gardes la main sur les exceptions.')}
      <div class="control-metrics"><article class="control-metric highlight"><small>Traités automatiquement · 24 h</small><strong>${safe(summary.automaticLast24Hours || 0)}</strong><span>${safe(summary.autonomyRate || 0)} % d’autonomie</span></article><article class="control-metric"><small>Validés · 24 h</small><strong>${safe(summary.approvedLast24Hours || 0)}</strong><span>photos et annonces conformes</span></article><article class="control-metric"><small>Refusés · 24 h</small><strong>${safe(summary.rejectedLast24Hours || 0)}</strong><span>décisions automatiques ou humaines</span></article><article class="control-metric"><small>Incidents IA · 24 h</small><strong>${safe(summary.technicalErrorsLast24Hours || 0)}</strong><span>routés vers l’humain</span></article></div>
      <div class="control-grid two"><section class="control-card"><div class="control-section-title"><div><h2>Historique des décisions</h2><p>Résultat, confiance et raison déclarée.</p></div></div><div class="control-filterbar">${filters.map((filter) => `<button class="control-tab-button${historyFilter === filter ? ' active' : ''}" type="button" data-history-filter="${filter}">${labels[filter]}</button>`).join('')}</div><div class="control-history-list">${history.length ? history.slice(0, 100).map(historyRow).join('') : emptyState('Aucune décision dans ce filtre', 'Change de filtre ou attends le prochain traitement.')}</div></section>${policyCard()}</div>
      <section class="control-section"><div class="control-section-title"><div><h2>File de contrôle média</h2><p>L’IA a déjà traité les cas certains. Les URL restent privées et expirent après cinq minutes.</p></div>${data.pendingMedia.length ? state(`${data.pendingMedia.length} en attente`, 'warning') : state('À jour', 'ok')}</div><div class="control-card">${data.mediaReviewAllowed === false ? emptyState('Accès restreint', 'La consultation des médias est réservée à la modération autorisée.') : data.pendingMedia.length ? `<div class="control-media-grid">${data.pendingMedia.map(mediaReviewCard).join('')}</div>` : emptyState('Aucun média à contrôler', 'La file humaine est vide.')}</div></section>
    </section>`;
  }

  function sampleTemplate(template) {
    const variables = { profile_name: 'Céline & Cyril', registration_url: '#', confirmation_url: '#' };
    const replace = (value) => String(value || '').replace(/\{\{([a-z_]+)\}\}/g, (match, key) => variables[key] || match);
    return { ...template, subject: replace(template.subject), preheader: replace(template.preheader), heading: replace(template.heading), body_text: replace(template.body_text), footer_text: replace(template.footer_text) };
  }

  function emailPreview(template) {
    const sample = sampleTemplate(template);
    return `<aside class="control-email-preview" aria-label="Aperçu de l’e-mail"><div class="control-email-preview-top">Aperçu Velvet · ${safe(sample.subject)}</div><div class="control-email-preview-body"><img class="control-email-logo" src="/assets/velvet-icon-192.png" width="50" height="50" alt=""><h3>${safe(sample.heading)}</h3><p>${safe(sample.body_text)}</p>${sample.cta_label ? `<span class="control-btn">${safe(sample.cta_label)}</span>` : ''}<div class="control-email-footer">${safe(sample.footer_text)}</div></div></aside>`;
  }

  function emailEditor(template) {
    const disabled = data.permissions?.canConfigure ? '' : ' disabled';
    return `<section class="control-card"><div class="control-section-title"><div><h2>${safe(template.label)}</h2><p>${template.category === 'marketing' ? 'Marketing · consentement et désinscription obligatoires' : 'Transactionnel · déclenché par une action utilisateur'}</p></div>${state(template.status === 'active' ? 'Actif' : 'Brouillon', template.status === 'active' ? 'ok' : 'neutral')}</div><form class="control-form" id="emailTemplateForm" data-template="${safe(template.template_key)}"><div class="control-form-grid"><label>État<select name="status"${disabled}><option value="draft"${template.status === 'draft' ? ' selected' : ''}>Brouillon</option><option value="active"${template.status === 'active' ? ' selected' : ''}>Actif</option></select></label><label>Sujet<input name="subject" maxlength="180" value="${safe(template.subject)}" required${disabled}></label><label class="wide">Pré-en-tête<input name="preheader" maxlength="240" value="${safe(template.preheader)}"${disabled}></label><label class="wide">Titre<input name="heading" maxlength="180" value="${safe(template.heading)}" required${disabled}></label><label class="wide">Corps<textarea name="bodyText" maxlength="4000" required${disabled}>${safe(template.body_text)}</textarea></label><label>Texte du bouton<input name="ctaLabel" maxlength="80" value="${safe(template.cta_label)}"${disabled}></label><label>Pied de message<input name="footerText" maxlength="500" value="${safe(template.footer_text)}"${disabled}></label></div><p class="control-policy-note">Variables disponibles selon le modèle : <code>{{profile_name}}</code>, <code>{{registration_url}}</code>, <code>{{confirmation_url}}</code>. Le visuel, le logo et les couleurs Velvet restent protégés.</p><button class="control-btn" type="submit"${disabled}>Enregistrer le modèle</button></form></section>`;
  }

  function communicationsView() {
    const templates = data.emailTemplates || [];
    if (!selectedTemplateKey && templates[0]) selectedTemplateKey = templates[0].template_key;
    const selected = templates.find((item) => item.template_key === selectedTemplateKey) || templates[0];
    return `<section class="control-page" data-page="communications">
      ${pageHead('Identité éditoriale', 'Communications', 'Configure les messages envoyés par Velvet sans pouvoir casser le visuel, la confidentialité ou les règles de consentement.')}
      ${!data.configurationAvailable || !templates.length ? `<div class="control-grid equal"><section class="control-card"><p class="control-eyebrow">Modèles e-mail</p><h2>Éditeur prêt à être activé</h2><p class="control-card-copy">Les parcours actuels conservent leurs modèles Velvet versionnés. La migration 0039 doit être appliquée pour modifier et activer les contenus depuis Contrôle.</p>${state('Migration 0039 requise', 'warning')}</section><section class="control-card"><p class="control-eyebrow">Sécurité marketing</p><h2>Aucun envoi sans consentement</h2><p class="control-card-copy">Les campagnes marketing restent verrouillées tant que le consentement, la désinscription et le prestataire ne sont pas opérationnels.</p>${state('Protection active', 'ok')}</section></div>` : `<div class="control-email-layout"><aside class="control-card"><p class="control-eyebrow">Bibliothèque</p><div class="control-template-list">${templates.map((template) => `<button class="control-template-choice${selected?.template_key === template.template_key ? ' active' : ''}" type="button" data-template-choice="${safe(template.template_key)}"><span><strong>${safe(template.label)}</strong><small>${template.category === 'marketing' ? 'Marketing' : 'Transactionnel'} · modifié ${safe(relativeDate(template.updated_at))}</small></span>${state(template.status === 'active' ? 'Actif' : 'Brouillon', template.status === 'active' ? 'ok' : 'neutral')}</button>`).join('')}</div></aside>${emailEditor(selected)}${emailPreview(selected)}</div><div class="control-grid equal control-section"><section class="control-card"><p class="control-eyebrow">Envoi transactionnel</p><h2>${safe((data.systems || []).find((item) => item.key === 'email')?.status === 'active' ? 'Connecteur actif' : 'Connecteur non configuré')}</h2><p class="control-card-copy">Les invitations Couple et les confirmations de cycle de vie utilisent automatiquement le modèle actif, avec retour au modèle sécurisé du code si la configuration est indisponible.</p></section><section class="control-card"><p class="control-eyebrow">Marketing</p><h2>Diffusion volontairement verrouillée</h2><p class="control-card-copy">Cet écran prépare le contenu. Aucun envoi en masse n’est lancé depuis Velvet Contrôle tant que la chaîne de consentement et de désinscription n’est pas validée.</p>${state('Zéro dépense · aucun envoi', 'ok')}</section></div>`}
    </section>`;
  }

  function optionAccounts() {
    return (data.accounts || []).filter((account) => account.status === 'active').map((account) => `<option value="${safe(account.user_id)}">${safe(account.email)} · ${safe((account.roles || []).join(', ') || 'sans rôle')}</option>`).join('');
  }

  function optionDirectoryVenues() {
    return (data.venueDirectory || []).filter((venue) => venue.claim_status === 'unclaimed' && !venue.claimed_establishment_id).map((venue) => `<option value="${safe(venue.id)}">${safe(venue.name)} · ${safe(venue.city || 'ville à confirmer')} · ${safe(venue.country_code || '')}</option>`).join('');
  }

  function optionCampaignSubjects(campaign) {
    if (campaign.subject_type === 'establishment') return (data.establishments || []).map((venue) => `<option value="${safe(venue.id)}">${safe(venue.name)} · ${safe(venue.city || 'ville non renseignée')}</option>`).join('');
    return [...new Map((data.accounts || []).filter((account) => account.profile_id).map((account) => [account.profile_id, account])).values()].filter((account) => {
      if (campaign.target_audience === 'couple') return account.profile_type === 'couple';
      if (campaign.target_audience === 'solo_man') return account.profile_type === 'individual' && account.gender_identity === 'Homme';
      return true;
    }).map((account) => `<option value="${safe(account.profile_id)}">${safe(account.display_name || account.email)} · ${safe(account.profile_type || 'profil')}</option>`).join('');
  }

  function accessLabel(account) {
    if (!account.profile_id) return 'Sans profil membre';
    if (account.access_tier === 'signature') return account.access_source === 'verified_woman' ? 'Signature · femme vérifiée' : `Signature · ${account.access_source || 'accès actif'}`;
    return 'Découverte';
  }

  function membersManagement() {
    if (!data.monetizationAvailable) return emptyState('Gestion des accès indisponible', 'La migration 0026 reste requise pour piloter les droits commerciaux.');
    const accounts = (data.accounts || []).filter((account) => account.profile_id);
    return `<div class="control-access-grid">${accounts.map((account) => `<article class="control-access-card"><header><div><h3>${safe(account.display_name || account.email)}</h3><p>${safe(account.email)} · ${safe(account.profile_type === 'couple' ? 'Couple' : account.gender_identity || 'Individuel')} · ${safe(account.verification_status || 'non vérifié')}</p></div>${state(account.status, account.status === 'active' ? 'ok' : account.status === 'suspended' ? 'warning' : 'danger')}</header><small>${safe(accessLabel(account))}${account.access_until ? ` · jusqu’au ${safe(date(account.access_until, false))}` : ''}</small><form class="control-inline-form" data-member-access="${safe(account.profile_id)}"><label>Accès<select name="mode"><option value="discovery"${account.access_tier === 'discovery' ? ' selected' : ''}>Découverte</option><option value="signature"${account.access_tier === 'signature' ? ' selected' : ''}>Signature</option></select></label><label>Jours<input name="durationDays" type="number" min="1" max="3650" value="90"></label><button class="control-btn ghost" type="submit">Appliquer</button></form><form class="control-inline-form" data-account-state="${safe(account.user_id)}"><label>Compte<select name="accountAction"><option value="activate">Activer</option><option value="suspend">Suspendre</option><option value="block">Bloquer</option><option value="delete">Supprimer à J+30</option></select></label><label>Heures<input name="durationHours" type="number" min="1" max="8760" value="24"></label><button class="control-btn ghost" type="submit">Confirmer</button></form></article>`).join('')}</div>`;
  }

  function proManagement() {
    return `<div class="control-grid equal"><section class="control-card"><p class="control-eyebrow">Fiche recensée</p><h2>Attribuer un établissement</h2><form id="controlClaimVenueForm" class="control-form"><label>Établissement<select name="venueId" required><option value="">Choisir…</option>${optionDirectoryVenues()}</select></label><label>Compte propriétaire<select name="ownerUserId" required><option value="">Choisir…</option>${optionAccounts()}</select></label><button class="control-btn" type="submit">Attribuer la fiche</button></form></section><section class="control-card"><p class="control-eyebrow">Lieu absent du catalogue</p><h2>Créer un établissement</h2><form id="controlVenueForm" class="control-form"><label>Nom<input name="name" required minlength="2" maxlength="180"></label><label>Identifiant URL<input name="slug" required pattern="[a-z0-9-]+" maxlength="100"></label><label>Type<select name="kind"><option value="club">Club</option><option value="spa">Spa</option><option value="bar">Bar</option><option value="love_room">Love room</option><option value="other">Autre</option></select></label><label>Compte propriétaire<select name="ownerUserId" required><option value="">Choisir…</option>${optionAccounts()}</select></label><button class="control-btn" type="submit">Créer et attribuer</button></form></section></div><section class="control-card control-section"><div class="control-table-wrap"><table class="control-table"><thead><tr><th>Établissement</th><th>Type</th><th>Ville</th><th>Velvet Pro</th><th>Visibilité</th></tr></thead><tbody>${(data.establishments || []).map((venue) => `<tr><td><strong>${safe(venue.name)}</strong></td><td>${safe(venue.kind)}</td><td>${safe(venue.city || '—')}</td><td><select data-subscription-status="${safe(venue.id)}"><option value="inactive"${venue.subscription_status === 'inactive' ? ' selected' : ''}>Inactif</option><option value="trial"${venue.subscription_status === 'trial' ? ' selected' : ''}>Essai</option><option value="active"${venue.subscription_status === 'active' ? ' selected' : ''}>Actif</option><option value="past_due"${venue.subscription_status === 'past_due' ? ' selected' : ''}>Impayé</option><option value="cancelled"${venue.subscription_status === 'cancelled' ? ' selected' : ''}>Résilié</option></select></td><td><select data-venue-visibility="${safe(venue.id)}"><option value="draft"${venue.visibility === 'draft' ? ' selected' : ''}>Brouillon</option><option value="review"${venue.visibility === 'review' ? ' selected' : ''}>En revue</option><option value="published"${venue.visibility === 'published' ? ' selected' : ''}>Publié</option><option value="suspended"${venue.visibility === 'suspended' ? ' selected' : ''}>Suspendu</option></select></td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function offersManagement() {
    return `${data.generatedPromotionCode ? `<div class="control-promo-code"><strong>Copie ce code maintenant</strong><small>Il ne sera plus consultable après actualisation.</small><code>${safe(data.generatedPromotionCode)}</code></div>` : ''}<div class="control-grid equal"><section class="control-card"><p class="control-eyebrow">Nouvelle campagne</p><h2>Générer un code</h2><form id="controlPromotionForm" class="control-form"><label>Nom interne<input name="name" required minlength="2" maxlength="120"></label><label>Destinataires<select name="audience"><option value="couple">Couples</option><option value="solo_man">Hommes seuls</option><option value="paid_member">Profils normalement payants</option><option value="any_member">Tous les membres</option><option value="pro">Velvet Pro</option></select></label><label>Durée offerte<input name="durationDays" type="number" min="1" max="3650" value="30" required></label><label>Utilisations maximum<input name="maxRedemptions" type="number" min="1" max="1000000" value="100" required></label><button class="control-btn" type="submit">Créer le code</button></form></section><section class="control-card"><p class="control-eyebrow">Tarifs</p><h2>Catalogue prêt au raccordement</h2>${(data.billingPrices || []).map((price) => `<article class="control-audit-row"><span>${safe(price.plan_code === 'pro_workspace' ? 'PRO' : 'MEMBRE')}</span><div><strong>${safe((Number(price.amount_cents) / 100).toLocaleString('fr-FR', { style: 'currency', currency: price.currency }))}</strong><small>${safe(price.price_code)}</small></div>${state('Actif', 'ok')}</article>`).join('') || emptyState('Aucun tarif', 'La migration 0026 est requise.')}</section></div><section class="control-card control-section">${(data.promotions || []).map((campaign) => `<article class="control-action"><i class="control-priority normal"></i><div><h3>${safe(campaign.name)}</h3><p>${safe(campaign.duration_days)} jours · ${safe(campaign.redemption_count)}/${safe(campaign.max_redemptions || '∞')} utilisés · ${safe(campaign.target_audience)}</p>${campaign.distribution_mode === 'control' ? `<form class="control-inline-form" data-grant-campaign="${safe(campaign.id)}" data-subject-type="${safe(campaign.subject_type)}"><label>Attribuer à<select name="subjectId" required><option value="">Choisir…</option>${optionCampaignSubjects(campaign)}</select></label><span></span><button class="control-btn ghost" type="submit">Offrir</button></form>` : ''}</div><button class="control-btn ghost" type="button" data-promotion-status="${safe(campaign.id)}" data-active="${campaign.active ? 'true' : 'false'}">${campaign.active ? 'Mettre en pause' : 'Réactiver'}</button></article>`).join('') || emptyState('Aucune campagne', 'Crée une campagne pour la voir ici.')}</section>`;
  }

  function invitationsManagement() {
    const statusLabel = { active: 'Actif', used: 'Utilisé', expired: 'Expiré', revoked: 'Révoqué' };
    return `<div class="control-grid equal"><section class="control-card"><p class="control-eyebrow">Accès BETA</p><h2>Inviter une personne</h2><form id="inviteForm" class="control-form"><label>Adresse e-mail<input name="email" type="email" autocomplete="off" required></label><label>Rôle<select name="role"><option value="member">Membre</option><option value="organizer">Organisateur privé</option><option value="pro_owner">Propriétaire Velvet Pro</option><option value="pro_staff">Collaborateur Velvet Pro</option><option value="moderator">Modération</option><option value="support">Support</option><option value="auditor">Auditeur</option><option value="direction">Direction</option><option value="admin">Administrateur</option></select></label><label>Validité<select name="validityDays"><option value="7">7 jours</option><option value="14">14 jours</option><option value="30">30 jours</option></select></label><button class="control-btn" type="submit">Générer le code sécurisé</button></form>${latestInvitation ? `<div class="control-promo-code"><strong>${safe(latestInvitation.invitedEmail)}</strong><code>${safe(latestInvitation.invitation.invite_code)}</code><button class="control-btn secondary" type="button" data-copy-invitation>Copier le lien</button></div>` : ''}</section><section class="control-card"><div class="control-section-title"><div><h2>Invitations récentes</h2><p>Historique sécurisé.</p></div><button class="control-btn ghost" type="button" data-reload-invites>Actualiser</button></div><div class="control-table-wrap">${inviteLoading ? emptyState('Lecture en cours', 'Connexion à Supabase…') : inviteRows.length ? `<table class="control-table"><thead><tr><th>E-mail</th><th>Rôle</th><th>Expire</th><th>État</th></tr></thead><tbody>${inviteRows.map((row) => `<tr><td>${safe(row.email)}</td><td>${safe(row.intended_role)}</td><td>${safe(date(row.expires_at, false))}</td><td>${state(statusLabel[row.status] || row.status, row.status === 'active' ? 'ok' : 'neutral')}</td></tr>`).join('')}</tbody></table>` : emptyState('Aucune invitation', 'Les invitations créées apparaîtront ici.')}</div></section></div>`;
  }

  function managementView() {
    const tabs = { members: 'Membres', pro: 'Professionnels', offers: 'Accès & offres', invitations: 'Invitations' };
    const content = managementSection === 'pro' ? proManagement() : managementSection === 'offers' ? offersManagement() : managementSection === 'invitations' ? invitationsManagement() : membersManagement();
    return `<section class="control-page" data-page="management">${pageHead('Administration structurée', 'Gestion', 'Les opérations détaillées restent accessibles sans encombrer ton briefing quotidien.')}<nav class="control-management-tabs" aria-label="Rubriques de gestion">${Object.entries(tabs).map(([key, label]) => `<button class="control-tab-button${managementSection === key ? ' active' : ''}" type="button" data-management-section="${key}">${label}</button>`).join('')}</nav><div class="control-management-panel">${content}</div><section class="control-section"><div class="control-section-title"><div><h2>Journal d’audit</h2><p>Dernières actions système, IA et Contrôle.</p></div></div><div class="control-card">${(data.audits || []).slice(0, 40).map((item) => `<article class="control-audit-row"><time>${safe(date(item.occurred_at))}</time><div><strong>${safe(item.action)}</strong><small>${safe(item.actor_type)} · ${safe(item.entity_type)} · ${safe(item.entity_id || 'système')}</small></div>${state(`#${item.sequence_number}`, item.actor_type === 'ai_agent' ? 'info' : 'neutral')}</article>`).join('') || emptyState('Aucune action auditée', 'Le journal commencera à la prochaine opération.')}</div></section></section>`;
  }

  function render() {
    if (!data) return;
    const renderers = { pilot: pilotView, actions: actionsView, intelligence: intelligenceView, communications: communicationsView, management: managementView };
    root.innerHTML = renderers[currentView]();
    document.body.dataset.velvetView = `control-${currentView}`;
    document.querySelectorAll('.top .tab[data-view]').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === currentView));
    document.querySelectorAll('.control-mobile-nav [data-view]').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === currentView));
    const count = (data.humanActions || []).length;
    document.querySelectorAll('[data-action-count]').forEach((badge) => { badge.textContent = count; badge.hidden = !count; });
    const status = document.querySelector('[data-control-status]');
    if (status) status.textContent = data.configurationAvailable ? 'Données réelles · À jour' : 'Données réelles · Configuration partielle';
    bind();
  }

  function setView(view) {
    if (!viewLabels[view]) return;
    currentView = view;
    render();
    root.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'management' && managementSection === 'invitations' && !inviteRows.length) loadInvitations();
  }

  function bindGlobalNav() {
    document.querySelectorAll('.top .tab[data-view]').forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.view)));
  }

  function bind() {
    root.querySelectorAll('[data-control-refresh]').forEach((button) => button.addEventListener('click', load));
    root.querySelectorAll('[data-nav-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.navView)));
    root.querySelectorAll('[data-history-filter]').forEach((button) => button.addEventListener('click', () => { historyFilter = button.dataset.historyFilter; render(); }));
    root.querySelectorAll('[data-management-section]').forEach((button) => button.addEventListener('click', () => { managementSection = button.dataset.managementSection; render(); if (managementSection === 'invitations' && !inviteRows.length) loadInvitations(); }));
    root.querySelectorAll('[data-template-choice]').forEach((button) => button.addEventListener('click', () => { selectedTemplateKey = button.dataset.templateChoice; render(); }));
    root.querySelectorAll('input[type="range"]').forEach((input) => input.addEventListener('input', () => { const output = root.querySelector(`[data-range-output="${input.name}"]`); if (output) output.textContent = `${input.value} %`; }));
    root.querySelector('#mediaPolicyForm')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
      await mutate({ action: 'update_media_policy', automationMode: values.automationMode, publicAutoConfidence: Number(values.publicAutoConfidence) / 100, privateAutoConfidence: Number(values.privateAutoConfidence) / 100 }, 'Politique IA enregistrée et auditée.');
    });
    root.querySelector('#emailTemplateForm')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
      await mutate({ action: 'update_email_template', templateKey: form.dataset.template, ...values }, 'Modèle e-mail enregistré.');
    });
    root.querySelectorAll('[data-report-status]').forEach((button) => button.addEventListener('click', () => mutate({ action: 'report_status', reportId: button.dataset.report, status: button.dataset.reportStatus }, 'Signalement mis à jour.')));
    root.querySelectorAll('[data-organizer-decision]').forEach((button) => button.addEventListener('click', () => mutate({ action: 'decide_organizer', requestId: button.dataset.request, decision: button.dataset.organizerDecision }, 'Décision Organisateur enregistrée.')));
    root.querySelectorAll('[data-open-media]').forEach((button) => button.addEventListener('click', () => openMediaViewer(button.dataset.openMedia)));
    root.querySelectorAll('[data-media-decision]').forEach((button) => button.addEventListener('click', () => {
      const card = button.closest('[data-media-review]'); const reason = card?.querySelector('[data-moderation-reason]')?.value.trim() || '';
      if (button.dataset.mediaDecision === 'rejected' && !reason) { toastMsg('Indique le motif du refus.'); return; }
      mutate({ action: 'decide_media', mediaId: button.dataset.media, decision: button.dataset.mediaDecision, reason }, button.dataset.mediaDecision === 'approved' ? 'Média validé.' : 'Média refusé.');
    }));
    root.querySelector('#controlVenueForm')?.addEventListener('submit', async (event) => { event.preventDefault(); await mutate({ action: 'create_establishment', ...Object.fromEntries(new FormData(event.currentTarget)) }, 'Établissement créé et attribué.'); });
    root.querySelector('#controlClaimVenueForm')?.addEventListener('submit', async (event) => { event.preventDefault(); await mutate({ action: 'claim_directory_venue', ...Object.fromEntries(new FormData(event.currentTarget)) }, 'Fiche attribuée.'); });
    root.querySelector('#controlPromotionForm')?.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); await mutate({ action: 'create_promotion', subjectType: values.audience === 'pro' ? 'establishment' : 'profile', ...values }, 'Code promotionnel créé.'); });
    root.querySelectorAll('[data-member-access]').forEach((form) => form.addEventListener('submit', async (event) => { event.preventDefault(); await mutate({ action: 'member_access', profileId: form.dataset.memberAccess, ...Object.fromEntries(new FormData(form)) }, 'Accès membre synchronisé.'); }));
    root.querySelectorAll('[data-account-state]').forEach((form) => form.addEventListener('submit', async (event) => { event.preventDefault(); await mutate({ action: 'account_state', userId: form.dataset.accountState, ...Object.fromEntries(new FormData(form)) }, 'État du compte synchronisé.'); }));
    root.querySelectorAll('[data-grant-campaign]').forEach((form) => form.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); await mutate({ action: 'grant_campaign', campaignId: form.dataset.grantCampaign, subjectType: form.dataset.subjectType, subjectId: values.subjectId }, 'Accès attribué.'); }));
    root.querySelectorAll('[data-promotion-status]').forEach((button) => button.addEventListener('click', () => mutate({ action: 'promotion_status', campaignId: button.dataset.promotionStatus, active: button.dataset.active !== 'true' }, 'État de la campagne synchronisé.')));
    root.querySelectorAll('[data-venue-visibility]').forEach((select) => select.addEventListener('change', () => mutate({ action: 'venue_visibility', venueId: select.dataset.venueVisibility, visibility: select.value }, 'Visibilité synchronisée.')));
    root.querySelectorAll('[data-subscription-status]').forEach((select) => select.addEventListener('change', () => mutate({ action: 'subscription_status', venueId: select.dataset.subscriptionStatus, status: select.value }, 'Abonnement Velvet Pro synchronisé.')));
    root.querySelector('#inviteForm')?.addEventListener('submit', createInvitation);
    root.querySelector('[data-reload-invites]')?.addEventListener('click', () => loadInvitations(true));
    root.querySelector('[data-copy-invitation]')?.addEventListener('click', copyInvitation);
  }

  function closeMediaViewer() { mediaViewer?.remove(); mediaViewer = null; }

  function openMediaViewer(mediaId) {
    const media = (data.pendingMedia || []).find((item) => item.id === mediaId);
    if (!media?.previewUrl) { toastMsg('Aperçu temporaire indisponible. Actualise la file.'); return; }
    const profile = media.member_profiles || data.profiles.find((item) => item.id === media.profile_id) || {};
    closeMediaViewer();
    mediaViewer = document.createElement('section');
    mediaViewer.className = 'control-media-viewer'; mediaViewer.setAttribute('role', 'dialog'); mediaViewer.setAttribute('aria-modal', 'true'); mediaViewer.setAttribute('aria-label', 'Visionneuse de modération');
    const content = media.media_type === 'video' ? `<video controls autoplay playsinline preload="metadata" src="${safe(media.previewUrl)}"></video>` : `<img src="${safe(media.previewUrl)}" alt="${safe(mediaRole(media))} de ${safe(profile.display_name || 'Profil membre')}">`;
    mediaViewer.innerHTML = `<div class="control-media-viewer-dialog"><button class="control-media-viewer-close" type="button" aria-label="Fermer">×</button><div class="control-media-viewer-stage">${content}</div><div class="control-media-viewer-caption"><strong>${safe(profile.display_name || 'Profil membre')} · ${safe(mediaContext(media))}</strong>Lien signé temporaire réservé à Velvet Contrôle.</div></div>`;
    mediaViewer.querySelector('.control-media-viewer-close')?.addEventListener('click', closeMediaViewer);
    mediaViewer.addEventListener('click', (event) => { if (event.target === mediaViewer) closeMediaViewer(); });
    document.body.append(mediaViewer); mediaViewer.querySelector('.control-media-viewer-close')?.focus();
  }

  async function mutate(payload, message) {
    try { data = await api({ method: 'POST', body: JSON.stringify(payload) }); render(); toastMsg(message); }
    catch (error) { toastMsg(`Action refusée : ${error.message}`); }
  }

  async function loadInvitations(force = false) {
    if (inviteLoading || (!force && inviteRows.length)) return;
    inviteLoading = true; render();
    try { const result = await controlApi('/api/admin/invites'); inviteRows = result.invitations || []; }
    catch (error) { toastMsg(error.message === 'admin_required' ? 'Accès réservé aux administrateurs.' : `Invitations indisponibles : ${error.message}`); }
    finally { inviteLoading = false; render(); }
  }

  async function createInvitation(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    try { latestInvitation = await controlApi('/api/admin/invites', { method: 'POST', body: JSON.stringify({ email: values.email, role: values.role, validityDays: Number(values.validityDays) }) }); inviteRows = []; render(); await loadInvitations(true); toastMsg('Code d’invitation généré.'); }
    catch (error) { toastMsg(`Invitation impossible : ${error.message}`); }
  }

  async function copyInvitation() {
    if (!latestInvitation?.registrationUrl) return;
    try { await navigator.clipboard.writeText(latestInvitation.registrationUrl); toastMsg('Lien copié.'); }
    catch { toastMsg('Copie automatique indisponible.'); }
  }

  async function load() {
    root.innerHTML = '<div class="control-loading"><span></span><p>Lecture sécurisée des données Velvet…</p></div>';
    try { data = await api(); render(); }
    catch (error) { root.innerHTML = `<section class="control-page"><div class="control-empty"><div><strong>Velvet Contrôle est indisponible</strong><span>${safe(error.message)}</span><br><button class="control-btn secondary" type="button" data-retry>Réessayer</button></div></div></section>`; root.querySelector('[data-retry]')?.addEventListener('click', load); }
  }

  bindGlobalNav();
  load();
})();
