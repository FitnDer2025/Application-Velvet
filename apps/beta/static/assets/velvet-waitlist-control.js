(() => {
  'use strict';

  const metricsRoot = document.querySelector('#waitlistMetrics');
  const rowsRoot = document.querySelector('#waitlistRows');
  const territoriesRoot = document.querySelector('#territoryRanking');
  const sourcesRoot = document.querySelector('#sourceRanking');
  const filters = document.querySelector('#waitlistFilters');
  const statusRoot = document.querySelector('#controlStatus');
  const migrationNotice = document.querySelector('#migrationNotice');
  const refreshButton = document.querySelector('#refreshWaitlist');
  const exportButton = document.querySelector('#exportWaitlist');
  if (!metricsRoot || !rowsRoot) return;

  let currentEntries = [];
  let permissions = { canUpdate: false };

  const statusLabels = {
    registered: 'Préinscrit',
    qualified: 'Qualifié',
    invited: 'Invité',
    converted: 'Converti',
    withdrawn: 'Désinscrit',
    rejected: 'Écarté'
  };
  const memberLabels = { couple: 'Couple', woman: 'Femme', man: 'Homme', other: 'Autre profil' };
  const proLabels = { club: 'Club', spa: 'Spa', love_room: 'Love room', event_organizer: 'Organisateur', photographer: 'Photographe', other: 'Autre activité' };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function setStatus(message = '', tone = '') {
    statusRoot.textContent = message;
    if (tone) statusRoot.dataset.tone = tone;
    else delete statusRoot.dataset.tone;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  function renderMetrics(metrics = {}) {
    const values = [metrics.total, metrics.members, metrics.professionals, metrics.last7Days, metrics.invited, metrics.converted];
    [...metricsRoot.querySelectorAll('strong')].forEach((node, index) => {
      node.textContent = new Intl.NumberFormat('fr-FR').format(Number(values[index] || 0));
    });
  }

  function renderRanking(root, items, kind) {
    if (!items?.length) {
      root.innerHTML = '<p class="vwa-empty">Aucune donnée disponible pour le moment.</p>';
      return;
    }
    const max = Math.max(...items.map((item) => Number(item.total || 0)), 1);
    root.innerHTML = items.map((item) => {
      const label = kind === 'territory'
        ? `${item.location || 'Non renseigné'} · ${item.country || ''}`
        : `${item.source || 'direct'}${item.campaign ? ` · ${item.campaign}` : ''}`;
      const width = Math.max(4, Math.round((Number(item.total || 0) / max) * 100));
      return `<div class="vwa-rank"><label title="${escapeHtml(label)}">${escapeHtml(label)}</label><div class="vwa-rank-bar"><i style="width:${width}%"></i></div><b>${Number(item.total || 0)}</b></div>`;
    }).join('');
  }

  function statusControl(entry) {
    if (!permissions.canUpdate) return `<span>${escapeHtml(statusLabels[entry.status] || entry.status)}</span>`;
    return `<select class="vwa-status-select" data-entry-id="${escapeHtml(entry.id)}" aria-label="État de ${escapeHtml(entry.email)}">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}"${entry.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select>`;
  }

  function renderRows(entries = []) {
    currentEntries = entries;
    if (!entries.length) {
      rowsRoot.innerHTML = '<tr><td colspan="7" class="vwa-empty">Aucune préinscription ne correspond aux filtres.</td></tr>';
      return;
    }
    rowsRoot.innerHTML = entries.map((entry) => {
      const isPro = entry.audience === 'pro';
      const title = isPro ? entry.business_name : entry.email;
      const subtitle = isPro
        ? `${entry.contact_name || ''} · ${entry.email}`
        : memberLabels[entry.member_type] || 'Membre';
      const type = isPro ? (proLabels[entry.professional_type] || 'Professionnel') : 'Membre';
      const source = `${entry.source || 'direct'}${entry.campaign ? ` · ${entry.campaign}` : ''}`;
      return `<tr>
        <td><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></td>
        <td><span class="vwa-audience ${isPro ? 'pro' : ''}">${escapeHtml(type)}</span></td>
        <td><strong>${escapeHtml(entry.location)}</strong><small>${escapeHtml(entry.country_code)}</small></td>
        <td>${escapeHtml(source)}</td>
        <td><span class="vwa-beta ${entry.wants_beta ? 'yes' : ''}">${entry.wants_beta ? 'Oui' : 'Non'}</span></td>
        <td>${escapeHtml(formatDate(entry.created_at))}</td>
        <td>${statusControl(entry)}</td>
      </tr>`;
    }).join('');
  }

  function parameters() {
    const data = new FormData(filters);
    const query = new URLSearchParams({ limit: '200' });
    ['search', 'audience', 'status'].forEach((key) => {
      const value = String(data.get(key) || '').trim();
      if (value) query.set(key, value);
    });
    return query;
  }

  async function load() {
    refreshButton.disabled = true;
    setStatus('Actualisation de la salle d’attente…');
    try {
      const response = await fetch(`/api/control/waitlist?${parameters()}`, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' }
      });
      const payload = await response.json().catch(() => ({}));
      permissions = payload.permissions || permissions;
      migrationNotice.hidden = payload.migrationPending !== true;
      if (!response.ok && !payload.migrationPending) throw new Error('Impossible de charger les préinscriptions.');
      renderMetrics(payload.metrics || {});
      renderRanking(territoriesRoot, payload.topTerritories || [], 'territory');
      renderRanking(sourcesRoot, payload.topSources || [], 'source');
      renderRows(payload.entries || []);
      setStatus(payload.migrationPending ? 'Le cockpit sera alimenté après activation de la migration Supabase.' : `${(payload.entries || []).length} préinscription(s) affichée(s).`);
    } catch (error) {
      setStatus(error.message || 'Erreur de chargement.', 'error');
      renderRows([]);
    } finally {
      refreshButton.disabled = false;
    }
  }

  async function updateStatus(select) {
    const previous = currentEntries.find((entry) => entry.id === select.dataset.entryId)?.status || 'registered';
    select.disabled = true;
    try {
      const response = await fetch('/api/control/waitlist', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ id: select.dataset.entryId, status: select.value })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Mise à jour impossible.');
      const entry = currentEntries.find((item) => item.id === select.dataset.entryId);
      if (entry) entry.status = select.value;
      setStatus('État de la préinscription mis à jour.');
      await load();
    } catch (error) {
      select.value = previous;
      setStatus('La modification n’a pas pu être enregistrée.', 'error');
    } finally {
      select.disabled = false;
    }
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    if (!currentEntries.length) return setStatus('Aucune donnée à exporter.', 'error');
    const header = ['Public', 'Email', 'Profil / activité', 'Établissement', 'Contact', 'Téléphone', 'Ville', 'Pays', 'Bêta', 'Source', 'Campagne', 'État', 'Inscription'];
    const body = currentEntries.map((entry) => [
      entry.audience,
      entry.email,
      entry.member_type || entry.professional_type,
      entry.business_name,
      entry.contact_name,
      entry.phone,
      entry.location,
      entry.country_code,
      entry.wants_beta ? 'oui' : 'non',
      entry.source,
      entry.campaign,
      statusLabels[entry.status] || entry.status,
      entry.created_at
    ]);
    const csv = [header, ...body].map((line) => line.map(csvCell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `velvet-preinscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Export CSV généré.');
  }

  filters.addEventListener('submit', (event) => { event.preventDefault(); load(); });
  refreshButton.addEventListener('click', load);
  exportButton.addEventListener('click', exportCsv);
  rowsRoot.addEventListener('change', (event) => {
    const select = event.target.closest('.vwa-status-select');
    if (select) updateStatus(select);
  });
  load();
})();
