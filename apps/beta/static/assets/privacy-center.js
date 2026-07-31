(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const labels = {
    public: 'Public',
    private: 'Privé',
    invisible: 'Invisible',
    sensitive_profile: 'Données de profil liées à la sexualité',
    precise_location: 'Géolocalisation',
    marketing_velvet: 'Informations commerciales Velvet',
    marketing_partners: 'Informations de partenaires'
  };
  const rightLabels = {
    access: 'Accès à mes données',
    portability: 'Portabilité',
    rectification: 'Rectification',
    erasure: 'Effacement',
    restriction: 'Limitation du traitement',
    objection: 'Opposition'
  };

  const request = async (body) => {
    const response = await fetch('/api/members/privacy', {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'privacy_request_failed');
    return payload;
  };

  const style = document.createElement('style');
  style.textContent = `
    .velvet-privacy-launcher{position:fixed;z-index:9997;right:16px;bottom:74px;padding:10px 14px;border:1px solid #ffffff24;border-radius:999px;background:#171014e8;color:#f4d9e2;font:700 11px Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 14px 45px #0008;backdrop-filter:blur(14px);cursor:pointer}
    .velvet-privacy-modal{position:fixed;z-index:11000;inset:0;display:grid;place-items:center;padding:18px;background:#050406de;backdrop-filter:blur(18px);color:#f7f1f3;font:14px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .velvet-privacy-modal[hidden]{display:none}.velvet-privacy-card{position:relative;width:min(780px,100%);max-height:92vh;overflow:auto;padding:30px;border:1px solid #ffffff1f;border-radius:28px;background:#171014;box-shadow:0 34px 100px #000c}.velvet-privacy-close{position:absolute;right:16px;top:16px;width:40px;height:40px;border:1px solid #ffffff24;border-radius:50%;background:#0c090b;color:white;font-size:24px;cursor:pointer}
    .velvet-privacy-card h1{margin:.25em 46px .25em 0;font:38px/1.08 Georgia,serif}.velvet-privacy-card h2{margin:0 0 8px;font-size:18px}.velvet-privacy-card p,.velvet-privacy-card small{color:#cbbdc2}.velvet-privacy-section{margin-top:18px;padding:18px;border:1px solid #ffffff16;border-radius:20px;background:#ffffff05}.velvet-privacy-options{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.velvet-privacy-options label{display:grid;gap:6px;padding:13px;border:1px solid #ffffff1a;border-radius:15px;background:#0c090b}.velvet-privacy-options input{accent-color:#a72c56}
    .velvet-privacy-row{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:11px 0;border-bottom:1px solid #ffffff10}.velvet-privacy-row:last-child{border-bottom:0}.velvet-privacy-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.velvet-privacy-card button.action{padding:11px 15px;border:0;border-radius:999px;background:#9f2852;color:white;font-weight:800;cursor:pointer}.velvet-privacy-card button.secondary{background:transparent;border:1px solid #d9b879;color:#d9b879}.velvet-privacy-card button.danger{background:#5e1830}.velvet-privacy-card textarea,.velvet-privacy-card select{width:100%;padding:12px;border:1px solid #ffffff24;border-radius:13px;background:#0c090b;color:white}.velvet-privacy-status{min-height:22px;margin:12px 0 0;color:#eab2c6}.velvet-privacy-status[data-error=true]{color:#ff91b4}.velvet-privacy-request{display:grid;grid-template-columns:1fr 1.5fr auto;gap:8px;align-items:end}.velvet-privacy-request label{display:grid;gap:6px}
    @media(max-width:700px){.velvet-privacy-launcher{right:10px;bottom:70px}.velvet-privacy-card{padding:24px 18px}.velvet-privacy-options,.velvet-privacy-request{grid-template-columns:1fr}.velvet-privacy-row{align-items:flex-start;flex-direction:column}}
  `;
  document.head.append(style);

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'velvet-privacy-launcher';
  launcher.textContent = 'Confidentialité & droits';
  document.body.append(launcher);

  const modal = document.createElement('section');
  modal.className = 'velvet-privacy-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Centre de confidentialité Velvet');
  document.body.append(modal);

  function close() {
    modal.hidden = true;
    launcher.focus();
  }

  function status(text, error = false) {
    const node = modal.querySelector('.velvet-privacy-status');
    if (!node) return;
    node.textContent = text;
    node.dataset.error = error ? 'true' : 'false';
  }

  function consentRow(purpose, granted) {
    return `<div class="velvet-privacy-row"><div><strong>${escape(labels[purpose] || purpose)}</strong><small>${granted ? 'Consentement actuellement actif.' : 'Consentement absent ou retiré.'}</small></div>${granted ? `<button class="action danger" type="button" data-withdraw="${escape(purpose)}">Retirer</button>` : purpose === 'sensitive_profile' ? '<button class="action secondary" type="button" data-grant-sensitive>Redonner mon accord</button>' : ''}</div>`;
  }

  function render(state) {
    const profile = state.profile || {};
    const consentPurposes = ['sensitive_profile', 'precise_location', 'marketing_velvet', 'marketing_partners'];
    const requests = Array.isArray(state.requests) ? state.requests : [];
    modal.innerHTML = `<div class="velvet-privacy-card">
      <button class="velvet-privacy-close" type="button" aria-label="Fermer">×</button>
      <p style="color:#d9b879;letter-spacing:.16em;text-transform:uppercase;font-size:11px">Velvet · maîtrise de vos données</p>
      <h1>Confidentialité et droits</h1>
      <p>Tu peux choisir ta visibilité, retirer un consentement et exercer tes droits sans passer par les CGU ni contacter un membre de l’équipe.</p>

      <section class="velvet-privacy-section">
        <h2>Visibilité du profil</h2>
        <div class="velvet-privacy-options">
          ${['public', 'private', 'invisible'].map((mode) => `<label><input type="radio" name="privacyMode" value="${mode}" ${profile.privacy_mode === mode ? 'checked' : ''}><strong>${labels[mode]}</strong><small>${mode === 'public' ? 'Visible selon tes filtres d’audience.' : mode === 'private' ? 'Visible uniquement aux profils autorisés.' : 'Absent des recherches et non consultable.'}</small></label>`).join('')}
        </div>
        <div class="velvet-privacy-actions"><button class="action" type="button" data-save-mode>Enregistrer la visibilité</button></div>
      </section>

      <section class="velvet-privacy-section">
        <h2>Consentements séparés</h2>
        ${consentPurposes.map((purpose) => consentRow(purpose, state.consents?.[purpose] === true)).join('')}
        <small>Le retrait du consentement sensible rend immédiatement le profil invisible. Le retrait de la géolocalisation efface les coordonnées enregistrées.</small>
      </section>

      <section class="velvet-privacy-section">
        <h2>Exercer un droit RGPD</h2>
        <form class="velvet-privacy-request" id="velvetRightsForm">
          <label>Demande<select name="requestType">${Object.entries(rightLabels).map(([value, label]) => `<option value="${value}">${escape(label)}</option>`).join('')}</select></label>
          <label>Précisions<textarea name="details" rows="3" maxlength="4000" placeholder="Indique les données ou la situation concernée."></textarea></label>
          <button class="action" type="submit">Envoyer</button>
        </form>
        ${requests.length ? `<div style="margin-top:14px">${requests.slice(0, 5).map((item) => `<div class="velvet-privacy-row"><span>${escape(rightLabels[item.request_type] || item.request_type)}</span><small>${escape(item.status)} · ${escape(new Date(item.requested_at).toLocaleDateString('fr-FR'))}</small></div>`).join('')}</div>` : '<small>Aucune demande enregistrée.</small>'}
      </section>
      <p class="velvet-privacy-status" role="status"></p>
    </div>`;

    modal.querySelector('.velvet-privacy-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    }, { once: true });

    modal.querySelector('[data-save-mode]').addEventListener('click', async (event) => {
      const mode = modal.querySelector('input[name="privacyMode"]:checked')?.value;
      event.currentTarget.disabled = true;
      status('Enregistrement…');
      try {
        render(await request({ action: 'set_profile_mode', mode }));
      } catch (error) {
        event.currentTarget.disabled = false;
        status(error.message === 'sensitive_profile_consent_required' ? 'Tu dois redonner un consentement explicite avant de rendre le profil visible.' : error.message, true);
      }
    });

    modal.querySelectorAll('[data-withdraw]').forEach((button) => {
      button.addEventListener('click', async () => {
        const purpose = button.dataset.withdraw;
        const confirmed = window.confirm(`Confirmer le retrait : ${labels[purpose] || purpose} ?`);
        if (!confirmed) return;
        button.disabled = true;
        status('Retrait en cours…');
        try {
          render(await request({ action: 'withdraw_consent', purpose, confirm: true }));
        } catch (error) {
          button.disabled = false;
          status(error.message, true);
        }
      });
    });

    modal.querySelector('[data-grant-sensitive]')?.addEventListener('click', async (event) => {
      const confirmed = window.confirm('Je consens explicitement au traitement des informations relatives à ma vie sexuelle que je choisis de publier sur Velvet. Je comprends que je pourrai retirer cet accord à tout moment.');
      if (!confirmed) return;
      event.currentTarget.disabled = true;
      status('Enregistrement du consentement explicite…');
      try {
        render(await request({ action: 'grant_sensitive_consent', confirm: true }));
      } catch (error) {
        event.currentTarget.disabled = false;
        status(error.message, true);
      }
    });

    modal.querySelector('#velvetRightsForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      const button = form.querySelector('button');
      button.disabled = true;
      status('Enregistrement de ta demande…');
      try {
        render(await request({
          action: 'request_right',
          requestType: values.requestType,
          details: values.details
        }));
      } catch (error) {
        button.disabled = false;
        status(error.message, true);
      }
    });
  }

  launcher.addEventListener('click', async () => {
    modal.hidden = false;
    modal.innerHTML = '<div class="velvet-privacy-card"><p>Chargement de tes choix et demandes…</p></div>';
    try {
      render(await request());
      modal.querySelector('.velvet-privacy-close')?.focus();
    } catch (error) {
      modal.innerHTML = `<div class="velvet-privacy-card"><button class="velvet-privacy-close" type="button">×</button><h1>Centre indisponible</h1><p>${escape(error.message)}</p></div>`;
      modal.querySelector('.velvet-privacy-close').addEventListener('click', close);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) close();
  });
})();
