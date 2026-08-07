(() => {
  if (!location.pathname.startsWith('/membres')) return;

  const STORAGE_KEY = 'zwit.pendingCheckin.v1';
  const query = new URL(location.href).searchParams;
  const queryToken = String(query.get('checkin') || '').trim();
  if (queryToken) {
    try { sessionStorage.setItem(STORAGE_KEY, queryToken); } catch {}
  }

  const pendingToken = () => {
    try { return String(sessionStorage.getItem(STORAGE_KEY) || '').trim(); } catch { return queryToken; }
  };
  const clearPending = () => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    if (query.has('checkin')) {
      const clean = new URL(location.href);
      clean.searchParams.delete('checkin');
      history.replaceState(history.state, '', `${clean.pathname}${clean.search}${clean.hash}`);
    }
  };

  function style() {
    if (document.querySelector('[data-zwit-checkin-style]')) return;
    const node = document.createElement('style');
    node.dataset.zwitCheckinStyle = '1';
    node.textContent = `
      .zwit-checkin-result{position:fixed;z-index:2147482500;inset:0;display:grid;place-items:center;padding:18px;background:#050407e8;backdrop-filter:blur(22px);opacity:0;transition:opacity .25s}.zwit-checkin-result.visible{opacity:1}.zwit-checkin-panel{position:relative;width:min(440px,100%);padding:28px 24px;border:1px solid color-mix(in srgb,var(--gold,#d8bd77) 28%,transparent);border-radius:30px;background:radial-gradient(circle at 90% 0,color-mix(in srgb,var(--wine,#7d294c) 34%,transparent),transparent 38%),#111014;box-shadow:0 38px 130px #000c;text-align:center}.zwit-checkin-panel .seal{display:grid;place-items:center;width:68px;height:68px;margin:0 auto 15px;border:1px solid color-mix(in srgb,var(--gold,#d8bd77) 36%,transparent);border-radius:23px;background:color-mix(in srgb,var(--gold,#d8bd77) 9%,transparent);color:var(--gold,#d8bd77);font-size:28px}.zwit-checkin-panel>span{color:var(--gold,#d8bd77);font-size:9px;font-weight:900;letter-spacing:.17em}.zwit-checkin-panel h2{margin:8px 0 7px;color:var(--text,#f6f1ee);font:500 30px/1.08 Georgia,serif}.zwit-checkin-panel p{margin:0;color:var(--muted,#aaa3a0);font-size:12px;line-height:1.55}.zwit-checkin-panel .passport{margin:17px 0 0;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.035);color:var(--gold,#d8bd77);font-size:10px;font-weight:800}.zwit-checkin-panel button{width:100%;min-height:44px;margin-top:17px;border:0;border-radius:14px;background:linear-gradient(135deg,#963961,var(--wine,#7d294c));color:#fff;font-weight:800;cursor:pointer}.zwit-checkin-panel.error .seal{color:#d9b0b7;border-color:#ffffff20;background:#ffffff05}.zwit-checkin-panel.error .passport{display:none}`;
    document.head.appendChild(node);
  }

  function show({ title, message, eventTitle, error = false }) {
    style();
    document.querySelector('[data-zwit-checkin-result]')?.remove();
    const layer = document.createElement('div');
    layer.className = 'zwit-checkin-result';
    layer.dataset.zwitCheckinResult = '1';
    layer.innerHTML = `<div class="zwit-checkin-panel${error ? ' error' : ''}"><div class="seal" aria-hidden="true">${error ? '×' : '✓'}</div><span>${error ? 'CHECK-IN ZWIT' : 'PRÉSENCE VÉRIFIÉE'}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(eventTitle || message)}</p>${eventTitle && message ? `<p style="margin-top:7px">${escapeHtml(message)}</p>` : ''}<div class="passport">Passeport Zwit · présence réelle mise à jour</div><button type="button" data-zwit-checkin-close>Continuer dans Zwit</button></div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('visible'));
    layer.querySelector('[data-zwit-checkin-close]').addEventListener('click', () => layer.remove());
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function errorCopy(code) {
    if (code === 'checkin_session_expired') return ['QR expiré', 'Demande au personnel d’afficher le nouveau QR tournant.'];
    if (code === 'confirmed_registration_required') return ['Réservation nécessaire', 'Ce QR est réservé aux membres dont la participation est confirmée.'];
    if (code === 'invalid_checkin_token') return ['QR non reconnu', 'Ce code ne correspond pas à une session d’entrée Zwit valide.'];
    return ['Check-in indisponible', 'La validation n’a pas pu être enregistrée pour le moment.'];
  }

  async function redeem() {
    const token = pendingToken();
    if (!token || token.length < 32 || window.__ZWIT_CHECKIN_REDEEMING__) return;
    window.__ZWIT_CHECKIN_REDEEMING__ = true;
    try {
      const response = await fetch('/api/members/check-in', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        // Le token reste en sessionStorage pour être repris après authentification.
        window.__ZWIT_CHECKIN_REDEEMING__ = false;
        return;
      }
      clearPending();
      if (!response.ok) {
        const [title, message] = errorCopy(payload.error);
        show({ title, message, error: true });
        return;
      }
      show({
        title: 'Bienvenue',
        eventTitle: payload.checkin?.eventTitle || 'Ta présence vient d’être confirmée.',
        message: 'Cette sortie rejoint désormais tes preuves réelles de confiance.'
      });
      document.dispatchEvent(new CustomEvent('zwit:passport-refresh', { detail: { reason: 'venue_checkin' } }));
    } catch {
      // Erreur réseau : on conserve le token quelques instants pour permettre un nouvel essai au refresh.
    } finally {
      window.__ZWIT_CHECKIN_REDEEMING__ = false;
    }
  }

  if (pendingToken()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', redeem, { once: true });
    else redeem();
  }
})();
