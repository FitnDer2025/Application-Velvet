(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const api = async (body) => {
    const response = await fetch('/api/control/mfa', {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'mfa_request_failed');
    return payload;
  };

  const style = document.createElement('style');
  style.textContent = `
    .velvet-mfa-gate{position:fixed;z-index:11000;inset:0;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 80% 10%,#522038,#090709 58%);color:#f8eee8;font:15px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .velvet-mfa-card{width:min(520px,100%);padding:32px;border:1px solid #ffffff20;border-radius:28px;background:#171014;box-shadow:0 34px 100px #000b}
    .velvet-mfa-card h1{margin:.25em 0;font:38px/1.08 Georgia,serif}.velvet-mfa-card p{color:#cfc2c6}.velvet-mfa-card small{display:block;color:#96898d}.velvet-mfa-card form{display:grid;gap:13px;margin-top:20px}
    .velvet-mfa-card input{width:100%;padding:14px;border:1px solid #ffffff24;border-radius:14px;background:#0c090b;color:white;font-size:18px;letter-spacing:.18em;text-align:center}
    .velvet-mfa-card button{padding:14px 18px;border:0;border-radius:999px;background:#9f2852;color:white;font-weight:800;cursor:pointer}.velvet-mfa-card button.secondary{background:transparent;border:1px solid #d9b879;color:#d9b879}
    .velvet-mfa-qr{display:grid;place-items:center;margin:18px 0;padding:16px;border-radius:18px;background:white}.velvet-mfa-qr img{width:min(240px,100%);height:auto}.velvet-mfa-secret{padding:12px;border-radius:12px;background:#090709;color:#d9b879;word-break:break-all;font-family:monospace}.velvet-mfa-status{min-height:24px;color:#e6b4c6}.velvet-mfa-status[data-error=true]{color:#ff9ab8}
  `;
  document.head.append(style);

  const gate = document.createElement('section');
  gate.className = 'velvet-mfa-gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.innerHTML = '<div class="velvet-mfa-card"><p>Vérification de la protection Control…</p></div>';
  document.body.append(gate);

  function loadControl() {
    gate.remove();
    const script = document.createElement('script');
    script.src = '/assets/control-live.js';
    script.onerror = () => {
      gate.innerHTML = '<div class="velvet-mfa-card"><h1>Chargement impossible</h1><p>Le module Control n’a pas pu être chargé.</p></div>';
      document.body.append(gate);
    };
    document.body.append(script);
  }

  function status(text, error = false) {
    const node = gate.querySelector('.velvet-mfa-status');
    if (!node) return;
    node.textContent = text;
    node.dataset.error = error ? 'true' : 'false';
  }

  async function verifyForm(factorId, challengeId, setup = null) {
    gate.innerHTML = `<div class="velvet-mfa-card">
      <p style="color:#d9b879;letter-spacing:.16em;text-transform:uppercase;font-size:11px">Velvet Control · sécurité renforcée</p>
      <h1>${setup ? 'Active ton second facteur' : 'Confirme ton identité'}</h1>
      <p>${setup ? 'Scanne ce QR code avec ton application d’authentification, puis saisis le code à six chiffres.' : 'Saisis le code généré par ton application d’authentification.'}</p>
      ${setup?.qrCode ? `<div class="velvet-mfa-qr"><img src="${escape(setup.qrCode)}" alt="QR code TOTP Velvet Control"></div>` : ''}
      ${setup?.secret ? `<small>Clé manuelle de secours</small><div class="velvet-mfa-secret">${escape(setup.secret)}</div>` : ''}
      <form id="velvetMfaVerify">
        <label>Code à six chiffres<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
        <button type="submit">Déverrouiller Control</button>
      </form>
      <p class="velvet-mfa-status" role="status"></p>
      <small>Le second facteur est obligatoire pour tous les rôles Control et pour toute consultation de données sensibles.</small>
    </div>`;
    gate.querySelector('#velvetMfaVerify').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      const code = new FormData(event.currentTarget).get('code');
      button.disabled = true;
      status('Vérification sécurisée…');
      try {
        const result = await api({ action: 'verify', factorId, challengeId, code });
        if (result.aal !== 'aal2') throw new Error('mfa_session_upgrade_failed');
        loadControl();
      } catch (error) {
        button.disabled = false;
        status(error.message === 'valid_mfa_code_required' ? 'Le code doit contenir exactement six chiffres.' : 'Code refusé ou expiré. Recommence.', true);
      }
    });
  }

  async function challengeExisting(factorId) {
    const result = await api({ action: 'challenge', factorId });
    await verifyForm(result.factorId, result.challengeId);
  }

  function enrollmentView() {
    gate.innerHTML = `<div class="velvet-mfa-card">
      <p style="color:#d9b879;letter-spacing:.16em;text-transform:uppercase;font-size:11px">Velvet Control · AAL2</p>
      <h1>Protection administrateur obligatoire</h1>
      <p>Ton rôle donne accès à des profils, signalements ou opérations sensibles. Velvet exige donc un second facteur TOTP avant d’ouvrir Control.</p>
      <button id="velvetMfaEnroll" type="button">Configurer mon authentificateur</button>
      <p class="velvet-mfa-status" role="status"></p>
      <small>Utilise une application compatible TOTP et conserve ses codes de récupération hors de Velvet.</small>
    </div>`;
    gate.querySelector('#velvetMfaEnroll').addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      status('Création du facteur sécurisé…');
      try {
        const result = await api({ action: 'enroll' });
        await verifyForm(result.factorId, result.challengeId, result);
      } catch (error) {
        event.currentTarget.disabled = false;
        status(error.message, true);
      }
    });
  }

  api().then(async (state) => {
    if (state.aal === 'aal2') {
      loadControl();
      return;
    }
    if (state.verifiedFactors?.length) {
      await challengeExisting(state.verifiedFactors[0].id);
      return;
    }
    enrollmentView();
  }).catch((error) => {
    gate.innerHTML = `<div class="velvet-mfa-card"><h1>Accès Control bloqué</h1><p>${escape(error.message)}</p><small>Reconnecte-toi ou contacte l’administrateur sécurité Velvet.</small></div>`;
  });
})();
